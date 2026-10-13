import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import type { AnyColumn, SQL } from 'drizzle-orm'
import { authors, stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Catalogue: the Listed Stories a Reader asked for, the latest to enter it
 * first, answered to anyone with or without an account. The one place a Story
 * is found rather than sent — see
 * `docs/adr/0023-being-published-and-being-found-are-two-acts.md`.
 *
 * What is asked for comes from the query string and nowhere else, read by
 * `catalogueState`, which never refuses: an unknown value is its default, so a
 * link sent long ago still opens on a Catalogue. Nothing in the answer depends
 * on who asks, so the same URL is the same Catalogue for everybody.
 *
 * Being published is asked for beside being Listed, though unpublishing unlists
 * in the same statement and the two cannot drift apart: an entry here leads
 * straight to `/read/<id>`, so a row that got out of step would be an entry
 * pointing at a not-found rather than a row nobody notices.
 *
 * Nothing is counted, rated or ordered by anything an Author can influence. The
 * day a Story first entered the Catalogue is the whole of the ranking, and it is
 * the one ranking nobody can play: neither republishing nor listing again moves
 * it — see `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`. The
 * Story's id breaks a tie, so the order is the same on every request.
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
export default defineEventHandler(async (event) => {
  const state = catalogueState(getQuery(event))

  const where: SQL[] = [eq(stories.listed, true), isNotNull(stories.publishedAt)]
  if (state.q) where.push(searched(state.q))

  const rows = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      synopsis: stories.synopsis,
      readingTime: stories.readingTime,
      publishedAt: stories.publishedAt,
      listedAt: stories.firstListedAt,
      authorId: authors.id,
      authorName: authors.name,
      coverShotId: coverShotOf,
      cropX: coverShot.cropX,
      cropY: coverShot.cropY,
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.id))
    .leftJoin(coverShot, sql`${coverShot.id} = ${coverShotOf}`)
    .where(and(...where))
    .orderBy(sql`${stories.firstListedAt} desc nulls last`, asc(stories.id))

  return rows.map(({ coverShotId, cropX, cropY, ...row }) => ({
    ...row,
    cover: coverFor({ coverShotId, cropX, cropY }),
  }))
})

/**
 * The Stories whose title, Synopsis or Author's Name holds the term anywhere,
 * whatever its case and its accents: *memoire* finds *Mémoire*. Both sides are
 * folded by `unaccent` — see `docs/research/2026-10-13-unaccent-on-neon.md` —
 * and named by its schema, so the search path has no say in which function runs.
 * No index: a scan over a few hundred Stories is quicker than keeping one.
 */
function searched(term: string) {
  const pattern = containing(term)
  const holds = (column: SQL | AnyColumn) =>
    sql`public.unaccent(${column}) ilike public.unaccent(${pattern}) escape '\\'`

  return sql`(${holds(stories.title)} or ${holds(stories.synopsis)} or ${holds(sql`coalesce(${authors.name}, '')`)})`
}
