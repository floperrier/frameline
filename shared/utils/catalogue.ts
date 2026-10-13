/**
 * What a Reader has asked the Catalogue for: the words they search, and later
 * the filters, the order and the page. All of it lives in the URL, so a narrowed
 * Catalogue is a link that can be sent to somebody, and the Back button returns
 * to it — see `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`.
 */
export type CatalogueState = {
  /** The words searched for, trimmed; empty is no search. */
  q: string
}

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
  }
}

/**
 * The query string a state is written as, naming only what differs from the
 * Catalogue as it opens, so the bare Catalogue is `/catalogue` and a search is
 * `/catalogue?q=…` and nothing longer.
 */
export function catalogueQuery(state: CatalogueState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.q) query.q = state.q
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
