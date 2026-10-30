import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Deposits the Sound a Shot strikes with, replacing whatever it carried. The
 * bytes are held in the bucket under their digest and the Shot names that digest
 * — see `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md` — so the
 * same struck sound on every beat is one object; bytes held for a Shot that is
 * absent are named by nothing, and the daily sweep lets them go.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const soundDigest = await holdUpload(event, await readSound(event))

  const [shot] = await useDb()
    .update(shots)
    .set({ soundDigest })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id })

  if (!shot) throw notFound(event, 'Shot')

  return { id: shot.id, sound: shotSoundUrl(shot.id) }
})
