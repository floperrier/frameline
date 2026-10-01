import { describe, expect, it } from 'vitest'
import { isArrival, isLasting } from '../../shared/utils/scenes'
import { flickers } from '../../shared/utils/reading'
import { formatted, line, run } from '../../shared/utils/formatted'

describe('isArrival', () => {
  it('takes an Arrival offered to its carrier', () => {
    expect(isArrival({ effect: 'from-white', over: 1200, strength: 'strong' }, 'image')).toBe(true)
    expect(isArrival({ effect: 'shake', over: 100, strength: 'slight' }, 'text')).toBe(true)
    expect(isArrival({ effect: 'from-blur', over: 5000, strength: 'marked' }, 'text')).toBe(true)
  })
  it('refuses from white on the text', () => {
    expect(isArrival({ effect: 'from-white', over: 1200, strength: 'strong' }, 'text')).toBe(false)
  })
  it('refuses an over just outside its bounds, or not whole', () => {
    for (const over of [99, 5001, 2.5, '1200', null])
      expect(isArrival({ effect: 'shake', over, strength: 'marked' }, 'image')).toBe(false)
  })
  it('refuses an unknown strength, an unknown key, and what is not an object', () => {
    expect(isArrival({ effect: 'shake', over: 500, strength: 'loud' }, 'image')).toBe(false)
    expect(isArrival({ effect: 'shake', over: 500, strength: 'marked', every: 900 }, 'image')).toBe(false)
    expect(isArrival(JSON.parse('{"effect":"shake","over":500,"strength":"marked","__proto__":{}}'), 'image')).toBe(false)
    for (const held of [null, [], 'shake', 3]) expect(isArrival(held, 'image')).toBe(false)
  })
})

describe('isLasting', () => {
  it('takes a round exactly where its effect has one', () => {
    expect(isLasting({ effect: 'pulse', every: 800, strength: 'slight' }, 'text')).toBe(true)
    expect(isLasting({ effect: 'flicker', strength: 'slight' }, 'image')).toBe(true)
    expect(isLasting({ effect: 'grain', strength: 'marked' }, 'image')).toBe(true)
  })
  it('refuses every on a flicker and none on a pulse', () => {
    expect(isLasting({ effect: 'flicker', every: 800, strength: 'slight' }, 'image')).toBe(false)
    expect(isLasting({ effect: 'pulse', strength: 'slight' }, 'image')).toBe(false)
  })
  it('refuses a round just outside its bounds, or not whole', () => {
    for (const every of [199, 4001, 2.5])
      expect(isLasting({ effect: 'tremor', every, strength: 'marked' }, 'image')).toBe(false)
  })
  it('refuses grain on the text and an unknown strength', () => {
    expect(isLasting({ effect: 'grain', strength: 'marked' }, 'text')).toBe(false)
    expect(isLasting({ effect: 'pulse', every: 800, strength: 'loud' }, 'text')).toBe(false)
  })
})

describe('flickers', () => {
  it('is said of a Shot whose Image or text flickers', () => {
    const image = '/api/shots/a/image'
    expect(flickers({ image, imageLasts: { effect: 'flicker', strength: 'slight' }, textLasts: null })).toBe(true)
    expect(flickers({ image: null, imageLasts: null, textLasts: { effect: 'flicker', strength: 'slight' } })).toBe(true)
    expect(flickers({ image, imageLasts: { effect: 'grain', strength: 'slight' }, textLasts: null })).toBe(false)
  })
  it('is not said of a flicker on an Image the Shot does not have', () => {
    expect(flickers({ image: null, imageLasts: { effect: 'flicker', strength: 'slight' }, textLasts: null })).toBe(false)
  })
  it('is said of a Shot whose one flicker is on a run of its words', () => {
    const flickering = formatted(line('a ', run('lamp', { type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } })))
    expect(flickers({ image: null, imageLasts: null, textLasts: null, formatted: flickering })).toBe(true)
    const waving = formatted(line(run('sea', { type: 'lasts', attrs: { effect: 'wave', every: 1600, strength: 'slight' } })))
    expect(flickers({ image: null, imageLasts: null, textLasts: null, formatted: waving })).toBe(false)
  })
})

describe('a run', () => {
  it('is offered a scramble and a wave, which neither the Image nor the text is', () => {
    expect(isArrival({ effect: 'scramble', over: 1200, strength: 'marked' }, 'run')).toBe(true)
    expect(isLasting({ effect: 'wave', every: 1600, strength: 'slight' }, 'run')).toBe(true)
    for (const carrier of ['image', 'text'] as const) {
      expect(isArrival({ effect: 'scramble', over: 1200, strength: 'marked' }, carrier)).toBe(false)
      expect(isLasting({ effect: 'wave', every: 1600, strength: 'slight' }, carrier)).toBe(false)
    }
  })
  it('keeps the text’s shake, blur, flicker, pulse and tremor, and refuses what is the Image’s', () => {
    expect(isArrival({ effect: 'from-blur', over: 500, strength: 'slight' }, 'run')).toBe(true)
    expect(isLasting({ effect: 'tremor', every: 300, strength: 'slight' }, 'run')).toBe(true)
    expect(isArrival({ effect: 'from-white', over: 500, strength: 'slight' }, 'run')).toBe(false)
    expect(isLasting({ effect: 'grain', strength: 'slight' }, 'run')).toBe(false)
  })
  it('gives a wave a round, as a pulse has', () => {
    expect(isLasting({ effect: 'wave', strength: 'slight' }, 'run')).toBe(false)
    expect(isLasting({ effect: 'wave', every: 199, strength: 'slight' }, 'run')).toBe(false)
  })
})
