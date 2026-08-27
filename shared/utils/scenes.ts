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
 * How many Conditions one Cut or one Shot may carry. Four tests is a way on — or
 * a beat — with a history behind it; past that, what the Author is describing is
 * not a nuance on an exit but a place in the Story several threads reach, and the
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
 * How far a Scene's node may sit from the graph's top left, in pixels. A bound
 * on both sides of the wire: the server refuses anything beyond it, and dragging
 * stops there, so a Scene cannot be dropped somewhere nobody can scroll to.
 */
export const GRAPH_REACH = 10_000

/**
 * The pitch the bench is pricked out at: how far one arrow key moves a node, how
 * wide the strip a Cut is drawn from is, and the grid a Scene written by dropping
 * a Cut on the bare bench snaps to. One number, so a Story laid out by hand and a
 * Story written by dragging line up on the same lattice — see
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 */
export const NODE_PITCH = 20

/**
 * How wide and how tall a Scene's node is drawn, and how far below the last one
 * a new Scene is placed. Shared because the server does the placing and the
 * graph does the drawing, and the spacing clears the height so a new Scene does
 * not land on top of the one above it.
 *
 * Every node is exactly this tall: a card is what an Author needs to recognise a
 * Scene at a glance — its name, the still of its first Shot, its Shot count and
 * where its ways on land — and a Scene is written in the panel at the edge of the
 * bench rather than inside the card. So the height is known rather than measured,
 * and the line that draws a Cut leaves a box the graph can work out for itself.
 * The width is left at what a phone can show, because a node wider than the
 * screen is a graph nobody can lay out on one, and the strip down a node's
 * leading edge comes out of it rather than adding to it.
 */
export const NODE_WIDTH = 320
export const NODE_HEIGHT = 160
export const NODE_GAP = 40
export const NODE_SPACING = NODE_HEIGHT + NODE_GAP

/**
 * A point on the graph's surface — where the Author put a node, or where their
 * hand has reached. A node's box is this point and the two constants above, so
 * nothing carries a size around with it.
 */
export type Point = { x: number, y: number }

/**
 * How far along one axis a node may sit: never outside the graph's reach, and on
 * a whole pixel, because the column that holds it is an integer. The same bound
 * the server refuses a placement by, held here so a node under the hand stops at
 * the edge rather than being pulled back by a refusal.
 */
export function withinReach(pixels: number) {
  return Math.min(GRAPH_REACH, Math.max(0, Math.round(pixels)))
}

/**
 * Where a point the hand landed on puts a node: on the nearest crossing of the
 * bench's own pitch, and within the graph's reach. One function for both, because
 * a Scene dropped outside the reach and then snapped could be snapped back out of
 * it. Only a Scene the gesture writes is snapped — a node the Author drags goes
 * exactly where they put it, which is `withinReach` and nothing more; what the
 * pitch is for here is a Scene that arrives where nobody aimed it precisely.
 */
export function snappedWithinReach({ x, y }: Point): Point {
  const snapped = (pixels: number) => withinReach(Math.round(pixels / NODE_PITCH) * NODE_PITCH)

  return { x: snapped(x), y: snapped(y) }
}

/**
 * How far back the Author may stand from their own graph, and how close they may
 * come. A quarter of the surface's own size is where forty Scenes fit on a
 * screen at once, and the surface's own size is the near end because there is
 * nothing above it: a card is read and never typed into — what a Scene is
 * written in is the panel at the edge of the bench — so magnifying one buys
 * nothing.
 */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 1

/**
 * Where a point on the screen lands on the surface the nodes are laid out on.
 * Two things sit between the two: the bench scrolls, so the surface's own corner
 * is somewhere else on screen, and the surface is drawn at a scale, so a pixel of
 * it is not a pixel of the window. Every gesture that reads a pointer goes
 * through here — the drag that lays a Scene out, the Cut drawn by hand, the push
 * that pans the bench — because a Scene that lands where the hand is at one zoom
 * and a finger's width away at another is the defect a viewport arrives with.
 *
 * The rectangle is the surface's own, as the browser reports it, which already
 * carries the scale: what is left to undo is the scale itself.
 */
export function onTheSurface(client: Point, surface: { left: number, top: number }, zoom: number) {
  return { x: (client.x - surface.left) / zoom, y: (client.y - surface.top) / zoom }
}

/**
 * The scale after a zoom, and the scroll that keeps one point of the surface
 * where it was on screen. The point is the pointer's for a wheel or a pinch, and
 * the middle of what is on screen for the buttons and the shortcuts, which have
 * no pointer to anchor on.
 *
 * A surface point sits at `point * zoom` from the corner of what scrolls, so
 * holding it still under a changed scale is the difference between the two,
 * multiplied out. One function for every route in, so the bound and the anchoring
 * cannot be one thing by wheel and another by button.
 */
export function zoomedAbout(zoom: number, to: number, anchor: Point, scroll: Point) {
  const held = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, to))

  return {
    zoom: held,
    scroll: {
      x: scroll.x + anchor.x * (held - zoom),
      y: scroll.y + anchor.y * (held - zoom),
    },
  }
}

