import type { Align, Face, Formatted } from './formatted'
import type { Phrase } from './phrases'

/**
 * The longest name a Scene may carry, and the longest text a Shot may hold.
 * Shared so the server's rejection and the form's own limit cannot drift apart.
 * A Shot is one beat on screen, not a chapter, so its text is capped well below
 * what Postgres would take.
 */
export const SCENE_NAME_MAX_LENGTH = 200
export const SHOT_TEXT_MAX_LENGTH = 2000

/** What a bar hides, said to a Reader who cannot see it, as a phrase like an Exit's line. */
export const REDACTION_HIDES_MAX_LENGTH = 120

/**
 * What a Cut's three times are capped at, in milliseconds. A Shot standing
 * longer than a minute is a Shot waiting for a press, a dissolve past five
 * seconds is a Scene of its own, and a choice left standing longer than a minute
 * is not under a clock. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 *
 * And what the two a clock runs are held to above nought. A clock cutting sooner
 * than half a second changes the screen more than twice in one, which over a
 * white Image and a black one is past the three flashes WCAG 2.3.1 allows; at
 * half a second it is one flash a second whatever the Images are. A cut's own
 * length has no floor, because a dissolve makes the screen change no more often.
 */
export const CUT_AFTER_MAX = 60_000
export const CUT_OVER_MAX = 5_000
export const EXITS_AFTER_MAX = 60_000
export const CUT_AFTER_MIN = 500
export const EXITS_AFTER_MIN = 500

/** What a cut passes through: the outgoing Shot, or black. */
export type CutThrough = 'image' | 'black'
export const CUT_THROUGHS: readonly CutThrough[] = ['image', 'black']

/** How a Shot is laid out: in the reading column, or covering the room. */
export type Layout = 'inset' | 'full'
export const LAYOUTS: readonly Layout[] = ['inset', 'full']

/** The `object-position` an Image is cropped at, read wherever the product crops one. */
export function cropPosition({ cropX, cropY }: { cropX: number, cropY: number }) {
  return `${cropX}% ${cropY}%`
}

/**
 * How far an Image may move, in whole percent of the frame, and how long a
 * Movement may take. Past half again the frame at its closest shows less than
 * half the Image, which is a closer Image and a second Shot. A minute is the
 * longest the clock holds a Shot.
 */
export const MOVEMENT_BY_MAX = 50
export const MOVEMENT_OVER_MAX = CUT_AFTER_MAX

/** How long *as long as its Shot is on screen* is for a Shot held until the press. */
export const MOVEMENT_OVER_UNTIMED = 10_000

/**
 * Which way an Image moves, named for what it does on screen: *left* is the Image
 * sliding left and showing more of its right side, which is what the Reader sees.
 */
export type MovementDirection = 'closer' | 'away' | 'left' | 'right' | 'up' | 'down'
export const MOVEMENT_DIRECTIONS: readonly MovementDirection[] =
  ['closer', 'away', 'left', 'right', 'up', 'down']

/**
 * Whether a value is a time this product writes: a whole number of milliseconds
 * from its floor to its cap. Here rather than at the request boundary because the
 * bench holds a field to exactly what the server will take, and one function is
 * how the two cannot come apart.
 */
export function isTime(held: unknown, max: number, min = 0): held is number {
  return typeof held === 'number' && Number.isInteger(held) && held >= min && held <= max
}

/**
 * What may happen to a Shot's Image or to its whole text, each named where it
 * means something: an Arrival plays once as the beat arrives, over a time, and a
 * Lasting plays for as long as it stands. The text is offered fewer than the
 * Image because a blur and a shake are read on words, while white, colour, a
 * vignette and grain are said of a picture. A run of the words is offered what
 * the text is, plus the three Effects that take it apart letter by letter.
 */
export type Strength = 'slight' | 'marked' | 'strong'
export const STRENGTHS: readonly Strength[] = ['slight', 'marked', 'strong']

export const IMAGE_ARRIVALS = ['shake', 'from-blur', 'from-white', 'into-colour', 'out-of-colour', 'closing-in'] as const
export const TEXT_ARRIVALS = ['shake', 'from-blur'] as const
export const RUN_ARRIVALS = ['shake', 'from-blur', 'scramble'] as const
export const IMAGE_LASTINGS = ['flicker', 'pulse', 'tremor', 'grain'] as const
export const TEXT_LASTINGS = ['flicker', 'pulse', 'tremor'] as const
export const RUN_LASTINGS = ['flicker', 'pulse', 'tremor', 'wave'] as const

export type Arrival = {
  effect: (typeof IMAGE_ARRIVALS | typeof RUN_ARRIVALS)[number], over: number, strength: Strength
}

/** A flicker keeps one pace and grain has none to tell, so neither carries a round. */
export type Lasting =
  | { effect: 'pulse' | 'tremor' | 'wave', every: number, strength: Strength }
  | { effect: 'flicker' | 'grain', strength: Strength }

export type EffectCarrier = 'image' | 'text' | 'run'

/**
 * How many letters one Shot's runs may take apart for a scramble, a wave or a
 * tremor. Each letter taken apart is an element and, while it moves, a layer, and
 * three hundred is seven lines at the reading measure — more than any emphasis.
 * Counted over the whole Shot, a letter under two such marks once, because a cap
 * per run is a cap many runs add up past.
 */
