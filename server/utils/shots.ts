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

/**
 * Reads the still being attached to a Shot: the whole request body is the file,
 * because one file is the whole of the request and a multipart form would only
 * wrap it in a boundary for us to unwrap.
 *
 * A trust boundary, and the only one these bytes cross: what gets past here is
 * stored and later served back under the type its own first bytes claim, so both
 * refusals name their reason rather than leaving the Author with a Shot that
 * shows nothing.
 *
 * ponytail: the body is buffered to be weighed, so the cap is enforced once the
 * bytes have all arrived rather than while they arrive. At two megabytes that
 * costs nothing; stream it the day a Shot may carry a master.
 */
export async function readShotImage(event: H3Event) {
  const bytes = await readRawBody(event, false)

  if (!bytes?.length) {
    throw createError({ statusCode: 400, statusMessage: 'An image is a file to upload.' })
  }
  if (bytes.length > SHOT_IMAGE_MAX_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: `An image cannot weigh more than ${SHOT_IMAGE_MAX_MB} MB.`,
    })
  }
  if (!imageTypeOf(bytes)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A Shot carries a JPEG, a PNG or a WebP image, and nothing else.',
    })
  }

  return bytes
}
