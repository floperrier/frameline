import { and, eq } from 'drizzle-orm'
import { scenes, shots, stories } from '../../db/schema'
import { useDb } from '../../db'

/** The whole Story as the Author edits it: its Scenes, each a run of Shots in order. */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!story) throw notFound('Story')

  // One pass over the join, so a Scene with no Shots still arrives (the Shot
  // columns come back null) and the Shots arrive in the order the Scene numbers.
  const rows = await useDb()
    .select({
      sceneId: scenes.id,
      name: scenes.name,
      shotId: shots.id,
      text: shots.text,
      position: shots.position,
    })
    .from(scenes)
    .leftJoin(shots, eq(shots.sceneId, scenes.id))
    .where(eq(scenes.storyId, id))
    .orderBy(scenes.createdAt, shots.position)

  const scenesOfStory: Scene[] = []
  for (const row of rows) {
    let scene = scenesOfStory.at(-1)
    if (scene?.id !== row.sceneId) {
      scene = { id: row.sceneId, name: row.name, shots: [] }
      scenesOfStory.push(scene)
    }
    if (row.shotId !== null) {
      scene.shots.push({ id: row.shotId, text: row.text!, position: row.position! })
    }
  }

  return { ...story, scenes: scenesOfStory }
})
