import { expect, test } from '@playwright/test'

const anyId = '00000000-0000-4000-8000-000000000000'

test('depositing a Sound needs an Author, and none is there to be heard', async ({ request }) => {
  for (const path of [`/api/scenes/${anyId}/sound`, `/api/shots/${anyId}/sound`]) {
    expect((await request.put(path, { data: Buffer.from('ID3') })).status()).toBe(401)
    expect((await request.delete(path)).status()).toBe(401)
    // Being heard asks nothing of whoever asks, so what it refuses it refuses as
    // absent: an unpublished Story and one nobody wrote answer alike.
    expect((await request.get(path)).status()).toBe(404)
  }
})
