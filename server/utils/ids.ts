import type { H3Event } from 'h3'

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Kind = 'Story' | 'Scene' | 'Shot' | 'Cut'

/**
 * Reads the id of a Story, a Scene, a Shot or a Cut from the path. Rejecting a
 * malformed id here keeps Postgres from failing the uuid cast, which would read
 * as a server fault rather than a bad request.
 */
export function readId(event: H3Event, kind: Kind) {
  const id = getRouterParam(event, 'id')

  if (!id || !UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, message: `That is not a ${kind} id.` })
  }

  return id
}

/**
 * Whatever an Author never wrote reads as absent, not forbidden.
 *
 * The one refusal written twice, because a Reader reads this one. Nitro replaces
 * a fatal error's `message` with "Server Error" before it leaves the server, so
 * `statusMessage` is all that survives to the error page shown at the link to an
 * unpublished Story, and the editor reads the body. The sentence is ASCII, so
 * sanitizing costs it nothing. See
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
export function notFound(kind: Kind) {
  const absent = `No such ${kind}.`

  return createError({ statusCode: 404, message: absent, statusMessage: absent })
}
