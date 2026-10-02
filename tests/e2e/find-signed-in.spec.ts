import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import { placesIn, textRuns, type Place } from '../../shared/utils/found'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { live, seedStory, test, toast, writeStory, type Author } from './author'

/**
 * Find and Replace on the bench — issue #447,
 * `docs/adr/0075-the-storys-words-are-found-where-a-reader-is-given-them.md`.
 * Held on the English Sample, which says *Flag* in several Shots, *neither* in
 * italics and *coin* once as a word and once as the Flag `{coin}`.
 */

/** The Sample, planted the way `split-shot-signed-in.spec.ts` plants it. */
async function plant(author: Author) {
  await plantSample(author.id, 'en', {
    db: drizzle(process.env.DATABASE_URL!, { schema }),
    image: name => readFile(imagePath(name)),
    sound: file => readFile(soundPath(file)),
  })
}

function readTheStory(request: APIRequestContext, id: string) {
  return request.get(`/api/stories/${id}`).then(read => read.json() as Promise<StoryInEditor>)
}

/** The Sample planted, opened on the bench, and read back. */
async function opened(page: Page, request: APIRequestContext, author: Author, at = '') {
  await plant(author)
  const [{ id }] = await (await request.get('/api/stories')).json()
  await page.goto(`${at}/stories/${id}`)
  await live(page)
  return { id, story: await readTheStory(request, id) }
}

/** How many places, in how many Shots, as the bar counts them. */
function counted(story: StoryInEditor, find: string) {
  const places = placesIn(story, find, false)
  const shots = new Set(places.filter(place => place.of === 'shot').map(place => place.id))
  return { places, n: places.length, shots: shots.size }
}

/** The ranges the current place is lit by: the words each covers, and the Shot box it stands in. */
function litHere(page: Page) {
  return page.evaluate(() => [...(CSS.highlights.get('found-here') ?? [])].map(range => ({
    words: range.toString(),
    in: range.startContainer.parentElement?.closest('[id^="shot-"]')?.id,
  })))
}

/** Every place found written over, through the confirmation the bench draws. */
async function replaceAll(page: Page, find: string, replace: string, places: number) {
  await page.getByLabel('Find', { exact: true }).fill(find)
  await page.getByLabel('Replace with').fill(replace)
  await page.getByRole('button', { name: 'Replace All', exact: true }).click()
  const asking = page.getByRole('dialog')
  await expect(asking).toContainText(places === 1
    ? `Replace “${find}” with “${replace}” in one place?`
    : `Replace “${find}” with “${replace}” in ${places} places?`)
  await asking.getByRole('button', { name: 'Replace All' }).click()
}

