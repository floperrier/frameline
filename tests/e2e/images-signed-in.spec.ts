import { expect } from '@playwright/test'
import {
  ONE_PIXEL, readTheStory, seedScene, seedStory, test, writeScene, writeStory,
} from './author'
import { SHOT_DESCRIPTION_MAX_LENGTH, SHOT_IMAGE_MAX_BYTES } from '../../shared/utils/scenes'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * One Scene's own section of the document, which is where that Scene is written:
 * every Scene of the Story is, since
 * `docs/adr/0043-a-story-is-written-as-one-document.md`. The Shots of both Scenes
 * of this Story number from one, so a Shot's own controls are found through the
 * section holding the Scene rather than by their labels alone.
 */
function writing(page: Page, scene = 'The street') {
  return page.getByRole('group', { name: `Writing ${scene}` })
}

/** One beat's row in a Scene's section, where its thumbnail and its field stand. */
function beat(page: Page, place: number) {
  return writing(page).locator('.shots > li').nth(place - 1)
}

/** The Shots of the first Scene of a Story written the way an Author writes one. */
async function openShots(request: APIRequestContext) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()

  return { story, scene: read.scenes[0]!.id, shots: read.scenes[0]!.shots }
}

/** Reads the Shots of the first Scene again, to see what a request left behind. */
async function reread(request: APIRequestContext, storyId: string) {
  const read: StoryInEditor = await (await request.get(`/api/stories/${storyId}`)).json()

  return read.scenes[0]!.shots
}

test('an Author attaches an image to a Shot, and it is served where the Shot says', async ({ request }) => {
  const { story, shots } = await openShots(request)

  const attached = await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })
  expect(attached.status()).toBe(200)
  expect(await attached.json()).toMatchObject({ image: `/api/shots/${shots[0]!.id}/image` })

  // The Story carries the address of the image, never its bytes — and a Shot the
  // Author left as text alone carries nothing at all.
  const after = await reread(request, story.id)
  expect(after[0]!.image).toBe(`/api/shots/${shots[0]!.id}/image`)
  expect(after[1]!.image).toBeNull()

  const served = await request.get(after[0]!.image!)
  expect(served.status()).toBe(200)
  // Served under the type its own first bytes say it is, and never sniffed past it.
  expect(served.headers()['content-type']).toBe('image/png')
  expect(served.headers()['x-content-type-options']).toBe('nosniff')
  expect(Buffer.compare(await served.body(), ONE_PIXEL)).toBe(0)
})

test('a Shot keeps the image attached last, and shows it', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  // A WebP, so what is served proves which of the two uploads the Shot kept.
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPnothing')])

  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: webp })

  const served = await request.get(`/api/shots/${shots[0]!.id}/image`)
  expect(served.headers()['content-type']).toBe('image/webp')

  // Replacing an image in the editor has to reach the screen and not only the
  // database: the address of an image is the Shot's own, so the second upload
  // would otherwise leave the browser drawing the image it already had.
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  const street = writing(page)
  const shown = () => beat(page, 1).locator('.image img').getAttribute('src')

  const first = await shown()
  await street.getByLabel('Image of Shot 1', { exact: true })
    .setInputFiles({ name: 'other.png', mimeType: 'image/png', buffer: ONE_PIXEL })
  await expect.poll(shown).not.toBe(first)
})

test('the run shows the image of every Shot that carries one', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')

  // This claim used to be made of a node: the Graph drew the image of a Scene's
  // first Shot, and that was what an Author recognised the Scene by before they
  // had read a word of it. The Graph is the rail now — a hundred and twenty pixels
  // down the side of the document, drawing no image, no line and no name, see
  // `docs/adr/0043-a-story-is-written-as-one-document.md` — so the claim moves to
  // where an image is still drawn small: the beat's own row, where the thumbnail
  // stands beside the words. It is what is left on the bench of reading the work
  // by looking rather than by reading, which is the question an Author judging how
  // much of it is still a grey rectangle is asking; the contact sheet of `0043` is
  // where that question is answered of the whole Story at once.
  await expect(beat(page, 1).locator('.image img'))
    .toHaveAttribute('src', `/api/shots/${shots[0]!.id}/image`)

  // The second beat carries none, so its thumbnail is the outline of the image
  // nobody has attached, which is how an unfinished beat reads as unfinished.
  await expect(beat(page, 2).locator('.image img')).toHaveCount(0)
})

