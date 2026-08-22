import type { Condition, Cut, Flags, Shot } from './scenes'

/**
 * A Story as a Reader receives it. Narrower than the Story an Author edits — no
 * title, no graph placement — so the engine reads nothing it has no business
 * reading, and a test can state a Story in a few lines.
 */
export type StoryToRead = {
  openingSceneId: string | null
  scenes: { id: string, sets: Flags, shots: Shot[] }[]
  cuts: Cut[]
}

/**
 * A Story as a screen shows it, whether the screen is an Author's Preview or a
 * Reader's Reading: the engine's Story, plus the name of each Scene. The name is
 * there for a Cut nobody has phrased yet, which has to stay takeable — a Reading
 * that cannot go on is worse than one offered a Cut named after where it lands.
 */
export type StoryToShow = Omit<StoryToRead, 'scenes'> & {
  scenes: { id: string, name: string, sets: Flags, shots: Shot[] }[]
}

/**
 * Where one Reading has got to: the Cuts it has taken, in order, and how many
 * Shots of the Scene it is standing in have been left behind. Everything else —
 * which Scene that is, what is on screen, what State has accumulated — is
 * computed from it, so a Reading is this much and nothing more. Two Readings of
 * the same Story that took the same Cuts are the same Reading, which is what
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
 * Whether the Conditions a Cut or a Shot carries all pass against this State —
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
 * Why a Cut is not on offer, or a Shot not played: one line for each test it
 * carries that this State fails, saying what the test asked for and what the
 * State actually holds. For
 * an Author's eyes alone — a Reader is never told what they are not being
 * offered — so the Scene a Condition counts is named rather than shown as the id
 * the Condition holds.
 *
 * Every test is put back through `holds` one at a time rather than read a second
 * time here, so what this says failed and what the engine hid the Cut for cannot
 * come apart.
 */
export function unmet(conditions: Condition[], state: State, sceneName: (id: string) => string) {
  return conditions.filter(condition => !holds([condition], state)).map((condition) => {
    if ('flag' in condition) {
      return `needs ${condition.flag} to hold ${condition.is || 'nothing'}`
        + `, holds ${state.flags[condition.flag] || 'nothing'}`
    }

    const asked = `${condition.times} ${condition.times === 1 ? 'visit' : 'visits'}`
    return `needs ${condition.visits} ${asked} to ${sceneName(condition.scene)}`
      + `, ${entered(state.visits[condition.scene] ?? 0)}`
  })
}

/** How often a Scene has been entered, said the way it would be said out loud. */
function entered(visits: number) {
  if (visits === 0) return 'never entered'
  return visits === 1 ? 'entered once' : `entered ${visits} times`
}

/** Every Reading starts here: the opening Scene, first Shot, nothing taken. */
export const OPENING: Position = { taken: [], shot: 0 }

/**
 * What the Reader is shown at one point in a Reading — a screenful, not the
 * Reading itself, which is the Position: the Shot on screen, or —
 * once the Shots of the Scene have run out — the Cuts on offer. Never both, so
 * the Scene plays to its end before it asks anything. `ended` is the path
 * reaching its end: no Shot left and no Cut out, which the Reader is owed as an
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
  cuts: Cut[]
  ended: boolean
  state: State
}

/**
 * Walks the taken Cuts from the opening Scene, accumulating State on the way:
 * every arrival is counted and sets the Flags of the Scene it arrives at, so the
 * State a Cut is judged against is the one the Reader had when they were offered
 * it. A Cut that does not leave the Scene the Reading stands in, or whose
 * Conditions did not all hold there, is not one it could have been offered — a
 * stale link, or a hand-written one — and stops the walk where it is rather than
 * teleporting the Reader.
 *
 * The walk is as long as the Cuts taken, never as long as the Story's cycles, so
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
    const cut = story.cuts.find(cut =>
      cut.id === takenId && cut.fromSceneId === sceneId && holds(cut.conditions, state))
    if (!cut) break
    sceneId = cut.toSceneId
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
  // A Story with no opening Scene has no Cuts to offer either, so the empty
  // Scene and the missing one both end the path. A Cut one of whose Conditions
  // fails is not among them, which is what makes it invisible rather than
  // refused.
  const cuts = shot
    ? []
    : story.cuts.filter(cut => cut.fromSceneId === sceneId && holds(cut.conditions, state))

  return { sceneId, run, shot, cuts, ended: !shot && cuts.length === 0, state }
}

/** The Reader asks for the next Shot of the Scene. */
export function advance(at: Position): Position {
  return { ...at, shot: at.shot + 1 }
}

/** The Reader takes one of the Cuts on offer, and the Scene it arrives at starts over. */
export function take(at: Position, cut: Cut): Position {
  return { taken: [...at.taken, cut.id], shot: 0 }
}
