import { and, eq, isNotNull } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Lists a Story: from here on it appears in the Catalogue, where anyone browsing
 * finds it. A second act after publishing rather than part of it — see
 * `docs/adr/0023-being-published-and-being-found-are-two-acts.md` — so an Author
 * goes on publishing to three friends without going on show to everybody.
 *
 * Only a published Story can be listed: an entry in the Catalogue leading to a
 * link that answers with a not-found is worse than no entry. Being published is
 * part of the statement that lists, scoped by Author beside it, so the check and
 * the write cannot fall apart between them.
 *
 * A Name comes first, because every entry in the Catalogue is signed and this is
 * the one moment an Author has a reason to write one — publishing never asks. It
 * is a refusal the Author can act on rather than a silent entry with no name on
 * it, and the bench answers it by asking for the Name in the listing itself —
 * see `docs/adr/0025-a-name-is-asked-for-in-the-listing.md`.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')
  const author = await requireAuthor(event)

  if (!await nameOf(author.id)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.nameBeforeListing') })
  }

  const [listed] = await useDb()
    .update(stories)
    .set({ listed: true })
    .where(and(
      eq(stories.id, id),
      eq(stories.authorId, author.id),
      isNotNull(stories.publishedAt),
    ))
    .returning({ id: stories.id, listed: stories.listed })

  if (listed) return listed

  // Nothing was listed, so the Story is either not this Author's — absent, like
  // everywhere else — or it is theirs and unpublished, which is a refusal they
  // can act on and so is worth saying out loud.
  const [own] = await useDb()
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!own) throw notFound(event, 'Story')

  throw createError({ statusCode: 400, message: saying(event)('refusals.listPublished') })
})
