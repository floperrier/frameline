import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import {
  ONE_PIXEL, live, readShots, seedScene, seedStory, test, toast, writeStory,
} from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Shot moves to another Scene by naming it, and carries everything it holds,
 * because it is the same row: the mark between ✂ and ↑ opens a field under the
 * row's marks, and a name that answers to another Scene of the Story moves the
 * Shot to the end of that Scene's run — issue #407.
 */

function readTheStory(request: APIRequestContext, id: string) {
  return request.get(`/api/stories/${id}`).then(read => read.json() as Promise<StoryInEditor>)
}

/**
 * `writeStory`, opening on the street, with its first Shot carrying an Image,
 * formatted words, an Effect and a Condition, and named as the Cover.
 */
async function aShotWithEverything(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes: [street, bar] } = await readTheStory(request, story.id)
  const [door, steps] = street!.shots

  expect((await request.post(`/api/scenes/${street!.id}/opening`)).ok()).toBeTruthy()
  expect((await request.put(`/api/shots/${door!.id}/image`, { data: ONE_PIXEL })).ok()).toBeTruthy()
  expect((await request.patch(`/api/shots/${door!.id}`, {
    data: {
      formatted: {
        type: 'doc',
        content: [{
          type: 'line',
          content: [
            { type: 'text', text: 'A door ' },
            { type: 'text', text: 'opens', marks: [{ type: 'emphasis' }] },
            { type: 'text', text: '.' },
          ],
        }],
      },
      description: 'A doorway, and rain beyond it.',
      imageArrives: { effect: 'shake', over: 500, strength: 'marked' },
    },
  })).ok()).toBeTruthy()
  expect((await request.put(`/api/shots/${door!.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'red' }] },
  })).ok()).toBeTruthy()
  expect((await request.patch(`/api/stories/${story.id}`, { data: { coverShotId: door!.id } })).ok())
    .toBeTruthy()

  return { story, street: street!, bar: bar!, door: door!.id, steps: steps!.id }
}

function moveMark(page: Page, place: number, scene: string) {
  return page.getByRole('button', { name: `Move Shot ${place} of ${scene} to another Scene`, exact: true })
}

test('a Shot moved is the same row, last in the Scene it moves to, carrying everything it holds', async ({ request }) => {
  const { story, street, bar, door, steps } = await aShotWithEverything(request)
  const before = await readTheStory(request, story.id)
  const held = before.scenes.find(scene => scene.id === street.id)!.shots[0]!
  expect(held.formatted).not.toBeNull()

  const moved = await request.post(`/api/shots/${door}/move`, { data: { toSceneId: bar.id } })
  expect(moved.status()).toBe(200)
  expect(await moved.json()).toEqual({ id: door, sceneId: bar.id, position: 1 })

  // The Scene it left closes up, and the one it moved to has it last.
  await expect(readShots(street.id)).resolves.toMatchObject([{ id: steps, position: 0 }])
  const after = await readTheStory(request, story.id)
  const there = after.scenes.find(scene => scene.id === bar.id)!.shots
  expect(there.map(shot => shot.position)).toEqual([0, 1])
  expect(there[1]).toEqual({ ...held, position: 1 })
  expect(after.coverShotId).toBe(door)
  expect(await (await request.get(`/api/shots/${door}/image`)).body()).toEqual(ONE_PIXEL)
})

test('a Shot is not moved to its own Scene, nor out of its Story, nor by anybody else', async ({ request, otherAuthor }) => {
  const { street, door } = await aShotWithEverything(request)
  const elsewhere = await aShotWithEverything(request)
  const theirScene = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')

  const here = await request.post(`/api/shots/${door}/move`, { data: { toSceneId: street.id } })
  expect(here.status()).toBe(400)
  expect((await here.json()).message).toBe('A Shot moves to a Scene other than the one it stands in.')

  for (const [shot, toSceneId] of [
    [door, elsewhere.bar.id],
    [door, theirScene.id],
    [theirScene.shots[0]!.id, street.id],
  ]) {
    expect((await request.post(`/api/shots/${shot}/move`, { data: { toSceneId } })).status()).toBe(404)
  }
  expect((await request.post(`/api/shots/${door}/move`, { data: { toSceneId: 'The bar' } })).status())
    .toBe(400)

  await expect(readShots(street.id)).resolves.toMatchObject([{ id: door, position: 0 }, { position: 1 }])
  await expect(readShots(theirScene.id)).resolves.toHaveLength(1)
})

test('the mark moves a Shot to the Scene named, and the hand follows it there', async ({ page, request }) => {
  const { story, street, bar, door, steps } = await aShotWithEverything(request)
  await page.goto(`/stories/${story.id}`)
  await live(page)

  const mark = moveMark(page, 1, 'The street')
  await expect(mark).toHaveAttribute('aria-expanded', 'false')
  await mark.click()
  await expect(mark).toHaveAttribute('aria-expanded', 'true')

  // The field offers the other Scenes and takes the focus; only one is open.
  const field = page.getByRole('combobox', { name: 'Scene to move it to' })
  await expect(field).toBeFocused()
  await expect(field).toHaveAttribute('placeholder', 'Name the Scene it moves to…')
  expect(await page.locator(`#scene-${street.id} form.moving datalist option`).evaluateAll(
    options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['The bar'])
  await moveMark(page, 1, 'The bar').click()
  await expect(page.getByRole('combobox', { name: 'Scene to move it to' })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('combobox', { name: 'Scene to move it to' })).toHaveCount(0)
  await expect(moveMark(page, 1, 'The bar')).toBeFocused()

  // Folded as the bar of Commands folds a name.
  await mark.click()
  await field.fill('THE BAR')
  await field.press('Enter')

  await expect(toast(page)).toHaveText('Shot 1 of The street moved to The bar, as Shot 2')
  await expect(page.locator(`[id="shot-${door}"]`)).toBeFocused()
  await expect(page.locator(`#scene-${bar.id} .shots [data-shot="${door}"]`)).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Scene to move it to' })).toHaveCount(0)
  await expect(readShots(street.id)).resolves.toMatchObject([{ id: steps, position: 0 }])
  await expect(readShots(bar.id)).resolves.toMatchObject([{ position: 0 }, { id: door, position: 1 }])

  // The Contact Sheet follows the Story: the Image is in the bar's band now.
  await page.getByRole('button', { name: 'See the Contact Sheet' }).click()
  const sheet = page.getByRole('region', { name: 'Contact Sheet' })
  await expect(sheet.locator(`[data-band="${bar.id}"] .frames img`)).toHaveCount(1)
  await expect(sheet.locator(`[data-band="${bar.id}"] .frames img`))
    .toHaveAttribute('src', new RegExp(door))
  await expect(sheet.locator(`[data-band="${street.id}"] .frames img`)).toHaveCount(0)
})

