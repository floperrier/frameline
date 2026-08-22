import { expect, test } from '@playwright/test'

const anyId = '00000000-0000-4000-8000-000000000000'

test('every Scene and Shot endpoint rejects a request carrying no Author', async ({ request }) => {
  const responses = await Promise.all([
    request.get(`/api/stories/${anyId}`),
    request.post(`/api/stories/${anyId}/scenes`, { data: { name: 'A Scene' } }),
    request.delete(`/api/scenes/${anyId}`),
    request.post(`/api/scenes/${anyId}/shots`),
    request.patch(`/api/shots/${anyId}`, { data: { text: 'A line', description: '' } }),
    request.post(`/api/shots/${anyId}/move`, { data: { direction: 'earlier' } }),
    request.put(`/api/shots/${anyId}/conditions`, { data: { conditions: [] } }),
    request.delete(`/api/shots/${anyId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(401)
})
