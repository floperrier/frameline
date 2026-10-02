import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'
import type { StoryAtItsLink } from '../../shared/utils/reading'
import { LANDS_WITHIN } from '../../app/utils/brought'
import { begin, seedPublished, test, writeStory } from './author'

/**
 * A beat lands when its Image can be shown: the Reading brings in the Images it
 * is about to need before it needs them, and a move whose Image is not in yet
 * holds the beat leaving on screen until it is. See
 * `docs/adr/0073-a-beat-lands-when-its-image-can-be-shown.md`.
 *
 * `localhost` hides all of it, so the media door is slowed by hand: every Image a
 * Reader is served arrives a second and a half after it is asked for, the time
 * the Sample's Images took on an ordinary 4G. Read as a stranger, through the
 * Reader's own door, so what is proved is what somebody handed the link meets.
 */

const IMAGES = ['a-scene', 'an-image', 'a-gap'].map(name =>
  readFileSync(new URL(`../../demonstration/images/${name}.webp`, import.meta.url)))

/**
 * `writeStory`'s three Shots, each given an Image of its own, the Story changed as
 * the caller says and published; and the address each Image is served at to a
 * Reader, in the order the Shots are read.
 */
async function pictured(request: APIRequestContext, change: (shots: string[]) => Promise<void> = async () => {}) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
  const shots = scenes.flatMap(scene => scene.shots.map(shot => shot.id))
  for (const [at, id] of shots.entries()) await request.put(`/api/shots/${id}/image`, { data: IMAGES[at] })

  await change(shots)
  await seedPublished(story)
  const read = await (await request.get(`/api/read/${story.id}`)).json() as StoryAtItsLink
  const served = read.scenes.flatMap(scene => scene.shots)

  return { story, images: shots.map(id => served.find(shot => shot.id === id)!.image!) }
}

/**
 * A page nobody is signed in on, whose media door answers each address after the
 * delay `delay` gives it, the `refused` one with a failure. Every request for an Image is written down,
 * and so is every `<img>` put into the frame as it was the moment it went in:
 * whether it could be shown, complete and holding pixels, and when.
 */
async function slowed(
  browser: Browser,
  baseURL: string | undefined,
  delay: (image: string) => number,
  refused?: string,
) {
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const page = await context.newPage()

  await page.addInitScript(() => {
    const inserted: { src: string | null, shown: boolean, at: number }[] = []
    Object.assign(window, { inserted })
    new MutationObserver((records) => {
      for (const node of records.flatMap(record => [...record.addedNodes])) {
        if (!(node instanceof Element)) continue
        const images = node.matches('.frame img') ? [node] : [...node.querySelectorAll('.frame img')]
        for (const image of images as HTMLImageElement[]) {
          inserted.push({
            src: image.getAttribute('src'),
            shown: image.complete && image.naturalWidth > 0,
            at: performance.now(),
          })
        }
      }
    }).observe(document, { childList: true, subtree: true })
  })

  const asked: string[] = []
  page.on('request', (sent) => {
    const { pathname } = new URL(sent.url())
    if (pathname.includes('/media/')) asked.push(pathname)
  })
  await page.route('**/api/read/*/media/*', async (route) => {
    const image = new URL(route.request().url()).pathname
    await new Promise(done => setTimeout(done, delay(image)))
    if (image === refused) return route.abort()
    await route.fulfill({ response: await route.fetch() })
  })

  // Closed with an Image still being held back, which the route lets go of quietly.
  const done = async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await context.close()
  }

  return { page, asked, done }
}

function inserted(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { inserted: { src: string | null, shown: boolean, at: number }[] }).inserted)
}

test('every beat lands with its Image, brought in before the Reader asks for it',
  async ({ browser, baseURL, request }) => {
    const { story, images: [door, out, smoke] } = await pictured(request, async ([first]) => {
      // Cut by the clock after a second, which is sooner than the next Image arrives.
      await request.patch(`/api/shots/${first}`, { data: { cutAfter: 1000 } })
    })
    // The Bar's Image takes longer still, so the hold on it is long enough to be seen.
    const { page, asked, done } = await slowed(browser, baseURL, image => (image === smoke ? 3000 : 1500))

    await page.goto(`/read/${story.id}`)
    await begin(page)
    await expect(page.getByText('She steps out.')).toBeVisible()

    // The last beat of the run is on screen: what lies behind the way on is asked
    // for before anybody presses for it.
    await expect.poll(() => asked.includes(smoke!)).toBe(true)
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Follow her out' }).click()

    // Pressed before it arrived, the move is held, and past half a second it says so.
    await expect(page.getByText('The next Shot is on its way.')).toBeVisible()
    await expect(page.locator('.frame[aria-busy="true"]')).toBeVisible()
    await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible({ timeout: LANDS_WITHIN })
    await expect(page.getByText('The next Shot is on its way.')).toHaveCount(0)
    await expect(page.locator('.frame[aria-busy]')).toHaveCount(0)

    // Stepping back lands on Images the Reading already holds, and asks for none again.
    const askedBefore = asked.filter(image => image === door || image === out).length
    for (const landing of ['She steps out.', 'She steps out.', 'A door opens.']) {
      await page.getByRole('button', { name: 'Step Back' }).click()
      await expect(page.locator('.frame').getByText(landing)).toBeVisible()
    }
    expect(asked.filter(image => image === door || image === out).length).toBe(askedBefore)

    // No frame went in waiting on its bytes, and the second the first Shot is cut
    // after was counted from its Image being on screen.
    const drawn = await inserted(page)
    expect(drawn.map(one => one.src)).toEqual(expect.arrayContaining([door, out, smoke]))
    expect(drawn.filter(one => !one.shown)).toEqual([])
    const shownAt = (image: string) => drawn.find(one => one.src === image)!.at
    expect(shownAt(out!) - shownAt(door!)).toBeGreaterThanOrEqual(1000)

    await done()
  })

test('a beat whose Image fails to arrive still lands', async ({ browser, baseURL, request }) => {
  const { story, images: [, out] } = await pictured(request)
  // Failed after the same second and a half, so the press below is held, and let go by the failure.
  const { page, done } = await slowed(browser, baseURL, () => 1500, out)

  await page.goto(`/read/${story.id}`)
  await begin(page)
  await expect(page.getByText('A door opens.')).toBeVisible()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('She steps out.')).toBeVisible({ timeout: LANDS_WITHIN })

  await done()
})
