import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { live, seedLong, seedStory, test, writeScene } from './author'

/**
 * The bench of a long Story brings in only the Images the Author is looking at —
 * issue #448. Every Image comes in at the size a Reading shows it and the door it
 * comes through is `no-store` (ADR 0005), so a bench that asks for all of them
 * pays the whole Story's Images at every opening: forty Scenes of eight Shots was
 * three hundred and twenty requests and fifty-four megabytes before the Author
 * scrolled at all.
 *
 * Fewer than forty leaves room for how far below the window an engine starts
 * loading, and still fails the three hundred and twenty.
 */

test.use({ viewport: { width: 1440, height: 900 } })

/** The door a Shot's Image comes through on the bench. */
const AN_IMAGE = /^\/api\/shots\/[^/]+\/image$/

test('the bench of a long Story asks for the Images in the window, and for the rest as they come into it',
  async ({ page, request, author }) => {
    test.setTimeout(120_000)

    await plantSample(author.id, 'en', {
      db: drizzle(process.env.DATABASE_URL!, { schema }),
      image: name => readFile(imagePath(name)),
      sound: file => readFile(soundPath(file)),
    })
    const [sample] = await (await request.get('/api/stories')).json() as { id: string }[]
    const long = await seedStory(author, 'At Length')
    await seedLong(long, sample!)
    const { scenes } = await (await request.get(`/api/stories/${long.id}`)).json() as StoryInEditor
    const ending = scenes.find(scene => scene.name === 'Scene 40')!.shots.map(shot => shot.image!)

    const asked: string[] = []
    const bodies: Promise<number>[] = []
    page.on('request', (sent) => {
      const { pathname } = new URL(sent.url())
      if (!AN_IMAGE.test(pathname)) return
      asked.push(pathname)
      bodies.push(sent.response().then(answered => answered!.body()).then(body => body.length))
    })

    await page.goto(`/stories/${long.id}`)
    await page.waitForTimeout(2000)
    const bytes = (await Promise.all(bodies)).reduce((sum, length) => sum + length, 0)
    const opening = { requests: asked.length, megabytes: Math.round(bytes / 1e5) / 10 }
    test.info().annotations.push({ type: 'measured', description: JSON.stringify(opening) })
    console.log('measured', JSON.stringify(opening))

    expect(asked.length).toBeLessThan(40)
    // Nor anything the closed Cover picker draws: its last frames are the last Scene's.
    expect(asked.filter(image => ending.includes(image))).toEqual([])

    // Opened, the picker brings in the frames it shows.
    await live(page)
    await page.getByText('Synopsis and Cover').click()
    await expect.poll(() => page.locator('.cover .frames img').evaluateAll(images => {
      const shown = (images as HTMLImageElement[]).filter((image) => {
        const { top, bottom } = image.getBoundingClientRect()
        return bottom > 0 && top < innerHeight
      })
      return shown.length > 0 && shown.every(image => image.complete && image.naturalWidth > 0)
    })).toBe(true)
    await page.getByText('Synopsis and Cover').click()

    // Wound to the last Scene, the document brings in its thumbnails.
    await writeScene(page, 'Scene 40')
    await expect.poll(() => ending.every(image => asked.includes(image))).toBe(true)
  })
