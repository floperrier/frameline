import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { begin, live, test, seedDates, seedPublished, seedStory, writeStory } from './author'

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
 *
 * The suite's database is shared and only grows, so no test reads the Catalogue
 * whole: each one searches for a token only its own Stories carry — a title, or
 * a query string naming one — and its assertions hold whatever else is listed.
 */
async function catalogueFor(browser: Browser, baseURL: string | undefined, query: string) {
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const page = await context.newPage()
  await page.goto(`/catalogue${query.startsWith('?') ? query : `?q=${encodeURIComponent(query)}`}`)
  return page
}

/** The entry for one Story, found by the title nothing else on the page carries. */
function entryFor(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title })
}

/**
 * A title no other Story in the database has, so a locator can trust it — and,
 * given a token, one every Story of the same test shares, so a search for the
 * token finds that test's Stories and nobody else's.
 */
function unlikelyTitle(token: string = randomUUID()) {
  return `The night shift ${token} ${randomUUID().slice(0, 8)}`
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
  await expect(entryFor(await catalogueFor(browser, baseURL, title), title)).toBeHidden()

  await page.getByRole('button', { name: 'List this Story in the Catalogue' }).click()
  await expect(page.getByRole('button', { name: 'Take this Story Out of the Catalogue' }))
    .toBeVisible()

  // What an entry carries: the Title, the Language the work is written in, and
  // the day it was published — the date read in the Locale, and held against the
  // machine-readable one beside it so the two cannot say different days.
  const catalogue = await catalogueFor(browser, baseURL, title)
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
  await begin(catalogue)
  await expect(catalogue.getByText('A door opens.')).toBeVisible()

  // Unlisting is not unpublishing: the Story leaves the Catalogue and every link
  // already sent goes on working.
  await page.getByRole('button', { name: 'Take this Story Out of the Catalogue' }).click()
  await expect(page.getByRole('button', { name: 'List this Story in the Catalogue' }))
    .toBeVisible()
  await expect(entryFor(await catalogueFor(browser, baseURL, title), title)).toBeHidden()
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
  const bare = entryFor(await catalogueFor(browser, baseURL, title), title)
  await expect(bare).toBeVisible()
  await expect(bare).not.toContainText('A door opens.')

  await page.goto(`/stories/${story.id}`)
  await page.getByText('Synopsis and Cover').click()
  const synopsis = page.getByRole('textbox', { name: 'Synopsis' })
  await synopsis.fill('A woman leaves a door open behind her, and the street takes her.')
  await synopsis.blur()
  // A typed write, so what says it landed is the mark on the bench.
  await expect(page.getByText(/^Kept at /)).toBeVisible()

  const entry = entryFor(await catalogueFor(browser, baseURL, title), title)
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
  await expect(entryFor(await catalogueFor(browser, baseURL, title), title))
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
  // A press before Vue has the page lands on the server's button, which answers
  // nothing: half the runs against a local database, quick enough to draw the
  // bench before the browser had taken it over, unpublished nothing.
  await live(page)
  await page.getByRole('button', { name: 'Unpublish this Story' }).click()

  await expect(page.getByRole('button', { name: 'Publish this Story', exact: true }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'List this Story in the Catalogue' }))
    .toBeHidden()
  await expect(entryFor(await catalogueFor(browser, baseURL, title), title)).toBeHidden()

  // Publishing again does not put it back: listing is the Author's to say, and
  // saying it once is not saying it for ever.
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(entryFor(await catalogueFor(browser, baseURL, title), title)).toBeHidden()
})

/**
 * Writes a Story, publishes it and lists it through the API, the way the bench
 * does, under a title nothing else in the database carries.
 */
async function listedStory(request: APIRequestContext, title = unlikelyTitle()) {
  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)
  await request.post(`/api/stories/${story.id}/listed`)
  return { ...story, title }
}

/** The titles of the Catalogue's entries, in the order a Reader meets them. */
async function titlesIn(page: Page) {
  return await page.locator('li a.open').allTextContents()
}

/** Whether `first` stands before `second` on the page, both being there. */
async function standsBefore(page: Page, first: string, second: string) {
  const titles = (await titlesIn(page)).map(title => title.trim())
  expect(titles).toContain(first)
  expect(titles).toContain(second)
  return titles.indexOf(first) < titles.indexOf(second)
}

