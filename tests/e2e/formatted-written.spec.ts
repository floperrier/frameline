import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import {
  ONE_PIXEL, live, readTheStory, seedPublished, test, writeShot, writeStory,
} from './author'
import { bar, formatted, formattedOf, line, run } from '../../shared/utils/formatted'
import { REDACTION_HIDES_MAX_LENGTH, SHOT_TEXT_MAX_LENGTH } from '../../shared/utils/scenes'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Shot's text formatted where it is written, and read as it was formatted —
 * issue #359. What is held here is what only a browser can say: that a key and a
 * toolbar set a style the bench, the Preview and the public link all draw, that a
 * paste keeps only what the schema names, that a bar keeps its words out of the
 * page and the payload, that the Reader's page carries no editor, and that the
 * doors refuse in a sentence what the boundary refuses. The shape itself is
 * `tests/unit/formatted.spec.ts`, and the drawing `tests/unit/draw.spec.ts`.
 */

const italic = { type: 'emphasis' } as const

async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

/** `writeStory`, open on the bench at its first Scene, and the box of that Scene's first Shot. */
async function writing(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await reread(request, story.id)
  await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
  await live(page)

  return { story, scenes, box: page.locator(`#shot-${scenes[0]!.shots[0]!.id}`) }
}

/** The toolbar of the first Shot of The street, which is there while the caret is in it. */
function toolbar(page: Page) {
  return page.getByRole('toolbar', { name: 'Formatting of Shot 1 of The street' })
}

/**
 * Takes a word of the text being written, as a hand dragged across it, and waits
 * for the editor to have read the selection the page now shows: ProseMirror reads
 * it a task later, and a key struck in between acts on the selection it had.
 * *Redact the Selection* is offered only on a selection, so it is the toolbar
 * saying it has read one. Taken from the page rather than by keys, because the
 * keys that walk a line differ from one platform to the next.
 */
async function select(text: Locator, word: string) {
  await text.evaluate((field, taken) => {
    const walking = document.createTreeWalker(field, NodeFilter.SHOW_TEXT)
    for (let node = walking.nextNode(); node; node = walking.nextNode()) {
      const at = node.textContent!.indexOf(taken)
      if (at >= 0) return getSelection()!.setBaseAndExtent(node, at, node, at + taken.length)
    }
  }, word)
  await expect(toolbar(text.page()).getByRole('button', { name: 'Redact the Selection' }))
    .not.toHaveAttribute('aria-disabled')
}

test('a word made italic by its key is italic in the writing, the Preview and the public link',
  async ({ page, request }) => {
    const { story, box } = await writing(page, request)

    await writeShot(box, 'A door opens.')
    await select(box, 'door')
    const pressed = toolbar(page).getByRole('button', { name: 'Italic' })
    await expect(pressed).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('ControlOrMeta+i')

    // The toggle says what the selection now carries, and the editor draws it.
    await expect(pressed).toHaveAttribute('aria-pressed', 'true')
    await expect(box.locator('em')).toHaveText('door')
    await box.blur()
    // Matched rather than equal: the editor says each attribute it holds, null
    // where the text is as the Story is set, and the builders leave them out.
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.shots[0]!.formatted)
      .toMatchObject(formatted(line('A ', run('door', italic), ' opens.')))

    // The box a Shot is drawn in when nobody is writing in it is the renderer's
    // drawing, the same `<em>` the editor drew.
    await page.reload()
    await live(page)
    await expect(box).not.toHaveClass(/ProseMirror/)
    await expect(box.locator('em')).toHaveText('door')

    const preview = await readTheStory(page)
    await expect(preview.locator('.shot em')).toHaveText('door')

    await seedPublished(story)
    await page.goto(`/read/${story.id}`)
    await expect(page.locator('.shot em')).toHaveText('door')
  })

