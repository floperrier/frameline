import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { Shot, StoryInEditor } from '../../shared/utils/scenes'
import {
  ONE_PIXEL, live, readShots, seedScene, seedStory, test, toast, writeStory, type Author,
} from './author'

/**
 * A Shot written again right under itself, carrying its Image and everything it
 * plays with, so the same frame takes the next line: the ⧉ among a row's marks,
 * between ↗ and ↑ — issue #424.
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

/** What a Shot carries, past what names it: its id, and the addresses its matter is served at, which are its id's. */
function carried({ id: _id, image: _image, sound: _sound, position: _position, ...rest }: Shot) {
  return rest
}

test('the Sample’s first Shot written again under itself is the same frame, and takes the next line',
  async ({ page, request, author }) => {
    await plant(author)
    const [{ id }] = await (await request.get('/api/stories')).json()
    const planted = await readTheStory(request, id)
    const [opening, , last] = planted.scenes
    const [first, ...rest] = opening!.shots

    // A Condition the opening Shot plays under from the start of a Reading, so the
    // copy has one to carry and the Preview still plays both.
    expect((await request.put(`/api/shots/${first!.id}/conditions`, {
      data: { conditions: [{ scene: last!.id, entered: false }] },
    })).ok()).toBe(true)

    await page.goto(`/stories/${id}`)
    await live(page)
    await page.getByRole('button', { name: 'Duplicate Shot 1 of Where a Story starts', exact: true }).click()
    await expect(toast(page)).toHaveText('Shot 1 of Where a Story starts written again as Shot 2')

    // One Shot more, and the second is the copy: everything the first carries,
    // under an id of its own, and every Shot after it one Place on.
    const written = await readTheStory(request, id)
    const run = written.scenes[0]!.shots
    expect(run).toHaveLength(opening!.shots.length + 1)
    const [original, copy] = run
    expect(original!.id).toBe(first!.id)
    expect(copy!.id).not.toBe(first!.id)
    expect(run.slice(2).map(shot => shot.id)).toEqual(rest.map(shot => shot.id))
    expect(carried(copy!)).toEqual(carried(original!))
    expect(copy).toMatchObject({
      text: first!.text,
      description: first!.description,
      movementDirection: 'closer',
      movementBy: 12,
      imageArrives: { effect: 'from-blur', over: 1500, strength: 'marked' },
      conditions: [{ scene: last!.id, entered: false }],
    })

    // The bytes behind both Images are the same bytes.
    const [mine, its] = await Promise.all([original!, copy!].map(
      async shot => (await request.get(`/api/shots/${shot.id}/image`)).body()))
    expect(its.equals(mine)).toBe(true)

    // The caret is in the copy's words, all of them selected, so typing replaces
    // them and leaves the original's alone.
    const editor = page.locator(`[id="shot-${copy!.id}"].ProseMirror`)
    await expect(editor).toBeFocused()
    await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe(first!.text)
    await page.keyboard.type('The same panel, and the next line under it.')
    await editor.blur()
    await expect.poll(async () => (await readShots(opening!.id)).slice(0, 2).map(shot => shot.text))
      .toEqual([first!.text, 'The same panel, and the next line under it.'])

    // And the Preview reads both beats, in order.
    await page.getByRole('button', { name: 'Read from Shot 1 of Where a Story starts', exact: true }).click()
    const frame = page.getByRole('region', { name: /^Preview/ }).locator('.frame')
    await expect(frame).toContainText(first!.text)
    await expect(frame).toBeFocused()
    await page.keyboard.press('Space')
    await expect(frame).toContainText('The same panel, and the next line under it.')
  })

test('a Shot is written again under itself and never as the Cover, by its own Author alone',
  async ({ page, request, otherAuthor }) => {
    const story = await writeStory(request)
    const { scenes: [street] } = await readTheStory(request, story.id)
    const [door, steps] = street!.shots
    expect((await request.put(`/api/shots/${door!.id}/image`, { data: ONE_PIXEL })).ok()).toBe(true)
    expect((await request.patch(`/api/stories/${story.id}`, { data: { coverShotId: door!.id } })).ok())
      .toBe(true)

    const written = await request.post(`/api/shots/${door!.id}/duplicate`)
    expect(written.status()).toBe(201)
    const copy = await written.json()
    expect(copy).toMatchObject({ text: 'A door opens.', position: 1 })

    await expect(readShots(street!.id)).resolves.toEqual([
      { id: door!.id, text: 'A door opens.', position: 0 },
      { id: copy.id, text: 'A door opens.', position: 1 },
      { id: steps!.id, text: 'She steps out.', position: 2 },
    ])
    expect((await readTheStory(request, story.id)).coverShotId).toBe(door!.id)

    // Somebody else's Shot is not one there is to write again.
    const theirs = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')
    expect((await request.post(`/api/shots/${theirs.shots[0]!.id}/duplicate`)).status()).toBe(404)
    await expect(readShots(theirs.id)).resolves.toHaveLength(1)

    // A Shot with no words is written again with none, and the caret is in them.
    await request.patch(`/api/shots/${steps!.id}`, { data: { text: '' } })
    await page.goto(`/stories/${story.id}?scene=${street!.id}`)
    await live(page)
    await page.getByRole('button', { name: 'Duplicate Shot 3 of The street', exact: true }).click()
    await expect(toast(page)).toHaveText('Shot 3 of The street written again as Shot 4')
    const [, , , empty] = await readShots(street!.id)
    expect(empty).toMatchObject({ text: '', position: 3 })
    await expect(page.locator(`[id="shot-${empty!.id}"].ProseMirror`)).toBeFocused()
    await expect.poll(() => page.evaluate(() => getSelection()?.isCollapsed)).toBe(true)
  })
