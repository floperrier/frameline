import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../../db/schema'
import { useDb } from '../../../db'

/** Takes the Shot's Sound away, and the Transcript that was of it. */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')

  const [shot] = await useDb()
    .update(shots)
    .set({ sound: null, transcript: '' })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id })

  if (!shot) throw notFound(event, 'Shot')

  return { id: shot.id }
})
