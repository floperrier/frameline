import type { H3Event } from 'h3'
import {
  CUT_AFTER_MAX,
  CUT_AFTER_MIN,
  CUT_OVER_MAX,
  CUT_THROUGHS,
  EXITS_AFTER_MAX,
  EXITS_AFTER_MIN,
  isTime,
} from '../../shared/utils/scenes'
import type { CutThrough } from '../../shared/utils/scenes'

/**
 * Reads one of a Cut's times off the body: a whole number of milliseconds from
 * its floor to its cap, nought, or null where the column takes one. What nought
 * and null mean is the column's own business — a hard cut, a Shot held until the
 * press, ways on never offered, a Scene's run waiting for the press, a Shot
 * answering as its Scene says — so nought stands outside the floor rather than
 * under it, and this refuses everything else and says nothing about which. The
 * refusal travels in the body: `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
async function readTime(
  event: H3Event, field: string, min: number, max: number, refusal: string, nullable: boolean,
) {
  const body = await readBody<Record<string, unknown>>(event)
  const held = body?.[field]

  if (held === null && nullable) return null
  if (held !== 0 && !isTime(held, max, min)) {
    throw createError({ statusCode: 400, message: saying(event)(refusal) })
  }

  return held
}

/** How long a Shot stands before the cut is made. Only a Shot writes this one. */
export function readCutAfter(event: H3Event) {
  return readTime(event, 'cutAfter', CUT_AFTER_MIN, CUT_AFTER_MAX, 'refusals.cutAfter', true)
}

/**
 * How long the cut itself takes. Nought is a hard cut, and null is *as the Scene
 * says* — which only a Shot may answer, so a Scene and an Exit read it with
 * `nullable` false and are refused a null their column could not hold anyway.
 *
 * Overloaded on that option so a Scene's and an Exit's `not null` column reads
 * back a plain `number`: the caller knows nothing was refused, so nothing
 * downstream needs a cast to say the same thing again.
 */
export function readCutOver(event: H3Event, options: { nullable: false }): Promise<number>
export function readCutOver(
  event: H3Event, options?: { nullable?: boolean },
): Promise<number | null>
export function readCutOver(
  event: H3Event, { nullable = true }: { nullable?: boolean } = {},
) {
  return readTime(event, 'cutOver', 0, CUT_OVER_MAX, 'refusals.cutOver', nullable)
}

/** How long the ways on stand: null until one is taken, nought never. */
export function readExitsAfter(event: H3Event) {
  return readTime(event, 'exitsAfter', EXITS_AFTER_MIN, EXITS_AFTER_MAX, 'refusals.exitsAfter', true)
}

/**
 * What the cut passes through. Null is taken where the carrier allows one — a
 * Shot saying nothing — and the two words are the whole of the language, so
 * anything else is refused rather than stored and read back as a surprise.
 *
 * Overloaded the same way as `readCutOver`, for the same reason.
 */
export function readCutThrough(
  event: H3Event, options: { nullable: false },
): Promise<CutThrough>
export function readCutThrough(
  event: H3Event, options?: { nullable?: boolean },
): Promise<CutThrough | null>
export async function readCutThrough(
  event: H3Event, { nullable = true }: { nullable?: boolean } = {},
) {
  const body = await readBody<Record<string, unknown>>(event)
  const held = body?.cutThrough

  if (held === null && nullable) return null
  if (!CUT_THROUGHS.includes(held as CutThrough)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.cutThrough') })
  }

  return held as CutThrough
}
