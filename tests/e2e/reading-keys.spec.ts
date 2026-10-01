import { readFileSync } from 'node:fs'
import { expect, type Locator, type Page } from '@playwright/test'
import { live, opened, readTheStory, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Reading gone on with one key, and given the whole screen. `Space`, `Enter`,
 * `→` and `PageDown` do what *Next Shot* does, `←` and `PageUp` what *Step Back*
 * does, from the Reading or from the page it is read on — never from a field, a
 * control or under a modifier, and in a Preview only from inside the Reading.
 * *Full Screen* is the Reader's alone, and only where the browser can give it.
 * See issue #391.
 *
 * Read through the Reader's own door on the default two-Scene Story `opened`
 * publishes — *A door opens.* and *She steps out.*, then *Follow her out* into
 * *Smoke, and no one she knows.* — and on the bench's Preview.
 */

/** The words of the beat on screen. */
function shot(where: Page | Locator) {
  return where.locator('.frame .shot')
}

/**
 * Every key that reaches the window from here on, with whether something before
 * it took the browser's own answer to it away: the key acting is what prevents it,
 * and nothing else may. A modifier going down is a key of its own, and is not one
 * of these.
 */
async function prevented(page: Page) {
  await page.evaluate(() => {
    const seen: boolean[] = []
    Object.assign(window, { prevented: seen })
    window.addEventListener('keydown', (event) => {
      if (!['Shift', 'Alt', 'Control', 'Meta'].includes(event.key)) seen.push(event.defaultPrevented)
    })
  })

  return () => page.evaluate(() => (window as unknown as { prevented: boolean[] }).prevented)
}

test('a Reader goes on with Space, Enter and the arrow, and steps back with the other',
  async ({ page, request }) => {
    await opened(page, request, async () => {})
    await expect(shot(page)).toHaveText('A door opens.')
    const keys = await prevented(page)

    // From the page itself, with nothing holding the focus: the Reading is all
    // there is to read on it.
    await page.keyboard.press('Space')
    await expect(shot(page)).toHaveText('She steps out.')
    await page.keyboard.press('ArrowLeft')
    await expect(shot(page)).toHaveText('A door opens.')

    // And from the frame each move lands the Reader on.
    await expect(page.locator('.frame')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(shot(page)).toHaveText('She steps out.')
    await page.keyboard.press('PageUp')
    await expect(shot(page)).toHaveText('A door opens.')
    await page.keyboard.press('ArrowRight')
    await expect(shot(page)).toHaveText('She steps out.')
    await page.keyboard.press('PageDown')

    // The run has played out and the focus is on the first way on, where Space is
    // the button's own: it takes the Exit.
    const way = page.getByRole('button', { name: 'Follow her out' })
    await expect(way).toBeFocused()
    await page.keyboard.press('Space')
    await expect(shot(page)).toHaveText('Smoke, and no one she knows.')

    // Every key that moved the Reading took the browser's answer away, and the
    // one the Exit answered was left to the Exit.
    expect(await keys()).toEqual([true, true, true, true, true, true, false])
  })

test('a key held with a modifier, or pressed in a field, moves nothing',
  async ({ page, request }) => {
    await opened(page, request, async () => {})
    await expect(shot(page)).toHaveText('A door opens.')
    const keys = await prevented(page)

    await page.keyboard.press('Shift+Space')
    await page.keyboard.press('Alt+ArrowRight')
    await page.keyboard.press('Control+Enter')

    // One press with nothing held is one beat on, so none of the three before it
    // was one.
    await page.keyboard.press('Space')
    await expect(shot(page)).toHaveText('She steps out.')

    // In the Comments the keys are the field's: a space typed, the caret moved.
    const field = page.getByLabel('What you have to say about this Story')
    await field.fill('Kind')
    await field.press('Space')
    await field.press('ArrowLeft')
    await expect(field).toHaveValue('Kind ')
    expect(await field.evaluate((typed: HTMLTextAreaElement) => typed.selectionStart)).toBe(4)
    await expect(shot(page)).toHaveText('She steps out.')

    expect(await keys()).toEqual([false, false, false, true, false, false])
  })

test('a text arriving in its own time is shown whole by the first Space, and cut by the second',
  async ({ page, request }) => {
    // One character a second, so nothing here is late enough for the text to have
    // arrived on its own.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { textBy: 'word', textPace: 1 },
      })
    })
    await expect(page.getByRole('button', { name: 'Show the Whole Text' })).toBeVisible()

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()
    await expect(page.getByRole('figure')).toHaveAccessibleName('A door opens.')

    await page.keyboard.press('Space')
    await expect(page.getByRole('figure')).toHaveAccessibleName('She steps out.')
  })

