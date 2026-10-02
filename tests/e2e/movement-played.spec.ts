import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { opened, test } from './author'
import type { APIRequestContext, Page } from '@playwright/test'

/**
 * The Movement read where it is obeyed: an Image moving in the frame while its
 * Shot is on screen, stopped where it stands by the Pause and by a tab nobody is
 * looking at, carried behind the ways on, and shown where it ends to a Reader who
 * asked for less motion. Read through the Reader's own door on a Story published
 * past the API, as `layout-played.spec.ts` reads the Layout, and in real time: a
 * Movement is a CSS animation, and a fake clock does not move one. See
 * `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
 *
 * Every Movement here comes closer by a fifth, so where it stands is read as one
 * number, the scale of the moving box, from 1 at its start to 1.2 at its end.
 */
const A_LANDSCAPE = readFileSync(new URL('../../demonstration/images/a-scene.webp', import.meta.url))

/** Gives a Shot an Image, and whatever else the caller says of it. */
async function shoot(request: APIRequestContext, shotId: string, data: Record<string, unknown> = {}) {
  await request.put(`/api/shots/${shotId}/image`, { data: A_LANDSCAPE })
  if (Object.keys(data).length) await request.patch(`/api/shots/${shotId}`, { data })
}

/** The scale the moving box is drawn at now, read off its computed matrix. */
function scaleOf(page: Page) {
  return page.locator('.frame:not([inert]) .moving').evaluate(box =>
    new DOMMatrixReadOnly(getComputedStyle(box).transform).a)
}

/**
 * How far its animation has run, in milliseconds, or null where it runs none.
 * Read once the animation is ready, so a pause or a play just asked for has taken
 * hold: a paused animation stops at the next frame the browser draws, and a read
 * inside that frame sees it running.
 */
function travelledOf(page: Page, frame = '.frame:not([inert])') {
  return page.locator(`${frame} .moving`).evaluate(async (box) => {
    const animation = box.getAnimations()[0]
    if (!animation) return null
    await animation.ready

    return animation.currentTime as number | null
  })
}

/** How long its animation runs, in milliseconds. */
function overOf(page: Page) {
  return page.locator('.frame:not([inert]) .moving').evaluate(box =>
    box.getAnimations()[0]?.effect?.getTiming().duration)
}

/** A scale read off the screen against the one a claim expects, within what a real-time read holds to. */
function near(scale: number, expected: number, within: number) {
  expect(Math.abs(scale - expected), `the scale is ${scale}`).toBeLessThanOrEqual(within)
}

