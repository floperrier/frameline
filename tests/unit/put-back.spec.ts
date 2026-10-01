import { describe, expect, it } from 'vitest'
import { placeBack } from '../../shared/utils/scenes'

/**
 * Where a deleted Shot is put back, which the bench reads to draw the row it left
 * and the server reads to insert it: after the Shot that stood before it, at the
 * head of the run where nothing did, and at its own old Place, capped at the run,
 * where the Shot before it has gone too. See
 * `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`.
 */
describe('where a deleted Shot is put back', () => {
  const run = ['first', 'second', 'third']

  it('stands right after the Shot that stood before it', () => {
    expect(placeBack(run, 'first', 1)).toBe(1)
    expect(placeBack(run, 'third', 3)).toBe(3)
  })

  it('follows that Shot wherever it has moved since', () => {
    expect(placeBack(['second', 'third', 'first'], 'first', 1)).toBe(3)
  })

  it('stands at the head of the run where nothing stood before it', () => {
    expect(placeBack(run, null, 0)).toBe(0)
    expect(placeBack([], null, 0)).toBe(0)
  })

  it('stands at its own old Place where the Shot before it has gone too', () => {
    expect(placeBack(run, 'gone', 2)).toBe(2)
  })

  it('never stands past the end of a run that has grown shorter', () => {
    expect(placeBack(['first'], 'gone', 4)).toBe(1)
    expect(placeBack([], 'gone', 2)).toBe(0)
  })
})
