import type { Phrase } from './phrases'

/**
 * The longest name a Scene may carry, and the longest text a Shot may hold.
 * Shared so the server's rejection and the form's own limit cannot drift apart.
 * A Shot is one beat on screen, not a chapter, so its text is capped well below
 * what Postgres would take.
 */
export const SCENE_NAME_MAX_LENGTH = 200
export const SHOT_TEXT_MAX_LENGTH = 2000

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
 * so a moving one would be a beat that plays itself.
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
 * be keeping. The most visits a Condition may count is bounded for the same
 * reason: a Story nobody can read round a hundred times cannot need more.
 */
export const FLAG_NAME_MAX_LENGTH = 60
export const FLAG_VALUE_MAX_LENGTH = 200
export const FLAGS_PER_SCENE = 20
export const VISITS_MAX = 100

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
  position: number
  image: string | null
  description: string
  conditions: Condition[]
}
export type Scene = {
  id: string
  name: string
  sets: Sets
  shots: Shot[]
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
 * A Scene read by name where something else names it — the far side of an Exit, the
 * count a Condition asks for. A Condition still names a Scene deleted since it
 * was written, and saying so beats showing the Author the id it holds. One
 * function, because a Scene named one way in the ways on offered and another way
 * in the ways on hidden is two products.
 */
export function sceneNamed(names: Map<string, string>, sceneId: string, say: Phrase) {
  return names.get(sceneId) ?? say('scene.gone')
}

/**
 * How an Exit is named where it is read rather than edited. An Exit nobody has
 * phrased yet is named by where it lands: an unphrased Exit is half of what a
 * Preview is for, and a Reading that cannot go on is the worse answer. Shared,
 * because a Preview names the ways on a Condition is hiding in the same breath
 * as the ones on offer, and the two must read alike.
 */
export function exitNamed(exit: Exit, sceneName: (id: string) => string, say: Phrase) {
  return exit.text || say('exit.to', { scene: sceneName(exit.toSceneId) })
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
 * A flat test on the State of one Reading, carried by an Exit or by a Shot: the Exit
 * is offered, and the Shot played, only where every test it carries passes. Two
 * things can be tested and nothing else — what a Flag holds, or how often a Scene has been entered — with no
 * arithmetic and no nesting, so a Condition is one row of a form and one
 * comparison in the engine. A Flag that was never set reads as the empty value,
 * which is how a Condition asks for the absence of one.
 */
export type Condition =
  | { flag: string, is: string }
  | { scene: string, visits: 'at least' | 'fewer than', times: number }

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
  /** Whether the Author has put the published Story in the Catalogue. */
  listed: boolean
  /** What an Exit of this Story answers when it has not answered for itself. */
  stepsBack: boolean
  scenes: Scene[]
  exits: Exit[]
}
