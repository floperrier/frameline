import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { SAMPLES, imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import { live, test, unfold, writeStory } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Shot's row is what was written or deposited on it, and what it plays as is one
 * line under that which opens — issue #401 and
 * `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`. What each
 * field writes is the business of the specs that already choose a Shot's answers;
 * this one is about the fold itself: what it costs, what it says, and that it
 * stays the way the Author left it.
 */

async function reread(request: APIRequestContext, id: string) {
  return await (await request.get(`/api/stories/${id}`)).json() as StoryInEditor
}

/** *The street* with three one-line Shots, none with an Image, none saying anything for itself. */
async function threeBeats(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const street = (await reread(request, story.id)).scenes[0]!
  const third = await (await request.post(`/api/scenes/${street.id}/shots`)).json()
  await request.patch(`/api/shots/${third.id}`, { data: { text: 'Someone is up there.', description: '' } })

  await page.goto(`/stories/${story.id}?scene=${street.id}`)
  await live(page)

  return { story, street }
}

/** The fold of a Shot, found by the row its words are named in. */
function foldOf(page: Page, shot: string) {
  return page.locator('[data-shot]', { has: page.getByRole('textbox', { name: shot, exact: true }) })
    .locator('details.plays')
}

test('a Shot that says nothing for itself costs its words, its frame and one line',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { street } = await threeBeats(page, request)
    const rows = page.locator(`#scene-${street.id} .shots > li`)
    await expect(rows).toHaveCount(3)

    const tops: number[] = []
    for (const place of [1, 2, 3]) {
      const row = rows.nth(place - 1)
      const name = `Shot ${place} of The street`
      const summary = foldOf(page, name).locator('summary')

      // One line under the words, holding the offer of a Condition, what the beat
      // plays as and its marks, and not one select.
      await expect(summary).toHaveText(`As its Scene plays ${name}`)
      await expect(row.locator('select:visible')).toHaveCount(0)
      const line = await Promise.all([
        summary,
        row.getByRole('button', { name: `Add a Condition to ${name}` }),
        row.getByRole('button', { name: `Delete ${name}` }),
      ].map(async held => (await held.boundingBox())!))
      expect(Math.max(...line.map(box => box.y)))
        .toBeLessThan(Math.min(...line.map(box => box.y + box.height)))

      tops.push((await row.boundingBox())!.y)
    }

    // About 330 px a beat before the fold.
    expect(tops[1]! - tops[0]!).toBeLessThanOrEqual(160)
    expect(tops[2]! - tops[1]!).toBeLessThanOrEqual(160)
  })

test('a Shot\'s fold opens alone, by the keyboard too, and stays open through every write until it is shut',
  async ({ page, request }) => {
    const { story } = await threeBeats(page, request)
    const name = 'Shot 2 of The street'
    const fold = foldOf(page, name)
    const summary = fold.locator('summary')
    const shotOf = async () => (await reread(request, story.id)).scenes[0]!.shots[1]!

    // Named for its Shot, and opened and shut by the keys a `<details>` answers.
    await expect(summary).toHaveAccessibleName(`As its Scene plays ${name}`)
    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(fold).toHaveAttribute('open')
    await page.keyboard.press('Space')
    await expect(fold).not.toHaveAttribute('open')
    await page.keyboard.press('Enter')
    await expect(fold).toHaveAttribute('open')
    for (const other of ['Shot 1 of The street', 'Shot 3 of The street']) {
      await expect(foldOf(page, other)).not.toHaveAttribute('open')
    }

    // Opened, the same fields the row drew, under the same names: the Sound picker,
    // the Cut, the Layout, the text's two Effects and how the text arrives. A Shot
    // with no Image has no Movement and none of the Image's Effects.
    for (const field of [
      fold.getByLabel(`The Sound of ${name}`),
      fold.getByRole('button', { name: `Listen ${name}` }),
      fold.getByRole('button', { name: `Take This Sound ${name}` }),
      fold.getByLabel(`Upload a Sound for ${name}`),
      ...['This Shot is cut', 'The Cut is made', 'This Shot is laid out', 'As the text arrives',
        'While the text is on screen', 'This Shot’s text arrives', 'This Shot’s text comes',
        'This Shot’s text appears', 'This Shot’s text stays',
      ].map(label => fold.getByLabel(`${label} ${name}`, { exact: true })),
    ]) await expect(field).toBeVisible()
    for (const label of ['The Image of this Shot moves', 'As the Image arrives', 'While the Image is on screen']) {
      await expect(fold.getByLabel(`${label} ${name}`, { exact: true })).toHaveCount(0)
    }

    // Every write leaves it open, a refusal and the Story read back after it too.
    const when = fold.getByLabel(`This Shot is cut ${name}`, { exact: true })
    const made = fold.getByLabel(`The Cut is made ${name}`, { exact: true })
    const stands = fold.getByLabel(`Seconds ${name} stands`, { exact: true })
    const takes = fold.getByLabel(`Seconds the Cut of ${name} takes`, { exact: true })

    await when.selectOption('After a time')
    await expect.poll(async () => (await shotOf()).cutAfter).toBe(4000)
    await stands.fill('3')
    await stands.blur()
    await expect.poll(async () => (await shotOf()).cutAfter).toBe(3000)
    await made.selectOption('A dissolve')
    await expect.poll(async () => (await shotOf()).cutOver).toBe(800)
    await takes.fill('1')
    await takes.blur()
    await expect.poll(async () => (await shotOf()).cutOver).toBe(1000)
    await expect(fold).toHaveAttribute('open')
    await expect(summary).toHaveText(`Cut after 3 s · Dissolve, 1 s ${name}`)

    await stands.fill('0.2')
    await stands.blur()
    await expect(page.getByRole('alert')).toContainText('A Shot stands for a whole number of milliseconds')
    await expect(stands).toHaveValue('3')
    await expect(fold).toHaveAttribute('open')
    await expect(foldOf(page, 'Shot 1 of The street')).not.toHaveAttribute('open')

    // A reload brings it back shut, saying the same.
    await page.reload()
    await live(page)
    await expect(fold).not.toHaveAttribute('open')
    await expect(summary).toHaveText(`Cut after 3 s · Dissolve, 1 s ${name}`)
  })

