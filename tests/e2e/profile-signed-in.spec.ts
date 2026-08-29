import { randomUUID } from 'node:crypto'
import type { Browser } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  test,
  forgetName,
  readAuthorName,
  seedAvatar,
  seedListed,
  seedPublished,
  seedStory,
  signInAgain,
  writeStory,
} from './author'

/**
 * The Name and the Profile it leads to, read by somebody with no account: their
 * own context, so no session and no cookie of ours. A context opened here takes
 * none of the suite's own settings, so the address it is pointed at and the
 * language it announces are given by hand.
 */
async function reader(browser: Browser, baseURL: string | undefined, at: string) {
  const page = await (await browser.newContext({ baseURL, locale: 'en-US' })).newPage()
  await page.goto(at)
  return page
}

/** A title no other Story in the database has, so a locator can trust it. */
function unlikelyTitle() {
  return `The last reel ${randomUUID()}`
}

/**
 * The Name asked for in the listing itself, the first time an Author lists
 * anything, and never again — and never at all for publishing, which hands out a
 * link nobody signs.
 */
test('an Author with no Name is asked for one in the listing, once', async ({ page, context, baseURL, request, author }) => {
  await signInAgain(context, await forgetName(author), baseURL)
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  // Publishing asks nothing: a link is handed over rather than put on a shelf.
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByLabel('Your Name')).toBeHidden()

  await page.getByRole('button', { name: 'List this Story in the Catalogue' }).click()
  await expect(page.getByLabel('Your Name')).toBeVisible()

  // Asked in the act that needs it, and answered in the same gesture: the Story
  // is listed as soon as the Name is given.
  await page.getByLabel('Your Name').fill('Vivian Marsh')
  await page.getByRole('button', { name: 'List it under this Name' }).click()
  await expect(page.getByRole('button', { name: 'Take this Story out of the Catalogue' }))
    .toBeVisible()
  expect(await readAuthorName(author.id)).toBe('Vivian Marsh')

  // A second Story lists in one click: the Name is written, so there is nothing
  // left to ask.
  const second = await writeStory(request)
  await page.goto(`/stories/${second.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await page.getByRole('button', { name: 'List this Story in the Catalogue' }).click()
  await expect(page.getByRole('button', { name: 'Take this Story out of the Catalogue' }))
    .toBeVisible()
  await expect(page.getByLabel('Your Name')).toBeHidden()
})

/**
 * A Listed Story is signed, and the signature leads to whoever wrote it: the
 * Catalogue hands over the work one way and the Author the other.
 */
test('a Catalogue entry carries the Name, and the Name opens the Profile', async ({ page, request, author, browser, baseURL }) => {
  const title = unlikelyTitle()
  const name = `Vivian Marsh ${randomUUID()}`
  const avatar = 'https://avatars.example.test/vivian.png'

  await seedAvatar(author, avatar)
  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)

  await page.goto('/stories')
  await page.getByLabel('Your Name').fill(name)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByLabel('Your Name')).toHaveValue(name)
  await request.post(`/api/stories/${story.id}/listed`)

  const catalogue = await reader(browser, baseURL, '/catalogue')
  const entry = catalogue.getByRole('listitem').filter({ hasText: title })
  await expect(entry).toContainText(name)

  await entry.getByRole('link', { name }).click()
  await expect(catalogue).toHaveURL(`${baseURL}/profile/${author.id}`)

  // What a Profile carries: the Name, the picture the provider serves, and the
  // Stories this Author has Listed.
  await expect(catalogue.getByRole('heading', { name })).toBeVisible()
  await expect(catalogue.locator(`img[src="${avatar}"]`)).toBeVisible()
  await expect(catalogue.getByRole('link', { name: title })).toBeVisible()

  // The email is on no screen in the product, this one least of all.
  await expect(catalogue.getByText(author.email)).toBeHidden()
})

/** A Profile gathers what is Listed and nothing else. */
test('a Profile shows the Listed Stories alone', async ({ otherAuthor, browser, baseURL }) => {
  const [listed, published, written] = [unlikelyTitle(), unlikelyTitle(), unlikelyTitle()]

  const shown = await seedStory(otherAuthor, listed)
  await seedPublished(shown)
  await seedListed(shown)
  await seedPublished(await seedStory(otherAuthor, published))
  await seedStory(otherAuthor, written)

  const profile = await reader(browser, baseURL, `/profile/${otherAuthor.id}`)

  await expect(profile.getByRole('link', { name: listed })).toBeVisible()
  await expect(profile.getByText(published)).toBeHidden()
  await expect(profile.getByText(written)).toBeHidden()
})

/**
 * The Name is the Author's to rewrite, and every place it appears follows: a
 * Story listed under the old one is signed with the new the moment it is
 * written.
 */
test('rewriting the Name follows everywhere it appears', async ({ page, request, author, browser, baseURL }) => {
  const title = unlikelyTitle()
  const [first, second] = [`Ruth Kane ${randomUUID()}`, `Ruth Verhoeven ${randomUUID()}`]

  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)

  await page.goto('/stories')
  await page.getByLabel('Your Name').fill(first)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => readAuthorName(author.id)).toBe(first)
  await request.post(`/api/stories/${story.id}/listed`)

  await page.getByLabel('Your Name').fill(second)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => readAuthorName(author.id)).toBe(second)

  const catalogue = await reader(browser, baseURL, '/catalogue')
  const entry = catalogue.getByRole('listitem').filter({ hasText: title })
  await expect(entry).toContainText(second)
  await expect(entry).not.toContainText(first)

  const profile = await reader(browser, baseURL, `/profile/${author.id}`)
  await expect(profile.getByRole('heading', { name: second })).toBeVisible()
})

/** A Name is what an Author appears under, so blank is a refusal. */
test('a Name cannot be blank, and cannot be written for somebody else', async ({ request, author }) => {
  const refused = await request.patch('/api/author', { data: { name: '   ' } })

  expect(refused.status()).toBe(400)
  expect((await refused.json()).message).toContain(
    'A Name is what you appear under, so it cannot be empty.')

  const long = await request.patch('/api/author', { data: { name: 'M'.repeat(61) } })
  expect(long.status()).toBe(400)

  // The Author written is the one signed in: there is no id in the request to
  // point at anybody else.
  expect(await readAuthorName(author.id)).toBe('An Author')
})

/** Listing refuses before the Catalogue can hold an unsigned entry. */
test('a Story is not listed until its Author has a Name', async ({ request, author }) => {
  await forgetName(author)
  const story = await writeStory(request)
  await request.post(`/api/stories/${story.id}/publish`)

  const refused = await request.post(`/api/stories/${story.id}/listed`)

  expect(refused.status()).toBe(400)
  expect((await refused.json()).message).toContain(
    'A Story is listed under its Author\'s Name, so write yours before listing it.')

  await request.patch('/api/author', { data: { name: 'Vivian Marsh' } })
  expect((await request.post(`/api/stories/${story.id}/listed`)).status()).toBe(200)
})
