import { readFile } from 'node:fs/promises'
import { expect, type Page, type Request } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { live, seedLong, seedStory, test } from './author'

/**
 * A change on the bench costs what it changes, not what the Story holds — issue
 * #449 and `docs/adr/0077-a-change-costs-what-it-changes.md`. The bench is measured
 * on the Sample and then on a Story of forty Scenes, in the same browser one after
 * the other, and the long Story's figure is held to four times the Sample's. A
 * ratio taken inside one test holds on a slow runner, because the runner slows both
 * sides; four rather than parity, so that a sound bench does not flake on a noisy
 * one, while the figures the issue measured — about nineteen, fifteen and thirty
 * times — still fail by a wide margin.
 *
 * Every figure is taken inside the page, from the gesture to the frame after what
 * it draws, so nothing between the test and the browser is counted on either side.
 * Nor is an Image: the long Story keeps one on every Shot, and they come in lazily
 * as the document is scrolled to the Shot pressed or the Scene added to. Counted,
 * six to eight of them landed inside the timed window and made *Add a Shot* read
 * five to seven times the Sample's in most runs, against about one and a half
 * without them. So each take is scrolled to first, and the clock starts only once
 * no Image is still on its way and every one in the window is drawn.
 */

/** The ceiling: the long Story's figure over the Sample's. */
const AT_MOST = 4

/** The door a Shot's Image comes through on the bench. */
const AN_IMAGE = /^\/api\/shots\/[^/]+\/image$/

/** How long no Image may be asked for before the window counts as settled. */
const QUIET = 300

/** The three figures, and the elements the bench draws, which are said and not held to anything. */
type Measured = { keystroke: number, press: number, add: number, elements: number }

test('a keystroke, opening a Shot and adding one cost the same at forty Scenes as in the Sample',
  async ({ page, request, author }) => {
    test.setTimeout(240_000)

    await plantSample(author.id, 'en', {
      db: drizzle(process.env.DATABASE_URL!, { schema }),
      image: name => readFile(imagePath(name)),
      sound: file => readFile(soundPath(file)),
    })
    const [sample] = await (await request.get('/api/stories')).json() as { id: string }[]
    const long = await seedStory(author, 'At Length')
    await seedLong(long, sample!)

    const short = await measure(page, sample!.id)
    const length = await measure(page, long.id)
    test.info().annotations.push({ type: 'measured', description: JSON.stringify({ short, length }) })
    console.log('measured', JSON.stringify({ short, length }))

    expect(length.keystroke / short.keystroke).toBeLessThanOrEqual(AT_MOST)
    expect(length.press / short.press).toBeLessThanOrEqual(AT_MOST)
    expect(length.add / short.add).toBeLessThanOrEqual(AT_MOST)
  })

/**
 * The three figures for one Story, each the median of several takes and each
 * taken after one that is not counted, so a chunk fetched or a function compiled
 * the first time is paid outside the figure. The Shots pressed and the Scenes
 * added to are spread down the document rather than taken at its head, where a
 * long Story and a short one look alike.
 */
async function measure(page: Page, id: string): Promise<Measured> {
  const coming = new Set<Request>()
  const asked = (sent: Request) => { if (AN_IMAGE.test(new URL(sent.url()).pathname)) coming.add(sent) }
  const ended = (sent: Request) => { coming.delete(sent) }
  page.on('request', asked)
  page.on('requestfinished', ended)
  page.on('requestfailed', ended)
  const settle = () => settled(page, coming)

  await page.goto(`/stories/${id}`)
  await live(page)
  const elements = await page.evaluate(() => document.getElementsByTagName('*').length)
  const { scenes } = await (await page.request.get(`/api/stories/${id}`)).json() as StoryInEditor
  const shots = scenes.flatMap(scene => scene.shots.map(shot => shot.id))
  const spread = <T>(of: T[], count: number) =>
    Array.from({ length: count }, (_, at) => of[Math.floor((at + 0.5) * of.length / count)]!)

  const [warm, ...pressed] = spread(shots, 7)
  await press(page, warm!, settle)
  const presses: number[] = []
  for (const shot of pressed) presses.push(await press(page, shot, settle))

  const keystroke = median(await type(page))

  const [first, ...added] = spread(scenes.map(scene => scene.id), 4)
  await add(page, first!, settle)
  const adds: number[] = []
  for (const scene of added) adds.push(await add(page, scene, settle))

  page.off('request', asked)
  page.off('requestfinished', ended)
  page.off('requestfailed', ended)

  return { keystroke, press: median(presses), add: median(adds), elements }
}

