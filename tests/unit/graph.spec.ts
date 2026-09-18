import { describe, expect, test } from 'vitest'
import type { Exit, Scene } from '../../shared/utils/scenes'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import type { Phrase } from '../../shared/utils/phrases'
import type { StoryInEditor } from '../../shared/utils/scenes'
import {
  countedArrivals,
  countedScenes,
  inColumns,
  inDocumentOrder,
  namesOnTheBench,
  reaches,
  scenesAExitMayLandOn,
  wordsOf,
} from '../../shared/utils/scenes'
import { DRAWING_WIDTH, MARK, crossings, drawn, linkPath, traversals } from '../../app/utils/graph'

/** A Scene of the map, which is all a Scene is to it: an id. */
function scene(id: string): Scene {
  return { id, name: id, sets: {}, shots: [] }
}

/** A way on from one Scene to another, in the Place it is offered at. */
function exit(from: string, to: string, position = 0): Exit {
  return { id: `${from}>${to}`, fromSceneId: from, toSceneId: to, text: '', position, conditions: [] }
}

/**
 * The words themselves, read out of the message file the interface reads, rather
 * than against a stub: what is asserted is the sentence an Author is shown, which
 * also proves the messages these are assembled from.
 */
const says: Phrase = (key, values) => phrase(DEFAULT_LOCALE, key, values)

