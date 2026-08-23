import { expect, test } from '@playwright/test'

const anyId = '00000000-0000-4000-8000-000000000000'

test('every graph endpoint rejects a request carrying no Author', async ({ request }) => {
  const responses = await Promise.all([
    request.patch(`/api/scenes/${anyId}`, { data: { x: 10, y: 10 } }),
    request.post(`/api/scenes/${anyId}/opening`),
    request.post(`/api/scenes/${anyId}/cuts`, { data: { toSceneId: anyId } }),
    request.patch(`/api/cuts/${anyId}`, { data: { text: 'Follow her' } }),
    request.put(`/api/scenes/${anyId}/cuts/places`, { data: { places: [anyId] } }),
    request.delete(`/api/cuts/${anyId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(401)
})
