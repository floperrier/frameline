import type { H3Event } from 'h3'

/**
 * Reads a Shot's text. A Shot is added empty and written afterwards, so empty is
 * a Shot the Author has not got to yet rather than a bad request — but text that
 * is missing altogether is, because writing it as empty would erase the Shot.
 */
export async function readShotText(event: H3Event) {
  const body = await readBody<{ text?: unknown }>(event)

  if (typeof body?.text !== 'string') {
    throw createError({ statusCode: 400, message: saying(event)('refusals.shotText') })
  }

  const text = body.text

  if (text.length > SHOT_TEXT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.shotTextLong', { max: SHOT_TEXT_MAX_LENGTH }),
    })
  }

  return text
}

/**
 * Reads the Description of a Shot's image: what the frame shows, for a Reader who
 * cannot see it. The same rule as the Shot's text, for the same reason — empty is
 * an Image nobody has described yet, which an Image is entitled to be, and missing
 * altogether is a request that would erase the Description by saying nothing
 * about it.
 */
export async function readShotDescription(event: H3Event) {
  const body = await readBody<{ description?: unknown }>(event)
  const written = body?.description

  if (typeof written !== 'string' || written.length > SHOT_DESCRIPTION_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.description', { max: SHOT_DESCRIPTION_MAX_LENGTH }),
    })
  }

  return written
}

/**
 * Reads the image being attached to a Shot: the whole request body is the file,
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
    throw createError({ statusCode: 400, message: saying(event)('refusals.imageMissing') })
  }
  if (bytes.length > SHOT_IMAGE_MAX_BYTES) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.imageHeavy', { mb: SHOT_IMAGE_MAX_BYTES / 1024 / 1024 }),
    })
  }
  if (!imageTypeOf(bytes)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.imageType') })
  }

  return bytes
}

/**
 * What a PATCH may change about a Shot: its text, the Description of the image it
 * carries, and the Transcript of the Sound it strikes with. Each is read only
 * where the body names it — the shape `readStoryChanges` has — so the Transcript
 * written beside a Sound does not have to carry the beat's text along with it.
 *
 * A body naming none is refused as the text being asked for, which is what a
 * request that would erase the Shot is missing.
 */
export async function readShotChanges(event: H3Event) {
  const body = await readBody<{
    text?: unknown
    description?: unknown
    transcript?: unknown
  }>(event)
  const changes: { text?: string, description?: string, transcript?: string } = {}

  if (body?.text !== undefined) changes.text = await readShotText(event)
  if (body?.description !== undefined) changes.description = await readShotDescription(event)
  if (body?.transcript !== undefined) changes.transcript = await readTranscript(event)
  if (!Object.keys(changes).length) await readShotText(event)

  return changes
}