/**
 * Where the line that draws a Cut meets the two nodes: on the edge of the box it
 * leaves, and on the edge of the box it lands on. A line between two points fixed
 * inside the nodes crossed whatever sat between them and arrived under the node it
 * arrived at; a line between edges says which Scene leads to which at a glance.
 */
export function cutLine(from: Point, to: Point) {
  const leaving = middleOf(from)
  const landing = middleOf(to)
  const towards = { x: landing.x - leaving.x, y: landing.y - leaving.y }

  return {
    from: onTheEdge(leaving, towards),
    to: onTheEdge(landing, { x: -towards.x, y: -towards.y }),
  }
}

/**
 * Where the line of a Cut being drawn runs: off the edge of the node it is left
 * from, and to the point the hand has reached. The far end is the point itself
 * rather than the edge of anything, because there is nothing there yet — a Cut
 * under the Author's hand lands wherever they are, and only the near end has a
 * box to leave.
 */
export function cutLineTo(from: Point, at: Point) {
  const leaving = middleOf(from)

  return {
    from: onTheEdge(leaving, { x: at.x - leaving.x, y: at.y - leaving.y }),
    to: at,
  }
}

/** The two ends of the line that draws a Cut, as `cutLine` gives them. */
export type CutLine = { from: Point, to: Point }

/**
 * How far along its own line, measured from the node it leaves, the disc that
 * says a way on's Place sits. Twenty-six pixels is the disc's own diameter and a
 * little over, so it clears the edge of the box it labels instead of sitting half
 * under it, and it is still near enough that which end of the line it belongs to
 * is never in question.
 */
export const CUT_DISC_ALONG = 26

/**
 * Where that disc goes: on the line, near the Scene the Cut leaves, because what
 * it labels is the order that Scene offers its ways on in. Never past the middle
 * of the line, so two nodes all but touching still carry their discs at the end
 * they belong to, and on the node's own edge where the line has no length at all.
 */
export function discOfCut({ from, to }: CutLine): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (!length) return from
  const along = Math.min(CUT_DISC_ALONG, length / 2)

  return {
    x: Math.round(from.x + (to.x - from.x) * along / length),
    y: Math.round(from.y + (to.y - from.y) * along / length),
  }
}

function middleOf(node: Point) {
  return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 }
}

/**
 * Where a line out of the middle of a box, headed `towards` the other one, crosses
 * its edge: whichever of the two half-extents it reaches first is the side it
 * leaves by. Headed nowhere — two nodes dropped on the same spot — it leaves at
 * the middle, so what is drawn is a line of no length rather than one shooting off
 * the graph. Rounded, because a line on a screen is not read finer than a pixel.
 */
function onTheEdge(middle: Point, towards: Point) {
  const reach = Math.min(
    towards.x ? NODE_WIDTH / 2 / Math.abs(towards.x) : Infinity,
    towards.y ? NODE_HEIGHT / 2 / Math.abs(towards.y) : Infinity,
  )
  const reached = Number.isFinite(reach)
    ? { x: middle.x + towards.x * reach, y: middle.y + towards.y * reach }
    : middle

  return { x: Math.round(reached.x), y: Math.round(reached.y) }
}

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
export function sceneNamed(names: Map<string, string>, sceneId: string, say: Phrase) {
  return names.get(sceneId) ?? say('scene.gone')
}

/**
 * How a Cut is named where it is read rather than edited. A Cut nobody has
 * phrased yet is named by where it lands: an unphrased Cut is half of what a
 * Preview is for, and a Reading that cannot go on is the worse answer. Shared,
 * because a Preview names the ways on a Condition is hiding in the same breath
 * as the ones on offer, and the two must read alike.
 */
export function cutNamed(cut: Cut, sceneName: (id: string) => string, say: Phrase) {
  return cut.text || say('cut.to', { scene: sceneName(cut.toSceneId) })
}

/**
 * The Scenes a Cut leaving one Scene may land on: every Scene in the Story bar
 * the one it leaves and the ones it already reaches. It is what lights up while
 * a Cut is being drawn, and it is fixed the moment the gesture begins — it
 * depends on the departing Scene and the Cuts already leaving it, and neither
 * changes under the Author's hand.
 *
 * The server allows both of the slips this withholds: a Scene that cuts to
 * itself is one a Reading re-enters, and two Cuts to one Scene under opposite
 * Conditions is what Conditions on a Cut are for. What the hand cannot do by
 * accident is still written on purpose, from the Cut's own panel — see
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 */
export function scenesACutMayLandOn(scenes: Scene[], cuts: Cut[], fromSceneId: string) {
  const reached = new Set(
    cuts.filter(cut => cut.fromSceneId === fromSceneId).map(cut => cut.toSceneId))

  return new Set(
    scenes.map(scene => scene.id).filter(id => id !== fromSceneId && !reached.has(id)))
}

/**
 * A flat test on the State of one Reading, carried by a Cut or by a Shot: the Cut
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
  openingSceneId: string | null
  publishedAt: string | null
  scenes: Scene[]
  cuts: Cut[]
}
