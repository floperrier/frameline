import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { seedScene, seedStory, test, writeStory } from './author'
import { SOUND_MAX_BYTES } from '../../shared/utils/sound'
import type { APIRequestContext } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/** The first Scene of a Story written the way an Author writes one, and its Shots. */
async function openScene(request: APIRequestContext) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()

  return { story, scene: read.scenes[0]!, shots: read.scenes[0]!.shots }
}

/** Reads the Story back, to see what a request left behind. */
export async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

test('a Story arrives carrying no Sound anywhere, and says so of every row', async ({ request }) => {
  const { scene, shots } = await openScene(request)

  expect(scene.sound).toBeNull()
  expect(scene.soundOfSceneId).toBeNull()
  expect(scene.transcript).toBe('')
  expect(scene.soundLoops).toBe(true)
  expect(shots[0]!.sound).toBeNull()
  expect(shots[0]!.transcript).toBe('')
})

/**
 * A real MP3, a few frames of silence, for the specs that deposit one. A file
 * rather than a shape: the server reads the kind out of the first bytes, and the
 * browser has to be able to decode what it is handed.
 */
export const A_SOUND = readFileSync(new URL('silence.mp3', import.meta.url))

/** An MPEG-4 head with nothing behind it: enough to be taken, never to be played. */
const AN_M4A = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(16),
])

test('an Author deposits a Sound on a Scene, and it is served where the Scene says', async ({ request }) => {
  const { story, scene } = await openScene(request)

  const deposited = await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })
  expect(deposited.status()).toBe(200)
  expect(await deposited.json()).toMatchObject({ sound: `/api/scenes/${scene.id}/sound` })

  const after = await reread(request, story.id)
  expect(after.scenes[0]!.sound).toBe(`/api/scenes/${scene.id}/sound`)

  const served = await request.get(`/api/scenes/${scene.id}/sound`)
  expect(served.status()).toBe(200)
  // Served under the type its own first bytes say it is, and never sniffed past it.
  expect(served.headers()['content-type']).toBe('audio/mpeg')
  expect(served.headers()['x-content-type-options']).toBe('nosniff')
  expect(served.headers()['cache-control']).toContain('no-store')
  expect(Buffer.compare(await served.body(), A_SOUND)).toBe(0)
})

test('an Author deposits a Sound on a Shot, and takes it off again', async ({ request }) => {
  const { story, shots } = await openScene(request)

  await request.put(`/api/shots/${shots[0]!.id}/sound`, { data: AN_M4A })
  expect((await reread(request, story.id)).scenes[0]!.shots[0]!.sound)
    .toBe(`/api/shots/${shots[0]!.id}/sound`)
  expect((await request.get(`/api/shots/${shots[0]!.id}/sound`)).headers()['content-type'])
    .toBe('audio/mp4')

  const removed = await request.delete(`/api/shots/${shots[0]!.id}/sound`)
  expect(removed.status()).toBe(200)

  const after = await reread(request, story.id)
  expect(after.scenes[0]!.shots[0]!.sound).toBeNull()
  // Whatever cannot be reached reads as absent, which is what a Shot with no
  // Sound and a Shot nobody ever wrote have in common.
  expect((await request.get(`/api/shots/${shots[0]!.id}/sound`)).status()).toBe(404)
})

test('a deposit of the wrong kind, too heavy, or absent is refused by its reason', async ({ request }) => {
  const { scene } = await openScene(request)

  const opus = await request.put(`/api/scenes/${scene.id}/sound`, {
    data: Buffer.concat([Buffer.from('OggS'), Buffer.alloc(24)]),
  })
  expect(opus.status()).toBe(400)
  expect((await opus.json()).message).toContain('A Sound is an AAC or an MP3 file')

  const tooHeavy = await request.put(`/api/scenes/${scene.id}/sound`, {
    data: Buffer.concat([A_SOUND, Buffer.alloc(SOUND_MAX_BYTES)]),
  })
  expect(tooHeavy.status()).toBe(400)
  expect((await tooHeavy.json()).message).toContain('cannot weigh more than 2 MB')

  const nothing = await request.put(`/api/scenes/${scene.id}/sound`)
  expect(nothing.status()).toBe(400)
  expect((await nothing.json()).message).toContain('A Sound is a file to upload.')
})

test('a Sound of somebody else’s Story is not refused so much as absent', async ({ request, otherAuthor }) => {
  const theirs = await seedStory(otherAuthor, 'Theirs')
  const scene = await seedScene(theirs, 'The street')

  expect((await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })).status()).toBe(404)
  expect((await request.get(`/api/scenes/${scene.id}/sound`)).status()).toBe(404)
})
