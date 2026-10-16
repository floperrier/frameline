import type { H3Event } from 'h3'
import { parseFormatted, textOf } from '../../shared/utils/formatted'
import type { Formatted, FormattedRefusal } from '../../shared/utils/formatted'
import type { Phrase } from '../../shared/utils/phrases'

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

/** The phrase of the rule a Shot's formatted text broke at the boundary. */
export function formattedRefused(say: Phrase, refused: FormattedRefusal): string {
  return {
    shotTextLong: () => say('refusals.shotTextLong', { max: SHOT_TEXT_MAX_LENGTH }),
    redactionHides: () => say('refusals.redactionHides', { max: REDACTION_HIDES_MAX_LENGTH }),
    lettersSplit: () => say('refusals.lettersSplit', { max: LETTERS_SPLIT_MAX }),
    effectArrives: () => say('refusals.effectArrives'),
    effectLasts: () => say('refusals.effectLasts'),
    formatted: () => say('refusals.formatted'),
  }[refused]()
}

/**
 * Reads a Shot's formatted text, which the boundary parses key by key: the body's
 * `formatted`, or the half of a cut Shot it is named by.
 */
export async function readShotFormatted(event: H3Event, key: 'formatted' | 'before' | 'after' = 'formatted') {
  const body = await readBody<Record<string, unknown>>(event)

  return formattedOrRefused(event, body?.[key])
}

/**
 * The formatted texts of the Shots a Scene is given at once — issue #438: absent
 * where the request makes one empty Shot, as it always has, and otherwise a list
 * of one to `SHOTS_ADDED_MAX`, each held to the boundary a PATCH's text is.
 */
export async function readShotsFormatted(event: H3Event) {
  const body = await readBody<{ formatted?: unknown }>(event)
  const listed = body?.formatted
  if (listed === undefined) return undefined

  if (!Array.isArray(listed) || !listed.length || listed.length > SHOTS_ADDED_MAX) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.shotsFromText', { max: SHOTS_ADDED_MAX }),
    })
  }

  return listed.map(json => formattedOrRefused(event, json))
}

/** A formatted text read at the boundary, or refused with the phrase of whichever rule it broke. */
function formattedOrRefused(event: H3Event, json: unknown) {
  const read = parseFormatted(json, 'refuse')

  if ('formatted' in read) return read.formatted

  throw createError({ statusCode: 400, message: formattedRefused(saying(event), read.refused) })
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
 * One axis of the point an Image is cropped around: a whole percent from 0 to
 * 100, which is the number `object-position` reads. Never null — the centre is
 * 50, a value — so the two axes can never disagree about whether a point is said.
 */
async function readCrop(event: H3Event, field: 'cropX' | 'cropY') {
  const body = await readBody<Record<string, unknown>>(event)
  const held = body?.[field]

  if (!Number.isInteger(held) || (held as number) < 0 || (held as number) > 100) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.crop') })
  }

  return held as number
}

/**
 * What a PATCH may change about a Shot: its text, the Description of the image it
 * carries, the Transcript of the Sound it strikes with, and its own Cut — cut
 * after a time or at the press, over a duration or hard, through the image or
 * through black — how it is laid out and the point its Image is cropped around,
 * how its Image moves, its four Effects, on the Image and on the text, as it
 * arrives and while it stands, and how its text arrives and how long it stays.
 * Each is read only where the body names it — the shape `readStoryChanges` has —
 * so the Transcript written beside a Sound does not have to carry the beat's text
 * along with it.
 *
 * A body naming none is refused as the text being asked for, which is what a
 * request that would erase the Shot is missing.
 */
