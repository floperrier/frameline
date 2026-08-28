import type { Condition, Exit, Flags, Shot } from './scenes'
import type { Phrase } from './phrases'

/**
 * A Story as a Reader receives it. Narrower than the Story an Author edits — no
 * title, no graph placement — so the engine reads nothing it has no business
 * reading, and a test can state a Story in a few lines.
 */
export type StoryToRead = {
  openingSceneId: string | null
  scenes: { id: string, sets: Flags, shots: Shot[] }[]
  exits: Exit[]
}

/**
 * A Story as a screen shows it, whether the screen is an Author's Preview or a
 * Reader's Reading: the engine's Story, plus the name of each Scene. The name is
 * there for an Exit nobody has phrased yet, which has to stay takeable — a Reading
 * that cannot go on is worse than one offered an Exit named after where it lands.
 */
export type StoryToShow = Omit<StoryToRead, 'scenes'> & {
  scenes: { id: string, name: string, sets: Flags, shots: Shot[] }[]
}

/**
 * Where one Reading has got to: the Exits it has taken, in order, and how many
 * Shots of the Scene it is standing in have been left behind. Everything else —
 * which Scene that is, what is on screen, what State has accumulated — is
 * computed from it, so a Reading is this much and nothing more. Two Readings of
 * the same Story that took the same Exits are the same Reading, which is what
 * makes the engine a pure function and the whole of it testable.
 */
export type Position = { taken: string[], shot: number }

/**
 * Everything one Reading has accumulated: what each Flag holds, and how often
 * each Scene has been entered. Computed from the Position on every read and kept
 * nowhere, so no two Readings can reach the same State.
 */
export type State = { flags: Flags, visits: Record<string, number> }

/**
 * Whether the Conditions an Exit or a Shot carries all pass against this State —
 * one carrying none being always offered, or always played. One comparison a
 * Condition, an `every` over them, and no recursion: a Condition is flat by
 * construction, so this is the whole of the language.
 */
export function holds(conditions: Condition[], state: State) {
  return conditions.every((condition) => {
    if ('flag' in condition) return (state.flags[condition.flag] ?? '') === condition.is

    const visits = state.visits[condition.scene] ?? 0
    return condition.visits === 'at least' ? visits >= condition.times : visits < condition.times
  })
}

/**
 * Why an Exit is not on offer, or a Shot not played: one line for each test it
 * carries that this State fails, saying what the test asked for and what the
 * State actually holds. For
 * an Author's eyes alone — a Reader is never told what they are not being
 * offered — so the Scene a Condition counts is named rather than shown as the id
 * the Condition holds.
 *
 * Every test is put back through `holds` one at a time rather than read a second
 * time here, so what this says failed and what the engine hid the Exit for cannot
 * come apart. The words come in from outside — see `Phrase` — so the engine
 * stays a pure function of its Story and knows nothing about a language.
 */
export function unmet(
  conditions: Condition[],
  state: State,
  sceneName: (id: string) => string,
  say: Phrase,
) {
  return conditions.filter(condition => !holds([condition], state)).map((condition) => {
    if ('flag' in condition) {
      return say('preview.needsFlag', {
        flag: condition.flag,
        is: condition.is || say('preview.nothing'),
        holds: state.flags[condition.flag] || say('preview.nothing'),
      })
    }

    return say('preview.needsVisits', {
      how: say(condition.visits === 'at least' ? 'conditions.atLeast' : 'conditions.fewerThan'),
      count: say(
        condition.times === 1 ? 'preview.oneVisit' : 'preview.manyVisits',
        { times: condition.times },
      ),
      scene: sceneName(condition.scene),
      entered: entered(state.visits[condition.scene] ?? 0, say),
    })
  })
}

/**
 * How often a Scene has been entered, said the way it would be said out loud.
 * Three phrases rather than one with a number in it, because English and French
 * do not agree about what a count of one and a count of none look like, and a
 * plural engine to settle three sentences is a plural engine to keep.
 */
