import { expect } from '@playwright/test'
import { ONE_PIXEL, opened, test } from './author'
import type { Locator } from '@playwright/test'

/**
 * A Shot's Effects read where they are played: an arrival runs once, over the time
 * the Author wrote, and what lasts runs for as long as its beat stands; the Pause
 * stops every one of them and each resumes where it stood; an arrival plays only
 * on a beat that is seen arriving; a flash from white is withheld inside a second
 * of the beat before it; and a Reader who asked for less motion sees none of them
 * move. See `docs/adr/0051-an-effect-is-said-of-one-beat.md`.
 *
 * Read through the Reader's own door, on a Story published past the API, as
 * `cut-played.spec.ts` reads the Cut: the Reading is one component behind both
 * doors, so what is proved here is proved of an Author's Preview as well.
 *
 * An Effect is a CSS animation, and a browser paints one on a schedule of its own
 * that `page.clock` does not reach, so every test here runs in real time and asks
 * the element what it is running rather than looking at pixels.
 */

/** What an element is running, as the browser holds it. */
function running(effect: Locator) {
  return effect.evaluate(element => element.getAnimations().map(animation => ({
    kind: animation.constructor.name,
    name: (animation as CSSAnimation).animationName,
    over: animation.effect?.getTiming().duration,
    iterations: animation.effect?.getTiming().iterations,
    state: animation.playState,
  })))
}

/**
 * Every animation under the frame on screen, in the order the frame draws them,
 * and how far into itself each stands. Read once each is `ready`, because a pause
 * is only taken at the next frame the browser paints, and until then the time
 * still runs: read straight after the press, a stopped Effect would be read a
 * few milliseconds short of where it stopped.
 */
function everyEffect(frame: Locator) {
  return frame.locator('[data-effect]').evaluateAll(async (elements) => {
    const animations = elements.flatMap(element => element.getAnimations())
    await Promise.all(animations.map(animation => animation.ready))

    return animations.map(animation => ({
      state: animation.playState, at: Number(animation.currentTime),
    }))
  })
}

test('an arrival runs once over its time, and what lasts runs for as long as the beat stands',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      const shot = scenes[0]!.shots[0]!
      await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
      // Five seconds, the longest there is, so the shake is still running
      // whenever the page is looked at.
      await request.patch(`/api/shots/${shot.id}`, {
        data: {
          imageArrives: { effect: 'shake', over: 5000, strength: 'marked' },
          textLasts: { effect: 'pulse', every: 900, strength: 'slight' },
        },
      })
    })

    await expect(page.getByText('A door opens.')).toBeVisible()

    expect(await running(page.locator('.frame .picture > .arrives'))).toEqual([{
      kind: 'CSSAnimation',
      name: expect.stringMatching(/^shake/),
      over: 5000,
      iterations: 1,
      state: 'running',
    }])
    expect(await running(page.locator('.frame figcaption .lasts'))).toEqual([{
      kind: 'CSSAnimation',
      name: expect.stringMatching(/^pulse/),
      over: 900,
      iterations: Infinity,
      state: 'running',
    }])
  })

test('the Pause stops every Effect where it stands, and each resumes from there',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      const shot = scenes[0]!.shots[0]!
      await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
      await request.patch(`/api/shots/${shot.id}`, {
        data: {
          imageArrives: { effect: 'from-blur', over: 5000, strength: 'marked' },
          imageLasts: { effect: 'grain', strength: 'marked' },
          textArrives: { effect: 'shake', over: 5000, strength: 'slight' },
          textLasts: { effect: 'pulse', every: 900, strength: 'slight' },
        },
      })
    })

    const frame = page.locator('.frame')
    await expect(page.getByText('A door opens.')).toBeVisible()

    // Far enough in that an Effect started again would be seen to have been: it
    // would stand nearer nought than where it was stopped.
    await expect.poll(async () => Math.min(...(await everyEffect(frame)).map(({ at }) => at)))
      .toBeGreaterThan(1000)

    await page.getByRole('button', { name: 'Pause the Reading' }).click()
    const stopped = await everyEffect(frame)
    expect(stopped).toHaveLength(4)
    expect(stopped.map(({ state }) => state)).toEqual(['paused', 'paused', 'paused', 'paused'])

    // A second on, and nothing has moved: a stopped Effect is stopped, not slowed.
    await page.waitForTimeout(1000)
    expect(await everyEffect(frame)).toEqual(stopped)

    // Started again, each goes on from the moment it was stopped at. Restarted, it
    // would stand under that moment; carried on as if it had never stopped, a
    // second past it.
    await page.getByRole('button', { name: 'Resume the Reading' }).click()
    const resumed = await everyEffect(frame)
    expect(resumed.map(({ state }) => state)).toEqual(['running', 'running', 'running', 'running'])
    for (const [place, { at }] of resumed.entries()) {
      expect(at).toBeGreaterThanOrEqual(stopped[place]!.at)
      expect(at).toBeLessThan(stopped[place]!.at + 1000)
    }
  })

