import { and, eq, isNotNull } from 'drizzle-orm'
import { lists } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Renames a List. Whose it is and whether it has a title to rename are both
 * inside the one statement: Favourites has none, so the update reaches nothing —
 * and the sentence saying so is written afterwards, from a row read rather than
 * from a check made before the write.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'List')
  const title = await readListTitle(event)

  const [renamed] = await useDb()
    .update(lists)
    .set({ title })
    .where(and(eq(lists.id, id), eq(lists.authorId, author.id), isNotNull(lists.title)))
    .returning({ id: lists.id, title: lists.title })

  if (renamed) return renamed

  throw await refuseUnchangedList(event, author.id, id, 'refusals.favouritesTitle')
})