export const LETTERS_SPLIT_MAX = 300

/**
 * What an Effect's time is held between, in milliseconds. Under a tenth of a
 * second an arrival is six frames nobody sees, and one that stops by five seconds
 * never needs the pause WCAG 2.2.2 asks for; under a fifth of a second a round is
 * a buzz and not a rhythm, and past four seconds it is not read as one at all.
 */
export const ARRIVES_OVER_MIN = 100
export const ARRIVES_OVER_MAX = 5_000
export const LASTS_EVERY_MIN = 200
export const LASTS_EVERY_MAX = 4_000

const ARRIVALS: Record<EffectCarrier, readonly string[]> = { image: IMAGE_ARRIVALS, text: TEXT_ARRIVALS, run: RUN_ARRIVALS }
const LASTINGS: Record<EffectCarrier, readonly string[]> = { image: IMAGE_LASTINGS, text: TEXT_LASTINGS, run: RUN_LASTINGS }
const PACED: readonly string[] = ['pulse', 'tremor', 'wave']

/** Whether an object holds exactly these keys, so a key its effect does not take is refused rather than stored. */
function holdsExactly(held: object, keys: readonly string[]) {
  const own = Object.keys(held)
  return own.length === keys.length && keys.every(key => own.includes(key))
}

function isObject(held: unknown): held is Record<string, unknown> {
  return typeof held === 'object' && held !== null && !Array.isArray(held)
}

/**
 * Whether a value is an Arrival offered to this carrier. Here for the reason
 * `isTime` is, so the bench and the door cannot disagree.
 */
export function isArrival(held: unknown, carrier: EffectCarrier): held is Arrival {
  return isObject(held)
    && holdsExactly(held, ['effect', 'over', 'strength'])
    && ARRIVALS[carrier].includes(held.effect as string)
    && isTime(held.over, ARRIVES_OVER_MAX, ARRIVES_OVER_MIN)
    && STRENGTHS.includes(held.strength as Strength)
}

/** Whether a value is a Lasting offered to this carrier, with a round exactly where its effect has one. */
export function isLasting(held: unknown, carrier: EffectCarrier): held is Lasting {
  if (!isObject(held)) return false
  const paced = PACED.includes(held.effect as string)

  return holdsExactly(held, paced ? ['effect', 'every', 'strength'] : ['effect', 'strength'])
    && LASTINGS[carrier].includes(held.effect as string)
    && (!paced || isTime(held.every, LASTS_EVERY_MAX, LASTS_EVERY_MIN))
    && STRENGTHS.includes(held.strength as Strength)
}

/**
 * How fast a Reader reads, at about 200 words a minute — a measured rate rather
 * than an invented one. It is the pace a text arrives at where a Scene says
 * nothing, which is why it is here rather than beside the Remark that first
 * read it: the schema's default reads it too, so the pace a text arrives at by
 * default and the pace the bench reckons it is read at cannot come apart. See
 * `app/utils/remarks.ts` for the margin the bench complains at.
 */
export const CHARACTERS_A_SECOND = 15

/**
 * What a Shot's text arrives by: all at once, or a line, a word or a letter at a
 * time. A line is a line break the Author typed, a word a run of anything but
 * white space as `wordsOf` counts it, and a letter a grapheme.
 */
export type TextBy = 'whole' | 'line' | 'word' | 'letter'
export const TEXT_BYS: readonly TextBy[] = ['whole', 'line', 'word', 'letter']

/**
 * What a text's times are capped at, in milliseconds, and the pace it arrives at,
 * in characters a second. An Image alone for longer than ten seconds is two beats,
 * which two Shots already write; past sixty characters a second a 60 Hz screen
 * draws more than a letter a frame; a part taking longer than three seconds to
 * appear is invisible for longer than a line takes to read; and a text staying
 * longer than a minute stays. See `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
 */
export const TEXT_AFTER_MAX = 10_000
export const TEXT_PACE_MIN = 1
export const TEXT_PACE_MAX = 60
export const TEXT_OVER_MAX = 3_000
export const TEXT_STAYS_MAX = 60_000

/**
 * Whether a value is a pace this product writes: a whole number of characters a
 * second within bounds.
 */
export function isPace(held: unknown): held is number {
  return typeof held === 'number' && Number.isInteger(held)
    && held >= TEXT_PACE_MIN && held <= TEXT_PACE_MAX
}

/**
 * The longest Description an Image may carry. A Description says what one frame
 * shows, in the sentence an editor would say it in, so it is capped near an Exit's
 * line rather than near a Shot's text: prose about the image is the Shot's text,
 * which the Reader already has.
 */
export const SHOT_DESCRIPTION_MAX_LENGTH = 250

/**
 * The image formats a Shot may carry, each named by the bytes a file of it starts
 * with: an offset, and the bytes that must sit at it. Which formats there are and
 * how each is recognised is one statement rather than two, so a format added here
 * cannot be a format the picker offers and the server refuses.
 *
 * An animated GIF is left out on purpose: a Shot is one image and its text,
 * so a moving one would be a beat that plays itself. A Movement is not that. The
 * Image stays one picture, moved in the frame by what the Author wrote on the
 * Story, and the Pause stops it.
 */
