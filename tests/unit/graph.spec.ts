import { describe, expect, test } from 'vitest'
import type { Exit, Scene } from '../../shared/utils/scenes'
import {
  EXIT_DISC_ALONG,
  EXIT_DISC_RADIUS,
  EXIT_RIM_STEP,
  exitLine,
  exitLineTo,
  discOfExit,
  GRAPH_REACH,
  NODE_HEIGHT,
  NODE_PITCH,
  NODE_WIDTH,
  NODE_GAP,
  NODE_SPACING,
  onTheSurface,
  placedBeside,
  scenesAExitMayLandOn,
  snappedWithinReach,
  withinReach,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomedAbout,
} from '../../shared/utils/scenes'

describe('the line that draws an Exit', () => {
  test('leaves the side of the node it leaves, and lands on the side it lands on', () => {
    const middle = NODE_HEIGHT / 2
    const line = exitLine({ x: 0, y: 0 }, { x: 360, y: 0 })

    expect(line).toEqual({ from: { x: NODE_WIDTH, y: middle }, to: { x: 360, y: middle } })
  })

  test('leaves the foot of a node it drops to, and the head of one it rises to', () => {
    const above = { x: 0, y: 0 }
    const below = { x: 0, y: 300 }
    const foot = { x: NODE_WIDTH / 2, y: NODE_HEIGHT }
    const head = { x: NODE_WIDTH / 2, y: 300 }

    expect(exitLine(above, below)).toEqual({ from: foot, to: head })
    expect(exitLine(below, above)).toEqual({ from: head, to: foot })
  })

  /**
   * Every card is one size, so a box is where the Author put it and nothing else:
   * the same Exit rising into two Scenes meets the foot of each exactly
   * `NODE_HEIGHT` below the point it was placed at, with nothing measured off a
   * page to say so.
   */
  test('reads every node as the one size a card is', () => {
    const rising = { x: 0, y: 800 }

    expect(exitLine(rising, { x: 0, y: 0 }).to.y).toBe(NODE_HEIGHT)
    expect(exitLine(rising, { x: 0, y: 200 }).to.y).toBe(200 + NODE_HEIGHT)
  })

  test('is no line at all between two nodes dropped on the same spot', () => {
    const line = exitLine({ x: 40, y: 60 }, { x: 40, y: 60 })

    expect(line.from).toEqual(line.to)
  })
})

describe('the lines that leave one Scene together', () => {
  const street = { x: 0, y: 0 }
  const bar = { x: 0, y: NODE_SPACING }
  const alley = { x: 0, y: NODE_SPACING * 2 }

  /**
   * The Story that made this plain: three cards in one column, the first leading
   * to both of the others. Drawn from one point, the line to the second Scene ran
   * under the first and arrived below it, so the Scene in the middle read as
   * leading somewhere it does not.
   */
  test('leaves the foot at a point of its own per way on, in the order they are offered', () => {
    const first = exitLine(street, bar, 1, 2)
    const second = exitLine(street, alley, 2, 2)

    expect(first.from.y).toBe(NODE_HEIGHT)
    expect(second.from.y).toBe(NODE_HEIGHT)
    expect(second.from.x - first.from.x).toBe(EXIT_RIM_STEP)
  })

  test('spreads along the very side the line leaves by, so a flank is read as the foot is', () => {
    const first = exitLine(street, { x: 600, y: 0 }, 1, 2)
    const second = exitLine(street, { x: 1000, y: 0 }, 2, 2)

    expect(first.from.x).toBe(NODE_WIDTH)
    expect(second.from.x).toBe(NODE_WIDTH)
    expect(second.from.y - first.from.y).toBe(EXIT_RIM_STEP)
  })

  test('leaves the one way on of a Scene where it always left, in the middle of its side', () => {
    expect(exitLine(street, bar, 1, 1)).toEqual(exitLine(street, bar))
  })

  /**
   * A Scene offering more ways on than the rim has room for closes the step up
   * rather than sending the last of them off the card: every line still leaves
   * the box it belongs to, which is the whole point of leaving from the rim.
   */
  test('holds every departure on the rim, however many ways on the Scene offers', () => {
    const ways = 12
    const departures = Array.from({ length: ways },
      (_, at) => exitLine(street, bar, at + 1, ways).from)

    for (const departure of departures) {
      expect(departure.y).toBe(NODE_HEIGHT)
      expect(departure.x).toBeGreaterThanOrEqual(street.x)
      expect(departure.x).toBeLessThanOrEqual(street.x + NODE_WIDTH)
    }
  })

  test('lands where it always landed: the ways on fan out, the arrivals do not', () => {
    expect(exitLine(street, alley, 2, 2).to).toEqual(exitLine(street, alley).to)
  })
})

