import { describe, expect, it } from 'vitest'
import type { Condition, Sets } from '../../shared/utils/scenes'
import { formattedOf, formatted, line, run as styled } from '../../shared/utils/formatted'
import {
  CUT_AFTER_MAX,
  CUT_AFTER_MIN,
  CUT_OVER_MAX,
  EXITS_AFTER_MAX,
  EXITS_AFTER_MIN,
  isTime,
  LAYOUTS,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_OVER_UNTIMED,
  cropPosition,
} from '../../shared/utils/scenes'
import type { Path, State, StoryToRead } from '../../shared/utils/reading'
import {
  advance, back, cut, lastUnitAt, layout, lasting, moved, movement, movementEnds, movesItself, opening, pathTo,
  pieces, reading, resumes, take, textArrival, textArrives, textMoves, timed, unmet,
} from '../../shared/utils/reading'
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
      sound: null,
      soundOfSceneId: null,
      transcript: '',
      soundLoops: true,
      // The Cut plays no part in a Reading these tests state: every Scene waits
      // for the press and cuts hard, and every Exit passes through the outgoing
      // Shot, which is the one Story every row this Story has always written
      // amounts to.
      cutAfter: null,
      cutOver: 0,
      cutThrough: 'image',
      exitsAfter: null,
      layout: 'inset',
      movementBy: 0,
      movementDirection: 'closer',
      movementOver: 0,
      textAfter: 0,
      textBy: 'whole',
      textPace: 15,
      textOver: 0,
      textStays: null,
      shots: texts.map((written, position) => {
        const [text, conditions] = typeof written === 'string' ? [written, []] : written
        return {
          id: `${id}-${position}`,
          text,
          formatted: formattedOf(text),
          position,
          image: null,
          description: '',
          conditions,
          sound: null,
          transcript: '',
          cutAfter: null,
          cutOver: null,
          cutThrough: null,
          layout: null,
          cropX: 50,
          cropY: 50,
          imageArrives: null,
          imageLasts: null,
          textArrives: null,
          textLasts: null,
          textAfter: null,
          textBy: null,
          textPace: null,
          textOver: null,
          textStays: null,
          movementBy: null,
          movementDirection: null,
          movementOver: null,
        }
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
      cutOver: 0,
      cutThrough: 'image',
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

describe('cut', () => {
  const scene = {
    id: 'a', sets: {}, shots: [], sound: null, soundOfSceneId: null,
    transcript: '', soundLoops: true,
    cutAfter: 4000, cutOver: 800, cutThrough: 'image' as const, exitsAfter: null, layout: 'inset' as const,
    movementBy: 0, movementDirection: 'closer' as const, movementOver: 0,
    textAfter: 0, textBy: 'whole' as const, textPace: 15, textOver: 0, textStays: null,
  }
  const shot = {
    id: 's', text: '', formatted: formattedOf(''), position: 0, image: null, description: '',
    conditions: [], sound: null, transcript: '',
    cutAfter: null, cutOver: null, cutThrough: null, layout: null, cropX: 50, cropY: 50,
    imageArrives: null, imageLasts: null, textArrives: null, textLasts: null,
    textAfter: null, textBy: null, textPace: null, textOver: null, textStays: null,
    movementBy: null, movementDirection: null, movementOver: null,
  }

  it('is the Scene\'s where the Shot says nothing', () => {
    expect(cut(scene, shot)).toEqual({ after: 4000, over: 800, through: 'image' })
  })

  it('is the Shot\'s where the Shot answers', () => {
    expect(cut(scene, { ...shot, cutAfter: 1000, cutOver: 0, cutThrough: 'black' }))
      .toEqual({ after: 1000, over: 0, through: 'black' })
  })

  it('answers field by field', () => {
    expect(cut(scene, { ...shot, cutThrough: 'black' }))
      .toEqual({ after: 4000, over: 800, through: 'black' })
  })

  it('reads a Shot\'s nought as waiting for the press', () => {
    expect(cut(scene, { ...shot, cutAfter: 0 }).after).toBeNull()
  })

  it('waits where the Scene waits and the Shot says nothing', () => {
    expect(cut({ ...scene, cutAfter: null }, shot).after).toBeNull()
  })

  it('holds a Shot that answers over a Scene that waits', () => {
    expect(cut({ ...scene, cutAfter: null }, { ...shot, cutAfter: 2500 }).after).toBe(2500)
  })
})

describe('lasting', () => {
  const plain = story({ Street: ['A door opens.'] })

  /** The same Story with its one Shot carrying what is said of it. */
  function carrying(says: Partial<StoryToRead['scenes'][number]['shots'][number]>) {
    return {
      ...plain,
      scenes: plain.scenes.map(scene => ({
        ...scene, shots: scene.shots.map(shot => ({ ...shot, ...says })),
      })),
    }
  }

  it('is nothing where no Effect is written', () => {
    expect(lasting(plain)).toBe(false)
  })

  it('is nothing where the only Effect is an arrival', () => {
    expect(lasting(carrying({ imageArrives: { effect: 'shake', over: 500, strength: 'marked' } })))
      .toBe(false)
  })

  it('reads a lasting Effect on the Image, and one on the text', () => {
    expect(lasting(carrying({ image: '/api/shots/a/image', imageLasts: { effect: 'grain', strength: 'slight' } })))
      .toBe(true)
    expect(lasting(carrying({ textLasts: { effect: 'pulse', every: 800, strength: 'slight' } })))
      .toBe(true)
  })

  it('is nothing where the lasting Effect is on an Image the Shot does not have', () => {
    expect(lasting(carrying({ imageLasts: { effect: 'grain', strength: 'slight' } }))).toBe(false)
  })

  it('reads a lasting Effect on a run of the text', () => {
    const marked = formatted(line('a ', styled('word', { type: 'lasts', attrs: { effect: 'tremor', every: 300, strength: 'slight' } })))
    expect(lasting(carrying({ formatted: marked }))).toBe(true)
    const arriving = formatted(line(styled('word', { type: 'arrives', attrs: { effect: 'scramble', over: 1200, strength: 'slight' } })))
    expect(lasting(carrying({ formatted: arriving }))).toBe(false)
  })
})

describe('movement', () => {
  const plain = story({ Street: ['A door opens.'] })
  const image = '/api/shots/a/image'

  /** The one Scene of `plain`, saying what it says, and its one Shot carrying an Image and saying what it says. */
  function standing(
    sceneSays: Partial<StoryToRead['scenes'][number]> = {},
    shotSays: Partial<StoryToRead['scenes'][number]['shots'][number]> = {},
  ) {
    const scene = { ...plain.scenes[0]!, ...sceneSays }
    return { scene, shot: { ...scene.shots[0]!, image, ...shotSays } }
  }

  const moving = { movementBy: 20, movementDirection: 'left' as const, movementOver: 3000 }

  it('moves a Shot that says nothing as its Scene says', () => {
    const { scene, shot } = standing(moving)
    expect(movement(scene, shot)).toEqual({ direction: 'left', by: 20, over: 3000, held: false })
  })

  it('lets a Shot answer each field for itself', () => {
    const { scene, shot } = standing(moving, { movementDirection: 'up' })
    expect(movement(scene, shot)).toEqual({ direction: 'up', by: 20, over: 3000, held: false })
    const further = standing(moving, { movementBy: 35 })
    expect(movement(further.scene, further.shot))
      .toEqual({ direction: 'left', by: 35, over: 3000, held: false })
    const timedOwn = standing(moving, { movementOver: 500 })
    expect(movement(timedOwn.scene, timedOwn.shot))
      .toEqual({ direction: 'left', by: 20, over: 500, held: false })
  })

  it('holds still a Scene that moves by nought, a Shot that answers nought, and a Shot with no Image', () => {
    const still = standing()
    expect(movement(still.scene, still.shot)).toBeNull()
    const held = standing(moving, { movementBy: 0 })
    expect(movement(held.scene, held.shot)).toBeNull()
    const bare = standing(moving, { image: null })
    expect(movement(bare.scene, bare.shot)).toBeNull()
  })

  it('reads an over of nought as the hold where the clock cuts, and as the stand-in where the Reader does', () => {
    const clocked = standing({ ...moving, movementOver: 0, cutAfter: 4000 })
    expect(movement(clocked.scene, clocked.shot)!.over).toBe(4000)
    const pressed = standing({ ...moving, movementOver: 0, cutAfter: null })
    expect(movement(pressed.scene, pressed.shot)!.over).toBe(MOVEMENT_OVER_UNTIMED)
    const waits = standing({ ...moving, movementOver: 0, cutAfter: 4000 }, { cutAfter: 0 })
    expect(movement(waits.scene, waits.shot)!.over).toBe(MOVEMENT_OVER_UNTIMED)
  })

  it('says the time is the hold only where it is the hold the clock cuts at', () => {
    const clocked = standing({ ...moving, movementOver: 0, cutAfter: 4000 })
    expect(movement(clocked.scene, clocked.shot)!.held).toBe(true)
    // The stand-in, and a time the Scene or the Shot wrote under a clock, are not.
    const pressed = standing({ ...moving, movementOver: 0, cutAfter: null })
    expect(movement(pressed.scene, pressed.shot)!.held).toBe(false)
    const written = standing({ ...moving, cutAfter: 4000 })
    expect(movement(written.scene, written.shot)!.held).toBe(false)
    const own = standing({ ...moving, movementOver: 0, cutAfter: 4000 }, { movementOver: 2000 })
    expect(movement(own.scene, own.shot)!.held).toBe(false)
  })
})

describe('movementEnds', () => {
  const centre = { cropX: 50, cropY: 50 }

  /** A transform this writes, read back as the fraction it shifts by and the scale. */
  function read(transform: string) {
    const scale = Number(/scale\(([\d.]+)\)/.exec(transform)![1])
    const shifted = /translate\((-?[\d.e-]+)%?, (-?[\d.e-]+)%?\)/.exec(transform)
    return { scale, x: shifted ? Number(shifted[1]) / 100 : 0, y: shifted ? Number(shifted[2]) / 100 : 0 }
  }

  it('grows about the point to come closer, and shrinks back to draw away', () => {
    expect(movementEnds({ direction: 'closer', by: 15 }, centre))
      .toEqual({ from: 'scale(1)', to: 'scale(1.15)' })
    expect(movementEnds({ direction: 'away', by: 15 }, centre))
      .toEqual({ from: 'scale(1.15)', to: 'scale(1)' })
  })

  it('ends a crossing to the left where one to the right starts', () => {
    const left = movementEnds({ direction: 'left', by: 20 }, centre)
    const right = movementEnds({ direction: 'right', by: 20 }, centre)
    expect(left.to).toBe(right.from)
    expect(left.from).toBe(right.to)
  })

  it('keeps the point inside the frame and the Image covering it, at both ends, everywhere', () => {
    const near = 1e-9
    for (const direction of MOVEMENT_DIRECTIONS) {
      for (const by of [1, 15, 50]) {
        for (let at = 0; at <= 100; at += 10) {
          const point = { cropX: at, cropY: 100 - at }
          for (const end of Object.values(movementEnds({ direction, by }, point))) {
            expect(end).not.toContain('NaN')
            const { scale, x, y } = read(end)
            expect(scale).toBeGreaterThanOrEqual(1)
            for (const [shift, along] of [[x, point.cropX / 100], [y, point.cropY / 100]] as const) {
              // Covering: the grown Image's two edges stay outside the frame's.
              expect(shift).toBeLessThanOrEqual(along * (scale - 1) + near)
              expect(shift).toBeGreaterThanOrEqual(-(1 - along) * (scale - 1) - near)
              // The point stays inside the frame.
              expect(along + shift).toBeGreaterThanOrEqual(-near)
              expect(along + shift).toBeLessThanOrEqual(1 + near)
            }
          }
        }
      }
    }
  })
})

describe('movesItself', () => {
  /**
   * What every case here is written over: two Scenes and one way on between
   * them, with nothing about the Cut said anywhere — which is every Story
   * written before there was a Cut to write.
   */
  const byHand = story(
    { Street: ['A door opens.', 'She steps out.'], Alley: ['Nobody comes.'] },
    [['Street', 'Follow her out', 'Alley']])

  /** The same Story with one Scene saying something about its Cut. */
  function written(
    named: string,
    says: Partial<StoryToRead['scenes'][number]>,
    told: StoryToRead = byHand,
  ) {
    return {
      ...told,
      scenes: told.scenes.map(scene => (scene.id === named ? { ...scene, ...says } : scene)),
    }
  }

  /** The same Story with every Shot of one Scene answering for itself. */
  function answering(named: string, cutAfter: number, told: StoryToRead = byHand) {
    const shots = told.scenes.find(scene => scene.id === named)!.shots
    return written(named, { shots: shots.map(shot => ({ ...shot, cutAfter })) }, told)
  }

  it('is nothing where nothing is written', () => {
    expect(movesItself(byHand)).toBe(false)
  })

  it('reads a Scene that cuts its run after a time', () => {
    expect(movesItself(written('Street', { cutAfter: 4000 }))).toBe(true)
  })

  it('reads a Shot that answers with a time under a Scene that waits', () => {
    expect(movesItself(answering('Street', 2000))).toBe(true)
  })

  it('withholds it where the Scene names a time and every Shot waits', () => {
    expect(movesItself(answering('Street', 0, written('Street', { cutAfter: 4000 }))))
      .toBe(false)
  })

  it('withholds it where a Scene with no run at all names a time', () => {
    expect(movesItself(written('Street', { cutAfter: 4000 }, story({ Street: [] })))).toBe(false)
  })

  it('reads ways on that stand for a time', () => {
    expect(movesItself(written('Street', { exitsAfter: 10_000 }))).toBe(true)
  })

  it('reads a Scene that flows into the next without asking', () => {
    expect(movesItself(written('Street', { exitsAfter: 0 }))).toBe(true)
  })

  it('withholds it where a Scene names a time for ways on it has none of', () => {
    expect(movesItself(written('Alley', { exitsAfter: 10_000 }))).toBe(false)
  })

  it('reads a text that arrives by the word, even where the Scene holds until the press', () => {
    expect(movesItself(written('Street', { cutAfter: null, textBy: 'word' }))).toBe(true)
  })

  it('withholds it where every column of the text is at its default', () => {
    expect(movesItself(byHand)).toBe(false)
  })
  /** `byHand` with the first Shot of the street carrying an Image that comes closer. */
  function closing(image: string | null = '/api/shots/a/image') {
    return written('Street', {
      shots: byHand.scenes[0]!.shots.map((shot, at) => (at === 0
        ? { ...shot, image, movementBy: 20, movementDirection: 'closer' as const }
        : shot)),
    })
  }

  it('reads a hand-read Story with one Image that moves, which no clock does', () => {
    expect(movesItself(closing())).toBe(true)
    expect(timed(closing())).toBe(false)
  })

  it('withholds it where the Shot that moves has no Image to move', () => {
    expect(movesItself(closing(null))).toBe(false)
  })
})

describe('isTime', () => {
  it('takes a whole number within the cap', () => {
    expect(isTime(0, CUT_OVER_MAX)).toBe(true)
    expect(isTime(CUT_OVER_MAX, CUT_OVER_MAX)).toBe(true)
  })

  it('refuses what is not one', () => {
    for (const held of [-1, CUT_OVER_MAX + 1, 1.5, '800', null, undefined, NaN]) {
      expect(isTime(held, CUT_OVER_MAX)).toBe(false)
    }
  })

  // A clock cutting sooner than half a second changes the screen more than twice
  // in one, which over a white Image and a black one is past the three flashes
  // WCAG 2.3.1 allows: issue #356.
  it('holds a time to its floor, and nought with it', () => {
    expect(isTime(CUT_AFTER_MIN, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(true)
    expect(isTime(CUT_AFTER_MAX, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(true)

    for (const held of [0, 100, CUT_AFTER_MIN - 1]) {
      expect(isTime(held, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(false)
    }
    expect(isTime(EXITS_AFTER_MIN - 1, EXITS_AFTER_MAX, EXITS_AFTER_MIN)).toBe(false)
  })
})

describe('layout', () => {
  const scene = {
    id: 'a', sets: {}, shots: [], sound: null, soundOfSceneId: null,
    transcript: '', soundLoops: true,
    cutAfter: null, cutOver: 0, cutThrough: 'image' as const, exitsAfter: null, layout: 'inset' as const,
    movementBy: 0, movementDirection: 'closer' as const, movementOver: 0,
    textAfter: 0, textBy: 'whole' as const, textPace: 15, textOver: 0, textStays: null,
  }
  const shot = {
    id: 's', text: '', formatted: formattedOf(''), position: 0, image: null, description: '',
    conditions: [], sound: null, transcript: '',
    cutAfter: null, cutOver: null, cutThrough: null, layout: null, cropX: 50, cropY: 50,
    imageArrives: null, imageLasts: null, textArrives: null, textLasts: null,
    textAfter: null, textBy: null, textPace: null, textOver: null, textStays: null,
    movementBy: null, movementDirection: null, movementOver: null,
  }

  it('lays a Shot that says nothing out as its Scene says', () => {
    for (const value of LAYOUTS) {
      expect(layout({ ...scene, layout: value }, { ...shot, layout: null })).toBe(value)
    }
  })

  it('lets a Shot answer for itself against a Scene saying the other', () => {
    expect(layout({ ...scene, layout: 'inset' }, { ...shot, layout: 'full' })).toBe('full')
    expect(layout({ ...scene, layout: 'full' }, { ...shot, layout: 'inset' })).toBe('inset')
  })
})

describe('cropPosition', () => {
  // The smallest case that fails if the two numbers are written the other way round.
  it('writes across before down, in percent', () => {
    expect(cropPosition({ cropX: 84, cropY: 49 })).toBe('84% 49%')
  })
})

describe('textArrival', () => {
  const scene = {
    id: 'a', sets: {}, shots: [], sound: null, soundOfSceneId: null,
    transcript: '', soundLoops: true,
    cutAfter: null, cutOver: 0, cutThrough: 'image' as const, exitsAfter: null, layout: 'inset' as const,
    movementBy: 0, movementDirection: 'closer' as const, movementOver: 0,
    textAfter: 1000, textBy: 'word' as const, textPace: 10, textOver: 200, textStays: 3000,
  }
  const shot = {
    id: 's', text: 'A door opens.', formatted: formattedOf('A door opens.'), position: 0, image: null, description: '',
    conditions: [], sound: null, transcript: '',
    cutAfter: null, cutOver: null, cutThrough: null, layout: null, cropX: 50, cropY: 50,
    textAfter: null, textBy: null, textPace: null, textOver: null, textStays: null,
    movementBy: null, movementDirection: null, movementOver: null,
  }

  it('is the Scene\'s where the Shot says nothing', () => {
    expect(textArrival(scene, shot))
      .toEqual({ after: 1000, by: 'word', pace: 10, over: 200, stays: 3000 })
  })

  it('is the Shot\'s, field by field, where it answers', () => {
    expect(textArrival(scene, { ...shot, textBy: 'letter', textOver: 0 }))
      .toEqual({ after: 1000, by: 'letter', pace: 10, over: 0, stays: 3000 })
  })

  it('reads a Shot\'s nought stay as staying until the Cut', () => {
    expect(textArrival(scene, { ...shot, textStays: 0 }).stays).toBeNull()
  })

  it('reads a Scene that keeps its texts as staying, unless its Shot says otherwise', () => {
    expect(textArrival({ ...scene, textStays: null }, shot).stays).toBeNull()
    expect(textArrival({ ...scene, textStays: null }, { ...shot, textStays: 2500 }).stays)
      .toBe(2500)
  })

  it('moves by itself for a wait, a unit, a fade and a stay, and not otherwise', () => {
    const still = {
      ...scene, textAfter: 0, textBy: 'whole' as const, textOver: 0, textStays: null,
    }

    expect(textMoves(still, shot)).toBe(false)
    expect(textArrives(still, shot)).toBe(false)
    expect(textMoves({ ...still, textAfter: 1000 }, shot)).toBe(true)
    expect(textMoves({ ...still, textBy: 'word' }, shot)).toBe(true)
    expect(textMoves({ ...still, textOver: 200 }, shot)).toBe(true)
    expect(textMoves({ ...still, textStays: 3000 }, shot)).toBe(true)
    expect(textArrives({ ...still, textStays: 3000 }, shot)).toBe(false)
    // Nothing to arrive: no text, or white space alone.
    expect(textMoves(scene, { ...shot, text: '' })).toBe(false)
    expect(textMoves(scene, { ...shot, text: '  \n ' })).toBe(false)
  })
})

describe('pieces', () => {
  it('arrives whole as one piece', () => {
    expect(pieces(['A door opens.'], 'whole')).toEqual([[{ text: 'A door opens.', from: 0 }]])
  })

  it('cuts a text by the word, white space counted but in no unit', () => {
    expect(pieces(['Two  words'], 'word')).toEqual([[
      { text: 'Two', from: 0 },
      { text: '  ', from: null },
      { text: 'words', from: 5 },
    ]])
  })

  it('holds a combining accent and an emoji flag as one letter each', () => {
    expect(pieces(['é🇫🇷'], 'letter'))
      .toEqual([[{ text: 'é', from: 0 }, { text: '🇫🇷', from: 2 }]])
  })

  it('gives a word crossing two leaves one from', () => {
    expect(pieces(['A wo', 'rd'], 'word')).toEqual([
      [{ text: 'A', from: 0 }, { text: ' ', from: null }, { text: 'wo', from: 2 }],
      [{ text: 'rd', from: 2 }],
    ])
  })

  it('breaks a line at a line-break leaf', () => {
    expect(pieces(['One line', '\n', 'Another'], 'line')).toEqual([
      [{ text: 'One line', from: 0 }],
      [{ text: '\n', from: null }],
      [{ text: 'Another', from: 9 }],
    ])
  })

  it('finds no unit in white space alone', () => {
    expect(pieces(['  \n '], 'word')).toEqual([[{ text: '  \n ', from: null }]])
    expect(lastUnitAt('  \n ', 'word')).toBe(0)
  })
})

describe('lastUnitAt', () => {
  it('counts the characters before a text\'s last unit', () => {
    expect(lastUnitAt('One two three', 'word')).toBe(8)
    expect(lastUnitAt('a\nbc', 'line')).toBe(2)
    expect(lastUnitAt('One two three', 'whole')).toBe(0)
  })
})
