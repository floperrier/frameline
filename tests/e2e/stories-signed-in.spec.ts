import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  ONE_PIXEL,
  live,
  readStory,
  seedComment,
  seedListed,
  seedStory,
  test,
  writeStory,
} from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

const noStoryId = '00000000-0000-4000-8000-000000000000'

test('an Author writes, renames and deletes a Story', async ({ request }) => {
  await expect((await request.get('/api/stories')).json()).resolves.toEqual([])

  const created = await request.post('/api/stories', { data: { title: 'A Story' } })
  expect(created.status()).toBe(201)
  const story = await created.json()
  expect(story).toMatchObject({ title: 'A Story' })

  const renamed = await request.patch(`/api/stories/${story.id}`, { data: { title: 'Renamed' } })
  expect(await renamed.json()).toEqual({ id: story.id, title: 'Renamed' })
  await expect((await request.get('/api/stories')).json()).resolves.toEqual([{
    id: story.id,
    title: 'Renamed',
    language: 'en',
    synopsis: '',
    publishedAt: null,
    listed: false,
    cover: null,
    comments: 0,
  }])

  expect((await request.delete(`/api/stories/${story.id}`)).status()).toBe(200)
  await expect((await request.get('/api/stories')).json()).resolves.toEqual([])

  // Gone from the list is not the same as gone: the id has to read as absent too.
  const renameOfDeleted = await request.patch(`/api/stories/${story.id}`, { data: { title: 'Back' } })
  expect(renameOfDeleted.status()).toBe(404)
})

test('an Author is asked before a Story goes, and can leave it', async ({ page, request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()

  await page.goto('/stories')
  const control = page.getByRole('button', { name: 'Delete A Story' })
  await control.click()

  // The Story is named in the question, and by nothing but its title: what goes
  // is the whole work, and no figure makes "everything written in it" truer.
  const asking = page.getByRole('dialog')
  await expect(asking).toContainText('“A Story” goes, and everything written in it.')

  await asking.getByRole('button', { name: 'Leave It' }).click()
  await expect(asking).toBeHidden()
  await expect(control).toBeFocused()
  await expect(readStory(story.id)).resolves.toEqual({ id: story.id, title: 'A Story' })

  // The destructive verb says what it does, and only then is the Story gone.
  await control.click()
  await asking.getByRole('button', { name: 'Delete Story' }).click()
  await expect(page.getByText('No Stories yet.')).toBeVisible()
  await expect(readStory(story.id)).resolves.toBeUndefined()
})

/**
 * The bench's own header, on the side that says what the Story is: the title is
 * written where the Story is worked on rather than on the list of Stories, the
 * Language it is written in is stated beside it, and the Locale — a property of
 * whoever is reading and not of the Story — is not there at all.
 */
test('an Author renames a Story on the bench, beside the Language it is written in', async ({
  page,
  request,
}) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  // The heading is the field: what names the Story on the bench is what is in
  // the box the Author types the name into.
  const title = page.getByRole('textbox', { name: 'Title of this Story' })
  await expect(title).toHaveValue('A Story')
  await title.fill('The night shift')
  await title.blur()

  // A typed write, so it leaves the two quiet marks and announces nothing.
  await expect(page.getByText(/^Kept at /)).toBeVisible()
  await expect(readStory(story.id)).resolves.toEqual({ id: story.id, title: 'The night shift' })
  await expect(page.getByRole('heading', { name: 'The night shift' })).toBeVisible()

  // The Language is stated and not offered: nothing translates a Story, so there
  // is no later moment at which it changes.
  await expect(page.getByText('Written in English')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Language/ })).toHaveCount(0)

  // The interface's Locale has left the bench — see
  // `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`. It is
  // changed on the list of the Author's own Stories, which is theirs rather than
  // a Story's.
  await expect(page.getByRole('link', { name: 'Français' })).toHaveCount(0)
  await page.goto('/stories')
  await expect(page.getByRole('link', { name: 'Français' })).toBeVisible()

  // The shelf has no rename of its own: the title it shows is the one written on
  // the bench.
  await expect(page.getByRole('link', { name: 'The night shift', exact: true }))
    .toHaveAttribute('href', `/stories/${story.id}`)
  await expect(page.getByRole('button', { name: 'Rename' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0)
})

