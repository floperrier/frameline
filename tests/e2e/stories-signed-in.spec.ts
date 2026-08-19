import { expect } from '@playwright/test'
import { test } from './author'

const someoneElsesStoryId = '00000000-0000-4000-8000-000000000000'

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
})

test('a Story needs a title', async ({ request }) => {
  const response = await request.post('/api/stories', { data: { title: '   ' } })

  expect(response.status()).toBe(400)
  expect(await response.text()).toContain('A Story needs a title.')
})

test('a Story this Author does not own reads as absent', async ({ request }) => {
  const responses = await Promise.all([
    request.patch(`/api/stories/${someoneElsesStoryId}`, { data: { title: 'Renamed' } }),
    request.delete(`/api/stories/${someoneElsesStoryId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)
})

test('the Stories page lists what the Author wrote', async ({ page, request }) => {
  await request.post('/api/stories', { data: { title: 'A Listed Story' } })

  await page.goto('/stories')

  await expect(page.getByText('A Listed Story')).toBeVisible()
})
