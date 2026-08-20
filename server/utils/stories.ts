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
