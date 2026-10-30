import { createHash, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { A_SOUND, ONE_PIXEL, test, writeStory } from './author'

/**
 * Once a day the instance erases the objects nothing names any more: those of
 * deleted Stories, replaced Images, removed Sounds and Shots deleted over a day
 * ago — see `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. The
 * cron calls `/api/sweep` with the secret Vercel holds, and nothing else may.
 *
 * Every medium here is bytes of its own, the pixel or the silence with a tail
 * nobody else carries: the sweep reaches every row the instance holds, and the
 * pixel other specs are writing at the same moment must never be one it ages.
 * The sweep reaches them all, so the specs that call it run one at a time.
 */

const sql = neon(process.env.DATABASE_URL!)
const SECRET = process.env.CRON_SECRET!

test.describe.configure({ mode: 'serial' })

/** Bytes nobody else holds, read as the type of the bytes they start with. */
function ownBytes(of: Buffer) {
  return Buffer.concat([of, randomBytes(16)])
}

function digestOf(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Ages a medium past the day the sweep spares, which no request can do: the
 * last time anything used it is put two days back.
 */
async function age(bytes: Buffer) {
  await sql`update media set used_at = now() - interval '2 days' where digest = ${digestOf(bytes)}`
}

/** The cron's own call, with the secret it carries. */
function sweep(request: APIRequestContext) {
  return request.get('/api/sweep', { headers: { authorization: `Bearer ${SECRET}` } })
}

/** The address in the bucket a door signs, as the browser would be sent to it. */
async function signedBehind(request: APIRequestContext, door: string) {
  const sent = await request.get(door, { maxRedirects: 0 })
  expect(sent.status()).toBe(302)
  return sent.headers()['location']!
}

/** `writeStory`, with the first Shot of its opening Scene handed back. */
async function aStoryAndAShot(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes: [street] }: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  return { story, street: street!, shot: street!.shots[0]! }
}

test('the sweep refuses a call without the secret, or with another', async ({ request }) => {
  expect((await request.get('/api/sweep')).status()).toBe(401)
  expect((await request.get('/api/sweep', {
    headers: { authorization: `Bearer ${SECRET}-not` },
  })).status()).toBe(401)
  expect((await request.get('/api/sweep', { headers: { authorization: SECRET } })).status()).toBe(401)
})

test('an aged medium nothing names is erased, and its signed address stops answering', async ({ request }) => {
  const { shot } = await aStoryAndAShot(request)
  const replaced = ownBytes(ONE_PIXEL)
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: replaced })).ok()).toBe(true)
  const address = await signedBehind(request, `/api/shots/${shot.id}/image`)
  expect((await request.get(address)).status()).toBe(200)

  // Replaced, so nothing names the first bytes any more.
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: ownBytes(ONE_PIXEL) })).ok()).toBe(true)
  await age(replaced)

  const swept = await sweep(request)
  expect(swept.status()).toBe(200)
  expect((await swept.json()).erased).toContain(digestOf(replaced))
  expect((await request.get(address)).status()).toBe(404)
})

