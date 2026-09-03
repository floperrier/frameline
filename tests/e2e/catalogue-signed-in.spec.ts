import { randomUUID } from 'node:crypto'
import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { test, seedPublished, seedStory, writeStory } from './author'

/**
 * The Catalogue as anyone browsing meets it. Every assertion below about what is
 * on show is made through this rather than through the Author's own browser,
 * because the whole claim is that the page is answered to somebody with no
 * account.
 *
 * A context opened here takes none of the suite's `use` options, so the address
 * it is pointed at and the language it announces are given by hand — the page is
 * read in the Locale the browser asks for, and the assertions are written in
 * English. It does inherit `extraHTTPHeaders`, though, which is where the fixture
 * puts the Author's sealed session, so those are emptied: without that this is
 * the Author's own browser with a fresh cookie jar rather than a stranger's.
 */
async function catalogueFor(browser: Browser, baseURL?: string) {
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const page = await context.newPage()
  await page.goto('/catalogue')
  return page
}

/** The entry for one Story, found by the title nothing else on the page carries. */
function entryFor(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title })
}

/** A title no other Story in the database has, so a locator can trust it. */
function unlikelyTitle() {
  return `The night shift ${randomUUID()}`
}

/**
 * Listing, from the bench to the Catalogue and back: a Story is published,
 * listed in a second act, found by somebody with no account, and taken out again
 * without the link it was sent at ever stopping.
 */
test('an Author lists a published Story and anyone finds it in the Catalogue', async ({ page, request, browser, baseURL }) => {
  const title = unlikelyTitle()
  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })

  await page.goto(`/stories/${story.id}`)

  // Unpublished, there is nothing to list: the Catalogue leads to the public
  // link, and an entry pointing at a link that answers with a not-found is worse
  // than no entry.
  await expect(page.getByRole('button', { name: 'List this Story in the Catalogue' }))
    .toBeHidden()

  // Publishing offers the second act rather than performing it. A Story goes on
  // being sent to three friends without going on show to everybody.
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('button', { name: 'List this Story in the Catalogue' }))
    .toBeVisible()
  await expect(entryFor(await catalogueFor(browser, baseURL), title)).toBeHidden()

  await page.getByRole('button', { name: 'List this Story in the Catalogue' }).click()
  await expect(page.getByRole('button', { name: 'Take this Story Out of the Catalogue' }))
    .toBeVisible()

  // What an entry carries: the Title, the Language the work is written in, and
  // the day it was published — the date read in the Locale, and held against the
  // machine-readable one beside it so the two cannot say different days.
  const catalogue = await catalogueFor(browser, baseURL)
  const entry = entryFor(catalogue, title)
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('English')

  const published = await entry.locator('time').getAttribute('datetime')
  expect(Date.now() - new Date(published!).getTime()).toBeLessThan(60_000)
  await expect(entry.locator('time')).toHaveText(
    new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(published!)))

  // The entry is the public link, so following it is a Reading and not a page
  // about one.
  await entry.getByRole('link', { name: title }).click()
  await expect(catalogue).toHaveURL(`${baseURL}/read/${story.id}`)
  await expect(catalogue.getByText('A door opens.')).toBeVisible()

  // Unlisting is not unpublishing: the Story leaves the Catalogue and every link
  // already sent goes on working.
  await page.getByRole('button', { name: 'Take this Story Out of the Catalogue' }).click()
  await expect(page.getByRole('button', { name: 'List this Story in the Catalogue' }))
    .toBeVisible()
  await expect(entryFor(await catalogueFor(browser, baseURL), title)).toBeHidden()
  expect((await request.get(`/api/read/${story.id}`)).status()).toBe(200)
})

/**
 * The Synopsis: written on the bench beside the acts that put the Story where
 * somebody can meet it, and carried by the Story onto the shelf it is met on.
 */
