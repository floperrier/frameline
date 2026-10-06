/**
 * Whether a finger lifted off the frame crossed it, and which way. Towards the
 * leading edge, which is right to left in both of the interface's Languages, it
 * goes on; the other way it steps back. Anything shorter, steeper or slower is a
 * tap or a scroll and says nothing, because a finger on the picture to look at it
 * is not carried on — see `docs/adr/0065-a-swipe-across-the-frame-is-a-press.md`.
 *
 * The three thresholds are a starting point nobody has tuned on a device, kept
 * here so that tuning them is one edit.
 */

/** How far across a finger has to travel, in CSS pixels. */
export const SWIPE_ACROSS = 48

/** How many times further across than down it has to travel. */
export const SWIPE_RATIO = 1.5

/** How long it may stay down, in milliseconds. */
export const SWIPE_WITHIN = 800

/** Where a finger touched or lifted, and when, by the event's `timeStamp`. */
export type Touched = { x: number, y: number, t: number }

export function swiped(from: Touched, to: Touched): 'on' | 'back' | null {
  const across = to.x - from.x
  if (Math.abs(across) < SWIPE_ACROSS) return null
  if (Math.abs(across) < SWIPE_RATIO * Math.abs(to.y - from.y)) return null
  if (to.t - from.t > SWIPE_WITHIN) return null
  return across < 0 ? 'on' : 'back'
}
