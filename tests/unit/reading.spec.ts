import { describe, expect, it } from 'vitest'
import type { Condition, Sets } from '../../shared/utils/scenes'
import type { Path, State, StoryToRead } from '../../shared/utils/reading'
import { advance, back, moved, opening, pathTo, reading, resumes, take, unmet } from '../../shared/utils/reading'
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
  exits: [
    from: string,
    text: string,
    to: string,
    conditions?: Condition[],
    stepsBack?: boolean | null,
  ][] = [],
  openingSceneId: string | null = Object.keys(scenes)[0] ?? null,
  sets: Record<string, Sets> = {},
  stepsBack = true,
): StoryToRead {
  return {
    openingSceneId,
    stepsBack,
    scenes: Object.entries(scenes).map(([id, texts]) => ({
      id,
      sets: sets[id] ?? {},
      shots: texts.map((written, position) => {
        const [text, conditions] = typeof written === 'string' ? [written, []] : written
        return { id: `${id}-${position}`, text, position, image: null, description: '', conditions }
      }),
    })),
    exits: exits.map(([fromSceneId, text, toSceneId, conditions, crossed], index) => ({
      id: `exit-${index}`,
      fromSceneId,
      toSceneId,
      text,
      position: index,
      conditions: conditions ?? [],
      stepsBack: crossed ?? null,
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

describe('a Story that comes back on itself', () => {
  /**
   * The Story the bench now refuses to write, read as the engine reads one written
   * before it did: the way out of the Bar leads to the Street, which this Reading
   * has already stood in, so it is never handed over. Nothing an Author wrote is
   * edited — see `docs/adr/0048-a-scene-is-entered-once.md`.
   */
  const loop = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'] },
    [['Street', 'Go in', 'Bar'], ['Bar', 'Go out', 'Street']],
  )

  const endOfStreet = advance(OPENING)
  const inTheBar = take(endOfStreet, reading(loop, endOfStreet).exits[0]!)
  const endOfBar = advance(inTheBar)

  it('does not offer the way back to a Scene this Reading has stood in', () => {
    expect(shown(loop, endOfStreet).offered).toEqual(['Go in'])
    expect(shown(loop, endOfBar)).toEqual({ text: undefined, offered: [], ended: true })
  })

  it('holds the Scenes it has entered, in the order it entered them', () => {
    expect(reading(loop, OPENING).state.entered).toEqual(['Street'])
    expect(reading(loop, endOfBar).state.entered).toEqual(['Street', 'Bar'])
  })

  it('stands where it stood when a Path claims the way back anyway', () => {
    // The same test that hid the way on refuses the Path that claims it: a forged
    // Path stops the walk where the Reader really was.
    const forged: Path = { ...endOfBar, taken: [...endOfBar.taken, 'exit-1'], shot: 0 }

    expect(shown(loop, forged).text).toBe('Smoke.')
    expect(reading(loop, forged).state.entered).toEqual(['Street', 'Bar'])
  })

  it('carries no State from one Reading to another', () => {
    reading(loop, endOfBar).state.entered.push('Nowhere')
    expect(reading(loop, OPENING).state.entered).toEqual(['Street'])
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

  it('asks whether a Scene has been entered, the Scene stood in included', () => {
    const been = ways([{ scene: 'Street', entered: true }])
    expect(shown(been, endOfStreet).offered).toEqual(['Stay outside', 'Go in'])

    const notBeen = ways([{ scene: 'Street', entered: false }])
    expect(shown(notBeen, endOfStreet).offered).toEqual(['Stay outside'])

    // And a Scene nothing has reached is one the Reader has not stood in.
    expect(shown(ways([{ scene: 'Bar', entered: false }]), endOfStreet).offered)
      .toEqual(['Stay outside', 'Go in'])
  })

  it('is offered where every Condition it carries holds, and hidden where one fails', () => {
    const both: Condition[] = [
      { flag: 'key', is: 'found' },
      { scene: 'Street', entered: true },
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

describe('a Condition still written in the shape that counted', () => {
  /**
   * The shape a Condition was stored in while a Reading could enter a Scene again
   * and again. It is read for the one deploy before #306 rewrites what is stored,
   * and its meaning is untouched: a Scene is entered at most once, so what it
   * compares against is one or nought and the comparison it asked for is the
   * comparison it makes.
   */
  function asked(conditions: Condition[]) {
    return story(
      { Street: ['A door opens.'], Bar: ['Smoke.'] },
      [['Street', 'Go in', 'Bar', conditions]],
    )
  }

  const endOfStreet = advance(OPENING)
  const offered = (conditions: Condition[]) => shown(asked(conditions), endOfStreet).offered

  it('reads “at least one” as the Scene having been entered', () => {
    expect(offered([{ scene: 'Street', visits: 'at least', times: 1 }])).toEqual(['Go in'])
    expect(offered([{ scene: 'Bar', visits: 'at least', times: 1 }])).toEqual([])
  })

  it('reads “fewer than one” as the Scene never having been entered', () => {
    expect(offered([{ scene: 'Bar', visits: 'fewer than', times: 1 }])).toEqual(['Go in'])
    expect(offered([{ scene: 'Street', visits: 'fewer than', times: 1 }])).toEqual([])
  })

  /**
   * Which is why #306 removes those from the list rather than rewriting them: a
   * count of two is a count nothing reaches, and a count of fewer than two is one
   * everything does — neither is a question the language that replaced it can ask.
   */
  it('can never hold past one entry, and always holds short of two', () => {
    expect(offered([{ scene: 'Street', visits: 'at least', times: 2 }])).toEqual([])
    expect(offered([{ scene: 'Street', visits: 'fewer than', times: 2 }])).toEqual(['Go in'])
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

  const state: State = { flags: { reel: 'spooled' }, entered: ['house'] }

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

  it('names the Scene a Condition asks about, and which way it asked', () => {
    expect(unmet([{ scene: 'bar', entered: true }], state, named, says))
      .toEqual(['needs bar to have been entered, and it has not'])
    expect(unmet([{ scene: 'house', entered: false }], state, named, says))
      .toEqual(['needs The House not to have been entered, and it has'])
  })

  /** The shape that counted still says what it asked for, until #307 stops reading it. */
  it('names what a visit count asked of a Scene, and whether it was entered', () => {
    expect(unmet([{ scene: 'house', visits: 'at least', times: 2 }], state, named, says))
      .toEqual(['needs at least 2 visits to The House, entered once'])
    expect(unmet([{ scene: 'bar', visits: 'at least', times: 3 }], state, named, says))
      .toEqual(['needs at least 3 visits to bar, never entered'])
  })

  it('names every test that failed, and only those', () => {
    expect(unmet([
      { flag: 'reel', is: 'spooled' },
      { flag: 'reel', is: 'threaded' },
      { scene: 'house', entered: false },
    ], state, named, says)).toEqual([
      'needs reel to hold threaded, holds spooled',
      'needs The House not to have been entered, and it has',
    ])
  })
})

describe('a Shot carrying Conditions', () => {
  /**
   * A booth reached two ways round: the middle Shot plays for a Reading that came
   * through the house, and the last one for a Reading that did not. What the
   * Reading sees says which run it got — the Scene the Author wrote is one, and
   * the run played is the one that holds.
   *
   * Two ways round rather than one Scene read twice: a Reading stands in a Scene
   * at most once, so what makes the same Scene read differently is the State it is
   * arrived with — see `docs/adr/0048-a-scene-is-entered-once.md`.
   */
  const booth = story(
    {
      Foyer: ['A door under the stairs.'],
      House: ['Rows of empty seats.'],
      Booth: [
        'The projector ticks over.',
        ['You have been down in the house.', [{ scene: 'House', entered: true }]],
        ['The house is still dark.', [{ scene: 'House', entered: false }]],
      ],
      Reel: ['The reel runs out.'],
    },
    [
      ['Foyer', 'Straight up', 'Booth'],
      ['Foyer', 'Through the house', 'House'],
      ['House', 'Up to the booth', 'Booth'],
      ['Booth', 'Thread it', 'Reel'],
    ],
  )

  /** Reads the Foyer to its end and takes one of the two ways up, landing in the Booth. */
  function upTo(place: number) {
    const endOfFoyer = advance(OPENING)
    const at = take(endOfFoyer, reading(booth, endOfFoyer).exits[place]!)
    if (place === 0) return at

    const endOfHouse = advance(at)
    return take(endOfHouse, reading(booth, endOfHouse).exits[0]!)
  }

  const straightUp = upTo(0)
  const roundTheHouse = upTo(1)

  it('leaves out the Shots whose Conditions this Reading fails', () => {
    expect(run(booth, straightUp))
      .toEqual(['The projector ticks over.', 'The house is still dark.'])
    expect(run(booth, roundTheHouse))
      .toEqual(['The projector ticks over.', 'You have been down in the house.'])
  })

  it('plays the run without the gap the skipped Shot left', () => {
    expect(shown(booth, straightUp).text).toBe('The projector ticks over.')
    expect(shown(booth, advance(straightUp)).text).toBe('The house is still dark.')
    expect(shown(booth, advance(advance(straightUp))).text).toBeUndefined()
  })

  it('says something different to a Reading that came the other way', () => {
    expect(shown(booth, advance(roundTheHouse)).text).toBe('You have been down in the house.')
  })

  it('offers the ways on once the run this Reading plays has run out', () => {
    expect(shown(booth, advance(advance(straightUp))).offered).toEqual(['Thread it'])
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

  /**
   * The draw is made as the Reading arrives, and there is one arrival — so the key
   * it is hashed from is the seed, the Scene and the Flag, and how the Reading got
   * there has left it. Two ways round to one Scene under one seed therefore draw
   * alike, which is what tells this apart from the count that used to be in the
   * key: see `docs/adr/0048-a-scene-is-entered-once.md`.
   */
  it('draws on the seed, the Scene and the Flag alone, so two ways round draw alike', () => {
    const twoWays = story(
      {
        Foyer: ['A door under the stairs.'],
        Lane: ['She goes the long way.'],
        Corner: [
          ['Rain on the awning.', [{ flag: 'weather', is: 'rain' }]],
          ['Sun on the awning.', [{ flag: 'weather', is: 'sun' }]],
        ],
      },
      [
        ['Foyer', 'Straight there', 'Corner'],
        ['Foyer', 'The long way', 'Lane'],
        ['Lane', 'On to the corner', 'Corner'],
      ],
      'Foyer',
      { Corner: { weather: ['rain', 'sun'] } },
    )

    /** The Corner reached by the Exit at that Place out of the Foyer. */
    const cornerBy = (at: Path, place: number) => {
      const straight = take(advance(at), reading(twoWays, advance(at)).exits[place]!)
      if (place === 0) return straight

      return take(advance(straight), reading(twoWays, advance(straight)).exits[0]!)
    }

    for (const at of seeds) {
      expect(shown(twoWays, cornerBy(at, 0)).text).toBe(shown(twoWays, cornerBy(at, 1)).text)
    }
    // And the list is still reached at both ends across the seeds a Reading is
    // drawn under, so what they agree on is a draw and not one value throughout.
    expect(new Set(seeds.map(at => shown(twoWays, cornerBy(at, 0)).text)).size).toBe(2)
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

describe('a Reading stepped back', () => {
  /**
   * A Street of two Shots, a Bar of two, and one way between them — so a step
   * back has somewhere to go inside a Scene and somewhere to go across an Exit,
   * and the Scene stepped back into has a run long enough for the landing to be
   * a fact rather than a coincidence.
   */
  const night = story(
    {
      Street: ['A door opens.', 'She steps out.'],
      Bar: ['Smoke.', 'No one she knows.'],
      Corner: ['Rain on the awning.'],
    },
    [['Street', 'Follow her', 'Bar'], ['Bar', 'Leave', 'Corner']],
  )

  /** Reads a Scene to its end and takes the first way on out of it. */
  function on(read: StoryToRead, at: Path) {
    while (reading(read, at).shot) at = advance(at)
    return take(at, reading(read, at).exits[0]!)
  }

  it('steps back to the Shot before, inside a Scene', () => {
    expect(shown(night, back(night, advance(OPENING))!).text).toBe('A door opens.')
  })

  it('offers nothing at all on the very first beat of the Story', () => {
    expect(back(night, OPENING)).toBeUndefined()
  })

  it('crosses the Exit it came by, landing on the ways on out of the Scene it left', () => {
    const inTheBar = on(night, OPENING)
    expect(shown(night, inTheBar).text).toBe('Smoke.')

    const backInTheStreet = back(night, inTheBar)!
    expect(shown(night, backInTheStreet)).toEqual({
      text: undefined,
      offered: ['Follow her'],
      ended: false,
    })
    expect(reading(night, backInTheStreet).sceneId).toBe('Street')
  })

  it('steps back off an ending, onto the last beat that was played', () => {
    // A Bar nothing leaves, so the Reading runs out there rather than looping.
    const cul = story(
      { Street: ['A door opens.'], Bar: ['Smoke.', 'No one she knows.'] },
      [['Street', 'Follow her', 'Bar']],
    )

    const ending = advance(advance(on(cul, OPENING)))
    expect(shown(cul, ending).ended).toBe(true)
    expect(shown(cul, back(cul, ending)!).text).toBe('No one she knows.')
  })

  it('lands past the run this Reading played, not past the one the Author wrote', () => {
    /**
     * A Booth whose second Shot plays on a return alone: stepping back into it
     * from the House has to land at the end of the two Shots this Reading saw,
     * where its ways on are, and not at the end of the three that are written.
     */
    const booth = story(
      {
        Booth: [
          'The projector ticks over.',
          ['You have been here before.', [{ scene: 'Booth', visits: 'at least', times: 2 }]],
          'The reel runs out.',
        ],
        House: ['Rows of empty seats.'],
      },
      [['Booth', 'Walk the house', 'House']],
    )

    const inTheHouse = on(booth, OPENING)
    const backInTheBooth = back(booth, inTheHouse)!

    expect(run(booth, backInTheBooth)).toEqual(['The projector ticks over.', 'The reel runs out.'])
    expect(backInTheBooth.shot).toBe(2)
    expect(shown(booth, backInTheBooth).offered).toEqual(['Walk the house'])
  })

  it('leaves the State where stepping back and going on again is a Reading that never did', () => {
    const straight = on(night, OPENING)
    const there = on(night, straight)

    // Out to the Bar, back into the Street, and out to the Bar again: the second
    // arrival is the first, because the Path that carries it is the same Path.
    let wandering = back(night, straight)!
    wandering = on(night, wandering)

    expect(wandering).toEqual(straight)
    expect(reading(night, wandering).state).toEqual(reading(night, straight).state)

    // And the Scene stepped out of and walked into again is entered once: a step
    // back is a shorter Path, not a second arrival.
    expect(reading(night, there).state.entered).toEqual(['Street', 'Bar', 'Corner'])
  })

  it('draws a Flag the way the Reading drew it before, on the same entry', () => {
    const weather = story(
      { Street: ['A door opens.', 'She steps out.'], Bar: ['Smoke.'] },
      [['Street', 'Follow her', 'Bar']],
      'Street',
      { Bar: { weather: ['rain', 'sun'] } },
    )

    const inTheBar = on(weather, OPENING)
    const drawn = reading(weather, inTheBar).state.flags.weather

    const steppedBack = back(weather, inTheBar)!
    expect(reading(weather, steppedBack).state.flags.weather).toBeUndefined()
    expect(reading(weather, on(weather, steppedBack)).state.flags.weather).toBe(drawn)
  })

  it('carries the seed the Reading was drawn under', () => {
    expect(back(night, advance(OPENING))!.seed).toBe(OPENING.seed)
    expect(back(night, on(night, OPENING))!.seed).toBe(OPENING.seed)
  })

  it('is offered wherever a Story that crosses every Exit back has moved at all', () => {
    let at: Path = OPENING
    for (const _ of Array.from({ length: 6 })) {
      expect(back(night, at) !== undefined).toBe(moved(at))
      at = reading(night, at).shot ? advance(at) : on(night, at)
    }
  })
})

describe('an Exit an Author closed behind the Reader', () => {
  /**
   * The same two Scenes under four Stories: the way on is crossed backwards or
   * not, either because the Exit says so or because its Story does. What is read
   * off each is the one question — is there a beat behind the first Shot of the
   * Bar? — so the four answers are the whole of the rule.
   */
  function night(storyCrosses: boolean, exitCrosses: boolean | null) {
    return story(
      { Street: ['A door opens.', 'She steps out.'], Bar: ['Smoke.', 'No one she knows.'] },
      [['Street', 'Follow her', 'Bar', [], exitCrosses]],
      'Street',
      {},
      storyCrosses,
    )
  }

  /** The Path standing on the first Shot of the Bar, one Exit in. */
  function inTheBar(read: StoryToRead) {
    let at: Path = OPENING
    while (reading(read, at).shot) at = advance(at)
    return take(at, reading(read, at).exits[0]!)
  }

  it('is crossed as its Story says where the Exit has not said', () => {
    expect(back(night(true, null), inTheBar(night(true, null)))).toBeDefined()
    expect(back(night(false, null), inTheBar(night(false, null)))).toBeUndefined()
  })

  it('says it over its Story, in both directions', () => {
    expect(back(night(true, false), inTheBar(night(true, false)))).toBeUndefined()
    expect(back(night(false, true), inTheBar(night(false, true)))).toBeDefined()
  })

  it('leaves the step back inside a Scene offered whatever either says', () => {
    const shut = night(false, false)
    const secondShot = advance(OPENING)
    expect(shown(shut, back(shut, secondShot)!).text).toBe('A door opens.')

    // And inside the Scene the closed Exit arrives at, where the beat behind is
    // a beat of the same Scene and no door is crossed to reach it.
    const played = advance(inTheBar(shut))
    expect(shown(shut, played).text).toBe('No one she knows.')
    expect(shown(shut, back(shut, played)!).text).toBe('Smoke.')
  })

  it('stops the Reading at the first Shot of the Scene it arrives in', () => {
    const shut = night(false, false)
    const arrived = inTheBar(shut)
    expect(back(shut, arrived)).toBeUndefined()
    // The Reading is otherwise the Reading it was: the Scene plays out as it did.
    expect(shown(shut, arrived).text).toBe('Smoke.')
    expect(shown(shut, advance(advance(arrived))).ended).toBe(true)
  })

  it('crosses the Exit it was taken by, and not whichever Exit is standing', () => {
    // Two ways into the Bar: one closed, one open. Which one the Reading took is
    // what settles the step back, and the Exits leaving the Bar say nothing.
    const two = story(
      { Street: ['A door opens.'], Side: ['A side door.'], Bar: ['Smoke.'] },
      [
        ['Street', 'Follow her', 'Bar', [], false],
        ['Street', 'Round the side', 'Side'],
        ['Side', 'In by the side', 'Bar', [], true],
      ],
      'Street',
      {},
      false,
    )

    const endOfStreet = advance(OPENING)
    const byTheFront = take(endOfStreet, reading(two, endOfStreet).exits[0]!)
    expect(back(two, byTheFront)).toBeUndefined()

    const roundTheSide = take(endOfStreet, reading(two, endOfStreet).exits[1]!)
    const bySide = take(advance(roundTheSide), reading(two, advance(roundTheSide)).exits[0]!)
    expect(back(two, bySide)).toBeDefined()
  })
})

describe('a Reading stopped at one Scene', () => {
  /**
   * Three Scenes in a line, so a Path to the last one is a Path that took both
   * Exits: what `pathTo` comes back with is held against what the engine says the
   * Reading is standing in, never against the Exits it happens to have chosen.
   */
  const line = story(
    { Street: ['A door opens.'], Bar: ['Smoke.'], Back: ['A door onto the alley.'] },
    [['Street', 'Go in', 'Bar'], ['Bar', 'Slip out', 'Back']],
  )

  /** The Scene a Path is standing in, which is the whole of what a stop is judged by. */
  function stopsIn(read: StoryToRead, at: Path | undefined) {
    return at && reading(read, at).sceneId
  }

  it('comes back with the Path already taken where it stands there', () => {
    expect(pathTo(line, OPENING, 'Street')).toEqual(OPENING)
  })

  it('takes the ways on that reach the Scene', () => {
    const there = pathTo(line, OPENING, 'Back')

    expect(stopsIn(line, there)).toBe('Back')
    expect(there?.taken).toEqual(['exit-0', 'exit-1'])
  })

  it('stops on the first Shot of the Scene it arrives at', () => {
    expect(reading(line, pathTo(line, OPENING, 'Bar')!).shot?.text).toBe('Smoke.')
  })

  it('goes on from where the Reading already stands', () => {
    const inTheBar = pathTo(line, OPENING, 'Bar')!

    expect(pathTo(line, inTheBar, 'Back')?.taken).toEqual(['exit-0', 'exit-1'])
  })

  it('reaches nothing where no way on leads to the Scene', () => {
    const orphan = story({ Street: ['A door opens.'], Attic: ['Dust.'] })

    expect(pathTo(orphan, OPENING, 'Attic')).toBeUndefined()
  })

  it('reaches nothing where the Story has no opening Scene', () => {
    expect(pathTo(story({ Street: ['A door opens.'] }, [], null), OPENING, 'Street'))
      .toBeUndefined()
  })

  it('does not go round a Story that comes back on itself for ever', () => {
    const loop = story(
      { Booth: ['The projector ticks over.'], House: ['Rows of empty seats.'] },
      [['Booth', 'Walk the house', 'House'], ['House', 'Back up', 'Booth']],
    )

    expect(pathTo(loop, OPENING, 'Nowhere')).toBeUndefined()
  })

  /**
   * The whole of why the pane replays a Path rather than playing the Scene alone:
   * a Shot carrying a Condition is in the run exactly when a Reader who came the
   * same way would be played it, and not otherwise.
   */
  it('plays a conditioned Shot only where the Path arrived holding the Flag', () => {
    const coats = story(
      {
        Street: ['A door opens.'],
        Cloakroom: ['A rail of coats.'],
        Bar: ['Smoke.', ['You keep your coat on.', [{ flag: 'coat', is: 'on' }]]],
      },
      [
        ['Street', 'Straight in', 'Bar'],
        ['Street', 'Take a coat', 'Cloakroom'],
        ['Cloakroom', 'Go through', 'Bar'],
      ],
      'Street',
      { Cloakroom: { coat: 'on' } },
    )

    // The way in that is one Exit shorter arrives with nothing set, so the Shot
    // under the Condition is no part of the run.
    expect(run(coats, pathTo(coats, OPENING, 'Bar')!)).toEqual(['Smoke.'])

    // Through the cloakroom, the same Scene plays the Shot: the State the Path
    // accumulated is what the Condition is held against.
    const dressed = pathTo(coats, pathTo(coats, OPENING, 'Cloakroom')!, 'Bar')!
    expect(run(coats, dressed)).toEqual(['Smoke.', 'You keep your coat on.'])
  })

  it('does not take a way on this Reading was never offered', () => {
    const locked = story(
      { Street: ['A door opens.'], Vault: ['Rows of tins.'] },
      [['Street', 'Unlock it', 'Vault', [{ flag: 'key', is: 'found' }]]],
    )

    expect(pathTo(locked, OPENING, 'Vault')).toBeUndefined()
  })

  /**
   * A Scene is passed once for each set of Flags it has been arrived holding,
   * rather than once outright: two ways round to one Scene set different Flags on
   * the way, and the ways on it offers on arrival differ with them. The Landing is
   * reached first with nothing in hand, and the search has to reach it again by
   * the Study rather than counting it visited.
   */
  it('takes the way round that sets the Flag a way on further on wants', () => {
    const key = story(
      {
        Hall: ['A locked door.'],
        Study: ['A key on the desk.'],
        Landing: ['Bare boards.'],
        Vault: ['Rows of tins.'],
      },
      [
        ['Hall', 'Straight on', 'Landing'],
        ['Hall', 'Try the study', 'Study'],
        ['Study', 'On to the landing', 'Landing'],
        ['Landing', 'Unlock it', 'Vault', [{ flag: 'key', is: 'found' }]],
      ],
      'Hall',
      { Study: { key: 'found' } },
    )

    expect(stopsIn(key, pathTo(key, OPENING, 'Vault'))).toBe('Vault')
  })
})

describe('a Path kept in the browser and replayed', () => {
  const two = story(
    { Street: ['A door opens.', 'She steps out.'], Bar: ['Smoke.'] },
    [['Street', 'Follow her out', 'Bar']],
  )
  const [out] = two.exits

  it('is not picked up where nothing has been read yet', () => {
    expect(resumes(two, OPENING)).toBe(false)
  })

  it('is picked up at the Shot it left on', () => {
    expect(resumes(two, advance(OPENING))).toBe(true)
  })

  it('is picked up at the Exits on offer, with the run behind it', () => {
    expect(resumes(two, advance(advance(OPENING)))).toBe(true)
  })

  it('is picked up in the Scene an Exit led to', () => {
    expect(resumes(two, take(OPENING, out!))).toBe(true)
  })

  it('is not picked up at an ending, which is nowhere to be put back', () => {
    expect(resumes(two, advance(take(OPENING, out!)))).toBe(false)
  })

  it('is not picked up where an Exit it took has since been taken away', () => {
    const cut = story({ Street: ['A door opens.', 'She steps out.'], Bar: ['Smoke.'] })
    expect(resumes(cut, take(OPENING, out!))).toBe(false)
  })

  it('is not picked up where an Exit it took is now hidden from it', () => {
    const gated = story(
      { Street: ['A door opens.'], Bar: ['Smoke.'] },
      [['Street', 'Follow her out', 'Bar', [{ flag: 'key', is: 'held' }]]],
    )
    expect(resumes(gated, take(OPENING, out!))).toBe(false)
  })

  it('is not picked up past the run, where Shots have since been taken away', () => {
    expect(resumes(two, { ...OPENING, shot: 5 })).toBe(false)
  })
})
