import { expect, type Locator, type Page } from '@playwright/test'
import { live, opened, readTheStory, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Reading gone on and stepped back by a finger crossing the frame. Towards the
 * leading edge does what *Next Shot* does, the other way what *Step Back* does,
 * and a tap, a scroll, a mouse or a touch on a control moves nothing. See issue
 * #406 and `docs/adr/0065-a-swipe-across-the-frame-is-a-press.md`.
 *
 * Read on a phone, through the Reader's own door, on the default Story `opened`
 * publishes — *A door opens.* and *She steps out.*, then *Follow her out* into
 * *Smoke, and no one she knows.* — and on a tablet in the bench's Preview.
 */
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

/** The words of the beat on screen. */
function shot(where: Page | Locator) {
  return where.locator('.frame .shot')
}

/**
 * A finger put on `on` at the middle of the frame, moved `across` and `down` it in
 * CSS pixels, and lifted `after` the given milliseconds: the touch `PointerEvent`s
 * a phone sends, dispatched where the browser would, on the element under the
 * finger.
 */
async function swipe(on: Locator, across: number, down = 0, after = 0) {
  await on.evaluate(async (target, [across, down, after]) => {
    const box = target.getBoundingClientRect()
    const x = box.left + box.width / 2
    const y = box.top + Math.min(box.height / 2, 200)
    const finger = (clientX: number, clientY: number) => ({
      pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX, clientY,
    })

    target.dispatchEvent(new PointerEvent('pointerdown', finger(x, y)))
    await new Promise(resolve => setTimeout(resolve, after))
    target.dispatchEvent(new PointerEvent('pointermove', finger(x + across / 2, y + down / 2)))
    target.dispatchEvent(new PointerEvent('pointerup', finger(x + across, y + down)))
  }, [across, down, after])
}

test('a finger across the frame goes on towards the leading edge and steps back the other way',
  async ({ page, request }) => {
    await opened(page, request, async () => {})
    const frame = page.locator('.frame')
    await expect(shot(page)).toHaveText('A door opens.')

    // A vertical swipe is the page's to scroll, and a horizontal one the Reading's.
    await expect(frame).toHaveCSS('touch-action', 'pan-y pinch-zoom')

    // On the opening beat there is nothing to step back to, and nothing does.
    await swipe(frame, 120)
    await expect(shot(page)).toHaveText('A door opens.')

    await swipe(frame, -120)
    await expect(shot(page)).toHaveText('She steps out.')
    await expect(frame).toBeFocused()

    await swipe(frame, 120)
    await expect(shot(page)).toHaveText('A door opens.')
    await expect(frame).toBeFocused()

    // At the end of the run the Scene offers its Exits, and a swipe on takes none.
    await swipe(frame, -120)
    await swipe(frame, -120)
    const way = page.getByRole('button', { name: 'Follow her out' })
    await expect(way).toBeFocused()
    await swipe(frame, -120)
    await expect(way).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next Shot' })).toHaveCount(0)

    // And a swipe back from there is *Step Back*, which is drawn.
    await swipe(frame, 120)
    await expect(shot(page)).toHaveText('She steps out.')
    await expect(way).toHaveCount(0)
  })

test('a tap, a scroll, a slow drag, a mouse and a touch on a control move nothing',
  async ({ page, request }) => {
    await opened(page, request, async () => {})
    const frame = page.locator('.frame')
    await expect(shot(page)).toHaveText('A door opens.')

    // A tap is a finger on the picture to look at it, from the browser's own touch.
    const box = (await frame.boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await page.touchscreen.tap(box.x + 20, box.y + 20)

    // Short, mostly down, or held past the time a swipe is lifted in.
    await swipe(frame, -40)
    await swipe(frame, -80, 160)
    await swipe(frame, -120, 0, 900)

    // A mouse dragging across the frame selects, as it always has.
    await page.mouse.move(box.x + box.width - 20, box.y + 40)
    await page.mouse.down()
    await page.mouse.move(box.x + 20, box.y + 40, { steps: 5 })
    await page.mouse.up()

    // A swipe begun on a control is the control's.
    await swipe(page.getByRole('button', { name: 'Next Shot' }), -120)
    await expect(shot(page)).toHaveText('A door opens.')

    // One swipe that counts is one beat on, so none of those before it was one.
    await swipe(frame, -120)
    await expect(shot(page)).toHaveText('She steps out.')
  })

test('a text arriving in its own time is shown whole by the first swipe, and cut by the second',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { textBy: 'word', textPace: 1 },
      })
    })
    const frame = page.locator('.frame')
    await expect(page.getByRole('button', { name: 'Show the Whole Text' })).toBeVisible()

    await swipe(frame, -120)
    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()
    await expect(page.getByRole('figure')).toHaveAccessibleName('A door opens.')

    await swipe(frame, -120)
    await expect(page.getByRole('figure')).toHaveAccessibleName('She steps out.')
  })

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('the Preview on the bench is read by swiping too', async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
    await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
    await live(page)
    const preview = await readTheStory(page)
    const frame = preview.locator('.frame')
    await expect(shot(preview)).toHaveText('A door opens.')

    await swipe(frame, -120)
    await expect(shot(preview)).toHaveText('She steps out.')
    await swipe(frame, 120)
    await expect(shot(preview)).toHaveText('A door opens.')
  })
})
