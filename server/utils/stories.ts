import type { H3Event } from 'h3'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Reads a Story title from the request body. A trust boundary: the title
 * reaches the database and every Reader, so length is capped here rather than
 * left to Postgres.
 */
export async function readStoryTitle(event: H3Event) {
  const body = await readBody<{ title?: unknown }>(event)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'A Story needs a title.' })
  }
  if (title.length > STORY_TITLE_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `A title cannot be longer than ${STORY_TITLE_MAX_LENGTH} characters.`,
    })
  }

  return title
}

/**
 * Reads the Story id from the path. Rejecting a malformed id here keeps
 * Postgres from failing the uuid cast, which would read as a server fault
 * rather than a bad request.
 */
export function readStoryId(event: H3Event) {
  const id = getRouterParam(event, 'id')

  if (!id || !UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'That is not a Story id.' })
  }

  return id
}

/** Every Story a signed-in Author never owned reads as absent, not forbidden. */
export function storyNotFound() {
  return createError({ statusCode: 404, statusMessage: 'No such Story.' })
}
