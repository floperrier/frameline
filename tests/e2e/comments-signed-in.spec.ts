import { randomUUID } from 'node:crypto'
import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  test,
  forgetName,
  readComments,
  seedComment,
  seedPublication,
  seedStory,
  signInAgain,
  writeStory,
} from './author'

/**
 * The reading page as somebody with no account meets it. Everything claimed
 * below about Comments being read without an account is claimed through this
 * rather than through the Author's own browser.
 *
 * A context opened here takes none of the suite's `use` options, so the address
 * it is pointed at and the language it announces are given by hand — but it does
 * inherit `extraHTTPHeaders`, which is where the fixture puts the Author's
 * sealed session. Emptying them is what actually makes this browser account-less:
 * without it the page renders signed in and every claim below is vacuous.
 */
async function readingFor(browser: Browser, baseURL: string | undefined, storyId: string) {
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const page = await context.newPage()
  await page.goto(`/read/${storyId}`)
  return page
}

/** One Comment on the page, found by the sentence nothing else on it carries. */
function commentSaying(page: Page, text: string) {
  return page.getByRole('listitem').filter({ hasText: text })
}

/** A sentence no other Comment in the database carries, so a locator can trust it. */
function unlikelySentence() {
  return `The bar scene lands ${randomUUID()}`
}

/** A published Story of the signed-in Author's, ready to be answered. */
async function published(request: Parameters<typeof writeStory>[0]) {
  const story = await writeStory(request)
  await request.post(`/api/stories/${story.id}/publish`)
  return story
}

/**
 * An Author answers a Story from the reading page, the Comment is signed, and
 * somebody with no account reads it — and is told why the form is not theirs
 * rather than being sent anywhere.
 */
test('an Author comments on a published Story and anyone reads what was said', async ({ page, request, author, browser, baseURL }) => {
  const said = unlikelySentence()
  const story = await published(request)

  await page.goto(`/read/${story.id}`)
  await expect(page.getByText('Nothing has been said about this Story yet.')).toBeVisible()

  await page.getByLabel('What you have to say about this Story').fill(said)
  await page.getByRole('button', { name: 'Add your Comment' }).click()

  // The Comment is under the Story, signed, and the Name leads to the Author
  // rather than to the work.
  const written = commentSaying(page, said)
  await expect(written).toBeVisible()
  await expect(written.getByRole('link', { name: 'An Author' }))
    .toHaveAttribute('href', new RegExp(`/profile/${author.id}$`))

  // The field is emptied by the write landing, so the next thing typed is not
  // typed onto the end of what was just said.
  await expect(page.getByLabel('What you have to say about this Story')).toHaveValue('')

  // Somebody with no account reads it, is offered no form, and is told why.
  const reader = await readingFor(browser, baseURL, story.id)
  await expect(commentSaying(reader, said)).toBeVisible()
  await expect(reader.getByLabel('What you have to say about this Story')).toBeHidden()
  await expect(reader.getByText(
    'Comments are signed with their Author\'s Name, so writing one needs an account.',
    { exact: false })).toBeVisible()
  await expect(reader).toHaveURL(`${baseURL}/read/${story.id}`)
})

test('Comments appear oldest first', async ({ request, author, otherAuthor, browser, baseURL }) => {
  const [earlier, later] = [unlikelySentence(), unlikelySentence()]
  const story = await published(request)

  await seedComment(story, otherAuthor, earlier)
  await seedComment(story, author, later)

  const reader = await readingFor(browser, baseURL, story.id)
  const said = await reader.getByRole('listitem').filter({ hasText: 'The bar scene lands' })
    .allTextContents()

  expect(said.findIndex(text => text.includes(earlier)))
    .toBeLessThan(said.findIndex(text => text.includes(later)))
  expect(said.findIndex(text => text.includes(earlier))).toBeGreaterThan(-1)
})

/**
 * Who may take a Comment away: the Author who wrote it, and the Author of the
 * Story it stands under. Nobody else, at any URL.
 */
