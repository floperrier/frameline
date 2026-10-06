import { expect, type APIRequestContext, type Page } from '@playwright/test'
import type { Scene, StoryInEditor } from '../../shared/utils/scenes'
import { ONE_PIXEL, live, seedFlags, seedShotConditions, test, writeStory } from './author'

/**
 * A Shot read from its own row: the ▶ among its marks turns the middle of the
 * bench to the Preview standing on that Shot as it arrives, rather than wherever
 * the Path last stood — so an Author tuning the seventh beat of a Scene watches
 * the seventh beat, and does not wait out the six before it. See issue #399.
 *
 * Everything about the Reading is asserted inside the Preview, because the
 * writing says the same words in its own section of the document.
 */
function previewIn(page: Page) {
  return page.getByRole('region', { name: /^Preview/ })
}

function benchIn(page: Page) {
  return page.getByRole('region', { name: /On the bench/ })
}

/**
 * `writeStory`'s two Scenes, with the Bar — reached from the Street by *Follow
 * her out* — written to four Shots, changed as the caller asks and opened at the
 * Street, so every ▶ pressed in the Bar has an Exit to cross before it.
 */
async function aBarOfFourShots(
  page: Page,
  request: APIRequestContext,
  change: (street: Scene, bar: Scene) => Promise<void> = async () => {},
) {
  const story = await writeStory(request)
  const read = async () => (await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor).scenes
  const [street, bar] = await read()

  for (const text of ['A glass is set down.', 'She looks up.', 'The door again.']) {
    const shot = await (await request.post(`/api/scenes/${bar!.id}/shots`)).json()
    await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
  }

  const written = (await read())[1]!
  await change(street!, written)
  await page.goto(`/stories/${story.id}?scene=${street!.id}`)
  await live(page)

  return written
}

test('the Preview opens standing on the Shot whose ▶ was pressed, and the writing comes back to it',
  async ({ page, request }) => {
    await aBarOfFourShots(page, request)

    await page.getByRole('button', { name: 'Read from Shot 3 of The bar' }).click()

    const preview = previewIn(page)
    await expect(preview.locator('.frame')).toContainText('She looks up.')
    await expect(preview.locator('.frame')).toBeFocused()
    await expect(benchIn(page).getByText('Shot 3 of The bar', { exact: true })).toBeVisible()
    await expect(benchIn(page).locator('.taken')).toContainText('Follow her out')

    // Back in the writing, the focus is on the mark that was pressed, in view.
    await page.getByRole('button', { name: 'Write the Scene' }).click()
    const pressed = page.getByRole('button', { name: 'Read from Shot 3 of The bar' })
    await expect(pressed).toBeFocused()
    await expect(pressed).toBeInViewport()

    // And *Read the Story* opens the Preview where the Path stands, as it always has.
    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(preview.locator('.frame')).toContainText('She looks up.')
    await expect(preview.locator('[role="status"].nothing')).toBeEmpty()
  })

test('the last Shot of a Scene cut by the clock is shown at once', async ({ page, request }) => {
  await aBarOfFourShots(page, request, async (_, bar) => {
    // A minute a beat: a Preview that waited out the three before it would show
    // the last a few minutes from now, long past any expectation's patience.
    await request.patch(`/api/scenes/${bar.id}`, { data: { cutAfter: 60_000 } })
  })

  await page.getByRole('button', { name: 'Read from Shot 4 of The bar' }).click()

  await expect(previewIn(page).locator('.frame')).toContainText('The door again.')
  await expect(benchIn(page).getByText('Shot 4 of The bar', { exact: true })).toBeVisible()
})

test('a Shot arriving from a blur arrives as it is read, and again at every press of its ▶',
  async ({ page, request }) => {
    await aBarOfFourShots(page, request, async (_, bar) => {
      const shot = bar.shots[1]!
      await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
      // Five seconds, the longest there is, so the arrival is still running
      // whenever it is looked at.
      await request.patch(`/api/shots/${shot.id}`, {
        data: { imageArrives: { effect: 'from-blur', over: 5000, strength: 'marked' } },
      })
    })

    const arrival = previewIn(page).locator('.frame .picture > .arrives')
    const read = page.getByRole('button', { name: 'Read from Shot 2 of The bar' })
    await read.click()

    await expect(arrival).toHaveAttribute('data-effect', 'from-blur')
    await expect(arrival).not.toHaveAttribute('data-rest')
    const first = await arrival.evaluateHandle(element => element.getAnimations()[0]!)
    expect(await first.evaluate(animation => animation.playState)).toBe('running')
    // Far enough in that the arrival started again would be seen to have been: it
    // would stand nearer nought than this one does.
    await expect.poll(() => first.evaluate(animation => Number(animation.currentTime)))
      .toBeGreaterThan(1500)
    const stood = await first.evaluate(animation => Number(animation.currentTime))

    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await read.click()

    await expect(arrival).not.toHaveAttribute('data-rest')
    const again = await arrival.evaluate(async (element, [before, stood]) => {
      const animation = element.getAnimations()[0]!
      await animation.ready

      return {
        another: animation !== before,
        state: animation.playState,
        nearerNought: Number(animation.currentTime) < stood,
      }
    }, [first, stood] as const)
    expect(again).toEqual({ another: true, state: 'running', nearerNought: true })
  })

test('a Shot this Path does not play is not stood on, and the Preview says so',
  async ({ page, request }) => {
    await aBarOfFourShots(page, request, async (street, bar) => {
      await seedFlags(street.id, { lit: 'no' })
      await seedShotConditions(bar.shots[1]!.id, [{ flag: 'lit', is: 'yes' }])
    })

    await page.getByRole('button', { name: 'Read from Shot 2 of The bar' }).click()

    const preview = previewIn(page)
    await expect(preview.locator('.frame')).toContainText('She looks up.')
    await expect(preview.locator('.frame')).not.toContainText('A glass is set down.')
    await expect(preview.getByRole('status').filter({ hasText: 'not played' }))
      .toHaveText('Shot 2 of The bar is not played on this Path.')
    await expect(benchIn(page).getByText('Shot 3 of The bar', { exact: true })).toBeVisible()
    await expect(benchIn(page)).toContainText('Shot 2 · A glass is set down.')
  })
