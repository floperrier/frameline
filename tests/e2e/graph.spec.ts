import { expect, test } from '@playwright/test'

const anyId = '00000000-0000-4000-8000-000000000000'

test('every graph endpoint rejects a request carrying no Author', async ({ request }) => {
  const responses = await Promise.all([
    request.patch(`/api/scenes/${anyId}`, { data: { name: 'Renamed' } }),
    request.post(`/api/scenes/${anyId}/opening`),
    request.post(`/api/scenes/${anyId}/exits`, { data: { toSceneId: anyId } }),
    request.patch(`/api/exits/${anyId}`, { data: { text: 'Follow her' } }),
    request.put(`/api/scenes/${anyId}/exits/places`, { data: { places: [anyId] } }),
    request.delete(`/api/exits/${anyId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(401)
})
