import { and, eq, isNotNull } from 'drizzle-orm'
import { listStories, lists, stories } from '../../../../db/schema'
import { useDb } from '../../../../db'

/**
 * Puts a Story in a List — which, where the List is Favourites, is the whole of
 * favouriting it: there is no second mechanism and no other endpoint. See
 * `docs/adr/0028-favourites-is-a-list-without-a-title.md`.
 *
 * Doing it twice changes nothing, which is why it is a `PUT`: the pair is the
 * key of the row, so the second insert conflicts with the first and does
 * nothing. The answer is the same either way, so a page that sent the same click
 * twice cannot tell — and has nothing to tell.
 *
 * A List that is not this Author's is absent, like everything else they never
 * wrote. So is a Story nobody has published: a List holds Stories found in the
 * Catalogue, and an unpublished one is its own Author's alone — answering
 * anything else would say whether an id somebody guessed exists.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'List')
  const storyId = readId(event, 'Story', 'storyId')

  const [list] = await useDb()
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, id), eq(lists.authorId, author.id)))

  if (!list) throw notFound(event, 'List')

  const [story] = await useDb()
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  await useDb().insert(listStories).values({ listId: id, storyId }).onConflictDoNothing()

  return { listId: id, storyId }
})
