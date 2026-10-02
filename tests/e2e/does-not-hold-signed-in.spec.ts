import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { SAMPLES, imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import { wordsOf } from '../../demonstration/work'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import { begin, live, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Condition asks what a Flag does not hold as well as what it holds — issue
 * #423. The Reading half is the Sample's: its third Scene answers the right answer
 * to the second Scene's Question with one Shot and any other answer with the next.
 * The bench half is the row that says which.
 */

test('the Sample answers a wrong answer to its Question as well as the right one',
  async ({ browser, baseURL, request, author }) => {
    await plantSample(author.id, 'en', {
      db: drizzle(process.env.DATABASE_URL!, { schema }),
      image: name => readFile(imagePath(name)),
      sound: file => readFile(soundPath(file)),
    })
    const [{ id }] = await (await request.get('/api/stories')).json()
    expect((await request.post(`/api/stories/${id}/publish`)).ok()).toBe(true)
    const { scenes, exits } = await (await request.get(`/api/stories/${id}`)).json() as StoryInEditor
    const into = exits.find(exit => exit.toSceneId === scenes[1]!.id)!
    const [, right, wrong, route] = SAMPLES.en.scenes[2]!.shots.map(wordsOf)
    const question = SAMPLES.en.scenes[1]!.question!

    /**
     * A stranger, stood at the Question by the Path their browser keeps — the
     * Exit into the second Scene taken and its three Shots behind them — who
     * answers it and goes on into the third Scene, whose second and third beats
     * it reads. Stood there rather than walked there, because the first two
     * Scenes are cut by the clock and arrive word by word, which is not what this
     * is about.
     */
    async function answering(answer: string, ...beats: string[]) {
      const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
      await context.addInitScript(([key, path]) => localStorage.setItem(key!, path!),
        [`reading-${id}`, JSON.stringify({ seed: 1, taken: [into.id], shot: 3 })])
      const page = await context.newPage()
      await page.goto(`/read/${id}`)
      await begin(page)
      const reading = page.locator('.reading')
      const field = reading.getByLabel(question)
      await field.fill(answer)
      await field.press('Enter')
      await reading.getByRole('button', { name: 'Go on to the Conditions' }).click()
      for (const beat of beats) {
        await reading.getByRole('button', { name: 'Next Shot' }).click()
        await expect(reading.locator('.frame .shot')).toHaveText(beat)
      }
      await context.close()
    }

    // The right answer, however it is spelt, plays the Shot waiting on it and not
    // the one after it, which goes straight on to the beat every Reader through
    // the second Scene plays; any other answer, the other way round.
    await answering('  EXIT ', right!.replace('{word}', 'EXIT'), route!)
    await answering('door', wrong!.replace('{word}', 'door'), route!)
  })

test('the bench switches a Flag Condition between holding a value and not holding it',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const read = async () => {
      const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
      return scenes[0]!.shots[0]!.conditions
    }
    const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
    await request.put(`/api/shots/${scenes[0]!.shots[0]!.id}/conditions`, {
      data: { conditions: [{ flag: 'answer', is: 'rosebud' }] },
    })

    await page.goto(`/stories/${story.id}`)
    await live(page)
    const called = 'Condition 1 of Shot 1 of The street'
    const holds = page.getByLabel(`holds or not for ${called}`)
    await expect(holds).toHaveValue('true')
    await expect(page.getByLabel(`holds for ${called}`)).toHaveValue('rosebud')

    await holds.selectOption({ label: 'does not hold' })
    await expect.poll(read).toEqual([{ flag: 'answer', isNot: 'rosebud' }])
    // The value is labelled by the word before it, which now says the other thing.
    await expect(page.getByLabel(`does not hold for ${called}`)).toHaveValue('rosebud')

    await holds.selectOption({ label: 'holds' })
    await expect.poll(read).toEqual([{ flag: 'answer', is: 'rosebud' }])
  })
