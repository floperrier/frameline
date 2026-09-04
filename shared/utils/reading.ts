import type { Condition, Exit, Flags, Sets, Shot } from './scenes'
import type { Phrase } from './phrases'

/**
 * A Story as a Reader receives it. Narrower than the Story an Author edits — no
 * title, no graph placement — so the engine reads nothing it has no business
 * reading, and a test can state a Story in a few lines.
 */
export type StoryToRead = {
  openingSceneId: string | null
  scenes: { id: string, sets: Sets, shots: Shot[] }[]
  exits: Exit[]
}

/**
 * A Story as a screen shows it, whether the screen is an Author's Preview or a
 * Reader's Reading: the engine's Story, plus the name of each Scene. The name is
 * there for an Exit nobody has phrased yet, which has to stay takeable — a Reading
 * that cannot go on is worse than one offered an Exit named after where it lands.
 */
export type StoryToShow = Omit<StoryToRead, 'scenes'> & {
  scenes: { id: string, name: string, sets: Sets, shots: Shot[] }[]
}

/**
 * Where one Reading has got to: the Exits it has taken, in order, and how many
 * Shots of the Scene it is standing in have been left behind. Everything else —
 * which Scene that is, what is on screen, what State has accumulated — is
 * computed from it, so a Reading is this much and nothing more. Two Readings of
 * the same Story that took the same Exits are the same Reading, which is what
 * makes the engine a pure function and the whole of it testable.
 *
 * The seed is what every draw a Scene makes comes out of. It is a part of the
 * Path rather than a term of its own — see
 * `docs/adr/0024-the-seed-belongs-to-the-position.md` — because a Reading is its
 * Path and nothing else: a seed kept anywhere else would make `reading()`
 * impure, and two Readings that took the same Exits under the same seed would
 * stop being the same Reading.
 */
export type Path = { seed: number, taken: string[], shot: number }

/**
 * Everything one Reading has accumulated: what each Flag holds, and how often
 * each Scene has been entered. Computed from the Path on every read and kept
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

/**
 * Every Reading starts here: the opening Scene, first Shot, nothing taken, and a
 * seed drawn for it. Drawing that seed is the one impure moment in the whole
 * engine, and it happens here — called by whatever starts a Reading — rather than
 * inside `reading()`, which stays a pure function of the Path it is handed.
 * A seed may be passed in, which is what a test states and what a reroll
 * replaces.
 */
export function opening(seed = Math.floor(Math.random() * 2 ** 32)): Path {
  return { seed, taken: [], shot: 0 }
}

/**
 * Where a Reading stands before a seed has been drawn for it: the opening
 * Path under a seed of none. A screen renders on the server and then again in
 * the browser hydrating it, and a seed drawn twice would be two different
 * Stories either side of that — so the screens start here, and draw once the
 * Reading is in the browser it will stay in.
 */
export const UNDRAWN: Path = opening(0)

/**
 * The same Path under a different draw: the Author's reroll. Nothing about
 * where the Reading has got to changes, so the Exits taken and the Shot on screen
 * are the ones they were — what changes is which value every draw comes out
 * with, which is the whole of the control the Preview offers.
 */
export function rerolled(at: Path): Path {
  return { ...at, seed: opening().seed }
}

/**
 * Which of the values a Scene names for a Flag this Reading is shown. Hashed from
 * the seed, the Scene, how many times this Reading has entered it, and the Flag's
 * name — the four things that identify the draw — so each draw is independent of
 * every other: a Shot added upstream, or one skipped by a Condition, leaves it
 * where it was, and a Path replayed after an edit shows the Story it showed.
 * A sequential generator threaded through the walk would shift every later draw
 * instead; see `docs/adr/0024-the-seed-belongs-to-the-position.md`.
 */
function drawn(seed: number, sceneId: string, visits: number, flag: string, values: string[]) {
  return values[hashed(`${seed}:${sceneId}:${visits}:${flag}`) % values.length]!
}

/**
 * A number out of a string, spread evenly enough over its range that a list of
 * six is reached at all six ends. FNV-1a over the bytes, then murmur's final
 * mix, which is what carries the difference between two nearly equal keys — one
 * entry to a Scene and the next — up into the bits a small remainder reads. A few
 * lines written here rather than a dependency pulled in, on the grounds of
 * `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`.
 */
function hashed(key: string) {
  let hash = 0x811C9DC5
  for (let at = 0; at < key.length; at++) {
    hash = Math.imul(hash ^ key.charCodeAt(at), 0x01000193)
  }

  hash = Math.imul(hash ^ (hash >>> 16), 0x21F0AAAD)
  hash = Math.imul(hash ^ (hash >>> 15), 0x735A2D97)

  return (hash ^ (hash >>> 15)) >>> 0
}

/**
 * What the Reader is shown at one point in a Reading — a screenful, not the
 * Reading itself, which is the Path: the Shot on screen, or —
 * once the Shots of the Scene have run out — the Exits on offer. Never both, so
 * the Scene plays to its end before it asks anything. `ended` is the Path
 * reaching its end: no Shot left and no Exit out, which the Reader is owed as an
 * ending rather than a screen that has simply stopped answering.
 *
 * `run` is the Shots of that Scene this Reading plays — the Author's run minus
 * the ones a Condition skips — which is what the Path counts and what the
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
 *
 * A Flag the Scene gives several values is drawn here, where a Scene already sets
 * its Flags: the draw is made before anything is judged, so the State an Exit or
 * a Shot is held against is the one the Reader arrived with. It is keyed on the
 * count of entries, so a Scene read a second time draws again and a Story that
 * loops is worth looping through.
 */