test('an arrival plays only on a beat seen arriving, and what lasts goes on behind the ways on',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      for (const shot of scenes[0]!.shots) {
        await request.patch(`/api/shots/${shot.id}`, {
          data: {
            textArrives: { effect: 'shake', over: 5000, strength: 'marked' },
            textLasts: { effect: 'pulse', every: 900, strength: 'marked' },
          },
        })
      }
    })

    const arrival = page.locator('.frame figcaption .arrives')
    const lasting = page.locator('.frame figcaption .lasts')

    // Pressed for, the next beat is seen arriving, and its arrival plays.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByText('She steps out.')).toBeVisible()
    expect(await running(arrival)).toHaveLength(1)

    // The frame held behind the ways on is drawn afresh and does not arrive, so
    // its shake is not thrown a second time, while its pulse goes on under the
    // choice as it went on under the beat.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(page.locator('.frame.pushed-back')).toHaveCount(1)
    await expect(arrival).toHaveAttribute('data-rest', '')
    expect(await running(arrival)).toEqual([])
    expect((await running(lasting)).map(({ state }) => state)).toEqual(['running'])

    // A step back stops the clock, and a stopped arrival would hold its first
    // frame, so the beat stepped back to is drawn as its arrival leaves it. What
    // lasts on it is there, stopped with everything else.
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(page.locator('.frame.pushed-back')).toHaveCount(0)
    await expect(page.getByText('She steps out.')).toBeVisible()
    await expect(arrival).toHaveAttribute('data-rest', '')
    expect(await running(arrival)).toEqual([])
    expect((await running(lasting)).map(({ state }) => state)).toEqual(['paused'])
  })

test('a flash from white inside a second of the beat before it is not drawn',
  async ({ page, request }) => {
    const white = page.locator('.frame .overlay[data-effect="from-white"]')
    // The first beat stands half a second, so its white is watched for from before
    // the page is opened rather than looked for once it has: a look taken after
    // the half second would find the second beat and prove nothing about the
    // first.
    const firstWhite = white.waitFor({ state: 'attached' })

    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 500 } })
      for (const shot of scenes[0]!.shots) {
        await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
        await request.patch(`/api/shots/${shot.id}`, {
          data: { imageArrives: { effect: 'from-white', over: 1200, strength: 'strong' } },
        })
      }
      // The second holds until the press, so the beat the rule is read on stays.
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    // The opening beat has nothing before it, so its white is drawn.
    await firstWhite
    // Half a second later the clock brings the second, whose white would be a
    // second flash inside the same second, and it is drawn without one.
    await expect(page.getByText('She steps out.')).toBeVisible()
    await expect(page.locator('.frame .picture > .arrives')).toHaveCount(1)
    await expect(white).toHaveCount(0)
  })

test('a Story whose only moving thing is an Effect that lasts is given a way to stop it',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/shots/${scenes[0]!.shots[0]!.id}`, {
        data: { textLasts: { effect: 'pulse', every: 900, strength: 'slight' } },
      })
    })

    await expect(page.getByText('A door opens.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toBeVisible()
  })

test('a Reader who asked for less motion sees no Effect move, only what it leaves',
  async ({ page, request }) => {
    // Asked of the browser rather than of the run, for the reason
    // `cut-played.spec.ts` gives.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await opened(page, request, async (_, scenes) => {
      const shot = scenes[0]!.shots[0]!
      await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
      await request.patch(`/api/shots/${shot.id}`, {
        data: {
          imageArrives: { effect: 'out-of-colour', over: 3000, strength: 'strong' },
          imageLasts: { effect: 'grain', strength: 'marked' },
          textArrives: { effect: 'shake', over: 500, strength: 'marked' },
          textLasts: { effect: 'flicker', strength: 'marked' },
        },
      })
    })

    const frame = page.locator('.frame')
    await expect(page.getByText('A door opens.')).toBeVisible()
    await expect(frame.locator('[data-effect]')).toHaveCount(4)

    // Nothing runs at all, not even for the hundredth of a millisecond
    // `frameline.css` leaves every other animation.
    expect(await everyEffect(frame)).toEqual([])

    // And the grey the Image goes to is there from the start, since it is what
    // the Effect leaves rather than how it moves.
    await expect(frame.locator('.picture > .arrives')).toHaveCSS('filter', 'grayscale(1)')
  })