test('a name that answers to no other Scene is refused under the field, and nothing is sent', async ({ page, request }) => {
  const { story, street } = await aShotWithEverything(request)
  await page.goto(`/stories/${story.id}`)
  await live(page)

  const moves: string[] = []
  page.on('request', (sent) => {
    if (sent.url().endsWith('/move')) moves.push(sent.url())
  })

  const mark = moveMark(page, 2, 'The street')
  await mark.click()
  const field = page.getByRole('combobox', { name: 'Scene to move it to' })
  const form = page.locator('form.moving')

  await field.fill('The station')
  await field.press('Enter')
  await expect(form.getByRole('alert')).toHaveText('No Scene of this Story answers to that name.')
  await expect(field).toHaveAttribute('aria-invalid', 'true')

  await field.fill('the street')
  await field.press('Enter')
  await expect(form.getByRole('alert')).toHaveText('This Shot is already in The street.')

  // The mark closes what it opened, and puts the hand back on itself.
  await mark.click()
  await expect(form).toHaveCount(0)
  await expect(mark).toBeFocused()

  expect(moves).toEqual([])
  await expect(readShots(street.id)).resolves.toHaveLength(2)
})

test('a Story of one Scene draws no mark to move a Shot', async ({ page, author }) => {
  const story = await seedStory(author, 'One Scene')
  await seedScene(story, 'Alone')
  await page.goto(`/stories/${story.id}`)
  await live(page)

  await expect(page.getByRole('button', { name: 'Delete Shot 1 of Alone' })).toBeVisible()
  await expect(moveMark(page, 1, 'Alone')).toHaveCount(0)
})
