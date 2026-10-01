import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { begin, opened, readTheStory, test, writeStory } from './author'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The Layout read where it is obeyed: what a Shot carries decides whether it is
 * drawn as a picture, a card or both, and its Layout whether it stands in the
 * reading column or covers the room. Read through the Reader's own door on a
 * Story published past the API, as `cut-played.spec.ts` reads the Cut, and on
 * the bench's Preview where the room is a pane rather than the window.
 *
 * The Image is a real one, the Sample's diagram of a Scene, sixteen hundred by
 * nine hundred: a single pixel has no shape for a crop to cut, and a frame that
 * covers the room is a claim about how a landscape Image meets a window held
 * upright.
 */
const A_LANDSCAPE = readFileSync(new URL('../../demonstration/images/a-scene.webp', import.meta.url))

/** The phone held upright and the wide desk, the two windows every claim is read at. */
const WINDOWS = [{ width: 390, height: 844 }, { width: 1440, height: 900 }]

/** Gives a Shot an Image, and whatever else the caller says of it. */
async function shoot(request: APIRequestContext, shotId: string, data: Record<string, unknown> = {}) {
  await request.put(`/api/shots/${shotId}/image`, { data: A_LANDSCAPE })
  if (Object.keys(data).length) await request.patch(`/api/shots/${shotId}`, { data })
}

/** A box on screen, read as the numbers a claim about widths compares. */
async function box(what: Locator) {
  return (await what.boundingBox())!
}

/**
 * `writeStory`'s Story with its street laid out full and both of its Shots
 * carrying the Image, the first cropped off its centre, and its bar a card: the
 * shape every claim about `full` below is read on.
 */
async function fullStreet(request: APIRequestContext, story: { id: string }, scenes: StoryInEditor['scenes']) {
  const [street] = scenes
  await request.patch(`/api/scenes/${street!.id}`, { data: { layout: 'full' } })
  await shoot(request, street!.shots[0]!.id, { cropX: 84, cropY: 49 })
  await shoot(request, street!.shots[1]!.id)

  return story
}

test('a Shot is drawn as what it carries: the Image alone, the text alone as a card',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      const [street] = scenes
      // An Image and no words, and an Image under words that are only white
      // space, which is no words either. The bar's one Shot keeps its text and
      // carries no Image.
      await shoot(request, street!.shots[0]!.id, { text: '' })
      await shoot(request, street!.shots[1]!.id, { text: ' \n ' })
    })

    const frame = page.locator('.frame')

    // The Image is the whole beat, with no band under it and no hairline
    // separating it from nothing.
    await expect(frame.locator('img')).toBeVisible()
    await expect(frame.locator('figcaption')).toHaveCount(0)
    await expect(frame.locator('.picture')).toHaveCSS('border-bottom-width', '0px')

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(frame.locator('img')).toBeVisible()
    await expect(frame.locator('figcaption')).toHaveCount(0)

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Follow her out' }).click()

    // The words alone are a card, and a card inset stands at sixteen by nine.
    await expect(frame.locator('.shot')).toHaveText('Smoke, and no one she knows.')
    await expect(frame.locator('img')).toHaveCount(0)
    const card = await box(frame)
    expect(card.height).toBeGreaterThanOrEqual(card.width * 9 / 16 - 1)
  })

test('a Story with no full Shot is drawn at the widths it always had',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await opened(page, request, async (_, scenes) => {
      await shoot(request, scenes[0]!.shots[0]!.id)
    })

    const frame = page.locator('.frame')
    await expect(frame.locator('img')).toBeVisible()

    // The column is 46rem, centred in the window, and an Image under words keeps
    // the hairline between the two.
    const column = await box(frame)
    expect(column.width).toBe(736)
    expect(Math.abs(column.x + column.width / 2 - 720)).toBeLessThanOrEqual(1)
    await expect(frame.locator('.picture')).toHaveCSS('border-bottom-width', '1px')

    // *Next Shot* stands where it stood, at the leading edge of the column and as
    // wide as its own name.
    const next = await box(page.getByRole('button', { name: 'Next Shot' }))
    expect(Math.abs(next.x - column.x)).toBeLessThanOrEqual(1)
    expect(next.width).toBeLessThan(column.width / 2)

    // And the ways on and the trail under them are the column's width.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()
    for (const under of [page.locator('.exits'), page.locator('.back')]) {
      const held = await box(under)
      expect([Math.round(held.x), Math.round(held.width)])
        .toEqual([Math.round(column.x), column.width])
    }
  })

