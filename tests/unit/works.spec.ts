import { describe, expect, it } from 'vitest'
import { CHARACTERS_A_SECOND } from '../../app/utils/remarks.ts'
import { REEL_CHANGE } from '../../demonstration/reel-change.ts'
import { SAMPLES } from '../../demonstration/samples.ts'
import type { Work } from '../../demonstration/work.ts'
import { cut } from '../../shared/utils/reading.ts'
import type { SceneToRead } from '../../shared/utils/reading.ts'
import {
  CUT_AFTER_MAX,
  CUT_OVER_MAX,
  EXITS_AFTER_MAX,
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
 * a whole number of milliseconds within the cap, or nothing said at all.
 */
function within(held: number | undefined, max: number) {
  return held === undefined || isTime(held, max)
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
      expect(within(scene.cutAfter, CUT_AFTER_MAX)).toBe(true)
      // Nought is a sentinel where a Shot writes it and where the ways on do,
      // and a refusal on a Scene's own run: there is no *as the Scene says*
      // above a Scene for it to mean.
      expect(scene.cutAfter).not.toBe(0)
      expect(within(scene.cutOver, CUT_OVER_MAX)).toBe(true)
      expect(within(scene.exitsAfter, EXITS_AFTER_MAX)).toBe(true)

      for (const shot of scene.shots) {
        expect(within(shot.cutAfter, CUT_AFTER_MAX)).toBe(true)
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
