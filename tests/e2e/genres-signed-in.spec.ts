import { randomUUID } from 'node:crypto'
import type { Browser } from '@playwright/test'
import { expect } from '@playwright/test'
import { live, seedListedStories, seedPresentation, test, writeStory } from './author'

/**
 * A Story is filed under one Genre or two, from a closed set, when its Author
 * lists it: asked for in the listing on the bench, changed there while it is
 * Listed, kept when it is taken out, and shown on every card in the Reader's
 * Locale — see `docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`.
 */

const REFUSED_WITHOUT = 'A Story is filed under a Genre before it is listed, so that a Reader can find it by one.'

/** The Catalogue as somebody with no account meets it, in the Locale given. */
async function catalogueFor(browser: Browser, baseURL: string | undefined, path: string, locale = 'en-US') {
  const context = await browser.newContext({ baseURL, locale, extraHTTPHeaders: {} })
  const page = await context.newPage()
  await page.goto(path)
  return page
}

test('listing a Story filed under no Genre is refused, and says why', async ({ request }) => {
  const story = await writeStory(request, 'en', [])
  await request.post(`/api/stories/${story.id}/publish`)

  const refused = await request.post(`/api/stories/${story.id}/listed`)
  expect(refused.status()).toBe(400)
  expect((await refused.json()).message).toContain(REFUSED_WITHOUT)
})

test('the listing asks for one Genre or two, and stops at two', async ({ page, request }) => {
  const story = await writeStory(request, 'en', [])
  await request.post(`/api/stories/${story.id}/publish`)

  await page.goto(`/stories/${story.id}`)
  await live(page)
  await page.getByRole('button', { name: 'List this Story in the Catalogue' }).click()
  const genres = page.getByRole('group', { name: 'Genres of this Story' })
  await expect(genres).toBeVisible()

  // Answered with nothing, the listing says why it will not list.
  await page.getByRole('button', { name: 'List It under these Genres' }).click()
  await expect(page.getByRole('alert')).toContainText(REFUSED_WITHOUT)

  // Two chosen, the others are held back until one is let go.
  await genres.getByRole('checkbox', { name: 'Crime' }).check()
  await genres.getByRole('checkbox', { name: 'Slice of Life' }).check()
  await expect(genres.getByRole('checkbox', { name: 'Horror' })).toBeDisabled()
  await genres.getByRole('checkbox', { name: 'Crime' }).uncheck()
  await expect(genres.getByRole('checkbox', { name: 'Horror' })).toBeEnabled()
  await genres.getByRole('checkbox', { name: 'Crime' }).check()

  // Answering lists the Story, in the same gesture.
  await page.getByRole('button', { name: 'List It under these Genres' }).click()
  await expect(page.getByRole('button', { name: 'Take this Story Out of the Catalogue' })).toBeVisible()
  const listed = await (await request.get(`/api/stories/${story.id}`)).json()
  expect(listed.genres).toEqual(['crime', 'slice-of-life'])

  // And a third is refused at the door as well as on the bench.
  const third = await request.patch(`/api/stories/${story.id}`, {
    data: { genres: ['crime', 'slice-of-life', 'horror'] } })
  expect(third.status()).toBe(400)
  expect(await third.text()).toContain(
    'A Story is filed under one Genre or two, each from the list Frameline offers, and none twice.')
})

test('one Genre lists a Story as well as two', async ({ request }) => {
  const story = await writeStory(request, 'en', ['poetry'])
  await request.post(`/api/stories/${story.id}/publish`)

  expect((await request.post(`/api/stories/${story.id}/listed`)).status()).toBe(200)
})

test('a Listed Story\'s Genres are changed without unlisting it, and kept when it is', async ({
  page, request, browser, baseURL,
}) => {
  const title = `Filed ${randomUUID()}`
  const story = await writeStory(request, 'en', ['drama'])
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)
  await request.post(`/api/stories/${story.id}/listed`)

  await page.goto(`/stories/${story.id}`)
  await live(page)
  await page.getByText('Genres', { exact: true }).click()
  const genres = page.getByRole('group', { name: 'Genres of this Story' })
  // The last Genre of a Listed Story stays: it is filed under one at least.
  await expect(genres.getByRole('checkbox', { name: 'Drama' })).toBeDisabled()
  await genres.getByRole('checkbox', { name: 'Horror' }).check()
  await expect(genres.getByRole('checkbox', { name: 'Drama' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Take this Story Out of the Catalogue' })).toBeVisible()

  const entry = (await catalogueFor(browser, baseURL, `/catalogue?q=${encodeURIComponent(title)}`))
    .getByRole('listitem').filter({ hasText: title })
  await expect(entry).toContainText('Drama')
  await expect(entry).toContainText('Horror')

  // Taken out and listed again, it is filed where it was, and nothing is asked.
  expect((await request.delete(`/api/stories/${story.id}/listed`)).status()).toBe(200)
  expect((await request.post(`/api/stories/${story.id}/listed`)).status()).toBe(200)
  expect((await (await request.get(`/api/stories/${story.id}`)).json()).genres)
    .toEqual(['drama', 'horror'])
})

test('a Reader keeps the Catalogue to one Genre, alone or beside a Language and a search', async ({
  author, browser, baseURL,
}) => {
  const token = randomUUID()
  const titles = Array.from({ length: 3 }, (_, at) => `Filed ${token} No. ${at + 1}`)
  const [crime, crimeInFrench, war] = await seedListedStories(author, titles)
  await seedPresentation(crime!, { genres: ['crime'] })
  await seedPresentation(crimeInFrench!, { genres: ['crime', 'war'], language: 'fr' })
  await seedPresentation(war!, { genres: ['war'] })

  const shown = async (query: string) =>
    await (await catalogueFor(browser, baseURL, `/catalogue?${query}`)).locator('li a.open').allTextContents()

  expect(await shown(`q=${token}&genre=crime`)).toEqual([crime!.title, crimeInFrench!.title])
  expect(await shown(`q=${token}&genre=crime&language=fr`)).toEqual([crimeInFrench!.title])
  expect(await shown(`q=${token}&genre=war`)).toEqual([crimeInFrench!.title, war!.title])

  // Alone, it keeps the whole shelf to the Genre.
  const alone = await shown('genre=war')
  expect(alone).toContain(war!.title)
  expect(alone).not.toContain(crime!.title)

  // The list names the Genre the URL asked for.
  const page = await catalogueFor(browser, baseURL, `/catalogue?q=${token}&genre=war`)
  await expect(page.getByLabel('Genre', { exact: true })).toHaveValue('war')
})

test('a card read in French names its Genres in French', async ({ author, browser, baseURL }) => {
  const token = randomUUID()
  const [story] = await seedListedStories(author, [`Filed ${token}`])
  await seedPresentation(story!, { genres: ['crime', 'slice-of-life'] })

  const page = await catalogueFor(browser, baseURL, `/fr/catalogue?q=${token}`, 'fr-FR')
  const entry = page.getByRole('listitem').filter({ hasText: story!.title })
  await expect(entry).toContainText('Policier')
  await expect(entry).toContainText('Tranche de vie')
})