function entered(visits: number, say: Phrase) {
  if (visits === 0) return say('preview.neverEntered')
  return visits === 1 ? say('preview.enteredOnce') : say('preview.enteredTimes', { visits })
}

/** Every Reading starts here: the opening Scene, first Shot, nothing taken. */
export const OPENING: Position = { taken: [], shot: 0 }

/**
 * What the Reader is shown at one point in a Reading — a screenful, not the
 * Reading itself, which is the Position: the Shot on screen, or —
 * once the Shots of the Scene have run out — the Exits on offer. Never both, so
 * the Scene plays to its end before it asks anything. `ended` is the path
 * reaching its end: no Shot left and no Exit out, which the Reader is owed as an
 * ending rather than a screen that has simply stopped answering.
 *
 * `run` is the Shots of that Scene this Reading plays — the Author's run minus
 * the ones a Condition skips — which is what the Position counts and what the
 * screen numbers the beat against. It is here rather than read off the Scene
 * because the Scene alone cannot say it: the same Scene is a different run to a
 * Reading that has been there before.
 */
export type Shown = {
  sceneId: string | null
  run: Shot[]
  shot: Shot | undefined
  exits: Exit[]
  ended: boolean
  state: State
}

/**
 * Walks the taken Exits from the opening Scene, accumulating State on the way:
 * every arrival is counted and sets the Flags of the Scene it arrives at, so the
 * State an Exit is judged against is the one the Reader had when they were offered
 * it. An Exit that does not leave the Scene the Reading stands in, or whose
 * Conditions did not all hold there, is not one it could have been offered — a
 * stale link, or a hand-written one — and stops the walk where it is rather than
 * teleporting the Reader.
 *
 * The walk is as long as the Exits taken, never as long as the Story's cycles, so
 * a Story that comes back on itself is read round and round without the engine
 * ever looping forever.
 */
function walk(story: StoryToRead, taken: string[]) {
  const state: State = { flags: {}, visits: {} }

  function enter(id: string) {
    state.visits[id] = (state.visits[id] ?? 0) + 1
    Object.assign(state.flags, story.scenes.find(scene => scene.id === id)?.sets)
  }

  let sceneId = story.openingSceneId
  if (sceneId) enter(sceneId)

  for (const takenId of taken) {
    const exit = story.exits.find(exit =>
      exit.id === takenId && exit.fromSceneId === sceneId && holds(exit.conditions, state))
    if (!exit) break
    sceneId = exit.toSceneId
    enter(sceneId)
  }

  return { sceneId, state }
}

/** What this Story shows a Reading standing at this Position. */
export function reading(story: StoryToRead, at: Position): Shown {
  const { sceneId, state } = walk(story, at.taken)
  // The run this Reading plays, judged against the State it arrived with: a Shot
  // whose Conditions fail is left out of the run rather than played to nobody,
  // so the Position counts the beats the Reader actually saw and the one after
  // the skipped Shot is the next one on screen. Judged once for the whole Scene,
  // because nothing inside a Scene changes State — only entering one does.
  const run = story.scenes.find(scene => scene.id === sceneId)
    ?.shots.filter(shot => holds(shot.conditions, state)) ?? []
  const shot = run[at.shot]
  // A Story with no opening Scene has no Exits to offer either, so the empty
  // Scene and the missing one both end the path. An Exit one of whose Conditions
  // fails is not among them, which is what makes it invisible rather than
  // refused.
  const exits = shot
    ? []
    : story.exits.filter(exit => exit.fromSceneId === sceneId && holds(exit.conditions, state))

  return { sceneId, run, shot, exits, ended: !shot && exits.length === 0, state }
}

/** The Reader asks for the next Shot of the Scene. */
export function advance(at: Position): Position {
  return { ...at, shot: at.shot + 1 }
}

/** The Reader takes one of the Exits on offer, and the Scene it arrives at starts over. */
export function take(at: Position, exit: Exit): Position {
  return { taken: [...at.taken, exit.id], shot: 0 }
}