test('an Author deletes their own Comment, and a Story\'s Author deletes any under theirs', async ({ page, request, author, otherAuthor }) => {
  const mine = unlikelySentence()
  const theirs = unlikelySentence()
  const story = await published(request)

  await request.post(`/api/stories/${story.id}/comments`, { data: { text: mine } })
  await seedComment(story, otherAuthor, theirs)

  // The Story is this Author's, so both are theirs to take away — their own
  // because they wrote it, the other because it stands under their Story.
  await page.goto(`/read/${story.id}`)
  for (const text of [theirs, mine]) {
    await commentSaying(page, text).getByRole('button').click()
    await expect(commentSaying(page, text)).toBeHidden()
  }

  expect(await readComments(story.id)).toEqual([])
})

test('nobody else deletes a Comment, at any URL', async ({ request, otherAuthor }) => {
  const said = unlikelySentence()
  const story = await seedStory(otherAuthor, 'Their Story')
  await seedPublication(story)
  const comment = await seedComment(story, otherAuthor, said)

  // Neither the Comment nor the Story is this Author's, so it is absent rather
  // than forbidden, like everything else they never wrote.
  expect((await request.delete(`/api/comments/${comment.id}`)).status()).toBe(404)
  expect(await readComments(story.id)).toHaveLength(1)
})

/**
 * What a Comment may point at, and what it may not: the Story whole, and never a
 * Scene or a Shot — see
 * `docs/adr/0027-a-comment-is-said-of-the-whole-story.md`.
 */
test('a Comment names the Story and nothing inside it', async ({ request }) => {
  const story = await published(request)

  const written = await request.post(`/api/stories/${story.id}/comments`, {
    data: { text: 'Said of the whole thing', sceneId: story.id, shotId: story.id },
  })

  expect(written.status()).toBe(200)
  // Whatever was sent alongside the text, nothing about a Scene or a Shot comes
  // back, because there is nowhere for it to have been written.
  expect(Object.keys(await written.json()).sort()).toEqual(['createdAt', 'id', 'text'])

  const listed = await request.get(`/api/stories/${story.id}/comments`)
  const [said] = (await listed.json()).comments
  expect(Object.keys(said).sort())
    .toEqual(['authorId', 'authorName', 'createdAt', 'id', 'text'])
})

test('a Comment carries text, and an unpublished Story carries none', async ({ request }) => {
  const story = await published(request)

  const empty = await request.post(`/api/stories/${story.id}/comments`, { data: { text: '  ' } })
  expect(empty.status()).toBe(400)
  expect((await empty.json()).message)
    .toBe('A Comment carries what you have to say, so it cannot be empty.')

  const long = await request.post(`/api/stories/${story.id}/comments`, {
    data: { text: 'M'.repeat(2001) },
  })
  expect(long.status()).toBe(400)
  expect((await long.json()).message)
    .toBe('A Comment cannot be longer than 2000 characters.')

  // An unpublished Story is its Author's alone, so it answers the way its
  // Reading would — even to the Author who wrote it.
  const unpublished = await writeStory(request)
  expect((await request.post(`/api/stories/${unpublished.id}/comments`, {
    data: { text: 'Too early' },
  })).status()).toBe(404)
  expect((await request.get(`/api/stories/${unpublished.id}/comments`)).status()).toBe(404)
})

/**
 * A Comment is signed, so an Author whose provider handed back no Name is
 * refused — and told where the one Name form in the product is, rather than
 * being grown a second one on somebody else's Story.
 */
test('an Author with no Name is asked for one before commenting', async ({ page, context, request, author, baseURL }) => {
  const story = await published(request)
  await signInAgain(context, await forgetName(author), baseURL)

  await page.goto(`/read/${story.id}`)
  await page.getByLabel('What you have to say about this Story').fill('Nameless')
  await page.getByRole('button', { name: 'Add your Comment' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'A Comment is signed with its Author\'s Name, so write yours on the list of '
    + 'your own Stories before commenting.')
  expect(await readComments(story.id)).toEqual([])
})