const MINUTE = 60_000

/**
 * The Catalogue counts the day a Story first entered it, not its first Publish:
 * a Story published privately long ago and listed just now is what is new to the
 * Catalogue.
 */
test('the Catalogue shows first the Story that entered it last, whenever it was published', async ({
  request, browser, baseURL,
}) => {
  const token = randomUUID()
  const [early, late] = [
    await listedStory(request, unlikelyTitle(token)), await listedStory(request, unlikelyTitle(token))]
  const now = Date.now()
  await seedDates(early, { publishedAt: new Date(now - 30 * 24 * 60 * MINUTE), firstListedAt: new Date(now - MINUTE) })
  await seedDates(late, { publishedAt: new Date(now - 2 * MINUTE), firstListedAt: new Date(now - 2 * MINUTE) })

  const catalogue = await catalogueFor(browser, baseURL, token)
  expect(await standsBefore(catalogue, early.title, late.title)).toBe(true)

  // The day the card shows is the day it entered the Catalogue.
  await expect(entryFor(catalogue, early.title).locator('time'))
    .toHaveAttribute('datetime', new Date(now - MINUTE).toISOString())
})

/** Publishing the changes again leaves a Story where it stood. */
test('republishing a Story does not move it in the Catalogue', async ({ request, browser, baseURL }) => {
  const token = randomUUID()
  const first = await listedStory(request, unlikelyTitle(token))
  const second = await listedStory(request, unlikelyTitle(token))
  const now = Date.now()
  await seedDates(first, { publishedAt: new Date(now - 2 * MINUTE), firstListedAt: new Date(now - 2 * MINUTE) })
  await seedDates(second, { publishedAt: new Date(now - MINUTE), firstListedAt: new Date(now - MINUTE) })

  expect((await request.post(`/api/stories/${first.id}/publish`)).status()).toBe(200)

  expect(await standsBefore(await catalogueFor(browser, baseURL, token), second.title, first.title)).toBe(true)
})

/** Taking a Story out and listing it again keeps the day it first entered. */
test('unlisting a Story and listing it again does not move it', async ({ request, browser, baseURL }) => {
  const token = randomUUID()
  const first = await listedStory(request, unlikelyTitle(token))
  const second = await listedStory(request, unlikelyTitle(token))
  const now = Date.now()
  await seedDates(first, { publishedAt: new Date(now - 2 * MINUTE), firstListedAt: new Date(now - 2 * MINUTE) })
  await seedDates(second, { publishedAt: new Date(now - MINUTE), firstListedAt: new Date(now - MINUTE) })

  expect((await request.delete(`/api/stories/${first.id}/listed`)).status()).toBe(200)
  expect((await request.post(`/api/stories/${first.id}/listed`)).status()).toBe(200)

  const catalogue = await catalogueFor(browser, baseURL, token)
  expect(await standsBefore(catalogue, second.title, first.title)).toBe(true)
  await expect(entryFor(catalogue, first.title).locator('time'))
    .toHaveAttribute('datetime', new Date(now - 2 * MINUTE).toISOString())
})

