import { randomBytes } from 'node:crypto'
import { expect } from '@playwright/test'
import {
  A_SOUND, ONE_PIXEL, fillTheInstance, objectBehind, suiteMedia, test, writeScene, writeStory,
} from './author'
import type { APIRequestContext } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The ceiling of our own the instance keeps its bucket under, so storage never
 * leaves R2's free tier — see
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. The state these
 * tests stand in is the whole instance's, which is why they run one after the
 * other and after every other spec has finished: the `ceiling` project of
 * `playwright.config.ts`. Below the ceiling, every other spec that uploads is the
 * proof that uploads behave as before.
 */
test.describe.configure({ mode: 'serial' })

const FULL_EN = 'There is no room left here for a new Image or a new Sound.'
const FULL_FR = 'Il n’y a plus de place ici pour une nouvelle Image ou un nouveau Son.'

/** A real PNG no request has ever sent: the pixel, with bytes of its own behind it. */
function aNewImage() {
  return Buffer.concat([ONE_PIXEL, randomBytes(16)])
}

/** An MP3 no request has ever sent, for the reason the image above is one. */
function aNewSound() {
  return Buffer.concat([A_SOUND, randomBytes(16)])
}

async function openShots(request: APIRequestContext) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()

  return { story, scene: read.scenes[0]!, shots: read.scenes[0]!.shots }
}

let empty: () => Promise<void>

test.beforeAll(async () => {
  // The bytes the tests send as already held are held before the instance is
  // full, the way every spec before these left them.
  await suiteMedia().hold(ONE_PIXEL)
  await suiteMedia().hold(A_SOUND)
  empty = await fillTheInstance()
})

test.afterAll(async () => {
  await empty?.()
})

test('a full instance refuses a new Image, and says why in the Author’s Locale', async ({ request }) => {
  const { story, shots } = await openShots(request)
  const door = `/api/shots/${shots[0]!.id}/image`

  const refused = await request.put(door, { data: aNewImage() })
  expect(refused.status()).toBe(507)
  expect((await refused.json()).message).toContain(FULL_EN)

  const refusé = await request.put(door, { data: aNewImage(), headers: { 'accept-language': 'fr-FR' } })
  expect(refusé.status()).toBe(507)
  expect((await refusé.json()).message).toContain(FULL_FR)

  // Refused before anything was named: the Shot carries no Image to serve.
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  expect(read.scenes[0]!.shots[0]!.image).toBeNull()
  expect((await request.get(door, { maxRedirects: 0 })).status()).toBe(404)
})

test('a full instance still takes an Image whose bytes it already holds', async ({ request }) => {
  const { shots } = await openShots(request)
  const door = `/api/shots/${shots[0]!.id}/image`

  const taken = await request.put(door, { data: ONE_PIXEL })
  expect(taken.status()).toBe(200)

  const served = await request.get(door)
  expect(served.status()).toBe(200)
  expect(Buffer.from(await served.body()).equals(ONE_PIXEL)).toBe(true)
})

test('a full instance still saves a Shot’s words', async ({ request }) => {
  const { story, shots } = await openShots(request)

  const saved = await request.patch(`/api/shots/${shots[0]!.id}`, {
    data: { text: 'The lights go out.', description: '' },
  })
  expect(saved.status()).toBe(200)

  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  expect(read.scenes[0]!.shots[0]!.text).toBe('The lights go out.')
})

test('a full instance refuses a new Sound, on a Scene and on a Shot, and takes one it holds', async ({ request }) => {
  const { scene, shots } = await openShots(request)

  for (const door of [`/api/scenes/${scene.id}/sound`, `/api/shots/${shots[0]!.id}/sound`]) {
    const refused = await request.put(door, { data: aNewSound() })
    expect(refused.status()).toBe(507)
    expect((await refused.json()).message).toContain(FULL_EN)

    const refusé = await request.put(door, { data: aNewSound(), headers: { 'accept-language': 'fr' } })
    expect((await refusé.json()).message).toContain(FULL_FR)

    expect((await request.get(door, { maxRedirects: 0 })).status()).toBe(404)

    expect((await request.put(door, { data: A_SOUND })).status()).toBe(200)
    expect(await objectBehind(request, door)).toMatch(/\/[0-9a-f]{64}$/)
  }
})

test('the bench says why a new Image was not taken where it says every upload refusal', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The street')
  await page.getByLabel('Image of Shot 1 of The street', { exact: true })
    .setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: aNewImage() })

  await expect(page.getByRole('alert')).toContainText(`In “The street”: ${FULL_EN}`)
  await expect(page.getByAltText('The image of Shot 1 of The street')).toHaveCount(0)
})
