import { readFileSync } from 'node:fs'
import type { APIRequestContext, Page, PlaywrightWorkerArgs } from '@playwright/test'
import { expect } from '@playwright/test'
import type { StoryAtItsLink } from '../../shared/utils/reading'
import type { StoryInEditor } from '../../shared/utils/scenes'
import {
  A_SOUND, begin, live, ONE_PIXEL, readTheStory, seedPublication, test, toast, writeStory,
} from './author'

/**
 * A second Image, different bytes from the pixel, so two Stories carrying one
 * apiece hold two digests rather than the same one twice.
 */
const ANOTHER_IMAGE = readFileSync(new URL('../../demonstration/images/an-image.webp', import.meta.url))

const DIGEST_ADDRESS = (storyId: string) => new RegExp(`^/api/read/${storyId}/media/[0-9a-f]{64}$`)

/**
 * Somebody with no account asking the Reader's door. Built by hand rather than
 * taken from the fixtures, which carry the Author's sealed session: a context
 * left to inherit them is the Author reading their own Story. It closes each
 * connection behind it as the fixture's does, and for its reason.
 */
function stranger(playwright: PlaywrightWorkerArgs['playwright'], baseURL?: string) {
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { connection: 'close' } })
}

/** The Story as its Author's bench reads it. */
async function onTheBench(request: APIRequestContext, id: string): Promise<StoryInEditor> {
  return (await request.get(`/api/stories/${id}`)).json()
}

/** The Story as the public link answers it. */
async function atItsLink(reader: APIRequestContext, id: string): Promise<StoryAtItsLink> {
  const answered = await reader.get(`/api/read/${id}`)
  expect(answered.status()).toBe(200)
  return answered.json()
}

/** `writeStory`, with an Image on the first Shot of its opening Scene. */
async function writeIllustrated(request: APIRequestContext, image = ONE_PIXEL) {
  const story = await writeStory(request)
  const shot = (await onTheBench(request, story.id)).scenes[0]!.shots[0]!
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: image })).ok()).toBe(true)

  return { story, shot }
}

function publish(request: APIRequestContext, id: string) {
  return request.post(`/api/stories/${id}/publish`)
}

/**
 * The bytes behind the Image a Reading has on screen, fetched as its Reader
 * fetches them: from the address the edition gave the frame, with nothing but
 * the Reader's own context behind the request.
 */
async function onScreen(reading: Page, storyId: string) {
  const image = reading.locator('figure.frame img')
  await expect(image).toBeVisible()
  const src = (await image.getAttribute('src'))!
  expect(src).toMatch(DIGEST_ADDRESS(storyId))

  return (await reading.request.get(src)).body()
}

test('publishing hands back when its edition was taken, and publishing again leaves the first publication\'s date alone', async ({ request }) => {
  const story = await writeStory(request)

  const first = await publish(request, story.id)
  expect(first.status()).toBe(200)
  const taken = await first.json()
  expect(taken).toEqual({
    id: story.id,
    publishedAt: expect.any(String),
    editionAt: expect.any(String),
  })

  // The Catalogue keeps its order by the first Publish, so publishing the
  // changes takes a new edition and leaves that date where it was.
  const again = await (await publish(request, story.id)).json()
  expect(again.publishedAt).toBe(taken.publishedAt)
  expect(Date.parse(again.editionAt)).toBeGreaterThanOrEqual(Date.parse(taken.editionAt))

  expect((await onTheBench(request, story.id)).editionAt).toBe(again.editionAt)
})

test('a Reader reads the edition, not what was written after it', async ({ request, playwright, baseURL }) => {
  const story = await writeStory(request)
  const shot = (await onTheBench(request, story.id)).scenes[0]!.shots[0]!
  await publish(request, story.id)

  const reader = await stranger(playwright, baseURL)
  const words = async () => (await atItsLink(reader, story.id)).scenes[0]!.shots[0]!.text
  expect(await words()).toBe('A door opens.')

  expect((await request.patch(`/api/shots/${shot.id}`, { data: { text: 'A door slams.' } })).ok())
    .toBe(true)
  expect((await onTheBench(request, story.id)).scenes[0]!.shots[0]!.text).toBe('A door slams.')
  expect(await words()).toBe('A door opens.')

  await publish(request, story.id)
  expect(await words()).toBe('A door slams.')

  await reader.dispose()
})

