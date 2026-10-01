import { describe, expect, it } from 'vitest'
import { sceneToMoveTo } from '../../shared/utils/scenes'

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
