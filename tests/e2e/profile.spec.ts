import { expect, test } from '@playwright/test'

const noSuchAuthor = '00000000-0000-4000-8000-000000000000'

test('a Profile is read without an account, and a Name is written only with one', async ({ request }) => {
  // Where a Name in the Catalogue leads, so it answers whoever turns up — and an
  // id nobody has is absent rather than a server fault.
  const absent = await request.get(`/api/profile/${noSuchAuthor}`)
  expect(absent.status()).toBe(404)
  expect((await absent.json()).message).toBe('No such Author.')

  expect((await request.get('/api/profile/not-an-id')).status()).toBe(400)

  // Writing a Name is writing about yourself, so it takes an account.
  expect((await request.patch('/api/author', { data: { name: 'Nobody' } })).status()).toBe(401)
})
