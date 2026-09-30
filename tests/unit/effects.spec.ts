import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { withholdsFlash, type Arrived } from '../../app/utils/flashes.ts'

/**
 * Nothing an Effect draws flashes more than three times in any second, which is
 * what WCAG 2.3.1 asks of a frame whose flashes it cannot measure. Two Effects
 * flash: a flicker, whose pattern is the stylesheet's own and is read out of it
 * here, and a flash from white, which the Reading withholds by `withholdsFlash`.
 * Neither needs a browser to be held to the bound, because the pattern is a
 * literal and the rule a pure function.
 */

describe('withholdsFlash', () => {
  it('draws a flash from white where no beat came before it', () => {
    expect(withholdsFlash(undefined, 5000)).toBe(false)
  })
  it('withholds it after a beat that flickers, however long that beat stood', () => {
    expect(withholdsFlash({ at: 0, flickers: true }, 5000)).toBe(true)
  })
  it('withholds it after a beat that arrived 999 ms before, and draws it after one a second before', () => {
    expect(withholdsFlash({ at: 1, flickers: false }, 1000)).toBe(true)
    expect(withholdsFlash({ at: 0, flickers: false }, 1000)).toBe(false)
  })
})

/** The Reading as it is written, read the way `steps.spec.ts` reads the editor's templates. */
const READING = readFileSync(fileURLToPath(new URL('../../app/components/Reading.vue', import.meta.url)), 'utf8')

/**
 * The flicker as the stylesheet plays it: its round, and each dip in ms from the
 * start of one. A dip is a run of stops whose opacity is not `1`, and it lasts
 * from the lit stop before the run to the lit stop after it, which is when the
 * light starts to fall and when it is back.
 */
function flickerIn(source: string) {
  const round = Number(source.match(/animation: flicker (\d+)ms/)?.[1])
  const keyframes = source.match(/@keyframes flicker \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const stops = [...keyframes.matchAll(/([\d.%,\s]+)\{\s*opacity:\s*([^;}]+?)\s*;?\s*\}/g)]
    .flatMap(([, at, opacity]) => at!.split(',').map(stop => ({ at: parseFloat(stop) * round / 100, lit: opacity === '1' })))
    .sort((one, other) => one.at - other.at)

  const dips = stops.flatMap((stop, place) => {
    if (!stop.lit || stops[place + 1]?.lit !== false) return []
    const back = stops.slice(place + 1).find(({ lit }) => lit)
    return back ? [{ start: stop.at, lasts: back.at - stop.at }] : []
  })

  return { round, dips }
}

describe('the flicker', () => {
  it('keeps one pattern: a 3200 ms round dipping for 120 ms at 400, 1100, 1600 and 2700 ms in', () => {
    const { round, dips } = flickerIn(READING)

    expect(round).toBe(3200)
    expect(dips.map(({ start }) => Math.round(start))).toEqual([400, 1100, 1600, 2700])
    for (const { lasts } of dips) expect(Math.round(lasts)).toBe(120)
  })
})

/** A beat as the bound plays it: how long it stands, whether it flickers, and whether it arrives from white. */
type Beat = { stands: number, flickers: boolean, fromWhite: boolean }

/**
 * Every flash a run of beats draws, in ms from the first arrival and in order. A
 * beat from white flashes as it arrives unless the rule withholds it; a beat that
 * flickers flashes at every dip that starts before it leaves, and a beat leaving
 * dips no more, because the Reading pauses a frame on its way out.
 */
function flashesOf(beats: Beat[], dipStarts: number[], round: number) {
  const flashes: number[] = []
  let arrival = 0
  let previous: Arrived | undefined

  for (const beat of beats) {
    if (beat.fromWhite && !withholdsFlash(previous, arrival)) flashes.push(arrival)
    if (beat.flickers) {
      for (let lap = 0; lap * round < beat.stands; lap++) {
        for (const start of dipStarts)
          if (lap * round + start < beat.stands) flashes.push(arrival + lap * round + start)
      }
    }
    previous = { at: arrival, flickers: beat.flickers }
    arrival += beat.stands
  }

  return flashes.sort((one, other) => one - other)
}

/**
 * The second WCAG 2.3.1 counts flashes in, written as its own number rather than
 * as `FLASHES_APART`: that constant is what the rule under test is tuned by, and a
 * bound measured with the rule's own parameter would move whenever the rule did.
 */
const A_SECOND = 1000

/** The most flashes any window `[t, t + 1000)` starting at a flash holds. */
function mostInASecond(flashes: number[]) {
  let most = 0
  for (let first = 0, past = 0; first < flashes.length; first++) {
    while (past < flashes.length && flashes[past]! < flashes[first]! + A_SECOND) past++
    most = Math.max(most, past - first)
  }
  return most
}

/** A linear congruential generator, so a run that breaks the bound breaks it again on the next run. */
function seeded(seed: number) {
  let state = seed
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32
}

/**
 * The most flashes in a second over ten thousand random runs of 2 to 40 beats,
 * each standing 50 ms to 5 s and flickering and arriving from white at random.
 */
function worstOver(dipStarts: number[], round: number) {
  const random = seeded(360)
  let worst = 0

  for (let run = 0; run < 10_000; run++) {
    const beats = Array.from({ length: 2 + Math.floor(random() * 39) }, () => ({
      stands: 50 + Math.floor(random() * 4951),
      flickers: random() < 0.5,
      fromWhite: random() < 0.5,
    }))
    worst = Math.max(worst, mostInASecond(flashesOf(beats, dipStarts, round)))
  }

  return worst
}

describe('the flash bound', () => {
  it('holds every second of ten thousand runs to three flashes, over the stylesheet\'s own flicker', () => {
    const { round, dips } = flickerIn(READING)

    expect(dips.length).toBeGreaterThan(0)
    expect(worstOver(dips.map(({ start }) => start), round)).toBeLessThanOrEqual(3)
  })

  // The check can fail: over dips 300 ms apart, one beat alone flashes four
  // times inside a second.
  it('finds a second over three flashes where the dips are 300 ms apart', () => {
    expect(worstOver([400, 700, 1000, 1300], 3200)).toBeGreaterThan(3)
  })
})
