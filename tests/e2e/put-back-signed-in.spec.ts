import { neon } from '@neondatabase/serverless'
import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import {
  A_SOUND, ONE_PIXEL, live, readShots, seedScene, seedStory, test, toast, writeStory,
} from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Shot deleted by mistake is put back where it stood: × leaves a slim row with
 * *Put It Back* on it, and the Shot comes back whole, under its own id — see
 * `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`.
 */

const sql = neon(process.env.DATABASE_URL!)

function readTheStory(request: APIRequestContext, id: string) {
  return request.get(`/api/stories/${id}`).then(read => read.json() as Promise<StoryInEditor>)
}

/** The bytes a Shot's Image and its Sound are served as. */
async function bytesOf(request: APIRequestContext, shotId: string) {
  return Promise.all(['image', 'sound'].map(
    async matter => (await request.get(`/api/shots/${shotId}/${matter}`)).body()))
}

/** `writeStory`, with a third beat on the street so one of its Shots stands in the middle. */
async function threeOnTheStreet(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes: [street] } = await readTheStory(request, story.id)
  const { id: third } = await (await request.post(`/api/scenes/${street!.id}/shots`)).json()
  await request.patch(`/api/shots/${third}`, { data: { text: 'The rain has stopped.' } })

  const [first, second] = street!.shots
  return { story, street: street!, shots: [first!.id, second!.id, third as string] as const }
}

function slim(page: Page, sceneId: string) {
  return page.locator(`#scene-${sceneId} .shots > li.gone`)
}

