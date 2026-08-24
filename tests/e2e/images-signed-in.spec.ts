import { expect } from '@playwright/test'
import { ONE_PIXEL, openNode, seedScene, seedStory, test, writeStory } from './author'
import { SHOT_DESCRIPTION_MAX_LENGTH, SHOT_IMAGE_MAX_BYTES } from '../../shared/utils/scenes'
import type { APIRequestContext } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/** The Shots of the first Scene of a Story written the way an Author writes one. */
async function openShots(request: APIRequestContext) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()

  return { story, shots: read.scenes[0]!.shots }
}

/** Reads the Shots of the first Scene again, to see what a request left behind. */
async function reread(request: APIRequestContext, storyId: string) {
  const read: StoryInEditor = await (await request.get(`/api/stories/${storyId}`)).json()

  return read.scenes[0]!.shots
}

test('an Author attaches a still to a Shot, and it is served where the Shot says', async ({ request }) => {
  const { story, shots } = await openShots(request)

  const attached = await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })
  expect(attached.status()).toBe(200)
  expect(await attached.json()).toMatchObject({ image: `/api/shots/${shots[0]!.id}/image` })

  // The Story carries the address of the still, never its bytes — and a Shot the
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

test('a Shot keeps the still attached last, and shows it', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  // A WebP, so what is served proves which of the two uploads the Shot kept.
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPnothing')])

  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: webp })

  const served = await request.get(`/api/shots/${shots[0]!.id}/image`)
  expect(served.headers()['content-type']).toBe('image/webp')

  // Replacing a still in the editor has to reach the screen and not only the
  // database: the address of a still is the Shot's own, so the second upload
  // would otherwise leave the browser drawing the image it already had.
  await page.goto(`/stories/${story.id}`)
  const street = page.getByRole('article', { name: 'The street' })
  await openNode(page, 'The street')
  const shown = () => street.locator('img').getAttribute('src')

  const first = await shown()
  await street.getByLabel('Image of Shot 1')
    .setInputFiles({ name: 'other.png', mimeType: 'image/png', buffer: ONE_PIXEL })
  await expect.poll(shown).not.toBe(first)
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

  // Every refusal left the Shot as it was: text alone, and no still to serve.
  expect((await reread(request, story.id))[0]!.image).toBeNull()
  expect((await request.get(`/api/shots/${shots[0]!.id}/image`)).status()).toBe(404)
})

test('a Shot of someone else’s Story has no still to attach one to', async ({ request, otherAuthor }) => {
  const theirs = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')

  const attached = await request.put(`/api/shots/${theirs.shots[0]!.id}/image`, { data: ONE_PIXEL })
  expect(attached.status()).toBe(404)
})

test('a still is as reachable as the Story it belongs to', async ({ baseURL, playwright, request }) => {
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

  // The Shots of both Scenes number from one, so the picker is found through the
  // node it sits in rather than by its label alone.
  const street = page.getByRole('article', { name: 'The street' })
  await openNode(page, 'The street')
  const picker = street.getByLabel('Image of Shot 1')
  await picker.setInputFiles({ name: 'still.png', mimeType: 'image/png', buffer: ONE_PIXEL })
  await expect(street.locator('img')).toBeVisible()

  // A file that is not one of the three says so, and the still already attached
  // is still the one the Shot carries.
  await picker.setInputFiles({
    name: 'notes.txt',
    mimeType: 'image/png',
    buffer: Buffer.from('Not a still at all'),
  })
  await expect(page.getByRole('alert')).toContainText('a JPEG, a PNG or a WebP image')
  await expect(street.locator('img')).toBeVisible()
})

test('the thumbnail is the picker, and an empty one is the outline of a still', async ({ page, request }) => {
  const { story, shots } = await openShots(request)
  await page.goto(`/stories/${story.id}`)

  const street = page.getByRole('article', { name: 'The street' })
  await openNode(page, 'The street')
  const thumbnail = street.locator('.still > label').first()

  // The Shot carries no still yet and is drawn as the box one would fill, at the
  // size a thumbnail is: an unfinished Shot is legible as one.
  expect(await thumbnail.boundingBox()).toMatchObject({ width: 72, height: 48 })
  await expect(thumbnail.locator('img')).toBeHidden()

  // Pressing the thumbnail is the way in, and the only one: the browser's own file
  // chrome is behind it rather than beside it, so it is the picker that opens.
  const opened = page.waitForEvent('filechooser')
  await thumbnail.click()
  await (await opened).setFiles({ name: 'still.png', mimeType: 'image/png', buffer: ONE_PIXEL })

  await expect(thumbnail.locator('img')).toBeVisible()
  await expect.poll(async () => (await reread(request, story.id))[0]!.image)
    .toBe(`/api/shots/${shots[0]!.id}/image`)

  // And the input is still the named control it was, reached from the Shot's text
  // by the next Tab: hidden behind the thumbnail is not hidden from the keyboard.
  await street.getByRole('textbox', { name: 'Shot 1', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(street.getByLabel('Image of Shot 1')).toBeFocused()
})

test('the still and the text of a Shot are one beat on screen', async ({ browser, page, request }) => {
  const { story, shots } = await openShots(request)
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })

  await page.goto(`/stories/${story.id}/preview`)

  // Both at once: the Shot the Reading opens on shows its still beside its text.
  const still = page.locator(`img[src="/api/shots/${shots[0]!.id}/image"]`)
  await expect(still).toBeVisible()
  await expect(page.getByText('A door opens.')).toBeVisible()

  // The next Shot has no still, and reads perfectly well without one.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('She steps out.')).toBeVisible()
  await expect(still).toBeHidden()

  // And the Reader meets at the public link exactly what the Preview showed —
  // the same component on the same engine, so it could hardly be otherwise, but
  // the still is fetched over a door with no session behind it.
  await request.post(`/api/stories/${story.id}/publish`)
  const reader = await (await browser.newContext({ extraHTTPHeaders: {} })).newPage()
  await reader.goto(`/read/${story.id}`)
  await expect(reader.locator(`img[src^="/api/shots/${shots[0]!.id}/image"]`)).toBeVisible()
  await expect(reader.getByText('A door opens.')).toBeVisible()
})

test('a still says what it shows, and the Reader is given it', async ({ browser, page, request }) => {
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

  // The Author meets it in the editor beside the picker that attached the still.
  await page.goto(`/stories/${story.id}`)
  const street = page.getByRole('article', { name: 'The street' })
  await openNode(page, 'The street')
  await expect(street.getByLabel('Description of the still of Shot 1')).toHaveValue(description)

  // Replacing the still leaves the Description standing: the bytes changed, and
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

  // A Shot with no still has nothing to describe, so nothing is asked of the
  // Author there.
  await page.goto(`/stories/${story.id}`)
  const street = page.getByRole('article', { name: 'The street' })
  await openNode(page, 'The street')
  await expect(street.getByLabel('Description of the still of Shot 2')).toBeHidden()

  const field = street.getByLabel('Description of the still of Shot 1')
  await field.fill('A door, opening.')
  await field.blur()
  await expect.poll(async () => (await reread(request, story.id))[0]!.description)
    .toBe('A door, opening.')

  // Taken away again: a Still may have none, and an empty Description is the
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
  expect((await tooLong.json()).message).toContain('A Description says what a still shows')
  expect((await reread(request, story.id))[0]!.description).toBe('A door, opening.')
})
