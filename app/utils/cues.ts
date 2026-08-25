/**
 * The guided path: what the bench asks of an Author writing their first Story,
 * one step at a time.
 *
 * A Cue is a predicate over the Story the bench already holds, never a listener
 * on what the Author did. The editor fetches the whole Story and reads it back
 * after every write, so a Cue asks a question of that data — this Story has at
 * least one Scene — and is therefore idempotent, survives a reload, and cannot
 * disagree with the screen. Nothing stores progress, because the Story is the
 * progress: see `docs/adr/0020-progress-is-the-story.md`.
 *
 * The Cues are met in whatever order the Author arrives at them, and nothing
 * blocks or scolds. Because a bubble can only point at one thing, the one showing
 * is the first unmet — which makes the order of the list below a design decision
 * rather than an internal detail.
 *
 * Each Cue names the element it points at by the `data-cue` attribute that
 * element carries in the editor's own template, rather than by a selector held
 * here that would rot silently when a class is renamed. `tests/unit/cues.spec.ts`
 * holds the two sides against each other; see
 * `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.
 */
import type { StoryInEditor } from '../../shared/utils/scenes'

export type Cue = {
  /**
   * What the Cue is called, which is also the message key its sentence is
   * written under in both languages: `cue.nameScene`.
   */
  name: string
  /** The `data-cue` attribute of the element in the editor this Cue points at. */
  target: string
  /** Whether the Story already holds what this Cue asks for. */
  met: (story: StoryInEditor) => boolean
}

export const CUES: Cue[] = [
  // The only thing a Story cannot be without, so it is the only thing asked for
  // before anything else exists to point at.
  { name: 'nameScene', target: 'new-scene-name', met: story => story.scenes.length > 0 },
]

/**
 * The Cue the bench is showing: the first one this Story has not met, and nothing
 * at all once every one of them has. A Story that arrives finished — a Leader, or
 * the Author's fourth — therefore asks nothing.
 */
export function cueShowing(story: StoryInEditor) {
  return CUES.find(cue => !cue.met(story))
}

/**
 * Where a browser remembers that this Story's guidance was dismissed. Kept per
 * Story rather than once for the Author: knowing what you are doing today does
 * not mean the Story started in six months' time should be left unguided.
 */
export function dismissalOf(storyId: string) {
  return `frameline.cue-dismissed.${storyId}`
}
