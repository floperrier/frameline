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
 * The one refusal written twice. A Reader who opens a link to an unpublished
 * Story is shown Nuxt's error page, and that page is handed a fatal error, whose
 * `message` nitro replaces with "Server Error" before it leaves the server: the
 * only sentence that survives to it is `statusMessage`. The editor reads the
 * body, so this needs both. Nothing is lost to the sanitizing h3 warns about —
 * the sentence is ASCII, and stays that way.
 */
export function notFound(kind: Kind) {
  const absent = `No such ${kind}.`

  return createError({ statusCode: 404, message: absent, statusMessage: absent })
}
