import { and, eq, isNotNull } from 'drizzle-orm'
import { comments, stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * An Author answers another's Story. It is said of the Story whole — the body
 * carries text and nothing else, and there is nowhere to name a Scene or a Shot
 * — see `docs/adr/0027-a-comment-is-said-of-the-whole-story.md`.
 *
 * Only a published Story can be commented on: an unpublished one is its Author's
 * alone, so it answers with the not-found its Reading would.
 *
 * A Name comes first, as it does for listing, because a Comment carries its
 * Author's Name wherever it appears and nothing appears under a Name nobody
 * wrote. The refusal says where a Name is written rather than asking for one
 * here: the form lives on the list of an Author's own Stories and nowhere else
 * — see `docs/adr/0025-a-name-is-asked-for-in-the-listing.md`.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')
  const author = await requireAuthor(event)
  const text = await readCommentText(event)

  if (!await nameOf(author.id)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.nameBeforeCommenting') })
  }

  const [story] = await useDb()
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  const [written] = await useDb()
    .insert(comments)
    .values({ storyId: id, authorId: author.id, text })
    .returning({ id: comments.id, text: comments.text, createdAt: comments.createdAt })

  return written
})
