import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { authors, listStories, lists, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * An Author's own Lists and what is in them, Favourites first. Answered to the
 * Author who wrote them and to nobody else: the query is scoped by `author_id`,
 * there is no route that takes a List's id and hands it over, and no Profile
 * draws one — a List is private, which is the whole of what a List is until
 * public Lists exist.
 *
 * Favourites is asked for before the read rather than looked for in it, so an
 * account that has never gathered anything still meets the List every account
 * has — see `favouritesOf`.
 *
 * One request rather than one per List: the control on the Catalogue is drawn
 * once per entry and every one of them wants the same answer, so the whole of an
 * Author's shelves comes back at once and the page asks nothing more.
 *
 * ponytail: every List with every Story in it, in one join. A hundred Lists of a
 * hundred Stories would be ten thousand rows to draw two shelves with — page it
 * the day an Author has that many, which is not the day a product has three
 * Authors.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  await favouritesOf(author.id)

  const rows = await useDb()
    .select({
      id: lists.id,
      title: lists.title,
      storyId: stories.id,
      storyTitle: stories.title,
      language: stories.language,
      publishedAt: stories.publishedAt,
      authorId: authors.id,
      authorName: authors.name,
    })
    .from(lists)
    .leftJoin(listStories, eq(listStories.listId, lists.id))
    // A Story anybody can still read, and no other. An entry in a List leads to
    // the public link, so a Story unpublished since it was gathered is left out
    // rather than handed over as an entry pointing at a not-found. The row stays
    // where it is: published again, the Story is back on the shelf the Author put
    // it on.
    .leftJoin(stories, and(eq(stories.id, listStories.storyId), isNotNull(stories.publishedAt)))
    .leftJoin(authors, eq(authors.id, stories.authorId))
    .where(eq(lists.authorId, author.id))
    .orderBy(asc(lists.createdAt), desc(listStories.addedAt))

  return gatherLists(rows.map(row => ({
    id: row.id,
    title: row.title,
    story: row.storyId
      ? {
          id: row.storyId,
          title: row.storyTitle!,
          language: row.language!,
          publishedAt: row.publishedAt,
          authorId: row.authorId!,
          authorName: row.authorName,
        }
      : null,
  })))
})
