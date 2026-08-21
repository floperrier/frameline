import { expect } from '@playwright/test'
import { ONE_PIXEL, seedScene, seedStory, test, writeStory } from './author'
import { SHOT_IMAGE_MAX_BYTES } from '../../shared/utils/shots'
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

test('a Shot keeps the still attached last', async ({ request }) => {
  const { shots } = await openShots(request)
  // A WebP, so what is served proves which of the two uploads the Shot kept.
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPnothing')])

  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })
  await request.put(`/api/shots/${shots[0]!.id}/image`, { data: webp })

  const served = await request.get(`/api/shots/${shots[0]!.id}/image`)
  expect(served.headers()['content-type']).toBe('image/webp')
})

test('an upload of the wrong kind, or too heavy, is refused by its reason', async ({ request }) => {
  const { story, shots } = await openShots(request)

  const notAnImage = await request.put(`/api/shots/${shots[0]!.id}/image`, {
    data: Buffer.from('<!doctype html><script>alert(1)</script>'),
  })
  expect(notAnImage.status()).toBe(400)
  expect(await notAnImage.text()).toContain('A Shot carries a JPEG, a PNG or a WebP image')

  // A real PNG head with too many bytes behind it: refused for its weight and
  // not for its kind, which is the reason the Author is owed.
  const tooHeavy = await request.put(`/api/shots/${shots[0]!.id}/image`, {
    data: Buffer.concat([ONE_PIXEL, Buffer.alloc(SHOT_IMAGE_MAX_BYTES)]),
  })
  expect(tooHeavy.status()).toBe(400)
  expect(await tooHeavy.text()).toContain('cannot weigh more than 2 MB')

  const nothing = await request.put(`/api/shots/${shots[0]!.id}/image`)
  expect(nothing.status()).toBe(400)
  expect(await nothing.text()).toContain('An image is a file to upload.')

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

test('the still and the text of a Shot are one beat on screen', async ({ page, request }) => {
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
})
