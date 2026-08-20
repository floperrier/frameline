import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { readShots, seedScene, seedStory, test } from './author'

const noId = '00000000-0000-4000-8000-000000000000'

/** A Story with one Scene in it, which is where every test below starts. */
async function openScene(request: APIRequestContext, name = 'A Scene') {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  const created = await request.post(`/api/stories/${story.id}/scenes`, { data: { name } })
  expect(created.status()).toBe(201)

  return { story, scene: await created.json() }
}

/** Adds Shots to a Scene, writing the given text to each. */
async function writeShots(request: APIRequestContext, sceneId: string, texts: string[]) {
  const shots = []
  for (const text of texts) {
    const added = await request.post(`/api/scenes/${sceneId}/shots`)
    expect(added.status()).toBe(201)
    const shot = await added.json()
    await request.patch(`/api/shots/${shot.id}`, { data: { text } })
    shots.push(shot)
  }

  return shots
}

test('an Author writes a Scene as a run of Shots', async ({ request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['She steps off the train.', 'The platform is empty.'])

  const read = await (await request.get(`/api/stories/${story.id}`)).json()

  expect(read).toMatchObject({
    id: story.id,
    title: 'A Story',
    scenes: [{
      id: scene.id,
      name: 'The arrival',
      shots: [
        { text: 'She steps off the train.', position: 0 },
        { text: 'The platform is empty.', position: 1 },
      ],
    }],
  })
})

test('a Scene needs a name', async ({ request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()

  const response = await request.post(`/api/stories/${story.id}/scenes`, { data: { name: '  ' } })

  expect(response.status()).toBe(400)
  expect(await response.text()).toContain('A Scene needs a name.')
})

test('a Shot moves earlier and later, and stays put at either end', async ({ request }) => {
  const { scene } = await openScene(request)
  const [first, second, third] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])

  await request.post(`/api/shots/${third!.id}/move`, { data: { direction: 'earlier' } })
  await expect(readShots(scene.id)).resolves.toMatchObject([
    { text: 'First' }, { text: 'Third' }, { text: 'Second' },
  ])

  await request.post(`/api/shots/${first!.id}/move`, { data: { direction: 'later' } })
  await expect(readShots(scene.id)).resolves.toMatchObject([
    { text: 'Third' }, { text: 'First' }, { text: 'Second' },
  ])

  // The Shots at either end have nowhere to go, and asking is not an error.
  const atTheEnds = await Promise.all([
    request.post(`/api/shots/${third!.id}/move`, { data: { direction: 'earlier' } }),
    request.post(`/api/shots/${second!.id}/move`, { data: { direction: 'later' } }),
  ])
  for (const response of atTheEnds) expect(response.status()).toBe(200)

  await expect(readShots(scene.id)).resolves.toMatchObject([
    { text: 'Third', position: 0 }, { text: 'First', position: 1 }, { text: 'Second', position: 2 },
  ])
})

test('deleting a Shot leaves the Scene numbered without a gap', async ({ request }) => {
  const { scene } = await openScene(request)
  const [, second] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])

  expect((await request.delete(`/api/shots/${second!.id}`)).status()).toBe(200)

  await expect(readShots(scene.id)).resolves.toEqual([
    { id: expect.any(String), text: 'First', position: 0 },
    { id: expect.any(String), text: 'Third', position: 1 },
  ])

  // A Shot that is gone stays gone, however it is reached for.
  expect((await request.delete(`/api/shots/${second!.id}`)).status()).toBe(404)
})

test('deleting a Scene takes its Shots with it', async ({ request }) => {
  const { story, scene } = await openScene(request)
  await writeShots(request, scene.id, ['First', 'Second'])

  expect((await request.delete(`/api/scenes/${scene.id}`)).status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ scenes: [] })
  await expect(readShots(scene.id)).resolves.toEqual([])
})

test('a Scene that was never written reads as absent', async ({ request }) => {
  const responses = await Promise.all([
    request.get(`/api/stories/${noId}`),
    request.post(`/api/stories/${noId}/scenes`, { data: { name: 'A Scene' } }),
    request.delete(`/api/scenes/${noId}`),
    request.post(`/api/scenes/${noId}/shots`),
    request.patch(`/api/shots/${noId}`, { data: { text: 'A line' } }),
    request.post(`/api/shots/${noId}/move`, { data: { direction: 'earlier' } }),
    request.delete(`/api/shots/${noId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)
})

test('Scenes and Shots belong to the Author who wrote the Story', async ({ request, otherAuthor }) => {
  const theirStory = await seedStory(otherAuthor, 'Their Story')
  const theirScene = await seedScene(theirStory, 'Their Scene')
  const theirShot = theirScene.shots[0]!

  const responses = await Promise.all([
    request.get(`/api/stories/${theirStory.id}`),
    request.post(`/api/stories/${theirStory.id}/scenes`, { data: { name: 'Mine now' } }),
    request.delete(`/api/scenes/${theirScene.id}`),
    request.post(`/api/scenes/${theirScene.id}/shots`),
    request.patch(`/api/shots/${theirShot.id}`, { data: { text: 'Mine now' } }),
    request.post(`/api/shots/${theirShot.id}/move`, { data: { direction: 'later' } }),
    request.delete(`/api/shots/${theirShot.id}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)

  // The 404s have to mean the Scene was left alone, not merely that the answer
  // said nothing about a Scene that was changed anyway.
  await expect(readShots(theirScene.id)).resolves.toEqual([theirShot])
})

test('the Story page shows a Scene and the Shots in it', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['She steps off the train.'])

  await page.goto(`/stories/${story.id}`)

  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')

  await page.getByRole('button', { name: 'Add Shot' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
})

test('an Author writes a Story from the page alone', async ({ page, request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await page.goto(`/stories/${story.id}`)

  await page.getByLabel('Name of a new Scene').fill('The arrival')
  await page.getByRole('button', { name: 'Create Scene' }).click()
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()

  // Blurring the Shot is what writes it, so each is left before the next is added.
  for (const [place, line] of ['She steps off the train.', 'The platform is empty.'].entries()) {
    await page.getByRole('button', { name: 'Add Shot' }).click()
    const shot = page.getByRole('textbox', { name: `Shot ${place + 1}` })
    await expect(shot).toBeVisible()
    await shot.fill(line)
    await shot.blur()
    await expect(shot).toHaveValue(line)
  }

  await page.getByRole('button', { name: 'Move earlier Shot 2' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('The platform is empty.')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toHaveValue('She steps off the train.')

  // What the page shows has to be what was written, not what the page remembers.
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('The platform is empty.')

  await page.getByRole('button', { name: 'Delete Shot 1' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeHidden()

  // Deleting a Scene takes Shots with it, so it is asked about first.
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete Scene The arrival' }).click()
  await expect(page.getByText('No Scenes yet.')).toBeVisible()
})
