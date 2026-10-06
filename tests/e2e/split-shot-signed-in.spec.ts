import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { Scene, StoryInEditor } from '../../shared/utils/scenes'
import { live, readShots, seedScene, seedStory, test, toast, type Author } from './author'

/**
 * A Shot's words cut in two where the caret stands, and joined back to the Shot
 * before from the head of the next — issue #432,
 * `docs/adr/0071-a-shots-words-are-cut-where-the-caret-stands.md`.
 */

/** The Sample, planted the way `sample-signed-in.spec.ts` plants it. */
async function plant(author: Author) {
  await plantSample(author.id, 'en', {
    db: drizzle(process.env.DATABASE_URL!, { schema }),
    image: name => readFile(imagePath(name)),
    sound: file => readFile(soundPath(file)),
  })
}

function readTheStory(request: APIRequestContext, id: string) {
  return request.get(`/api/stories/${id}`).then(read => read.json() as Promise<StoryInEditor>)
}

/**
 * A Scene as it reads, with an `attrs` holding nothing but nulls left out: the
 * editor writes every attribute it holds, where the Sample's builders leave them
 * out, and the two say the same.
 */
function asRead(scene: Scene) {
  return JSON.parse(JSON.stringify(scene, (key, value) =>
    key === 'attrs' && Object.values(value).every(held => held === null) ? undefined : value))
}

/** The editor on a Shot, which its box becomes once it has the focus. */
async function editorOn(page: Page, shotId: string) {
  await page.locator(`#shot-${shotId}`).focus()
  const editor = page.locator(`[id="shot-${shotId}"].ProseMirror`)
  await expect(editor).toBeFocused()
  return editor
}

type Held = {
  editor: {
    state: { selection: { from: number }, doc: { descendants: (walk: (node: { isText: boolean, text?: string }, pos: number) => boolean) => void } }
    commands: { setTextSelection: (at: number) => void }
  }
}

/** Puts the caret right before some words, in the editor's own state rather than the page's selection, which it reads a task later. */
async function caretBefore(editor: Locator, words: string) {
  await editor.evaluate((field, sought) => {
    const { editor: held } = field as unknown as Held
    let at = -1
    held.state.doc.descendants((node, pos) => {
      if (at === -1 && node.isText && node.text!.includes(sought)) at = pos + node.text!.indexOf(sought)
      return at === -1
    })
    held.commands.setTextSelection(at)
  }, words)
}

const caret = (editor: Locator) => editor.evaluate(field => (field as unknown as Held).editor.state.selection.from)

