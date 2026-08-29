import { expect, test } from '@playwright/test'

const anyStoryId = '00000000-0000-4000-8000-000000000000'
const anyCommentId = '00000000-0000-4000-8000-000000000001'

test('Comments are read without an account, and written only with one', async ({ request }) => {
  // What stands under a Story is exactly as reachable as the Story: a Story
  // nobody wrote and a Story nobody published are the same not-found the Reading
  // answers with.
  const absent = await request.get(`/api/stories/${anyStoryId}/comments`)
  expect(absent.status()).toBe(404)
  expect((await absent.json()).message).toBe('No such Story.')

  expect((await request.get('/api/stories/not-an-id/comments')).status()).toBe(400)

  // Every Comment is signed, so writing one takes an account — and so does
  // taking one away.
  const written = await request.post(`/api/stories/${anyStoryId}/comments`, {
    data: { text: 'Beautiful' },
  })
  expect(written.status()).toBe(401)
  expect((await request.delete(`/api/comments/${anyCommentId}`)).status()).toBe(401)
})
