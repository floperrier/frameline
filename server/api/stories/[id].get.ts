import { and, eq } from 'drizzle-orm'
import { cuts, scenes, shots, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * The whole Story as the Author edits it: its Scenes, each a run of Shots in
 * order and a node of the graph, and the Cuts that join them.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({ id: stories.id, title: stories.title, openingSceneId: stories.openingSceneId })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!story) throw notFound('Story')

  // One pass over the join, so a Scene with no Shots still arrives (the Shot
  // columns come back null) and the Shots arrive in the order the Scene numbers.
  const rows = await useDb()
    .select({
      sceneId: scenes.id,
      name: scenes.name,
      x: scenes.x,
      y: scenes.y,
      shotId: shots.id,
      text: shots.text,
      position: shots.position,
    })
    .from(scenes)
    .leftJoin(shots, eq(shots.sceneId, scenes.id))
    .where(eq(scenes.storyId, id))
    // Grouped below by watching the Scene change, so Scenes written in the same
    // instant have to be broken apart by something: their ids do it.
    .orderBy(scenes.createdAt, scenes.id, shots.position)

  const scenesOfStory: Scene[] = []
  for (const row of rows) {
    let scene = scenesOfStory.at(-1)
    if (scene?.id !== row.sceneId) {
      scene = { id: row.sceneId, name: row.name, x: row.x, y: row.y, shots: [] }
      scenesOfStory.push(scene)
    }
    if (row.shotId !== null) {
      scene.shots.push({ id: row.shotId, text: row.text!, position: row.position! })
    }
  }

  // The Cuts of the Story come on their own: joined to the Scenes above they
  // would multiply every Shot by every Cut leaving its Scene.
  const cutsOfStory = await useDb()
    .select({
      id: cuts.id,
      fromSceneId: cuts.fromSceneId,
      toSceneId: cuts.toSceneId,
      text: cuts.text,
    })
    .from(cuts)
    .innerJoin(scenes, eq(cuts.fromSceneId, scenes.id))
    .where(eq(scenes.storyId, id))
    .orderBy(cuts.createdAt, cuts.id)

  return { ...story, scenes: scenesOfStory, cuts: cutsOfStory }
})
