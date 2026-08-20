import { and, eq, inArray } from 'drizzle-orm'
import { shots } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Shot')
  const text = await readShotText(event)

  const [shot] = await useDb()
    .update(shots)
    .set({ text })
    .where(and(eq(shots.id, id), inArray(shots.sceneId, scenesOf(author.id))))
    .returning({ id: shots.id, text: shots.text, position: shots.position })

  if (!shot) throw notFound('Shot')
  return shot
})
