/**
 * Where the rail puts each Scene, and the line an Exit is drawn as.
 *
 * The shape is still read off the Story and nothing else — `inColumns` in
 * `shared/utils/scenes.ts` is the whole of the reading, and this file turns its
 * columns into pixels. Nothing here is measured after render and nothing is
 * stored: one column is one row down the rail, a Scene stands in a lane across
 * it, and every number below is a constant. So the drawing is the same on the
 * server as in the browser and right in the first frame — see
 * `docs/adr/0041-the-graph-is-drawn-from-the-story.md` and
 * `docs/adr/0045-the-rail-draws-the-ways-on.md`.
 *
 * Pure, and apart from the component, for the reason every other reading of a
 * Story is: what a rail of forty Scenes comes out as is arithmetic somebody can
 * get wrong, and `tests/unit/graph.spec.ts` is where it is held.
 */

/**
 * A point's diameter, which is the smallest a target may be for a finger and so
 * the one number the fold may not narrow: what narrows on a phone is the rail
 * and never what can be pressed.
 */
export const MARK = 24

/**
 * How many points stand across the rail before a column takes a second row, the
 * pitch from one lane to the next, and the pitch from one row to the next. Five
 * lanes is a Story branching five ways out of one Scene drawn in one row, which
 * is past what any Scene of the demonstration does; a column wider than that
 * wraps rather than shrinking the points, because a point nobody can press is
 * not a locator.
 */
const LANES = 5
const LANE = 38
const ROW = 52

/** What the drawing keeps clear of the rail's own edges. */
const PAD = 8

/**
 * The drawing's own width, which is what the rail is cut to at the wider width
 * and what it scrolls sideways through at the narrower one. Exported because the
 * element the points are laid in has to be exactly this wide for the lines under
 * them to land where they do.
 */
export const DRAWING_WIDTH = PAD * 2 + LANES * LANE

const RADIUS = MARK / 2

/**
 * Where a line stops short of the point it touches. Two pixels of air past the
 * rim, so that the arrow at the end reads as arriving at the point rather than
 * as drawn on it.
 */
const CLEAR = RADIUS + 2

/**
 * How far out the two handles of a way back stand. The line has one corridor to
 * run in — past the rim of the point it leaves, and short of the rim of whatever
 * stands in the lane beside it — and a cubic whose handles are both this far out
 * is widest at a quarter of its ends plus three quarters of its handles. At
 * twenty-two the bow is widest at twenty: eight pixels past its own rim, six
 * short of the next lane's, and seven inside the drawing's own edge when it
 * leaves the last lane of all. At a whole LANE, which is what stood here, it was
 * widest at thirty-two — through the points of the lane beside it for well over
 * half its length, and five pixels outside the rail when it left the last lane,
 * where the drawing is cut and a bow is simply not drawn.
 */
const BOW = 22

/** Where one Scene is drawn, as the centre of its point. */
export type Point = { x: number, y: number }

/**
 * The Story drawn: every Scene's point, and how tall the drawing comes out.
 *
 * A column runs across the rail and the columns run down it, which is the same
 * arrangement the rail had before it drew a line — the Story's depth in Exits
 * taken is what an eye follows downwards. A column of more Scenes than there are
 * lanes takes a second row of its own, and the Scenes of a row are centred on the
 * rail rather than packed against its start, so a Story that branches is drawn as
 * a thing that spreads from its opening.
 *
 * Taken as ids rather than as Scenes because a point is a position and nothing
 * else: what the rail draws inside one — whether the Story opens on it, whether
 * anything arrives at it — is the component's to say.
 */
export function drawn(columns: string[][]) {
  const at = new Map<string, Point>()
  let row = 0

  for (const column of columns) {
    for (let first = 0; first < column.length; first += LANES) {
      const across = column.slice(first, first + LANES)
      // The lane the row starts in, which is half a lane for a row of four in
      // five. A row is centred, so the fraction is kept rather than rounded.
      const from = (LANES - across.length) / 2
      across.forEach((id, lane) => at.set(id, {
        x: PAD + (from + lane + 0.5) * LANE,
        y: PAD + row * ROW + RADIUS,
      }))
      row++
    }
  }

  return { at, height: row ? PAD * 2 + (row - 1) * ROW + MARK : 0 }
}

/**
 * The line one Exit is drawn as, as the `d` of a path: from the point it leaves
 * to the point it arrives at, stopping short of both so the arrow at the end has
 * the rim to arrive at.
 *
 * Three lines rather than one, because an Exit does three different things to the
 * shape and a single curve would say the same about all three. A way on into a
 * later column falls down the rail, which is the Story being read forwards. A way
 * back — to a Scene in an earlier column, or to the Scene it leaves — bows out to
 * the side, because a line drawn straight back up a lane would be read as the
 * forward one it crosses; and no further out than the gap, because a line that
 * reaches the lane beside it is read as arriving there instead. Two Scenes of one column joined to each other are
 * arched over, in the room the row pitch leaves above them.
 */
