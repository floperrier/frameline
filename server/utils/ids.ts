import type { H3Event } from 'h3'

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Kind = 'Story' | 'Scene' | 'Shot' | 'Exit'

/**
 * Which message each of the four things is refused with. A key apiece rather
 * than a noun written into one sentence, because French makes the article and
 * the agreement depend on which noun it is — and a map rather than a key built
 * out of the noun at runtime, so a Kind nobody wrote a message for is a type
 * error rather than a raw key on an Author's screen.
 */
const NOT_AN_ID: Record<Kind, string> = {
  Story: 'refusals.notAnId.story',
  Scene: 'refusals.notAnId.scene',
  Shot: 'refusals.notAnId.shot',
  Exit: 'refusals.notAnId.exit',
}

const NO_SUCH: Record<Kind, string> = {
  Story: 'refusals.noSuch.story',
  Scene: 'refusals.noSuch.scene',
  Shot: 'refusals.noSuch.shot',
  Exit: 'refusals.noSuch.exit',
}

/**
 * Reads the id of a Story, a Scene, a Shot or an Exit from the path. Rejecting a
 * malformed id here keeps Postgres from failing the uuid cast, which would read
 * as a server fault rather than a bad request.
 */
export function readId(event: H3Event, kind: Kind) {
  const id = getRouterParam(event, 'id')

  if (!id || !UUID_PATTERN.test(id)) {
    throw createError({
      statusCode: 400,
      message: saying(event)(NOT_AN_ID[kind]),
    })
  }

  return id
}

/**
 * Whatever an Author never wrote reads as absent, not forbidden.
 *
 * The one refusal written twice, because a Reader reads this one. Nitro replaces
 * a fatal error's `message` with "Server Error" before it leaves the server, so
 * `statusMessage` is all that survives to the editor's own handling, and the
 * body is what the editor reads. See
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 *
 * A reason phrase is sanitized down to ASCII on the way out, so an accented
 * French sentence would reach a page with its accents missing. The Reader's
 * error page therefore says the sentence itself rather than repeating this one —
 * see `app/error.vue`.
 */
export function notFound(event: H3Event, kind: Kind) {
  const absent = saying(event)(NO_SUCH[kind])

  return createError({ statusCode: 404, message: absent, statusMessage: absent })
}
