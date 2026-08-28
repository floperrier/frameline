import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { Author } from './author'
import {
  readListStories,
  seedList,
  seedListed,
  seedPublished,
  seedStory,
  test,
} from './author'

/** A title no other Story in the database has, so a locator can trust it. */
function unlikelyTitle() {
  return `The night shift ${randomUUID()}`
}

/**
 * A Story of somebody else's, in the Catalogue: what an Author gathers is other
 * people's work found where it is found, so nothing here is written by the
 * Author doing the gathering.
 */
async function listedByAnother(otherAuthor: Author) {
  const title = unlikelyTitle()
  const story = await seedStory(otherAuthor, title)
  await seedPublished(story)
  await seedListed(story)

  return { ...story, title }
}

/** The entry for one Story, found by the title nothing else on the page carries. */
function entryFor(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title })
}

/** Whether the Story is a favourite is the state of the control, not a second control. */
function favouriting(page: Page, title: string) {
  return page.getByRole('button', { name: `Favourite ${title}` })
}

/**
 * Gathering is a request, and a checkbox the browser has already ticked says
 * nothing about whether it landed — so what is waited for is the shelves being
 * read back afterwards. The favourite button needs none of this: it is pressed
 * off the answer, so the assertion is the wait.
 */
async function gathered(page: Page, act: () => Promise<void>) {
  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes('/api/lists') && response.request().method() === 'GET'),
    act(),
  ])
}

/**
 * Favouriting, from the Catalogue and from the reading page: one act on the List
 * every account has, shown as pressed wherever the Story is met again.
 */
test('an Author favourites a Story where they meet it, and finds it in Favourites', async ({ page, otherAuthor }) => {
  const story = await listedByAnother(otherAuthor)

  await page.goto('/catalogue')
  await expect(favouriting(page, story.title)).toHaveAttribute('aria-pressed', 'false')

  await favouriting(page, story.title).click()
  await expect(favouriting(page, story.title)).toHaveAttribute('aria-pressed', 'true')

  // Favourites is a List, so the Story is on the one shelf every account has —
  // with the same entry the Catalogue hands over.
  await page.goto('/lists')
  const favourites = page.getByRole('heading', { name: 'Favourites' })
  await expect(favourites).toBeVisible()
  await expect(entryFor(page, story.title)).toBeVisible()
  await expect(entryFor(page, story.title)).toContainText('An Author')

  // The reading page shows the same state, because there is one place it is kept.
  await page.goto(`/read/${story.id}`)
  await expect(favouriting(page, story.title)).toHaveAttribute('aria-pressed', 'true')

  // And unfavouriting is taking it out of that List, from either page.
  await favouriting(page, story.title).click()
  await expect(favouriting(page, story.title)).toHaveAttribute('aria-pressed', 'false')

  await page.goto('/lists')
  await expect(entryFor(page, story.title)).toBeHidden()
  await expect(page.getByText('Nothing in this List yet.')).toBeVisible()
})