test('the Sample\'s first Shot says what it plays as, and what it carries stands open',
  async ({ page, request, author }) => {
    await plantSample(author.id, 'en', {
      db: drizzle(process.env.DATABASE_URL!, { schema }),
      image: named => readFile(imagePath(named)),
      sound: file => readFile(soundPath(file)),
    })
    const [sample] = await (await request.get('/api/stories')).json() as { id: string }[]
    const scene = SAMPLES.en.scenes[0]!.name
    const first = `Shot 1 of ${scene}`
    const second = `Shot 2 of ${scene}`

    await page.goto(`/stories/${sample!.id}`)
    await live(page)
    const fold = foldOf(page, first)
    await expect(fold.locator('summary')).toHaveText(
      `Full screen · Closer by 12 % · From a blur as the Image arrives, 1.5 s, marked ${first}`)

    // What is written or deposited is never in the fold: the words, the Image, its
    // Description and the Conditions — and a Sound once it is on the Shot, with
    // its Transcript and the mark that takes it off.
    await expect(page.getByLabel(`Description of the image of ${first}`)).toBeVisible()
    await expect(fold.locator('.image, .conditions, [role="textbox"], input[id^="description-"]'))
      .toHaveCount(0)
    await expect(page.getByLabel(`The Sound of ${second}`)).toBeVisible()
    await expect(page.getByRole('button', { name: `Remove the Sound ${second}` })).toBeVisible()
    await expect(page.getByLabel(`The Transcript of ${second}`)).toBeVisible()
    await expect(foldOf(page, second).getByLabel(`The Sound of ${second}`)).toHaveCount(0)

    // Opened, every value the row used to show is there.
    await expect(page.getByLabel(`The Sound of ${first}`)).toBeHidden()
    await unfold(page, first)
    await expect(fold.getByLabel(`The Sound of ${first}`)).toBeVisible()
    await expect(fold.getByLabel(`This Shot is laid out ${first}`, { exact: true })).toHaveValue('full')
    await expect(fold.getByLabel(`The Image of this Shot moves ${first}`, { exact: true }))
      .toHaveValue('closer')
    await expect(fold.getByLabel(`Percent the Image of ${first} moves by`, { exact: true }))
      .toHaveValue('12')
    await expect(fold.getByRole('combobox', { name: `As the Image arrives ${first}`, exact: true }))
      .toHaveValue('from-blur')
    await expect(fold.getByRole('spinbutton', { name: `As the Image arrives ${first} Seconds`, exact: true }))
      .toHaveValue('1.5')
    await expect(fold.getByRole('combobox', { name: `As the Image arrives ${first} Strength`, exact: true }))
      .toHaveValue('marked')
  })
