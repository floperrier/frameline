import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Takes the Scene's Sound away: the bytes, the Scene it was named after, and the
 * Transcript, which was of that Sound and of nothing else. Whether it loops goes
 * back to what a deposited Sound answers, so the next one starts where every
 * first one does.
 *
 * A DELETE beside the PUT, which is the pair this repository already writes for an
 * act and its undoing — `publish.post.ts` and `publish.delete.ts`.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')

  const [scene] = await useDb()
    .update(scenes)
    .set({ sound: null, soundOfSceneId: null, transcript: '', soundLoops: true })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id })

  if (!scene) throw notFound(event, 'Scene')

  return { id: scene.id }
})
