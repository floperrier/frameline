import { STORY_LANGUAGES } from './stories'
import type { StoryLanguage } from './stories'

/**
 * The orders the Catalogue is offered in. None of them counts anything: the day
 * a Story first entered the Catalogue, a shuffle drawn from the day, the same
 * for everybody, and the Reading Time either way round — see
 * `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`. The first is
 * the order it opens in.
 */
export const CATALOGUE_SORTS = ['recent', 'shuffle', 'shortest', 'longest'] as const

export type CatalogueSort = typeof CATALOGUE_SORTS[number]

/**
 * The bands of Reading Time a Reader keeps to, in seconds: under ten minutes,
 * from ten to thirty, over thirty. A Story with no Reading Time yet falls in
 * none of them.
 */
export const READING_TIME_BANDS = {
  short: { under: 600 },
  medium: { from: 600, upTo: 1_800 },
  long: { over: 1_800 },
} as const

export type ReadingTimeBand = keyof typeof READING_TIME_BANDS

export const READING_TIME_BAND_NAMES = Object.keys(READING_TIME_BANDS) as ReadingTimeBand[]

/**
 * What a Reader has asked the Catalogue for: the words they search, and later
 * the filters, the order and the page. All of it lives in the URL, so a narrowed
 * Catalogue is a link that can be sent to somebody, and the Back button returns
 * to it — see `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`.
 */
export type CatalogueState = {
  /** The words searched for, trimmed; empty is no search. */
  q: string
  /** The one Language kept to, or none; nothing picks one for the Reader. */
  language: StoryLanguage | ''
  /** The band of Reading Time kept to, or none. */
  time: ReadingTimeBand | ''
  /** The order the Stories stand in. */
  sort: CatalogueSort
  /** The page asked for, counted from one. */
  page: number
}

/**
 * How many Stories a page of the Catalogue holds. Few enough that a page never
 * pulls more than this many Covers through the database, which is what a view of
 * the whole shelf used to cost (#499).
 */
export const CATALOGUE_PAGE_SIZE = 24

/** The longest search a Reader's words are cut to: a title, and some. */
export const CATALOGUE_SEARCH_MAX_LENGTH = 200

/** One value of a query string, which may arrive once, several times or not at all. */
function first(held: unknown) {
  const value = Array.isArray(held) ? held[0] : held
  return typeof value === 'string' ? value : ''
}

/**
 * Reads what the Catalogue is asked for out of a query string. The first reader
 * here of a query string rather than a body, and so the one that never refuses:
 * a value missing or unknown is its default, because a link sent last year must
 * still open on a Catalogue rather than on an error.
 *
 * Shared, because the server answers by it and the page draws its controls and
 * its links by it, and the two must agree on what a URL asks for.
 */
export function catalogueState(query: Record<string, unknown>): CatalogueState {
  return {
    q: first(query.q).trim().slice(0, CATALOGUE_SEARCH_MAX_LENGTH),
    language: oneOf(STORY_LANGUAGES, first(query.language)) ?? '',
    time: oneOf(READING_TIME_BAND_NAMES, first(query.time)) ?? '',
    sort: oneOf(CATALOGUE_SORTS, first(query.sort)) ?? CATALOGUE_SORTS[0],
    page: pageOf(first(query.page)),
  }
}

/** A value written in a URL, where it is one of a closed list. */
function oneOf<T extends string>(list: readonly T[], written: string) {
  return list.includes(written as T) ? written as T : undefined
}

/**
 * A page number written in a URL: a whole number from one, written as digits and
 * nothing else, and page one for anything that is not — `abc`, `0`, `-2`, `1.5`.
 */
function pageOf(written: string) {
  if (!/^\d{1,9}$/.test(written)) return 1
  return Math.max(1, Number(written))
}

/**
 * The query string a state is written as, naming only what differs from the
 * Catalogue as it opens, so the bare Catalogue is `/catalogue` and a search is
 * `/catalogue?q=…` and nothing longer. Page one is not written either, so the
 * first page of a search and the search are one link.
 */
export function catalogueQuery(state: CatalogueState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.q) query.q = state.q
  if (state.language) query.language = state.language
  if (state.time) query.time = state.time
  if (state.sort !== CATALOGUE_SORTS[0]) query.sort = state.sort
  if (state.page > 1) query.page = String(state.page)
  return query
}

/**
 * A search term as a `LIKE` pattern that finds it anywhere in a text: the three
 * characters `LIKE` reads as more than themselves — the two wildcards and the
 * backslash that escapes them — are escaped, so a Reader who types `100%` is
 * looking for a percent sign and not for everything that starts with *100*.
 */
export function containing(term: string) {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`
}

/**
 * The pages the Catalogue's navigation offers around the one a Reader is on:
 * that page and two on each side, within the pages there are.
 */
export function pagesAround(page: number, pages: number) {
  const from = Math.max(1, Math.min(page, pages) - 2)
  const to = Math.min(pages, Math.max(page, 1) + 2)
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, at) => from + at)
}
