/**
 * The guided path: what the bench asks of an Author writing their first Story,
 * one step at a time.
 *
 * A Cue is a predicate over the Story the bench already holds, never a listener
 * on what the Author did. The one thing it reads besides the Story is which
 * nodes the Author has open, because no Cue may point into one they have
 * folded. The editor fetches the whole Story and reads it back after every
 * write, so a Cue asks a question of that data — this Story has at least one
 * Scene — and is therefore idempotent, survives a reload, and cannot disagree
 * with the screen. Nothing stores progress, because the Story is the
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
  /**
   * The `data-cue` attribute of the element in the editor this Cue points at.
   * Two Cues may name the same one — the second Scene is asked for in the field
   * the first was named in.
   */
  target: string
  /**
   * Whether the bench already holds what this Cue asks for: the Story, and which
   * of its nodes the Author has open. What is folded is the one thing a Cue asks
   * about that is not in the Story — it is how the Author is looking at their own
   * work and is never written anywhere — and a Cue may not point into a node the
   * Author has folded, so opening one is a step like the rest.
   */
  met: (story: StoryInEditor, opened: ReadonlySet<string>) => boolean
  /**
   * Which Scene's node the target is looked for in, where the target is one the
   * editor draws once per node and the Cue asks about a particular Scene. Without
   * it the first node of the graph is the one pointed at, which is the first Scene
   * the Author wrote and where most of the path is walked. A Cue naming a Scene
   * the Story has not got yet points at nothing, and the bubble goes adrift.
   */
  within?: (story: StoryInEditor) => string | undefined
}

export const CUES: Cue[] = [
  // The only thing a Story cannot be without, so it is the only thing asked for
  // before anything else exists to point at.
  { name: 'nameScene', target: 'new-scene-name', met: story => story.scenes.length > 0 },
  // Nothing inside a Scene can be pointed at while its node is folded, so the
  // node is opened by the Author before anything in it is asked for — and only
  // for the sake of what is written in it, so a Story whose Shots are already
  // written is never asked to open anything. A Leader, which arrives finished
  // with every node folded, is asked nothing at all.
  {
    name: 'openScene',
    target: 'open-scene',
    met: (story, opened) => story.scenes.some(scene => opened.has(scene.id)) || written(story),
  },
  // Written rather than merely added, and written is text: a Shot is asked for
  // here as the beat it carries, so a still attached to an empty one has not met
  // this. The sentence carries the whole gesture, because a Scene the API writes
  // arrives with no Shot in it to point at.
  { name: 'writeShot', target: 'shot-text', met: written },
  // The thesis of the product, in the order it can be shown in: a second Scene
  // first, because a Cut needs somewhere to land.
  { name: 'secondScene', target: 'new-scene-name', met: story => story.scenes.length > 1 },
  // Any Cut at all, rather than one from the first Scene to the second: the
  // sentence asks for the one the Story needs, and an Author who drew it the
  // other way round has joined two Scenes and is not told they did it wrong.
  { name: 'drawCut', target: 'draw-cut', met: story => story.cuts.length > 0 },
  // Where State comes from, asked for on the first Scene because that is where a
  // Reading starts and so the one place a Flag is certain to have been set by the
  // time the second Scene plays. Any Flag on any Scene meets it, though: an
  // Author who set one somewhere else has set a Flag and is not told they did it
  // wrong.
  {
    name: 'setFlag',
    target: 'scene-flags',
    met: story => story.scenes.some(scene => Object.keys(scene.sets).length > 0),
  },
  // The thesis the product exists for: a Scene plays differently without
  // branching. Asked for on the second Scene, where a Flag the first sets is
  // already in State, and asked for broken on purpose — the sentence names a
  // value the Flag does not hold, so the Preview has something to explain. What
  // puts it right is the next Cue.
  {
    name: 'putCondition',
    target: 'shot-condition',
    within: story => story.scenes[1]?.id,
    met: story => Boolean(conditionTaught(story)),
  },
]

/** Whether anything has been written in this Story yet: one Shot carrying text. */
function written(story: StoryInEditor) {
  return story.scenes.some(scene => scene.shots.some(shot => shot.text.trim()))
}

/**
 * The Condition the guided path asked for: one on a Shot of the second Scene
 * testing a Flag that some Scene of this Story actually sets. A Condition naming
 * a Flag nothing sets is not the one that was asked for — it would test the
 * absence of a Flag, which is a thing an Author can mean but is not this lesson —
 * and neither is a visit count, which the Leader teaches instead.
 */
function conditionTaught(story: StoryInEditor) {
  const set = new Set(story.scenes.flatMap(scene => Object.keys(scene.sets)))

  return story.scenes[1]?.shots
    .flatMap(shot => shot.conditions)
    .find(condition => 'flag' in condition && set.has(condition.flag))
}

/**
 * The Cue the bench is showing: the first one this Story has not met, and nothing
 * at all once every one of them has. A Story that arrives finished — a Leader, or
 * the Author's fourth — therefore asks nothing.
 */
export function cueShowing(story: StoryInEditor, opened: ReadonlySet<string>) {
  return CUES.find(cue => !cue.met(story, opened))
}

/**
 * What every key a dismissal is remembered under starts with. Exported because
 * the end-to-end suite waves the guidance away for every Story at once and
 * cannot know their ids beforehand, and a prefix taken by calling `dismissalOf`
 * with nothing would depend on this ending in a separator without saying so.
 */
export const DISMISSED = 'frameline.cue-dismissed.'

/**
 * Where a browser remembers that this Story's guidance was dismissed. Kept per
 * Story rather than once for the Author: knowing what you are doing today does
 * not mean the Story started in six months' time should be left unguided.
 */
export function dismissalOf(storyId: string) {
  return `${DISMISSED}${storyId}`
}