test('an Author writes a Synopsis and whoever browses the Catalogue reads it', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const title = unlikelyTitle()
  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)
  await request.post(`/api/stories/${story.id}/listed`)

  // Listed with no Synopsis, the entry is the entry it has always been: nothing
  // is invented out of the Story's own text to fill the gap.
  const bare = entryFor(await catalogueFor(browser, baseURL), title)
  await expect(bare).toBeVisible()
  await expect(bare).not.toContainText('A door opens.')

  await page.goto(`/stories/${story.id}`)
  const synopsis = page.getByRole('textbox', { name: 'Synopsis' })
  await synopsis.fill('A woman leaves a door open behind her, and the street takes her.')
  await synopsis.blur()
  // A typed write, so what says it landed is the mark on the bench.
  await expect(page.getByText(/^Kept at /)).toBeVisible()

  const entry = entryFor(await catalogueFor(browser, baseURL), title)
  await expect(entry).toContainText(
    'A woman leaves a door open behind her, and the street takes her.')

  // The few lines are the Author's to withdraw, and a Story with none is
  // presented the way it was before anybody wrote any.
  await synopsis.fill('')
  // Waited for by the request rather than by the mark: the bench already says
  // when the last write was kept, and it says the same thing after this one.
  await Promise.all([
    page.waitForResponse(response =>
      response.url().endsWith(`/api/stories/${story.id}`)
      && response.request().method() === 'PATCH'),
    synopsis.blur(),
  ])
  await expect(entryFor(await catalogueFor(browser, baseURL), title))
    .not.toContainText('A woman leaves a door open behind her')
})

/** Unpublishing takes the Story out of the Catalogue in the same act. */
test('unpublishing a listed Story unlists it', async ({ page, request, browser, baseURL }) => {
  const title = unlikelyTitle()
  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)
  await request.post(`/api/stories/${story.id}/listed`)

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Unpublish this Story' }).click()

  await expect(page.getByRole('button', { name: 'Publish this Story', exact: true }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'List this Story in the Catalogue' }))
    .toBeHidden()
  await expect(entryFor(await catalogueFor(browser, baseURL), title)).toBeHidden()

  // Publishing again does not put it back: listing is the Author's to say, and
  // saying it once is not saying it for ever.
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(entryFor(await catalogueFor(browser, baseURL), title)).toBeHidden()
})

test('the Catalogue shows the most recently published first', async ({ request, browser, baseURL }) => {
  const [earlier, later] = [unlikelyTitle(), unlikelyTitle()]

  for (const title of [earlier, later]) {
    const story = await writeStory(request)
    await request.patch(`/api/stories/${story.id}`, { data: { title } })
    await request.post(`/api/stories/${story.id}/publish`)
    await request.post(`/api/stories/${story.id}/listed`)
  }

  const catalogue = await catalogueFor(browser, baseURL)
  const titles = await catalogue.getByRole('listitem').getByRole('link').allTextContents()

  expect(titles.indexOf(later!)).toBeLessThan(titles.indexOf(earlier!))
  expect(titles.indexOf(later!)).toBeGreaterThan(-1)
})

test('a Story published before the Catalogue existed is not listed', async ({ author, browser, baseURL }) => {
  const title = unlikelyTitle()
  const story = await seedStory(author, title)
  await seedPublished(story)

  // Nobody agreed to appear in a catalogue that did not exist when they
  // published, so the flag defaults to false and nothing backfills it.
  await expect(entryFor(await catalogueFor(browser, baseURL), title)).toBeHidden()
})

test('an unpublished Story cannot be listed, and someone else\'s is not there at all', async ({ request, otherAuthor }) => {
  const mine = await writeStory(request)
  const refused = await request.post(`/api/stories/${mine.id}/listed`)

  expect(refused.status()).toBe(400)
  expect((await refused.json()).message).toContain(
    'A Story is published before it is listed, because an entry in the Catalogue '
    + 'leads to its public link.')

  // Somebody else's Story is absent rather than refused, like everywhere else.
  const theirs = await seedStory(otherAuthor, 'Their Story')
  await seedPublished(theirs)
  expect((await request.post(`/api/stories/${theirs.id}/listed`)).status()).toBe(404)
  expect((await request.delete(`/api/stories/${theirs.id}/listed`)).status()).toBe(404)
})