function median(taken: number[]) {
  const sorted = [...taken].sort((one, other) => one - other)
  const half = Math.floor(sorted.length / 2)

  return sorted.length % 2 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2
}

/**
 * Waits until no Image is on its way and every Image in the window is drawn, and
 * stays so for `QUIET` milliseconds: a lazy Image is asked for a frame or two after
 * it comes near the window, so one quiet look is not enough. An Image in a shut
 * fold, the Cover picker's frames among them, has a place in the window but is
 * never asked for, so only those the page shows are waited on.
 */
async function settled(page: Page, coming: Set<Request>) {
  const drawn = () => page.evaluate(() => [...document.images].every((image) => {
    const { top, bottom } = image.getBoundingClientRect()
    return bottom <= 0 || top >= innerHeight || !image.checkVisibility()
      || (image.complete && image.naturalWidth > 0)
  }))
  for (;;) {
    await expect.poll(async () => coming.size === 0 && await drawn(), { intervals: [50] }).toBe(true)
    await page.waitForTimeout(QUIET)
    if (coming.size === 0 && await drawn()) return
  }
}

/**
 * A Shot's box pressed to write it, until its editor is drawn: the press and the
 * focus it brings, as a hand gives them, and then the frame after the editor
 * stands in the box's place.
 */
async function press(page: Page, shot: string, settle: () => Promise<void>) {
  await page.evaluate((shot) => {
    document.getElementById(`shot-${shot}`)!.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, shot)
  await settle()

  return page.evaluate(async (shot) => {
    const frame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)))
    const box = document.getElementById(`shot-${shot}`)!
    await frame()

    const start = performance.now()
    const { x, y } = box.getBoundingClientRect()
    box.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x + 4, clientY: y + 4 }))
    box.focus()
    await new Promise<void>((resolve) => {
      const drawn = () => document.querySelector(`[id="shot-${shot}"].ProseMirror`)
      if (drawn()) return resolve()
      const watching = new MutationObserver(() => {
        if (!drawn()) return
        watching.disconnect()
        resolve()
      })
      watching.observe(document.body, { childList: true, subtree: true, attributes: true })
    })
    await frame()

    return performance.now() - start
  }, shot)
}

/**
 * Twenty keystrokes into the editor the last press drew, each from the text going
 * in to the frame after it, with a frame between them so that none is typed into
 * the one before's work. They are written nowhere, because the caret never leaves.
 */
async function type(page: Page) {
  const taken = await page.evaluate(async () => {
    const frame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)))
    const taken: number[] = []
    for (let at = 0; at < 21; at++) {
      await frame()
      const start = performance.now()
      document.execCommand('insertText', false, 'a')
      await frame()
      taken.push(performance.now() - start)
    }

    return taken
  })
  await expect(page.locator('.ProseMirror')).toContainText('a'.repeat(21))

  return taken.slice(1)
}

/**
 * *Add a Shot* pressed under one Scene's run, until the new row stands in it: the
 * Shot is written, the Story read back, and the row drawn.
 */
async function add(page: Page, scene: string, settle: () => Promise<void>) {
  await page.evaluate((scene) => {
    document.getElementById(`scene-${scene}`)!.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, scene)
  await settle()

  return page.evaluate(async (scene) => {
    const frame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)))
    const rows = () => document.querySelectorAll(`#scene-${scene} li[data-shot]`).length
    const section = document.getElementById(`scene-${scene}`)!
    await frame()

    const before = rows()
    const start = performance.now()
    section.querySelector<HTMLButtonElement>('.adds button')!.click()
    await new Promise<void>((resolve) => {
      const watching = new MutationObserver(() => {
        if (rows() === before) return
        watching.disconnect()
        resolve()
      })
      watching.observe(document.body, { childList: true, subtree: true })
    })
    await frame()

    return performance.now() - start
  }, scene)
}
