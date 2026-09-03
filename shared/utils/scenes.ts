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
 * How far a Scene's node may sit from the graph's top left, in pixels. A bound
 * on both sides of the wire: the server refuses anything beyond it, and dragging
 * stops there, so a Scene cannot be dropped somewhere nobody can scroll to.
 */
export const GRAPH_REACH = 10_000

/**
 * The pitch the bench is pricked out at: how far one arrow key moves a node, how
 * wide the strip an Exit is drawn from is, and the grid a Scene written by dropping
 * an Exit on the bare bench snaps to. One number, so a Story laid out by hand and a
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
 * Scene at a glance — its name, the image of its first Shot, its Shot count and
 * where its ways on land — and a Scene is written in the panel at the edge of the
 * bench rather than inside the card. So the height is known rather than measured,
 * and the line that draws an Exit leaves a box the graph can work out for itself.
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
 * Where a Scene born from an Exit goes when no hand named a point: one column on
 * from the Scene it leaves, at that Scene's own height, and a node further down
 * for every spot already taken.
 *
 * Three routes arrive here and none of them has a point to give — the keyboard
 * landing an Exit on a Scene that does not exist yet, a way on written in the
 * Scene's own document, and any gesture that ends off the surface. All three were
 * placed by the server at the next free spot in a column of `NODES_PER_COLUMN`,
 * which is the far end of the bench from the Scene the Exit left: the drawing
 * said nothing the list of names had not already said. Placed beside what it
 * leaves, the graph draws the shape of the Story however the Story was written.
 *
 * Nothing already on the bench moves. This is where one Scene arrives, not a
 * layout: where a Scene sits is a written fact the Author owns the moment it
 * exists — `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md` — and a
 * graph that rearranged itself under a hand that had just dragged a card would be
 * taking that fact back.
 *
 * A Story spread all the way to the far edge of the bench has no column left to
 * the right of it, and the Scene goes under the one it leaves instead: every
 * placement past the reach would otherwise pile against the same edge.
 */
export function placedBeside(scenes: Point[], leaving: Point): Point {
  const beside = leaving.x + NODE_WIDTH + NODE_GAP
  const room = beside + NODE_WIDTH <= GRAPH_REACH
  const x = room ? beside : withinReach(leaving.x)

  for (let y = leaving.y + (room ? 0 : NODE_SPACING); y <= GRAPH_REACH; y += NODE_SPACING) {
    if (scenes.every(scene => !overlaps(scene, { x, y }))) return { x, y: withinReach(y) }
  }

  // A column full to the foot of the bench. The Scene lands beside the one it
  // leaves and over whatever is already there, which the Author can drag off:
  // there is nowhere else within reach, and refusing the placement would lose the
  // Exit the gesture was drawing along with it.
  return { x, y: withinReach(leaving.y) }
}

/** Whether two nodes, each `NODE_WIDTH` by `NODE_HEIGHT`, share any of the bench. */
function overlaps(one: Point, other: Point) {
  return Math.abs(one.x - other.x) < NODE_WIDTH && Math.abs(one.y - other.y) < NODE_HEIGHT
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
 * through here — the drag that lays a Scene out, the Exit drawn by hand, the push
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
 * How far apart two ways on out of one Scene leave its rim. A Story is laid out
 * in columns, so two lines out of one Scene towards the same column left from the
 * same point and ran as one: the near one stopped at the card below, the far one
 * carried on under it, and nothing said which was which. The gap between two
 * cards is the step, because it is the smallest distance the bench already asks
 * an eye to read, and it is wider than the disc that says a Place, so the two
 * marks stand apart as well as the two lines.
 */
export const EXIT_RIM_STEP = NODE_GAP

/**
 * Where the line that draws an Exit meets the two nodes: on the edge of the box it
 * leaves, and on the edge of the box it lands on. A line between two points fixed
 * inside the nodes crossed whatever sat between them and arrived under the node it
 * arrived at; a line between edges says which Scene leads to which at a glance.
 *
 * The Place and how many ways on the Scene offers spread the departures along the
 * side each line leaves by, in the order they are offered in, about the point the
 * one way on of a Scene leaves from. A Scene with one way on is drawn exactly as
 * it was; two are told apart at the moment they leave, which is the one place a
 * card cannot be over them. The end that lands is left alone: a Scene is arrived
 * at once however many Scenes lead to it.
 */
export function exitLine(from: Point, to: Point, place = 1, ways = 1) {
  const leaving = middleOf(from)
  const landing = middleOf(to)
  const towards = { x: landing.x - leaving.x, y: landing.y - leaving.y }

  return {
    from: onTheEdge(leaving, towards, place, ways),
    to: onTheEdge(landing, { x: -towards.x, y: -towards.y }),
  }
}

/**
 * Where the line of an Exit being drawn runs: off the edge of the node it is left
 * from, and to the point the hand has reached. The far end is the point itself
 * rather than the edge of anything, because there is nothing there yet — an Exit
 * under the Author's hand lands wherever they are, and only the near end has a
 * box to leave.
 */
export function exitLineTo(from: Point, at: Point) {
  const leaving = middleOf(from)

  return {
    from: onTheEdge(leaving, { x: at.x - leaving.x, y: at.y - leaving.y }),
    to: at,
  }
}

/** The two ends of the line that draws an Exit, as `exitLine` gives them. */
export type ExitLine = { from: Point, to: Point }

/**
 * How far along its own line, measured from the node it leaves, the disc that
 * says a way on's Place sits. Twenty-six pixels is the disc's own diameter and a
 * little over, so it clears the edge of the box it labels instead of sitting half
 * under it, and it is still near enough that which end of the line it belongs to
 * is never in question.
 */
export const EXIT_DISC_ALONG = 26

/**
 * How wide that disc is drawn, and so how far clear of a card it has to sit to be
 * read at all. The drawing takes its radius from here, so what is measured and
 * what is drawn cannot drift apart.
 */
export const EXIT_DISC_RADIUS = 9

/**
 * Where that disc goes: on the line, near the Scene the Exit leaves, because what
 * it labels is the order that Scene offers its ways on in. Never past the middle
 * of the line where nothing is in its way, so two nodes all but touching still
 * carry their discs at the end they belong to, and on the node's own edge where
 * the line has no length at all.
 *
 * And never behind a card. The cards are drawn over the lines, so a disc under one
 * is the single mark that tells two lines apart, hidden by the thing it would tell
 * them apart from; where the near stretch of a line is covered, the disc is walked
 * on along it — by its own radius, which finds any gap two cards laid out on the
 * bench leave between them — until it is clear of every one of them. Never as far
 * as the end it arrives at, where the endpoint that leads the Exit elsewhere is
 * taken hold of. The cards are the Author's to place and may be dropped closer
 * together than the disc is wide, which leaves nowhere on the line to put it: the
 * disc goes back to the end it belongs to, and is read by moving the card that
 * hides it.
 */
export function discOfExit({ from, to }: ExitLine, cards: Point[] = []): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (!length) return from
  const near = Math.min(EXIT_DISC_ALONG, length / 2)
  const at = (along: number) => ({
    x: Math.round(from.x + (to.x - from.x) * along / length),
    y: Math.round(from.y + (to.y - from.y) * along / length),
  })

  const last = Math.max(near, length - EXIT_DISC_ALONG)

  for (let along = near; along <= last; along += EXIT_DISC_RADIUS) {
    const disc = at(along)
    if (cards.every(card => !hides(card, disc))) return disc
  }

  return at(near)
}

