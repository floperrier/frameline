import { describe, expect, it } from 'vitest'
import { carriedTo, sceneToMoveTo } from '../../shared/utils/scenes'

/**
 * Which Scene a Shot is moved to, read off the name the Author typed in the field
 * under its marks: the bench's own names for the Scenes, compared the way the
 * field at the foot of the ways on and the bar of Commands compare them, so
 * *cafe* finds *Le café* and two Scenes of one name answer to the numbered names
 * the bench gives them — see
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
 */
describe('the Scene a Shot is moved to', () => {
  const names = new Map([
    ['street', 'The street'],
    ['cafe', 'Le café'],
    ['bar-1', 'The bar (1)'],
    ['bar-2', 'The bar (2)'],
  ])

  it('is the Scene the name is, typed as the bench names it', () => {
    expect(sceneToMoveTo(names, 'street', 'Le café')).toEqual({ sceneId: 'cafe' })
    expect(sceneToMoveTo(names, 'street', '  Le café ')).toEqual({ sceneId: 'cafe' })
  })

  it('answers to the name without its accents and in any case', () => {
    expect(sceneToMoveTo(names, 'street', 'le cafe')).toEqual({ sceneId: 'cafe' })
    expect(sceneToMoveTo(names, 'cafe', 'THE STREET')).toEqual({ sceneId: 'street' })
  })

  it('tells two Scenes of one name apart by the numbers the bench gives them', () => {
    expect(sceneToMoveTo(names, 'street', 'The bar (2)')).toEqual({ sceneId: 'bar-2' })
    expect(sceneToMoveTo(names, 'bar-2', 'the bar (1)')).toEqual({ sceneId: 'bar-1' })
    expect(sceneToMoveTo(names, 'street', 'The bar')).toEqual({ refused: 'editor.noSceneToMoveTo' })
  })

  it('takes the name as typed before the one it only folds to', () => {
    const alike = new Map([['plain', 'Cafe'], ['accented', 'Café']])
    expect(sceneToMoveTo(alike, 'street', 'Café')).toEqual({ sceneId: 'accented' })
    expect(sceneToMoveTo(alike, 'street', 'Cafe')).toEqual({ sceneId: 'plain' })
  })

  it('refuses the Scene the Shot already stands in', () => {
    expect(sceneToMoveTo(names, 'cafe', 'le café')).toEqual({ refused: 'editor.alreadyInScene' })
  })

  it('refuses a name no Scene answers to', () => {
    expect(sceneToMoveTo(names, 'street', 'The station')).toEqual({ refused: 'editor.noSceneToMoveTo' })
  })
})

/**
 * Where a frame let go of on the Contact Sheet lands: the gap it was dropped in is
 * counted over the band as it is drawn, the dragged frame among the rest where it
 * is that band's, so the gap either side of it is its own Place and moves nothing.
 */
describe('the Place a frame dropped on the sheet lands at', () => {
  const run = ['a', 'b', 'c', 'd']

  it('is the gap it is dropped in, counted over its own band as drawn', () => {
    expect(carriedTo(run, 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(carriedTo(run, 'a', 2)).toEqual(['b', 'a', 'c', 'd'])
    expect(carriedTo(run, 'b', 4)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('moves nothing where it is dropped either side of itself', () => {
    expect(carriedTo(run, 'b', 1)).toEqual(run)
    expect(carriedTo(run, 'b', 2)).toEqual(run)
  })

  it('is the gap itself in another band, and the first in a band with none', () => {
    expect(carriedTo(['x', 'y'], 'b', 1)).toEqual(['x', 'b', 'y'])
    expect(carriedTo(['x', 'y'], 'b', 2)).toEqual(['x', 'y', 'b'])
    expect(carriedTo([], 'b', 0)).toEqual(['b'])
  })
})