test('a run set in the typewriter and a Story set in it are drawn in the typewriter, and a run set back in the book stays in it',
  async ({ page, request }) => {
    const { story, box } = await writing(page, request)
    const typewriter = /^"?Courier Prime"?,/
    const book = /^"?Newsreader"?,/

    await writeShot(box, 'A door opens.')
    await select(box, 'door')
    await toolbar(page).getByRole('combobox', { name: 'Typeface' }).selectOption('Typewriter')
    await expect(box.locator('.face-typewriter')).toHaveText('door')
    await expect(box.locator('.face-typewriter')).toHaveCSS('font-family', typewriter)

    // And the last word set in the book, which is what the Story is set in yet.
    await select(box, 'opens')
    await toolbar(page).getByRole('combobox', { name: 'Typeface' }).selectOption('Book')
    await expect(box.locator('.face-prose')).toHaveText('opens')
    await box.blur()

    // The Story set in the typewriter: every run that says nothing follows it,
    // and the run that says *Book* stays where it was set.
    await page.getByText('How it is read').click()
    await page.getByLabel('The text is set in').selectOption('Typewriter')
    await expect.poll(async () => (await reread(request, story.id)).textFace).toBe('typewriter')
    await expect(box).toHaveCSS('font-family', typewriter)
    await expect(box.locator('.face-prose')).toHaveCSS('font-family', book)

    // And the Reader sees it set as the bench drew it.
    await seedPublished(story)
    await page.goto(`/read/${story.id}`)
    await expect(page.locator('.shot')).toHaveCSS('font-family', typewriter)
    await expect(page.locator('.shot .face-typewriter')).toHaveText('door')
    await expect(page.locator('.shot .face-prose')).toHaveCSS('font-family', book)
  })

test('a paste keeps its italic and its lines, and leaves the colour, the link, the heading and the script',
  async ({ page, request }) => {
    const { story, box } = await writing(page, request)
    await writeShot(box, '')

    // What a browser puts on the clipboard from a page, handed to the editor the
    // way the platform hands it a paste.
    const pasted = '<meta charset="utf-8"><p>An <em>open</em> door, <span style="color:red">red</span>, '
      + '<a href="https://example.com/">a link</a>.</p><h1>A heading</h1>'
      + '<script>document.title = "pasted"</script>'
    await box.evaluate((field, html) => {
      const data = new DataTransfer()
      data.setData('text/html', html)
      data.setData('text/plain', 'An open door, red, a link.\nA heading')
      field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    }, pasted)

    await expect(box.locator('p')).toHaveText(['An open door, red, a link.', 'A heading'])
    await expect(box.locator('em')).toHaveText('open')
    await expect(box.locator('a, h1, script, [style*="color"]')).toHaveCount(0)
    await box.blur()

    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.shots[0]!.formatted)
      .toMatchObject(formatted(line('An ', run('open', italic), ' door, red, a link.'), line('A heading')))
    expect(await page.title()).not.toBe('pasted')
  })

test('a bar is remarked on until what it hides is said, and its words are in neither the page nor the payload',
  async ({ page, request }) => {
    const { story, box } = await writing(page, request)
    const remark = 'Shot 1 of The street hides words behind a bar and says nothing of them to a Reader who cannot see it.'
    const found = page.locator('.found')

    await writeShot(box, 'Signed, Vivian Marsh.')
    await select(box, 'Vivian Marsh')
    await toolbar(page).getByRole('button', { name: 'Redact the Selection' }).click()

    // The words are gone from the text and a bar of their length stands for them.
    await expect(box.locator('.bar')).toHaveText('█'.repeat('Vivian Marsh'.length))
    await expect(found).toContainText(remark)

    // The bar is held, so the toolbar asks what it hides, the focus already there
    // rather than on a bar the next key would type over; once that is said, the
    // Remark has nothing left to say.
    const hides = toolbar(page).getByLabel('What the bar hides, for a Reader who cannot see it')
    await expect(hides).toBeFocused()
    await hides.fill('a name')
    await hides.blur()
    await expect(found).not.toContainText(remark)
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.shots[0]!.formatted)
      .toMatchObject(formatted(line('Signed, ', bar('Vivian Marsh'.length, 'a name'), '.')))
    expect(await page.content()).not.toContain('Vivian')

    await seedPublished(story)
    const read = await (await request.get(`/api/read/${story.id}`)).text()
    expect(read).toContain('a name')
    expect(read).not.toContain('Vivian')

    await page.goto(`/read/${story.id}`)
    await expect(page.locator('.shot .bar')).toContainText('a name')
    expect(await page.content()).not.toContain('Vivian')
  })

