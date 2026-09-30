import type { H3Event } from 'h3'
import {
  TEXT_AFTER_MAX,
  TEXT_BYS,
  TEXT_OVER_MAX,
  TEXT_STAYS_MAX,
  isPace,
} from '../../shared/utils/scenes'
import type { TextBy } from '../../shared/utils/scenes'
import { readTime } from './cut'

/**
 * Reads what a Scene or a Shot says about how its text arrives. A Shot's null is
 * *as the Scene says*; a Scene has nothing above it, so it reads the first four
 * with `nullable` false and is refused a null its column could not hold — the
 * overloads `readCutOver` has, for its reason. The refusal travels in the body:
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`. See
 * `docs/adr/0051-a-text-arrives-in-its-own-time.md`.
 */
export function readTextAfter(event: H3Event, options: { nullable: false }): Promise<number>
export function readTextAfter(
  event: H3Event, options?: { nullable?: boolean },
): Promise<number | null>
export function readTextAfter(event: H3Event, { nullable = true }: { nullable?: boolean } = {}) {
  return readTime(event, 'textAfter', TEXT_AFTER_MAX, 'refusals.textAfter', nullable)
}

/** How long each part takes to appear, and the whole text to leave. Nought is at once. */
export function readTextOver(event: H3Event, options: { nullable: false }): Promise<number>
export function readTextOver(
  event: H3Event, options?: { nullable?: boolean },
): Promise<number | null>
export function readTextOver(event: H3Event, { nullable = true }: { nullable?: boolean } = {}) {
  return readTime(event, 'textOver', TEXT_OVER_MAX, 'refusals.textOver', nullable)
}

/**
 * How long the text stays once it has arrived. Null is taken from both: on a
 * Scene it is until the Cut, on a Shot *as the Scene says*. What nought means is
 * the carrier's to settle, which is why the Scene's door refuses it itself.
 */
export function readTextStays(event: H3Event) {
  return readTime(event, 'textStays', TEXT_STAYS_MAX, 'refusals.textStays', true)
}

/** What the text arrives by: the four words are the whole of the language. */
export function readTextBy(event: H3Event, options: { nullable: false }): Promise<TextBy>
export function readTextBy(
  event: H3Event, options?: { nullable?: boolean },
): Promise<TextBy | null>
export async function readTextBy(
  event: H3Event, { nullable = true }: { nullable?: boolean } = {},
) {
  const held = (await readBody<Record<string, unknown>>(event))?.textBy

  if (held === null && nullable) return null
  if (!TEXT_BYS.includes(held as TextBy)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.textBy') })
  }

  return held as TextBy
}

/** The pace, in whole characters a second, read wherever the text does not arrive whole. */
export function readTextPace(event: H3Event, options: { nullable: false }): Promise<number>
export function readTextPace(
  event: H3Event, options?: { nullable?: boolean },
): Promise<number | null>
export async function readTextPace(
  event: H3Event, { nullable = true }: { nullable?: boolean } = {},
) {
  const held = (await readBody<Record<string, unknown>>(event))?.textPace

  if (held === null && nullable) return null
  if (!isPace(held)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.textPace') })
  }

  return held
}
