import type { Edition, SceneToRead } from './reading'
import { asks, cut, lastUnitAt, textArrival } from './reading'
import { CHARACTERS_A_SECOND } from './scenes'
import type { Exit, Shot } from './scenes'

/**
 * How long a Story's longest Reading takes, estimated from its Edition: the
 * Reading Time a card shows as an upper bound. Every Shot and every Exit counts,
 * whatever its Conditions, and the Story weighs its heaviest route from the
 * Opening Scene to a Scene that offers no Exit — so the figure is what the
 * longest Reading could take, and says nothing of how many Scenes or Shots it
 * crossed. See `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`.
 */

/** Words a minute a Reader is reckoned to read at, where the hand makes the Cut. */
const WORDS_A_MINUTE = 200

/** The least a Shot with no words is on screen for, in milliseconds. */
const SHOT_WITHOUT_WORDS = 3_000

/** How long a Reader is reckoned to take choosing a way on that no clock takes. */
const CHOOSING = 3_000

/** How long a Reader is reckoned to take answering a Question. */
const ANSWERING = 10_000

/**
 * What a Scene reads as where an older Edition lacks a field: the column's own
 * default, which is what the Scene said before the field existed — see *What an
 * older Edition reads as* in
 * `docs/adr/0070-the-bench-says-what-changed-since-the-edition.md`.
 */
const SCENE_DEFAULTS = {
  cutAfter: null,
  cutOver: 0,
  cutThrough: 'image',
  exitsAfter: null,
  textAfter: 0,
  textBy: 'whole',
  textPace: CHARACTERS_A_SECOND,
  textOver: 0,
  textStays: null,
  question: '',
  questionFlag: '',
} as const

/** The fields a Shot answers for itself, null being *as the Scene says*. */
const SHOT_ANSWERS = [
  'cutAfter', 'cutOver', 'cutThrough', 'textAfter', 'textBy', 'textPace', 'textOver', 'textStays',
] as const

/** A Scene of an Edition of any age, read with every field it lacks at its default. */
function whole(scene: Edition['scenes'][number]): SceneToRead {
  const read = { ...scene } as Record<string, unknown>
  for (const [field, value] of Object.entries(SCENE_DEFAULTS)) read[field] ??= value
  read.shots = (scene.shots ?? []).map((shot) => {
    const held = { ...shot } as Record<string, unknown>
    for (const field of SHOT_ANSWERS) held[field] ??= null
    held.text ??= ''
    return held
  })
  return read as SceneToRead
}

/**
 * How long the text of a Shot takes to have all arrived, in milliseconds: the
 * wait, then each unit at the pace until the last, then the time the last takes
 * to appear. Nought for a Shot with no text, which has nothing to arrive.
 */
function arriving(scene: SceneToRead, shot: Shot) {
  if (!shot.text.trim()) return 0
  const { after, by, pace, over } = textArrival(scene, shot)
  const last = by === 'whole' ? 0 : lastUnitAt(shot.text, by)

  return after + (last / pace) * 1000 + over
}

/**
 * What one Shot weighs, in milliseconds. Where the clock makes its Cut, what the
 * clock holds it for: the text arriving, then the Cut's time. Where the hand
 * makes it, the longer of its words read and its text arriving. A Shot with no
 * words is never under the floor. Then the Cut that takes it off.
 */
function shotWeight(scene: SceneToRead, shot: Shot) {
  const { after, over } = cut(scene, shot)
  const words = shot.text.match(/\S+/g)?.length ?? 0
  const arrived = arriving(scene, shot)

  const held = after === null
    ? Math.max((words / WORDS_A_MINUTE) * 60_000, arrived)
    : arrived + after

  return (words ? held : Math.max(held, SHOT_WITHOUT_WORDS)) + over
}

/**
 * What one Scene weighs, in milliseconds: its Shots, then the time a Question
 * takes to answer, then the time its ways on stand — the countdown where it has
 * one, nought being none at all, and the time to choose where the Reader does.
 */
function sceneWeight(scene: SceneToRead, offers: boolean) {
  const shots = scene.shots.reduce((sum, shot) => sum + shotWeight(scene, shot), 0)
  const answering = asks(scene) ? ANSWERING : 0
  const standing = offers ? scene.exitsAfter ?? CHOOSING : 0

  return shots + answering + standing
}

/**
 * The heaviest route on from each Scene, in milliseconds, to a Scene that offers
 * no Exit. An Exit only leads onwards and a Scene is entered once, so the Graph
 * is acyclic and one pass finds every route; a Story written before that rule
 * may still hold a cycle, so a route never enters a Scene it is already in, and
 * the walk ends.
 */
export function heaviestRoutes(work: Pick<Edition, 'scenes' | 'exits'>) {
  const scenes = new Map(work.scenes.map(scene => [scene.id, whole(scene)]))
  const leaving = new Map<string, Exit[]>()
  for (const exit of work.exits) {
    if (!scenes.has(exit.toSceneId)) continue
    leaving.set(exit.fromSceneId, [...leaving.get(exit.fromSceneId) ?? [], exit])
  }

  const weighed = new Map<string, number>()
  const onRoute = new Set<string>()

  function from(sceneId: string): number {
    const known = weighed.get(sceneId)
    if (known !== undefined) return known

    const scene = scenes.get(sceneId)!
    onRoute.add(sceneId)
    const onwards = (leaving.get(sceneId) ?? [])
      .filter(exit => !onRoute.has(exit.toSceneId))
      .map(exit => (exit.cutOver ?? 0) + from(exit.toSceneId))
    onRoute.delete(sceneId)

    const weight = sceneWeight(scene, (leaving.get(sceneId) ?? []).length > 0)
      + Math.max(0, ...onwards)
    weighed.set(sceneId, weight)
    return weight
  }

  return new Map([...scenes.keys()].map(id => [id, from(id)]))
}

/**
 * The Reading Time of an Edition, in whole seconds, or null for one with no
 * Opening Scene, which no Reading can start.
 */
export function readingTime(edition: Pick<Edition, 'openingSceneId' | 'scenes' | 'exits'>) {
  const routes = heaviestRoutes(edition)
  const weight = edition.openingSceneId === null ? undefined : routes.get(edition.openingSceneId)

  return weight === undefined ? null : Math.round(weight / 1000)
}

/**
 * The Reading Time of the work from each of its Scenes, in whole seconds, keyed
 * by the Scene's id: what Publish writes beside the Edition, so the Opening
 * Scene the row names in the same statement picks its own.
 */
export function readingTimesFrom(work: Pick<Edition, 'scenes' | 'exits'>) {
  return Object.fromEntries([...heaviestRoutes(work)].map(([id, weight]) => [id, Math.round(weight / 1000)]))
}

/**
 * The minutes a card shows a Reading Time as: to the minute under ten, and
 * never under one, and to five minutes from ten on, so the figure reads as the
 * estimate it is.
 */
export function readingMinutes(seconds: number) {
  const minutes = seconds / 60
  return minutes < 10 ? Math.max(1, Math.round(minutes)) : Math.round(minutes / 5) * 5
}