test('the Reader\'s page loads no editor, and the bench holds one however many Shots are walked',
  async ({ page, request }) => {
    const { story, scenes, box } = await writing(page, request)
    const street = scenes[0]!
    for (let more = 0; more < 3; more++) {
      expect((await request.post(`/api/scenes/${street.id}/shots`)).ok()).toBeTruthy()
    }
    await seedPublished(story)

    // Every script a page loads, read for the editor's own name, which
    // ProseMirror writes on the element it edits and so carries as a string.
    const loaded = (at: Page) => {
      const scripts: Promise<string>[] = []
      at.on('response', (response) => {
        if (response.request().resourceType() === 'script' || response.url().endsWith('.js')) {
          // A body gone by the time it is read is one that carries no editor.
          scripts.push(response.text().catch(() => ''))
        }
      })
      return async () => {
        const read = await Promise.all(scripts)
        return { read: read.length, editors: read.filter(script => script.includes('ProseMirror')).length }
      }
    }

    // A page of its own, so nothing the bench fetched is served to it from memory.
    const reader = await page.context().newPage()
    const readerLoaded = loaded(reader)
    await reader.goto(`/read/${story.id}`)
    await live(reader)
    await reader.waitForLoadState('networkidle')
    await expect(reader.locator('.shot')).toHaveText('A door opens.')
    const { read, editors } = await readerLoaded()
    expect(read).toBeGreaterThan(0)
    expect(editors).toBe(0)
    await reader.close()

    // The bench does load it — which is what makes the count above mean anything —
    // and walking the run moves the one editor rather than making another.
    const benched = loaded(page)
    await page.reload()
    await live(page)
    await box.click()
    await expect(page.locator(`#shot-${street.shots[0]!.id}.ProseMirror`)).toBeFocused()
    for (let place = 2; place <= 5; place++) {
      await page.keyboard.press('Alt+ArrowDown')
      await expect(page.getByRole('textbox', { name: `Shot ${place} of The street`, exact: true }))
        .toHaveClass(/ProseMirror/)
    }
    await expect(page.locator('.ProseMirror')).toHaveCount(1)
    await expect(page.getByRole('toolbar')).toHaveCount(1)
    expect((await benched()).editors).toBeGreaterThan(0)
  })