test('an upload of the wrong kind, or too heavy, is refused by its reason', async ({ request }) => {
  const { story, shots } = await openShots(request)

  const notAnImage = await request.put(`/api/shots/${shots[0]!.id}/image`, {
    data: Buffer.from('<!doctype html><script>alert(1)</script>'),
  })
  expect(notAnImage.status()).toBe(400)
  // Read out of `message` and not the whole body: a refusal that slid back onto
  // the status line would pass a match on the response text.
  expect((await notAnImage.json()).message)
    .toContain('A Shot carries a JPEG, a PNG or a WebP image')

  // A real PNG head with too many bytes behind it: refused for its weight and
  // not for its kind, which is the reason the Author is owed.
  const tooHeavy = await request.put(`/api/shots/${shots[0]!.id}/image`, {
    data: Buffer.concat([ONE_PIXEL, Buffer.alloc(SHOT_IMAGE_MAX_BYTES)]),
  })
  expect(tooHeavy.status()).toBe(400)
  expect((await tooHeavy.json()).message).toContain('cannot weigh more than 2 MB')

  const nothing = await request.put(`/api/shots/${shots[0]!.id}/image`)
  expect(nothing.status()).toBe(400)
  expect((await nothing.json()).message).toContain('An image is a file to upload.')

  // Every refusal left the Shot as it was: text alone, and no image to serve.
  expect((await reread(request, story.id))[0]!.image).toBeNull()
  expect((await request.get(`/api/shots/${shots[0]!.id}/image`)).status()).toBe(404)
})

test('a Shot of someone else’s Story has no image to attach one to', async ({ request, otherAuthor }) => {
  const theirs = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')

  const attached = await request.put(`/api/shots/${theirs.shots[0]!.id}/image`, { data: ONE_PIXEL })
  expect(attached.status()).toBe(404)
})

test('an image is as reachable as the Story it belongs to', async ({ baseURL, playwright, request }) => {
  const { story, shots } = await openShots(request)
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })

  // Built by hand rather than taken from the fixtures: those carry the Author's
  // sealed session, and the whole question here is what someone without one sees.
  const stranger = await playwright.request.newContext({ baseURL, extraHTTPHeaders: {} })
  const url = `/api/shots/${shots[0]!.id}/image`
  expect((await stranger.get(url)).status()).toBe(404)

  await request.post(`/api/stories/${story.id}/publish`)
  expect((await stranger.get(url)).status()).toBe(200)

  // And nobody again once the Publish is taken away.
  await request.delete(`/api/stories/${story.id}/publish`)
  expect((await stranger.get(url)).status()).toBe(404)

  await stranger.dispose()
})

test('the Author picks a file in the editor, and a refused one says why', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The street')
  const street = writing(page)
  const picker = street.getByLabel('Image of Shot 1', { exact: true })
  await picker.setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: ONE_PIXEL })
  await expect(beat(page, 1).locator('.image img')).toBeVisible()

  // A file that is not one of the three says so, and the image already attached
  // is still the one the Shot carries.
  await picker.setInputFiles({
    name: 'notes.txt',
    mimeType: 'image/png',
    buffer: Buffer.from('Not an image at all'),
  })
  // Against the Scene it concerns rather than above the whole bench: the document
  // holds every Scene, so the sentence is said in the section of the one the write
  // was made in — see `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await expect(street.getByRole('alert')).toContainText('a JPEG, a PNG or a WebP image')
  await expect(writing(page, 'The bar').getByRole('alert')).toHaveCount(0)
  await expect(beat(page, 1).locator('.image img')).toBeVisible()
})

