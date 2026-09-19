import { expect } from '@playwright/test'
import { test, writeStory } from './author'
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