test('the toolbar is one stop, and the stop is the control used last', async ({ page, request }) => {
  const { box } = await writing(page, request)
  const bar = toolbar(page)
  const text = page.locator(`[id="${await box.getAttribute('id')}"].ProseMirror`)

  await box.click()
  await expect(text).toBeFocused()
  // Set as the box it replaced is set, so no line moves under the hand.
  await expect(text).toHaveCSS('white-space', 'pre-wrap')
  await expect(text).toHaveCSS('font-variant-ligatures', 'normal')
  await page.keyboard.press('Tab')
  await expect(bar.getByRole('button', { name: 'Italic' })).toBeFocused()

  // The arrows walk the toolbar, and `Tab` leaves it from wherever they stopped.
  await page.keyboard.press('ArrowRight')
  await expect(bar.getByRole('button', { name: 'Bold' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(bar.locator(':focus')).toHaveCount(0)
  await expect(text).not.toBeFocused()

  // Coming back, the stop is where it was left, and one more step back is the text.
  await page.keyboard.press('Shift+Tab')
  await expect(bar.getByRole('button', { name: 'Bold' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(text).toBeFocused()

  // And `Escape` in the toolbar puts the caret back in the text.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(text).toBeFocused()

  // A select stepped by a key, which on Windows and Linux says a change at every
  // step, takes the step and keeps the focus where the keys are; `Enter` is what
  // puts the caret back. Stepped by hand, because what an arrow does to a closed
  // select is the platform's: on a Mac it opens the list instead.
  const size = bar.getByRole('combobox', { name: 'Size' })
  await size.focus()
  await size.dispatchEvent('keydown', { key: 'ArrowDown' })
  await size.evaluate((select: HTMLSelectElement) => {
    select.value = 'large'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(size).toHaveValue('large')
  await expect(size).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(text).toBeFocused()
})

/**
 * The doors asked directly, for what the editor never sends: it reads the text
 * through the boundary before it writes it, so these are the half of the boundary
 * nothing on the bench reaches. Every case asserts the sentence as well as the
 * status, because the sentence is the refusal:
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
test('the doors refuse a formatted text outside its shape, a text said twice, and a Story set otherwise, in words',
  async ({ request }) => {
    const story = await writeStory(request)
    const before = await reread(request, story.id)
    const shot = `/api/shots/${before.scenes[0]!.shots[0]!.id}`
    const storied = `/api/stories/${story.id}`

    async function refuses(door: string, data: Record<string, unknown>, said: string) {
      const answer = await request.patch(door, { data })

      expect([door, JSON.stringify(data), answer.status()]).toEqual([door, JSON.stringify(data), 400])
      expect([door, (await answer.json()).message]).toEqual([door, said])
    }

    const aShape = 'A Shot\'s text is written in lines and blocks, each run styled from a fixed set.'
    for (const shape of [
      { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'A title' }] }] },
      formatted(line(run('A link', { type: 'link' } as never))),
      formatted(line(run('Red', { type: 'colour', attrs: { ink: 'red', band: false } } as never))),
      formatted(line(run(''))),
      formatted(line(run('Two\nlines'))),
      formatted(line(bar(0, 'nothing'))),
      { ...formatted(line('A door opens.')), extra: true },
    ]) {
      await refuses(shot, { formatted: shape }, aShape)
    }

    await refuses(shot, { text: 'A door opens.', formatted: formattedOf('A door opens.') },
      'A Shot\'s text is written once, formatted or plain, never both.')
    await refuses(shot, { formatted: formatted(line(bar(4, 'a'.repeat(REDACTION_HIDES_MAX_LENGTH + 1)))) },
      `What a bar hides is said in at most ${REDACTION_HIDES_MAX_LENGTH} characters.`)
    // Measured on the plain words, so a bar is as long as what it stands for.
    await refuses(shot, { formatted: formatted(line(bar(SHOT_TEXT_MAX_LENGTH + 1, 'a name'))) },
      `A Shot cannot hold more than ${SHOT_TEXT_MAX_LENGTH} characters.`)

    await refuses(storied, { textFace: 'comic' },
      'A Story\'s text is set in the book, title, typewriter or handwriting face.')
    await refuses(storied, { textAlign: 'justify' },
      'A Story\'s text is aligned to the start, the centre or the end of its lines.')

    // Refused is refused: the Shot and the Story hold what they held.
    const after = await reread(request, story.id)
    expect(after.scenes[0]!.shots[0]!.formatted).toEqual(before.scenes[0]!.shots[0]!.formatted)
    expect(after).toMatchObject({ textFace: 'prose', textAlign: 'start' })

    // And what is in the shape is taken, its plain words with it.
    const taken = formatted(line('A ', run('door', italic), ' opens.'))
    const written = await request.patch(shot, { data: { formatted: taken } })
    expect(written.status()).toBe(200)
    expect(await written.json()).toMatchObject({ formatted: taken, text: 'A door opens.' })
  })

test('a Scene duplicated carries its formatted text, and a Description written on the Contact Sheet leaves it',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const street = (await reread(request, story.id)).scenes[0]!
    const shot = street.shots[0]!
    const set = formatted(line('A ', run('door', italic), ' opens.'))
    expect((await request.patch(`/api/shots/${shot.id}`, { data: { formatted: set } })).status()).toBe(200)

    const made = await request.post(`/api/scenes/${street.id}/duplicate`)
    expect(made.status()).toBe(201)
    const { id: copyId } = await made.json() as { id: string }
    const copy = (await reread(request, story.id)).scenes.find(scene => scene.id === copyId)!
    expect(copy.shots[0]).toMatchObject({ formatted: set, text: 'A door opens.' })

    // The sheet writes the Description alone, so the text it does not show is
    // not sent back plain over the formatting.
    await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
    await page.goto(`/stories/${story.id}`)
    await live(page)
    await page.getByRole('button', { name: 'See the Contact Sheet' }).click()
    const sheet = page.getByRole('region', { name: 'Contact Sheet' })
    await sheet.locator('.frames button').first().click()
    const described = sheet.getByLabel('Description of the image of Shot 1')
    await described.fill('A door onto a wet street.')
    await described.blur()

    await expect.poll(async () => (await reread(request, story.id)).scenes
      .find(scene => scene.id === street.id)!.shots[0]!.description).toBe('A door onto a wet street.')
    expect((await reread(request, story.id)).scenes.find(scene => scene.id === street.id)!.shots[0])
      .toMatchObject({ formatted: set, text: 'A door opens.' })
  })
