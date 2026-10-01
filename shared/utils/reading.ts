import type {
  Condition, CutThrough, Exit, Flags, Layout, MovementDirection, Sets, Shot, TextBy,
} from './scenes'
import { MOVEMENT_OVER_UNTIMED } from './scenes'
import type { Phrase } from './phrases'
import { runLastings } from './formatted'

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
    layout: Layout
    /**
     * How the Images of this Scene's run move: by how much of the frame, nought
     * being still, which way, and over how long, nought being as long as each Shot
     * is on screen. See `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
     */
    movementBy: number
    movementDirection: MovementDirection
    movementOver: number
    /**
     * How the texts of this Scene's run arrive — after a time, by a unit, at a
     * pace, over a time — and how long they stay, null being until the Cut. See
     * `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
     */
    textAfter: number
    textBy: TextBy
    textPace: number
    textOver: number
    textStays: number | null
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
 * Everything one Reading has accumulated: what each Flag holds, the Scenes it has
 * entered, and the Exits it has taken, each in the order it did. Computed from the
 * Path on every read — the Exits taken are the Path read back — and kept nowhere,
 * so no two Readings can reach the same State.
 *
 * Entered rather than counted, because a Reading stands in a Scene at most once
 * and a count of nought or one is a list of names said the long way round — see
 * `docs/adr/0048-a-scene-is-entered-once.md`. A list rather than a set, because
 * State is handed to a screen that draws it and to a payload that has to survive
 * being written down; the Scenes one Reading has been through are few enough that
 * looking through them costs nothing.
 */
export type State = { flags: Flags, entered: string[], taken: string[] }

/**
 * Whether the Conditions an Exit or a Shot carries all pass against this State —
 * one carrying none being always offered, or always played. One comparison a
 * Condition, an `every` over them, and no recursion: a Condition is flat by
 * construction, so this is the whole of the language.
 */
