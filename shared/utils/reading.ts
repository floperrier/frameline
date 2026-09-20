import type { Condition, CutThrough, Exit, Flags, Sets, Shot } from './scenes'
import type { Phrase } from './phrases'

/**
 * A Story as a Reader receives it. Narrower than the Story an Author edits — no
 * title, no graph placement — so the engine reads nothing it has no business
 * reading, and a test can state a Story in a few lines.
 */
export type StoryToRead = {
  openingSceneId: string | null
  scenes: {
    id: string
    sets: Sets
    shots: Shot[]
    sound: string | null
    soundOfSceneId: string | null
    transcript: string
    soundLoops: boolean
    /**
     * A Scene's Cut is what its Shots are cut as, resolved against each Shot's
     * own answer by `cut()` below. `exitsAfter` has three states: null waits
     * for the Reader to take a way on, a number counts down to the first one
     * offered, and nought never offers one at all — see
     * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
     */
    cutAfter: number | null
    cutOver: number
    cutThrough: CutThrough
    exitsAfter: number | null
  }[]
  exits: Exit[]
  /**
   * Whether a Reading steps back across an Exit that has not said otherwise.
   * It is on the Story rather than only on the Exit so that an Author says once
   * what their Story is like, and on the Exit as well so that one door can close
   * where the rest do not — one question, asked of the Exit, answered by the
   * Story where the Exit says nothing. See
   * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
   */
  stepsBack: boolean
}

/**
 * A Story as a screen shows it, whether the screen is an Author's Preview or a
 * Reader's Reading: the engine's Story, plus the name of each Scene. The name is
 * there for an Exit nobody has phrased yet, which has to stay takeable — a Reading
 * that cannot go on is worse than one offered an Exit named after where it lands.
 */