/** Whether a card would hide a disc drawn at this point, the disc's own width counted in. */
function hides(card: Point, disc: Point) {
  return disc.x > card.x - EXIT_DISC_RADIUS
    && disc.x < card.x + NODE_WIDTH + EXIT_DISC_RADIUS
    && disc.y > card.y - EXIT_DISC_RADIUS
    && disc.y < card.y + NODE_HEIGHT + EXIT_DISC_RADIUS
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
function onTheEdge(middle: Point, towards: Point, place = 1, ways = 1) {
  const byWidth = towards.x ? NODE_WIDTH / 2 / Math.abs(towards.x) : Infinity
  const byHeight = towards.y ? NODE_HEIGHT / 2 / Math.abs(towards.y) : Infinity
  const reach = Math.min(byWidth, byHeight)
  if (!Number.isFinite(reach)) return { x: Math.round(middle.x), y: Math.round(middle.y) }

  const reached = { x: middle.x + towards.x * reach, y: middle.y + towards.y * reach }

  // A flank where the width is reached first, the head or the foot otherwise —
  // which is also the side the ways on are spread along, and how much of it there
  // is to spread them over. A Scene offering more of them than the side has room
  // for closes the step up rather than sending the last of them off the card.
  const flank = byWidth <= byHeight
  const side = flank ? NODE_HEIGHT : NODE_WIDTH
  const centre = flank ? middle.y : middle.x
  const step = Math.min(EXIT_RIM_STEP, (side - EXIT_RIM_STEP) / Math.max(ways - 1, 1))
  const spread = (ways - 1) * step

  // The ways on are spread about the point the line crosses the rim at, and that
  // point is anywhere along the side: a line leaving by a corner is already at the
  // end of it. So the whole spread is slid back onto the side rather than each
  // line being held to it one at a time, which would pile them at the corner.
  // A Scene with one way on has no spread at all, and is drawn where it always was.
  const held = Math.min(Math.max(flank ? reached.y : reached.x, centre - (side - spread) / 2),
    centre + (side - spread) / 2)
  const at = held + (place - 1 - (ways - 1) / 2) * step

  return {
    x: Math.round(flank ? reached.x : at),
    y: Math.round(flank ? at : reached.y),
  }
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
 * run of Shots, a node in the graph and the Flags it sets, and the Exits that
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
  x: number
  y: number
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
 * each entry. A row rather than an entry of the map, because a row is written
 * before it is whole — a name with no value yet, a value being retyped — and the
 * map holds only the Flags a Scene actually sets.
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
 * The Scenes an Exit leaving one Scene may land on: every Scene in the Story bar
 * the one it leaves and the ones it already reaches. It is what lights up while
 * an Exit is being drawn, and it is fixed the moment the gesture begins — it
 * depends on the departing Scene and the Exits already leaving it, and neither
 * changes under the Author's hand.
 *
 * The server allows both of the slips this withholds: a Scene that exits to
 * itself is one a Reading re-enters, and two Exits to one Scene under opposite
 * Conditions is what Conditions on an Exit are for. What the hand cannot do by
 * accident is still written on purpose, from the Exit's own panel — see
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 */
export function scenesAExitMayLandOn(scenes: Scene[], exits: Exit[], fromSceneId: string) {
  const reached = new Set(
    exits.filter(exit => exit.fromSceneId === fromSceneId).map(exit => exit.toSceneId))

  return new Set(
    scenes.map(scene => scene.id).filter(id => id !== fromSceneId && !reached.has(id)))
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
  publishedAt: string | null
  /** Whether the Author has put the published Story in the Catalogue. */
  listed: boolean
  scenes: Scene[]
  exits: Exit[]
}