describe('the columns a Story falls into', () => {
  /** The columns as ids, which is all a column is to the rail that draws it. */
  const named = (scenes: Scene[], exits: Exit[], opening: string | null) =>
    inColumns(scenes, exits, opening).map(column => column.map(scene => scene.id))

  test('are the Story’s own depth, each column read top to bottom', () => {
    // A Story that branches and gathers again, handed over in an order that is
    // not the answer: a function returning the Scenes as they arrived would fail
    // here rather than pass by coincidence.
    const scenes = ['d', 'a', 'e', 'c', 'b'].map(scene)
    const exits = [
      exit('a', 'b'), exit('a', 'c', 1), exit('b', 'd'), exit('c', 'd'), exit('d', 'e'),
    ]

    expect(named(scenes, exits, 'a')).toEqual([['a'], ['b', 'c'], ['d'], ['e']])
  })

  test('put a Scene in the column of its distance from the opening, in Exits taken', () => {
    const scenes = ['a', 'b', 'c', 'd'].map(scene)
    // `d` is reached in one step from `a` as well as in three from `c`: the
    // first column it is reached in is the one it stands in.
    const exits = [exit('a', 'b'), exit('b', 'c'), exit('c', 'd'), exit('a', 'd', 1)]

    expect(named(scenes, exits, 'a')).toEqual([['a'], ['b', 'd'], ['c']])
  })

  test('order a column by the Scene offering first, then by the Place offered at', () => {
    const scenes = ['a', 'b', 'c', 'd', 'e'].map(scene)
    const exits = [exit('a', 'c', 1), exit('a', 'b', 0), exit('b', 'e', 1), exit('b', 'd', 0)]
    // The Exits arrive in the Places the Story numbers them at, which the walk
    // reads in that order.
    exits.sort((one, other) => one.position - other.position)

    expect(named(scenes, exits, 'a')).toEqual([['a'], ['b', 'c'], ['d', 'e']])
  })

  test('put a cluster nothing arrives at in the columns after the last the opening reaches', () => {
    const scenes = ['a', 'b', 'loose', 'looser'].map(scene)
    const exits = [exit('a', 'b'), exit('loose', 'looser')]

    expect(named(scenes, exits, 'a')).toEqual([['a'], ['b'], ['loose'], ['looser']])
  })

  test('leave a Scene in the column it was first reached in when a way on comes back', () => {
    const scenes = ['a', 'b'].map(scene)

    expect(named(scenes, [exit('a', 'b'), exit('b', 'a'), exit('b', 'b', 1)], 'a'))
      .toEqual([['a'], ['b']])
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

  test('is the columns read one after another, each top to bottom', () => {
    // A Story that branches and gathers again, which is the shape a flattened
    // layout could most easily get wrong. Handed over in an order that is not
    // the answer, so a function that returned the Scenes as they arrived would
    // fail here instead of passing by coincidence.
    const scenes = ['d', 'a', 'e', 'c', 'b'].map(scene)
    const exits = [
      exit('a', 'b'), exit('a', 'c', 1), exit('b', 'd'), exit('c', 'd'), exit('d', 'e'),
    ]

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

describe('the names the bench calls a Story’s Scenes by', () => {
  /** A Scene under a name of its own, which is what the numbering is about. */
  const called = (id: string, name: string): Scene => ({ ...scene(id), name })

  /** A Story in the shape the bench holds it, of which this reads the Scenes alone. */
  const written = (scenes: Scene[], exits: Exit[]): StoryInEditor => ({
    id: 'a-story',
    title: 'A Story',
    language: 'en',
    synopsis: '',
    openingSceneId: scenes[0]?.id ?? null,
    coverShotId: null,
    publishedAt: null,
    listed: false,
    scenes,
    exits,
  })

  /** The names in the order the Story is written in, which is the order they are drawn in. */
  const drawn = (scenes: Scene[], exits: Exit[] = []) => {
    const names = namesOnTheBench(written(scenes, exits), says)

    return inDocumentOrder(scenes, exits, scenes[0]?.id ?? null).map(one => names.get(one.id))
  }

  test('leave a name one Scene alone carries exactly as the Author typed it', () => {
    expect(drawn([called('a', 'The bar'), called('b', 'La gare')], [exit('a', 'b')]))
      .toEqual(['The bar', 'La gare'])
  })

  test('number two Scenes of one name in the order the Story is written in', () => {
    // Handed over in an order that is not the answer: the Scene the Story opens
    // on is written second, and it is the one numbered first.
    const scenes = [called('later', 'The bar'), called('opening', 'The bar')]

    expect(drawn(scenes, [exit('opening', 'later')]))
      .toEqual(['The bar (1)', 'The bar (2)'])
  })

  /**
   * The number is drawn against the names it draws and not against the names it
   * read, because a number that collides tells nobody anything. An Author reaches
   * this by hand rather than by accident: the bench draws *The bar (2)*, and the
   * field that names where a way on leads takes whatever is typed into it — so a
   * Story really can hold a Scene called *The bar (2)* beside two called *The
   * bar*. See `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
   *
   * The Scene really called *The bar (2)* is written last, after both the Scenes
   * it collides with: the number has to walk past a name the walk has not reached
   * yet, so the names taken are read off the whole Story before it starts.
   */
  test('walk a number on past a name a Scene of the Story already answers to', () => {
    const scenes = [called('a', 'The bar'), called('b', 'The bar'), called('c', 'The bar (2)')]

    expect(drawn(scenes, [exit('a', 'b'), exit('b', 'c')]))
      .toEqual(['The bar (1)', 'The bar (3)', 'The bar (2)'])
  })
})

describe('whether one Scene reaches another', () => {
  test('is the ways on walked forwards, and never backwards', () => {
    const exits = [exit('a', 'b'), exit('b', 'c')]

    expect(reaches(exits, 'a', 'c')).toBe(true)
    expect(reaches(exits, 'c', 'a')).toBe(false)
  })

  /** Because that is where the Reading already stands, which is what refuses a way on to the Scene it leaves. */
  test('has a Scene reaching itself', () => {
    expect(reaches([], 'a', 'a')).toBe(true)
  })

  /**
   * A Story written before `docs/adr/0048-a-scene-is-entered-once.md` may hold a
   * cycle, and the walk is asked about it by the bench that draws it. It carries
   * the Scenes it has been through, so it answers rather than walking for ever.
   */
  test('answers a Story that still holds a cycle', () => {
    const exits = [exit('a', 'b'), exit('b', 'a')]

    expect(reaches(exits, 'a', 'b')).toBe(true)
    expect(reaches(exits, 'b', 'c')).toBe(false)
  })

  /**
   * The stability the record rests on. `O→A→B→C` is legal throughout and the
   * Author then writes `O→C`: under a rule about columns C moves to the second
   * column and `B→C` — written weeks earlier, untouched — becomes illegal. Under
   * this one an Exit is refused exactly when it is the one closing a cycle, so
   * every way on already written is still one that could be written now.
   */
  test('never leaves a way on written earlier illegal', () => {
    const written = [exit('o', 'a'), exit('a', 'b'), exit('b', 'c'), exit('o', 'c', 1)]

    for (const way of written) {
      const others = written.filter(other => other !== way)

      expect(reaches(others, way.toSceneId, way.fromSceneId)).toBe(false)
    }
  })
})

describe('the Scenes an Exit may land on', () => {
  test('are every Scene but the one it leaves and the ones it already reaches', () => {
    const scenes = ['a', 'b', 'c'].map(scene)

    expect(scenesAExitMayLandOn(scenes, [exit('a', 'b')], 'a')).toEqual(new Set(['c']))
  })

  /**
   * A Scene a Reading could have come through is not a landing: a way on back to
   * it is what the server refuses, so the field never offers it. Two Scenes of one
   * column are neighbours and stay on offer — `b` and `c` are both reached from
   * `a`, and neither reaches the other.
   */
  test('are never a Scene that reaches the one the Exit leaves', () => {
    const scenes = ['a', 'b', 'c', 'd'].map(scene)
    const exits = [exit('a', 'b'), exit('a', 'c', 1), exit('c', 'd')]

    expect(scenesAExitMayLandOn(scenes, exits, 'd')).toEqual(new Set(['b']))
    expect(scenesAExitMayLandOn(scenes, exits, 'b')).toEqual(new Set(['c', 'd']))
  })
})

describe('what the bench counts of a Story', () => {
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

/**
 * The drawing itself, which the rail turns the columns above into: where a point
 * stands and where a line bends are constants and the Story, so a Story of forty
 * Scenes comes out the same on the server as in the browser — see
 * `docs/adr/0045-the-rail-draws-the-ways-on.md`. It is arithmetic a person can get
 * wrong without a browser, which is what these are for; that it *looks* like the
 * Story is the end-to-end suite's, and the eye's.
 */
describe('where the rail draws a Story', () => {
  const at = (columns: string[][], id: string) => drawn(columns).at.get(id)!

  test('puts each column on a row of its own, running down the rail', () => {
    const columns = [['a'], ['b'], ['c']]
    const [a, b, c] = ['a', 'b', 'c'].map(id => at(columns, id))

    expect(b!.y - a!.y).toBe(c!.y - b!.y)
    expect(a!.y).toBeLessThan(b!.y)
    // A column of one stands in the middle, which is what a chain is drawn as.
    expect([a!.x, b!.x, c!.x]).toEqual([DRAWING_WIDTH / 2, DRAWING_WIDTH / 2, DRAWING_WIDTH / 2])
  })

  test('centres the Scenes of a column across the rail, in the order it is offered', () => {
    const columns = [['a'], ['b', 'c']]
    const [b, c] = ['b', 'c'].map(id => at(columns, id))

    expect(b!.y).toBe(c!.y)
    expect(b!.x).toBeLessThan(c!.x)
    expect((b!.x + c!.x) / 2).toBe(DRAWING_WIDTH / 2)
    expect(c!.x - b!.x).toBeGreaterThanOrEqual(MARK)
  })

  test('wraps a column wider than the rail onto a row of its own, before the next', () => {
    const columns = [['a'], ['b', 'c', 'd', 'e', 'f', 'g'], ['h']]
    const drawing = drawn(columns)
    const [b, f, g, h] = ['b', 'f', 'g', 'h'].map(id => drawing.at.get(id)!)

    // Five across, and the sixth on a row of the same column rather than squeezed
    // in beside them: what a fold may narrow is the rail and never the point.
    expect(f!.y).toBe(b!.y)
    expect(g!.y).toBeGreaterThan(b!.y)
    expect(g!.x).toBe(DRAWING_WIDTH / 2)
    expect(h!.y - g!.y).toBe(g!.y - b!.y)
  })

  test('comes out as tall as the rows it drew, clear of the rail at both ends', () => {
    const columns = [['a'], ['b']]
    const drawing = drawn(columns)
    const [a, b] = ['a', 'b'].map(id => drawing.at.get(id)!)

    expect(drawing.height - (b!.y + MARK / 2)).toBe(a!.y - MARK / 2)
  })

  test('has nothing to draw for a Story with no Scene in it', () => {
    expect(drawn([])).toEqual({ at: new Map(), height: 0 })
  })
})

describe('the line an Exit is drawn as', () => {
  /** Where a line starts and where it ends, read off the path it is drawn as. */
  const ends = (d: string) => {
    const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)

    return { from: numbers.slice(0, 2), to: numbers.slice(-2), all: numbers }
  }

  /**
   * The furthest right a line reaches, read off the curve rather than off the
   * handles that shape it. A bow is drawn where the curve goes and the handles
   * stand further out than it ever does, so a test that reads them certifies a
   * line it has not looked at.
   */
  const widest = (d: string) => {
    const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const x0 = n[0]!
    const x1 = n[2]!
    const x2 = n[4]!
    const x3 = n[6]!
    let out = -Infinity

    for (let t = 0; t <= 1; t += 0.005) {
      const u = 1 - t

      out = Math.max(out, u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3)
    }

    return out
  }

  /** The pitch from one lane to the next, read off a row of two. */
  const lanes = drawn([['a', 'b']]).at
  const pitch = lanes.get('b')!.x - lanes.get('a')!.x

  test('falls down the rail into the column after, clear of both rims', () => {
    const columns = [['a'], ['b']]
    const drawing = drawn(columns)
    const [a, b] = ['a', 'b'].map(id => drawing.at.get(id)!)
    const { from, to } = ends(linkPath(a!, b!))

    // Under the point it leaves and over the one it arrives at: past the rim, so
    // the line is not drawn on the point, and inside the pitch, so the head at the
    // end is read as arriving at it.
    expect(from[0]).toBe(a!.x)
    expect(from[1]! - a!.y).toBeGreaterThan(MARK / 2)
    expect(from[1]! - a!.y).toBeLessThan(MARK)
    expect(to[0]).toBe(b!.x)
    expect(b!.y - to[1]!).toBeGreaterThan(MARK / 2)
    expect(b!.y - to[1]!).toBeLessThan(MARK)
  })

  test('bows off the side where it runs back up the rail', () => {
    const columns = [['a'], ['b']]
    const drawing = drawn(columns)
    const [a, b] = ['a', 'b'].map(id => drawing.at.get(id)!)
    const { from, to } = ends(linkPath(b!, a!))

    // Off the side of both points and back up, so a way back is never read as the
    // way on it runs alongside.
    expect(from[1]).toBe(b!.y)
    expect(from[0]! - b!.x).toBeGreaterThan(MARK / 2)
    expect(to[1]).toBe(a!.y)
  })

  test('bows into the gap beside the lane and never into the lane itself', () => {
    const columns = [['a'], ['b']]
    const drawing = drawn(columns)
    const [a, b] = ['a', 'b'].map(id => drawing.at.get(id)!)
    const out = widest(linkPath(b!, a!)) - a!.x

    // The corridor is the whole of the room a way back has: past its own rim, so
    // it is not read as the way on running down the same lane, and short of the
    // rim of whatever stands in the lane beside it, so it is not read as arriving
    // there either. A bow wider than this crosses the points it passes.
    expect(out).toBeGreaterThan(MARK / 2)
    expect(out).toBeLessThan(pitch - MARK / 2)
  })

  test('keeps a way back inside the drawing when it leaves the last lane', () => {
    // Five across is the widest a column is drawn, so the last lane is the one
    // with the least room to bow into — and the drawing is cut to its own width,
    // where what reaches past it is not drawn at all rather than drawn badly.
    const columns = [['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h', 'i', 'j']]
    const drawing = drawn(columns)
    const [e, j] = ['e', 'j'].map(id => drawing.at.get(id)!)

    expect(widest(linkPath(j!, e!))).toBeLessThan(DRAWING_WIDTH)
  })

  test('arches over two Scenes of one column joined to each other', () => {
    const columns = [['a'], ['b', 'c']]
    const drawing = drawn(columns)
    const [b, c] = ['b', 'c'].map(id => drawing.at.get(id)!)
    const { from, to } = ends(linkPath(b!, c!))

    expect(from[0]).toBe(b!.x)
    expect(to[0]).toBe(c!.x)
    expect(b!.y - from[1]!).toBeGreaterThan(MARK / 2)
    expect(c!.y - to[1]!).toBeGreaterThan(MARK / 2)
  })

  test('loops beside the point where a Scene re-enters itself', () => {
    const columns = [['a']]
    const a = drawn(columns).at.get('a')!
    const { from, to, all } = ends(linkPath(a, a))

    // Over the point and back under it, out to the side: a Reading that comes
    // round again is a loop and is drawn as one.
    expect(from[0]).toBe(a.x)
    expect(to[0]).toBe(a.x)
    expect(from[1]).toBeLessThan(a.y)
    expect(to[1]).toBeGreaterThan(a.y)
    expect(Math.max(...all)).toBeGreaterThan(a.x + MARK / 2)
  })
})

/**
 * What `docs/adr/0045-the-rail-draws-the-ways-on.md` says to reopen the layout on
 * — "a Story whose crossings outnumber its Scenes" — now that there is something
 * to count them with. Held here rather than in the component because it is read
 * off the drawing, and the drawing is arithmetic.
 */
describe('how much a drawing crosses itself', () => {
  const linksOf = (columns: string[][], joins: [string, string][]) => {
    const { at } = drawn(columns)

    return joins.map(([from, to]) => ({ from, to, d: linkPath(at.get(from)!, at.get(to)!) }))
  }

  test('counts two ways on that pass over one another', () => {
    // Two Scenes side by side, each leading to the other's neighbour below: the
    // two lines have to cross, and they share no Scene to meet at.
    expect(crossings(linksOf([['a', 'b'], ['c', 'd']], [['a', 'd'], ['b', 'c']]))).toBe(1)
  })

  test('counts nothing where the ways on run alongside', () => {
    expect(crossings(linksOf([['a', 'b'], ['c', 'd']], [['a', 'c'], ['b', 'd']]))).toBe(0)
  })

  test('does not count two ways on that leave the same Scene', () => {
    // They meet where they leave, which is a Scene offering two ways on and not a
    // drawing that is hard to follow.
    expect(crossings(linksOf([['a'], ['b', 'c']], [['a', 'b'], ['a', 'c']]))).toBe(0)
  })
})

/**
 * The measure the trials found `crossings` blind to: a column wide enough to wrap
 * puts points in the row a line into the second row has to get past, and nothing
 * in `linkPath` knows they are there.
 */
describe('which Scenes a drawing runs a line through', () => {
  const drawnLinks = (columns: string[][], joins: [string, string][]) => {
    const { at } = drawn(columns)

    return {
      at,
      links: joins.map(([from, to]) => ({ from, to, d: linkPath(at.get(from)!, at.get(to)!) })),
    }
  }

  test('says nothing of a drawing whose lines keep clear', () => {
    const { at, links } = drawnLinks([['a'], ['b']], [['a', 'b'], ['b', 'a']])

    expect([...traversals(links, at)]).toEqual([])
  })

  test('names the Scene a way on into a wrapped column runs over', () => {
    // Seven Scenes in one column take two rows, and the line into the second row
    // has the first row's points in its way. The count of crossings is blind to
    // this: no two lines meet, and the drawing is still wrong.
    const columns = [['o'], ['a', 'b', 'c', 'd', 'e', 'f', 'g']]
    const joins: [string, string][] = [['o', 'a'], ['o', 'b'], ['o', 'c'], ['o', 'd'], ['o', 'e'], ['o', 'f'], ['o', 'g']]
    const { at, links } = drawnLinks(columns, joins)

    expect(crossings(links)).toBe(0)
    expect(traversals(links, at).size).toBeGreaterThan(0)
  })
})