export async function readShotChanges(event: H3Event) {
  const body = await readBody<{
    text?: unknown
    formatted?: unknown
    description?: unknown
    transcript?: unknown
    cutAfter?: unknown
    cutOver?: unknown
    cutThrough?: unknown
    layout?: unknown
    cropX?: unknown
    cropY?: unknown
    movementBy?: unknown
    movementDirection?: unknown
    movementOver?: unknown
    imageArrives?: unknown
    imageLasts?: unknown
    textArrives?: unknown
    textLasts?: unknown
    textAfter?: unknown
    textBy?: unknown
    textPace?: unknown
    textOver?: unknown
    textStays?: unknown
  }>(event)
  const changes: {
    text?: string
    formatted?: Formatted | null
    description?: string
    transcript?: string
    cutAfter?: number | null
    cutOver?: number | null
    cutThrough?: CutThrough | null
    layout?: Layout | null
    cropX?: number
    cropY?: number
    movementBy?: number | null
    movementDirection?: MovementDirection | null
    movementOver?: number | null
    imageArrives?: Arrival | null
    imageLasts?: Lasting | null
    textArrives?: Arrival | null
    textLasts?: Lasting | null
    textAfter?: number | null
    textBy?: TextBy | null
    textPace?: number | null
    textOver?: number | null
    textStays?: number | null
  } = {}

  // The words are said once: `formatted` carries its plain words with it, and
  // `text` alone is a plain Shot, which unsets whatever was formatted.
  if (body?.text !== undefined && body?.formatted !== undefined) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.shotWordsTwice') })
  }
  if (body?.text !== undefined) {
    changes.text = await readShotText(event)
    changes.formatted = null
  }
  if (body?.formatted !== undefined) {
    const formatted = await readShotFormatted(event)
    changes.formatted = formatted
    changes.text = textOf(formatted)
  }
  if (body?.description !== undefined) changes.description = await readShotDescription(event)
  if (body?.transcript !== undefined) changes.transcript = await readTranscript(event)
  // A Shot's own three answer as themselves or answer *as the Scene says*, so
  // null is read here rather than refused, unlike the same fields on a Scene.
  if (body?.cutAfter !== undefined) changes.cutAfter = await readCutAfter(event)
  if (body?.cutOver !== undefined) changes.cutOver = await readCutOver(event)
  if (body?.cutThrough !== undefined) changes.cutThrough = await readCutThrough(event)
  // Layout answers as itself or *as the Scene says*, so null is read. The point
  // has no such answer: it is a value on every Shot, the centre until moved.
  if (body?.layout !== undefined) changes.layout = await readLayout(event)
  if (body?.cropX !== undefined) changes.cropX = await readCrop(event, 'cropX')
  if (body?.cropY !== undefined) changes.cropY = await readCrop(event, 'cropY')
  // How the Image moves answers as itself or *as the Scene says*, so null is read.
  if (body?.movementBy !== undefined) changes.movementBy = await readMovementBy(event)
  if (body?.movementDirection !== undefined) {
    changes.movementDirection = await readMovementDirection(event)
  }
  if (body?.movementOver !== undefined) changes.movementOver = await readMovementOver(event)
  // An Effect is a whole object or null, and null is none rather than a refusal.
  if (body?.imageArrives !== undefined) changes.imageArrives = await readArrival(event, 'imageArrives')
  if (body?.imageLasts !== undefined) changes.imageLasts = await readLasting(event, 'imageLasts')
  if (body?.textArrives !== undefined) changes.textArrives = await readArrival(event, 'textArrives')
  if (body?.textLasts !== undefined) changes.textLasts = await readLasting(event, 'textLasts')
  if (body?.textAfter !== undefined) changes.textAfter = await readTextAfter(event)
  if (body?.textBy !== undefined) changes.textBy = await readTextBy(event)
  if (body?.textPace !== undefined) changes.textPace = await readTextPace(event)
  if (body?.textOver !== undefined) changes.textOver = await readTextOver(event)
  if (body?.textStays !== undefined) changes.textStays = await readTextStays(event)
  if (!Object.keys(changes).length) await readShotText(event)

  return changes
}
