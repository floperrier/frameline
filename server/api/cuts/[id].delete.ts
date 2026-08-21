import { and, eq, inArray } from 'drizzle-orm'
import { cuts } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Cut')

  const [cut] = await useDb()
    .delete(cuts)
    .where(and(eq(cuts.id, id), inArray(cuts.id, cutsOf(author.id))))
    .returning({ id: cuts.id })

  if (!cut) throw notFound('Cut')
  return cut
})