test('the thumbnail is the picker, and an empty one is the outline of an image', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The street')
  const street = writing(page)
  const thumbnail = street.locator('.image').first()

  // The Shot carries no image yet and is drawn as the frame one would fill, at
  // the shape a frame is thrown at: an unfinished beat is legible as one.
  const empty = (await thumbnail.boundingBox())!
  expect(empty.width / empty.height).toBeGreaterThan(1.5)
  expect(empty.width / empty.height).toBeLessThan(2)
  await expect(thumbnail.locator('img')).toBeHidden()

  // Pressing the frame is the way in, and the only one: the browser's own file
  // chrome is behind it rather than beside it, so it is the picker that opens.
  const opened = page.waitForEvent('filechooser')
  await thumbnail.click()
  await (await opened).setFiles({ name: 'image.png', mimeType: 'image/png', buffer: ONE_PIXEL })

  await expect(thumbnail.locator('img')).toBeVisible()
  await expect.poll(async () => (await reread(request, story.id))[0]!.image)
    .toBe(`/api/shots/${shots[0]!.id}/image`)

  // And the input is still the named control it was, and the Tab before the
  // beat's own field: hidden behind the frame is not hidden from the keyboard,
  // and the frame stands over the words it belongs to.
  const picker = street.getByLabel('Image of Shot 1', { exact: true })
  await picker.focus()
  await expect(picker).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(street.getByRole('textbox', { name: 'Shot 1', exact: true })).toBeFocused()

  // What it does not take is room. The browser's own file chrome was the widest
  // thing on the beat's row; clipped away inside the frame it lays nothing out, so
  // what is left of it sits within the frame's own box.
  const thumb = (await thumbnail.boundingBox())!
  const behind = (await picker.boundingBox())!
  expect(behind.x).toBeGreaterThanOrEqual(thumb.x)
  expect(behind.x + behind.width).toBeLessThanOrEqual(thumb.x + thumb.width)

  // The Description stands beside the thumbnail with the words, and keeps its own
  // label rather than borrowing the frame's box: the frame holds the work and
  // nothing else — see
  // `docs/adr/0033-a-scene-is-written-as-one-document.md`, whose row this is.
  const described = (await street.getByLabel('Description of the image of Shot 1')
    .boundingBox())!
  expect(described.x).toBeGreaterThanOrEqual(thumb.x + thumb.width)
  expect(described.height).toBeLessThan(thumb.height)

  // And the word above it is a label and not a second frame: it is the size of
  // the line it is, which is what the frame's own rule must not reach past it to
  // decide.
  const eyebrow = (await street.locator('.described label').first().boundingBox())!
  expect(eyebrow.height).toBeLessThan(thumb.height)
})

test('the image and the text of a Shot are one beat on screen', async ({ browser, page, request }) => {
  const { story, scene, shots } = await openShots(request)
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })

  // Read where it is written — in the very same box on the Graph, turned over —
  // so the frame is asked for inside the reading rather than on the page.
  await page.goto(`/stories/${story.id}?scene=${scene}`)
  const preview = await readTheStory(page)

  // Both at once: the Shot the Reading opens on shows its image beside its text.
  const image = preview.locator(`img[src="/api/shots/${shots[0]!.id}/image"]`)
  await expect(image).toBeVisible()
  await expect(preview.getByText('A door opens.')).toBeVisible()

  // The next Shot has no image, and reads perfectly well without one.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await expect(preview.getByText('She steps out.')).toBeVisible()
  await expect(image).toBeHidden()

  // And the Reader meets at the public link exactly what the Preview showed —
  // the same component on the same engine, so it could hardly be otherwise, but
  // the image is fetched over a door with no session behind it. The same frame
  // also stands in the title card as the Story's Cover, so the one asked for is
  // the one inside the Shot's figure, beside its text.
  await request.post(`/api/stories/${story.id}/publish`)
  const reader = await (await browser.newContext({ extraHTTPHeaders: {} })).newPage()
  await reader.goto(`/read/${story.id}`)
  const frame = reader.getByRole('figure').locator(`img[src^="/api/shots/${shots[0]!.id}/image"]`)
  await expect(frame).toBeVisible()
  await expect(reader.getByText('A door opens.')).toBeVisible()
})

