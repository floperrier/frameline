import { and, eq, exists, or } from 'drizzle-orm'
import { comments, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Takes a Comment away. Two people may, and only two: the Author who wrote it,
 * and the Author of the Story it was written under — who answers for what stands
 * on their own page. Anybody else meets the not-found everything they never
 * wrote meets.
 *
 * Both grounds are inside the one statement rather than checked before it, so
 * the Comment cannot change hands between the check and the delete, and so that
 * a Comment nobody may delete and a Comment that was never there come back
 * indistinguishable.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Comment')

  const [deleted] = await useDb()
    .delete(comments)
    .where(and(
      eq(comments.id, id),
      or(
        eq(comments.authorId, author.id),
        exists(useDb()
          .select({ id: stories.id })
          .from(stories)
          .where(and(eq(stories.id, comments.storyId), eq(stories.authorId, author.id)))),
      ),
    ))
    .returning({ id: comments.id })

  if (!deleted) throw notFound(event, 'Comment')
  return deleted
})