const SHOT_IMAGE_SIGNATURES: Record<string, [number, number[]][]> = {
  'image/jpeg': [[0, [0xFF, 0xD8, 0xFF]]],
  'image/png': [[0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]],
  // A WebP is a RIFF container, and the form name that makes it one sits four
  // bytes past the length that follows the tag.
  'image/webp': [[0, [0x52, 0x49, 0x46, 0x46]], [8, [0x57, 0x45, 0x42, 0x50]]],
}

export const SHOT_IMAGE_TYPES = Object.keys(SHOT_IMAGE_SIGNATURES)

/**
 * The most one image may weigh. Two megabytes is a photograph at screen size and
 * not a master: enough for what a Shot shows, and small enough that the bytes can
 * sit in the Shot's own row.
 */
export const SHOT_IMAGE_MAX_BYTES = 2 * 1024 * 1024

/** `IMG_2` before `IMG_10`, and `a` beside `A`: the order a camera or an export numbers its files in. */
const BY_NAME = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Several files picked or dropped on a Scene at once, as the Shots they become:
 * in the order of their names rather than the order the system handed them over
 * in, and without the ones a Shot cannot carry, each left out with the sentence
 * that says why. Read off the type and the weight the browser reports, which is
 * a courtesy and not the guard — the server still reads the bytes.
 */
export function imagesForShots<File extends { name: string, type: string, size: number }>(files: File[]) {
  const taken: File[] = []
  const leftOut: { file: File, why: 'refusals.imageType' | 'refusals.imageHeavy' }[] = []

  for (const file of [...files].sort((one, other) => BY_NAME.compare(one.name, other.name))) {
    if (!SHOT_IMAGE_TYPES.includes(file.type)) leftOut.push({ file, why: 'refusals.imageType' })
    else if (file.size > SHOT_IMAGE_MAX_BYTES) leftOut.push({ file, why: 'refusals.imageHeavy' })
    else taken.push(file)
  }

  return { taken, leftOut }
}

/**
 * What an image really is, read from its own first bytes rather than from what the
 * upload said it was. The content type of an upload is the client's to write, and
 * the bytes are served back under whatever type we believe, so trusting it would
 * let a Shot serve one thing under the name of another. A head none of the
 * formats owns is what "rejects anything else" refuses.
 */
export function imageTypeOf(bytes: Uint8Array) {
  return SHOT_IMAGE_TYPES.find(type => SHOT_IMAGE_SIGNATURES[type]!.every(
    ([offset, signature]) => signature.every((byte, at) => bytes[offset + at] === byte)))
}

/**
 * Where a Shot's image is served. The bytes never travel with the Story — a Story
 * of fifty Shots would be fifty images in one response — so what the Story
 * carries is this address, and null for a Shot that has no image.
 */
export function shotImageUrl(shotId: string) {
  return `/api/shots/${shotId}/image`
}

/**
 * The longest text an Exit may carry. An Exit is one line the Reader is offered at
 * the end of a Scene, so it is capped far below a Shot.
 */
export const EXIT_TEXT_MAX_LENGTH = 200

/**
 * How many Conditions one Exit or one Shot may carry. Four tests is a way on — or
 * a beat — with a history behind it; past that, what the Author is describing is
 * not a nuance on a cut but a place in the Story several threads reach, and the
 * answer is a Scene — see `docs/adr/0004-conditions-stay-flat.md`. One cap for
 * both, because what is being bounded is how long a list of flat tests may get
 * before it stops being one an Author can read.
 */
export const CONDITIONS_MAX = 4

/**
 * The longest a Flag's name and its value may be, and how many Flags one Scene
 * may set on entry. A Flag is a short named value, not a place to keep prose,
 * and a Scene setting a score of them is a Story keeping State its graph should
 * be keeping.
 *
 * There is no cap on entries beside them any more. A Condition bounded how many
 * of them it could count, because a Story could be read round and round; a
 * Reading now stands in a Scene at most once, so there is nothing left to bound
 * — see `docs/adr/0048-a-scene-is-entered-once.md`.
 */
export const FLAG_NAME_MAX_LENGTH = 60
export const FLAG_VALUE_MAX_LENGTH = 200
export const FLAGS_PER_SCENE = 20

/**
 * How long the sentence a Scene puts to the Reader may be. A Question is one
 * sentence over one field, read where the Exits are read, so it is held to the
 * length of a Description rather than of a Shot's text.
 */
export const QUESTION_MAX_LENGTH = 250

/**
 * How many values one Flag may be given to draw from. Two at the least — a line
 * with no separator is a plain value and stays one — and six at the most: a draw
 * is a beat coming back differently, not a table an Author rolls on. Past half a
 * dozen variants of one Shot, what is being described is not a variation on a
 * beat but several beats, and the answer to that is Scenes, the same way it is
 * for an Exit needing more Conditions than `CONDITIONS_MAX` allows. Measured per
 * value rather than per line: each value is held to `FLAG_VALUE_MAX_LENGTH` on
 * its own.
 */
export const FLAG_VALUES_MAX = 6

