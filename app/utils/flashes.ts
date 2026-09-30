/**
 * The one rule that keeps a flash from white from coming too close to another
 * flash. A flicker keeps a pattern whose dips start at least half a second apart
 * and never in the first 400 ms of a beat, so a white drawn only after a beat that
 * did not flicker and has stood a whole second has no dip in the second before it,
 * at most two after it, and no other white nearer than a second. That is three
 * flashes in any second at the worst, which is what WCAG 2.3.1 allows, and
 * `tests/unit/effects.spec.ts` holds the pattern and the rule to it together.
 *
 * Fed with `performance.now()` as each frame is drawn and never with the Path,
 * because it is a fact of the screen and not of where a Reading has got to.
 */

/** How far apart two flashes from white are, and how long the beat before one has to have stood. */
export const FLASHES_APART = 1000

/** A beat as the flash rule remembers it: when it arrived, by `performance.now()`, and whether it flickers. */
export type Arrived = { at: number, flickers: boolean }

/** Whether a flash from white arriving `now` is withheld: after a beat that flickers, or arrived less than a second before. */
export function withholdsFlash(before: Arrived | undefined, now: number): boolean {
  return !!before && (before.flickers || now - before.at < FLASHES_APART)
}
