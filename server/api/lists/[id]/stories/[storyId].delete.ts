import { and, eq, exists } from 'drizzle-orm'
import { listStories, lists } from '../../../../db/schema'
import { useDb } from '../../../../db'

/**
 * Takes a Story out of a List, Favourites included: unfavouriting is this
 * request and nothing else.
 *
 * Whose List it is lives inside the one delete rather than in a check before it,
 * so a List that is not this Author's and a Story that was never in it come back
 * as the same not-found — and the row cannot change hands between the two.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'List')
  const storyId = readId(event, 'Story', 'storyId')

  const [taken] = await useDb()
    .delete(listStories)
    .where(and(
      eq(listStories.listId, id),
      eq(listStories.storyId, storyId),
      exists(useDb()
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.id, id), eq(lists.authorId, author.id)))),
    ))
    .returning({ storyId: listStories.storyId })

  if (!taken) throw notFound(event, 'Story')

  return taken
})