test('Enter in the middle of the first Shot’s words cuts it there, and Backspace right away joins it back',
  async ({ page, request, author }) => {
    await plant(author)
    const [{ id }] = await (await request.get('/api/stories')).json()
    const planted = await readTheStory(request, id)
    const opening = planted.scenes[0]!
    const [first, ...rest] = opening.shots
    const kept = 'This is a Shot: one Image and its text, shown to you as a single beat. '
    const taken = 'The Scene you are in is a run of them, and it runs in the same order for every Reader.'
    expect(first!.text).toBe(kept + taken)

    await page.goto(`/stories/${id}`)
    await live(page)
    await caretBefore(await editorOn(page, first!.id), 'The Scene you are in')
    await page.keyboard.press('Enter')

    // The Shot keeps the words before and everything about its Image; the new
    // one right under it holds the words after and nothing of the Image.
    await expect.poll(async () => (await readTheStory(request, id)).scenes[0]!.shots.length)
      .toBe(opening.shots.length + 1)
    const run = (await readTheStory(request, id)).scenes[0]!.shots
    const [cut, after] = run
    expect(cut).toMatchObject({
      id: first!.id,
      text: kept,
      description: first!.description,
      layout: 'full',
      cropX: 21,
      movementDirection: 'closer',
      movementBy: 12,
      imageArrives: { effect: 'from-blur', over: 1500, strength: 'marked' },
    })
    expect(cut!.image).not.toBeNull()
    expect(after).toMatchObject({
      text: taken,
      position: 1,
      image: null,
      sound: null,
      description: '',
      layout: null,
      cropX: 50,
      movementDirection: null,
      imageArrives: null,
      conditions: [],
    })
    expect(run.slice(2).map(shot => [shot.id, shot.position]))
      .toEqual(rest.map(shot => [shot.id, shot.position + 1]))

    // The caret is at the head of the words after.
    const following = page.locator(`[id="shot-${after!.id}"].ProseMirror`)
    await expect(following).toBeFocused()
    await expect.poll(() => caret(following)).toBe(1)

    // Backspace there joins them back, the caret at the seam, and the Scene reads
    // exactly as it was planted.
    await page.keyboard.press('Backspace')
    await expect.poll(async () => asRead((await readTheStory(request, id)).scenes[0]!)).toEqual(asRead(opening))
    const joined = page.locator(`[id="shot-${first!.id}"].ProseMirror`)
    await expect(joined).toBeFocused()
    await expect.poll(() => caret(joined)).toBe(1 + kept.length)

    // A Shot carrying an Image is not joined to the one before, and says so.
    const framed = opening.shots[3]!
    await caretBefore(await editorOn(page, framed.id), 'A Story is read forwards')
    await page.keyboard.press('Backspace')
    await expect(toast(page))
      .toHaveText('Shot 4 of Where a Story starts carries an Image, so its words are not joined to Shot 3.')
    await expect(readShots(opening.id)).resolves.toEqual(
      opening.shots.map(shot => ({ id: shot.id, text: shot.text, position: shot.position })))
  })

test('a Shot cut inside a speech gives both halves its Speaker and its Conditions, and keeps its Sound',
  async ({ page, request, author, otherAuthor }) => {
    await plant(author)
    const [{ id }] = await (await request.get('/api/stories')).json()
    const { scenes: [opening, , last] } = await readTheStory(request, id)
    const spoken = opening!.shots[1]!
    const conditions = [{ scene: last!.id, entered: false }]
    expect((await request.put(`/api/shots/${spoken.id}/conditions`, { data: { conditions } })).ok()).toBe(true)

    await page.goto(`/stories/${id}`)
    await live(page)
    await caretBefore(await editorOn(page, spoken.id), 'A Shot may be')
    await page.keyboard.press('Enter')

    await expect.poll(async () => (await readTheStory(request, id)).scenes[0]!.shots.length)
      .toBe(opening!.shots.length + 1)
    const [, cut, after] = (await readTheStory(request, id)).scenes[0]!.shots
    expect(cut).toMatchObject({ id: spoken.id, text: 'Someone\nWhere is the Image?\nThis Shot\nThere is none. ', conditions })
    expect(cut!.sound).not.toBeNull()
    expect(cut!.transcript).toBe('A door closes.')
    expect(after).toMatchObject({
      text: 'This Shot\nA Shot may be text alone, or an Image alone. What it may not be is neither.',
      conditions,
      sound: null,
      transcript: '',
      textArrives: { effect: 'shake', over: 500, strength: 'slight' },
    })

    // Backspace at the head of the Shot that keeps the Sound leaves it where it is.
    await caretBefore(await editorOn(page, spoken.id), 'Someone')
    await page.keyboard.press('Backspace')
    await expect(toast(page))
      .toHaveText('Shot 2 of Where a Story starts carries a Sound, so its words are not joined to Shot 1.')

    // Somebody else's Shot is not one there is to cut.
    const theirs = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')
    const halves = { before: cut!.formatted, after: after!.formatted }
    expect((await request.post(`/api/shots/${theirs.shots[0]!.id}/split`, { data: halves })).status()).toBe(404)
    await expect(readShots(theirs.id)).resolves.toHaveLength(1)
  })