test('an edition\'s Image is served from the edition, and survives the Shot', async ({ request, playwright, baseURL }) => {
  const { story, shot } = await writeIllustrated(request)
  await publish(request, story.id)

  const reader = await stranger(playwright, baseURL)
  const image = (await atItsLink(reader, story.id)).scenes[0]!.shots[0]!.image!
  expect(image).toMatch(DIGEST_ADDRESS(story.id))

  const served = await reader.get(image)
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toBe('image/png')
  expect(served.headers()['x-content-type-options']).toBe('nosniff')
  expect(served.headers()['cache-control']).toBe('no-store')
  expect(Buffer.compare(await served.body(), ONE_PIXEL)).toBe(0)

  // Deleted on the bench, the Shot is still in the edition, and so are its bytes.
  expect((await request.delete(`/api/shots/${shot.id}`)).ok()).toBe(true)
  expect((await reader.get(image)).status()).toBe(200)
  expect((await atItsLink(reader, story.id)).scenes[0]!.shots.map(candidate => candidate.id)).toContain(shot.id)

  await reader.dispose()
})

test('a Story published before editions is given one on its first read', async ({ request, playwright, baseURL }) => {
  const { story } = await writeIllustrated(request)
  // Published past the API, which is the row every Story published before this
  // shipped is: a date, and no edition.
  await seedPublication(story)
  expect((await onTheBench(request, story.id)).editionAt).toBeNull()

  const reader = await stranger(playwright, baseURL)
  const image = (await atItsLink(reader, story.id)).scenes[0]!.shots[0]!.image!
  expect(image).toMatch(DIGEST_ADDRESS(story.id))
  expect((await reader.get(image)).status()).toBe(200)

  expect((await onTheBench(request, story.id)).editionAt).not.toBeNull()

  await reader.dispose()
})

test('unpublishing takes the edition away', async ({ request, playwright, baseURL }) => {
  const { story } = await writeIllustrated(request)
  await publish(request, story.id)

  const reader = await stranger(playwright, baseURL)
  const image = (await atItsLink(reader, story.id)).scenes[0]!.shots[0]!.image!
  expect((await reader.get(image)).status()).toBe(200)

  expect((await request.delete(`/api/stories/${story.id}/publish`)).ok()).toBe(true)
  expect((await onTheBench(request, story.id)).editionAt).toBeNull()
  expect((await reader.get(image)).status()).toBe(404)

  // Published again, the Story is given a new edition, whose bytes are held again.
  await publish(request, story.id)
  const again = (await atItsLink(reader, story.id)).scenes[0]!.shots[0]!.image!
  expect(again).toMatch(DIGEST_ADDRESS(story.id))
  expect((await reader.get(again)).status()).toBe(200)

  await reader.dispose()
})

test('a copy carries no edition', async ({ request }) => {
  const story = await writeStory(request)
  await publish(request, story.id)

  const copied = await request.post(`/api/stories/${story.id}/copy`, {
    data: { title: 'A Story, again', language: 'en' },
  })
  expect(copied.status()).toBe(201)
  const copy = await onTheBench(request, (await copied.json()).id)
  expect(copy.publishedAt).toBeNull()
  expect(copy.editionAt).toBeNull()
})