/** The page said to be looked at or not, the one way a spec can say it. */
function seen(page: Page, visible: boolean) {
  return page.evaluate((visible) => {
    Object.defineProperty(document, 'visibilityState', {
      get: () => (visible ? 'visible' : 'hidden'),
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, visible)
}

test('an Image comes closer over its time and rests where it ends',
  async ({ page, request }) => {
    // On the second Shot, which arrives at a press: the opening beat is drawn by
    // the server and moves from the moment the page is first painted, a good
    // while before the page is live and anything here can read it.
    await opened(page, request, async (_, [street]) => {
      await request.patch(`/api/scenes/${street!.id}`, {
        data: { movementBy: 20, movementDirection: 'closer', movementOver: 4000 },
      })
      await shoot(request, street!.shots[1]!.id)
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    near(await scaleOf(page), 1, 0.02)
    await page.waitForTimeout(4500)
    near(await scaleOf(page), 1.2, 0.01)

    // Once, and never back: a second later it is where it ended.
    await page.waitForTimeout(1000)
    near(await scaleOf(page), 1.2, 0.01)
  })

test('a Movement over the whole time spans the text arriving and then the hold',
  async ({ page, request }) => {
    // The clock counts the hold from the text having arrived, a second after the
    // Image lands, so the Image moving until the clock cuts moves for three.
    await opened(page, request, async (_, [street]) => {
      await request.patch(`/api/scenes/${street!.id}`, {
        data: {
          movementBy: 20, movementOver: 0, cutAfter: 2000,
          textAfter: 1000, textOver: 0, textBy: 'whole',
        },
      })
      await shoot(request, street!.shots[0]!.id)
    })
    expect(await overOf(page)).toBe(3000)

    // A text that lands with its Image has no arrival to span: the hold alone.
    await opened(page, request, async (_, [street]) => {
      await request.patch(`/api/scenes/${street!.id}`, {
        data: { movementBy: 20, movementOver: 0, cutAfter: 2000 },
      })
      await shoot(request, street!.shots[0]!.id)
    })
    expect(await overOf(page)).toBe(2000)
  })

test('the Pause freezes the Movement where it stands, and Resume carries it on',
  async ({ page, request }) => {
    await opened(page, request, async (_, [street]) => {
      // Long enough that a Movement painted by the server, and moving before the
      // page is live, cannot have ended before it is read.
      await request.patch(`/api/scenes/${street!.id}`, {
        data: { movementBy: 20, movementOver: 20000 },
      })
      await shoot(request, street!.shots[0]!.id)
    })

    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Pause the Reading' }).click()
    const paused = await travelledOf(page)
    await page.waitForTimeout(700)
    expect(await travelledOf(page)).toBe(paused)

    // Resumed from where it stood, rather than started again from its start.
    await page.getByRole('button', { name: 'Resume the Reading' }).click()
    await page.waitForTimeout(500)
    expect(await travelledOf(page)).toBeGreaterThan(paused!)

    // A tab nobody is looking at stops it the same way, and looking at it again
    // carries it on from there.
    await seen(page, false)
    const hidden = await travelledOf(page)
    await page.waitForTimeout(700)
    expect(await travelledOf(page)).toBe(hidden)
    await seen(page, true)
    await page.waitForTimeout(500)
    expect(await travelledOf(page)).toBeGreaterThan(hidden!)
  })

test('a hand-read Story with one moving Image offers the Pause',
  async ({ page, request }) => {
    await opened(page, request, async (_, [street]) => {
      await shoot(request, street!.shots[0]!.id, { movementBy: 20 })
    })

    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toBeVisible()

    // And the ways on are still a clock's to time: nothing here says how long
    // they stand, because every arrival on this Story is a press.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(page.getByText('The Exits stand until you take one.')).toHaveCount(0)
  })

test('a still Image runs nothing, and a hand-read still Story offers no Pause',
  async ({ page, request }) => {
    await opened(page, request, async (_, [street]) => {
      await shoot(request, street!.shots[0]!.id)
    })

    const moving = page.locator('.frame .moving')
    await expect(moving).toHaveCount(1)
    await expect(moving).not.toHaveClass(/\bmoves\b/)
    expect(await travelledOf(page)).toBeNull()
    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toHaveCount(0)
  })

test('under less motion the Image stands where its Movement ends',
  async ({ page, request }) => {
    // Asked of the browser rather than of the run, because `reducedMotion` handed
    // to `test.use` never reaches the context this suite seals its own cookie into:
    // see `cut-played.spec.ts`.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await opened(page, request, async (_, [street]) => {
      await request.patch(`/api/scenes/${street!.id}`, { data: { movementBy: 20, movementOver: 4000 } })
      await shoot(request, street!.shots[0]!.id)
    })

    near(await scaleOf(page), 1.2, 0.01)
    expect(await travelledOf(page)).toBeNull()

    // A step back pauses the Reading, and a paused Movement would stand at its
    // start: under less motion it stands at its end all the same.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(page.getByRole('button', { name: 'Resume the Reading' })).toBeVisible()
    near(await scaleOf(page), 1.2, 0.01)
  })

test('the leaving frame keeps moving through a dissolve',
  async ({ page, request }) => {
    await opened(page, request, async (_, [street]) => {
      await request.patch(`/api/scenes/${street!.id}`, {
        // Long, for the reason the Pause's is: the leaving frame is the opening one.
        data: { cutOver: 1500, cutThrough: 'image', movementBy: 20, movementOver: 20000 },
      })
      await shoot(request, street!.shots[0]!.id)
      await shoot(request, street!.shots[1]!.id)
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    const leaving = await travelledOf(page, '.frame[inert]')
    await page.waitForTimeout(300)
    expect(await travelledOf(page, '.frame[inert]')).toBeGreaterThan(leaving!)
  })

/**
 * The street's last Shot moving over eight seconds, read a second into it and
 * pressed on to the end of the run: the scale it stood at a moment before the run
 * ended.
 */
async function heldBehindTheWaysOn(page: Page, request: APIRequestContext) {
  await opened(page, request, async (_, [street]) => {
    await shoot(request, street!.shots[1]!.id, { movementBy: 20, movementOver: 8000 })
  })

  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.waitForTimeout(1000)
  const stood = await scaleOf(page)
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()

  return stood
}

test('behind the Exits the frame keeps the Image where it stood',
  async ({ page, request }) => {
    const stood = await heldBehindTheWaysOn(page, request)

    // The frame is drawn afresh behind the ways on, and starts where the run
    // left it rather than over again or at its end. Claimed on one side of where
    // it stood, since the press that ended the run read it a moment later, and a
    // loaded runner may make that moment long.
    const held = await scaleOf(page)
    expect(held).toBeGreaterThanOrEqual(stood - 0.005)
    expect(held).toBeLessThan(1.15)

    // And nothing moves behind the choice.
    await page.waitForTimeout(1000)
    near(await scaleOf(page), held, 0.005)
  })

test('a held frame nothing carried a Movement to shows its end',
  async ({ page, request }) => {
    await heldBehindTheWaysOn(page, request)

    // Stepped back to across the Exit, the frame behind the ways on is reached
    // without the run playing into it, so it stands where its Movement ends.
    await page.getByRole('button', { name: 'Follow her out' }).click()
    await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    near(await scaleOf(page), 1.2, 0.01)
  })

test('a step back stands the Image at its start, paused',
  async ({ page, request }) => {
    await opened(page, request, async (_, [street]) => {
      await request.patch(`/api/scenes/${street!.id}`, { data: { movementBy: 20, movementOver: 4000 } })
      await shoot(request, street!.shots[0]!.id)
      await shoot(request, street!.shots[1]!.id)
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(page.getByRole('button', { name: 'Resume the Reading' })).toBeVisible()
    near(await scaleOf(page), 1, 0.005)

    // And it stands there, rather than having only just started.
    await page.waitForTimeout(500)
    near(await scaleOf(page), 1, 0.005)
  })

test('an inset moving Image covers its box, a still one is shown whole',
  async ({ page, request }) => {
    await opened(page, request, async (_, [street]) => {
      await shoot(request, street!.shots[0]!.id, { movementBy: 20 })
      await shoot(request, street!.shots[1]!.id)
    })

    const image = page.locator('.frame img')
    await expect(image).toHaveCSS('object-fit', 'cover')
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByText('She steps out.')).toBeVisible()
    await expect(image).toHaveCSS('object-fit', 'contain')
  })
