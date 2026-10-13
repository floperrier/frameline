import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import type { AnyColumn, SQL } from 'drizzle-orm'
import { authors, stories } from '../db/schema'
import { useDb } from '../db'
import type { CatalogueSort, ReadingTimeBand } from '../../shared/utils/catalogue'

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
 * It answers one page of entries, with how many Stories match and how many
 * pages that makes, so a page draws its own navigation. A page past the last
 * answers no entries and the totals, which is how the page says there is
 * nothing there and offers the way back. A page is never more than
 * `CATALOGUE_PAGE_SIZE` Covers: the shelf whole used to pull every one of them
 * through the database on every view (#499).
 *
 * Being published is asked for beside being Listed, though unpublishing unlists
 * in the same statement and the two cannot drift apart: an entry here leads
 * straight to `/read/<id>`, so a row that got out of step would be an entry
 * pointing at a not-found rather than a row nobody notices.
 *
 * Nothing is counted, rated or ordered by anything an Author can influence. The
 * day a Story first entered the Catalogue is the order it opens in, and it is the
 * one ranking nobody can play: neither republishing nor listing again moves it —
 * see `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`. The others
 * are what `ordered` says. The Story's id breaks a tie, so the order is the same
 * on every request.
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
  if (state.language) where.push(eq(stories.language, state.language))
  if (state.time) where.push(lasting(state.time))

  const [rows, [counted]] = await Promise.all([useDb()
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
    .orderBy(ordered(state.sort), asc(stories.id))
    .limit(CATALOGUE_PAGE_SIZE)
    .offset((state.page - 1) * CATALOGUE_PAGE_SIZE),
  useDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.id))
    .where(and(...where))])

  const total = counted?.total ?? 0

  return {
    entries: rows.map(({ coverShotId, cropX, cropY, ...row }) => ({
      ...row,
      cover: coverFor({ coverShotId, cropX, cropY }),
    })),
    total,
    pages: Math.ceil(total / CATALOGUE_PAGE_SIZE),
    page: state.page,
  }
})

/**
 * What the Stories stand in order of, before their ids break a tie. The day a
 * Story first entered the Catalogue, newest first; or the shuffle, a hash of the
 * Story's id and the day in UTC, which is the same for everybody all day and
 * changes overnight — and, being one order over every Story, never puts a Story
 * on two pages. An older Story gets its turn at the top without anybody scoring
 * it.
 */
function ordered(sort: CatalogueSort) {
  if (sort === 'shuffle') {
    const today = new Date().toISOString().slice(0, 10)
    return sql`md5(${stories.id}::text || ${today})`
  }
  // A Story not measured yet comes last either way round: it is neither short
  // nor long, and is not to be met first as if it were.
  if (sort === 'shortest') return sql`${stories.readingTime} asc nulls last`
  if (sort === 'longest') return sql`${stories.readingTime} desc nulls last`
  return sql`${stories.firstListedAt} desc nulls last`
}

/** The Stories whose Reading Time falls in a band; one not measured falls in none. */
function lasting(time: ReadingTimeBand) {
  const band: { under?: number, from?: number, upTo?: number, over?: number } = READING_TIME_BANDS[time]
  if (band.under !== undefined) return sql`${stories.readingTime} < ${band.under}`
  if (band.over !== undefined) return sql`${stories.readingTime} > ${band.over}`
  return sql`${stories.readingTime} between ${band.from} and ${band.upTo}`
}

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
