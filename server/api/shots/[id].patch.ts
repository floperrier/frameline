import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Writes what an Author says about one Shot: its text, and the Description of the
 * still it carries. Both come through one door because both are one Shot's row,
 * and the Description is only ever written from beside the still it describes.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Shot')
  const text = await readShotText(event)
  const description = await readShotDescription(event)

  const [shot] = await useDb()
    .update(shots)
    .set({ text, description })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({
      id: shots.id,
      text: shots.text,
      position: shots.position,
      description: shots.description,
    })

  if (!shot) throw notFound(event, 'Shot')
  return shot
})
