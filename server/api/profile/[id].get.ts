import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { authors, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * A Profile: an Author's Name, their avatar, and the Stories they have Listed,
 * most recently published first. Answered to anyone, with or without an account,
 * because it is where a Name in the Catalogue leads and the Catalogue is read by
 * whoever turns up.
 *
 * The Stories are the Listed ones and no others: an Author's unpublished and
 * unlisted work is theirs alone, and this page is the Catalogue seen by Author
 * rather than by date. Nothing they have said about anybody else's Story is
 * gathered here — see the glossary's Profile.
 *
 * The email is not selected. It is what an Author is keyed on and appears
 * nowhere, so the query that could leak it does not ask for it.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Author')

  const [author] = await useDb()
    .select({ id: authors.id, name: authors.name, avatar: authors.avatar })
    .from(authors)
    .where(eq(authors.id, id))

  if (!author) throw notFound(event, 'Author')

  const listed = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      synopsis: stories.synopsis,
      publishedAt: stories.publishedAt,
    })
    .from(stories)
    .where(and(
      eq(stories.authorId, id),
      eq(stories.listed, true),
      isNotNull(stories.publishedAt),
    ))
    .orderBy(desc(stories.publishedAt))

  return { ...author, stories: listed }
})