test('a Shot put back is the Shot deleted, byte for byte, under its own id and as the Cover', async ({ request }) => {
  const story = await writeStory(request)
  const { scenes: [street] } = await readTheStory(request, story.id)
  const [door, steps] = street!.shots

  // Everything a Shot can carry: an Image, formatted words, a Description, a
  // Sound and its Transcript, an Effect, a Cut of its own and a Condition — and
  // the Story's Cover naming it.
  for (const [matter, bytes] of [['image', ONE_PIXEL], ['sound', A_SOUND]] as const) {
    expect((await request.put(`/api/shots/${steps!.id}/${matter}`, { data: bytes })).ok()).toBeTruthy()
  }
  expect((await request.patch(`/api/shots/${steps!.id}`, {
    data: {
      formatted: {
        type: 'doc',
        content: [{
          type: 'line',
          content: [
            { type: 'text', text: 'She ' },
            { type: 'text', text: 'steps', marks: [{ type: 'emphasis' }] },
            { type: 'text', text: ' out.' },
          ],
        }],
      },
      description: 'A doorway, and rain beyond it.',
      transcript: 'Rain on the awning.',
      cutAfter: 4000,
      imageArrives: { effect: 'shake', over: 5000, strength: 'marked' },
    },
  })).ok()).toBeTruthy()
  expect((await request.put(`/api/shots/${steps!.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'red' }] },
  })).ok()).toBeTruthy()
  expect((await request.patch(`/api/stories/${story.id}`, { data: { coverShotId: steps!.id } })).ok())
    .toBeTruthy()

  const before = await readTheStory(request, story.id)
  const held = before.scenes[0]!.shots[1]!
  const bytes = await bytesOf(request, steps!.id)
  expect(held.formatted).not.toBeNull()
  expect(before.coverShotId).toBe(steps!.id)

  // The delete answers as it always did, and takes the Cover with the Shot.
  const deleted = await request.delete(`/api/shots/${steps!.id}`)
  expect(await deleted.json()).toEqual({ id: steps!.id })
  const without = await readTheStory(request, story.id)
  expect(without.scenes[0]!.shots.map(shot => shot.id)).toEqual([door!.id])
  expect(without.coverShotId).toBeNull()

  const back = await request.post(`/api/shots/${steps!.id}/back`, { data: { after: door!.id } })
  expect(back.status()).toBe(201)
  expect((await back.json()).id).toBe(steps!.id)

  const after = await readTheStory(request, story.id)
  expect(after.scenes[0]!.shots[1]).toEqual(held)
  expect(after.coverShotId).toBe(steps!.id)
  expect(await bytesOf(request, steps!.id)).toEqual(bytes)

  // Put back once: nothing is held under it any more.
  const again = await request.post(`/api/shots/${steps!.id}/back`, { data: { after: door!.id } })
  expect(again.status()).toBe(404)
  expect((await again.json()).message).toBe('This Shot can no longer be put back.')
})

test('a Shot comes back after the Shot before it, at the head, or at the Place it had', async ({ request }) => {
  const { street, shots: [first, second, third] } = await threeOnTheStreet(request)

  // The second goes, then the first: the Shot the second stood after is gone too.
  await request.delete(`/api/shots/${second}`)
  await request.delete(`/api/shots/${first}`)
  await expect(readShots(street.id)).resolves.toMatchObject([{ id: third, position: 0 }])

  // So the second stands at the Place it had, capped at a run of one…
  await request.post(`/api/shots/${second}/back`, { data: { after: first } })
  // …and the first, which stood after nothing, at the head.
  await request.post(`/api/shots/${first}/back`, { data: { after: null } })

  await expect(readShots(street.id)).resolves.toMatchObject([
    { id: first, position: 0 },
    { id: third, position: 1 },
    { id: second, position: 2 },
  ])
})

test('a Shot is put back only by the Author whose Scene it was deleted from', async ({ request, otherAuthor }) => {
  const theirScene = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')
  const theirShot = theirScene.shots[0]!

  // Held as their own delete holds it, past the API nobody here is signed in to.
  await sql`
    with gone as (delete from shots where id = ${theirShot.id} returning *)
    insert into deleted_shots (shot_id, scene_id, "row", was_cover)
    select id, scene_id, to_jsonb(gone), false from gone`

  const refused = await request.post(`/api/shots/${theirShot.id}/back`, { data: { after: null } })
  expect(refused.status()).toBe(404)
  await expect(readShots(theirScene.id)).resolves.toEqual([])
  expect((await request.post(`/api/shots/${theirShot.id}/back`, { data: { after: 'Shot 1' } })).status())
    .toBe(400)
})

test('× leaves a slim row where the Shot stood, and Put It Back puts it there', async ({ page, request }) => {
  const { story, street, shots: [first, second, third] } = await threeOnTheStreet(request)
  await page.goto(`/stories/${story.id}`)
  await live(page)

  // The middle Shot goes: its row is the slim one, the focus is on its way back,
  // and the status line says what went.
  await page.getByRole('button', { name: 'Delete Shot 2 of The street' }).click()
  const rows = page.locator(`#scene-${street.id} .shots > li`)
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(1)).toHaveClass(/gone/)
  await expect(rows.nth(1)).toContainText('Shot 2 of The street is deleted')
  const back = rows.nth(1).getByRole('button', { name: 'Put It Back Shot 2 of The street', exact: true })
  await expect(back).toBeFocused()
  await expect(toast(page)).toHaveText('Shot 2 of The street is deleted')
  await expect(page.getByRole('textbox', { name: 'Shot 2 of The street', exact: true }))
    .toHaveText('The rain has stopped.')

  // The Shot after it goes too, from the same Place: each leaves a row of its
  // own, in the order they stood.
  await page.getByRole('button', { name: 'Delete Shot 2 of The street' }).click()
  await expect(slim(page, street.id)).toHaveCount(2)
  await expect(rows).toHaveCount(3)
  const thirdBack = rows.nth(2).getByRole('button', { name: /^Put It Back/ })
  await expect(thirdBack).toBeFocused()

  // The last one goes back first, after the Shot that stood before it, and the
  // caret lands in its words.
  await page.keyboard.press('Enter')
  await expect(page.locator(`[id="shot-${third}"]`)).toBeFocused()
  await expect(slim(page, street.id)).toHaveCount(1)
  await expect(rows.nth(1)).toHaveClass(/gone/)
  await expect(page.getByRole('textbox', { name: 'Shot 2 of The street', exact: true }))
    .toHaveText('The rain has stopped.')

  // The other still stands between the two, and goes back there. Reached by the
  // keyboard: the caret is in the Shot under it, whose formatting bar lies over
  // the row above, as it lies over every row above the Shot being written.
  await rows.nth(1).getByRole('button', { name: /^Put It Back/ }).focus()
  await page.keyboard.press('Enter')
  await expect(slim(page, street.id)).toHaveCount(0)
  await expect(page.locator(`[id="shot-${second}"]`)).toBeFocused()
  await expect(readShots(street.id)).resolves.toMatchObject(
    [first, second, third].map((shot, position) => ({ id: shot, position })))

  // The rows are the page's: a reload is the end of them.
  await page.getByRole('button', { name: 'Delete Shot 3 of The street' }).click()
  await expect(slim(page, street.id)).toHaveCount(1)
  await page.reload()
  await live(page)
  await expect(page.getByRole('textbox', { name: 'Shot 2 of The street', exact: true }))
    .toHaveText('She steps out.')
  await expect(page.getByRole('textbox', { name: 'Shot 3 of The street', exact: true })).toHaveCount(0)
  await expect(slim(page, street.id)).toHaveCount(0)
})

test('a Shot that can no longer be put back is said so, and its row goes', async ({ page, request }) => {
  const { story, street, shots: [first, second] } = await threeOnTheStreet(request)
  await page.goto(`/stories/${story.id}`)
  await live(page)

  await page.getByRole('button', { name: 'Delete Shot 2 of The street' }).click()
  await expect(slim(page, street.id)).toHaveCount(1)

  // Put back from somewhere else first, so the bench asks for a Shot no longer held.
  await request.post(`/api/shots/${second}/back`, { data: { after: first } })
  await slim(page, street.id).getByRole('button', { name: /^Put It Back/ }).click()

  await expect(page.locator('.refused')).toContainText('This Shot can no longer be put back.')
  await expect(slim(page, street.id)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Shot 2 of The street', exact: true }))
    .toHaveText('She steps out.')
})

test('Backspace at the head of an empty beat takes it with no row left behind', async ({ page, request }) => {
  const { story, street } = await threeOnTheStreet(request)
  await request.post(`/api/scenes/${street.id}/shots`)
  await page.goto(`/stories/${story.id}`)
  await live(page)

  const empty = page.getByRole('textbox', { name: 'Shot 4 of The street', exact: true })
  await empty.click()
  await expect(page.locator('.ProseMirror')).toBeFocused()
  await page.keyboard.press('Backspace')

  await expect(page.getByRole('textbox', { name: 'Shot 4 of The street', exact: true })).toHaveCount(0)
  await expect(slim(page, street.id)).toHaveCount(0)
})