test('an aged medium a Shot, a Scene, an Edition or a held Shot names is kept', async ({ request }) => {
  const { story, street, shot } = await aStoryAndAShot(request)
  const [shown, heard, published, held] = [ONE_PIXEL, A_SOUND, ONE_PIXEL, ONE_PIXEL].map(ownBytes)

  expect((await request.put(`/api/shots/${shot.id}/image`, { data: shown })).ok()).toBe(true)
  expect((await request.put(`/api/scenes/${street.id}/sound`, { data: heard })).ok()).toBe(true)

  // Named by the Edition alone, once the Shot shows something else.
  const other = street.shots[1]!
  expect((await request.put(`/api/shots/${other.id}/image`, { data: published })).ok()).toBe(true)
  expect((await request.post(`/api/stories/${story.id}/publish`)).ok()).toBe(true)
  expect((await request.put(`/api/shots/${other.id}/image`, { data: ownBytes(ONE_PIXEL) })).ok()).toBe(true)

  // Named by a Shot deleted a moment ago, which can still be put back.
  const { id: third } = await (await request.post(`/api/scenes/${street.id}/shots`)).json()
  expect((await request.put(`/api/shots/${third}/image`, { data: held })).ok()).toBe(true)
  expect((await request.delete(`/api/shots/${third}`)).ok()).toBe(true)

  for (const bytes of [shown, heard, published, held]) await age(bytes)
  const swept = await sweep(request)
  expect(swept.status()).toBe(200)
  const { erased } = await swept.json()
  for (const bytes of [shown, heard, published, held]) expect(erased).not.toContain(digestOf(bytes))

  expect(await (await request.get(`/api/shots/${shot.id}/image`)).body()).toEqual(shown)
  expect(await (await request.get(`/api/scenes/${street.id}/sound`)).body()).toEqual(heard)
  expect(await (await request.get(`/api/read/${story.id}/media/${digestOf(published)}`)).body())
    .toEqual(published)
  expect((await request.post(`/api/shots/${third}/back`, { data: { after: null } })).status()).toBe(201)
  expect(await (await request.get(`/api/shots/${third}/image`)).body()).toEqual(held)
})

test('a medium used within the day is kept, though nothing names it', async ({ request }) => {
  const { shot } = await aStoryAndAShot(request)
  const recent = ownBytes(ONE_PIXEL)
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: recent })).ok()).toBe(true)
  const address = await signedBehind(request, `/api/shots/${shot.id}/image`)
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: ownBytes(ONE_PIXEL) })).ok()).toBe(true)

  const swept = await sweep(request)
  expect(swept.status()).toBe(200)
  expect((await swept.json()).erased).not.toContain(digestOf(recent))
  expect(await (await request.get(address)).body()).toEqual(recent)
})

test('a Shot held over a day is let go of with its medium, and one held less comes back whole', async ({ request }) => {
  const { street } = await aStoryAndAShot(request)
  const [old, fresh] = [ONE_PIXEL, ONE_PIXEL].map(ownBytes)
  const shots: string[] = []
  for (const bytes of [old, fresh]) {
    const { id } = await (await request.post(`/api/scenes/${street.id}/shots`)).json()
    expect((await request.put(`/api/shots/${id}/image`, { data: bytes })).ok()).toBe(true)
    expect((await request.delete(`/api/shots/${id}`)).ok()).toBe(true)
    shots.push(id)
  }
  const [gone, kept] = shots

  await sql`update deleted_shots set taken_at = now() - interval '2 days' where shot_id = ${gone}`
  for (const bytes of [old, fresh]) await age(bytes)

  const swept = await sweep(request)
  expect(swept.status()).toBe(200)
  const { erased } = await swept.json()
  expect(erased).toContain(digestOf(old))
  expect(erased).not.toContain(digestOf(fresh))

  expect((await request.post(`/api/shots/${gone}/back`, { data: { after: null } })).status()).toBe(404)
  expect((await request.post(`/api/shots/${kept}/back`, { data: { after: null } })).status()).toBe(201)
  expect(await (await request.get(`/api/shots/${kept}/image`)).body()).toEqual(fresh)
})

test('a sweep run twice finds nothing more to erase the second time', async ({ request }) => {
  const { shot } = await aStoryAndAShot(request)
  const replaced = ownBytes(ONE_PIXEL)
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: replaced })).ok()).toBe(true)
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: ownBytes(ONE_PIXEL) })).ok()).toBe(true)
  await age(replaced)

  const [first, second] = [await sweep(request), await sweep(request)]
  expect(first.status()).toBe(200)
  expect(second.status()).toBe(200)
  expect((await first.json()).erased).toContain(digestOf(replaced))
  expect((await second.json()).erased).toEqual([])
})
