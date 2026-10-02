import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'
import type { StoryAtItsLink } from '../../shared/utils/reading'
import { LANDS_WITHIN } from '../../app/utils/brought'
import { A_SOUND, begin, seedPublished, test, writeStory } from './author'

/**
 * A Shot's Sound strikes as its beat lands, and a Scene is heard from its first
 * beat: the Reading brings its Sounds in with its Images, holds them as bytes
 * in the document, and a move waits on them while sound is on. See
 * `docs/adr/0073-a-beat-lands-when-its-image-can-be-shown.md`.
 *
 * `localhost` hides all of it, so the media door is slowed by hand, as
 * `images-ahead.spec.ts` slows it, and the Story is read as a stranger.
 */

const IMAGES = ['a-scene', 'an-image', 'a-gap'].map(name =>
  readFileSync(new URL(`../../demonstration/images/${name}.webp`, import.meta.url)))

/** `A_SOUND` with an ID3v1 tag after its frames: the same silence, bytes of its own, so an address of its own. */
const ANOTHER_SOUND = Buffer.concat([A_SOUND, Buffer.from('TAG'.padEnd(128, '\0'))])

/**
 * `writeStory`'s three Shots, each given an Image of its own, the second struck
 * with `A_SOUND` and the Bar heard under a Sound of its own, published; and the
 * address the strike and the Bar's Sound are served at to a Reader.
 */
async function sounded(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
  const shots = scenes.flatMap(scene => scene.shots.map(shot => shot.id))
  for (const [at, id] of shots.entries()) await request.put(`/api/shots/${id}/image`, { data: IMAGES[at] })
  await request.put(`/api/shots/${shots[1]}/sound`, { data: A_SOUND })
  await request.put(`/api/scenes/${scenes[1]!.id}/sound`, { data: ANOTHER_SOUND })

  await seedPublished(story)
  const read = await (await request.get(`/api/read/${story.id}`)).json() as StoryAtItsLink

  return {
    story,
    strike: read.scenes.flatMap(scene => scene.shots).find(shot => shot.id === shots[1])!.sound!,
    bed: read.scenes.find(scene => scene.id === scenes[1]!.id)!.sound!,
  }
}

/**
 * A page nobody is signed in on, whose media door answers each address after the
 * delay `delay` gives it, the `refused` one with a failure. Every request to the
 * door is written down, and so is every frame put on screen and every `playing`
 * either element fires, each with when.
 */
async function slowed(
  browser: Browser,
  baseURL: string | undefined,
  delay: (address: string) => number,
  refused?: string,
) {
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const page = await context.newPage()

  await page.addInitScript(() => {
    const framed: { text: string, at: number }[] = []
    const heard: { sound: string, src: string, at: number }[] = []
    Object.assign(window, { framed, heard })
    new MutationObserver((records) => {
      for (const node of records.flatMap(record => [...record.addedNodes])) {
        if (!(node instanceof Element)) continue
        for (const frame of node.matches('.frame') ? [node] : [...node.querySelectorAll('.frame')]) {
          framed.push({ text: frame.textContent ?? '', at: performance.now() })
        }
      }
    }).observe(document, { childList: true, subtree: true })
    // Media events do not bubble, so they are caught on the way down instead.
    document.addEventListener('playing', (event) => {
      const element = event.target as HTMLAudioElement
      heard.push({ sound: element.dataset.sound ?? '', src: element.currentSrc, at: performance.now() })
    }, true)
  })

  const asked: string[] = []
  page.on('request', (sent) => {
    const { pathname } = new URL(sent.url())
    if (pathname.includes('/media/')) asked.push(pathname)
  })
  await page.route('**/api/read/*/media/*', async (route) => {
    const address = new URL(route.request().url()).pathname
    await new Promise(done => setTimeout(done, delay(address)))
    if (address === refused) return route.abort()
    await route.fulfill({ response: await route.fetch() })
  })

  // Closed with a response still being held back, which the route lets go of quietly.
  const done = async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await context.close()
  }

  return { page, asked, done }
}

/**
 * How long after the last frame saying `text` went in the element `sound` names
 * fired `playing`, and Infinity while it has not.
 */
