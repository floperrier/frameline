import { and, eq, isNotNull } from 'drizzle-orm'
import { lists } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Deletes a List. What was gathered into it goes with it and the Stories
 * themselves are untouched: a List is one Author's arrangement of other people's
 * work, so taking the arrangement away takes nothing of the work.
 *
 * Favourites cannot be deleted. The statement reaches only a List with a title,
 * so the one List every account has is out of its reach rather than guarded by a
 * check the next handler could forget.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'List')

  const [deleted] = await useDb()
    .delete(lists)
    .where(and(eq(lists.id, id), eq(lists.authorId, author.id), isNotNull(lists.title)))
    .returning({ id: lists.id })

  if (deleted) return deleted

  throw await refuseUnchangedList(event, author.id, id, 'refusals.favouritesDelete')
})
