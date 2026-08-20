import type { H3Event } from 'h3'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Reads the id of a Story, a Scene or a Shot from the path. Rejecting a
 * malformed id here keeps Postgres from failing the uuid cast, which would read
 * as a server fault rather than a bad request.
 */
export function readId(event: H3Event, thing: 'Story' | 'Scene' | 'Shot') {
  const id = getRouterParam(event, 'id')

  if (!id || !UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: `That is not a ${thing} id.` })
  }

  return id
}

/** Whatever an Author never wrote reads as absent, not forbidden. */
export function notFound(thing: 'Story' | 'Scene' | 'Shot') {
  return createError({ statusCode: 404, statusMessage: `No such ${thing}.` })
}
