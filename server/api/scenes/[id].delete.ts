import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../db/schema'
import { useDb } from '../../db'

/** Deletes a Scene. Its Shots go with it: they cascade from the Scene in Postgres. */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')

  const [scene] = await useDb()
    .delete(scenes)
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id })

  if (!scene) throw notFound(event, 'Scene')
  return scene
})
