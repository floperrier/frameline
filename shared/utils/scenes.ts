/**
 * The longest name a Scene may carry, and the longest text a Shot may hold.
 * Shared so the server's rejection and the form's own limit cannot drift apart.
 * A Shot is one beat on screen, not a chapter, so its text is capped well below
 * what Postgres would take.
 */
export const SCENE_NAME_MAX_LENGTH = 200
export const SHOT_TEXT_MAX_LENGTH = 2000

/**
 * The longest Description a Still may carry. A Description says what one frame
 * shows, in the sentence an editor would say it in, so it is capped near a Cut's
 * line rather than near a Shot's text: prose about the image is the Shot's text,
 * which the Reader already has.
 */
export const SHOT_DESCRIPTION_MAX_LENGTH = 250

/**
 * The still formats a Shot may carry, each named by the bytes a file of it starts
 * with: an offset, and the bytes that must sit at it. Which formats there are and
 * how each is recognised is one statement rather than two, so a format added here
 * cannot be a format the picker offers and the server refuses.
 *
 * An animated GIF is left out on purpose: a Shot is one still image and its text,
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
 * The most one still may weigh. Two megabytes is a photograph at screen size and
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
 * Where a Shot's still is served. The bytes never travel with the Story — a Story
 * of fifty Shots would be fifty images in one response — so what the Story
 * carries is this address, and null for a Shot that has no still.
 */
export function shotImageUrl(shotId: string) {
  return `/api/shots/${shotId}/image`
}

/**
 * The longest text a Cut may carry. A Cut is one line the Reader is offered at
 * the end of a Scene, so it is capped far below a Shot.
 */
export const CUT_TEXT_MAX_LENGTH = 200

/**
 * How many Conditions one Cut may carry. Four tests is a way on with a history
 * behind it; past that, what the Author is describing is not a nuance on an exit
 * but a place in the Story several threads reach, and the answer is a Scene —
 * see `docs/adr/0004-conditions-stay-flat.md`.
 */
export const CUT_CONDITIONS_MAX = 4

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
 * How far a Scene's node may sit from the graph's top left, in pixels. A bound
 * on both sides of the wire: the server refuses anything beyond it, and dragging
 * stops there, so a Scene cannot be dropped somewhere nobody can scroll to.
 */
export const GRAPH_REACH = 10_000

/**
 * How large a Scene's node is drawn, and how far below the last one a new Scene
 * is placed. Shared because the server does the placing and the graph does the
 * drawing, and the spacing clears the height so a new Scene does not land on top
 * of the controls of the one above it.
 *
 * The height shows a Shot with its still and the Flags the Scene sets; the Cuts
 * leaving a Scene are a scroll away inside the node, because a node tall enough
 * to hold all of them would be taller than the graph that holds it. The width is
 * left at what a phone can show, because a node wider than the screen is a graph
 * nobody can lay out on one.
 */
export const NODE_WIDTH = 320
export const NODE_HEIGHT = 420
export const NODE_GAP = 40
export const NODE_SPACING = NODE_HEIGHT + NODE_GAP

/**
 * How many Scenes a column of the graph holds before the next one starts a new
 * column. A Story numbering its Scenes down one endless column would put the
 * later ones past `GRAPH_REACH`, somewhere the Author could never drag them back
 * from; laid out in columns, a Story stays within reach for hundreds of Scenes.
 */
export const NODES_PER_COLUMN = 20

/**
 * A Story as the Author edits it: Scenes in the order they were written, each a
 * run of Shots, a node in the graph and the Flags it sets, and the Cuts that
 * join them, each in the Place it is offered at and with the Conditions it is
 * offered under. A Story with no Scenes has no opening Scene, and neither has
 * one whose opening Scene was deleted. `publishedAt` is null until the Story is
 * published, and null again once it is unpublished; it arrives as a string
 * because that is what JSON makes of a timestamp.
 *
 * A Shot's `image` is where its still is served, not the still itself, and null
 * for a Shot that is text alone. Its `description` is what that still shows, for
 * a Reader who cannot see it, and empty where the Author has written none.
 */
export type Shot = {
  id: string
  text: string
  position: number
  image: string | null
  description: string
}
export type Scene = {
  id: string
  name: string
  x: number
  y: number
  sets: Flags
  shots: Shot[]
}
export type Cut = {
  id: string
  fromSceneId: string
  toSceneId: string
  text: string
  position: number
  conditions: Condition[]
}

/**
 * The Flags a Scene sets the moment a Reading enters it, as names to values.
 * Flat, because a Flag is a single named value: nothing here holds another map.
 */
export type Flags = Record<string, string>

/**
 * What separates a Flag's name from its value where an Author types them. Here
 * rather than in the editor, because the server refuses a name holding it — a
 * name that did could not be shown back as the line it was typed on — and one
 * module has to own the format both sides obey.
 */
export const FLAG_SEPARATOR = '='

/** The Flags a Scene sets, as one `name = value` a line, for an Author to read. */
export function flagLines(sets: Flags) {
  return Object.entries(sets).map(pair => pair.join(` ${FLAG_SEPARATOR} `)).join('\n')
}

/**
 * The Flags an Author typed. Split on the first separator alone, so a value may
 * hold one; a line missing it is a name with no value, which the server refuses,
 * and a name typed twice holds what the later line gave it.
 */
export function flagsTyped(typed: string): Flags {
  return Object.fromEntries(typed.split('\n').filter(line => line.trim()).map((line) => {
    const [name, ...held] = line.split(FLAG_SEPARATOR)
    return [name!.trim(), held.join(FLAG_SEPARATOR).trim()]
  }))
}

/**
 * A Scene read by name where something else names it — the far side of a Cut, the
 * count a Condition asks for. A Condition still names a Scene deleted since it
 * was written, and saying so beats showing the Author the id it holds. One
 * function, because a Scene named one way in the ways on offered and another way
 * in the ways on hidden is two products.
 */
export function sceneNamed(names: Map<string, string>, sceneId: string) {
  return names.get(sceneId) ?? 'a Scene that is gone'
}

/**
 * How a Cut is named where it is read rather than edited. A Cut nobody has
 * phrased yet is named by where it lands: an unphrased Cut is half of what a
 * Preview is for, and a Reading that cannot go on is the worse answer. Shared,
 * because a Preview names the ways on a Condition is hiding in the same breath
 * as the ones on offer, and the two must read alike.
 */
export function cutNamed(cut: Cut, sceneName: (id: string) => string) {
  return cut.text || `Cut to ${sceneName(cut.toSceneId)}`
}

/**
 * A flat test on the State of one Reading, carried by a Cut: the Cut is offered
 * only where every test it carries passes. Two things can be tested and nothing
 * else — what a Flag holds, or how often a Scene has been entered — with no
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
  openingSceneId: string | null
  publishedAt: string | null
  scenes: Scene[]
  cuts: Cut[]
}
