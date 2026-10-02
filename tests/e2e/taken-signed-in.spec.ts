import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { begin, live, test } from './author'

/**
 * The Author of a published Story reads beside each Exit how often Readers took
 * it, and beside each Scene a Reading ended in how many ended there — issue #431.
 * An Exit is counted once per Reading, so a step back across it and a second take
 * add nothing; the Preview never counts. See
 * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 */

const TAKEN = /\/api\/read\/[^/]+\/taken$/

test('the Author reads how often each Exit was taken and how many Readings ended in a Scene',
  async ({ browser, baseURL, page, playwright, request, author }) => {
    await plantSample(author.id, 'en', {
      db: drizzle(process.env.DATABASE_URL!, { schema }),
      image: name => readFile(imagePath(name)),
      sound: file => readFile(soundPath(file)),
    })
    const [{ id }] = await (await request.get('/api/stories')).json()
    const { exits, scenes } = await (await request.get(`/api/stories/${id}`)).json() as StoryInEditor
    const take = exits.find(exit => exit.text === 'Take the Exit')!
    const skip = exits.find(exit => exit.text === 'Skip the second Scene')!
    const last = scenes.find(scene => scene.name === 'What a Condition tests')!
    const anonymous = await playwright.request.newContext({ baseURL })
    const readings = async () => ((await (await request.get(`/api/stories/${id}`)).json()) as StoryInEditor)
      .readings

    // A Story that is not published says nothing of its Exits. A Sample is
    // planted published, so it is taken down first.
    expect((await request.delete(`/api/stories/${id}/publish`)).ok()).toBe(true)
    await page.goto(`/stories/${id}`)
    await expect(page.locator(`[data-way="${take.id}"]`)).toBeVisible()
    await expect(page.getByText('Not taken yet')).toHaveCount(0)
    const unpublished = await anonymous.post(`/api/read/${id}/taken`, { data: { exit: take.id } })
    expect(unpublished.status()).toBe(204)

    expect((await request.post(`/api/stories/${id}/publish`)).ok()).toBe(true)
    expect(await readings()).toEqual({ begun: 0, ended: 0, taken: {}, endedIn: {} })

    // Nor is an Exit the Edition does not hold, nor the Author's own take.
    const elsewhere = await anonymous.post(`/api/read/${id}/taken`, { data: { exit: randomUUID() } })
    expect(elsewhere.status()).toBe(204)
    expect((await request.post(`/api/read/${id}/taken`, { data: { exit: take.id } })).status()).toBe(204)
    expect(await readings()).toEqual({ begun: 0, ended: 0, taken: {}, endedIn: {} })

    // A stranger stood at the end of the opening Scene's run takes its first Exit.
    // The take is answered with nothing, and sets no cookie.
    const context = await browser.newContext({ baseURL, locale: 'en-US' })
    await context.addInitScript(([key, path]) => localStorage.setItem(key!, path!),
      [`reading-${id}`, JSON.stringify({ seed: 1, taken: [], shot: 4 })])
    const stranger = await context.newPage()
    const sent: string[] = []
    stranger.on('request', (asked) => {
      if (TAKEN.test(asked.url())) sent.push(asked.url())
    })
    await stranger.goto(`/read/${id}`)
    await begin(stranger)
    const reading = stranger.locator('.reading')
    const taken = stranger.waitForResponse(response => TAKEN.test(response.url()))
    await reading.getByRole('button', { name: 'Take the Exit' }).click()
    expect((await taken).status()).toBe(204)
    expect((await taken).headers()['set-cookie']).toBeUndefined()
    await expect.poll(async () => (await readings()).taken).toEqual({ [take.id]: 1 })

    await page.reload()
    await expect(page.locator(`[data-way="${take.id}"]`)).toContainText('Taken once (100 %)')
    await expect(page.locator(`[data-way="${skip.id}"]`)).toContainText('Not taken yet')

    // A step back across it and the same Exit taken again is the one take.
    await reading.getByRole('button', { name: 'Step Back' }).click()
    await reading.getByRole('button', { name: 'Take the Exit' }).click()
    await expect(reading.getByRole('button', { name: 'Take the Exit' })).toBeHidden()
    expect(sent).toHaveLength(1)
    expect((await readings()).taken).toEqual({ [take.id]: 1 })

    // The Author taking it in the Preview adds nothing, and asks nothing.
    const previewed: string[] = []
    page.on('request', (asked) => {
      if (TAKEN.test(asked.url())) previewed.push(asked.url())
    })
    await live(page)
    await page.getByRole('button', { name: 'Read from Shot 4 of Where a Story starts', exact: true }).click()
    const preview = page.getByRole('region', { name: /^Preview/ })
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Take the Exit' }).click()
    await expect(preview.getByRole('button', { name: 'Take the Exit' })).toBeHidden()
    expect(previewed).toEqual([])
    expect((await readings()).taken).toEqual({ [take.id]: 1 })

    // The stranger, stood on the last Shot of the third Scene by having skipped
    // the second, reads to the end; the Exit their Path already holds was told on
    // the visit that took it, and is not told again.
    await context.addInitScript(([key, path]) => localStorage.setItem(key!, path!),
      [`reading-${id}`, JSON.stringify({ seed: 1, taken: [skip.id], shot: 1 })])
    await stranger.goto(`/read/${id}`)
    await begin(stranger)
    await reading.getByRole('button', { name: 'Next Shot' }).click()
    await expect(reading.getByRole('status').filter({ hasText: 'The Reading ends here.' })).toBeAttached()
    await expect.poll(async () => (await readings()).endedIn).toEqual({ [last.id]: 1 })
    expect(sent).toHaveLength(1)
    await context.close()
    await anonymous.dispose()

    await page.goto(`/stories/${id}`)
    await expect(page.locator(`[data-scene="${last.id}"] .opening`)).toContainText('1 Reading ended here')
    await expect(page.getByText(/Readings? ended here/)).toHaveCount(1)
    await expect(page.locator(`[data-way="${skip.id}"]`)).toContainText('Not taken yet')
  })