test('a Synopsis is the few lines it says it is, and a Story still needs a title', async ({
  request,
}) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()

  const long = await request.patch(`/api/stories/${story.id}`, {
    data: { synopsis: 'A woman leaves. '.repeat(60) },
  })
  expect(long.status()).toBe(400)
  expect((await long.json()).message).toContain(
    'A Synopsis cannot be longer than 600 characters.')

  // A body naming neither field changes nothing, and is refused as the one thing
  // a Story cannot be without being asked for.
  const nothing = await request.patch(`/api/stories/${story.id}`, { data: {} })
  expect(nothing.status()).toBe(400)
  expect((await nothing.json()).message).toContain('A Story needs a title.')
})

test('a Story needs a title', async ({ request }) => {
  const response = await request.post('/api/stories', { data: { title: '   ' } })

  expect(response.status()).toBe(400)
  expect((await response.json()).message).toContain('A Story needs a title.')
})

test('a Story that was never written reads as absent', async ({ request }) => {
  const responses = await Promise.all([
    request.patch(`/api/stories/${noStoryId}`, { data: { title: 'Renamed' } }),
    request.delete(`/api/stories/${noStoryId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)
})

test('a Story belongs to the one Author who wrote it', async ({ request, otherAuthor }) => {
  const theirs = await seedStory(otherAuthor, 'Their Story')

  await expect((await request.get('/api/stories')).json()).resolves.toEqual([])

  const responses = await Promise.all([
    request.patch(`/api/stories/${theirs.id}`, { data: { title: 'Mine now' } }),
    request.delete(`/api/stories/${theirs.id}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)

  // The 404s have to mean the Story was left alone, not merely that the answer
  // said nothing about a Story that was changed anyway.
  await expect(readStory(theirs.id)).resolves.toEqual(theirs)
})

/**
 * What the empty list promises — name one above, and it opens — is where the
 * Author ends up, and it is where they end up on the second Story as well as on
 * the first: the form navigates always, or the promise holds for one act only.
 */
test('an Author who names a Story lands on its bench', async ({ page }) => {
  await page.goto('/stories')
  await live(page)
  await expect(page.getByText('No Stories yet.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Title of a new Story' }).fill('The night shift')
  await page.getByRole('button', { name: 'Create Story' }).click()

  await expect(page).toHaveURL(/\/stories\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('textbox', { name: 'Title of this Story' }))
    .toHaveValue('The night shift')

  // The row is in the list behind them — reached the way the Author would reach
  // it, from the bench — and naming a second Story from a list that is no longer
  // empty opens that one too.
  await page.getByRole('link', { name: 'All Stories' }).click()
  await expect(page.getByRole('link', { name: 'The night shift', exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Title of a new Story' }).fill('A second Story')
  await page.getByRole('button', { name: 'Create Story' }).click()

  await expect(page).toHaveURL(/\/stories\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('textbox', { name: 'Title of this Story' }))
    .toHaveValue('A second Story')
})

/**
 * `writeStory` under a title of its own, with an Image put on the first Shot of
 * each Scene named, read back the way the bench reads it so the Shots carrying
 * them can be pointed at.
 */
async function storyWithImages(request: APIRequestContext, title: string, scenes: number) {
  const story = await writeStory(request)
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  const imaged = read.scenes.slice(0, scenes).map(scene => scene.shots[0]!)
  for (const shot of imaged) {
    expect((await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })).status()).toBe(200)
  }

  return { story: { id: story.id, title }, imaged }
}

/**
 * The page an Author lands on is a shelf of their own works, drawn the way every
 * shelf draws a Story — and, being theirs, it says where each one stands: not
 * published, published on a day, Listed, and how much has been said under it.
 */
test('an Author’s own Stories are a shelf, newest first, each saying where it stands', async ({
  page,
  request,
  otherAuthor,
}) => {
  // Published and Listed, presented by the one Image of its Opening Scene.
  const first = await storyWithImages(request, 'The first reel', 1)
  await request.post(`/api/stories/${first.story.id}/publish`)
  await seedListed(first.story)

  // Published and not Listed, with a Cover named past the Opening Scene's first
  // Image, a Synopsis, and two Comments somebody else wrote.
  const second = await storyWithImages(request, 'The second reel', 2)
  const named = second.imaged[1]!
  await request.patch(`/api/stories/${second.story.id}`, {
    data: { coverShotId: named.id, synopsis: 'A woman leaves a bar at closing time.' },
  })
  await request.post(`/api/stories/${second.story.id}/publish`)
  await seedComment(second.story, otherAuthor, 'I read it twice.')
  await seedComment(second.story, otherAuthor, 'The bar stayed with me.')

  // New, unpublished, and with nothing to show.
  await request.post('/api/stories', { data: { title: 'The third reel' } })

  await page.goto('/stories')
  await live(page)
  const entry = (title: string) =>
    page.locator('li', { has: page.getByRole('link', { name: title, exact: true }) })

  await expect(page.locator('ul.entries > li .open'))
    .toHaveText(['The third reel', 'The second reel', 'The first reel'])

  const newest = entry('The third reel')
  await expect(newest).toContainText('English')
  await expect(newest).toContainText('Not published')
  await expect(newest.locator('img')).toHaveCount(0)
  await expect(newest.locator('time')).toHaveCount(0)

  const commented = entry('The second reel')
  await expect(commented.locator('img.cover')).toHaveAttribute('src', `/api/shots/${named.id}/image`)
  await expect(commented).toContainText('A woman leaves a bar at closing time.')
  await expect(commented.locator('time')).toBeVisible()
  await expect(commented).not.toContainText('Not published')
  await expect(commented).not.toContainText('Listed')
  const said = commented.getByRole('link', { name: '2 Comments', exact: true })
  await expect(said).toHaveAttribute('href', `/read/${second.story.id}#comments`)

  const listed = entry('The first reel')
  await expect(listed.locator('img.cover'))
    .toHaveAttribute('src', `/api/shots/${first.imaged[0]!.id}/image`)
  await expect(listed.locator('time')).toBeVisible()
  await expect(listed).toContainText('Listed')
  await expect(listed.getByRole('link', { name: /Comment/ })).toHaveCount(0)

  // The title leads to the bench, where the Story is worked on, and not to the
  // Reading every other shelf hands over.
  await listed.getByRole('link', { name: 'The first reel', exact: true }).click()
  await expect(page).toHaveURL(`/stories/${first.story.id}`)
  await expect(page.getByRole('textbox', { name: 'Title of this Story' })).toHaveValue('The first reel')

  // The count leads to what was said, on the reading page, with it in view.
  await page.goto('/stories')
  await live(page)
  await entry('The second reel').getByRole('link', { name: '2 Comments', exact: true }).click()
  await expect(page).toHaveURL(`/read/${second.story.id}#comments`)
  await expect(page.locator('#comments')).toBeInViewport()
  await expect(page.getByText('I read it twice.')).toBeVisible()
})

test.describe('read in French', () => {
  test.use({ locale: 'fr-FR' })

  test('the shelf leads to the bench in the Locale it is read in', async ({ page, request, otherAuthor }) => {
    const story = await writeStory(request)
    await request.post(`/api/stories/${story.id}/publish`)
    await seedComment(story, otherAuthor, 'Une belle histoire.')
    await request.post('/api/stories', { data: { title: 'Un Récit' } })

    await page.goto('/fr/stories')
    const draft = page.getByRole('link', { name: 'Un Récit', exact: true })
    await expect(draft).toHaveAttribute('href', /\/fr\/stories\/[0-9a-f-]{36}$/)
    await expect(page.locator('li', { has: draft })).toContainText('Non publié')

    // The public link carries no locale, whichever shelf leads to it.
    await expect(page.getByRole('link', { name: '1 Commentaire', exact: true }))
      .toHaveAttribute('href', `/read/${story.id}#comments`)
  })
})

/**
 * The count is the Author's, on the Author's own shelf: every other shelf still
 * hands a Story over by its Reading, and none of them says how much was said.
 */
test('every other shelf still leads to the Reading and counts nothing', async ({
  page,
  request,
  author,
  otherAuthor,
}) => {
  const story = await writeStory(request)
  const title = `Said of ${story.id}`
  await request.patch(`/api/stories/${story.id}`, { data: { title } })
  await request.post(`/api/stories/${story.id}/publish`)
  await seedListed(story)
  await seedComment(story, otherAuthor, 'I read it twice.')
  const [favourites] = await (await request.get('/api/lists')).json()
  expect((await request.put(`/api/lists/${favourites.id}/stories/${story.id}`)).status()).toBe(200)

  for (const shelf of ['/catalogue', `/profile/${author.id}`, '/lists']) {
    await page.goto(shelf)
    const named = page.getByRole('link', { name: title, exact: true })
    await expect(named).toHaveAttribute('href', `/read/${story.id}`)
    await expect(page.locator('li', { has: named })).not.toContainText('Comment')
  }
})

test('an Author on the landing page is shown their Stories rather than a door', async ({
  page,
}) => {
  await page.goto('/')

  // Both places the way in is offered — beside the pitch and at the foot — carry
  // the same thing for somebody who is already signed in.
  await expect(page.getByRole('link', { name: 'Your Stories' })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Sign In with GitHub' })).toHaveCount(0)
})