test('the media door tells nothing apart from absent', async ({ request, playwright, baseURL }) => {
  const { story } = await writeIllustrated(request)
  const { story: other } = await writeIllustrated(request, ANOTHER_IMAGE)
  await publish(request, story.id)
  await publish(request, other.id)

  const reader = await stranger(playwright, baseURL)
  const own = (await atItsLink(reader, story.id)).scenes[0]!.shots[0]!.image!
  const theirs = (await atItsLink(reader, other.id)).scenes[0]!.shots[0]!.image!
  // Held, under the Story that holds it: the not-founds below are not every
  // address being one.
  expect(own).toMatch(DIGEST_ADDRESS(story.id))
  expect((await reader.get(own)).status()).toBe(200)
  expect((await reader.get(theirs)).status()).toBe(200)

  const door = `/api/read/${story.id}/media`
  for (const asked of [
    `${door}/${'0'.repeat(64)}`,
    `${door}/not-a-digest`,
    `${door}/${theirs.split('/').at(-1)}`,
  ]) {
    expect((await reader.get(asked)).status(), asked).toBe(404)
  }

  await reader.dispose()
})

test('the bench says when Readers\' edition was taken and publishes the changes', async ({ page, request }) => {
  const story = await writeStory(request)
  await publish(request, story.id)

  await page.goto(`/stories/${story.id}`)
  await live(page)
  await expect(page.getByText('Readers read this Story as you published it on')).toBeVisible()

  await page.getByRole('button', { name: 'Publish the Changes' }).click()
  await expect(toast(page)).toHaveText('Your changes are published: Readers read them from now on.')

  // The bar of Commands offers the same act.
  await page.getByRole('button', { name: 'Commands' }).click()
  await expect(page.locator('dialog.commands li button', { hasText: 'Publish the Changes' })).toBeVisible()
})

test('a Reader goes on reading the Story as it was published while its Author edits it, and reads the changes once they are published', async ({ page, request, browser, baseURL }) => {
  // Two Scenes joined by an Exit, the first Shot with an Image, published from
  // the bench as an Author publishes.
  const { story, shot } = await writeIllustrated(request)
  const [street, bar] = (await onTheBench(request, story.id)).scenes
  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: `${baseURL}/read/${story.id}` })).toBeVisible()

  // Read by somebody with no account, in a browser of their own.
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const reading = await context.newPage()
  await reading.goto(`/read/${story.id}`)
  await begin(reading)
  await expect(reading.getByText('A door opens.')).toBeVisible()
  expect(Buffer.compare(await onScreen(reading, story.id), ONE_PIXEL)).toBe(0)

  // The Author goes on writing: other words and another Image on that Shot, a
  // third Scene with an Exit to it from the second, and the Shot after it gone.
  expect((await request.patch(`/api/shots/${shot.id}`, { data: { text: 'A door slams.' } })).ok())
    .toBe(true)
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: ANOTHER_IMAGE })).ok()).toBe(true)
  const platform = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The platform' },
  })).json()
  const train = await (await request.post(`/api/scenes/${platform.id}/shots`)).json()
  await request.patch(`/api/shots/${train.id}`, { data: { text: 'The last train, late.' } })
  const exit = await (await request.post(`/api/scenes/${bar!.id}/exits`, {
    data: { toSceneId: platform.id },
  })).json()
  await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Catch the last train' } })
  expect((await request.delete(`/api/shots/${street!.shots[1]!.id}`)).ok()).toBe(true)

  // The Reader comes back to the Story as it was published: the old words, the
  // old bytes, the deleted Shot in its place, and the second Scene still where
  // the Reading ends. Started over at the end, so the next visit is the start.
  await reading.reload()
  await begin(reading)
  await expect(reading.getByText('A door opens.')).toBeVisible()
  expect(Buffer.compare(await onScreen(reading, story.id), ONE_PIXEL)).toBe(0)
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByText('She steps out.')).toBeVisible()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByRole('status').filter({ hasText: 'The Reading ends here.' })).toHaveCount(1)
  await expect(reading.getByRole('button', { name: 'Catch the last train' })).toHaveCount(0)
  await reading.getByRole('button', { name: 'Read Again from the Start' }).click()

  // The bench reads the Story as it is written.
  await page.reload()
  await live(page)
  const preview = await readTheStory(page)
  await expect(preview.getByText('A door slams.')).toBeVisible()

  // Published from the bench, the changes are what the Reader reads: the new
  // words and bytes, the deleted Shot gone from before the Exit, and the third
  // Scene through the new one.
  await page.getByRole('button', { name: 'Publish the Changes' }).click()
  await expect(toast(page)).toHaveText('Your changes are published: Readers read them from now on.')
  await reading.reload()
  await begin(reading)
  await expect(reading.getByText('A door slams.')).toBeVisible()
  expect(Buffer.compare(await onScreen(reading, story.id), ANOTHER_IMAGE)).toBe(0)
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Catch the last train' }).click()
  await expect(reading.getByText('The last train, late.')).toBeVisible()

  await context.close()
})

