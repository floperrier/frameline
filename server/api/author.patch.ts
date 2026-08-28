import { eq } from 'drizzle-orm'
import { authors } from '../db/schema'
import { useDb } from '../db'

/**
 * An Author writes their own Name. The one thing an Author changes about
 * themselves, and the only account surface there is: a settings page would be a
 * room built for one field — see
 * `docs/adr/0025-a-name-is-asked-for-in-the-listing.md`.
 *
 * The session carries the Name so that every page showing it is showing what the
 * Author last wrote, so it is resealed here rather than left to go stale until
 * the next sign in.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const name = await readAuthorName(event)

  const [named] = await useDb()
    .update(authors)
    .set({ name })
    .where(eq(authors.id, author.id))
    .returning({ id: authors.id, name: authors.name })

  if (!named) throw notFound(event, 'Author')

  await setUserSession(event, { user: { ...author, name: named.name } })

  return named
})
