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
 * forward one it crosses. Two Scenes of one column joined to each other are
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

  // Back up the rail, bowed off the side of both points.
  return `M ${from.x + CLEAR} ${from.y} C ${from.x + LANE} ${from.y} `
    + `${to.x + LANE} ${to.y} ${to.x + CLEAR} ${to.y}`
}