export function linkPath(from: Point, to: Point) {
  // A Scene a Reading re-enters: a loop off the side of its own point, ending
  // under it so the arrow comes back into the rim it left. Half a lane out, which
  // is clear of its own rim and short of the point standing beside it.
  if (from === to) {
    return `M ${from.x} ${from.y - CLEAR} C ${from.x + LANE / 2} ${from.y - ROW / 2} `
      + `${from.x + LANE / 2} ${from.y + ROW / 2} ${from.x} ${from.y + CLEAR}`
  }

  // Down the rail, into a later column. The bend is half the line's own length
  // rather than half the distance between the two centres, so the two handles meet
  // at its middle: a curve whose second handle stands above its first doubles back
  // on itself, which at one row apart is most of the line.
  if (to.y > from.y) {
    const bend = (to.y - from.y - 2 * CLEAR) / 2

    return `M ${from.x} ${from.y + CLEAR} C ${from.x} ${from.y + CLEAR + bend} `
      + `${to.x} ${to.y - CLEAR - bend} ${to.x} ${to.y - CLEAR}`
  }

  // Across one row, between two Scenes the same distance from the opening.
  if (to.y === from.y) {
    return `M ${from.x} ${from.y - CLEAR} Q ${(from.x + to.x) / 2} ${from.y - CLEAR - 36} `
      + `${to.x} ${to.y - CLEAR}`
  }

  // Back up the rail, bowed off the side of both points and into the gap between
  // this lane and the next, which is the whole of the room a way back has.
  return `M ${from.x + CLEAR} ${from.y} C ${from.x + BOW} ${from.y} `
    + `${to.x + BOW} ${to.y} ${to.x + CLEAR} ${to.y}`
}

/**
 * Points along a line, read off the path it is drawn as. The drawing is the
 * thing being measured, so it is measured where it is written: a curve is not
 * its handles, and a count that reads the handles counts a line nobody drew.
 */
function along(d: string) {
  const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  const quadratic = n.length === 6
  const out: Point[] = []

  for (let i = 0; i <= 32; i++) {
    const t = i / 32
    const u = 1 - t

    out.push(quadratic
      ? { x: u * u * n[0]! + 2 * u * t * n[2]! + t * t * n[4]!, y: u * u * n[1]! + 2 * u * t * n[3]! + t * t * n[5]! }
      : {
          x: u ** 3 * n[0]! + 3 * u * u * t * n[2]! + 3 * u * t * t * n[4]! + t ** 3 * n[6]!,
          y: u ** 3 * n[1]! + 3 * u * u * t * n[3]! + 3 * u * t * t * n[5]! + t ** 3 * n[7]!,
        })
  }

  return out
}

/** Which side of `o`→`p` the point `q` falls on, as a sign and nothing more. */
function side(o: Point, p: Point, q: Point) {
  return Math.sign((p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x))
}

/** Whether two traced lines pass over one another anywhere along their length. */
function meets(one: Point[], other: Point[]) {
  for (let i = 1; i < one.length; i++) {
    for (let j = 1; j < other.length; j++) {
      const a = one[i - 1]!, b = one[i]!, c = other[j - 1]!, d = other[j]!

      if (side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b)) return true
    }
  }

  return false
}

/**
 * How many times the lines of a drawing pass over one another, which is the
 * number `docs/adr/0045-the-rail-draws-the-ways-on.md` writes its own reopening
 * condition in: "a Story whose crossings outnumber its Scenes at the width the
 * rail is drawn at". That condition was written with nothing to measure it by, so
 * until now it could only ever have fired on somebody's impression of a rail.
 *
 * Two lines that share a Scene meet at that Scene and are not counted: what makes
 * a rail hard to follow is a line passing over another somewhere in between, not
 * two ways on leaving one point together. A pair is counted once, however many of
 * its samples meet.
 *
 * Nothing in the app calls this, and it is not a figure an Author is ever shown.
 * A Remark is read off the Story and "never says a Story is wrong"; a count of
 * crossings is read off the drawing and would say precisely that. This is an
 * instrument for deciding whether the drawing needs changing, kept beside the
 * layout it measures.
 */
export function crossings(links: { from: string, to: string, d: string }[]) {
  const traced = links.map(link => ({ ...link, points: along(link.d) }))
  let met = 0

  for (let i = 0; i < traced.length; i++) {
    for (let j = i + 1; j < traced.length; j++) {
      const one = traced[i]!
      const other = traced[j]!
      const shares = one.from === other.from || one.from === other.to
        || one.to === other.from || one.to === other.to

      if (!shares && meets(one.points, other.points)) met++
    }
  }

  return met
}

/**
 * Which Scenes have a line drawn through them that does not join them, as the
 * ids of the points passed over.
 *
 * The sharper of the two measures, and the one `crossings` above does not catch:
 * a drawing where two lines pass over one another is hard to follow, but a
 * drawing where a line runs through a point is *wrong* — it shows a Story
 * reaching a Scene it does not reach. A column wider than the rail wraps onto a
 * second row, and a line into that second row crosses the first with nothing in
 * `linkPath` aware of what stands there; the same is true of any line that
 * changes lane while it changes row. Curves that do not route around obstacles
 * are what `docs/adr/0045-the-rail-draws-the-ways-on.md` chose, with its eyes
 * open, over "a measurement problem or a much longer arithmetic".
 *
 * Not shown to an Author either, and for the same reason as `crossings`: it is
 * read off the drawing, not off the Story.
 */
export function traversals(links: { from: string, to: string, d: string }[], at: Map<string, Point>) {
  const passed = new Set<string>()

  for (const link of links) {
    const points = along(link.d)

    for (const [id, p] of at) {
      if (id === link.from || id === link.to) continue
      if (points.some(s => Math.hypot(s.x - p.x, s.y - p.y) < RADIUS)) passed.add(id)
    }
  }

  return passed
}
