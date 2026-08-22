import { describe, expect, it } from 'vitest'
import type { Condition, Flags } from '../../shared/utils/scenes'
import type { Position, StoryToRead } from '../../shared/utils/reading'
import { OPENING, advance, reading, take } from '../../shared/utils/reading'

/**
 * A Story built from the shots of each Scene and the Cuts between them, in the
 * shape the engine reads. Ids are the names, so a failing assertion says which
 * Scene it was standing in rather than which uuid. A Cut carries Conditions only
 * where the test states them, and a Scene sets Flags only where `sets` names
 * them, so a Story about anything else stays as short as it was.
 */
function story(
  scenes: Record<string, string[]>,
  cuts: [from: string, text: string, to: string, conditions?: Condition[]][] = [],
  openingSceneId: string | null = Object.keys(scenes)[0] ?? null,
  sets: Record<string, Flags> = {},
): StoryToRead {
  return {
    openingSceneId,
    scenes: Object.entries(scenes).map(([id, texts]) => ({
      id,
      sets: sets[id] ?? {},
      shots: texts.map((text, position) => ({
        id: `${id}-${position}`,
        text,
        position,
        image: null,
        description: '',
      })),
    })),
    cuts: cuts.map(([fromSceneId, text, toSceneId, conditions], index) => ({
      id: `cut-${index}`,
      fromSceneId,
      toSceneId,
      text,
      conditions: conditions ?? [],
    })),
  }
}

/** What the Reader is shown at a point in a Reading: the Shot's text, or the Cuts on offer. */
function shown(read: StoryToRead, at: Position) {
  const { shot, cuts, ended } = reading(read, at)
  return { text: shot?.text, offered: cuts.map(cut => cut.text), ended }
}

describe('a Reading of one Scene', () => {
  const alone = story({ Street: ['A door opens.', 'She steps out.'] })

  it('opens on the first Shot of the opening Scene', () => {
    expect(shown(alone, OPENING)).toEqual({ text: 'A door opens.', offered: [], ended: false })
  })

  it('shows the next Shot when the Reader advances', () => {
    expect(shown(alone, advance(OPENING))).toEqual({
      text: 'She steps out.',
      offered: [],
      ended: false,
    })
  })

  it('ends the path past the last Shot, with no Cut to take', () => {
    expect(shown(alone, advance(advance(OPENING)))).toEqual({
      text: undefined,
      offered: [],
      ended: true,
    })
  })

  it('shows nothing at all when the Story has no opening Scene', () => {
    expect(shown(story({}, [], null), OPENING)).toEqual({
      text: undefined,
      offered: [],
      ended: true,
    })
  })
})

describe('a Reading that reaches a Cut', () => {
  const branching = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'], Alley: ['Rain.'] },
    [['Street', 'Follow her', 'Bar'], ['Street', 'Stay outside', 'Alley']],
  )

  const endOfStreet = advance(OPENING)

  it('offers the Cuts leaving the Scene, in the Author’s order, once the Shots run out', () => {
    expect(shown(branching, endOfStreet)).toEqual({
      text: undefined,
      offered: ['Follow her', 'Stay outside'],
      ended: false,
    })
  })

  it('offers nothing while Shots remain', () => {
    expect(shown(branching, OPENING).offered).toEqual([])
  })

  it('moves to the Scene the taken Cut arrives at, from its first Shot', () => {
    const taken = take(endOfStreet, reading(branching, endOfStreet).cuts[1]!)
    expect(shown(branching, taken)).toEqual({ text: 'Rain.', offered: [], ended: false })
  })

  it('ends the path in a Scene no Cut leaves', () => {
    const taken = take(endOfStreet, reading(branching, endOfStreet).cuts[0]!)
    expect(shown(branching, advance(taken))).toEqual({
      text: undefined,
      offered: [],
      ended: true,
    })
  })
})

describe('a Reading that comes back somewhere', () => {
  const loop = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'] },
    [['Street', 'Go in', 'Bar'], ['Bar', 'Go out', 'Street']],
  )

  /** Walks the only round trip the Story allows, `times` times around. */
  function around(times: number) {
    let at = OPENING
    for (let lap = 0; lap < times; lap++) {
      for (const _ of ['in', 'out']) {
        at = advance(at)
        at = take(at, reading(loop, at).cuts[0]!)
      }
    }
    return at
  }

  it('reads the same Scene again rather than running out of Story', () => {
    expect(shown(loop, around(3))).toEqual({ text: 'A door opens.', offered: [], ended: false })
  })

  it('counts every visit to a Scene, and the opening Scene as visited once', () => {
    expect(reading(loop, OPENING).state.visits).toEqual({ Street: 1 })
    expect(reading(loop, around(3)).state.visits).toEqual({ Street: 4, Bar: 3 })
  })

  it('carries no State from one Reading to another', () => {
    reading(loop, around(2)).state.visits.Street = 99
    expect(reading(loop, OPENING).state.visits).toEqual({ Street: 1 })
  })
})

