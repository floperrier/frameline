/**
 * What a Shot plays as, said on the one line its row folds the choosing under —
 * issue #401 and `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`.
 * A part for each answer on the row that is not *As the Scene says* or *No
 * Effect*, in the order the row draws the fields, each carrying what its fields
 * add: seconds, a percent, a pace, a strength. A Shot that says nothing does as
 * its Scene says, which the Scene says once at its head, so the line says that and
 * repeats none of it.
 *
 * The Scene is read for the two things the row itself reads off it: whether *The
 * Movement takes* is drawn at all, and the pace a unit falls back on. A Sound is
 * never a part: one deposited is on the row in plain view, and one picked from the
 * library and not taken is not on the Shot yet.
 */
import { IMAGE_ARRIVALS, IMAGE_LASTINGS, TEXT_ARRIVALS, TEXT_LASTINGS } from '#shared/utils/scenes'
import type { CutThrough, Exit, MovementDirection, Scene, Shot } from '#shared/utils/scenes'
import type { Phrase } from '#shared/utils/phrases'
import { SOUND_TYPES } from '#shared/utils/sound'
import { EFFECT_LABELS, effectTime } from './effects'

const SLOTS = ['imageArrives', 'imageLasts', 'textArrives', 'textLasts'] as const

const capital = (word: string) => word[0]!.toUpperCase() + word.slice(1)

export function playsAs(shot: Shot, scene: Pick<Scene, 'movementBy' | 'textPace'>, say: Phrase) {
  const parts: string[] = []
  const said = (key: string, values?: Record<string, number>) => parts.push(say(`editor.${key}`, values))

  if (shot.cutAfter !== null) {
    said(shot.cutAfter ? 'playsCutAfter' : 'playsCutAtThePress', { seconds: shot.cutAfter / 1000 })
  }
  if (shot.cutOver === 0) said('playsCutHard')
  else if (shot.cutOver !== null) {
    said(shot.cutThrough === 'black' ? 'playsFadeToBlack' : 'playsDissolve', { seconds: shot.cutOver / 1000 })
  }

  if (shot.layout) said(shot.layout === 'full' ? 'playsFull' : 'playsInset')

  if (shot.image) {
    const by = shot.movementBy ?? scene.movementBy
    if (shot.movementBy === 0) said('playsStill')
    else if (shot.movementDirection) said(`plays${capital(shot.movementDirection)}`, { percent: by })

    if (by > 0 && shot.movementOver !== null) {
      said(shot.movementOver ? 'playsMovesOver' : 'playsMovesWhole', { seconds: shot.movementOver / 1000 })
    }
  }

  for (const slot of SLOTS) {
    const effect = shot[slot]
    if (!effect || (slot.startsWith('image') && !shot.image)) continue

    const time = effectTime(effect)
    parts.push([
      say(`editor.plays${capital(slot)}`, { effect: say(`editor.${EFFECT_LABELS[effect.effect]}`) }),
      ...time === undefined ? [] : [say('editor.playsSeconds', { seconds: time / 1000 })],
      say(`editor.plays${capital(effect.strength)}`),
    ].join(', '))
  }

  // How the text arrives is drawn only on a beat with words to arrive.
  if (shot.text.trim()) {
    if (shot.textAfter !== null) {
      said(shot.textAfter ? 'playsTextAfter' : 'playsTextWithImage', { seconds: shot.textAfter / 1000 })
    }
    if (shot.textBy) {
      said(shot.textBy === 'whole' ? 'playsTextWhole' : `playsTextBy${capital(shot.textBy)}`, {
        pace: shot.textPace ?? scene.textPace,
      })
    }
    if (shot.textOver !== null) {
      said(shot.textOver ? 'playsTextOver' : 'playsTextAtOnce', { seconds: shot.textOver / 1000 })
    }
    if (shot.textStays !== null) {
      said(shot.textStays ? 'playsTextStays' : 'playsTextUntilTheCut', { seconds: shot.textStays / 1000 })
    }
  }

  return parts.join(' · ') || say('editor.playsAsScene')
}

/**
 * How a Scene plays, said on the one line its head folds the choosing under —
 * issue #400, by `0061`'s rule. A Scene has no *As the Scene says* to fall back on:
 * its answers are what every Shot of its run does, so the four that change every
 * Shot's look and pace are always said, in #401's words. How its Exits are offered
 * and how its texts arrive are said only where they depart from what a new Scene
 * is written with, so a Scene that says nothing about them spends no words on
 * them. The parts follow the fold's order. Its Sound is never a part: one it is
 * heard under stands open above the fold, and silence needs no word.
 */
