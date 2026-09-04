import { expect } from '@playwright/test'
import { ONE_PIXEL, live, seedListed, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Story is presented by one of its own frames: the Cover its Author names, or
 * the first Image of its Opening Scene standing in — see
 * `docs/adr/0040-a-story-is-presented-by-one-of-its-own-frames.md`.
 */

/** A Story whose two Scenes each carry one Image, read back the way the bench reads it. */
async function storyWithImages(request: Parameters<typeof writeStory>[0]) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  const [street, bar] = read.scenes
  const first = street!.shots[0]!
  const late = bar!.shots[0]!
  for (const shot of [first, late]) {
    expect((await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })).status()).toBe(200)
  }
  await request.post(`/api/scenes/${street!.id}/opening`)
  return { story, first, late }
}

test('the Opening Scene stands in until the Author names a Cover, on the bench and on the shelf', async ({ page, request }) => {
  const { story, first, late } = await storyWithImages(request)

  await page.goto(`/stories/${story.id}`)
  await live(page)

  const cover = page.getByRole('group', { name: 'Cover' })
  const standingIn = cover.getByRole('radio', { name: 'Shot 1 of The street as the Cover' })
  const named = cover.getByRole('radio', { name: 'Shot 1 of The bar as the Cover' })
  await expect(standingIn).toBeChecked()
  await expect(cover.getByRole('button', { name: 'Let the Opening Scene Stand In' })).toBeHidden()

  // Naming the other frame marks it, and offers the way back.
  await named.check()
  await expect(named).toBeChecked()
  await expect(cover.getByRole('button', { name: 'Let the Opening Scene Stand In' })).toBeVisible()
  const after: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  expect(after.coverShotId).toBe(late.id)

  // The shelf shows the named frame, and the reading page opens on it.
  await request.post(`/api/stories/${story.id}/publish`)
  await seedListed(story)
  await page.goto('/catalogue')
  const entry = page.locator('li', { has: page.getByRole('link', { name: story.title, exact: true }) })
  await expect(entry.locator('img.cover')).toHaveAttribute('src', `/api/shots/${late.id}/image`)
  await page.goto(`/read/${story.id}`)
  await expect(page.locator('header img.cover')).toHaveAttribute('src', `/api/shots/${late.id}/image`)

  // Taking the naming away leaves the Opening Scene standing in again.
  await page.goto(`/stories/${story.id}`)
  await live(page)
  await cover.getByRole('button', { name: 'Let the Opening Scene Stand In' }).click()
  await expect(standingIn).toBeChecked()
  await page.goto('/catalogue')
  await expect(entry.locator('img.cover')).toHaveAttribute('src', `/api/shots/${first.id}/image`)
})

test('deleting the Shot whose Image is the Cover falls back without a word', async ({ request }) => {
  const { story, first, late } = await storyWithImages(request)
  expect((await request.patch(`/api/stories/${story.id}`, { data: { coverShotId: late.id } })).status()).toBe(200)
  await request.post(`/api/stories/${story.id}/publish`)

  expect((await request.delete(`/api/shots/${late.id}`)).status()).toBe(200)
  const read = await (await request.get(`/api/read/${story.id}`)).json()
  expect(read.cover).toBe(`/api/shots/${first.id}/image`)
})

test('a Cover is one of the Story\'s own Images and nothing else', async ({ request }) => {
  const { story } = await storyWithImages(request)
  const other = await storyWithImages(request)

  const refused = await request.patch(`/api/stories/${story.id}`, { data: { coverShotId: other.first.id } })
  expect(refused.status()).toBe(400)
  expect(await refused.text()).toContain('A Cover is one of the Story\'s own Images.')

  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  const textOnly = read.scenes[0]!.shots[1]!
  expect((await request.patch(`/api/stories/${story.id}`, { data: { coverShotId: textOnly.id } })).status()).toBe(400)
})
