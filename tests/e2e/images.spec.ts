import { expect, test } from '@playwright/test'
import { ONE_PIXEL } from './author'

const anyShotId = '00000000-0000-4000-8000-000000000000'

test('attaching an image needs an Author, and no image is there to read', async ({ request }) => {
  const attached = await request.put(`/api/shots/${anyShotId}/image`, { data: ONE_PIXEL })
  expect(attached.status()).toBe(401)

  // Reading asks nothing of whoever asks, so what it refuses it refuses as absent.
  const read = await request.get(`/api/shots/${anyShotId}/image`)
  expect(read.status()).toBe(404)
})
