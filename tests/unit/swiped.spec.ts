import { describe, expect, it } from 'vitest'
import { swiped } from '../../app/utils/swiped'

/**
 * Whether a finger lifted off the frame crossed it, and which way: towards the
 * leading edge goes on, the other way steps back, and anything short, steep or
 * slow is a tap or a scroll — see
 * `docs/adr/0065-a-swipe-across-the-frame-is-a-press.md`.
 */
describe('a finger lifted off the frame', () => {
  const at = { x: 200, y: 400, t: 1000 }

  it('goes on when it crosses towards the leading edge, and steps back the other way', () => {
    expect(swiped(at, { x: 100, y: 400, t: 1200 })).toBe('on')
    expect(swiped(at, { x: 300, y: 400, t: 1200 })).toBe('back')
  })

  it('crosses only once it has travelled 48 pixels across', () => {
    expect(swiped(at, { x: 152, y: 400, t: 1200 })).toBe('on')
    expect(swiped(at, { x: 153, y: 400, t: 1200 })).toBeNull()
    expect(swiped(at, { x: 248, y: 400, t: 1200 })).toBe('back')
    expect(swiped(at, { x: 247, y: 400, t: 1200 })).toBeNull()
  })

  it('crosses only where it went at least half as far again across as down', () => {
    expect(swiped(at, { x: 140, y: 440, t: 1200 })).toBe('on')
    expect(swiped(at, { x: 140, y: 441, t: 1200 })).toBeNull()
    expect(swiped(at, { x: 260, y: 360, t: 1200 })).toBe('back')
    expect(swiped(at, { x: 260, y: 359, t: 1200 })).toBeNull()
  })

  it('crosses only where it lifted within 800 ms', () => {
    expect(swiped(at, { x: 100, y: 400, t: 1800 })).toBe('on')
    expect(swiped(at, { x: 100, y: 400, t: 1801 })).toBeNull()
  })

  it('is a tap where it hardly moved, and a scroll where it went down', () => {
    expect(swiped(at, { x: 202, y: 401, t: 1100 })).toBeNull()
    expect(swiped(at, { x: 190, y: 200, t: 1200 })).toBeNull()
  })
})
