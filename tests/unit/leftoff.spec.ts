import { describe, expect, it } from 'vitest'
import { readingsLeftOff } from '../../shared/utils/leftoff'

/**
 * How many Readings left off in each Scene of a published Story, worked out on
 * its Edition from the counts already kept — issue #497. What is asserted is
 * what the Author is told, Scene by Scene, never the sums it is worked out from.
 * See *Where Readings leave off* in
 * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 */

/** An Exit of the Edition, named for the two Scenes it joins. */
const exit = (fromSceneId: string, toSceneId: string) =>
  ({ id: `${fromSceneId}-${toSceneId}`, fromSceneId, toSceneId })

describe('readingsLeftOff', () => {
  it('counts down a straight line of Scenes', () => {
    expect(readingsLeftOff({
      exits: [exit('a', 'b'), exit('b', 'c')],
      openingSceneId: 'a',
      begun: 10,
      taken: { 'a-b': 7, 'b-c': 4 },
      endedIn: { c: 4 },
    })).toEqual({ a: 3, b: 3 })
  })

  it('feeds the Opening Scene with the Readings begun', () => {
    expect(readingsLeftOff({
      exits: [exit('a', 'b')],
      openingSceneId: 'a',
      begun: 5,
      taken: {},
      endedIn: {},
    })).toEqual({ a: 5 })
  })

  it('says how many arrived in an ending and left off before its last Shot', () => {
    expect(readingsLeftOff({
      exits: [exit('a', 'b')],
      openingSceneId: 'a',
      begun: 6,
      taken: { 'a-b': 6 },
      endedIn: { b: 4 },
    })).toEqual({ b: 2 })
  })

  it('counts apart the Readings that ended in a Scene and the ones that left it', () => {
    expect(readingsLeftOff({
      exits: [exit('a', 'b'), exit('b', 'c')],
      openingSceneId: 'a',
      begun: 9,
      taken: { 'a-b': 9, 'b-c': 3 },
      endedIn: { b: 5, c: 3 },
    })).toEqual({ b: 1 })
  })

  it('says nothing of a Scene a step back leaves negative', () => {
    // One Reading goes from a to b, steps back, and goes from a to c instead:
    // b is credited with an interruption, and a comes out one below nothing.
    expect(readingsLeftOff({
      exits: [exit('a', 'b'), exit('a', 'c')],
      openingSceneId: 'a',
      begun: 1,
      taken: { 'a-b': 1, 'a-c': 1 },
      endedIn: { c: 1 },
    })).toEqual({ b: 1 })
  })

  it('counts the takes of an Exit the Edition holds though the Story as written has lost it', () => {
    // The Exit from b to c is still in the Edition: Readers are still taking it.
    expect(readingsLeftOff({
      exits: [exit('a', 'b'), exit('b', 'c')],
      openingSceneId: 'a',
      begun: 4,
      taken: { 'a-b': 4, 'b-c': 4 },
      endedIn: { c: 4 },
    })).toEqual({})
  })

  it('says nothing of a Scene the Edition does not hold, nor of takes under an Exit it does not hold', () => {
    expect(readingsLeftOff({
      exits: [exit('a', 'b')],
      openingSceneId: 'a',
      begun: 3,
      taken: { 'a-b': 2, 'b-gone': 2, 'gone-b': 5 },
      endedIn: { gone: 2, b: 1 },
    })).toEqual({ a: 1, b: 1 })
  })

  it('says nothing of a Scene where exactly as many left as arrived', () => {
    expect(readingsLeftOff({
      exits: [exit('a', 'b'), exit('b', 'c')],
      openingSceneId: 'a',
      begun: 2,
      taken: { 'a-b': 2, 'b-c': 1 },
      endedIn: { b: 1, c: 1 },
    })).toEqual({})
  })

  it('says nothing where the Edition opens on no Scene and nothing was counted', () => {
    expect(readingsLeftOff({ exits: [], openingSceneId: null, begun: 0, taken: {}, endedIn: {} }))
      .toEqual({})
  })
})
