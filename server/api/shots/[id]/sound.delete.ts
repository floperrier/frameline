import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Takes the Shot's Sound away, and the Transcript that was of it. Only the digest
 * goes: the object stays in the bucket for whatever else names it, and the daily
 * sweep lets it go once nothing does.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')

  const [shot] = await useDb()
    .update(shots)
    .set({ soundDigest: null, transcript: '' })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id })

  if (!shot) throw notFound(event, 'Shot')

  return { id: shot.id }
})