test('an edition holds each set of bytes once, under its own Story, until no edition names it', async ({ request, playwright, baseURL }) => {
  const { story, shot } = await writeIllustrated(request)
  const { story: other } = await writeIllustrated(request, ANOTHER_IMAGE)
  const [street, bar] = (await onTheBench(request, story.id)).scenes
  const second = street!.shots[1]!
  // A Sound is held the way an Image is.
  expect((await request.put(`/api/scenes/${bar!.id}/sound`, { data: A_SOUND })).ok()).toBe(true)
  await publish(request, story.id)
  await publish(request, other.id)

  const reader = await stranger(playwright, baseURL)
  const images = async () => (await atItsLink(reader, story.id)).scenes[0]!.shots.map(read => read.image)
  const read = await atItsLink(reader, story.id)
  const own = read.scenes[0]!.shots[0]!.image!
  expect(own).toMatch(DIGEST_ADDRESS(story.id))
  expect((await reader.get(own)).status()).toBe(200)

  const sound = read.scenes[1]!.sound!
  expect(sound).toMatch(DIGEST_ADDRESS(story.id))
  const heard = await reader.get(sound)
  expect(heard.status()).toBe(200)
  expect(heard.headers()['content-type']).toMatch(/^audio\//)
  expect(Buffer.compare(await heard.body(), A_SOUND)).toBe(0)

  // Another published Story's door does not serve these bytes under its own id.
  expect((await reader.get(`/api/read/${other.id}/media/${own.split('/').at(-1)}`)).status())
    .toBe(404)

  // The same bytes on a second Shot are one address, held once.
  await request.put(`/api/shots/${second.id}/image`, { data: ONE_PIXEL })
  await publish(request, story.id)
  expect(await images()).toEqual([own, own])
  expect((await reader.get(own)).status()).toBe(200)

  // Replaced on the first Shot, the bytes are still the second's, and still held.
  await request.put(`/api/shots/${shot.id}/image`, { data: ANOTHER_IMAGE })
  await publish(request, story.id)
  const [replaced, kept] = await images()
  expect(kept).toBe(own)
  expect((await reader.get(own)).status()).toBe(200)
  expect(replaced).toMatch(DIGEST_ADDRESS(story.id))
  expect(Buffer.compare(await (await reader.get(replaced!)).body(), ANOTHER_IMAGE)).toBe(0)

  // Replaced on both, nothing names them, and the Publish lets them go.
  await request.put(`/api/shots/${second.id}/image`, { data: ANOTHER_IMAGE })
  await publish(request, story.id)
  expect((await reader.get(own)).status()).toBe(404)

  // Unpublished, every address of the last edition is a not-found.
  const last = (await atItsLink(reader, story.id)).scenes
    .flatMap(scene => [scene.sound, ...scene.shots.flatMap(read => [read.image, read.sound])])
    .filter(address => address !== null)
  expect(new Set(last).size).toBe(2)
  for (const address of last) expect((await reader.get(address)).status(), address).toBe(200)
  expect((await request.delete(`/api/stories/${story.id}/publish`)).ok()).toBe(true)
  for (const address of last) expect((await reader.get(address)).status(), address).toBe(404)

  await reader.dispose()
})