test('a Story published before the Catalogue existed is not listed', async ({ author, browser, baseURL }) => {
  const title = unlikelyTitle()
  const story = await seedStory(author, title)
  await seedPublished(story)

  // Nobody agreed to appear in a catalogue that did not exist when they
  // published, so the flag defaults to false and nothing backfills it.
  await expect(entryFor(await catalogueFor(browser, baseURL, title), title)).toBeHidden()
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

/**
 * The search: one field, matched anywhere in the title, the Synopsis or the
 * Author's Name, whatever its case.
 */
test('a Reader finds a Story by a word of its title, its Synopsis or its Author\'s Name', async ({
  request, browser, baseURL,
}) => {
  const token = randomUUID()
  const byTitle = await listedStory(request, `A Title ${token}`)
  const bySynopsis = await listedStory(request)
  await request.patch(`/api/stories/${bySynopsis.id}`, { data: { synopsis: `Somewhere in it, ${token}.` } })

  const catalogue = await catalogueFor(browser, baseURL, token.toUpperCase())
  await expect(entryFor(catalogue, byTitle.title)).toBeVisible()
  await expect(entryFor(catalogue, bySynopsis.title)).toBeVisible()
  expect(await titlesIn(catalogue)).toHaveLength(2)

  // The field says what was searched, so a reloaded search is the same search.
  await expect(catalogue.getByLabel('Look for a title, a Synopsis or a Name'))
    .toHaveValue(token.toUpperCase())
  await catalogue.reload()
  await expect(catalogue.getByLabel('Look for a title, a Synopsis or a Name'))
    .toHaveValue(token.toUpperCase())
  expect(await titlesIn(catalogue)).toHaveLength(2)
})

test('a Reader finds every Story of an Author by their Name', async ({ request, browser, baseURL }) => {
  const name = `Nadia ${randomUUID()}`
  expect((await request.patch('/api/author', { data: { name } })).status()).toBe(200)
  const story = await listedStory(request)

  const catalogue = await catalogueFor(browser, baseURL, name.toLowerCase())
  await expect(entryFor(catalogue, story.title)).toBeVisible()
  expect(await titlesIn(catalogue)).toHaveLength(1)
})

/** Accents are folded on both sides, so a Reader need not type them. */
test('a search ignores accents', async ({ request, browser, baseURL }) => {
  const token = randomUUID()
  const story = await listedStory(request, `Mémoire ${token}`)

  await expect(entryFor(await catalogueFor(browser, baseURL, `memoire ${token}`), story.title))
    .toBeVisible()
  await expect(entryFor(await catalogueFor(browser, baseURL, `MÉMOÏRE ${token}`), story.title))
    .toBeVisible()
  await expect(entryFor(await catalogueFor(browser, baseURL, `memoires ${token}`), story.title))
    .toBeHidden()
})

/** What is typed is what is looked for: a wildcard of `LIKE` is a character like any other. */
test('a percent sign and an underscore are looked for as themselves', async ({ request, browser, baseURL }) => {
  const token = randomUUID()
  const percent = await listedStory(request, `${token} 100% sure`)
  const digits = await listedStory(request, `${token} 1000 sure`)
  const underscore = await listedStory(request, `${token} a_b`)

  const catalogue = await catalogueFor(browser, baseURL, `${token} 100%`)
  await expect(entryFor(catalogue, percent.title)).toBeVisible()
  await expect(entryFor(catalogue, digits.title)).toBeHidden()

  const underscored = await catalogueFor(browser, baseURL, `${token} a_`)
  await expect(entryFor(underscored, underscore.title)).toBeVisible()
  // Read as a wildcard, `_` would stand for the first character of every title
  // above; read as itself, it stands for none of them.
  await expect((await catalogueFor(browser, baseURL, `${token} _`))
    .getByText('Nothing listed in the Catalogue matches this search.')).toBeVisible()
})

/** A link carrying something the Catalogue does not know still opens on the Catalogue. */
test('an unknown parameter is ignored', async ({ request, browser, baseURL }) => {
  const token = randomUUID()
  const story = await listedStory(request, unlikelyTitle(token))

  const catalogue = await catalogueFor(browser, baseURL, `?q=${token}&colour=red&q=ignored`)
  await expect(entryFor(catalogue, story.title)).toBeVisible()
})

test('a search that matches nothing says so, and offers the way back', async ({ browser, baseURL }) => {
  const catalogue = await catalogueFor(browser, baseURL, randomUUID())

  await expect(catalogue.getByText('Nothing listed in the Catalogue matches this search.')).toBeVisible()
  await catalogue.getByRole('link', { name: 'Clear the Search' }).click()
  await expect(catalogue).toHaveURL(`${baseURL}/catalogue`)
  await expect(catalogue.getByLabel('Look for a title, a Synopsis or a Name')).toHaveValue('')
})

/** The search is a plain form: with no JavaScript, its answer is the URL. */
test('the search works without JavaScript', async ({ request, browser, baseURL }) => {
  const token = randomUUID()
  const story = await listedStory(request, unlikelyTitle(token))

  const context = await browser.newContext({
    baseURL, locale: 'en-US', extraHTTPHeaders: {}, javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/catalogue')
  await page.getByLabel('Look for a title, a Synopsis or a Name').fill(token)
  await page.getByRole('button', { name: 'Search' }).click()

  await expect(page).toHaveURL(new RegExp(`/catalogue\\?q=${token}`))
  await expect(entryFor(page, story.title)).toBeVisible()
})
