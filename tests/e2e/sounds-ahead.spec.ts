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
 * with `A_SOUND` and the Bar heard under a Sound of its own, and behind the Bar a
 * back room of one Shot heard under the Bar's Sound, published; and the address
 * the strike and the Bar's Sound are served at to a Reader.
 */
async function sounded(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
  const room = await (await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The back room' } })).json()
  const last = await (await request.post(`/api/scenes/${room.id}/shots`)).json()
  await request.patch(`/api/shots/${last.id}`, { data: { text: 'The same din, through a wall.', description: '' } })
  const through = await (await request.post(`/api/scenes/${scenes[1]!.id}/exits`, { data: { toSceneId: room.id } })).json()
  await request.patch(`/api/exits/${through.id}`, { data: { text: 'Go through' } })

  const shots = [...scenes.flatMap(scene => scene.shots.map(shot => shot.id)), last.id]
  for (const [at, id] of shots.entries()) await request.put(`/api/shots/${id}/image`, { data: IMAGES[at % 3] })
  await request.put(`/api/shots/${shots[1]}/sound`, { data: A_SOUND })
  await request.put(`/api/scenes/${scenes[1]!.id}/sound`, { data: ANOTHER_SOUND })
  // Named once the Bar has a Sound to be heard under.
  expect((await request.patch(`/api/scenes/${room.id}`, { data: { soundOfSceneId: scenes[1]!.id } })).ok()).toBe(true)

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
 * delay `delay` gives it — told how many times that address was asked for before
 * — the `refused` one with a failure. Every request to the door is written down,
 * and so is every frame put on screen, every `playing` either element fires and
 * every source either is given, each with when. The silence the strike plays as
 * the Reading opens the audio output is not one of the Story's Sounds, and is
 * left out.
 */
async function slowed(
  browser: Browser,
  baseURL: string | undefined,
  delay: (address: string, before: number) => number,
  refused?: string,
) {
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const page = await context.newPage()

  await page.addInitScript(() => {
    const framed: { text: string, at: number }[] = []
    const heard: { sound: string, src: string, at: number }[] = []
    const loaded: { sound: string, src: string }[] = []
    Object.assign(window, { framed, heard, loaded })
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
      if (element.currentSrc.startsWith('data:')) return
      heard.push({ sound: element.dataset.sound ?? '', src: element.currentSrc, at: performance.now() })
    }, true)
    document.addEventListener('loadstart', (event) => {
      const element = event.target as HTMLAudioElement
      if (element.currentSrc.startsWith('data:')) return
      loaded.push({ sound: element.dataset.sound ?? '', src: element.currentSrc })
    }, true)
  })

  const asked: string[] = []
  page.on('request', (sent) => {
    const { pathname } = new URL(sent.url())
    if (pathname.includes('/media/')) asked.push(pathname)
  })
  await page.route('**/api/read/*/media/*', async (route) => {
    const address = new URL(route.request().url()).pathname
    const before = asked.filter(one => one === address).length - 1
    await new Promise(done => setTimeout(done, delay(address, before)))
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

/** How many times the element `sound` names was given a source to load. */
function loads(page: Page, sound: 'shot' | 'scene') {
  return page.evaluate(sound =>
    (window as unknown as { loaded: { sound: string }[] }).loaded.filter(one => one.sound === sound).length, sound)
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

    // Played from the bytes the Reading holds, as the frame lands. The first Sound
    // this page plays, and held to the same 150 ms as every other: the audio
    // output was opened by the press on *Begin*.
    await expect(page.locator('[data-sound="shot"]')).toHaveAttribute('src', /^blob:/)
    await expect.poll(() => heardAfter(page, 'She steps out.', 'shot')).toBeLessThanOrEqual(150)

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

/**
 * From the Street's first beat across into the Bar, each press made once the beat
 * it asked for has landed, since a press made while a move is held does nothing.
 * The way out is taken once `ready` says so.
 */
async function toTheBar(page: Page, ready: () => boolean = () => true) {
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.locator('.frame').getByText('She steps out.')).toBeVisible({ timeout: LANDS_WITHIN })
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  await expect.poll(ready).toBe(true)
  await page.getByRole('button', { name: 'Follow her out' }).click()
}

test('a Reading picked up asks for nothing its opening would have needed', async ({ browser, baseURL, request }) => {
  const { story, strike, bed } = await sounded(request)
  const { page, asked, done } = await slowed(browser, baseURL, () => 1500)

  await page.goto(`/read/${story.id}`)
  await begin(page)
  await toTheBar(page)
  await expect(page.locator('.frame').getByText('Smoke, and no one she knows.')).toBeVisible({ timeout: LANDS_WITHIN })
  await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()

  // Picked up again in a page of its own, standing in the Bar, where the strike
  // of the Street's second beat is neither played nor needed next.
  // The press waits until the card has brought the Bar's Sound in, as a Reader
  // who has read the card has.
  asked.length = 0
  const bedIn = page.waitForResponse(response => new URL(response.url()).pathname === bed)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  await bedIn
  await begin(page)
  await expect(page.locator('.frame').getByText('Smoke, and no one she knows.')).toBeVisible()
  await expect(page.locator('[data-sound="scene"]')).toHaveAttribute('src', /^blob:/)

  // What the Bar plays and needs next is asked for, once, and the strike the
  // opening would have needed never is.
  await expect.poll(() => asked.filter(address => address !== bed).length).toBeGreaterThan(0)
  await page.waitForTimeout(500)
  expect(asked.filter(address => address === bed).length).toBe(1)
  expect(asked).not.toContain(strike)

  await done()
})

test('a Scene heard under the Sound already playing neither asks for it again nor restarts it',
  async ({ browser, baseURL, request }) => {
    const { story, bed } = await sounded(request)
    // The Bar's Sound brought in ahead never arrives, so the move into the Bar
    // lands at the ceiling and its bed plays from its address, which answers.
    const { page, asked, done } = await slowed(browser, baseURL, (address, before) =>
      (address === bed && before === 0 ? 60_000 : 1500))

    await page.goto(`/read/${story.id}`)
    await begin(page)
    await toTheBar(page, () => asked.includes(bed))
    await expect(page.locator('.frame').getByText('Smoke, and no one she knows.'))
      .toBeVisible({ timeout: LANDS_WITHIN + 2000 })
    await expect(page.locator('[data-sound="scene"]')).toHaveAttribute('src', bed)
    await expect.poll(() => plays(page, 'scene')).toBe(1)
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Go through' })).toBeVisible({ timeout: 1000 })

    // The bed playing is the one the back room is heard under: the crossing waits
    // on nothing of it, asks for it again nowhere, and leaves it playing.
    const askedBefore = asked.filter(address => address === bed).length
    const loadsBefore = await loads(page, 'scene')
    await page.getByRole('button', { name: 'Go through' }).click()
    await expect(page.locator('.frame').getByText('The same din, through a wall.')).toBeVisible({ timeout: 1000 })
    await page.waitForTimeout(500)
    expect(asked.filter(address => address === bed).length).toBe(askedBefore)
    expect(await loads(page, 'scene')).toBe(loadsBefore)
    expect(await plays(page, 'scene')).toBe(1)
    await expect(page.locator('[data-sound="scene"]')).toHaveAttribute('src', bed)

    await done()
  })