describe('the line of an Exit being drawn', () => {
  test('leaves the edge of the node it is drawn from, and ends at the hand', () => {
    const at = { x: 600, y: NODE_HEIGHT / 2 }
    const line = exitLineTo({ x: 0, y: 0 }, at)

    expect(line).toEqual({ from: { x: NODE_WIDTH, y: NODE_HEIGHT / 2 }, to: at })
  })

  test('ends at the hand exactly, even where the hand is inside the node it left', () => {
    const inside = { x: 40, y: 40 }

    expect(exitLineTo({ x: 0, y: 0 }, inside).to).toBe(inside)
  })
})

describe('the disc that says a way on\u2019s Place', () => {
  test('puts the Place\u2019s disc on the line, near the Scene the Exit leaves', () => {
    const disc = discOfExit({ from: { x: 100, y: 50 }, to: { x: 500, y: 50 } })

    expect(disc).toEqual({ x: 100 + EXIT_DISC_ALONG, y: 50 })
  })

  test('keeps the disc at the end it belongs to on a line shorter than its own reach', () => {
    const short = { from: { x: 0, y: 0 }, to: { x: 20, y: 0 } }

    expect(discOfExit(short)).toEqual({ x: 10, y: 0 })
  })

  test('leaves the disc on the edge of a node when there is no line to read', () => {
    const nowhere = { x: 40, y: 60 }

    expect(discOfExit({ from: nowhere, to: nowhere })).toEqual(nowhere)
  })

  test('stays near the Scene it leaves where no card stands in the line\u2019s way', () => {
    const street = { x: 0, y: 0 }
    const bar = { x: 600, y: 0 }
    const line = exitLine(street, bar)

    expect(discOfExit(line, [street, bar])).toEqual(discOfExit(line))
  })

  /**
   * The disc is the one mark that tells two lines apart, so behind a card it is
   * worth nothing: on the line that crosses the Scene in the middle of a column
   * it goes past that card, where it is read.
   */
  test('goes past a card the line passes under, so the Place is never read behind one', () => {
    const street = { x: 0, y: 0 }
    // The card of the bar, dragged up under the street's own, closer than the
    // disc stands from the rim: the line to the alley runs under it at once.
    const bar = { x: 0, y: NODE_HEIGHT + 10 }
    const alley = { x: 0, y: NODE_SPACING * 2 }
    const disc = discOfExit(exitLine(street, alley, 2, 2), [street, bar, alley])

    expect(disc.y).toBeGreaterThan(bar.y + NODE_HEIGHT + EXIT_DISC_RADIUS)
    expect(disc.y).toBeLessThan(alley.y - EXIT_DISC_RADIUS)
  })
})

describe('the Scenes an Exit may land on', () => {
  const scene = (id: string) => ({ id }) as Scene
  const exit = (fromSceneId: string, toSceneId: string) => ({ fromSceneId, toSceneId }) as Exit
  const scenes = ['arrival', 'platform', 'bar'].map(scene)

  test('is every other Scene in the Story, where nothing has been drawn yet', () => {
    expect(scenesAExitMayLandOn(scenes, [], 'arrival')).toEqual(new Set(['platform', 'bar']))
  })

  test('never holds the Scene the Exit leaves, so the hand cannot slip into an Exit on itself', () => {
    expect(scenesAExitMayLandOn(scenes, [], 'bar').has('bar')).toBe(false)
  })

  test('drops a Scene the departing Scene already reaches', () => {
    const drawn = [exit('arrival', 'platform')]

    expect(scenesAExitMayLandOn(scenes, drawn, 'arrival')).toEqual(new Set(['bar']))
  })

  test('counts only the Exits leaving this Scene, not the ones arriving at it', () => {
    const drawn = [exit('platform', 'bar'), exit('bar', 'arrival')]

    expect(scenesAExitMayLandOn(scenes, drawn, 'arrival')).toEqual(new Set(['platform', 'bar']))
  })

  test('is empty in a Story of one Scene, which has nowhere to exit to', () => {
    expect(scenesAExitMayLandOn([scene('arrival')], [], 'arrival')).toEqual(new Set())
  })
})

