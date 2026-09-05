import { describe, expect, test } from 'vitest'
import type { Exit, Scene } from '../../shared/utils/scenes'
import {
  DEPTH_GAP,
  exitLine,
  laidOut,
  NODE_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  scenesAExitMayLandOn,
  wordsOf,
} from '../../shared/utils/scenes'

/** A Scene of the map, which is all a Scene is to it: an id. */
function scene(id: string): Scene {
  return { id, name: id, sets: {}, shots: [] }
}

/** A way on from one Scene to another, in the Place it is offered at. */
function exit(from: string, to: string, position = 0): Exit {
  return { id: `${from}>${to}`, fromSceneId: from, toSceneId: to, text: '', position, conditions: [] }
}

/** Where a node in one column stands: the pitch of the columns, and of the rows. */
const column = (depth: number) => depth * (NODE_WIDTH + DEPTH_GAP)
const row = (place: number) => place * (NODE_HEIGHT + NODE_GAP)

describe('where the map draws each Scene', () => {
  test('puts the Opening Scene alone in the first column', () => {
    const { placed } = laidOut([scene('a'), scene('b')], [exit('a', 'b')], 'a')

    expect(placed.get('a')).toEqual({ x: 0, y: 0 })
    expect(placed.get('b')).toEqual({ x: column(1), y: 0 })
  })

  test('puts a Scene in the column of its distance from the opening, in Exits taken', () => {
    const scenes = ['a', 'b', 'c', 'd'].map(scene)
    const exits = [exit('a', 'b'), exit('b', 'c'), exit('c', 'd'), exit('a', 'd', 1)]
    const { placed, width } = laidOut(scenes, exits, 'a')

    // `d` is reached in one step from `a` as well as in three from `c`: the
    // first column it is reached in is the one it stands in.
    expect(placed.get('c')!.x).toBe(column(2))
    expect(placed.get('d')!.x).toBe(column(1))
    expect(width).toBe(column(2) + NODE_WIDTH)
  })

  test('orders a column by the Scene offering first, then by the Place offered at', () => {
    const scenes = ['a', 'b', 'c', 'd', 'e'].map(scene)
    const exits = [exit('a', 'c', 1), exit('a', 'b', 0), exit('b', 'e', 1), exit('b', 'd', 0), exit('c', 'x')]
    // The Exits arrive in the Places the Story numbers them at, which the
    // layout reads in that order.
    exits.sort((one, other) => one.position - other.position)
    const { placed } = laidOut(scenes, exits, 'a')

    expect(placed.get('b')!.y).toBeLessThan(placed.get('c')!.y)
    expect(placed.get('d')!.y).toBeLessThan(placed.get('e')!.y)
  })

  test('centres each column on the tallest', () => {
    const scenes = ['a', 'b', 'c', 'd'].map(scene)
    const exits = [exit('a', 'b'), exit('a', 'c', 1), exit('a', 'd', 2)]
    const { placed, height } = laidOut(scenes, exits, 'a')

    expect(height).toBe(row(2) + NODE_HEIGHT)
    // One node against three: the one stands opposite the middle one.
    expect(placed.get('a')!.y).toBe(row(1))
    expect(placed.get('c')!.y).toBe(row(1))
  })

  test('draws a Scene nothing reaches after the last column the opening does', () => {
    const scenes = ['a', 'b', 'loose', 'looser'].map(scene)
    const exits = [exit('a', 'b'), exit('loose', 'looser')]
    const { placed } = laidOut(scenes, exits, 'a')

    expect(placed.get('loose')!.x).toBe(column(2))
    expect(placed.get('looser')!.x).toBe(column(3))
  })

  test('leaves a Scene where it was first reached when a way on comes back on itself', () => {
    const scenes = ['a', 'b'].map(scene)
    const { placed } = laidOut(scenes, [exit('a', 'b'), exit('b', 'a'), exit('b', 'b', 1)], 'a')

    expect(placed.get('a')).toEqual({ x: 0, y: 0 })
    expect(placed.get('b')).toEqual({ x: column(1), y: 0 })
  })

  test('lays a Story with no Opening Scene out from its first Scene', () => {
    const { placed, width, height } = laidOut(['a', 'b'].map(scene), [exit('a', 'b')], null)

    expect(placed.get('a')).toEqual({ x: 0, y: 0 })
    expect(placed.get('b')).toEqual({ x: column(1), y: 0 })
    expect({ width, height }).toEqual({ width: column(1) + NODE_WIDTH, height: NODE_HEIGHT })
  })

  test('ignores a way on to a Scene the Story no longer holds', () => {
    const { placed } = laidOut([scene('a')], [exit('a', 'gone')], 'a')

    expect([...placed.keys()]).toEqual(['a'])
  })

  test('draws nothing for a Story with no Scene in it', () => {
    expect(laidOut([], [], null)).toEqual({ placed: new Map(), width: 0, height: 0 })
  })
})

describe('the line that draws an Exit', () => {
  test('runs from the flank of one node to the flank of the next', () => {
    const { from, to } = exitLine({ x: 0, y: 0 }, { x: column(1), y: 0 })

    expect(from).toEqual({ x: NODE_WIDTH, y: NODE_HEIGHT / 2 })
    expect(to).toEqual({ x: column(1), y: NODE_HEIGHT / 2 })
  })

  test('spreads two ways on out of one node along its flank, in the order offered', () => {
    const first = exitLine({ x: 0, y: 0 }, { x: column(1), y: 0 }, 1, 2)
    const second = exitLine({ x: 0, y: 0 }, { x: column(1), y: 0 }, 2, 2)

    expect(first.from.x).toBe(NODE_WIDTH)
    expect(first.from.y).toBeLessThan(second.from.y)
    // The landing is left alone: a Scene is arrived at once however many lead to it.
    expect(first.to).toEqual(second.to)
  })

  test('draws a line of no length between two nodes on one spot', () => {
    const { from, to } = exitLine({ x: 0, y: 0 }, { x: 0, y: 0 })

    expect(from).toEqual(to)
  })
})

describe('the Scenes an Exit may land on', () => {
  test('are every Scene but the one it leaves and the ones it already reaches', () => {
    const scenes = ['a', 'b', 'c'].map(scene)

    expect(scenesAExitMayLandOn(scenes, [exit('a', 'b')], 'a')).toEqual(new Set(['c']))
  })
})

describe('the words a Scene holds', () => {
  test('are counted across its Shots, as runs of anything but whitespace', () => {
    const shots = [
      { id: '1', text: 'She steps  off the train.', position: 0, image: null, description: '', conditions: [] },
      { id: '2', text: '', position: 1, image: null, description: 'a frame', conditions: [] },
      { id: '3', text: ' L’arrivée — enfin ', position: 2, image: null, description: '', conditions: [] },
    ]

    expect(wordsOf(shots)).toBe(8)
  })
})
