import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { authors, stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Catalogue: every Listed Story, most recently published first, answered to
 * anyone with or without an account. The one place a Story is found rather than
 * sent — see
 * `docs/adr/0023-being-published-and-being-found-are-two-acts.md`.
 *
 * Being published is asked for beside being Listed, though unpublishing unlists
 * in the same statement and the two cannot drift apart: an entry here leads
 * straight to `/read/<id>`, so a row that got out of step would be an entry
 * pointing at a not-found rather than a row nobody notices.
 *
 * Nothing is counted, rated or ordered by anything an Author can influence. The
 * date a Story was published is the whole of the ranking, and it is the one
 * ranking nobody can play.
 *
 * Each entry is signed: the Author's id and Name, so the entry leads to the work
 * one way and to whoever wrote it the other. The join is an inner one because a
 * Name is what listing asks for before it lists — an entry with nobody's name on
 * it is the one thing the Catalogue is not. The email is not selected.
 *
 * Each entry carries the address of the Image it is presented by — the Cover, or
 * the Opening Scene's first — resolved here so the shelf draws pictures without a
 * request apiece to find out whether there is one.
 */
export default defineEventHandler(async () => {
  const rows = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      synopsis: stories.synopsis,
      publishedAt: stories.publishedAt,
      authorId: authors.id,
      authorName: authors.name,
      cover: coverShotOf,
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.id))
    .where(and(eq(stories.listed, true), isNotNull(stories.publishedAt)))
    .orderBy(desc(stories.publishedAt))

  return rows.map(row => ({ ...row, cover: coverUrl(row.cover) }))
})