test('in the Preview the keys work inside the Reading and nowhere else on the bench',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
    await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
    await live(page)
    const preview = await readTheStory(page)
    await expect(shot(preview)).toHaveText('A door opens.')

    // Nothing on the bench is the Reading: not the page, and not a field on it.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Space')
    const title = page.locator('#story-title')
    await title.focus()
    await title.press('End')
    await title.press('Space')
    await expect(title).toHaveValue('A Story ')
    await title.press('Backspace')
    await expect(shot(preview)).toHaveText('A door opens.')

    // The frame is.
    await preview.locator('.frame').focus()
    await page.keyboard.press('Space')
    await expect(shot(preview)).toHaveText('She steps out.')

    // And an Author reads where they write: the Preview is never given the screen.
    await expect(preview.getByRole('button', { name: 'Full Screen' })).toHaveCount(0)
  })

test('a Reader gives the Reading the whole screen, and takes it back',
  async ({ page, request }) => {
    await opened(page, request, async () => {})
    const root = page.locator('.reading')
    const fill = page.getByRole('button', { name: 'Full Screen', exact: true })
    const leave = page.getByRole('button', { name: 'Leave Full Screen' })
    const filled = () => root.evaluate(reading => document.fullscreenElement === reading)

    await fill.click()
    await expect(leave).toBeVisible()
    expect(await filled()).toBe(true)

    // The press that gave it the screen puts the Reader on the beat, so the next
    // Space goes on rather than pressing the control again.
    await expect(page.locator('.frame')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(shot(page)).toHaveText('She steps out.')
    expect(await filled()).toBe(true)

    await leave.click()
    await expect(fill).toBeVisible()
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true)

    // Left by the browser's own way out, the control is relabelled all the same.
    // Esc is the browser's and not the page's, and headless Chromium has no
    // window to hear it in, so the spec leaves the way Esc does: the document
    // let go of the screen, with no press of the control.
    await fill.click()
    await expect(leave).toBeVisible()
    await page.evaluate(() => document.exitFullscreen())
    await expect(fill).toBeVisible()
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true)
  })

test('a browser that cannot give an element the screen is offered no control for it',
  async ({ page, request }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false })
    })
    await opened(page, request, async () => {})

    // A key answered is a Reading mounted, which is when the control is decided.
    await page.keyboard.press('Space')
    await expect(shot(page)).toHaveText('She steps out.')
    await expect(page.getByRole('button', { name: 'Full Screen' })).toHaveCount(0)
  })

/** The Sample's diagram of a Scene, sixteen hundred by nine hundred, as `layout-played.spec.ts` uses it. */
const A_LANDSCAPE = readFileSync(new URL('../../demonstration/images/a-scene.webp', import.meta.url))

test('in the whole screen a full Shot covers it, an inset one stands in the column, and the Exits are reached',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await opened(page, request, async (_, scenes) => {
      const [street] = scenes
      await request.patch(`/api/scenes/${street!.id}`, { data: { layout: 'full' } })
      for (const { id } of street!.shots) {
        await request.put(`/api/shots/${id}/image`, { data: A_LANDSCAPE })
      }
    })

    const root = page.locator('.reading')
    const frame = page.locator('.frame')
    await expect(frame.locator('img')).toBeVisible()
    await page.getByRole('button', { name: 'Full Screen', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Leave Full Screen' })).toBeVisible()

    // The Reading is the screen, in the room's colour.
    expect(await root.boundingBox()).toEqual({ x: 0, y: 0, width: 1280, height: 800 })
    await expect(root).toHaveCSS('background-color', 'rgb(11, 13, 12)')

    // A full Shot from the screen's edge to its edge and from its head down to
    // the press under it, which is on the screen too.
    const covering = (await frame.boundingBox())!
    expect([Math.round(covering.x), Math.round(covering.y), Math.round(covering.width)])
      .toEqual([0, 0, 1280])
    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeInViewport({ ratio: 1 })

    // At the end of the run, the first way on is a Tab from the frame.
    await page.keyboard.press('Space')
    await page.keyboard.press('Space')
    const way = page.getByRole('button', { name: 'Follow her out' })
    await expect(way).toBeVisible()
    await frame.focus()
    await page.keyboard.press('Tab')
    await expect(way).toBeFocused()
    await expect(way).toBeInViewport({ ratio: 1 })

    // An inset Shot stands in the reading column, centred across the screen and
    // down it rather than hung from its head.
    await page.keyboard.press('Enter')
    await expect(shot(page)).toHaveText('Smoke, and no one she knows.')
    const standing = (await frame.boundingBox())!
    expect(standing.width).toBe(736)
    expect(Math.abs(standing.x + standing.width / 2 - 640)).toBeLessThanOrEqual(1)
    expect(standing.y).toBeGreaterThan(0)
  })
