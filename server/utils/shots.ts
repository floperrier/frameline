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

/**
 * Reads the Description of a Shot's still: what the frame shows, for a Reader who
 * cannot see it. The same rule as the Shot's text, for the same reason — empty is
 * a Still nobody has described yet, which a Still is entitled to be, and missing
 * altogether is a request that would erase the Description by saying nothing
 * about it.
 */
export async function readShotDescription(event: H3Event) {
  const body = await readBody<{ description?: unknown }>(event)
  const written = body?.description

  if (typeof written !== 'string' || written.length > SHOT_DESCRIPTION_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A Description says what a still shows, in at most '
        + `${SHOT_DESCRIPTION_MAX_LENGTH} characters.`,
    })
  }

  return written
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
      statusMessage: `An image cannot weigh more than ${SHOT_IMAGE_MAX_BYTES / 1024 / 1024} MB.`,
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
