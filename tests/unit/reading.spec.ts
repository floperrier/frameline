import { describe, expect, it } from 'vitest'
import type { Position, StoryToRead } from '../../shared/utils/reading'
import { OPENING, advance, reading, take } from '../../shared/utils/reading'

/**
 * A Story built from the shots of each Scene and the Cuts between them, in the
 * shape the engine reads. Ids are the names, so a failing assertion says which
 * Scene it was standing in rather than which uuid.
 */
function story(
  scenes: Record<string, string[]>,
  cuts: [from: string, text: string, to: string][] = [],
  openingSceneId: string | null = Object.keys(scenes)[0] ?? null,
): StoryToRead {
  return {
    openingSceneId,
    scenes: Object.entries(scenes).map(([id, texts]) => ({
      id,
      shots: texts.map((text, position) => ({ id: `${id}-${position}`, text, position })),
    })),
    cuts: cuts.map(([fromSceneId, text, toSceneId], index) => ({
      id: `cut-${index}`,
      fromSceneId,
      toSceneId,
      text,
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
    expect(reading(loop, OPENING).visits).toEqual({ Street: 1 })
    expect(reading(loop, around(3)).visits).toEqual({ Street: 4, Bar: 3 })
  })

  it('carries no State from one Reading to another', () => {
    reading(loop, around(2)).visits.Street = 99
    expect(reading(loop, OPENING).visits).toEqual({ Street: 1 })
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
