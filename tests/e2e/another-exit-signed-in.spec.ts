import { expect } from '@playwright/test'
import { begin, test } from './author'

/**
 * A Reader goes back to an Exit they took and takes another — issue #439. The
 * Story is written through the API and published: the Street offers two ways on,
 * the Bar one, the Corner two, and the Line ends it.
 */
test('a Reader goes back to an Exit they took where there was another, and takes the other',
  async ({ browser, baseURL, request }) => {
    const story = await (await request.post('/api/stories', {
      data: { title: 'Two doors', language: 'en' },
    })).json()

    const scenes: Record<string, string> = {}
    for (const [name, text] of [
      ['Street', 'A door opens.'],
      ['Bar', 'Smoke.'],
      ['Rain', 'The rain does not let up.'],
      ['Corner', 'A phone rings.'],
      ['Line', 'A voice she knows.'],
      ['Silence', 'It stops.'],
    ]) {
      const scene = await (await request.post(`/api/stories/${story.id}/scenes`, { data: { name } })).json()
      const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
      await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
      scenes[name!] = scene.id
    }

    const exits: Record<string, string> = {}
    for (const [from, text, to] of [
      ['Street', 'Follow her', 'Bar'],
      ['Street', 'Stay in the rain', 'Rain'],
      ['Bar', 'Leave', 'Corner'],
      ['Corner', 'Answer it', 'Line'],
      ['Corner', 'Let it ring', 'Silence'],
    ]) {
      const exit = await (await request.post(`/api/scenes/${scenes[from!]}/exits`, {
        data: { toSceneId: scenes[to!] },
      })).json()
      await request.patch(`/api/exits/${exit.id}`, { data: { text } })
      exits[text!] = exit.id
    }
    expect((await request.post(`/api/stories/${story.id}/publish`)).ok()).toBe(true)

    /**
     * A stranger stood on the Line's one Shot by the Path their browser keeps, past
     * both forks and the lone way between them, who reads on to the ending. Stood
     * there because a kept Path at an ending is not resumed.
     */
    async function atTheEnding() {
      const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
      await context.addInitScript(([key, path]) => localStorage.setItem(key!, path!), [
        `reading-${story.id}`,
        JSON.stringify({ seed: 1, taken: [exits['Follow her'], exits.Leave, exits['Answer it']], shot: 0 }),
      ])
      const page = await context.newPage()
      await page.goto(`/read/${story.id}`)
      await begin(page)
      const reading = page.locator('.reading')
      await expect(reading.locator('.frame .shot')).toHaveText('A voice she knows.')
      await reading.getByRole('button', { name: 'Next Shot' }).click()
      await expect(reading.getByRole('status').filter({ hasText: 'The Reading ends here.' })).toHaveCount(1)

      return {
        context,
        page,
        reading,
        another: reading.getByRole('button', { name: 'Take Another Exit' }),
        list: reading.getByRole('list', { name: 'The Exits you took' }),
      }
    }

    const { context, page, reading, another, list } = await atTheEnding()

    // A disclosure: shut until pressed, and then the two Exits taken at a fork, by
    // their words and in the order they were taken. The lone way between them was
    // no Exit the Reader picked, and is not there.
    await expect(another).toHaveAttribute('aria-expanded', 'false')
    await expect(list).toBeHidden()
    await another.click()
    await expect(another).toHaveAttribute('aria-expanded', 'true')
    await expect(list.getByRole('button')).toHaveText(['Follow her', 'Answer it'])
    await expect(list.getByRole('button', { name: 'Back to Where You Took “Answer it”' })).toBeVisible()

    // Esc shuts it from inside, and the Reader is put back on the control.
    await list.getByRole('button').first().focus()
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    await expect(another).toBeFocused()

    // Back to the first fork: the Street's ways on, offered again, the focus on the
    // first of them, and the list gone with the move.
    await another.click()
    await list.getByRole('button', { name: 'Back to Where You Took “Follow her”' }).click()
    await expect(reading.locator('.exits').getByRole('button').first()).toHaveText(/Follow her/)
    await expect(reading.locator('.exits').getByRole('button').first()).toBeFocused()
    await expect(list).toBeHidden()
    await expect(another).toHaveCount(0)

    // And the other way on is the one read.
    await reading.getByRole('button', { name: 'Stay in the rain' }).click()
    await expect(reading.locator('.frame .shot')).toHaveText('The rain does not let up.')
    await context.close()

    // The lone way on is closed backwards and the change published: going back to
    // the Street would cross it, so the list stops there and holds the Corner alone.
    await request.patch(`/api/exits/${exits.Leave}`, { data: { stepsBack: false } })
    await request.post(`/api/stories/${story.id}/publish`)
    const closed = await atTheEnding()
    await closed.another.click()
    await expect(closed.list.getByRole('button')).toHaveText(['Answer it'])
    await closed.context.close()
  })
