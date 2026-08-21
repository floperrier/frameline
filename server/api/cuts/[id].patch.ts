import { and, eq, inArray } from 'drizzle-orm'
import { cuts } from '../../db/schema'
import { useDb } from '../../db'

/** Writes what the Reader will be offered at the end of the Scene the Cut leaves. */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Cut')
  const text = await readCutText(event)

  const [cut] = await useDb()
    .update(cuts)
    .set({ text })
    .where(and(eq(cuts.id, id), inArray(cuts.id, cutsOf(author.id))))
    .returning({
      id: cuts.id,
      fromSceneId: cuts.fromSceneId,
      toSceneId: cuts.toSceneId,
      text: cuts.text,
    })

  if (!cut) throw notFound('Cut')
  return cut
})