test('an image says what it shows, and the Reader is given it', async ({ browser, page, request }) => {
  const { story, shots } = await openShots(request)
  const shot = shots[0]!
  const description = 'A door onto a wet street, opening from the inside.'
  await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })

  const written = await request.patch(`/api/shots/${shot.id}`, {
    data: { text: shot.text, description },
  })
  expect(written.status()).toBe(200)
  expect(await written.json()).toMatchObject({ description })
  expect((await reread(request, story.id))[0]!.description).toBe(description)

  // The Author meets it in the editor beside the picker that attached the image.
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  const street = writing(page)
  await expect(street.getByLabel('Description of the image of Shot 1')).toHaveValue(description)

  // Replacing the image leaves the Description standing: the bytes changed, and
  // what the Author said about the frame is not the bytes.
  await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
  expect((await reread(request, story.id))[0]!.description).toBe(description)

  // And it is what a Reader is given for the image — never the Shot's text,
  // which is read out beside it anyway, and never a Description for a Shot
  // nobody described.
  await request.post(`/api/stories/${story.id}/publish`)
  const reader = await (await browser.newContext({ extraHTTPHeaders: {} })).newPage()
  await reader.goto(`/read/${story.id}`)
  await expect(reader.getByRole('img', { name: description })).toBeVisible()
})

test('a Description is the Author’s to write, to change and to take away', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  const shot = shots[0]!
  await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })

  // A Shot with no image has nothing to describe, so nothing is asked of the
  // Author there.
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  const street = writing(page)
  await expect(street.getByLabel('Description of the image of Shot 2')).toBeHidden()

  const field = street.getByLabel('Description of the image of Shot 1')
  await field.fill('A door, opening.')
  await field.blur()
  await expect.poll(async () => (await reread(request, story.id))[0]!.description)
    .toBe('A door, opening.')

  // Taken away again: an Image may have none, and an empty Description is the
  // Author saying so rather than a request going wrong.
  await field.fill('')
  await field.blur()
  await expect.poll(async () => (await reread(request, story.id))[0]!.description).toBe('')

  // A request saying nothing about the Description is refused rather than taken
  // as an empty one, the same way a request saying nothing about the text is:
  // writing it as empty would erase what the Author wrote.
  await request.patch(`/api/shots/${shot.id}`, {
    data: { text: shot.text, description: 'A door, opening.' },
  })
  const nothingSaid = await request.patch(`/api/shots/${shot.id}`, { data: { text: 'Rewritten.' } })
  expect(nothingSaid.status()).toBe(400)
  expect((await reread(request, story.id))[0]).toMatchObject({
    text: shot.text,
    description: 'A door, opening.',
  })

  // And a Description longer than one said out loud is refused by its reason.
  const tooLong = await request.patch(`/api/shots/${shot.id}`, {
    data: { text: shot.text, description: 'w'.repeat(SHOT_DESCRIPTION_MAX_LENGTH + 1) },
  })
  expect(tooLong.status()).toBe(400)
  expect((await tooLong.json()).message).toContain('A Description says what an image shows')
  expect((await reread(request, story.id))[0]!.description).toBe('A door, opening.')
})

/**
 * The files a hand lets go of, built in the page because a `DataTransfer` cannot
 * be carried into it: what a drop hands over is a real `File` either way, and the
 * bytes travel as base64 for want of a `Buffer` in a browser.
 */
function droppedFiles(page: Page, files: { name: string, type: string, bytes: Buffer }[]) {
  return page.evaluateHandle((carried) => {
    const dropped = new DataTransfer()

    for (const file of carried) {
      const bytes = Uint8Array.from(atob(file.base64), letter => letter.charCodeAt(0))
      dropped.items.add(new File([bytes], file.name, { type: file.type }))
    }

    return dropped
  }, files.map(file => ({ ...file, base64: file.bytes.toString('base64') })))
}

