import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Attaches an image to a Shot, replacing whatever it carried. Scoped by the
 * Author's own Scenes like every other write, so a Shot of someone else's Story
 * is not refused so much as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const image = await readShotImage(event)

  const [shot] = await useDb()
    .update(shots)
    .set({ image })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id })

  if (!shot) throw notFound(event, 'Shot')

  return { id: shot.id, image: shotImageUrl(shot.id) }
})
