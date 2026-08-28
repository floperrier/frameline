import { describe, expect, it } from 'vitest'
import type { Condition, Sets } from '../../shared/utils/scenes'
import type { Path, State, StoryToRead } from '../../shared/utils/reading'
import { advance, opening, reading, take, unmet } from '../../shared/utils/reading'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import type { Phrase } from '../../shared/utils/phrases'

/**
 * A Story built from the shots of each Scene and the Exits between them, in the
 * shape the engine reads. Ids are the names, so a failing assertion says which
 * Scene it was standing in rather than which uuid. An Exit carries Conditions only
 * where the test states them, and a Scene sets Flags only where `sets` names
 * them, so a Story about anything else stays as short as it was.
 *
 * A Shot is written as its text, or as its text and the Conditions it plays
 * under, so a Scene of plain Shots reads as the list of lines it is.
 */
type Written = string | [text: string, conditions: Condition[]]

function story(
  scenes: Record<string, Written[]>,
  exits: [from: string, text: string, to: string, conditions?: Condition[]][] = [],
  openingSceneId: string | null = Object.keys(scenes)[0] ?? null,
  sets: Record<string, Sets> = {},
): StoryToRead {
  return {
    openingSceneId,
    scenes: Object.entries(scenes).map(([id, texts]) => ({
      id,
      sets: sets[id] ?? {},
      shots: texts.map((written, position) => {
        const [text, conditions] = typeof written === 'string' ? [written, []] : written
        return { id: `${id}-${position}`, text, position, image: null, description: '', conditions }
      }),
    })),
    exits: exits.map(([fromSceneId, text, toSceneId, conditions], index) => ({
      id: `exit-${index}`,
      fromSceneId,
      toSceneId,
      text,
      position: index,
      conditions: conditions ?? [],
    })),
  }
}

/**
 * Where a Reading starts, under a seed this suite states rather than one drawn
 * for it: every test but the ones about the draw itself wants the same Reading
 * twice, and a seed drawn behind them would be the one thing they could not
 * state. The Path is the whole of a Reading, seed included, so stating it is
 * stating the Reading.
 */
const OPENING = opening(1)

/** What the Reader is shown at a point in a Reading: the Shot's text, or the Exits on offer. */
function shown(read: StoryToRead, at: Path) {
  const { shot, exits, ended } = reading(read, at)
  return { text: shot?.text, offered: exits.map(exit => exit.text), ended }
}

