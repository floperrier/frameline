import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Puts a Scene where the Author dropped it in the Story graph, and renames it
 * where they have corrected the name. The name travels beside the placement
 * rather than through an endpoint of its own, because both are the node: a
 * request carrying no name moves a Scene and leaves what it is called alone.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const name = await readSceneRename(event)
  const { x, y } = await readScenePlacement(event)

  const [scene] = await useDb()
    .update(scenes)
    .set({ x, y, ...(name !== undefined && { name }) })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id, name: scenes.name, x: scenes.x, y: scenes.y })

  if (!scene) throw notFound(event, 'Scene')
  return scene
})
