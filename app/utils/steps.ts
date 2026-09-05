/**
 * The guided path: what the bench asks of an Author writing their first Story,
 * one step at a time.
 *
 * A Step is a predicate over the Story the bench already holds, never a listener
 * on what the Author did, and the Story is the whole of what it reads. The editor
 * fetches the whole Story and reads it back after every write, so a Step asks a
 * question of that data — this Story has at least one Scene — and is therefore
 * idempotent, survives a reload, and cannot disagree with the screen. Nothing
 * stores progress, because the Story is the progress: see
 * `docs/adr/0020-progress-is-the-story.md`.
 *
 * A Step whose target is in the writing surface is asked for whether or not that
 * surface is open, because every gesture that makes a Scene opens it: the bubble
 * carries the sentence adrift until the Author is looking at the thing it names,
 * and no Step is spent asking them to look.
 *
 * Which is also why every Step but the first points into that surface. There is
 * always a Scene on the bench, its document under the Graph, and the Graph takes
 * no gesture but a press on a node — so a target anywhere else would be a Step
 * asking for something that cannot be done from where the Author is standing.
 * `tests/unit/steps.spec.ts` holds that too.
 *
 * The Steps are met in whatever order the Author arrives at them, and nothing
 * blocks or scolds. Because a bubble can only point at one thing, the one showing
 * is the first unmet — which makes the order of the list below a design decision
 * rather than an internal detail.
 *
 * Each Step names the element it points at by the `data-step` attribute that
 * element carries in the editor's own template, rather than by a selector held
 * here that would rot silently when a class is renamed. `tests/unit/steps.spec.ts`
 * holds the two sides against each other; see
 * `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.
 */
import type { StoryInEditor } from '../../shared/utils/scenes'

export type Step = {
  /**
   * What the Step is called, which is also the message key its sentence is
   * written under in both languages: `step.nameScene`.
   */
  name: string
  /** The `data-step` attribute of the element in the editor this Step points at. */
  target: string
  /** Whether the Story on the bench already holds what this Step asks for. */
  met: (story: StoryInEditor) => boolean
}

export const STEPS: Step[] = [
  // The only thing a Story cannot be without, so it is the only thing asked for
  // before anything else exists to point at — and the one control on the bench
  // that makes a Scene out of nothing, since every Scene after the first is
  // written as the far end of a way on out of a Scene that exists, and there is
  // none yet to write one from.
  { name: 'nameScene', target: 'first-scene', met: story => story.scenes.length > 0 },
  // Written rather than merely added, and written is text: a Shot is asked for
  // here as the beat it carries, so an image attached to an empty one has not met
  // this. The sentence carries the whole gesture, because a Scene the API writes
  // arrives with no Shot in it to point at.
  { name: 'writeShot', target: 'shot-text', met: written },
  // The thesis of the product, and one Step rather than two: a way on to a Scene
  // that is not there yet writes the second Scene and the Exit joining it in one
  // act, so a Step asking for the Scene first would be met by the same act as the
  // one after it and could never be shown alone. The Author is asked for the
  // second Scene and the way on together, in the sentence.
  //
  // Asked for at the foot of the Scene's own document, where a way on is written
  // by naming the Scene it leads to — the one route there is, see
  // `docs/adr/0034-a-story-is-written-without-the-canvas.md` and
  // `docs/adr/0041-the-graph-is-drawn-from-the-story.md`.
  //
  // Any Exit at all, rather than one from the first Scene to the second: the
  // sentence asks for the one the Story needs, and an Author who wrote it the
  // other way round has joined two Scenes and is not told they did it wrong.
  { name: 'wayOn', target: 'way-on', met: story => story.exits.length > 0 },
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
  // puts it right is the next Step.
  {
    name: 'putCondition',
    target: 'shot-condition',
    met: story => Boolean(conditionTaught(story)),
  },
  // A Story is allowed to sit with no opening Scene — the Author decides where
  // their Story starts, which is why the radio is drawn on every node — and the
  // one way to arrive there is to delete the Scene the Story opened on. Asked
  // for here because this is where the path stops being about writing and starts
  // being about reading: the two steps left send the Author to the Preview beside
  // the Scene and to Publish, and both of them refuse a Story that has nowhere to
  // start. Met
  // by every Story that never lost its opening, so the ordinary path never sees
  // it. The sentence carries the whole gesture the way the Condition's does: the
  // mark is set in the panel, and this is the one Step that can be arrived at with
  // no Scene in it, so it may not say "here".
  {
    name: 'openingScene',
    target: 'opening-scene',
    met: story => Boolean(story.openingSceneId),
  },
  // What puts the broken Condition right, and the one Step that asks for nothing
  // to be written: the Preview is the pane beside the Scene — see
  // `docs/adr/0030-a-story-is-read-where-it-is-written.md` — so it is already on
  // screen, and what is asked for is that the Author read it. It says the Shot
  // was skipped and what the test asked for against what the State holds; the
  // correction goes back into the Condition. Reading is not tracked — whether the
  // Author looked is not a property of the Story and nothing here stores anything
  // — so the predicate is only the end of the gesture, and an Author who fixed
  // the value without reading a word is not stuck.
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
 * and neither is a visit count, which the Sample teaches instead.
 *
 * `holding` asks the same question of the value as well: not merely a Flag that
 * is set, but the value it is set to, which is the Condition the Author corrected
 * after the Preview explained why the Shot did not play.
 *
 * Any Scene setting it to that value counts, the same way any Scene setting a
 * Flag at all meets the Step before this one. Asking whether the value is the one
 * the second Scene actually arrives holding would mean running the Reading engine
 * from the opening Scene — which is what the Preview is for, and far more than a
 * predicate over the Story on the bench. The cost of the lenient reading is a
 * Story whose fourth Scene sets the same Flag to the value its second tests: the
 * Step reads as met while a Reader still never plays that Shot. The cost of the
 * strict one is the whole engine in here, and an Author told they are wrong when
 * they are not.
 */
function conditionTaught(story: StoryInEditor, holding = false) {
  const flagsSet = story.scenes.flatMap(scene => Object.entries(scene.sets))

  // A Flag the Scene draws from several values counts where any one of them is
  // the value tested, for the same lenient reading: which one a Reading is shown
  // is the engine's answer and not a predicate's.
  return story.scenes[1]?.shots
    .flatMap(shot => shot.conditions)
    .find(condition => 'flag' in condition && flagsSet.some(([flag, held]) =>
      flag === condition.flag && (!holding || [held].flat().includes(condition.is))))
}

/**
 * The Step the bench is showing: the first one this Story has not met, and nothing
 * at all once every one of them has. A Story that arrives finished — a Sample, or
 * the Author's fourth — therefore asks nothing.
 */
export function stepShowing(story: StoryInEditor) {
  return STEPS.find(step => !step.met(story))
}

/**
 * What every key a dismissal is remembered under starts with. Exported because
 * the end-to-end suite waves the guidance away for every Story at once and
 * cannot know their ids beforehand, and a prefix taken by calling `dismissalOf`
 * with nothing would depend on this ending in a separator without saying so.
 */
export const DISMISSED = 'frameline.step-dismissed.'

/**
 * Where a browser remembers that this Story's guidance was dismissed. Kept per
 * Story rather than once for the Author: knowing what you are doing today does
 * not mean the Story started in six months' time should be left unguided.
 */
export function dismissalOf(storyId: string) {
  return `${DISMISSED}${storyId}`
}
