import { describe, expect, test } from 'vitest'
import type { Cut, Scene } from '../../shared/utils/scenes'
import {
  CUT_DISC_ALONG,
  cutLine,
  cutLineTo,
  discOfCut,
  GRAPH_REACH,
  NODE_HEIGHT,
  NODE_PITCH,
  NODE_WIDTH,
  onTheSurface,
  scenesACutMayLandOn,
  snappedWithinReach,
  withinReach,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomedAbout,
} from '../../shared/utils/scenes'

describe('the line that draws a Cut', () => {
  test('leaves the side of the node it leaves, and lands on the side it lands on', () => {
    const middle = NODE_HEIGHT / 2
    const line = cutLine({ x: 0, y: 0 }, { x: 360, y: 0 })

    expect(line).toEqual({ from: { x: NODE_WIDTH, y: middle }, to: { x: 360, y: middle } })
  })

  test('leaves the foot of a node it drops to, and the head of one it rises to', () => {
    const above = { x: 0, y: 0 }
    const below = { x: 0, y: 300 }
    const foot = { x: NODE_WIDTH / 2, y: NODE_HEIGHT }
    const head = { x: NODE_WIDTH / 2, y: 300 }

    expect(cutLine(above, below)).toEqual({ from: foot, to: head })
    expect(cutLine(below, above)).toEqual({ from: head, to: foot })
  })

  /**
   * Every card is one size, so a box is where the Author put it and nothing else:
   * the same Cut rising into two Scenes meets the foot of each exactly
   * `NODE_HEIGHT` below the point it was placed at, with nothing measured off a
   * page to say so.
   */
  test('reads every node as the one size a card is', () => {
    const rising = { x: 0, y: 800 }

    expect(cutLine(rising, { x: 0, y: 0 }).to.y).toBe(NODE_HEIGHT)
    expect(cutLine(rising, { x: 0, y: 200 }).to.y).toBe(200 + NODE_HEIGHT)
  })

  test('is no line at all between two nodes dropped on the same spot', () => {
    const line = cutLine({ x: 40, y: 60 }, { x: 40, y: 60 })

    expect(line.from).toEqual(line.to)
  })
})

describe('the line of a Cut being drawn', () => {
  test('leaves the edge of the node it is drawn from, and ends at the hand', () => {
    const at = { x: 600, y: NODE_HEIGHT / 2 }
    const line = cutLineTo({ x: 0, y: 0 }, at)

    expect(line).toEqual({ from: { x: NODE_WIDTH, y: NODE_HEIGHT / 2 }, to: at })
  })

  test('ends at the hand exactly, even where the hand is inside the node it left', () => {
    const inside = { x: 40, y: 40 }

    expect(cutLineTo({ x: 0, y: 0 }, inside).to).toBe(inside)
  })
})

describe('the disc that says a way on\u2019s Place', () => {
  test('puts the Place\u2019s disc on the line, near the Scene the Cut leaves', () => {
    const disc = discOfCut({ from: { x: 100, y: 50 }, to: { x: 500, y: 50 } })

    expect(disc).toEqual({ x: 100 + CUT_DISC_ALONG, y: 50 })
  })

  test('keeps the disc at the end it belongs to on a line shorter than its own reach', () => {
    const short = { from: { x: 0, y: 0 }, to: { x: 20, y: 0 } }

    expect(discOfCut(short)).toEqual({ x: 10, y: 0 })
  })

  test('leaves the disc on the edge of a node when there is no line to read', () => {
    const nowhere = { x: 40, y: 60 }

    expect(discOfCut({ from: nowhere, to: nowhere })).toEqual(nowhere)
  })
})

describe('the Scenes a Cut may land on', () => {
  const scene = (id: string) => ({ id }) as Scene
  const cut = (fromSceneId: string, toSceneId: string) => ({ fromSceneId, toSceneId }) as Cut
  const scenes = ['arrival', 'platform', 'bar'].map(scene)

  test('is every other Scene in the Story, where nothing has been drawn yet', () => {
    expect(scenesACutMayLandOn(scenes, [], 'arrival')).toEqual(new Set(['platform', 'bar']))
  })

  test('never holds the Scene the Cut leaves, so the hand cannot slip into a Cut on itself', () => {
    expect(scenesACutMayLandOn(scenes, [], 'bar').has('bar')).toBe(false)
  })

  test('drops a Scene the departing Scene already reaches', () => {
    const drawn = [cut('arrival', 'platform')]

    expect(scenesACutMayLandOn(scenes, drawn, 'arrival')).toEqual(new Set(['bar']))
  })

  test('counts only the Cuts leaving this Scene, not the ones arriving at it', () => {
    const drawn = [cut('platform', 'bar'), cut('bar', 'arrival')]

    expect(scenesACutMayLandOn(scenes, drawn, 'arrival')).toEqual(new Set(['platform', 'bar']))
  })

  test('is empty in a Story of one Scene, which has nowhere to cut to', () => {
    expect(scenesACutMayLandOn([scene('arrival')], [], 'arrival')).toEqual(new Set())
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
   * The hand outside the surface is a real position and not a refusal: a Cut is
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