test('a word the Sample says in several Shots is counted, wound to, replaced once and then everywhere',
  async ({ page, request, author }) => {
    const { id, story } = await opened(page, request, author)
    const { places, n, shots } = counted(story, 'Flag')
    const [first, second] = places
    expect(n).toBeGreaterThan(2)
    expect(shots).toBeGreaterThan(1)
    const [opening, offers] = story.scenes
    expect(first).toMatchObject({ of: 'shot', id: opening!.shots[3]!.id, field: 'description' })
    expect(second).toMatchObject({ of: 'shot', id: offers!.shots[1]!.id, field: 'formatted' })

    // Opened from the Contact Sheet, the bar turns the bench back to the writing.
    await page.getByRole('button', { name: 'See the Contact Sheet' }).click()
    await expect(page.getByRole('group', { name: 'Writing Where a Story starts' })).toBeHidden()
    const opener = page.getByRole('button', { name: 'Find and Replace', exact: true })
    await opener.click()
    await expect(page.getByRole('group', { name: 'Writing Where a Story starts' })).toBeVisible()
    const bar = page.getByRole('search')
    const count = bar.locator('output')
    await expect(page.getByLabel('Find', { exact: true })).toBeFocused()

    // Counted, and the first place lit: a Description, which is an <input> and so
    // lit as a field.
    await page.getByLabel('Find', { exact: true }).fill('Flag')
    await expect(count).toContainText(`${n} in ${shots} Shots`)
    await expect(page.locator(`#description-${first!.id}`)).toHaveAttribute('data-found', 'here')

    // Next Place winds the document to the second, in a Shot's words, lit as words.
    await bar.getByRole('button', { name: 'Next Place' }).click()
    await expect(page.locator(`#shot-${second!.id}`)).toBeInViewport()
    await expect.poll(() => litHere(page)).toEqual([{ words: 'Flag', in: `shot-${second!.id}` }])
    await expect(page.locator(`#description-${first!.id}`)).toHaveAttribute('data-found', 'there')

    // Replace writes that place and no other.
    await page.getByLabel('Replace with').fill('Marker')
    await bar.getByRole('button', { name: 'Replace', exact: true }).click()
    await expect.poll(async () => (await readTheStory(request, id)).scenes[1]!.shots[1]!.text)
      .toContain('set a Marker')
    const once = counted(await readTheStory(request, id), 'Flag')
    const where = (place: Place) => [place.id, place.field, place.run, place.from]
    expect(once.places.map(where)).toEqual(places.filter(place => place !== second).map(where))
    await expect(count).toContainText(`${n - 1} in ${once.shots} Shots`)

    // Replace All asks, then changes every place left.
    await replaceAll(page, 'Flag', 'Marker', n - 1)
    await expect.poll(async () => placesIn(await readTheStory(request, id), 'flag', false)).toEqual([])
    await expect(toast(page)).toHaveText(`Replaced ${n - 1} times.`)
    await expect(count).toHaveText('Not found')

    // With nothing left the caret is back in Find, and Esc puts the bar away and
    // the focus back on the control that opened it.
    await expect(page.getByLabel('Find', { exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(bar).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

test('Replace All keeps an italic run italic', async ({ page, request, author }) => {
  const { id, story } = await opened(page, request, author)
  const spoken = story.scenes[0]!.shots[1]!
  await page.getByRole('button', { name: 'Find and Replace', exact: true }).click()

  await replaceAll(page, 'neither', 'nothing', 1)
  await expect.poll(async () => textRuns((await readTheStory(request, id)).scenes[0]!.shots[1]!.formatted))
    .toContainEqual({ type: 'text', text: 'nothing', marks: [{ type: 'emphasis' }] })
  await expect(page.locator(`#shot-${spoken.id} em`)).toHaveText('nothing')
})

test('a Flag between braces is left as it was while the same word outside them is replaced',
  async ({ page, request, author }) => {
    const { id } = await opened(page, request, author)
    await page.getByRole('button', { name: 'Find and Replace', exact: true }).click()

    await page.getByLabel('Find', { exact: true }).fill('coin')
    await expect(page.getByRole('search').locator('output')).toHaveText(/^1 in 1 Shot(?!s)/)
    await replaceAll(page, 'coin', 'die', 1)
    await expect(toast(page)).toHaveText('Replaced once.')
    const tossed = (await readTheStory(request, id)).scenes[1]!.shots[2]!.text
    expect(tossed).toContain('tossed a die')
    expect(tossed).toContain('{coin}')
  })

test('a replacement that would overflow a Shot is refused, naming it, and nothing is changed',
  async ({ page, request, author }) => {
    const { id } = await opened(page, request, author)
    await page.getByRole('button', { name: 'Find and Replace', exact: true }).click()
    const before = await readTheStory(request, id)

    await replaceAll(page, 'beat', 'x'.repeat(2000), counted(before, 'beat').n)
    await expect(page.getByText(
      'That would make Shot 1 of Where a Story starts longer than 2000 characters, so nothing was replaced.',
    )).toBeVisible()
    expect((await readTheStory(request, id)).scenes).toEqual(before.scenes)
  })

// A browser that announces French, as `languages-signed-in.spec.ts` has one: the
// locale it detects is what keeps the address under /fr/.
test.describe('in French', () => {
  test.use({ locale: 'fr-FR' })

  test('the bar reads in French at /fr/...', async ({ page, request, author }) => {
    const { id, story } = await opened(page, request, author, '/fr')
    await expect(page).toHaveURL(`/fr/stories/${id}`)
    await page.getByRole('button', { name: 'Rechercher et remplacer' }).click()

    const bar = page.getByRole('search')
    await expect(bar.getByLabel('Rechercher', { exact: true })).toBeFocused()
    await expect(bar.getByLabel('Remplacer par')).toBeVisible()
    await expect(bar.getByRole('checkbox', { name: 'Respecter la casse' })).toBeVisible()
    for (const name of ['Lieu précédent', 'Lieu suivant', 'Remplacer', 'Tout remplacer']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()
    }

    const { n, shots } = counted(story, 'Flag')
    await bar.getByLabel('Rechercher', { exact: true }).fill('Flag')
    await expect(bar.locator('output')).toContainText(`${n} dans ${shots} Plans`)
  })
})

test('the route refuses what it cannot find or put in, in both languages, and answers for the Author’s own Stories alone',
  async ({ request, otherAuthor }) => {
    const story = await writeStory(request)
    const replacing = (id: string, data: object, headers?: Record<string, string>) =>
      request.post(`/api/stories/${id}/replace`, {
        data: { find: 'door', replace: 'gate', matchCase: false, ...data },
        headers,
      })

    const empty = await replacing(story.id, { find: '' })
    expect(empty.status()).toBe(400)
    expect((await empty.json()).message).toBe('Say what to find.')
    const vide = await replacing(story.id, { find: '' }, { 'accept-language': 'fr' })
    expect((await vide.json()).message).toBe('Dites ce qu’il faut rechercher.')

    const long = await replacing(story.id, { find: 'x'.repeat(2001) })
    expect(long.status()).toBe(400)
    expect((await long.json()).message).toBe('What is found is at most 2000 characters.')
    const longer = await replacing(story.id, { replace: 'x'.repeat(2001) })
    expect(longer.status()).toBe(400)
    expect((await longer.json()).message).toBe('What replaces it is at most 2000 characters.')

    const theirs = await seedStory(otherAuthor, 'Their Story')
    expect((await replacing(theirs.id, {})).status()).toBe(404)

    const nothing = await replacing(story.id, { find: 'zebra' })
    expect(nothing.status()).toBe(200)
    expect(await nothing.json()).toEqual({ replaced: 0 })
  })
