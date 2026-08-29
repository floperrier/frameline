import { lists } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Writes a List under a title of the Author's own. Nothing else is asked for: a
 * List is a title and what an Author gathers into it, and Stories go in one at a
 * time from wherever they were found.
 *
 * A title is required, because an untitled List is Favourites — see
 * `readListTitle`.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const title = await readListTitle(event)

  const [written] = await useDb()
    .insert(lists)
    .values({ authorId: author.id, title })
    .returning({ id: lists.id, title: lists.title })

  return written
})