export function scenePlaysAs(scene: Scene, say: Phrase) {
  const parts: string[] = []
  const said = (key: string, values?: Record<string, number>) => parts.push(say(`editor.${key}`, values))

  if (scene.cutAfter === null) said('playsCutAtThePress')
  else said('playsCutAfter', { seconds: scene.cutAfter / 1000 })
  if (!scene.cutOver) said('playsCutHard')
  else said(scene.cutThrough === 'black' ? 'playsFadeToBlack' : 'playsDissolve', { seconds: scene.cutOver / 1000 })
  if (scene.exitsAfter !== null) {
    said(scene.exitsAfter ? 'playsExitsFor' : 'playsExitsNone', { seconds: scene.exitsAfter / 1000 })
  }

  if (scene.textAfter) said('playsTextAfter', { seconds: scene.textAfter / 1000 })
  if (scene.textBy !== 'whole') said(`playsTextBy${capital(scene.textBy)}`, { pace: scene.textPace })
  if (scene.textOver) said('playsTextOver', { seconds: scene.textOver / 1000 })
  if (scene.textStays !== null) said('playsTextStays', { seconds: scene.textStays / 1000 })

  said(scene.layout === 'full' ? 'playsFull' : 'playsInset')

  if (!scene.movementBy) said('playsStill')
  else {
    said(`plays${capital(scene.movementDirection)}`, { percent: scene.movementBy })
    if (scene.movementOver) said('playsMovesOver', { seconds: scene.movementOver / 1000 })
  }

  return parts.join(' · ')
}

/*
 * What the Scene's head in `app/components/Writing.vue` and the rows it is drawn
 * with, `app/components/ShotRow.vue` and `app/components/ExitRow.vue`, all read
 * and write by: the answers a carrier's columns are read as, what an answer
 * writes and where a number starts, and the few things about a Shot and a file
 * the document and a row both ask. Pure, so a row reads them without asking the
 * document for anything, and written once here rather than in each of the three.
 */

/**
 * What the Author typed about one Shot: its text as formatted, its image's
 * Description and its Sound's Transcript. Never its plain words, which the
 * server derives from the formatted text — sent alone they would take the
 * formatting away.
 */
export function typedAbout(shot: Shot) {
  return { formatted: shot.formatted, description: shot.description, transcript: shot.transcript }
}

/**
 * What the file dialog offers. The media types alone are not enough: several
 * platforms map `.m4a` to `audio/x-m4a`, which greys an Author's own AAC files
 * out of their own dialog — in a product that ships thirty of them. Naming the
 * extensions beside the types loosens nothing, because what a Sound is is read
 * off its first bytes by the server and never off this list.
 */
export const SOUND_ACCEPT = [...SOUND_TYPES, '.m4a', '.mp3', '.aac'].join(',')

/**
 * The file an input's `change` carried, taken off it the way an image's own
 * deposit does — and the picker cleared, so choosing the very file already
 * there fires a second `change`. Read before `changing` is asked for one, so
 * a dialog closed with nothing chosen claims no Scene and reaches no server.
 */
export function depositedFile(event: Event) {
  const picker = event.target as HTMLInputElement
  const file = picker.files?.[0]
  if (file) picker.value = ''
  return file
}

/**
 * How a cut is made, read off the two columns that say it. Nought over is a hard
 * cut and there is no third value to read: under a duration of nought there is
 * nothing for `cutThrough` to be true of, so the panel offers one answer of three
 * where the columns hold two facts, and neither can disagree with the other. A
 * Shot alone may say nothing at all, which is the null both of its columns hold
 * and which reads here as *as the Scene says*. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 */
export function cutKind(carrier: { cutOver: number | null, cutThrough: CutThrough | null }) {
  if (carrier.cutOver === null) return 'scene'

  return carrier.cutOver === 0 ? 'hard' : carrier.cutThrough ?? 'image'
}

/**
 * When a Shot leaves the screen, in the three answers its one column holds: as
 * its Scene says, at the press, or after a time of its own. A Scene has two of
 * them — it is what a Shot falls back on, so it has nothing to fall back on
 * itself — and its null is the press rather than a deferral.
 */
export function cutWhen(shot: Shot) {
  if (shot.cutAfter === null) return 'scene'

  return shot.cutAfter === 0 ? 'press' : 'clock'
}

/** How long the ways on stand: until one is taken, for a time, or not at all. */
export function exitsOffered(scene: Scene) {
  if (scene.exitsAfter === null) return 'taken'

  return scene.exitsAfter === 0 ? 'none' : 'clock'
}

/**
 * What each answer about how a cut is made writes. *Hard* names no `cutThrough`
 * at all rather than naming a third value: the column is left where it was,
 * because under a duration of nought nothing is passed through — and a Scene's
 * and an Exit's own column would refuse the null a Shot is allowed to leave.
 *
 * The two durations are where the clock starts and not what it is: an Author
 * writes over either in the field beside the answer.
 */
export type CutMade = 'hard' | 'image' | 'black'

export const CUT_MADE: Record<CutMade, Partial<Pick<Exit, 'cutOver' | 'cutThrough'>>> = {
  hard: { cutOver: 0 },
  image: { cutOver: 800, cutThrough: 'image' },
  black: { cutOver: 1200, cutThrough: 'black' },
}

