import { describe, expect, it } from 'vitest'
import { CHARACTERS_A_SECOND } from '../../app/utils/remarks.ts'
import { REEL_CHANGE } from '../../demonstration/reel-change.ts'
import { SAMPLES } from '../../demonstration/samples.ts'
import type { Work } from '../../demonstration/work.ts'
import { cut } from '../../shared/utils/reading.ts'
import type { SceneToRead } from '../../shared/utils/reading.ts'
import {
  CUT_AFTER_MAX,
  CUT_AFTER_MIN,
  CUT_OVER_MAX,
  EXITS_AFTER_MAX,
  EXITS_AFTER_MIN,
  isArrival,
  isLasting,
  isTime,
} from '../../shared/utils/scenes.ts'
import type { Shot } from '../../shared/utils/scenes.ts'

/**
 * The Cut the two works this repository carries are written with — *Reel Change*
 * and the Samples — held to the two things a Cut written by hand can get wrong.
 *
 * Both works are written as literals and put into an instance by a script, so
 * nothing between the writing and the reading ever looks at them: a time past
 * its cap is a refused PATCH halfway through writing the work, and a beat cut
 * before it can be read is a Reader who never finds out. Neither is noticed by
 * the suites that hold the rest of these two works together, because both are
 * questions about a number rather than about a shape.
 *
 * The rate is the bench's own — `app/utils/remarks.ts` — so what a work is asked
 * for and what the bench complains about cannot drift apart. The margin is not:
 * the Remark fires at half the reading time, because a Remark an Author learns
 * to ignore is worse than no Remark, and what a work shipped in this repository
 * holds itself to is the whole of it. Half is the threshold for complaining
 * about somebody else's Story; it is not a standard to write one to.
 *
 * Said of both works together because the question is the same one. *Reel
 * Change* had no spec of its own until it had numbers in it.
 */
const WORKS: [string, Work][] = [
  ['Reel Change', REEL_CHANGE],
  ['the Sample written in en', SAMPLES.en],
  ['the Sample written in fr', SAMPLES.fr],
]

/**
 * Whether one of a Cut's times is one the door it is written through will take:
 * a whole number of milliseconds between the floor and the cap, the nought each
 * of them takes as a sentence, or nothing said at all.
 */
function within(held: number | undefined, max: number, min = 0) {
  return held === undefined || held === 0 || isTime(held, max, min)
}

/**
 * One beat as the engine resolves it. A work leaves out what it has nothing to
 * say about, so the columns' own defaults are put back before `cut()` is asked —
 * and it is `cut()` that is asked, the same function the Reading plays a beat by
 * and the bench reads one with, rather than a second statement of the same rule
 * that could come to disagree with it.
 */
function heldFor(scene: Work['scenes'][number], shot: Work['scenes'][number]['shots'][number]) {
  return cut(
    {
      cutAfter: scene.cutAfter ?? null,
      cutOver: scene.cutOver ?? 0,
      cutThrough: scene.cutThrough ?? 'image',
    } as SceneToRead,
    {
      cutAfter: shot.cutAfter ?? null,
      cutOver: shot.cutOver ?? null,
      cutThrough: shot.cutThrough ?? null,
    } as Shot,
  )
}

describe.each(WORKS)('the Cut %s is written with', (_name: string, work: Work) => {
  it('writes no time the door it is written through would refuse', () => {
    for (const exit of work.exits) expect(within(exit.cutOver, CUT_OVER_MAX)).toBe(true)

    for (const scene of work.scenes) {
      expect(within(scene.cutAfter, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(true)
      // Nought is a sentinel where a Shot writes it and where the ways on do,
      // and a refusal on a Scene's own run: there is no *as the Scene says*
      // above a Scene for it to mean.
      expect(scene.cutAfter).not.toBe(0)
      expect(within(scene.cutOver, CUT_OVER_MAX)).toBe(true)
      expect(within(scene.exitsAfter, EXITS_AFTER_MAX, EXITS_AFTER_MIN)).toBe(true)

      for (const shot of scene.shots) {
        expect(within(shot.cutAfter, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(true)
        expect(within(shot.cutOver, CUT_OVER_MAX)).toBe(true)
      }
    }
  })

  it('stands every beat for at least as long as its text takes to read', () => {
    for (const scene of work.scenes) {
      for (const shot of scene.shots) {
        const { after } = heldFor(scene, shot)
        // A beat waiting for the press stands for as long as the Reader wants,
        // which is the one answer this can have nothing to say about.
        if (after === null) continue

        expect(after).toBeGreaterThanOrEqual((shot.text.length / CHARACTERS_A_SECOND) * 1000)
      }
    }
  })
})

/** Every Effect a work writes, with the carrier it is offered to. */
function effectsOf(work: Work) {
  const shots = work.scenes.flatMap(scene => scene.shots)

  return {
    arrivals: shots.flatMap(shot => [
      ...(shot.imageArrives ? [{ held: shot.imageArrives, carrier: 'image' as const }] : []),
      ...(shot.textArrives ? [{ held: shot.textArrives, carrier: 'text' as const }] : []),
    ]),
    lastings: shots.flatMap(shot => [
      ...(shot.imageLasts ? [{ held: shot.imageLasts, carrier: 'image' as const }] : []),
      ...(shot.textLasts ? [{ held: shot.textLasts, carrier: 'text' as const }] : []),
    ]),
    image: shots.filter(shot => shot.imageArrives || shot.imageLasts).length,
    text: shots.filter(shot => shot.textArrives || shot.textLasts).length,
  }
}

describe.each(WORKS)('the Effects %s is written with', (_name: string, work: Work) => {
  it('writes no Effect the door it is written through would refuse', () => {
    const { arrivals, lastings } = effectsOf(work)

    for (const { held, carrier } of arrivals) expect(isArrival(held, carrier)).toBe(true)
    for (const { held, carrier } of lastings) expect(isLasting(held, carrier)).toBe(true)
  })
})

describe('the Effects the works carry', () => {
  it('gives Reel Change exactly one flicker', () => {
    const { lastings } = effectsOf(REEL_CHANGE)

    expect(lastings.filter(({ held }) => held.effect === 'flicker')).toHaveLength(1)
  })

  it.each([['en', SAMPLES.en], ['fr', SAMPLES.fr]] as const)(
    'gives the Sample in %s one Image Effect and one text Effect',
    (_language, work) => {
      const { image, text } = effectsOf(work)

      expect(image).toBe(1)
      expect(text).toBe(1)
    },
  )
})
