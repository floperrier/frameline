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
 * add nothing; the Preview never counts. And in each Scene how many Readings left
 * off there — issue #497 — worked out from those same counts. See
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
    const on = exits.find(exit => exit.text === 'Go on to the Conditions')!
    const second = scenes.find(scene => scene.name === 'What an Exit offers')!
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
    expect(await readings()).toEqual({ begun: 0, ended: 0, taken: {}, endedIn: {}, leftOff: {} })

    // Nor is an Exit the Edition does not hold, nor the Author's own take.
    const elsewhere = await anonymous.post(`/api/read/${id}/taken`, { data: { exit: randomUUID() } })
    expect(elsewhere.status()).toBe(204)
    expect((await request.post(`/api/read/${id}/taken`, { data: { exit: take.id } })).status()).toBe(204)
    expect(await readings()).toEqual({ begun: 0, ended: 0, taken: {}, endedIn: {}, leftOff: {} })

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

    // The Reading has arrived in the second Scene and neither left it nor ended
    // there, so it left off there. The opening Scene, which it left and which saw
    // no Reading begun (the stranger's was picked up from a kept Path), comes out
    // below nought and says nothing.
    expect((await readings()).leftOff).toEqual({ [second.id]: 1 })
    await expect(page.locator(`[data-scene="${second.id}"] .opening`)).toContainText('1 Reading left off here')
    await expect(page.getByText(/Readings? left off here/)).toHaveCount(1)

    // A Story taken down says none of it, and says it again once published.
    expect((await request.delete(`/api/stories/${id}/publish`)).ok()).toBe(true)
    await page.reload()
    await expect(page.locator(`[data-scene="${second.id}"] .opening`)).toBeVisible()
    await expect(page.getByText(/Readings? left off here/)).toHaveCount(0)
    expect((await request.post(`/api/stories/${id}/publish`)).ok()).toBe(true)

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
    await anonymous.dispose()

    // An ending with no arrival counted comes out below nought, and says nothing.
    expect((await readings()).leftOff).toEqual({ [second.id]: 1 })
    await page.goto(`/stories/${id}`)
    await expect(page.locator(`[data-scene="${last.id}"] .opening`)).toContainText('1 Reading ended here')
    await expect(page.getByText(/Readings? ended here/)).toHaveCount(1)
    await expect(page.locator(`[data-way="${skip.id}"]`)).toContainText('Not taken yet')
    await expect(page.locator(`[data-scene="${second.id}"] .opening`)).toContainText('1 Reading left off here')
    await expect(page.locator(`[data-scene="${last.id}"] .opening`)).not.toContainText('left off')

    // The Reading left off in the second Scene goes on to the third and ends
    // there, told from the stranger's page the way a Reading tells it: no Scene
    // has a Reading left off in it any more.
    const tell = (kind: string, body: object) => stranger.evaluate(async ([url, sent]) => (await fetch(url!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: sent,
    })).status, [`/api/read/${id}/${kind}`, JSON.stringify(body)])
    expect(await tell('taken', { exit: on.id })).toBe(204)
    expect(await tell('ended', { scene: last.id })).toBe(204)
    await context.close()
    expect((await readings()).leftOff).toEqual({})
    await page.reload()
    await expect(page.locator(`[data-scene="${last.id}"] .opening`)).toContainText('2 Readings ended here')
    await expect(page.getByText(/Readings? left off here/)).toHaveCount(0)
  })
