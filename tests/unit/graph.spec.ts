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
   */
  test('walk a number on past a name a Scene of the Story already answers to', () => {
    const scenes = [called('a', 'The bar'), called('b', 'The bar (2)'), called('c', 'The bar')]

    expect(drawn(scenes, [exit('a', 'b'), exit('b', 'c')]))
      .toEqual(['The bar (1)', 'The bar (2)', 'The bar (3)'])
  })
})

describe('the Scenes an Exit may land on', () => {
  test('are every Scene but the one it leaves and the ones it already reaches', () => {
    const scenes = ['a', 'b', 'c'].map(scene)

    expect(scenesAExitMayLandOn(scenes, [exit('a', 'b')], 'a')).toEqual(new Set(['c']))
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
