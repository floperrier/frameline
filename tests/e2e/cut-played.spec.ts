import { expect } from '@playwright/test'
import { opened, test } from './author'

/**
 * The Cut read where it is obeyed: a Scene whose run is cut after a time plays
 * itself, the press always cuts ahead of the clock, and the Reader is given a way
 * to stop it — which is what WCAG 2.2.2 asks for the moment anything advances on
 * its own, and what nothing is given where nothing does. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 *
 * Read through the Reader's own door, on a Story published past the API: the
 * Reading is one component behind both doors, so what is proved here is proved of
 * an Author's Preview as well. `opened`, shared with every other spec that reads a
 * Story this way, is `./author`'s.
 *
 * Three kinds of test, and each keeps the time its assertion asks for.
 *
 * That a cut is made at all is left to the browser's own scheduler: a Scene held
 * for half a second, and a beat waited for the way anything else here is waited
 * for. Half a second of a retrying assertion is the cheapest proof there is that
 * a clock runs, and it is the one test that would gain nothing from a clock of
 * ours.
 *
 * What a hold does over time is wound forward by hand on `page.clock` — stopped
 * six seconds into ten, started again, a minute of clock proving a stop. Those
 * are the durations the behaviour is actually about, and a spec that waited them
 * out is a spec nobody runs.
 *
 * A passage is read in real time again, because it is painted by the browser on
 * a schedule of its own — a CSS transition, and the frames Vue counts it in — and
 * a fake clock freezes the very thing being looked at.
 */

test('the clock makes the cut the press would have made, and the press cuts ahead of it',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      // The Scene holds each Shot of its run for half a second, and its second
      // Shot answers for itself with a time no spec would wait out: what puts the
      // ways on on screen there can only be the press.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 500 } })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, {
        data: { cutAfter: 30_000 },
      })
    })

    // Nothing is pressed between here and the next beat.
    await expect(page.getByText('A door opens.')).toBeVisible()
    await expect(page.getByText('She steps out.')).toBeVisible()

    // A Path arrived at by waiting is the Path a hand would have arrived at, down
    // to where the Reader is put: the beat takes the focus the press would have
    // handed it, so a Story that plays itself is not one a screen reader loses.
    await expect(page.locator(':focus')).toContainText('She steps out.')

    // And the press always cuts early: the ways on arrive at once rather than in
    // the thirty seconds the Shot on screen asked to stand for.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  })

test('the Reader stops the clock, and stepping back stops it for them',
  async ({ page, request }) => {
    // The page's clock is wound by hand from here: a hold is a duration, and a
    // spec that waited one out in real seconds would be the slowest thing in the
    // suite and the raciest — see issues #287 and #325. Installed before the page
    // is opened, so the hold the Reading arms as it mounts is on this clock too.
    await page.clock.install()
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 10_000 } })
    })

    const resume = page.getByRole('button', { name: 'Resume the Reading' })
    const held = page.getByText('A door opens.')

    await expect(held).toBeVisible()

    // Six seconds into a hold of ten, and stopped there.
    await page.clock.fastForward(6000)
    await expect(held).toBeVisible()
    await page.getByRole('button', { name: 'Pause the Reading' }).click()

    // A minute on, and the beat is where it was: a clock that is stopped is
    // stopped, and not merely slowed down.
    await page.clock.fastForward(60_000)
    await expect(held).toBeVisible()

    // Started again, the beat stands for the whole of its time rather than for
    // the four seconds that were left of it. This is the assertion that would
    // fail if a hold were ever resumed: at six seconds a resumed one is two
    // seconds past the cut it would have made.
    await resume.click()
    await page.clock.fastForward(6000)
    await expect(held).toBeVisible()
    await page.clock.fastForward(5000)
    await expect(page.getByText('She steps out.')).toBeVisible()

    // Somebody who steps back has asked to stop. A Reader carried forward again a
    // few seconds later would have a control that undoes nothing.
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(held).toBeVisible()
    await expect(resume).toBeVisible()
    await page.clock.fastForward(60_000)
    await expect(held).toBeVisible()
  })

test('a Story opened into a tab nobody is looking at holds its beat',
  async ({ page, request }) => {
    await page.clock.install()
    // A background tab, said in the one way a spec can say it: Playwright has no
    // way to open a page that is genuinely not on screen, so the page is made to
    // answer *hidden* from before anything of the Reading has mounted. What is
    // being proved is that the Reading asks at all rather than waiting to be told
    // — a silent Story opens with no press, so a link followed into the
    // background would otherwise play itself out in a room nobody is looking at.
    await page.addInitScript(() => {
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'hidden',
        configurable: true,
      })
    })

    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 2000 } })
    })

    const held = page.getByText('A door opens.')
    await expect(held).toBeVisible()

    await page.clock.fastForward(60_000)
    await expect(held).toBeVisible()

    // And the clock is running the moment the tab is looked at, from the
    // beginning of the hold: nothing recorded how much of it went by unseen.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.fastForward(2000)
    await expect(page.getByText('She steps out.')).toBeVisible()
  })

test('one beat dissolves into the next, or the passage is made through black',
  async ({ page, request }) => {
    const frames = page.locator('.frame')

    await opened(page, request, async (_, scenes) => {
      // Three seconds of passage over a beat held for half a second: long enough
      // that two frames on screen at once is a fact a spec can read. The beat
      // arriving waits for the press, so the one passage is the only one — an
      // Author who writes a dissolve longer than the hold under it gets three
      // frames over each other, which is what they asked for and not what is
      // being read here.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, cutOver: 3000 },
      })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    await expect(page.getByText('A door opens.')).toBeVisible()

    // What the passage is made over is carried by the gate, because it is the one
    // thing that outlasts the beat — and a dissolve is both beats over each other
    // for the whole of it.
    await expect(page.locator('.gate')).toHaveAttribute('style', /3000ms/)
    await expect.poll(() => frames.count()).toBe(2)
    await expect(page.getByText('She steps out.')).toBeVisible()
    await expect.poll(() => frames.count()).toBe(1)

    // The other passage an Author can write over the same clock: the beat leaving
    // and the beat arriving take half the duration each, either side of a room
    // with nothing in it.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, cutOver: 3000, cutThrough: 'black' },
      })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    await expect(page.locator('.frame.through-black-leave-active')).toHaveCount(1)
    await expect(page.getByText('She steps out.')).toBeVisible()
  })

test('a Reader who asked for less motion is given the rhythm without the passage',
  async ({ page, request }) => {
    // Asked of the browser rather than of the run, because `reducedMotion` handed
    // to `test.use` never reaches the context this suite seals its own cookie into.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, cutOver: 3000, cutThrough: 'black' },
      })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    // The hold is the rhythm of the work rather than a decoration on it, so the
    // beat still arrives on its own.
    await expect(page.getByText('She steps out.')).toBeVisible()

    // And every passage is gone: the three seconds the Author wrote would still
    // have both beats on screen a second from now, and there is one.
    await expect(page.locator('.frame')).toHaveCount(1, { timeout: 1000 })
  })

test('a Story where nothing moves by itself is given no way to stop it',
  async ({ page, request }) => {
    await opened(page, request, async () => {})

    await expect(page.getByText('A door opens.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Resume the Reading' })).toHaveCount(0)
  })
