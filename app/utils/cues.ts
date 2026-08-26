/**
 * The guided path: what the bench asks of an Author writing their first Story,
 * one step at a time.
 *
 * A Cue is a predicate over the Story the bench already holds, never a listener
 * on what the Author did. The one thing it reads besides the Story is which Scene
 * is in the panel at the edge of the bench, because no Cue may point into a panel
 * that is not open. The editor fetches the whole Story and reads it back after every
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
   * Scene is in the panel. The panel is the one thing a Cue asks about that is not
   * in the Story — it is how the Author is looking at their own work and is never
   * written anywhere — and a Cue may not point into a panel nobody has opened, so
   * writing a Scene is a step like the rest.
   */
  met: (story: StoryInEditor, writing?: string) => boolean
}

export const CUES: Cue[] = [
  // The only thing a Story cannot be without, so it is the only thing asked for
  // before anything else exists to point at.
  { name: 'nameScene', target: 'new-scene-name', met: story => story.scenes.length > 0 },
  // Nothing inside a Scene can be pointed at until the Scene is in the panel, so
  // the Author puts one there before anything in it is asked for — and only for
  // the sake of what is written in it, so a Story whose Shots are already written
  // is never asked to open the panel at all. A Leader, which arrives finished, is
  // asked nothing.
  {
    name: 'writeScene',
    target: 'write-scene',
    met: (story, writing) => Boolean(writing) || written(story),
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
    met: story => Boolean(conditionTaught(story)),
  },
  // A Story is allowed to sit with no opening Scene — the Author decides where
  // their Story starts, which is why the radio is drawn on every node — and the
  // one way to arrive there is to delete the Scene the Story opened on. Asked
  // for here because this is where the path stops being about writing and starts
  // being about reading: the two steps left send the Author to the Preview and
  // to Publish, and both of them refuse a Story that has nowhere to start. Met
  // by every Story that never lost its opening, so the ordinary path never sees
  // it. The sentence carries the whole gesture the way the Condition's does: the
  // mark is set in the panel, and this is the one Cue that can be arrived at with
  // no Scene in it, so it may not say "here".
  {
    name: 'openingScene',
    target: 'opening-scene',
    met: story => Boolean(story.openingSceneId),
  },
  // What puts the broken Condition right, and the one Cue whose sentence asks for
  // something outside the bench: open the Preview, watch the Shot not play, read
  // what the interface says the test asked for against what the State holds, and
  // come back and correct it. The trip through the Preview is instructed and not
  // tracked — whether the Author opened it is not a property of the Story and
  // nothing here stores anything — so the predicate is only the end of the
  // gesture, and an Author who fixed the value without ever previewing is not
  // stuck.
  {
    name: 'previewCondition',
    target: 'preview',
    met: story => Boolean(conditionTaught(story, true)),
  },
  // The reward rather than a lesson: a Story that works, handed out at a link
  // anybody can read.
  { name: 'publish', target: 'publish', met: story => Boolean(story.publishedAt) },
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
 *
 * `holding` asks the same question of the value as well: not merely a Flag that
 * is set, but the value it is set to, which is the Condition the Author corrected
 * after the Preview explained why the Shot did not play.
 *
 * Any Scene setting it to that value counts, the same way any Scene setting a
 * Flag at all meets the Cue before this one. Asking whether the value is the one
 * the second Scene actually arrives holding would mean running the Reading engine
 * from the opening Scene — which is what the Preview is for, and far more than a
 * predicate over the Story on the bench. The cost of the lenient reading is a
 * Story whose fourth Scene sets the same Flag to the value its second tests: the
 * Cue reads as met while a Reader still never plays that Shot. The cost of the
 * strict one is the whole engine in here, and an Author told they are wrong when
 * they are not.
 */
function conditionTaught(story: StoryInEditor, holding = false) {
  const flagsSet = story.scenes.flatMap(scene => Object.entries(scene.sets))

  return story.scenes[1]?.shots
    .flatMap(shot => shot.conditions)
    .find(condition => 'flag' in condition && flagsSet.some(([flag, value]) =>
      flag === condition.flag && (!holding || value === condition.is)))
}

/**
 * The Cue the bench is showing: the first one this Story has not met, and nothing
 * at all once every one of them has. A Story that arrives finished — a Leader, or
 * the Author's fourth — therefore asks nothing.
 */
export function cueShowing(story: StoryInEditor, writing?: string) {
  return CUES.find(cue => !cue.met(story, writing))
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
