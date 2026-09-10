import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Renames a Scene, which is the one thing about a Scene written on its own: its
 * Shots, its Flags and its ways on each have an endpoint of theirs, and where it
 * is drawn is read off the Story rather than written anywhere.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const name = await readSceneName(event)

  const [scene] = await useDb()
    .update(scenes)
    .set({ name })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id, name: scenes.name })

  if (!scene) throw notFound(event, 'Scene')
  return scene
})
