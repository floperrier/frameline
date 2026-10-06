import type { H3Event } from 'h3'
import { MOVEMENT_BY_MAX, MOVEMENT_DIRECTIONS, MOVEMENT_OVER_MAX } from '../../shared/utils/scenes'
import type { MovementDirection } from '../../shared/utils/scenes'
import { readTime } from './cut'

/**
 * Reads what a Scene or a Shot says about how its Images move. A Shot's null is
 * *as the Scene says*; a Scene has nothing above it, so it reads all three with
 * `nullable` false and is refused a null its column could not hold — the
 * overloads `readCutOver` has, for its reason. The refusal travels in the body:
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`. See
 * `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
 *
 * The amount is a whole number of percent from nought to its cap, which is the
 * whole of the rule `readTime` holds a time to, so it is read by it.
 */
export function readMovementBy(event: H3Event, options: { nullable: false }): Promise<number>
export function readMovementBy(
  event: H3Event, options?: { nullable?: boolean },
): Promise<number | null>
export function readMovementBy(event: H3Event, { nullable = true }: { nullable?: boolean } = {}) {
  return readTime(event, 'movementBy', 0, MOVEMENT_BY_MAX, 'refusals.movementBy', nullable)
}

/** How long the Movement takes. Nought is as long as its Shot is on screen. */
export function readMovementOver(event: H3Event, options: { nullable: false }): Promise<number>
export function readMovementOver(
  event: H3Event, options?: { nullable?: boolean },
): Promise<number | null>
export function readMovementOver(event: H3Event, { nullable = true }: { nullable?: boolean } = {}) {
  return readTime(event, 'movementOver', 0, MOVEMENT_OVER_MAX, 'refusals.movementOver', nullable)
}

/** Which way the Image moves: the six words are the whole of the language. */
export function readMovementDirection(
  event: H3Event, options: { nullable: false },
): Promise<MovementDirection>
export function readMovementDirection(
  event: H3Event, options?: { nullable?: boolean },
): Promise<MovementDirection | null>
export async function readMovementDirection(
  event: H3Event, { nullable = true }: { nullable?: boolean } = {},
) {
  const held = (await readBody<Record<string, unknown>>(event))?.movementDirection

  if (held === null && nullable) return null
  if (!MOVEMENT_DIRECTIONS.includes(held as MovementDirection)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.movementDirection') })
  }

  return held as MovementDirection
}
