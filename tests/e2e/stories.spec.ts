import { expect, test } from '@playwright/test'

const anyStoryId = '00000000-0000-4000-8000-000000000000'

test('every Story endpoint rejects a request carrying no Author', async ({ request }) => {
  const responses = await Promise.all([
    request.get('/api/stories'),
    request.post('/api/stories', { data: { title: 'A Story' } }),
    request.patch(`/api/stories/${anyStoryId}`, { data: { title: 'Renamed' } }),
    request.delete(`/api/stories/${anyStoryId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(401)
})