/** The run of Shots this Reading plays, which is the Scene's own minus the skipped. */
function run(read: StoryToRead, at: Path) {
  return reading(read, at).run.map(shot => shot.text)
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

  it('ends the path past the last Shot, with no Exit to take', () => {
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

describe('a Reading that reaches an Exit', () => {
  const branching = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'], Alley: ['Rain.'] },
    [['Street', 'Follow her', 'Bar'], ['Street', 'Stay outside', 'Alley']],
  )

  const endOfStreet = advance(OPENING)

  it('offers the Exits leaving the Scene, in the Author’s order, once the Shots run out', () => {
    expect(shown(branching, endOfStreet)).toEqual({
      text: undefined,
      offered: ['Follow her', 'Stay outside'],
      ended: false,
    })
  })

  it('offers nothing while Shots remain', () => {
    expect(shown(branching, OPENING).offered).toEqual([])
  })

  it('moves to the Scene the taken Exit arrives at, from its first Shot', () => {
    const taken = take(endOfStreet, reading(branching, endOfStreet).exits[1]!)
    expect(shown(branching, taken)).toEqual({ text: 'Rain.', offered: [], ended: false })
  })

  it('ends the path in a Scene no Exit leaves', () => {
    const taken = take(endOfStreet, reading(branching, endOfStreet).exits[0]!)
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
        at = take(at, reading(loop, at).exits[0]!)
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

describe('a Reading given an Exit it was never offered', () => {
  const branching = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'] },
    [['Street', 'Go in', 'Bar'], ['Bar', 'Go out', 'Street']],
  )

  it('stays where it is rather than jumping to the far side of the Story', () => {
    const elsewhere: Path = { taken: ['exit-1'], shot: 0 }
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
    const inTheBar = take(endOfStreet, reading(setting, endOfStreet).exits[0]!)
    expect(reading(setting, inTheBar).state.flags).toEqual({ coat: 'off', drink: 'whisky' })
  })

  it('sets nothing where the Author named no Flags', () => {
    expect(reading(story({ Street: ['A door opens.'] }), OPENING).state.flags).toEqual({})
  })
})

describe('an Exit carrying Conditions', () => {
  /**
   * One Scene the Reading stands in and two ways out of it, the second one
   * conditional — so what is offered says whether the Conditions passed.
   */
  function ways(conditions: Condition[], sets: Record<string, Sets> = {}) {
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

  it('ends the path where the only Exits out are ones this Reading cannot take', () => {
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
    const inTheHall = take(endOfStreet, reading(carrying, endOfStreet).exits[0]!)
    expect(shown(carrying, advance(inTheHall)).offered).toEqual(['Into the bar'])
  })

  it('cannot be taken by a Reading whose State never passed it', () => {
    const shut = story(
      { Street: ['A door opens.'], Bar: ['Smoke.'] },
      [['Street', 'Go in', 'Bar', [{ flag: 'key', is: 'found' }]]],
    )
    const forged: Path = { taken: ['exit-0'], shot: 0 }
    expect(shown(shut, forged).text).toBe('A door opens.')
  })
})

describe('a Scene read a second time', () => {
  /**
   * The Street twice, going somewhere else the second time round: the Shots of a
   * Scene are the same on every visit, so what changes is which Exit is offered.
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

    const inTheBar = take(endOfStreet, reading(returning, endOfStreet).exits[0]!)
    const endOfBar = advance(inTheBar)
    const backOutside = take(endOfBar, reading(returning, endOfBar).exits[0]!)
    const endOfStreetAgain = advance(backOutside)

    expect(shown(returning, endOfStreetAgain).offered).toEqual(['Give up'])
  })

  it('lets the same Exit be taken once and no more, however the Path asks', () => {
    // The way in is offered on the first visit to the street and not on the
    // second, so a Reading that comes back and claims to take it again is a
    // Path no Reader could have reached: the walk stops where it stopped.
    const endOfStreet = advance(OPENING)
    const inTheBar = take(endOfStreet, reading(returning, endOfStreet).exits[0]!)
    const endOfBar = advance(inTheBar)
    const backOutside = take(endOfBar, reading(returning, endOfBar).exits[0]!)

    expect(shown(returning, backOutside).text).toBe('A door opens.')

    const twice: Path = { taken: [...backOutside.taken, 'exit-0'], shot: 0 }
    expect(shown(returning, twice).text).toBe('A door opens.')
    expect(reading(returning, twice).state.visits).toEqual({ Street: 2, Bar: 1 })
  })

  it('takes the Exit it is offered the second time round', () => {
    let at = OPENING
    for (const _ of ['in', 'out', 'away']) {
      at = advance(at)
      at = take(at, reading(returning, at).exits[0]!)
    }
    expect(shown(returning, at).text).toBe('Rain.')
  })
})

describe('the tests an Exit is hidden by', () => {
  /** The Scenes a Condition names, read back the way an Author reads them. */
  const named = (id: string) => ({ house: 'The House' }[id] ?? id)

  /**
   * The words themselves, read out of the message file the interface reads. The
   * sentences below are what an Author sees, so they are asserted whole rather
   * than against a stub — which also proves the English messages these lines are
   * assembled from.
   */
  const says: Phrase = (key, values) => phrase(DEFAULT_LOCALE, key, values)

  const state: State = { flags: { reel: 'spooled' }, visits: { house: 1 } }

  it('says nothing of an Exit this Reading is offered', () => {
    expect(unmet([{ flag: 'reel', is: 'spooled' }], state, named, says)).toEqual([])
    expect(unmet([], state, named, says)).toEqual([])
  })

  it('names what a Flag was asked to hold beside what it holds', () => {
    expect(unmet([{ flag: 'reel', is: 'threaded' }], state, named, says))
      .toEqual(['needs reel to hold threaded, holds spooled'])
  })

  it('says a Flag nobody set holds nothing, and that asking for nothing is asking', () => {
    expect(unmet([{ flag: 'coat', is: 'on' }], state, named, says))
      .toEqual(['needs coat to hold on, holds nothing'])
    expect(unmet([{ flag: 'reel', is: '' }], state, named, says))
      .toEqual(['needs reel to hold nothing, holds spooled'])
  })

  it('names the Scene a visit count is asked of, and how often it was entered', () => {
    expect(unmet([{ scene: 'house', visits: 'at least', times: 2 }], state, named, says))
      .toEqual(['needs at least 2 visits to The House, entered once'])
    expect(unmet([{ scene: 'house', visits: 'fewer than', times: 1 }], state, named, says))
      .toEqual(['needs fewer than 1 visit to The House, entered once'])
    expect(unmet([{ scene: 'house', visits: 'fewer than', times: 2 }],
      { flags: {}, visits: { house: 3 } }, named, says))
      .toEqual(['needs fewer than 2 visits to The House, entered 3 times'])
  })

  it('says a Scene the Reading has never reached was never entered', () => {
    expect(unmet([{ scene: 'bar', visits: 'at least', times: 3 }], state, named, says))
      .toEqual(['needs at least 3 visits to bar, never entered'])
  })

  it('names every test that failed, and only those', () => {
    expect(unmet([
      { flag: 'reel', is: 'spooled' },
      { flag: 'reel', is: 'threaded' },
      { scene: 'house', visits: 'at least', times: 4 },
    ], state, named, says)).toEqual([
      'needs reel to hold threaded, holds spooled',
      'needs at least 4 visits to The House, entered once',
    ])
  })
})

describe('a Shot carrying Conditions', () => {
  /**
   * A booth read twice: the middle Shot plays only on a return, and the last one
   * only on a first visit. What the Reading sees says which run it got — the
   * Scene the Author wrote is one, and the run played is the one that holds.
   */
  const booth = story(
    {
      Booth: [
        'The projector ticks over.',
        ['You have been here before.', [{ scene: 'Booth', visits: 'at least', times: 2 }]],
        ['The last show has run out.', [{ scene: 'Booth', visits: 'fewer than', times: 2 }]],
      ],
      House: ['Rows of empty seats.'],
    },
    [['Booth', 'Walk the house', 'House'], ['House', 'Back up', 'Booth']],
  )

  /** Round the only loop the Story allows, `times` times, ending in the Booth. */
  function laps(times: number) {
    let at = OPENING
    for (let lap = 0; lap < times; lap++) {
      for (const _ of ['out', 'back']) {
        while (reading(booth, at).shot) at = advance(at)
        at = take(at, reading(booth, at).exits[0]!)
      }
    }
    return at
  }

  it('leaves out the Shots whose Conditions this Reading fails', () => {
    expect(run(booth, OPENING)).toEqual(['The projector ticks over.', 'The last show has run out.'])
    expect(run(booth, laps(1)))
      .toEqual(['The projector ticks over.', 'You have been here before.'])
  })

  it('plays the run without the gap the skipped Shot left', () => {
    expect(shown(booth, OPENING).text).toBe('The projector ticks over.')
    expect(shown(booth, advance(OPENING)).text).toBe('The last show has run out.')
    expect(shown(booth, advance(advance(OPENING))).text).toBeUndefined()
  })

  it('says something different on the return visit, from the same Scene', () => {
    expect(shown(booth, advance(laps(1))).text).toBe('You have been here before.')
  })

  it('offers the ways on once the run this Reading plays has run out', () => {
    expect(shown(booth, advance(advance(OPENING))).offered).toEqual(['Walk the house'])
  })

  it('plays a Shot carrying none to every Reading', () => {
    const plain = story({ Street: ['A door opens.', 'She steps out.'] })
    expect(run(plain, OPENING)).toEqual(['A door opens.', 'She steps out.'])
  })

  it('reads a Flag a Scene behind it, the way an Exit does', () => {
    const wearing = story(
      {
        Street: ['A door opens.'],
        Bar: ['Smoke.', ['You keep your coat on.', [{ flag: 'coat', is: 'on' }]]],
      },
      [['Street', 'Go in', 'Bar']],
      'Street',
      { Street: { coat: 'on' } },
    )

    const inTheBar = take(advance(OPENING), reading(wearing, advance(OPENING)).exits[0]!)
    expect(run(wearing, inTheBar)).toEqual(['Smoke.', 'You keep your coat on.'])
  })

  it('ends the path in a Scene whose every Shot is skipped and which no Exit leaves', () => {
    const shut = story({ Booth: [['Only for the second time.', [{ flag: 'key', is: 'found' }]]] })
    expect(run(shut, OPENING)).toEqual([])
    expect(shown(shut, OPENING)).toEqual({ text: undefined, offered: [], ended: true })
  })

  it('holds no run at all where the Reading stands in no Scene', () => {
    expect(run(story({}, [], null), OPENING)).toEqual([])
  })
})

describe('a Scene drawing one of several values for a Flag', () => {
  /**
   * One Scene whose weather is drawn from three values, and three Shots each
   * playing under one of them: what the Reader is shown is what was drawn, which
   * is how these read the draw without reaching for the hash behind it.
   */
  const weather = story(
    {
      Street: [
        ['Rain on the awning.', [{ flag: 'weather', is: 'rain' }]],
        ['Sun on the awning.', [{ flag: 'weather', is: 'sun' }]],
        ['Haze over the street.', [{ flag: 'weather', is: 'haze' }]],
      ],
    },
    [],
    'Street',
    { Street: { weather: ['rain', 'sun', 'haze'] } },
  )

  /** The Paths a hundred Readings of one Story open at, each under its own seed. */
  const seeds = Array.from({ length: 100 }, (_, seed) => opening(seed))

  it('plays the one Shot the drawn value matches, and none of the others', () => {
    for (const at of seeds.slice(0, 20)) {
      expect(run(weather, at)).toHaveLength(1)
      expect(shown(weather, at).text).toMatch(/Rain on the awning\.|Sun on the awning\.|Haze over/)
    }
  })

  it('shows the same variant every time one Path is read', () => {
    const at = opening(7)
    expect(shown(weather, at)).toEqual(shown(weather, at))
    // The Reader going back a beat and coming forward again is the same
    // Path read a third time, and the run it plays does not move under them.
    expect(run(weather, at)).toEqual(run(weather, advance(at)))
  })

  it('reaches every value in the list, across the seeds Readings are drawn under', () => {
    expect(new Set(seeds.map(at => shown(weather, at).text)).size).toBe(3)
  })

  it('draws again on a second entry to the Scene, so a Story read round may differ', () => {
    const looping = story(
      {
        Street: [
          ['Rain on the awning.', [{ flag: 'weather', is: 'rain' }]],
          ['Sun on the awning.', [{ flag: 'weather', is: 'sun' }]],
        ],
        Corner: ['She turns back.'],
      },
      [['Street', 'Walk on', 'Corner'], ['Corner', 'Back to the street', 'Street']],
      'Street',
      { Street: { weather: ['rain', 'sun'] } },
    )

    /** The Path two Exits on, standing in the Street for the second time. */
    const roundAgain = (at: Path) => {
      const onward = take(advance(at), reading(looping, advance(at)).exits[0]!)
      return take(advance(onward), reading(looping, advance(onward)).exits[0]!)
    }

    const differed = seeds.filter(at =>
      shown(looping, at).text !== shown(looping, roundAgain(at)).text)
    expect(differed.length).toBeGreaterThan(0)
  })

  it('leaves a later Scene’s draw alone when an earlier Scene is edited', () => {
    /** One Scene ahead of another, whose Shots are the Author's to change. */
    const ahead = (street: Written[]) => story(
      {
        Street: street,
        Bar: [
          ['Whisky.', [{ flag: 'drink', is: 'whisky' }]],
          ['Beer.', [{ flag: 'drink', is: 'beer' }]],
        ],
      },
      [['Street', 'Go in', 'Bar']],
      'Street',
      { Bar: { drink: ['whisky', 'beer'] } },
    )

    const written = ahead(['A door opens.'])
    // A Shot added to the Scene before it, and a Shot the same Scene skips: both
    // shift what the walk passes through, and neither is part of the draw's key.
    const added = ahead(['A door opens.', 'She steps out.'])
    const skipped = ahead([
      'A door opens.',
      ['Only on the way back.', [{ flag: 'coat', is: 'on' }]],
    ])

    for (const at of seeds.slice(0, 20)) {
      const inTheBar = (read: StoryToRead, from: Path) =>
        take(from, reading(read, from).exits[0]!)
      const drank = (read: StoryToRead, beats: number) => {
        let from = at
        for (let beat = 0; beat < beats; beat++) from = advance(from)
        return reading(read, inTheBar(read, from)).state.flags.drink
      }

      expect(drank(added, 2)).toBe(drank(written, 1))
      expect(drank(skipped, 1)).toBe(drank(written, 1))
    }
  })

  it('decides an Exit in a later Scene, the way a Flag the Author set does', () => {
    const tossing = story(
      { Street: ['A coin comes down.'], Heads: ['Heads.'], Tails: ['Tails.'] },
      [
        ['Street', 'Heads', 'Heads', [{ flag: 'coin', is: 'heads' }]],
        ['Street', 'Tails', 'Tails', [{ flag: 'coin', is: 'tails' }]],
      ],
      'Street',
      { Street: { coin: ['heads', 'tails'] } },
    )

    for (const at of seeds.slice(0, 20)) {
      const endOfStreet = advance(at)
      const { state, exits } = reading(tossing, endOfStreet)
      expect(exits.map(exit => exit.text))
        .toEqual([state.flags.coin === 'heads' ? 'Heads' : 'Tails'])
    }
  })

  it('leaves a Flag given one value behaving exactly as it did', () => {
    const setting = story(
      { Street: ['A door opens.'] },
      [],
      'Street',
      { Street: { coat: 'on', weather: ['rain', 'sun'] } },
    )

    for (const at of seeds.slice(0, 20)) {
      expect(reading(setting, at).state.flags.coat).toBe('on')
    }
  })
})
