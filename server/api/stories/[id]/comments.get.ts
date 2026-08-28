import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { authors, comments, stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * What has been said under one published Story, oldest first — the order a
 * conversation is read in, and the one ordering nobody can play: there is no
 * count and no score to sort by.
 *
 * Answered to anyone, with or without an account, because Comments sit under the
 * Story on the page a Reader opens with no account at all. Whether the Story is
 * published is part of the lookup, so an unpublished one answers with the same
 * not-found the Reading does rather than handing over what was said about a
 * Story nobody may read.
 *
 * Each Comment is signed: its Author's id and Name, so it leads to whoever wrote
 * it. The join is an inner one because a Name is what commenting asks for before
 * it writes — see `docs/adr/0027-a-comment-is-said-of-the-whole-story.md`. The
 * email is not selected.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({ id: stories.id, authorId: stories.authorId })
    .from(stories)
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  const said = await useDb()
    .select({
      id: comments.id,
      text: comments.text,
      createdAt: comments.createdAt,
      authorId: authors.id,
      authorName: authors.name,
    })
    .from(comments)
    .innerJoin(authors, eq(comments.authorId, authors.id))
    .where(eq(comments.storyId, id))
    .orderBy(asc(comments.createdAt))

  // Who may delete travels with what is on screen, so the page draws the gesture
  // from the answer rather than deciding for itself who the Story belongs to:
  // the Story's Author deletes anything written under their Story, and an Author
  // deletes their own. The server refuses on the same two grounds, so a page
  // that got this wrong could still not delete anything.
  return { storyAuthorId: story.authorId, comments: said }
})
