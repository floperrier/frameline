import { describe, expect, test } from 'vitest'
import type { Exit, Scene } from '../../shared/utils/scenes'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import type { Phrase } from '../../shared/utils/phrases'
import {
  countedArrivals,
  countedScenes,
  DEPTH_GAP,
  exitLine,
  GATE_HEIGHT,
  GATE_WIDTH,
  inColumns,
  inDocumentOrder,
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

/** A node's own box, which is every box on a Graph with no gate standing on it. */
const node = (x: number, y: number) => ({ x, y, width: NODE_WIDTH, height: NODE_HEIGHT })

describe('where the map draws each Scene', () => {
  test('puts the Opening Scene alone in the first column', () => {
    const { placed } = laidOut([scene('a'), scene('b')], [exit('a', 'b')], 'a')

    expect(placed.get('a')).toEqual(node(0, 0))
    expect(placed.get('b')).toEqual(node(column(1), 0))
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

    expect(placed.get('a')).toEqual(node(0, 0))
    expect(placed.get('b')).toEqual(node(column(1), 0))
  })

  test('lays a Story with no Opening Scene out from its first Scene', () => {
    const { placed, width, height } = laidOut(['a', 'b'].map(scene), [exit('a', 'b')], null)

    expect(placed.get('a')).toEqual(node(0, 0))
    expect(placed.get('b')).toEqual(node(column(1), 0))
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

describe('where the Graph puts the Scene being written', () => {
  test('gives its box the gate and leaves every other one a node', () => {
    const { placed } = laidOut([scene('a'), scene('b')], [exit('a', 'b')], 'a', 'a')

    expect(placed.get('a')).toMatchObject({ width: GATE_WIDTH, height: GATE_HEIGHT })
    expect(placed.get('b')).toMatchObject({ width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  test('widens the column it stands in, and pushes the columns after it along', () => {
    const { placed, width } = laidOut([scene('a'), scene('b')], [exit('a', 'b')], 'a', 'a')

    expect(placed.get('a')!.x).toBe(0)
    expect(placed.get('b')!.x).toBe(GATE_WIDTH + DEPTH_GAP)
    expect(width).toBe(GATE_WIDTH + DEPTH_GAP + NODE_WIDTH)
  })

  test('centres a node of the widened column on it, so a column stays a column', () => {
    const scenes = ['a', 'b', 'c'].map(scene)
    // `b` and `c` share the second column, and the gate is on `b`.
    const { placed } = laidOut(scenes, [exit('a', 'b'), exit('a', 'c', 1)], 'a', 'b')

    expect(placed.get('b')!.x).toBe(placed.get('c')!.x - (GATE_WIDTH - NODE_WIDTH) / 2)
  })

  test('pushes the Scenes under it down by what the gate takes', () => {
    const scenes = ['a', 'b', 'c'].map(scene)
    const exits = [exit('a', 'b'), exit('a', 'c', 1)]
    const { placed, height } = laidOut(scenes, exits, 'a', 'b')

    expect(placed.get('c')!.y - placed.get('b')!.y).toBe(GATE_HEIGHT + NODE_GAP)
    expect(height).toBe(GATE_HEIGHT + NODE_GAP + NODE_HEIGHT)
  })

  test('closes back up when nothing is being written on it', () => {
    const scenes = ['a', 'b'].map(scene)
    const exits = [exit('a', 'b')]

    expect(laidOut(scenes, exits, 'a', undefined)).toEqual(laidOut(scenes, exits, 'a'))
  })

  test('leaves the order of the columns and the rows alone whichever Scene it is on', () => {
    const scenes = ['a', 'b', 'c'].map(scene)
    const exits = [exit('a', 'b'), exit('a', 'c', 1)]
    const read = (written?: string) => [...laidOut(scenes, exits, 'a', written).placed.keys()]

    expect(read('b')).toEqual(read())
    expect(read('c')).toEqual(read())
  })
})

describe('the line that draws an Exit', () => {
  test('runs from the flank of one node to the flank of the next', () => {
    const { from, to } = exitLine(node(0, 0), node(column(1), 0))

    expect(from).toEqual({ x: NODE_WIDTH, y: NODE_HEIGHT / 2 })
    expect(to).toEqual({ x: column(1), y: NODE_HEIGHT / 2 })
  })

  test('spreads two ways on out of one node along its flank, in the order offered', () => {
    const first = exitLine(node(0, 0), node(column(1), 0), 1, 2)
    const second = exitLine(node(0, 0), node(column(1), 0), 2, 2)

    expect(first.from.x).toBe(NODE_WIDTH)
    expect(first.from.y).toBeLessThan(second.from.y)
    // The landing is left alone: a Scene is arrived at once however many lead to it.
    expect(first.to).toEqual(second.to)
  })

  test('draws a line of no length between two nodes on one spot', () => {
    const { from, to } = exitLine(node(0, 0), node(0, 0))

    expect(from).toEqual(to)
  })

  test('leaves the gate by the gate flank, not by a node flank', () => {
    const gate = { x: 0, y: 0, width: GATE_WIDTH, height: GATE_HEIGHT }
    const { from } = exitLine(gate, node(GATE_WIDTH + DEPTH_GAP, 0))

    expect(from.x).toBe(GATE_WIDTH)
  })
})

describe('the columns a Story falls into', () => {
  /** The columns as ids, which is all a column is to the rail that draws it. */
  const named = (scenes: Scene[], exits: Exit[], opening: string | null) =>
    inColumns(scenes, exits, opening).map(column => column.map(scene => scene.id))

  /**
   * The columns the layout itself drew: every box gathered under the x it stands
   * at, left to right, each column in the order the boxes were placed in it. Held
   * against this rather than against a list written out by hand, because what has
   * to stay true is that the rail and the drawing are one reading of one Story —
   * see `docs/adr/0043-a-story-is-written-as-one-document.md`.
   */
  const asDrawn = (scenes: Scene[], exits: Exit[], opening: string | null) => {
    const columns = new Map<number, string[]>()

    for (const [id, box] of laidOut(scenes, exits, opening).placed) {
      columns.set(box.x, [...columns.get(box.x) ?? [], id])
    }

    return [...columns.keys()].sort((one, other) => one - other).map(x => columns.get(x)!)
  }

  test('are the layout’s own columns, each read top to bottom', () => {
    // A Story that branches and gathers again, handed over in an order that is
    // not the answer: a function returning the Scenes as they arrived would fail
    // here rather than pass by coincidence.
    const scenes = ['d', 'a', 'e', 'c', 'b'].map(scene)
    const exits = [
      exit('a', 'b'), exit('a', 'c', 1), exit('b', 'd'), exit('c', 'd'), exit('d', 'e'),
    ]

    expect(named(scenes, exits, 'a')).toEqual(asDrawn(scenes, exits, 'a'))
    expect(named(scenes, exits, 'a')).toEqual([['a'], ['b', 'c'], ['d'], ['e']])
  })

  test('put a cluster nothing arrives at in the columns after the last the opening reaches', () => {
    const scenes = ['a', 'b', 'loose', 'looser'].map(scene)
    const exits = [exit('a', 'b'), exit('loose', 'looser')]

    expect(named(scenes, exits, 'a')).toEqual(asDrawn(scenes, exits, 'a'))
    expect(named(scenes, exits, 'a')).toEqual([['a'], ['b'], ['loose'], ['looser']])
  })

  test('flatten to the order the Story is written in', () => {
    const scenes = ['a', 'b', 'c', 'd', 'e'].map(scene)
    const exits = [
      exit('a', 'b'), exit('a', 'c', 1), exit('b', 'd'), exit('c', 'd'), exit('d', 'e'),
    ]
    const flattened = inColumns(scenes, exits, 'a').flat()

    expect(flattened).toEqual(inDocumentOrder(scenes, exits, 'a'))
  })

  test('hand back the Scenes themselves, not their ids', () => {
    const [only] = inColumns([scene('a')], [], 'a')

    expect(only).toEqual([scene('a')])
  })

  test('are none at all for a Story with no Scene in it', () => {
    expect(inColumns([], [], null)).toEqual([])
  })
})

describe('the order a Story is written in', () => {
  /** The names in the sequence, which is all the order is. */
  const named = (scenes: Scene[], exits: Exit[], opening: string | null) =>
    inDocumentOrder(scenes, exits, opening).map(scene => scene.id)

  /**
   * The order the boxes themselves are in, read left to right and then down.
   * The sequence is held against this rather than against a list written out by
   * hand, because what has to stay true is that the document and the drawing
   * are one reading: a layout that started filling its map in another order
   * would fail here rather than quietly send the document somewhere else.
   */
  const asDrawn = (scenes: Scene[], exits: Exit[], opening: string | null) =>
    [...laidOut(scenes, exits, opening).placed.entries()]
      .sort(([, one], [, other]) => one.x - other.x || one.y - other.y)
      .map(([id]) => id)

  test('is the layout read left to right and then down', () => {
    // A Story that branches and gathers again, which is the shape a flattened
    // layout could most easily get wrong. Handed over in an order that is not
    // the answer, so a function that returned the Scenes as they arrived would
    // fail here instead of passing by coincidence.
    const scenes = ['d', 'a', 'e', 'c', 'b'].map(scene)
    const exits = [
      exit('a', 'b'), exit('a', 'c', 1), exit('b', 'd'), exit('c', 'd'), exit('d', 'e'),
    ]

    expect(named(scenes, exits, 'a')).toEqual(asDrawn(scenes, exits, 'a'))
    expect(named(scenes, exits, 'a')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  test('opens on the Opening Scene', () => {
    const scenes = ['later', 'first'].map(scene)

    expect(named(scenes, [exit('first', 'later')], 'first')[0]).toBe('first')
  })

  test('reads a column in the Places its Scene offers its Exits at', () => {
    const scenes = ['a', 'b', 'c'].map(scene)
    // The Exits arrive in the Places the Story numbers them at, which is what
    // `server/utils/stories.ts` orders them by.
    const exits = [exit('a', 'c', 0), exit('a', 'b', 1)]

    expect(named(scenes, exits, 'a')).toEqual(['a', 'c', 'b'])
  })

  test('does not move when a write leaves the shape alone', () => {
    const scenes = ['a', 'b', 'c'].map(scene)
    const exits = [exit('a', 'b'), exit('b', 'c')]
    const before = named(scenes, exits, 'a')

    const rewritten = scenes.map(one => ({
      ...one,
      name: `${one.name} renamed`,
      shots: [{ id: `${one.id}-1`, text: 'A Shot', position: 0, image: null, description: '', conditions: [] }],
    }))

    expect(named(rewritten, exits, 'a')).toEqual(before)
  })

  test('puts a Scene nothing arrives at after every Scene the opening reaches', () => {
    const scenes = ['a', 'b', 'loose'].map(scene)

    expect(named(scenes, [exit('a', 'b')], 'a')).toEqual(['a', 'b', 'loose'])
  })

  test('reads a cluster nothing arrives at from its own first Scene, not by name', () => {
    // Two clusters of two, named so that reading them alphabetically and
    // reading them as they are drawn give different answers. One detached
    // Scene proves nothing here: with one, every order is the right order.
    const scenes = ['a', 'zulu', 'yankee', 'whisky', 'x-ray'].map(scene)
    const exits = [exit('zulu', 'yankee'), exit('whisky', 'x-ray')]

    expect(named(scenes, exits, 'a')).toEqual(asDrawn(scenes, exits, 'a'))
    expect(named(scenes, exits, 'a')).toEqual(['a', 'zulu', 'yankee', 'whisky', 'x-ray'])
  })

  test('reads every Scene of a Story with no Opening Scene, once each', () => {
    const scenes = ['a', 'b'].map(scene)

    expect(named(scenes, [exit('a', 'b'), exit('b', 'a')], null)).toEqual(['a', 'b'])
  })

  test('reads a Scene once when a way on comes back on itself', () => {
    const scenes = ['a', 'b'].map(scene)
    const exits = [exit('a', 'b'), exit('b', 'a'), exit('b', 'b', 1)]

    expect(named(scenes, exits, 'a')).toEqual(['a', 'b'])
  })

  test('names nobody for a way on to a Scene the Story no longer holds', () => {
    expect(named([scene('a')], [exit('a', 'gone')], 'a')).toEqual(['a'])
  })

  test('reads nothing out of a Story with no Scene in it', () => {
    expect(inDocumentOrder([], [], null)).toEqual([])
  })
})

describe('the Scenes an Exit may land on', () => {
  test('are every Scene but the one it leaves and the ones it already reaches', () => {
    const scenes = ['a', 'b', 'c'].map(scene)

    expect(scenesAExitMayLandOn(scenes, [exit('a', 'b')], 'a')).toEqual(new Set(['c']))
  })
})

describe('what the bench counts of a Story', () => {
  /**
   * The words themselves, read out of the message file the interface reads,
   * rather than against a stub: what is asserted is the sentence an Author is
   * shown, which also proves the messages these counts are assembled from.
   */
  const says: Phrase = (key, values) => phrase(DEFAULT_LOCALE, key, values)

  test('names one Scene and several apart', () => {
    expect(countedScenes(1, says)).toBe('1 Scene')
    expect(countedScenes(40, says)).toBe('40 Scenes')
  })

  /**
   * The zero has a sentence of its own rather than a count of none. A Scene
   * nothing arrives at is a Scene no Reader ever gets to, which is the fact the
   * rail marks and the document says under a name — and `0 Exits arrive here` is
   * arithmetic where *Nothing arrives here* is what it means.
   */
  test('says what nothing arriving at a Scene means, rather than counting it', () => {
    expect(countedArrivals(0, says)).toBe('Nothing arrives here')
    expect(countedArrivals(1, says)).toBe('1 Exit arrives here')
    expect(countedArrivals(3, says)).toBe('3 Exits arrive here')
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
