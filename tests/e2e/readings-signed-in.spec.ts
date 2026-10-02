import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { begin, live, readTheStory, test } from './author'

/**
 * The Author of a published Story is told how many Readings it has had and how
 * many reached an ending — issue #430. A Reading begun is a press of *Begin* that
 * starts at the opening, so one picked up from a kept Path is not begun again; a
 * Reading ended is counted under the Scene it ended in. The Story's own Author and
 * the Preview are never counted. See
 * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 */

const TOLD = /\/api\/read\/[^/]+\/(begun|ended)$/

test('the Author is told how many Readings of their Story began and ended, and only strangers count',
  async ({ browser, baseURL, page, request, author }) => {
    await plantSample(author.id, 'en', {
      db: drizzle(process.env.DATABASE_URL!, { schema }),
      image: name => readFile(imagePath(name)),
      sound: file => readFile(soundPath(file)),
    })
    const [{ id }] = await (await request.get('/api/stories')).json()
    expect((await request.post(`/api/stories/${id}/publish`)).ok()).toBe(true)
    const readings = async () => {
      const { begun, ended } = ((await (await request.get(`/api/stories/${id}`)).json()) as StoryInEditor)
        .readings
      return { begun, ended }
    }
    const { exits } = await (await request.get(`/api/stories/${id}`)).json() as StoryInEditor
    const skip = exits.find(exit => exit.text === 'Skip the second Scene')!

    expect(await readings()).toEqual({ begun: 0, ended: 0 })
    await page.goto(`/stories/${id}`)
    await expect(page.locator('.live')).toContainText('No Reading begun yet.')

    // A stranger presses Begin, and the Reading is counted. The request is
    // answered with nothing, and sets no cookie on somebody who has none.
    const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
    const stranger = await context.newPage()
    await stranger.goto(`/read/${id}`)
    const begun = stranger.waitForResponse(response => response.url().endsWith(`/api/read/${id}/begun`))
    await begin(stranger)
    expect((await begun).status()).toBe(204)
    expect((await begun).headers()['set-cookie']).toBeUndefined()
    await expect.poll(readings).toEqual({ begun: 1, ended: 0 })

    // The same stranger comes back, stood by the Path their browser keeps on the
    // last Shot of the third Scene — reached by skipping the second — and goes on
    // to the end. Picking the Reading up begins nothing; ending it is counted.
    await context.addInitScript(([key, path]) => localStorage.setItem(key!, path!),
      [`reading-${id}`, JSON.stringify({ seed: 1, taken: [skip.id], shot: 1 })])
    const sent: string[] = []
    stranger.on('request', (asked) => {
      if (TOLD.test(asked.url())) sent.push(asked.url())
    })
    await stranger.goto(`/read/${id}`)
    await begin(stranger)
    const ended = stranger.waitForResponse(response => response.url().endsWith(`/api/read/${id}/ended`))
    const reading = stranger.locator('.reading')
    await reading.getByRole('button', { name: 'Next Shot' }).click()
    await expect(reading.getByRole('status').filter({ hasText: 'The Reading ends here.' })).toBeAttached()
    expect((await ended).status()).toBe(204)
    await expect.poll(readings).toEqual({ begun: 1, ended: 1 })
    expect(sent).toEqual([`${baseURL}/api/read/${id}/ended`])
    await context.close()

    // The Author reading their own link is told the same 204 and counts nothing.
    await page.goto(`/read/${id}`)
    const own = page.waitForResponse(response => response.url().endsWith(`/api/read/${id}/begun`))
    await begin(page)
    expect((await own).status()).toBe(204)
    expect(await readings()).toEqual({ begun: 1, ended: 1 })

    // Nor does the Preview, which never asks.
    const previewed: string[] = []
    page.on('request', (asked) => {
      if (TOLD.test(asked.url())) previewed.push(asked.url())
    })
    await page.goto(`/stories/${id}`)
    await live(page)
    await readTheStory(page)
    expect(previewed).toEqual([])
    expect(await readings()).toEqual({ begun: 1, ended: 1 })

    // The header's live line and the shelf say the counts.
    await expect(page.locator('.live')).toContainText('1 Reading begun, 1 ended.')
    await page.goto('/stories')
    await expect(page.getByText('1 Reading', { exact: true })).toBeVisible()
  })