/** A List of the Author's own: written, filled, emptied, renamed and deleted. */
test('an Author writes a List, gathers Stories into it, and takes it away', async ({ page, otherAuthor }) => {
  const first = await listedByAnother(otherAuthor)
  const second = await listedByAnother(otherAuthor)

  await page.goto('/lists')
  await page.getByLabel('Title of a new List').fill('To read on the train')
  await page.getByRole('button', { name: 'Create List' }).click()
  await expect(page.getByRole('heading', { name: 'To read on the train' })).toBeVisible()

  // A Story is put on a shelf where the Story is, which is the Catalogue.
  await page.goto('/catalogue')
  for (const story of [first, second]) {
    // A `summary` is not a button and is addressed as what it is: the one
    // disclosure inside this Story's entry.
    await entryFor(page, story.title).locator('summary').click()
    await gathered(page, () => entryFor(page, story.title)
      .getByRole('checkbox', { name: `To read on the train — ${story.title}` }).check())
  }

  // The same Story sits in Favourites at the same time: one Story, several
  // Lists, and nothing about the one says anything about the other.
  await favouriting(page, first.title).click()

  await page.goto('/lists')
  const shelf = page.locator('section').filter({ hasText: 'To read on the train' })
  await expect(shelf.getByRole('listitem')).toHaveCount(2)
  await expect(page.locator('section').filter({ hasText: 'Favourites' })
    .getByRole('listitem')).toHaveCount(1)

  // Taken out of the List it was gathered into, and still where else it was put.
  await shelf.getByRole('button', { name: `Take out ${first.title}` }).click()
  await expect(shelf.getByRole('listitem')).toHaveCount(1)
  await expect(page.locator('section').filter({ hasText: 'Favourites' })
    .getByRole('listitem')).toHaveCount(1)

  // Renamed, and what is on it stays on it. Read back from the server rather
  // than off the field, which carries what was typed either way.
  await shelf.getByLabel('Title').fill('Read on the train')
  await shelf.getByRole('button', { name: 'Rename' }).click()
  await expect(shelf.getByRole('heading', { name: 'Read on the train' })).toBeVisible()

  await page.reload()
  const renamed = page.locator('section').filter({ hasText: 'Read on the train' })
  await expect(renamed.getByRole('heading', { name: 'Read on the train' })).toBeVisible()
  await expect(renamed.getByRole('listitem')).toHaveCount(1)

  // Deleted, and the Story it held is untouched: a List is one Author's
  // arrangement of work that is not theirs.
  await renamed.getByRole('button', { name: 'Delete Read on the train' }).click()
  await expect(page.getByRole('heading', { name: 'Read on the train' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Favourites' })).toBeVisible()
  await expect(entryFor(page, first.title)).toBeVisible()
})

/**
 * Favourites is the List every account has: it arrives with the account, carries
 * no title to write and cannot be deleted — and the refusals say so rather than
 * reading as absent.
 */
test('Favourites has no title to write and no way to be deleted', async ({ page, request }) => {
  // Nothing planted it: this account has never gathered anything, and the shelf
  // is there the first time it is asked for.
  await page.goto('/lists')
  const favourites = page.locator('section').filter({ hasText: 'Favourites' })
  await expect(favourites.getByRole('heading', { name: 'Favourites' })).toBeVisible()
  await expect(favourites.getByRole('button', { name: 'Rename' })).toBeHidden()
  await expect(favourites.getByRole('button', { name: /^Delete/ })).toBeHidden()

  const [mine] = await (await request.get('/api/lists')).json()
  expect(mine.title).toBe(null)

  const titled = await request.patch(`/api/lists/${mine.id}`, { data: { title: 'Kept' } })
  expect(titled.status()).toBe(400)
  expect((await titled.json()).message).toBe(
    'Favourites is the List every account has, so it has no title to write.')

  const deleted = await request.delete(`/api/lists/${mine.id}`)
  expect(deleted.status()).toBe(400)
  expect((await deleted.json()).message).toBe(
    'Favourites is the List every account has, so it cannot be deleted.')

  // Asked for again, it is the same one row: nothing wrote a second Favourites.
  const again = await (await request.get('/api/lists')).json()
  expect(again).toHaveLength(1)
  expect(again[0].id).toBe(mine.id)
})

/** Gathering the same Story twice changes nothing: the pair is the row. */
test('putting a Story in a List twice changes nothing', async ({ request, author, otherAuthor }) => {
  const story = await listedByAnother(otherAuthor)
  const list = await seedList(author, 'Twice')

  for (const attempt of [1, 2]) {
    const gathered = await request.put(`/api/lists/${list.id}/stories/${story.id}`)
    expect([attempt, gathered.status()]).toEqual([attempt, 200])
  }

  expect(await readListStories(list.id)).toHaveLength(1)

  // Taken out once, and there is nothing left to take out.
  expect((await request.delete(`/api/lists/${list.id}/stories/${story.id}`)).status()).toBe(200)
  expect((await request.delete(`/api/lists/${list.id}/stories/${story.id}`)).status()).toBe(404)
})

/**
 * No List of one Author is readable by another, at any URL. There is no route
 * that serves one by id, so what is proved here is that every route which takes
 * one refuses: somebody else's List is absent, exactly like somebody else's
 * Story.
 */
test('a List of another Author is absent at every address', async ({ request, otherAuthor }) => {
  const theirs = await seedList(otherAuthor, 'Theirs')
  const theirStory = await listedByAnother(otherAuthor)

  const mine = await (await request.get('/api/lists')).json()
  expect(mine.map((list: { id: string }) => list.id)).not.toContain(theirs.id)

  const refused = await Promise.all([
    request.patch(`/api/lists/${theirs.id}`, { data: { title: 'Mine now' } }),
    request.delete(`/api/lists/${theirs.id}`),
    request.put(`/api/lists/${theirs.id}/stories/${theirStory.id}`),
    request.delete(`/api/lists/${theirs.id}/stories/${theirStory.id}`),
  ])

  for (const response of refused) expect(response.status()).toBe(404)
  expect(await readListStories(theirs.id)).toEqual([])

  // A malformed id is a bad request rather than a server fault, and an
  // unpublished Story cannot be gathered at all: a List holds Stories anybody
  // can read.
  expect((await request.put('/api/lists/not-an-id/stories/not-an-id')).status()).toBe(400)

  const unpublished = await seedStory(otherAuthor, 'Theirs alone')
  const [favourites] = mine
  expect((await request.put(
    `/api/lists/${favourites.id}/stories/${unpublished.id}`)).status()).toBe(404)
})

/** A title is what a List gathers under, so an empty one is a refusal. */
test('a List needs a title', async ({ request }) => {
  const refused = await request.post('/api/lists', { data: { title: '  ' } })

  expect(refused.status()).toBe(400)
  expect((await refused.json()).message).toBe(
    'A List gathers Stories under a title, so it cannot be empty.')
})