describe('a Reading given a Cut it was never offered', () => {
  const branching = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'] },
    [['Street', 'Go in', 'Bar'], ['Bar', 'Go out', 'Street']],
  )

  it('stays where it is rather than jumping to the far side of the Story', () => {
    const elsewhere: Position = { taken: ['cut-1'], shot: 0 }
    expect(shown(branching, elsewhere)).toEqual({
      text: 'A door opens.',
      offered: [],
      ended: false,
    })
  })
})

describe('a Scene that sets Flags on entry', () => {
  const setting = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'] },
    [['Street', 'Go in', 'Bar']],
    'Street',
    { Street: { coat: 'on' }, Bar: { coat: 'off', drink: 'whisky' } },
  )

  const endOfStreet = advance(OPENING)

  it('sets them the moment the Reading arrives, opening Scene included', () => {
    expect(reading(setting, OPENING).state.flags).toEqual({ coat: 'on' })
  })

  it('keeps the Flags of the Scenes behind it, and lets a later Scene write over one', () => {
    const inTheBar = take(endOfStreet, reading(setting, endOfStreet).cuts[0]!)
    expect(reading(setting, inTheBar).state.flags).toEqual({ coat: 'off', drink: 'whisky' })
  })

  it('sets nothing where the Author named no Flags', () => {
    expect(reading(story({ Street: ['A door opens.'] }), OPENING).state.flags).toEqual({})
  })
})

describe('a Cut carrying Conditions', () => {
  /**
   * One Scene the Reading stands in and two ways out of it, the second one
   * conditional — so what is offered says whether the Conditions passed.
   */
  function ways(conditions: Condition[], sets: Record<string, Flags> = {}) {
    return story(
      { Street: ['A door opens.'], Bar: ['Smoke.'], Alley: ['Rain.'] },
      [['Street', 'Stay outside', 'Alley'], ['Street', 'Go in', 'Bar', conditions]],
      'Street',
      sets,
    )
  }

  const endOfStreet = advance(OPENING)

  it('is offered where the Flag holds what the Condition asks', () => {
    const carrying = ways([{ flag: 'key', is: 'found' }], { Street: { key: 'found' } })
    expect(shown(carrying, endOfStreet).offered).toEqual(['Stay outside', 'Go in'])
  })

  it('is not offered where the Flag holds something else', () => {
    const carrying = ways([{ flag: 'key', is: 'found' }], { Street: { key: 'lost' } })
    expect(shown(carrying, endOfStreet).offered).toEqual(['Stay outside'])
  })

  it('reads a Flag nobody set as the empty value, which is how absence is tested', () => {
    expect(shown(ways([{ flag: 'key', is: '' }]), endOfStreet).offered)
      .toEqual(['Stay outside', 'Go in'])
    expect(shown(ways([{ flag: 'key', is: 'found' }]), endOfStreet).offered)
      .toEqual(['Stay outside'])
  })

  it('counts the visits to a Scene, the Scene being stood in included', () => {
    const first = ways([{ scene: 'Street', visits: 'at least', times: 2 }])
    expect(shown(first, endOfStreet).offered).toEqual(['Stay outside'])

    const once = ways([{ scene: 'Street', visits: 'fewer than', times: 2 }])
    expect(shown(once, endOfStreet).offered).toEqual(['Stay outside', 'Go in'])
  })

  it('is offered where every Condition it carries holds, and hidden where one fails', () => {
    const both: Condition[] = [
      { flag: 'key', is: 'found' },
      { scene: 'Street', visits: 'at least', times: 1 },
    ]
    expect(shown(ways(both, { Street: { key: 'found' } }), endOfStreet).offered)
      .toEqual(['Stay outside', 'Go in'])
    // The Street has been entered, so it is the Flag alone that shuts the door.
    expect(shown(ways(both, { Street: { key: 'lost' } }), endOfStreet).offered)
      .toEqual(['Stay outside'])
    expect(shown(ways([...both, { flag: 'coat', is: 'on' }], { Street: { key: 'found' } }),
      endOfStreet).offered).toEqual(['Stay outside'])
  })

  it('is always offered where it carries none', () => {
    expect(shown(ways([]), endOfStreet).offered).toEqual(['Stay outside', 'Go in'])
  })

  it('ends the path where the only Cuts out are ones this Reading cannot take', () => {
    const shut = story(
      { Street: ['A door opens.'], Bar: ['Smoke.'] },
      [['Street', 'Go in', 'Bar', [{ flag: 'key', is: 'found' }]]],
    )
    expect(shown(shut, endOfStreet)).toEqual({ text: undefined, offered: [], ended: true })
  })

  it('reads a Flag set by a Scene the Reading has left behind', () => {
    // The coat goes on in the street, and it is the door of the bar — a Scene
    // away — that asks for it: a Flag outlives the Scene that set it.
    const carrying = story(
      { Street: ['A door opens.'], Hall: ['A stair.'], Bar: ['Smoke.'], Alley: ['Rain.'] },
      [
        ['Street', 'Go through', 'Hall'],
        ['Hall', 'Into the bar', 'Bar', [{ flag: 'coat', is: 'on' }]],
        ['Hall', 'Out the back', 'Alley', [{ flag: 'coat', is: 'off' }]],
      ],
      'Street',
      { Street: { coat: 'on' } },
    )

    const endOfStreet = advance(OPENING)
    const inTheHall = take(endOfStreet, reading(carrying, endOfStreet).cuts[0]!)
    expect(shown(carrying, advance(inTheHall)).offered).toEqual(['Into the bar'])
  })

  it('cannot be taken by a Reading whose State never passed it', () => {
    const shut = story(
      { Street: ['A door opens.'], Bar: ['Smoke.'] },
      [['Street', 'Go in', 'Bar', [{ flag: 'key', is: 'found' }]]],
    )
    const forged: Position = { taken: ['cut-0'], shot: 0 }
    expect(shown(shut, forged).text).toBe('A door opens.')
  })
})