export function holds(conditions: Condition[], state: State) {
  return conditions.every((condition) => {
    if ('flag' in condition) return (state.flags[condition.flag] ?? '') === condition.is

    if ('scene' in condition) return state.entered.includes(condition.scene) === condition.entered

    return state.taken.includes(condition.exit) === condition.taken
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
 * A Shot answers for itself where it says anything and is laid out as its Scene
 * says where it says nothing, the shape `cut()` has.
 */
export function layout(scene: SceneToRead, shot: Shot): Layout {
  return shot.layout ?? scene.layout
}

/**
 * How one Shot's Image moves: which way, by how much of the frame, over how long,
 * and whether that time is the clock's hold, which the Reading lengthens by the
 * time the Shot's text takes to arrive.
 */
export type Movement = { direction: MovementDirection, by: number, over: number, held: boolean }

/**
 * A Shot answers for itself where it says anything and moves as its Scene says
 * where it says nothing, field by field, the shape `cut()` has. Nothing where
 * the Image holds still. An `over` of nought is as long as the Shot is on
 * screen. Where the clock cuts the Shot that is its hold, and `held` says so:
 * the clock counts the hold from the text having arrived, so a Movement that is
 * to end as the clock cuts spans the arrival too, and only the Reading knows how
 * long that takes. Where the Reader cuts it is `MOVEMENT_OVER_UNTIMED`, and a
 * time the Shot or its Scene wrote is the time it says, so neither is `held`.
 * Both noughts are understood here and nowhere else.
 */
export function movement(scene: SceneToRead, shot: Shot): Movement | null {
  const by = shot.movementBy ?? scene.movementBy
  if (!shot.image || by === 0) return null

  const over = shot.movementOver ?? scene.movementOver
  const { after } = cut(scene, shot)

  return {
    direction: shot.movementDirection ?? scene.movementDirection,
    by,
    over: over || (after ?? MOVEMENT_OVER_UNTIMED),
    held: !over && after !== null,
  }
}

/**
 * The transforms a Movement starts and ends at, about the point. Closer and
 * away scale about it. Across, the Image is drawn `by` percent larger and
 * travels the room that keeps it covering its box and the point inside it: a
 * shift `t` keeps the grown Image covering while
 * `-(1 - at) * (grown - 1) <= t <= at * (grown - 1)`, and the point inside while
 * `-at <= t <= 1 - at`. A point on the very edge leaves no room on that axis, and
 * the Image holds still along it. `translate` in percent is measured on the
 * box's own size, so both ends hold at every frame size and through a resize.
 */
export function movementEnds(
  { direction, by }: Pick<Movement, 'direction' | 'by'>,
  { cropX, cropY }: { cropX: number, cropY: number },
) {
  const grown = 1 + by / 100
  if (direction === 'closer') return { from: 'scale(1)', to: `scale(${grown})` }
  if (direction === 'away') return { from: `scale(${grown})`, to: 'scale(1)' }

  const across = direction === 'left' || direction === 'right'
  const at = (across ? cropX : cropY) / 100
  const back = Math.max(-(1 - at) * (grown - 1), -at)
  const forth = Math.min(at * (grown - 1), 1 - at)
  const [start, end] = direction === 'right' || direction === 'down' ? [back, forth] : [forth, back]
  // `|| 0` turns a negative nought into the nought a transform is written with.
  const shifted = (t: number) => (across
    ? `translate(${t * 100 || 0}%, 0)`
    : `translate(0, ${t * 100 || 0}%)`)

  return { from: `${shifted(start)} scale(${grown})`, to: `${shifted(end)} scale(${grown})` }
}

/**
 * How one Shot's text arrives: how long after its Image lands it starts, what it
 * arrives by, at how many characters a second, how long each part takes to
 * appear, and how long the whole of it stays once it has arrived, null being
 * until the Cut.
 */
export type TextArrival = {
  after: number, by: TextBy, pace: number, over: number, stays: number | null
}

/**
 * A Shot answers for itself where it says anything, field by field, as `cut()`
 * does, and the nought a Shot writes to say *this text stays* resolves to no time
 * at all, so the sentinel never leaves its column. Named for the text, because
 * *arrival* is already a Reading entering a Scene here. See
 * `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
 */
export function textArrival(scene: SceneToRead, shot: Shot): TextArrival {
  const stays = shot.textStays === null ? scene.textStays : shot.textStays

  return {
    after: shot.textAfter ?? scene.textAfter,
    by: shot.textBy ?? scene.textBy,
    pace: shot.textPace ?? scene.textPace,
    over: shot.textOver ?? scene.textOver,
    stays: stays === 0 ? null : stays,
  }
}

/**
 * Whether a Shot's text reaches the screen in its own time rather than landing
 * whole with its Image: after a wait, by a unit, or fading up. A text of white
 * space alone has nothing to arrive.
 */
export function textArrives(scene: SceneToRead, shot: Shot) {
  if (!shot.text.trim()) return false
  const { after, by, over } = textArrival(scene, shot)

  return after > 0 || by !== 'whole' || over > 0
}

/**
 * Whether a Shot's text moves by itself at all: arriving in its own time, or
 * leaving before the Cut.
 */
export function textMoves(scene: SceneToRead, shot: Shot) {
  return textArrives(scene, shot)
    || (!!shot.text.trim() && textArrival(scene, shot).stays !== null)
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * Where each unit of a text starts and ends, in characters. White space is in
 * none, but it counts in the characters a unit waits for. One function, so what
 * the Reading draws and what the bench reckons cannot disagree.
 */
function unitsOf(text: string, by: TextBy): [number, number][] {
  if (by === 'whole') return text.trim() ? [[0, text.length]] : []

  const found = by === 'letter'
    ? [...graphemes.segment(text)]
        .map(({ segment, index }) => [index, segment] as const)
    : [...text.matchAll(by === 'line' ? /[^\n]+/g : /\S+/g)]
        .map(match => [match.index, match[0]] as const)

  return found.filter(([, run]) => /\S/.test(run))
    .map(([start, run]): [number, number] => [start, start + run.length])
}

/**
 * How many characters come before a text's last unit, which is when it has all
 * arrived.
 */
export function lastUnitAt(text: string, by: TextBy) {
  return unitsOf(text, by).at(-1)?.[0] ?? 0
}

/** One run of one leaf, and the characters before its unit, or null for white space. */
export type Piece = { text: string, from: number | null }

/**
 * A text cut into what it arrives by, one list of pieces per leaf, in document
 * order. The leaves are joined and the units found over the whole, so a word
 * crossing two leaves is two pieces with one `from`. Today a text is one leaf.
 */
export function pieces(leaves: string[], by: TextBy): Piece[][] {
  const units = unitsOf(leaves.join(''), by)
  let start = 0

  return leaves.map((leaf) => {
    const end = start + leaf.length
    const edges = new Set([start, end])
    for (const [from, to] of units) {
      if (from > start && from < end) edges.add(from)
      if (to > start && to < end) edges.add(to)
    }

    const cut = [...edges].sort((one, other) => one - other)
    const cutUp = cut.slice(1).map((to, at) => {
      const from = cut[at]!
      // ponytail: a search of every unit for every edge, quadratic in the units, which
      // is fine at SHOT_TEXT_MAX_LENGTH; index the units the day a text is longer.
      const unit = units.find(([first, last]) => first <= from && from < last)

      return { text: leaf.slice(from - start, to - start), from: unit ? unit[0] : null }
    })

    start = end
    return cutUp
  })
}

/**
 * Whether anything in this Story moves the Reading on by itself, a clock or a
 * text in its own time, which is what the Reader is owed a pause over — WCAG
 * 2.2.2, and `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`. A
 * Scene moves by itself where a Shot of its run resolves to a time, or where its
 * ways on are given one and there are ways on to take.
 *
 * Every Shot is put back through `cut()` rather than read for a time of its own,
 * so what this says of a Scene and what the clock does in it cannot come apart: a
 * Scene that names a time and whose every Shot answers nought is a Scene held
 * until the press, beat by beat, and a Scene with no Shot in it at all has no run
 * to cut. `exitsAfter` reads the same way against the Exits leaving the Scene,
 * nought included — a Scene flowing into the next moves the Reading on without
 * being asked, which is the thing 2.2.2 is about.
 *
 * It answers of the Story and not of the Reading, so it says *can* and never
 * *does*: Conditions may hide every clocked Shot of a run, or every Exit out of a
 * Scene, and a Reading that takes none of those ways is given a control it never
 * needs. That is the side to be wrong on: a pause withheld from a Reader a clock
 * is carrying is a Reading nobody can stop, and a pause offered where nothing
 * runs is a button that stops a clock nobody started.
 *
 * A text arriving in its own time or leaving before the Cut moves the Reading by
 * itself as surely as a clocked Shot, so it is owed the same pause.
 */
export function timed(story: StoryToRead) {
  return story.scenes.some(scene =>
    scene.shots.some(shot => cut(scene, shot).after !== null || textMoves(scene, shot))
    || (scene.exitsAfter !== null
      && story.exits.some(exit => exit.fromSceneId === scene.id)))
}

/**
 * Whether anything in this Story moves by itself, which is what the Reader is
 * owed a pause over: a clock, a text in its own time, or an Image that moves
 * while its Shot is on screen. It still says *can* of the Story, the side
 * `timed` chooses to be wrong on.
 */
export function movesItself(story: StoryToRead) {
  return timed(story)
    || story.scenes.some(scene => scene.shots.some(shot => movement(scene, shot) !== null))
}

/** What `lastsOn` and `flickers` read of a Shot: its two slots, its Image, and its text's runs. */
type Lasts = Pick<Shot, 'image' | 'imageLasts' | 'textLasts'> & Partial<Pick<Shot, 'formatted'>>

/**
 * Whether a Shot carries an Effect that lasts, on its Image, on its text, or on a
 * run of its words. The Image's slot counts only where the Shot has an Image: the Reading draws it
 * nowhere else, and the bench hides it with the Image, so a Lasting left behind
 * by an Image taken away is one nobody sees and nobody can clear — and a Pause
 * given over it would be a control over nothing that moves.
 */
export function lastsOn(shot: Lasts) {
  return (!!shot.image && !!shot.imageLasts) || !!shot.textLasts
    || (!!shot.formatted && runLastings(shot.formatted).length > 0)
}

/**
 * Whether the Image, the text or a run of the words of a Shot flickers, which the
 * flash rule and the Remark both read. The Image's slot counts only where the Shot
 * has an Image, as `lastsOn` reads it and for its reason: a flicker nothing draws
 * flashes nothing, and would withhold the next white for a light nobody saw.
 */
export function flickers(shot: Lasts) {
  return (!!shot.image && shot.imageLasts?.effect === 'flicker') || shot.textLasts?.effect === 'flicker'
    || (!!shot.formatted && runLastings(shot.formatted).some(held => held.effect === 'flicker'))
}

/**
 * Whether any Shot carries an Effect that lasts, which WCAG 2.2.2 owes a pause
 * over: it moves by itself for as long as its beat stands. It says *can*, never
 * *does*, for the reason `timed` gives.
 */
export function lasting(story: StoryToRead) {
  return story.scenes.some(scene => scene.shots.some(lastsOn))
}

/**
 * Why an Exit is not on offer, or a Shot not played: one line for each test it
 * carries that this State fails, saying what the test asked for and what the
 * State actually holds. For an Author's eyes alone — a Reader is never told what
 * they are not being offered — so the Scene or the Exit a Condition asks about is
 * named rather than shown as the id the Condition holds.
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
  exitName: (id: string) => string,
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

    if ('scene' in condition) {
      return say(condition.entered ? 'preview.needsEntered' : 'preview.needsNotEntered', {
        scene: sceneName(condition.scene),
      })
    }

    return say(condition.taken ? 'preview.needsTaken' : 'preview.needsNotTaken', {
      exit: exitName(condition.exit),
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
 *
 * The Exits it crosses are written down too, so a Shot of a Scene and an Exit
 * leaving it see every Exit taken up to and including the one that entered it.
 *
 * The Flags are a map with no prototype, because an Author may name a Flag
 * anything: on `{}`, one named `constructor` would already hold a function, and
 * one named `__proto__` could never be set.
 */
function walk(story: StoryToRead, { seed, taken }: Path) {
  const state: State = { flags: Object.create(null), entered: [], taken: [] }

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
    state.taken.push(exit.id)
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
 * A Scene is passed once for each way it can be arrived at that the ways on
 * further on tell apart, rather than once outright: the Flags held, the Scenes
 * entered that some Condition asks about, the Scenes entered that are still
 * ahead, which `offered` withholds, and the Exits taken that some Condition asks
 * about. Two ways round that agree on all four are offered the same ways on from
 * there to the end, so only the first is searched on; keying on every Scene
 * entered would never merge two, and keying on nothing would extend for ever a
 * Path that `walk` has stopped following.
 */
export function pathTo(story: StoryToRead, from: Path, sceneId: string): Path | undefined {
  const seen = new Set<string>()
  // ponytail: each step walks the whole Path again, so the search is quadratic in
  // the Exits it takes. A Story an Author is writing is small; measure it the day
  // one is not.
  let edge = [from]
  // The Scenes and Exits some way on asks about. Scene and Exit ids are both
  // uuids, so one set holds both.
  const asked = new Set(story.exits.flatMap(exit => exit.conditions.flatMap(condition =>
    'scene' in condition ? [condition.scene] : 'exit' in condition ? [condition.exit] : [])))

  // Every Scene the ways on lead to from this one, whatever they ask. Only a Story
  // written before `docs/adr/0048-a-scene-is-entered-once.md` can hold one the
  // Reading has already entered.
  function ahead(id: string) {
    const reached = [id]
    for (const at of reached) {
      for (const exit of story.exits) {
        if (exit.fromSceneId === at && !reached.includes(exit.toSceneId)) reached.push(exit.toSceneId)
      }
    }
    return reached
  }

  while (edge.length) {
    const next: Path[] = []

    for (const at of edge) {
      const { sceneId: standing, state } = reading(story, at)
      if (standing === sceneId) return at
      if (!standing) continue

      const onward = ahead(standing)
      const told = state.entered.filter(id => asked.has(id) || onward.includes(id))
      const arrivedAs = JSON.stringify([standing, state.flags, told, state.taken.filter(id => asked.has(id))])
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