function heardAfter(page: Page, text: string, sound: 'shot' | 'scene') {
  return page.evaluate(({ text, sound }) => {
    const { framed, heard } = window as unknown as {
      framed: { text: string, at: number }[]
      heard: { sound: string, src: string, at: number }[]
    }
    const frame = framed.filter(one => one.text.includes(text)).at(-1)
    const play = frame && heard.find(one => one.sound === sound && one.at >= frame.at)
    return play ? play.at - frame!.at : Infinity
  }, { text, sound })
}

/** How many times the element `sound` names has fired `playing`. */
function plays(page: Page, sound: 'shot' | 'scene') {
  return page.evaluate(sound =>
    (window as unknown as { heard: { sound: string }[] }).heard.filter(one => one.sound === sound).length, sound)
}

test('a Shot strikes as its beat lands, and a Scene is heard from its first beat',
  async ({ browser, baseURL, request }) => {
    const { story, strike, bed } = await sounded(request)
    const { page, asked, done } = await slowed(browser, baseURL, () => 1500)

    await page.goto(`/read/${story.id}`)
    await begin(page)
    await expect(page.locator('.frame').getByText('A door opens.')).toBeVisible()

    // The strike of the next beat is asked for before anybody presses for it.
    await expect.poll(() => asked.includes(strike)).toBe(true)
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.locator('.frame').getByText('She steps out.')).toBeVisible({ timeout: LANDS_WITHIN })

    // Played from the bytes the Reading holds, as the frame lands: sooner than the
    // door could have answered for them. Not held to the 150 ms below, because the
    // first Sound a page plays waits on Chromium opening its audio output — about
    // 100 ms on a quiet machine and twice that under load, whatever the bytes — and
    // the same strike played again after the step back is.
    await expect(page.locator('[data-sound="shot"]')).toHaveAttribute('src', /^blob:/)
    await expect.poll(() => heardAfter(page, 'She steps out.', 'shot')).toBeLessThan(1500)

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect.poll(() => asked.includes(bed)).toBe(true)
    await page.getByRole('button', { name: 'Follow her out' }).click()
    await expect(page.locator('.frame').getByText('Smoke, and no one she knows.')).toBeVisible({ timeout: LANDS_WITHIN })

    await expect(page.locator('[data-sound="scene"]')).toHaveAttribute('src', /^blob:/)
    await expect.poll(() => heardAfter(page, 'Smoke, and no one she knows.', 'scene')).toBeLessThanOrEqual(150)

    // Stepping back onto the beat strikes it again, from bytes the Reading holds.
    const askedBefore = asked.filter(address => address === strike).length
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()
    await expect.poll(() => plays(page, 'shot')).toBe(2)
    await expect(page.locator('[data-sound="shot"]')).toHaveAttribute('src', /^blob:/)
    expect(await heardAfter(page, 'She steps out.', 'shot')).toBeLessThanOrEqual(150)
    expect(asked.filter(address => address === strike).length).toBe(askedBefore)

    await done()
  })

test('with sound off, a beat is never held for its Sound', async ({ browser, baseURL, request }) => {
  const { story, strike } = await sounded(request)
  const { page, done } = await slowed(browser, baseURL, address => (address === strike ? 10_000 : 1500))

  await page.goto(`/read/${story.id}`)
  await begin(page)
  await page.getByRole('button', { name: 'Turn the Sound Off' }).click()
  await page.getByRole('button', { name: 'Next Shot' }).click()

  // Its Image is in a second and a half after the Reading asked; its Sound not for ten.
  await expect(page.locator('.frame').getByText('She steps out.')).toBeVisible({ timeout: 5000 })

  await done()
})

test('a beat whose Sound fails to arrive still lands', async ({ browser, baseURL, request }) => {
  const { story, strike } = await sounded(request)
  // Failed after three seconds, past its Image, so the press below is held, and let go by the failure.
  const { page, done } = await slowed(browser, baseURL, address => (address === strike ? 3000 : 1500), strike)

  await page.goto(`/read/${story.id}`)
  await begin(page)
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('The next Shot is on its way.')).toBeVisible()
  await expect(page.locator('.frame').getByText('She steps out.')).toBeVisible({ timeout: LANDS_WITHIN })

  await done()
})