describe('a Scene read a second time', () => {
  /**
   * The Street twice, going somewhere else the second time round: the Shots of a
   * Scene are the same on every visit, so what changes is which Cut is offered.
   */
  const returning = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'], Alley: ['Rain.'] },
    [
      ['Street', 'Go in', 'Bar', [{ scene: 'Street', visits: 'fewer than', times: 2 }]],
      ['Street', 'Give up', 'Alley', [{ scene: 'Street', visits: 'at least', times: 2 }]],
      ['Bar', 'Back out', 'Street'],
    ],
  )

  it('offers what the first visit offered, and then something else', () => {
    const endOfStreet = advance(OPENING)
    expect(shown(returning, endOfStreet).offered).toEqual(['Go in'])

    const inTheBar = take(endOfStreet, reading(returning, endOfStreet).cuts[0]!)
    const endOfBar = advance(inTheBar)
    const backOutside = take(endOfBar, reading(returning, endOfBar).cuts[0]!)
    const endOfStreetAgain = advance(backOutside)

    expect(shown(returning, endOfStreetAgain).offered).toEqual(['Give up'])
  })

  it('lets the same Cut be taken once and no more, however the Position asks', () => {
    // The way in is offered on the first visit to the street and not on the
    // second, so a Reading that comes back and claims to take it again is a
    // Position no Reader could have reached: the walk stops where it stopped.
    const endOfStreet = advance(OPENING)
    const inTheBar = take(endOfStreet, reading(returning, endOfStreet).cuts[0]!)
    const endOfBar = advance(inTheBar)
    const backOutside = take(endOfBar, reading(returning, endOfBar).cuts[0]!)

    expect(shown(returning, backOutside).text).toBe('A door opens.')

    const twice: Position = { taken: [...backOutside.taken, 'cut-0'], shot: 0 }
    expect(shown(returning, twice).text).toBe('A door opens.')
    expect(reading(returning, twice).state.visits).toEqual({ Street: 2, Bar: 1 })
  })

  it('takes the Cut it is offered the second time round', () => {
    let at = OPENING
    for (const _ of ['in', 'out', 'away']) {
      at = advance(at)
      at = take(at, reading(returning, at).cuts[0]!)
    }
    expect(shown(returning, at).text).toBe('Rain.')
  })
})
