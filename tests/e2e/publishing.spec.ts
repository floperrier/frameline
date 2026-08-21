import { expect, test } from '@playwright/test'

const anyStoryId = '00000000-0000-4000-8000-000000000000'

test('publishing needs an Author, and an unpublished Story is not there', async ({ request }) => {
  const responses = await Promise.all([
    request.post(`/api/stories/${anyStoryId}/publish`),
    request.delete(`/api/stories/${anyStoryId}/publish`),
  ])

  for (const response of responses) expect(response.status()).toBe(401)

  // Reading asks nothing of whoever asks, so what it refuses it refuses as absent.
  const read = await request.get(`/api/read/${anyStoryId}`)
  expect(read.status()).toBe(404)
})