/**
 * The columns a Story falls into, as the ids in each, which is the one walk the
 * whole of this file's reading of a Story is made of.
 *
 * The Opening Scene stands alone in the first column, the Scenes its ways on lead
 * to make the column after it, theirs the column after that, each Scene in the
 * first column it is reached in — its distance from the opening, in Exits taken.
 * Within a column the Scenes stand in the order they were reached: by the Scene
 * offering them first, then in the Place that Scene offers them at. So a Story
 * read from its opening is read one column at a time, and two ways on out of one
 * Scene stand side by side in the column after it, in the order the Reader is
 * offered them.
 *
 * A Scene no Exit reaches — one the Author has just written, or one whose only
 * way in was taken away — is walked too, in the columns after the last one the
 * opening reaches, each cluster of them read from its own first Scene the same
 * way. A Story with no Opening Scene is read from its first Scene, so every Story
 * that has a Scene in it has columns.
 *
 * Private, and the two exports below are the two things it answers: the shape the
 * Graph is drawn as, and the order a Story is written in. One walk rather than
 * two, because two walks are two facts, and the day they disagree the order a
 * Story reads in and the shape it is drawn as are saying different things about
 * one Story — see `docs/adr/0043-a-story-is-written-as-one-document.md`.
 */
function columnsOf(scenes: Scene[], exits: Exit[], openingSceneId: string | null) {
  const columns: string[][] = []
  const placedIn = new Map<string, number>()
  const known = new Set(scenes.map(scene => scene.id))

  // Walks everything reachable from one Scene, breadth first, from the column
  // given. A Scene already placed — by an earlier cluster, or by a way on that
  // comes back on itself — stays in the column it was first reached in.
  function layer(from: string, depth: number) {
    if (placedIn.has(from)) return
    let edge = [from]
    placedIn.set(from, depth)
    while (edge.length) {
      ;(columns[depth] ??= []).push(...edge)
      const next: string[] = []
      for (const id of edge) {
        for (const exit of exitsFrom(exits, id)) {
          if (!known.has(exit.toSceneId) || placedIn.has(exit.toSceneId)) continue
          placedIn.set(exit.toSceneId, depth + 1)
          next.push(exit.toSceneId)
        }
      }
      edge = next
      depth++
    }
  }

  if (openingSceneId && known.has(openingSceneId)) layer(openingSceneId, 0)
  for (const scene of scenes) layer(scene.id, columns.length)

  return columns
}

/**
 * The Scenes of a Story column by column, which is how the rail down the side of
 * the bench draws it: the columns run down the page and the Scenes of a column run
 * across it — see `docs/adr/0043-a-story-is-written-as-one-document.md`.
 *
 * The same walk `inDocumentOrder` is flattened out of, handed back as Scenes
 * rather than as ids because what the rail puts on screen is a Scene's name and
 * what the document does with it is its whole body. A Story with no Scene in it
 * has no columns, not one empty one.
 */
export function inColumns(scenes: Scene[], exits: Exit[], openingSceneId: string | null) {
  const named = new Map(scenes.map(scene => [scene.id, scene]))

  return columnsOf(scenes, exits, openingSceneId)
    .map(column => column.map(id => named.get(id)!))
}

/**
 * The Scenes of a Story in the order they are written in: the Opening Scene, then
 * each Scene in the first column it is reached in, and within a column in the
 * order the Reader is offered it, then the Scenes nothing arrives at.
 *
 * The columns read one after another, which is the rail's own drawing taken as a
 * sequence rather than as a picture: the columns run down the rail and the Scenes
 * of a column run across it, so reading the document from the top is reading the
 * rail the way it is drawn. The order a Story is written in and the shape it is
 * drawn as are one walk here rather than one reading the other's output: neither
 * is derived from the other, both are `columnsOf`, and there is no arrangement of
 * the two that can drift apart — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 */
export function inDocumentOrder(scenes: Scene[], exits: Exit[], openingSceneId: string | null) {
  return inColumns(scenes, exits, openingSceneId).flat()
}

/**
 * How many words the Shots of a Scene hold, which is the one count an Author
 * writing prose asks of a document. The Shots' text alone — not the Scene's
 * name, not what the Reader presses to take a way on — so the figure is an
 * editorial one, the way the one tool of nineteen in
 * `docs/research/2026-08-27-paysage-concurrentiel.md` that counts at all gives
 * it. Counted as runs of anything but whitespace, which is what a word is in
 * every language the interface is read in.
 */
export function wordsOf(shots: Shot[]) {
  return shots.reduce((words, shot) => words + (shot.text.match(/\S+/g)?.length ?? 0), 0)
}

/**
 * A Story as the Author edits it: Scenes in the order they were written, each a
 * run of Shots and the Flags it sets, and the Exits that
 * join them, each in the Place it is offered at and with the Conditions it is
 * offered under. A Story with no Scenes has no opening Scene, and neither has
 * one whose opening Scene was deleted. `publishedAt` is null until the Story is
 * published, and null again once it is unpublished; it arrives as a string
 * because that is what JSON makes of a timestamp.
 *
 * A Shot's `image` is where its image is served, not the image itself, and null
 * for a Shot that is text alone. Its `description` is what that image shows, for
 * a Reader who cannot see it, and empty where the Author has written none. Its
 * `conditions` are the tests it plays under, an empty list being a Shot every
 * Reading sees.
 */
