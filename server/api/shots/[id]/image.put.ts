import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Attaches an image to a Shot, replacing whatever it carried. The bytes are held
 * in the bucket under their digest and the Shot names that digest — see
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. Scoped by the
 * Author's own Scenes like every other write, so a Shot of someone else's Story
 * is not refused so much as absent; bytes held for a Shot that is absent are
 * named by nothing, and the daily sweep lets them go.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const imageDigest = await useMedia().hold(await readShotImage(event))

  const [shot] = await useDb()
    .update(shots)
    .set({ imageDigest })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id })

  if (!shot) throw notFound(event, 'Shot')

  return { id: shot.id, image: shotImageUrl(shot.id) }
})
