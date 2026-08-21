import type { H3Event } from 'h3'

/**
 * Reads a Shot's text. A Shot is added empty and written afterwards, so empty is
 * a Shot the Author has not got to yet rather than a bad request — but text that
 * is missing altogether is, because writing it as empty would erase the Shot.
 */
export async function readShotText(event: H3Event) {
  const body = await readBody<{ text?: unknown }>(event)

  if (typeof body?.text !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'A Shot holds text.' })
  }

  const text = body.text

  if (text.length > SHOT_TEXT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `A Shot cannot hold more than ${SHOT_TEXT_MAX_LENGTH} characters.`,
    })
  }

  return text
}

/** Reads which way a Shot is being moved, as the step to add to its position. */
export async function readMoveStep(event: H3Event) {
  const body = await readBody<{ direction?: unknown }>(event)

  if (body?.direction === 'earlier') return -1
  if (body?.direction === 'later') return 1

  throw createError({
    statusCode: 400,
    statusMessage: 'A Shot moves either earlier or later.',
  })
}