export function cutMade(answer: string) {
  return CUT_MADE[answer as CutMade]
}

/**
 * Where a clock starts on the answer that asks for one: four seconds for a beat,
 * which is a Shot read rather than glanced at, and ten for the ways on, which are
 * read and then chosen between.
 */
export const A_TIME_HELD = 4000
export const A_TIME_OFFERED = 10_000

/** A body one of those empty fields is in is a body with no change in it. */
export function wholeCut(body: object) {
  return Object.values(body).every(held => held !== undefined)
}

/**
 * Where a Movement starts when the Author chooses a direction for an Image held
 * still: fifteen percent of the frame, as *A dissolve* starts at 800 ms — the
 * number is where the field starts and not what it is.
 */
export const MOVEMENT_BY_START = 15

export type MovementSaid = Partial<Pick<Shot, 'movementBy' | 'movementDirection' | 'movementOver'>>

/**
 * How an Image moves, read off the two columns that say it: still where it moves
 * by nought, whatever direction stands — *Not at all* leaves it, as *Hard* leaves
 * `cut_through` — its direction otherwise, and on a Shot that says nothing, *as
 * the Scene says*.
 */
export function movementKind(carrier: { movementBy: number | null, movementDirection: MovementDirection | null }) {
  if (carrier.movementBy === 0) return 'still'

  return carrier.movementDirection ?? 'scene'
}

/** How long it takes: as the Scene says, as long as its Shot is on screen, or a time of its own. */
export function movementTakesKind(carrier: { movementOver: number | null }) {
  if (carrier.movementOver === null) return 'scene'

  return carrier.movementOver === 0 ? 'whole' : 'time'
}

/**
 * A field of percent read back as the amount, by `secondsWritten`'s rule: nought
 * is handed back, because *Not at all* is what says it, and an empty field is no
 * change. Anything else is written, and refused by its phrase where it is out of
 * bounds, as the pace is.
 */
export function percentWritten(event: Event, stood: number | null) {
  const field = event.target as HTMLInputElement
  const written = field.valueAsNumber

  if (written) return written
  if (stood && !Number.isNaN(written)) field.value = String(stood)

  return undefined
}

export type EffectSlot = 'imageArrives' | 'imageLasts' | 'textArrives' | 'textLasts'

/**
 * The four sentences a beat says about its Effects, in the order they are read:
 * the Image arriving and staying, then the text arriving and staying. A slot
 * whose Effects are an arrival takes a time always, and one whose are a lasting
 * only where the Effect has a round.
 */
export const EFFECT_SLOTS: {
  slot: EffectSlot, image: boolean, arrives: boolean, effects: readonly string[]
}[] = [
  { slot: 'imageArrives', image: true, arrives: true, effects: IMAGE_ARRIVALS },
  { slot: 'imageLasts', image: true, arrives: false, effects: IMAGE_LASTINGS },
  { slot: 'textArrives', image: false, arrives: true, effects: TEXT_ARRIVALS },
  { slot: 'textLasts', image: false, arrives: false, effects: TEXT_LASTINGS },
]

/**
 * Where a text's times start on the answer that asks for one: a second's wait,
 * the brief fade of a fifth of a second, and three seconds of stay. The fade is
 * also written beside a wait or a unit where the text would otherwise appear at
 * once, because a text that arrives late or by the word and then snaps on is the
 * arrival nobody meant — as *A dissolve* writes its 800 ms.
 */
export const A_TEXT_WAIT = 1000
export const A_TEXT_FADE = 200
export const A_TEXT_STAY = 3000

export type TextSaid = Partial<Pick<Shot, 'textAfter' | 'textBy' | 'textPace' | 'textOver' | 'textStays'>>

export function faded(over: number, body: TextSaid): TextSaid {
  return over === 0 ? { ...body, textOver: A_TEXT_FADE } : body
}

/**
 * A field of characters a second read back as the pace, and nothing where it is
 * empty. A pace out of bounds is written and refused by its phrase.
 */
export function paceWritten(event: Event) {
  const written = (event.target as HTMLInputElement).valueAsNumber

  return Number.isNaN(written) ? undefined : written
}

/**
 * The four answers a text is given, read off the columns that say them. Each of a
 * Shot's is null where it answers as its Scene says, which a Scene's never is —
 * except for how long the text stays, whose null on a Scene is *until the Cut* and
 * on a Shot is the Scene's answer, with nought there the Cut.
 */
export function textArrivesKind(carrier: { textAfter: number | null }) {
  if (carrier.textAfter === null) return 'scene'

  return carrier.textAfter === 0 ? 'image' : 'time'
}

export function textAppearsKind(carrier: { textOver: number | null }) {
  if (carrier.textOver === null) return 'scene'

  return carrier.textOver === 0 ? 'once' : 'time'
}

export function textStaysKind(shot: { textStays: number | null }) {
  if (shot.textStays === null) return 'scene'

  return shot.textStays === 0 ? 'cut' : 'time'
}