function walk(story: StoryToRead, { seed, taken }: Path) {
  const state: State = { flags: {}, visits: {} }

  function enter(id: string) {
    const visits = (state.visits[id] = (state.visits[id] ?? 0) + 1)
    const sets = story.scenes.find(scene => scene.id === id)?.sets ?? {}

    for (const [flag, held] of Object.entries(sets)) {
      state.flags[flag] = Array.isArray(held) ? drawn(seed, id, visits, flag, held) : held
    }
  }

  let sceneId = story.openingSceneId
  if (sceneId) enter(sceneId)

  // How many of the taken Exits the walk got through, which is how `resumes`
  // tells a Path that still fits the Story from one the Story has moved under.
  let walked = 0
  for (const takenId of taken) {
    const exit = story.exits.find(exit =>
      exit.id === takenId && exit.fromSceneId === sceneId && holds(exit.conditions, state))
    if (!exit) break
    sceneId = exit.toSceneId
    enter(sceneId)
    walked++
  }

  return { sceneId, state, walked }
}

/**
 * Whether a Path kept from an earlier visit is one to put the Reader back at.
 * It is not where nothing has been read yet — there is nothing to come back to
 * — nor at an ending, which is a place to leave from rather than be returned to.
 * And it is not where the Story has moved underneath it since: an Exit taken
 * that is no longer there, or no longer offered to this Reading, stops the walk
 * short, and a Shot count past the run means Shots were taken away. Either
 * would drop the Reader somewhere they never stood, so the Story starts over
 * instead. See `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`.
 */
export function resumes(story: StoryToRead, at: Path) {
  if (at.taken.length === 0 && at.shot === 0) return false
  if (walk(story, at).walked < at.taken.length) return false

  const { run, ended } = reading(story, at)
  return !ended && at.shot <= run.length
}

/** What this Story shows a Reading that has taken this Path. */
export function reading(story: StoryToRead, at: Path): Shown {
  const { sceneId, state } = walk(story, at)
  // The run this Reading plays, judged against the State it arrived with: a Shot
  // whose Conditions fail is left out of the run rather than played to nobody,
  // so the Path counts the beats the Reader actually saw and the one after
  // the skipped Shot is the next one on screen. Judged once for the whole Scene,
  // because nothing inside a Scene changes State — only entering one does.
  const run = story.scenes.find(scene => scene.id === sceneId)
    ?.shots.filter(shot => holds(shot.conditions, state)) ?? []
  const shot = run[at.shot]
  // A Story with no opening Scene has no Exits to offer either, so the empty
  // Scene and the missing one both end the Path. An Exit one of whose Conditions
  // fails is not among them, which is what makes it invisible rather than
  // refused.
  const exits = shot
    ? []
    : story.exits.filter(exit => exit.fromSceneId === sceneId && holds(exit.conditions, state))

  return { sceneId, run, shot, exits, ended: !shot && exits.length === 0, state }
}

/** The Reader asks for the next Shot of the Scene. */
export function advance(at: Path): Path {
  return { ...at, shot: at.shot + 1 }
}

/** The Reader takes one of the Exits on offer, and the Scene it arrives at starts over. */
export function take(at: Path, exit: Exit): Path {
  return { ...at, taken: [...at.taken, exit.id], shot: 0 }
}

/**
 * A Path that arrives at one Scene, so that a Reading can be stopped on the Scene
 * an Author is writing. Searched for rather than stated, because a Scene has no
 * Path of its own: which Exits a Reader takes to reach it depends on the State
 * they accumulated on the way, and a Scene played with no State behind it is a
 * Scene that exists for nobody — see
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md`.
 *
 * The search starts from where the Reading already stands, so an Author who is
 * three Scenes in keeps what those three Scenes set; nothing at all comes back
 * when the Scene cannot be reached from there, and the caller asks again from the
 * opening. A Scene nothing leads to is reached from neither, which is a fact
 * about the Story the pane says out loud.
 *
 * It is the engine walking its own Story: every step is `reading` for the State,
 * `holds` for whether an Exit was on offer, and `take` for the Path that results —
 * so what this can reach and what a Reader can reach cannot come apart. The
 * breadth-first order makes the answer the shortest way there, which is the one an
 * Author reads the fewest Scenes to arrive at.
 *
 * A Scene is passed once for each set of Flags it has been arrived holding,
 * rather than once outright: a Story that loops back to set a Flag and returns is
 * a Story whose second arrival opens ways on the first did not.
 */
export function pathTo(story: StoryToRead, from: Path, sceneId: string): Path | undefined {
  const seen = new Set<string>()
  // ponytail: each step walks the whole Path again, so the search is quadratic in
  // the Exits it takes. A Story an Author is writing is small; measure it the day
  // one is not.
  let edge = [from]

  while (edge.length) {
    const next: Path[] = []

    for (const at of edge) {
      const { sceneId: standing, state } = reading(story, at)
      if (standing === sceneId) return at
      if (!standing) continue

      const arrivedAs = `${standing}:${JSON.stringify(state.flags)}`
      if (seen.has(arrivedAs)) continue
      seen.add(arrivedAs)

      for (const exit of story.exits) {
        if (exit.fromSceneId !== standing || !holds(exit.conditions, state)) continue
        next.push(take(at, exit))
      }
    }

    edge = next
  }
}