test('a word too long for a phone widens the column rather than lose its end',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/shots/${scenes[0]!.shots[0]!.id}`, {
        data: { text: `A ${'Pneumonoultramicroscopicsilicovolcanoconiosis'.slice(0, 42)}` },
      })
    })

    // The frame clips what overflows it, so a word wider than the column has to
    // make the column wider: the page scrolls sideways, and every letter is read.
    const words = page.locator('.frame .shot')
    await expect(words).toContainText('Pneumono')
    const [ends, edge] = await words.evaluate((shot) => {
      const frame = shot.closest('.frame')!.getBoundingClientRect()
      return [shot.getBoundingClientRect().left + shot.scrollWidth, frame.right]
    })
    expect(ends).toBeLessThanOrEqual(edge)
  })

for (const window of WINDOWS) {
  test(`a full Shot covers the room at ${window.width} by ${window.height}, and the press is always in the window`,
    async ({ page, request }) => {
      await page.setViewportSize(window)
      await opened(page, request, async (story, scenes) => {
        await fullStreet(request, story, scenes)
      })

      const frame = page.locator('.frame')
      const image = frame.locator('img')
      await expect(image).toBeVisible()

      // Edge to edge, the Image covering it around the point the Author pressed.
      expect(Math.abs((await box(frame)).width - window.width)).toBeLessThanOrEqual(1)
      await expect(image).toHaveCSS('object-fit', 'cover')
      await expect(image).toHaveCSS('object-position', '84% 49%')

      // The Story carries no Sound, so there is no title card to press: the
      // first press is the one that asks for the next beat, and it lands the
      // Reader on it with the press under it in the window.
      const next = page.getByRole('button', { name: 'Next Shot' })
      await next.click()
      await expect(frame.locator('.shot')).toHaveText('She steps out.')
      expect(Math.abs((await box(frame)).width - window.width)).toBeLessThanOrEqual(1)
      await expect(next).toBeInViewport({ ratio: 1 })

      // The words lie over the Image and not under it: what the window shows at
      // the middle of the sentence is the sentence.
      expect(await frame.locator('.shot').evaluate((words) => {
        const { x, y, width, height } = words.getBoundingClientRect()
        return words.contains(document.elementFromPoint(x + width / 2, y + height / 2))
      })).toBe(true)

      // At the end of the run the frame gives the ways on the lines they need.
      await next.click()
      const ways = page.locator('.exits .splice')
      await expect(ways).toHaveCount(1)
      for (const way of await ways.all()) await expect(way).toBeInViewport({ ratio: 1 })
    })
}

/**
 * The colour a screenshot of an element shows at a point inside it, read by the
 * browser itself so the suite needs no decoder of its own.
 */
async function colourAt(page: Page, what: Locator, x: number, y: number) {
  const png = (await what.screenshot()).toString('base64')

  return await page.evaluate(async ({ png, x, y }) => {
    const bytes = Uint8Array.from(atob(png), letter => letter.charCodeAt(0))
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(image.width, image.height)
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)

    return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]
  }, { png, x, y })
}

test('the ring a keyboard Reader lands on is drawn over a full Image, not under it',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await opened(page, request, async (story, scenes) => {
      await fullStreet(request, story, scenes)
    })

    const frame = page.locator('.frame')
    await expect(frame.locator('img')).toBeVisible()
    await page.getByRole('button', { name: 'Next Shot' }).press('Enter')
    await expect(frame.locator('.shot')).toHaveText('She steps out.')
    await expect(frame.locator('img')).toBeVisible()
    expect(await frame.evaluate(one => one.matches(':focus-visible'))).toBe(true)

    // The ring is two pixels of `--light` drawn four inside the frame's edge, so
    // three pixels in, halfway along the top, is the ring and not the Image.
    const { width } = await box(frame)
    const [red, green, blue] = await colourAt(page, frame, Math.round(width / 2), 3)
    const far = Math.max(Math.abs(red! - 0x6f), Math.abs(green! - 0xd8), Math.abs(blue! - 0xcb))
    expect(far, `the colour three pixels in is rgb(${red}, ${green}, ${blue})`).toBeLessThanOrEqual(24)
  })

test('a full Shot with a text longer than the room grows the room rather than cut a word',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await opened(page, request, async (story, scenes) => {
      await fullStreet(request, story, scenes)
      await request.patch(`/api/shots/${scenes[0]!.shots[0]!.id}`, {
        data: { text: 'The longest text a Shot may carry, written over its Image. '.repeat(40).slice(0, 2000) },
      })
    })

    const frame = page.locator('.frame')
    await expect(frame.locator('.shot')).toContainText('The longest text')

    // Every word inside the frame's box, which is still the window's width and
    // taller than the window, and the press still under it.
    expect(Math.abs((await box(frame)).width - 390)).toBeLessThanOrEqual(1)
    const sizes = await frame.evaluate(one => [one.scrollHeight, one.clientHeight])
    expect(sizes[0]).toBe(sizes[1])
    expect(sizes[1]).toBeGreaterThan(844)
    const caption = await box(frame.locator('figcaption'))
    const held = await box(frame)
    expect(caption.y + caption.height).toBeLessThanOrEqual(held.y + held.height + 0.5)

    const next = page.getByRole('button', { name: 'Next Shot' })
    await next.scrollIntoViewIfNeeded()
    await expect(next).toBeInViewport({ ratio: 1 })
  })

test('a full Image alone is still the room tall when the Reader is put back on it',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await opened(page, request, async (story, scenes) => {
      await fullStreet(request, story, scenes)
      // The second Shot is the Image and nothing in flow: no caption, no card,
      // so the frame's height is the row's alone, which is the `1fr` the
      // resumed notice would take were it to go to the notice.
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { text: '' } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.reload()
    await begin(page)

    await expect(page.getByRole('status').filter({ hasText: 'Picked up where you left off.' }))
      .toBeVisible()
    const frame = page.locator('.frame')
    await expect(frame.locator('img')).toBeVisible()
    await expect(frame.locator('figcaption')).toHaveCount(0)
    expect((await box(frame)).height).toBeGreaterThan(900 / 2)
  })

test('a passage between two Layouts keeps the beat leaving where and as large as it stood',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await opened(page, request, async (story, scenes) => {
      await fullStreet(request, story, scenes)
      // A dissolve long enough to be read while both beats are on screen: from
      // the room onto a Shot that answers inset for itself, and from there onto
      // a third laid out as its Scene says.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutOver: 3000 } })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { layout: 'inset' } })
      const third = await (await request.post(`/api/scenes/${scenes[0]!.id}/shots`)).json()
      await shoot(request, third.id, { text: 'The door swings shut.' })
    })

    const frames = page.locator('.frame')
    const leaving = page.locator('.frame.dissolve-leave-active')
    const arriving = page.locator('.frame:not(.dissolve-leave-active)')
    const next = page.getByRole('button', { name: 'Next Shot' })

    for (const width of [736, 1440]) {
      await expect(frames).toHaveCount(1, { timeout: 5000 })
      await expect(frames.locator('img')).toBeVisible()
      const stood = await box(frames)

      await next.click()
      await expect(frames).toHaveCount(2)
      const left = await box(leaving)
      expect([left.x, left.width, Math.round(left.height)])
        .toEqual([stood.x, stood.width, Math.round(stood.height)])
      expect((await box(arriving)).width).toBe(width)
    }
  })

/** Opens the bench's Preview on the first Scene of a Story, at the wide desk. */
async function previewOf(page: Page, request: APIRequestContext, full: boolean) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
  if (full) await fullStreet(request, story, scenes)
  else await shoot(request, scenes[0]!.shots[0]!.id)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
  const preview = await readTheStory(page)
  await expect(preview.locator('.frame img')).toBeVisible()

  return preview
}

test('a full Shot in the Preview is the pane\'s width, and the pane keeps its height and its bench',
  async ({ page, request }) => {
    const inset = await previewOf(page, request, false)
    const before = await box(inset)

    const preview = await previewOf(page, request, true)
    const pane = await box(preview)
    const room = await preview.evaluate(one => one.clientWidth)

    expect(Math.abs((await box(preview.locator('.frame'))).width - room)).toBeLessThanOrEqual(1)
    expect(Math.abs(pane.height - before.height)).toBeLessThanOrEqual(1)

    const bench = page.getByRole('region', { name: /On the bench/ })
    await bench.scrollIntoViewIfNeeded()
    await expect(bench).toBeInViewport()
  })
