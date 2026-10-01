/**
 * What the bench writes an Effect with, read by the two places one is said: a
 * Shot's row, of its Image or its whole text, and the toolbar, of a run of its
 * words — issue #361. One table, so the two cannot offer an Effect under two
 * names or start it at two times. Beside it is how a field of seconds is read
 * back, which every time the bench asks for in seconds is read by: an Effect's,
 * a Cut's, a text's and the Exits'.
 */
import type { Arrival, Lasting, Strength } from '#shared/utils/scenes'

/** The message each Effect is offered under. */
export const EFFECT_LABELS: Record<string, string> = {
  'shake': 'effectShake',
  'from-blur': 'effectFromBlur',
  'from-white': 'effectFromWhite',
  'into-colour': 'effectIntoColour',
  'out-of-colour': 'effectOutOfColour',
  'closing-in': 'effectClosingIn',
  'scramble': 'effectScramble',
  'flicker': 'effectFlicker',
  'pulse': 'effectPulse',
  'tremor': 'effectTremor',
  'wave': 'effectWave',
  'grain': 'effectGrain',
}

/**
 * Where a time starts on the Effect that has one, as `CUT_MADE` starts a
 * dissolve: an Author writes over it in the field beside the answer. Each is
 * about as long as the movement reads — a shake is a jolt, a colour is a change
 * the eye follows — and a round is how often a pulse, a tremor or a wave comes
 * again.
 */
export const EFFECT_STARTS: Record<string, number> = {
  'shake': 500,
  'from-blur': 1500,
  'from-white': 1200,
  'into-colour': 3000,
  'out-of-colour': 3000,
  'closing-in': 2500,
  'scramble': 1200,
  'pulse': 900,
  'tremor': 400,
  'wave': 1600,
}

/** The time an Effect holds, which is nothing for a flicker and for grain. */
export function effectTime(effect: Arrival | Lasting) {
  return 'over' in effect ? effect.over : 'every' in effect ? effect.every : undefined
}

/**
 * The whole Effect an answer chosen writes, at the strength the words already had
 * or *Marked*, and from the time it starts at, because a half-written Effect is one
 * the door refuses. Read by the Shot's row and by the toolbar alike.
 */
export function effectWritten(effect: string, kind: 'arrives' | 'lasts', strength: Strength): Arrival | Lasting {
  const start = EFFECT_STARTS[effect]
  return (start === undefined
    ? { effect, strength }
    : { effect, [kind === 'arrives' ? 'over' : 'every']: start, strength }) as Arrival | Lasting
}

/**
 * A field of seconds read back as the milliseconds the column holds, and nothing
 * at all where it says no duration. Two things say none. A box left empty is an
 * Author in the middle of typing, and it is left as they left it. A nought is not
 * a duration either — a Shot standing for no time is a Shot nobody sees — and it
 * is the answer above the field rather than a value in it: *at the press*, *not at
 * all*, *hard*. Each of those is a sentence a `<select>` writes, and
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` says the sentinel
 * behind it is picked and never typed, so the field hands a typed nought straight
 * back and puts the time the row is still holding in its place. What is judged is
 * the millisecond the column would hold rather than the number in the box, so a
 * tenth of one is the nought it rounds to.
 *
 * A time past its cap or under its floor is written and refused by its own
 * phrase, because a refusal says more than a field that silently kept what it had. A nought has no refusal
 * to be given, because the doors take it: it is what a Shot's `cutAfter` and a
 * Scene's `exitsAfter` and `cutOver` hold when the answer above says so, and no
 * door can tell one typed here from one picked there. A Scene's `cutAfter` is the
 * one nought closed at both ends, because its column cannot hold one at all: the
 * door at `readSceneChanges` refuses it with a phrase of its own.
 */
export function secondsWritten(event: Event, stood: number | null) {
  const field = event.target as HTMLInputElement
  const written = Math.round(field.valueAsNumber * 1000)

  if (written) return written
  if (stood && !Number.isNaN(field.valueAsNumber)) field.value = String(stood / 1000)

  return undefined
}
