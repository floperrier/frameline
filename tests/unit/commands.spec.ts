import { describe, expect, it } from 'vitest'
import { commandsReached, plainly, type Command } from '../../app/utils/commands'

/**
 * Which Commands a typed name reaches. The bar around this is a `<dialog>` and
 * a list of buttons that the end-to-end suite drives; what is here is the one
 * decision in it that a person can get wrong without a browser — whether a Scene
 * named in French answers to a name typed without its accents.
 */
const named = (...names: string[]): Command[] =>
  names.map(name => ({ name, press: () => {} }))

const reached = (offered: Command[], typed: string) =>
  commandsReached(offered, typed).map(command => command.name)

describe('the Commands a typed name reaches', () => {
  it('offers every one of them until something is typed', () => {
    const offered = named('Publish', 'Go to Le café')

    expect(reached(offered, '')).toEqual(['Publish', 'Go to Le café'])
    expect(reached(offered, '   ')).toEqual(['Publish', 'Go to Le café'])
  })

  it('reaches a name typed in any case', () => {
    expect(reached(named('Publish', 'Fit the graph'), 'PUB')).toEqual(['Publish'])
  })

  it('reaches an accented name typed without its accents, and the other way about', () => {
    const offered = named('Go to Le café', 'Go to Ecole')

    expect(reached(offered, 'cafe')).toEqual(['Go to Le café'])
    expect(reached(offered, 'café')).toEqual(['Go to Le café'])
    expect(reached(offered, 'école')).toEqual(['Go to Ecole'])
  })

  it('matches anywhere in the name, not only at its head', () => {
    expect(reached(named('Go to Le café'), 'café')).toEqual(['Go to Le café'])
  })

  it('keeps the order the bench draws them in', () => {
    const offered = named('Publish', 'Go to A', 'Go to B', 'Go to C')

    expect(reached(offered, 'go to')).toEqual(['Go to A', 'Go to B', 'Go to C'])
  })

  it('reaches nothing rather than everything when nothing answers', () => {
    expect(reached(named('Publish', 'Go to A'), 'zzz')).toEqual([])
  })

  it('keeps two Scenes that share a name, because it cannot tell them apart', () => {
    expect(reached(named('Go to A', 'Go to A'), 'A')).toEqual(['Go to A', 'Go to A'])
  })
})

describe('a name read plainly', () => {
  it('leaves a name with neither accent nor capital alone', () => {
    expect(plainly('publish')).toBe('publish')
  })

  it('takes the mark off the letter it sits on and leaves the letter', () => {
    expect(plainly('Élan à côté')).toBe('elan a cote')
  })
})
