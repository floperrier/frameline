import { expect } from '@playwright/test'
import { readStory, seedStory, test, writeStory } from './author'

const noStoryId = '00000000-0000-4000-8000-000000000000'

test('an Author writes, renames and deletes a Story', async ({ request }) => {
  await expect((await request.get('/api/stories')).json()).resolves.toEqual([])

  const created = await request.post('/api/stories', { data: { title: 'A Story' } })
  expect(created.status()).toBe(201)
  const story = await created.json()
  expect(story).toMatchObject({ title: 'A Story' })

  const renamed = await request.patch(`/api/stories/${story.id}`, { data: { title: 'Renamed' } })
  expect(await renamed.json()).toEqual({ id: story.id, title: 'Renamed' })
  await expect((await request.get('/api/stories')).json()).resolves.toEqual([
    { id: story.id, title: 'Renamed' },
  ])

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

  // The Story is named in the question, and by nothing but its title: the list
  // carries ids and titles, so there is nothing to count.
  const asking = page.getByRole('dialog')
  await expect(asking).toContainText('“A Story” goes, and everything written in it.')

  await asking.getByRole('button', { name: 'Leave it' }).click()
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

test('the Stories page lists what the Author wrote', async ({ page, request }) => {
  await request.post('/api/stories', { data: { title: 'A Listed Story' } })

  await page.goto('/stories')

  await expect(page.getByRole('link', { name: 'Open A Listed Story' })).toBeVisible()
})

test('an Author on the landing page is shown their Stories rather than a door', async ({
  page,
}) => {
  await page.goto('/')

  // Both places the way in is offered — beside the pitch and at the foot — carry
  // the same thing for somebody who is already signed in.
  await expect(page.getByRole('link', { name: 'Your Stories' })).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toHaveCount(0)
})
