import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../db/schema'
import { useDb } from '../../db'

/** Puts a Scene's node where the Author dropped it in the Story graph. */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Scene')
  const { x, y } = await readNodePosition(event)

  const [scene] = await useDb()
    .update(scenes)
    .set({ x, y })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id, x: scenes.x, y: scenes.y })

  if (!scene) throw notFound('Scene')
  return scene
})
