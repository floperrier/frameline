import { expect, test } from '@playwright/test'

const anyStoryId = '00000000-0000-4000-8000-000000000000'

test('the Catalogue is read without an account, and listing needs an Author', async ({ request }) => {
  // The one page a Story is found on rather than sent to, so it answers whoever
  // asks — signed in or not.
  const catalogue = await request.get('/api/catalogue')
  expect(catalogue.status()).toBe(200)
  expect(Array.isArray(await catalogue.json())).toBe(true)

  const responses = await Promise.all([
    request.post(`/api/stories/${anyStoryId}/listed`),
    request.delete(`/api/stories/${anyStoryId}/listed`),
  ])

  for (const response of responses) expect(response.status()).toBe(401)
})
