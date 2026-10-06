import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../../db/schema'
import { useDb } from '../../../db'

/** Deposits the Sound a Shot strikes with, replacing whatever it carried. */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const sound = await readSound(event)

  const [shot] = await useDb()
    .update(shots)
    .set({ sound })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id })

  if (!shot) throw notFound(event, 'Shot')

  return { id: shot.id, sound: shotSoundUrl(shot.id) }
})
