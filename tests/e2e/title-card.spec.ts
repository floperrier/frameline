import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { begin, forgetName, live, seedPublished, test, writeStory } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * Every Story opens on its title card: the Cover drawn wide, the title, the
 * Synopsis and the Author's Name, and one press to begin it. The press is what
 * starts the Reading, so the opening beat's arrival and its clock are spent under
 * the Reader's eyes, and it brings the Reading's head to the window's head, so the
 * first beat fits the window with its words and its press. See
 * `docs/adr/0063-a-story-opens-on-its-title-card.md`.
 *
 * The Image is the Sample's diagram of a Scene, sixteen hundred by nine hundred,
 * for the reason `layout-played.spec.ts` gives: a full beat is a claim about how a
 * landscape Image meets a window.
 */
const A_LANDSCAPE = readFileSync(new URL('../../demonstration/images/a-scene.webp', import.meta.url))

/** The phone held upright and the wide desk, the two windows a first beat must fit. */
const WINDOWS = [{ width: 390, height: 844 }, { width: 1440, height: 900 }]

/**
 * `writeStory`'s Story the way *Reel Change* opens: its street laid out full, its
 * first Shot an Image under words, and a Synopsis written. Published past the API
 * and opened at its public link, live, with nothing pressed yet.
 */
async function reelChange(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
  const [street] = scenes
  await request.patch(`/api/scenes/${street!.id}`, { data: { layout: 'full' } })
  await request.put(`/api/shots/${street!.shots[0]!.id}/image`, { data: A_LANDSCAPE })
  await request.patch(`/api/stories/${story.id}`, {
    data: { synopsis: 'A door, a street,\nand a bar where nobody knows her.' },
  })
  await request.post(`/api/scenes/${street!.id}/opening`)
  await seedPublished(story)

  await page.goto(`/read/${story.id}`)
  await live(page)

  return { story, scenes }
}

for (const window of WINDOWS) {
  test(`a Story opens on its title card, and begun, its first beat fits a ${window.width} × ${window.height} window`,
    async ({ page, request, author }) => {
      await page.setViewportSize(window)
      await reelChange(page, request)

      // Nothing of the Reading before the press: no frame, no way on, no clock.
      await expect(page.locator('.reading')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Next Shot' })).toHaveCount(0)

      // The card, in the order it is read: the Cover as wide as the column and
      // cropped to sixteen by nine, the eyebrow, the title and the Synopsis in the
      // Story's Language, the Author's Name, the press, and Favourite under it.
      const header = page.locator('main > header')
      const cover = header.locator('img.cover')
      const synopsis = header.locator('.synopsis')
      const by = header.getByRole('link', { name: author.name! })
      const press = header.getByRole('button', { name: 'Begin', exact: true })
      await expect(cover).toHaveAttribute('alt', '')
      await expect(header.locator('h1')).toHaveAttribute('lang', 'en')
      await expect(synopsis).toHaveText('A door, a street,\nand a bar where nobody knows her.')
      await expect(synopsis).toHaveAttribute('lang', 'en')
      await expect(by).toHaveAttribute('href', `/profile/${author.id}`)
      await expect(press).toHaveClass(/\bprimary\b/)

      const column = (await header.boundingBox())!
      const drawn = (await cover.boundingBox())!
      expect(Math.abs(drawn.width - column.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(drawn.height - drawn.width * 9 / 16)).toBeLessThanOrEqual(1)

      const order = [cover, header.locator('.eyebrow').first(), header.locator('h1'), synopsis, by, press,
        header.locator('.away')]
      const heads = []
      for (const one of order) heads.push((await one.boundingBox())!.y)
      expect(heads).toEqual([...heads].sort((a, b) => a - b))

      // The Name signs the card, and the line under the Reading only leads on.
      await expect(page.locator('.onward').getByRole('link')).toHaveText(['Find Stories in the Catalogue'])

      // Begun by the keyboard: the Reading's head is the window's head, and the
      // first beat's words and its press are in the window with the frame focused.
      await press.focus()
      await page.keyboard.press('Enter')
      const reading = page.locator('.reading')
      await expect(reading).toBeVisible()
      expect(Math.abs((await reading.boundingBox())!.y)).toBeLessThanOrEqual(1)
      await expect(page.locator('.frame')).toBeFocused()
      await expect(page.getByText('A door opens.')).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('button', { name: 'Next Shot' })).toBeInViewport({ ratio: 1 })
    })
}

test('a Story with no Image, no Synopsis and no Name is presented by its words alone',
  async ({ page, request, author }) => {
    const story = await writeStory(request)
    const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
    await request.post(`/api/scenes/${scenes[0]!.id}/opening`)
    await seedPublished(story)
    await forgetName(author)

    await page.goto(`/read/${story.id}`)
    await live(page)

    const header = page.locator('main > header')
    await expect(header.locator('h1')).toHaveText('A Story')
    await expect(header.locator('img')).toHaveCount(0)
    await expect(header.locator('.synopsis')).toHaveCount(0)
    await expect(header.getByText('By', { exact: true })).toHaveCount(0)

    // Begun by the pointer, and the Reading is there as it is for any Story.
    await header.getByRole('button', { name: 'Begin', exact: true }).click()
    await expect(page.getByText('A door opens.')).toBeVisible()
  })

test('an opening Scene cut by the clock starts its clock at the press', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
  await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 1000 } })
  await request.post(`/api/scenes/${scenes[0]!.id}/opening`)
  await seedPublished(story)

  await page.goto(`/read/${story.id}`)
  await live(page)

  // Twice the hold, spent on the card: the clock is not running yet.
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Begin', exact: true }).press('Space')

  await expect(page.locator('.frame .shot')).toHaveText('A door opens.')
  await expect(page.getByText('She steps out.')).toBeVisible()
})

test('Resume lands on the kept beat with the Reading\'s head at the window\'s head', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await reelChange(page, request)
  await begin(page)
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('She steps out.')).toBeVisible()

  await page.reload()
  await live(page)
  await expect(page.locator('.reading')).toHaveCount(0)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()

  await expect(page.getByText('She steps out.')).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('status').filter({ hasText: 'Picked up where you left off.' })).toBeVisible()
  expect(Math.abs((await page.locator('.reading').boundingBox())!.y)).toBeLessThanOrEqual(1)
})