describe('where a node may sit', () => {
  test('holds a placement inside the graph\u2019s reach, on a whole pixel', () => {
    expect(withinReach(-40)).toBe(0)
    expect(withinReach(GRAPH_REACH + 40)).toBe(GRAPH_REACH)
    expect(withinReach(120.6)).toBe(121)
  })

  test('snaps a point the hand landed on to the nearest crossing of the pitch', () => {
    expect(snappedWithinReach({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(snappedWithinReach({ x: 9, y: 11 })).toEqual({ x: 0, y: NODE_PITCH })
    expect(snappedWithinReach({ x: 331, y: 249 })).toEqual({ x: 340, y: 240 })
  })

  test('snaps by the very step an arrow key moves a node, so the two lattices are one', () => {
    const { x } = snappedWithinReach({ x: NODE_PITCH * 7 + 1, y: 0 })

    expect(x % NODE_PITCH).toBe(0)
    expect(x).toBe(NODE_PITCH * 7)
  })

  test('never snaps a point back out of the reach it was held inside', () => {
    expect(snappedWithinReach({ x: GRAPH_REACH + 500, y: -500 })).toEqual({ x: GRAPH_REACH, y: 0 })
  })
})

describe('where a point on the screen lands on the surface', () => {
  const surface = { left: 100, top: 50 }

  test('takes the surface\u2019s own corner off, so a scrolled bench reads true', () => {
    expect(onTheSurface({ x: 140, y: 90 }, surface, 1)).toEqual({ x: 40, y: 40 })
  })

  test('undoes the scale, so a pixel of the window is not read as a pixel of the surface', () => {
    expect(onTheSurface({ x: 140, y: 90 }, surface, ZOOM_MIN)).toEqual({ x: 160, y: 160 })
    expect(onTheSurface({ x: 200, y: 100 }, surface, 0.5)).toEqual({ x: 200, y: 100 })
  })

  /**
   * The hand outside the surface is a real position and not a refusal: an Exit is
   * drawn from a node with the pointer up above the graph's own corner, and the
   * point it is aimed at is held within reach where it is written, not here.
   */
  test('reads a point above and behind the corner as the negative it is', () => {
    expect(onTheSurface({ x: 80, y: 30 }, surface, 0.5)).toEqual({ x: -40, y: -40 })
  })
})

describe('the zoom, and the scroll that holds a point still under it', () => {
  const nowhere = { x: 0, y: 0 }

  test('never pulls back further than the far end, nor closer than the surface\u2019s own size', () => {
    expect(zoomedAbout(1, 0.05, nowhere, nowhere).zoom).toBe(ZOOM_MIN)
    expect(zoomedAbout(ZOOM_MIN, 4, nowhere, nowhere).zoom).toBe(ZOOM_MAX)
  })

  test('leaves the corner of the surface alone, because it is the point it scales about', () => {
    expect(zoomedAbout(1, 0.5, nowhere, { x: 300, y: 200 }).scroll).toEqual({ x: 300, y: 200 })
  })

  test('keeps the point it is anchored on where it was on screen', () => {
    const anchor = { x: 800, y: 400 }
    const { zoom, scroll } = zoomedAbout(1, 0.5, anchor, { x: 600, y: 300 })

    // Where the anchor sits from the corner of what scrolls, less where the
    // scroll now is, is where it sits on screen: the same as before the zoom.
    expect(anchor.x * zoom - scroll.x).toBe(anchor.x * 1 - 600)
    expect(anchor.y * zoom - scroll.y).toBe(anchor.y * 1 - 300)
  })

  test('anchors on the bound it was held at, not on the scale it was asked for', () => {
    const anchor = { x: 400, y: 400 }
    const { zoom, scroll } = zoomedAbout(0.5, 0.05, anchor, { x: 200, y: 200 })

    expect(zoom).toBe(ZOOM_MIN)
    expect(scroll).toEqual({ x: 200 + 400 * (ZOOM_MIN - 0.5), y: 200 + 400 * (ZOOM_MIN - 0.5) })
  })
})

describe('where a Scene born from an Exit lands', () => {
  /** Only where a Scene sits is read here, so that is all a Scene is given. */
  const at = (...placed: [number, number][]) => placed.map(([x, y]) => ({ x, y }))

  test('goes one column on from the Scene it leaves, at its own height', () => {
    expect(placedBeside(at([100, 200]), { x: 100, y: 200 }))
      .toEqual({ x: 100 + NODE_WIDTH + NODE_GAP, y: 200 })
  })

  test('drops a node further down for every spot already taken', () => {
    const beside = NODE_WIDTH + NODE_GAP

    expect(placedBeside(at([0, 0], [beside, 0], [beside, NODE_SPACING]), { x: 0, y: 0 }))
      .toEqual({ x: beside, y: NODE_SPACING * 2 })
  })

  test('passes over every spot a Scene overlaps, not only the one it sits on', () => {
    const beside = NODE_WIDTH + NODE_GAP

    // A card dragged off the lattice covers part of two spots, and neither of
    // them is free: a Scene dropped on the second would sit across it.
    expect(placedBeside(at([beside, NODE_HEIGHT - 1]), { x: 0, y: 0 }))
      .toEqual({ x: beside, y: NODE_SPACING * 2 })
  })

  test('takes a spot a Scene clears by a pixel', () => {
    const beside = NODE_WIDTH + NODE_GAP

    expect(placedBeside(at([beside, NODE_HEIGHT]), { x: 0, y: 0 })).toEqual({ x: beside, y: 0 })
  })

  test('goes under the Scene it leaves where the bench has no column left', () => {
    const leaving = { x: GRAPH_REACH - NODE_WIDTH, y: 0 }

    expect(placedBeside(at([leaving.x, 0]), leaving)).toEqual({ x: leaving.x, y: NODE_SPACING })
  })

  test('never lands outside the graph reach', () => {
    const { x, y } = placedBeside([], { x: GRAPH_REACH, y: GRAPH_REACH })

    expect(x).toBeLessThanOrEqual(GRAPH_REACH)
    expect(y).toBeLessThanOrEqual(GRAPH_REACH)
  })
})