export type Shot = {
  id: string
  text: string
  /** The text as formatted; never null, a plain text being read as one line a line. */
  formatted: Formatted
  position: number
  image: string | null
  description: string
  conditions: Condition[]
  /** Where the Sound this Shot strikes with is served, or null where it strikes with none. */
  sound: string | null
  /** What that Sound makes heard, empty where nobody has written it down. */
  transcript: string
  /** This Shot's own answer about how it leaves the screen; null is *as the Scene says*. */
  cutAfter: number | null
  cutOver: number | null
  cutThrough: CutThrough | null
  /** How this Shot is laid out; null is *as the Scene says*. */
  layout: Layout | null
  /**
   * The point the Image is cropped around, in whole percent across from the
   * leading edge and down from the top: 50 by 50 is the centre, and what a Shot
   * is until an Author moves it.
   */
  cropX: number
  cropY: number
  /**
   * How this Shot's Image moves while it is on screen, each null being *as the
   * Scene says*. A `movementBy` of nought is this Image held still under a Scene
   * whose Images move, and a `movementOver` of nought is as long as this Shot is
   * on screen. See `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
   */
  movementBy: number | null
  movementDirection: MovementDirection | null
  movementOver: number | null
  /** What the Image plays as the beat arrives, and while it stands; null is none. */
  imageArrives: Arrival | null
  imageLasts: Lasting | null
  /** The same of the whole text. */
  textArrives: Arrival | null
  textLasts: Lasting | null
  /**
   * How this Shot's text arrives and how long it stays, each null being *as the
   * Scene says*. A `textStays` of nought is this text staying until the Cut, the
   * one answer a Shot under a Scene whose texts leave has no other way to give.
   */
  textAfter: number | null
  textBy: TextBy | null
  textPace: number | null
  textOver: number | null
  textStays: number | null
}
export type Scene = {
  id: string
  name: string
  sets: Sets
  shots: Shot[]
  /** Where the Sound this Scene carries is served, or null where it carries none of its own. */
  sound: string | null
  /** The Scene this one is heard under instead, or null. */
  soundOfSceneId: string | null
  /** What the Sound makes heard, and whether it is held in a loop: both the carrier's. */
  transcript: string
  soundLoops: boolean
  /** How the Shots of this Scene's run are cut, and how long its ways on stand. */
  cutAfter: number | null
  cutOver: number
  cutThrough: CutThrough
  exitsAfter: number | null
  /** How the Shots of this Scene's run are laid out, each Shot answering for itself where it says. */
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
   * How the texts of this Scene's run arrive — after a time, by a unit, at a pace,
   * over a time — and how long they stay, null being until the Cut. See
   * `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
   */
  textAfter: number
  textBy: TextBy
  textPace: number
  textOver: number
  textStays: number | null
  /**
   * The sentence this Scene puts to the Reader once its run has played and before
   * its Exits, and the Flag the Reader's answer is held under. Both are empty on a
   * Scene that asks nothing.
   */
  question: string
  questionFlag: string
}
export type Exit = {
  id: string
  fromSceneId: string
  toSceneId: string
  text: string
  position: number
  conditions: Condition[]
  /**
   * Whether a Reading steps back across this Exit, or null for the Exit
   * answering as its Story says — which is what every Exit answers until an
   * Author says otherwise. See
   * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
   */
  stepsBack: boolean | null
  /** The passage from the Scene this Exit leaves to the Scene it lands on. */
  cutOver: number
  cutThrough: CutThrough
}

/**
 * The Flags one Reading holds, as names to values. Flat, because a Flag is a
 * single named value: nothing here holds another map. What a Scene declares is
 * `Sets` below, which may name several values for one Flag.
 */
export type Flags = Record<string, string>

/**
 * The Flags a Scene declares, which is not quite the Flags a Reading holds: a
 * name may be given several values, and one of them is drawn each time a Reading
 * enters the Scene. What carries the list is the declaration on the Scene; the
 * State holds the value drawn, so `Flags` above stays a single named value
 * apiece and the glossary's Flag stays what it says it is.
 */
export type Sets = Record<string, string | string[]>

/**
 * What separates a Flag's name from its value where the server reads them, and
 * what separates one value of a draw from the next. No Author types either of
 * them any more — the Flags a Scene sets are written as rows, a name and its
 * values apiece — but the server goes on refusing a name or a value holding one,
 * so that what a Scene stores can never be mistaken for two things where a pair
 * is written out flat.
 */
export const FLAG_SEPARATOR = '='
export const FLAG_VALUES_SEPARATOR = '|'

/**
 * One Flag as it is written: a name, and the values one of which is drawn on
 * each entry. A row rather than an entry of the Graph, because a row is written
 * before it is whole — a name with no value yet, a value being retyped — and the
 * Graph holds only the Flags a Scene actually sets.
 */
export type FlagRow = { name: string, values: string[] }

/** The Flags a Scene sets, as the rows an Author reads them in. */
export function flagRows(sets: Sets): FlagRow[] {
  return Object.entries(sets).map(([name, held]) => ({
    name,
    values: Array.isArray(held) ? [...held] : [held],
  }))
}

/**
 * The Flags the rows amount to, with the half-written ones left out: a row with
 * no name, or none of whose values has been typed, is half a Flag, which the
 * server is right to refuse — and dropping it beats holding back the rest, the
 * way a half-written Condition is dropped from the list it is in.
 *
 * A row left with one value is a plain value and not a list of one, which is what
 * keeps a Scene naming a single value stored as it always was. A name typed twice
 * holds what the later row gave it.
 */
export function flagsSet(rows: FlagRow[]): Sets {
  return Object.fromEntries(rows.flatMap(({ name, values }) => {
    const held = values.map(value => value.trim()).filter(Boolean)
    const flag = name.trim()

    return flag && held.length ? [[flag, held.length > 1 ? held : held[0]!] as const] : []
  }))
}

/**
 * The ways on leaving one Scene, in the Places it numbers them at. Taken by id
 * rather than by the Scene, because the disc drawn on an Exit's line asks this
 * too and it has only the id the Exit carries — and because the graph and the
 * panel both ask it: one answer, so the number in the node and the number on the
 * bench cannot say two different things.
 */
export function exitsFrom(exits: Exit[], sceneId: string) {
  return exits.filter(exit => exit.fromSceneId === sceneId)
}

/**
 * A list of Conditions with the half-written rows left out. A row whose Flag has
 * no name is half a Condition, which the server is right to refuse, and dropping
 * it beats holding back the rest — a Condition taken off has to reach the Story
 * whatever else the Author is in the middle of typing.
 *
 * One function, because every route that sends a list sends it from a surface the
 * Author may be halfway through: the row they are still naming would otherwise
 * take the whole list down with it, and an Exit duplicated at that moment — from
 * its own line, away from the Conditions written beside the Scene — would arrive
 * carrying nothing.
 */
export function wholeConditions(carried: Condition[]) {
  return carried.filter(condition => !('flag' in condition) || condition.flag.trim())
}

/**
 * The sequence with one id moved a Place, which is what the two controls that
 * renumber a thing send. Each is disabled at the end it cannot move past, so the
 * Place swapped with is always one of the sequence's own.
 *
 * Shared because the ways on are renumbered from two screens now — the strip
 * beside the Scene and the choice buttons in the reading — and an order that
 * moved one way in one and another way in the other would be two products.
 */
export function movedBy(ids: string[], id: string, step: -1 | 1) {
  const from = ids.indexOf(id)
  const moved = [...ids]
  moved[from] = ids[from + step]!
  moved[from + step] = id

  return moved
}

/**
 * Where a deleted Shot is put back in the run it left: right after the Shot that
 * stood before it while that Shot is still in the run, at the head where nothing
 * stood before it, and otherwise at the Place it had, capped at the run's length.
 * The bench draws the row a deleted Shot leaves where this says, and
 * `server/api/shots/[id]/back.post.ts` writes the same rule in its one statement,
 * so *Put It Back* lands where the row stood — see
 * `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`.
 */
export function placeBack(run: string[], after: string | null, place: number) {
  if (after === null) return 0

  const before = run.indexOf(after)
  return before === -1 ? Math.min(place, run.length) : before + 1
}

/**
 * `1 Shot` and `2 Shots`: a card counts them, and a Delete asks about them. One
 * phrase a count rather than a suffix on a noun, because a plural is not a letter
 * added in every language the interface is read in.
 */
export function countedShots(many: number, say: Phrase) {
  return say(many === 1 ? 'editor.oneShot' : 'editor.manyShots', { count: many })
}

export function countedExits(many: number, say: Phrase) {
  return say(many === 1 ? 'editor.oneExit' : 'editor.manyExits', { count: many })
}

/**
 * `1 Scene` and `40 Scenes`, which the bench says of the Story beside the
 * document — see `docs/adr/0043-a-story-is-written-as-one-document.md`. Beside the
 * other three rather than spelled out where it is said, because a count of the
 * work is a count of the work in whichever language the interface is read in.
 */
export function countedScenes(many: number, say: Phrase) {
  return say(many === 1 ? 'editor.oneScene' : 'editor.manyScenes', { count: many })
}

/**
 * How many Exits arrive at one Scene, which its slate in the document says under
 * its name. The zero has a sentence of its own rather than a count of none: a
 * Scene nothing arrives at is a Scene no Reader ever gets to, which is a thing the
 * bench says in words — the rail marks it, a Remark says it, and the document says
 * it where the Author is reading. `0 Exits arrive here` is arithmetic; *Nothing
 * arrives here* is what it means.
 */
export function countedArrivals(many: number, say: Phrase) {
  if (!many) return say('editor.noArrival')

  return say(many === 1 ? 'editor.oneArrival' : 'editor.manyArrivals', { count: many })
}

/** `1 word` and `120 words`, which the heading over a Scene's Shots reads — see `wordsOf`. */
export function countedWords(many: number, say: Phrase) {
  return say(many === 1 ? 'editor.oneWord' : 'editor.manyWords', { count: many })
}

/**
 * What the bench calls each Scene of a Story: its id to the name every control
 * naming that Scene is named by. The Author's own name where one Scene carries
 * it, and that name with a number after it where several do.
 *
 * The number is drawn here and never written back — what the Story holds is
 * still what the Author typed — in the order the Story is written in, and past
 * any name a Scene of the Story already answers to, so no two names this hands
 * back are alike. Why the bench numbers a name rather than refusing it, and how
 * far the rule reaches, is
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
 */
export function namesOnTheBench(story: StoryInEditor, say: Phrase) {
  const alike = new Map<string, number>()
  for (const scene of story.scenes) alike.set(scene.name, (alike.get(scene.name) ?? 0) + 1)

  // The names already spoken for: a name one Scene alone carries is drawn as the
  // Author typed it, so no number may ever land on it.
  const taken = new Set([...alike].filter(([, many]) => many === 1).map(([name]) => name))
  const counted = new Map<string, number>()
  const names = new Map<string, string>()
  for (const scene of inDocumentOrder(story.scenes, story.exits, story.openingSceneId)) {
    if (alike.get(scene.name) === 1) {
      names.set(scene.id, scene.name)
      continue
    }

    let number = (counted.get(scene.name) ?? 0) + 1
    let drawn = say('editor.namedAlike', { name: scene.name, number })
    while (taken.has(drawn)) {
      drawn = say('editor.namedAlike', { name: scene.name, number: ++number })
    }

    counted.set(scene.name, number)
    taken.add(drawn)
    names.set(scene.id, drawn)
  }

  return names
}

/**
 * A name with its accents taken off and its case flattened, which is what both
 * sides of every match on a name are read as — the bar of Commands, the field
 * a way on is written in, the one a Shot is moved by. An Author reaching for *Le
 * café* types `cafe` as often as `café` — it is the same word, and one of the two
 * spellings is on every keyboard — so the Scene has to answer to both. `NFD`
 * splits an accented letter into the letter and the mark that sits on it, and the
 * marks are what is dropped.
 */
export function plainly(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
}

/**
 * A Flag's value as a Condition compares it: read `plainly`, trimmed, and every
 * run of white space read as one space. A Reader answering *Rosebud*, *rosebud *
 * or *Rosébud* has given the answer an Author wrote as `rosebud`, and a riddle is
 * failed on the riddle, not on a capital letter. A value of spaces alone folds to
 * the empty value, which is no value. Values only: a Flag's name stays exact. See
 * `docs/adr/0066-a-scene-may-end-on-a-question.md`.
 */
export function folded(value: string) {
  return plainly(value).trim().replace(/\s+/g, ' ')
}

/**
 * The Scene a Shot is moved to, from the name typed in the field under its marks:
 * the name as the bench calls a Scene, typed as it is shown before as `plainly`
 * folds it, so two names that fold alike are told apart by whoever types one of
 * them exactly. The names are the bench's and not the Author's, because the list
 * the field offers is the bench's: two Scenes called *The bar* answer to *The bar
 * (1)* and *The bar (2)*, and the name they share answers to neither.
 *
 * What it refuses it refuses with the sentence said under the field, and nothing
 * is sent: a name no Scene answers to is not a Scene to write, because a beat moved
 * somewhere new would land in a Scene nothing arrives at, and the Scene the Shot
 * stands in is not a move.
 */
export function sceneToMoveTo(names: Map<string, string>, fromSceneId: string, typed: string) {
  const looked = typed.trim()
  const named = [...names]
  const [sceneId] = named.find(([, name]) => name === looked)
    ?? named.find(([, name]) => plainly(name) === plainly(looked))
    ?? []

  if (!sceneId) return { refused: 'editor.noSceneToMoveTo' } as const
  if (sceneId === fromSceneId) return { refused: 'editor.alreadyInScene' } as const
  return { sceneId }
}

/**
 * A Scene read by name where something else names it — the far side of an Exit, the
 * count a Condition asks for. A Condition still names a Scene deleted since it
 * was written, and saying so beats showing the Author the id it holds. One
 * function, because a Scene named one way in the ways on offered and another way
 * in the ways on hidden is two products.
 */
export function sceneNamed(names: Map<string, string>, sceneId: string, say: Phrase) {
  return names.get(sceneId) ?? say('scene.gone')
}

/** What the bench calls one Exit: its Place out of the Scene it leaves, and the bench's names for both ends. */
export type ExitOnTheBench = {
  place: number
  from: string
  scene: string
  toSceneId: string
  text: string
}

/**
 * Every Exit of the Story, in the order the Story is written in and each Scene's
 * in its Places. An Exit has no name of its own — see `CONTEXT.md` — so the bench
 * names it by its Place out of the Scene it leaves: the Places the writing shows
 * and the Remarks count, because all of them read `exitsFrom`. The names of the
 * Scenes at both ends are the bench's own, so a Scene called twice is told apart
 * here as it is everywhere.
 */
export function exitsOnTheBench(story: StoryInEditor, names: Map<string, string>) {
  const called = new Map<string, ExitOnTheBench>()
  for (const scene of inDocumentOrder(story.scenes, story.exits, story.openingSceneId)) {
    exitsFrom(story.exits, scene.id).forEach((exit, place) => called.set(exit.id, {
      place: place + 1,
      from: names.get(scene.id)!,
      scene: names.get(exit.toSceneId)!,
      toSceneId: exit.toSceneId,
      text: exit.text,
    }))
  }

  return called
}

/** An Exit as an option of the field a Condition names it in. */
export function exitOption(called: ExitOnTheBench | undefined, say: Phrase) {
  if (!called) return say('exit.goneOption')
  return say(called.text ? 'exit.optionSays' : 'exit.option', called)
}

/** An Exit as a sentence names it. */
export function exitCalled(called: ExitOnTheBench | undefined, say: Phrase) {
  return called ? say('exit.called', called) : say('exit.gone')
}

/**
 * How an Exit is named where it is read rather than edited. An Exit nobody has
 * phrased yet, or one whose words are white space alone, as a said text leaves
 * it, is named by where it lands: an unphrased Exit is half of what a
 * Preview is for, and a Reading that cannot go on is the worse answer. Shared,
 * because a Preview names the ways on a Condition is hiding in the same breath
 * as the ones on offer, and the two must read alike.
 */
export function exitNamed(exit: Exit, sceneName: (id: string) => string, say: Phrase) {
  return exit.text.trim() ? exit.text : say('exit.to', { scene: sceneName(exit.toSceneId) })
}

/**
 * Whether a Reading standing in one Scene can come to stand in another by the
 * ways on already written. A Scene reaches itself, because that is where the
 * Reading already stands.
 *
 * Beside the walk the columns are made of rather than inside it: the columns are
 * a picture of the whole Story, and this is one question about two Scenes,
 * walked from one of them and stopped the moment it has its answer. The Scenes
 * walked through are carried, so a Story written before
 * `docs/adr/0048-a-scene-is-entered-once.md` and still holding a cycle is
 * answered rather than walked for ever.
 *
 * It is the refusal that record asks for: a way on from A to B is refused
 * exactly when B already reaches A, which is to say when it is the one closing a
 * cycle. Because that is the test and not a rule about columns, a way on written
 * today can never make one written earlier illegal — the record carries the
 * worked example.
 *
 * One reading of the rule in the product: the bench withholds a landing with it,
 * and the server refuses a way on with it, rather than the boundary holding a
 * second copy of it in SQL.
 */
export function reaches(exits: Exit[], from: string, to: string) {
  const walked = new Set([from])
  const edge = [from]

  while (edge.length) {
    const standing = edge.pop()!
    if (standing === to) return true

    for (const exit of exitsFrom(exits, standing)) {
      if (walked.has(exit.toSceneId)) continue
      walked.add(exit.toSceneId)
      edge.push(exit.toSceneId)
    }
  }

  return false
}

/**
 * The Scenes an Exit leaving one Scene may land on: every Scene in the Story bar
 * the ones it already reaches and the ones that reach it, which is the Scene it
 * leaves and everything a Reading could have come through to get there. It is
 * what lights up while an Exit is being drawn, and it is fixed the moment the
 * gesture begins — it depends on the departing Scene and the Exits of the Story,
 * and neither changes under the Author's hand.
 *
 * A Scene that reaches this one is withheld because the server refuses it: a way
 * on that leads back is not a slip the hand is saved from but a Story the product
 * says cannot exist — see `docs/adr/0048-a-scene-is-entered-once.md`. The one
 * slip still withheld here and allowed there is a second Exit to a Scene this one
 * already reaches, which under opposite Conditions is what Conditions on an Exit
 * are for: what the hand cannot do by accident is still written on purpose, from
 * the Exit's own row — see `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 */
export function scenesAExitMayLandOn(scenes: Scene[], exits: Exit[], fromSceneId: string) {
  const reached = new Set(
    exits.filter(exit => exit.fromSceneId === fromSceneId).map(exit => exit.toSceneId))

  return new Set(scenes.map(scene => scene.id)
    .filter(id => !reached.has(id) && !reaches(exits, id, fromSceneId)))
}

/**
 * A flat test on the State of one Reading, carried by an Exit or by a Shot: the
 * Exit is offered, and the Shot played, only where every test it carries passes.
 * Three things can be tested and nothing else — what a Flag holds or does not
 * hold, whether a Scene has been entered, or whether an Exit has been taken —
 * with no arithmetic and no nesting, so a Condition is one row of a form and one
 * comparison in the engine. A Flag that was never set reads as the empty value,
 * which is how a Condition asks for the absence of one, and *does not hold*
 * nothing is how it asks for anything at all — the way a Story asks whether its
 * Question was answered. *Does not hold* is a member of its own rather than a
 * second key on *holds*, so every Condition keeps its two keys and every one
 * stored before it means what it meant.
 *
 * The Exit is the Scene's mirror and is no more counted than it: an Exit leaves
 * one Scene and a Scene is entered once, so an Exit is taken at most once — see
 * `docs/adr/0048-a-scene-is-entered-once.md`.
 *
 * A counting member stood here for one deploy — the shape a Condition was
 * written in while a Reading could enter a Scene again and again — read so that
 * nothing already stored broke before the migration reached it, and written by
 * nothing. #306 rewrote every row and this is the contract half that takes it
 * away: see `docs/adr/0002-the-schema-moves-with-the-deploy.md` and
 * `docs/adr/0048-a-scene-is-entered-once.md`.
 */
export type Condition =
  | { flag: string, is: string }
  | { flag: string, isNot: string }
  | { scene: string, entered: boolean }
  | { exit: string, taken: boolean }

export type StoryInEditor = {
  id: string
  title: string
  /** The Language the work is written in, which is never the Author's Locale. */
  language: string
  /** The few lines presenting the Story, empty where nobody has written any. */
  synopsis: string
  openingSceneId: string | null
  /** The Shot whose Image the Author named as the Cover, or null where none is named. */
  coverShotId: string | null
  publishedAt: string | null
  /** When Readers' edition was taken, or null where there is none yet. */
  editionAt: string | null
  /** Whether the Author has put the published Story in the Catalogue. */
  listed: boolean
  /** What an Exit of this Story answers when it has not answered for itself. */
  stepsBack: boolean
  /** The face a run that says nothing is set in, and where a line that says nothing stands. */
  textFace: Face
  textAlign: Align
  scenes: Scene[]
  exits: Exit[]
}