test('the Author drops a file on a thumbnail, and the image is the one dropped', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The street')
  const street = writing(page)
  const thumbnail = street.locator('.image').first()

  // While the file is over it the thumbnail says it will take the drop, in the
  // grease pencil the other gestures on the bench are marked in.
  const carried = await droppedFiles(page, [{ name: 'dropped.png', type: 'image/png', bytes: ONE_PIXEL }])
  await thumbnail.dispatchEvent('dragenter', { dataTransfer: carried })
  await thumbnail.dispatchEvent('dragover', { dataTransfer: carried })
  await expect(thumbnail).toHaveClass(/over/)

  await thumbnail.dispatchEvent('drop', { dataTransfer: carried })
  await expect(thumbnail).not.toHaveClass(/over/)
  await expect(thumbnail.locator('img')).toBeVisible()
  await expect.poll(async () => (await reread(request, story.id))[0]!.image)
    .toBe(`/api/shots/${shots[0]!.id}/image`)

  // A second drop replaces the image, and the new one is what is on screen: the
  // address is the Shot's own, so it is asked for under a time the browser has
  // nothing drawn for.
  const shown = () => thumbnail.locator('img').getAttribute('src')
  const first = await shown()
  const again = await droppedFiles(page, [{ name: 'other.png', type: 'image/png', bytes: ONE_PIXEL }])
  await thumbnail.dispatchEvent('drop', { dataTransfer: again })
  await expect.poll(shown).not.toBe(first)
  expect(await shown()).toContain('?at=')

  // The thumbnail is the picker it was: pressing it opens the file chrome, and
  // the input behind it is still focusable and image named.
  const opened = page.waitForEvent('filechooser')
  await thumbnail.click()
  await (await opened).setFiles({ name: 'picked.png', mimeType: 'image/png', buffer: ONE_PIXEL })
  await expect(street.getByLabel('Image of Shot 1', { exact: true })).toBeAttached()
  await street.getByLabel('Image of Shot 1', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(street.getByRole('textbox', { name: 'Shot 1', exact: true })).toBeFocused()
})

test('a drop of several files takes the first image, and a refused one says why', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The street')
  const street = writing(page)
  const thumbnail = street.locator('.image').first()

  // Notes and two images: the first image is attached, and nothing is said about
  // the rest of what the hand was holding.
  const several = await droppedFiles(page, [
    { name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('Not an image at all') },
    { name: 'image.png', type: 'image/png', bytes: ONE_PIXEL },
    { name: 'spare.png', type: 'image/png', bytes: ONE_PIXEL },
  ])
  await thumbnail.dispatchEvent('drop', { dataTransfer: several })
  await expect(thumbnail.locator('img')).toBeVisible()
  await expect.poll(async () => (await reread(request, story.id))[0]!.image)
    .toBe(`/api/shots/${shots[0]!.id}/image`)
  // Asked once the drop has landed, so it is silence about the other two files
  // rather than a page that has not got round to saying anything yet.
  await expect(page.getByRole('alert')).toBeHidden()

  // A file the endpoint refuses is refused in the Author's own words — the phrase
  // a picked file of the same kind gets — and the image already attached stands.
  const refused = await droppedFiles(page, [
    { name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('Not an image at all') },
  ])
  await thumbnail.dispatchEvent('drop', { dataTransfer: refused })
  await expect(page.getByRole('alert')).toContainText('a JPEG, a PNG or a WebP image')
  await expect(thumbnail.locator('img')).toBeVisible()
})

test('a file dropped anywhere but a thumbnail does not take the editor off the screen', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await expect(page.getByRole('heading', { name: story.title })).toBeVisible()

  // The page refuses the default for both events, which is what stops the browser
  // opening the file in place of the editor. Read off the events themselves: a
  // synthesised drop would not navigate whether the page refused it or not.
  const carrying = (kinds: string[], types: string[]) =>
    page.getByRole('heading', { name: story.title }).evaluate((on, { kinds, types }) =>
      kinds.map((kind) => {
        const carried = new DataTransfer()
        // A file is announced as one by the kinds the drag carries, which is all a
        // page is told about it until it is let go of.
        if (types.includes('Files')) {
          carried.items.add(new File([new Uint8Array([1])], 'dropped.png', { type: 'image/png' }))
        }
        else for (const type of types) carried.setData(type, 'A line of writing')

        const event = new DragEvent(kind, { bubbles: true, cancelable: true, dataTransfer: carried })
        on.dispatchEvent(event)

        return event.defaultPrevented
      }), { kinds, types })

  expect(await carrying(['dragover', 'drop'], ['Files'])).toEqual([true, true])
  await expect(page.getByRole('heading', { name: story.title })).toBeVisible()

  // A line of text dragged from one field to another is the browser's to carry
  // out, and the page refusing every drop would have taken that away from every
  // field on it.
  expect(await carrying(['dragover', 'drop'], ['text/plain'])).toEqual([false, false])
})