export type StoryToShow = Omit<StoryToRead, 'scenes'> & {
  scenes: (StoryToRead['scenes'][number] & { name: string })[]
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
 * Everything one Reading has accumulated: what each Flag holds, and the Scenes it
 * has entered, in the order it entered them. Computed from the Path on every read
 * and kept nowhere, so no two Readings can reach the same State.
 *
 * Entered rather than counted, because a Reading stands in a Scene at most once
 * and a count of nought or one is a list of names said the long way round — see
 * `docs/adr/0048-a-scene-is-entered-once.md`. A list rather than a set, because
 * State is handed to a screen that draws it and to a payload that has to survive
 * being written down; the Scenes one Reading has been through are few enough that
 * looking through them costs nothing.
 */
export type State = { flags: Flags, entered: string[] }

/**
 * Whether the Conditions an Exit or a Shot carries all pass against this State —
 * one carrying none being always offered, or always played. One comparison a
 * Condition, an `every` over them, and no recursion: a Condition is flat by
 * construction, so this is the whole of the language.
 */
export function holds(conditions: Condition[], state: State) {
  return conditions.every((condition) => {
    if ('flag' in condition) return (state.flags[condition.flag] ?? '') === condition.is

    return state.entered.includes(condition.scene) === condition.entered
  })
}

/**
 * Whether one Exit is on offer to a Reading standing where it leaves from: every
 * Condition it carries holds, and the Scene it leads to is not one this Reading
 * has already entered.
 *
 * The second half is `docs/adr/0048-a-scene-is-entered-once.md` read at the far
 * end of the rule it settled. The bench refuses to write a way on that comes back,
 * so on a Story written under that rule this can never fire; on one written before
 * it, it is what keeps a Reading standing in a Scene at most once — nothing an
 * Author wrote is edited, and the way on is simply not handed over.
 *
 * One function, so that what the Reader is offered, what the walk lets a Path
 * replay and what the search may take are one question: an Exit a forged Path
 * claims is refused by the same test that hid it.
 */
export function offered(exit: Exit, state: State) {
  return holds(exit.conditions, state) && !state.entered.includes(exit.toSceneId)
}

/**
 * One Scene as the engine reads it, named so that what resolves a Cut can say
 * what it takes without spelling the Story's shape out again.
 */
export type SceneToRead = StoryToRead['scenes'][number]

/**
 * How one Shot leaves the screen: when the cut is made, how long it takes and
 * what it passes through. `after` of null is the Shot standing until the Reader
 * presses.
 */
export type Cut = { after: number | null, over: number, through: CutThrough }

/**
 * A Shot answers for itself where it says anything and is cut as its Scene says
 * where it says nothing, field by field — the shape
 * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md` gave an Exit's
 * steps back.
 *
 * The nought a Shot writes to say *this one waits* resolves to no time at all,
 * so the sentinel never leaves the column it is written in: everything
 * downstream reads waiting as the absence of a time, and there is one place in
 * the product where nought has to be understood. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 */
export function cut(scene: SceneToRead, shot: Shot): Cut {
  const after = shot.cutAfter === null ? scene.cutAfter : shot.cutAfter

  return {
    after: after === 0 ? null : after,
    over: shot.cutOver ?? scene.cutOver,
    through: shot.cutThrough ?? scene.cutThrough,
  }
}

/**
 * Why an Exit is not on offer, or a Shot not played: one line for each test it
 * carries that this State fails, saying what the test asked for and what the
 * State actually holds. For
 * an Author's eyes alone — a Reader is never told what they are not being
 * offered — so the Scene a Condition asks about is named rather than shown as the
 * id the Condition holds.
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

    return say(condition.entered ? 'preview.needsEntered' : 'preview.needsNotEntered', {
      scene: sceneName(condition.scene),
    })
  })
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
 * the seed, the Scene and the Flag's name — the three things that identify the
 * draw — so each draw is independent of every other: a Shot added upstream, or one
 * skipped by a Condition, leaves it where it was, and a Path replayed after an
 * edit shows the Story it showed. A sequential generator threaded through the walk
 * would shift every later draw instead; see
 * `docs/adr/0024-the-seed-belongs-to-the-position.md`.
 *
 * The count of entries used to be the fourth, so that a Scene read again drew
 * again. A Reading arrives once, so there is one draw and the count has left the
 * key — `docs/adr/0048-a-scene-is-entered-once.md`. The seed is untouched and
 * still belongs to the Path.
 */
function drawn(seed: number, sceneId: string, flag: string, values: string[]) {
  return values[hashed(`${seed}:${sceneId}:${flag}`) % values.length]!
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
 * every arrival is written down and sets the Flags of the Scene it arrives at, so
 * the State an Exit is judged against is the one the Reader had when they were
 * offered it. An Exit that does not leave the Scene the Reading stands in, or that
 * was not on offer there — its Conditions failing, or its Scene already entered —
 * is not one it could have been offered, so a stale link or a hand-written one
 * stops the walk where it is rather than teleporting the Reader.
 *
 * The walk is as long as the Exits taken, and a Story that comes back on itself
 * cannot be walked round twice: the second arrival is the one `offered` withholds.
 *
 * A Flag the Scene gives several values is drawn here, where a Scene already sets
 * its Flags: the draw is made before anything is judged, so the State an Exit or
 * a Shot is held against is the one the Reader arrived with. One arrival is one
 * draw, so the draw is made as the Reading arrives and never again.
 */
function walk(story: StoryToRead, { seed, taken }: Path) {
  const state: State = { flags: {}, entered: [] }

  function enter(id: string) {
    state.entered.push(id)
    const sets = story.scenes.find(scene => scene.id === id)?.sets ?? {}

    for (const [flag, held] of Object.entries(sets)) {
      state.flags[flag] = Array.isArray(held) ? drawn(seed, id, flag, held) : held
    }
  }

  let sceneId = story.openingSceneId
  if (sceneId) enter(sceneId)

  // How many of the taken Exits the walk got through, which is how `resumes`
  // tells a Path that still fits the Story from one the Story has moved under.
  let walked = 0
  for (const takenId of taken) {
    const exit = story.exits.find(exit =>
      exit.id === takenId && exit.fromSceneId === sceneId && offered(exit, state))
    if (!exit) break
    sceneId = exit.toSceneId
    enter(sceneId)
    walked++
  }

  return { sceneId, state, walked }
}

/**
 * Whether a Reading has moved at all. Two surfaces have to agree on it — what a
 * kept Path is resumed from, and whether reading again from the start is offered
 * — so the rule is written once and named the way
 * `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md` names it. A Path
 * that has taken no Exit and is still on the Shot it opened on is a Reading that
 * has not begun.
 */
export function moved(at: Path) {
  return at.taken.length > 0 || at.shot > 0
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
  if (!moved(at)) return false
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
  // Scene and the missing one both end the Path. An Exit this Reading is not
  // offered — one of its Conditions failing, or its Scene already entered — is not
  // among them, which is what makes it invisible rather than refused.
  const exits = shot
    ? []
    : story.exits.filter(exit => exit.fromSceneId === sceneId && offered(exit, state))

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
 * The Reader steps back a beat. Inside a Scene that is one Shot fewer; on the
 * first Shot of one it is the last Exit untaken, landing at the end of the Scene
 * that Exit left with its ways on offered again — which is what a Reader means
 * by *back*, and what
 * `docs/adr/0046-a-step-back-crosses-the-exit-it-came-by.md` says is safe to
 * mean.
 *
 * Nothing is unset, because nothing was ever set aside: State is a pure function
 * of the Path, so a Path one Exit shorter *is* the State the Reader held before
 * they took that Exit, and taking it again draws the same Flags out of the same
 * seed.
 *
 * Nothing at all where nothing is behind — a Reading that has not begun cannot
 * step out of its own opening — and nothing where the Exit behind is one the
 * Author closed: an Exit says whether it is crossed backwards, and answers as
 * its Story says where it has not said. That is the one place the rule is read,
 * so the Reading and every screen drawing it cannot come apart about which door
 * has shut. See `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
 *
 * The Story is here for the one thing the Path cannot say — how long the run of
 * the Scene stepped back into is. It is the run this Reading plays and not the
 * Scene's own, so a Shot a Condition skipped on the way in is skipped on the way
 * back as well.
 */
export function back(story: StoryToRead, at: Path): Path | undefined {
  if (at.shot > 0) return { ...at, shot: at.shot - 1 }

  // Which Exit would be crossed, and whether it is crossed: the Exit's own
  // answer where it gave one, and its Story's where it did not. An opening Path
  // has taken none and is stopped here, as is a Path whose last Exit the Story
  // no longer carries — a Reading the walk stops short of has no way back
  // through a door that is gone.
  const crossed = story.exits.find(exit => exit.id === at.taken.at(-1))
  if (!crossed || !(crossed.stepsBack ?? story.stepsBack)) return

  const before: Path = { ...at, taken: at.taken.slice(0, -1), shot: 0 }
  return { ...before, shot: reading(story, before).run.length }
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
 * `offered` for whether an Exit was on the table, and `take` for the Path that
 * results — so what this can reach and what a Reader can reach cannot come apart.
 * The breadth-first order makes the answer the shortest way there, which is the
 * one an Author reads the fewest Scenes to arrive at.
 *
 * A Scene is passed once for each set of Flags it has been arrived holding, rather
 * than once outright: two ways round to one Scene can set different Flags on the
 * way, and the ways on it offers on arrival differ with them.
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
        if (exit.fromSceneId !== standing || !offered(exit, state)) continue
        next.push(take(at, exit))
      }
    }

    edge = next
  }
}
