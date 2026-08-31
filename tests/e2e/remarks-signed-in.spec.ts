import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { NODE_GAP, NODE_WIDTH } from '../../shared/utils/scenes'
import {
  readScenePlacement,
  seedExit,
  seedFlags,
  seedScene,
  seedStory,
  test,
} from './author'

/**
 * What the bench reads back to the Author: the Remarks it finds in the Story, the
 * way to any Scene by its name, and where a Scene born from the keyboard lands.
 *
 * The reading itself is held to a literal in `tests/unit/remarks.spec.ts`. What
 * is proved here is the other half: that the count is on the screen, that
 * pressing a Remark opens the Scene it names, and that a Scene the keyboard makes
 * arrives beside the one it leaves.
 */

/**
 * The disclosure the Remarks are counted and read in, and the line that opens it.
 * Reached by its own mark rather than by a role: a `<summary>` is exposed
 * differently by each engine, and what this spec is about is what the disclosure
 * says rather than which role its handle carries.
 */
function found(page: Page) {
  return page.locator('.found')
}

function openRemarks(page: Page) {
  return page.locator('.found summary').click()
}

/** A Story of two Scenes joined by an Exit, which the bench has nothing to say about. */
async function whole(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  const scenes = []
  for (const name of ['The arrival', 'The platform']) {
    scenes.push(await (await request.post(
      `/api/stories/${story.id}/scenes`, { data: { name } })).json())
  }
  await request.post(`/api/scenes/${scenes[0]!.id}/exits`, { data: { toSceneId: scenes[1]!.id } })
  for (const scene of scenes) {
    const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
    await request.patch(`/api/shots/${shot.id}`, {
      data: { text: 'A door opens.', description: '' },
    })
  }

  return { story, scenes }
}

test('says it found nothing in a Story that holds together', async ({ page, request }) => {
  const { story } = await whole(request)

  await page.goto(`/stories/${story.id}`)
  await expect(found(page)).toContainText('0')

  await openRemarks(page)
  await expect(found(page)).toContainText('Nothing to report')
})

test('counts what it finds, and opens the Scene a Remark names', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  const arrival = await seedScene(story, 'The arrival')
  const platform = await seedScene(story, 'The platform')
  // A Scene no Exit arrives at, in a Story that opens on neither and sets a Flag
  // nothing tests: three findings, and none of them a refusal.
  await seedExit(arrival.id, platform.id)
  await seedFlags(arrival.id, { coat: 'on' })

  await page.goto(`/stories/${story.id}`)
  await openRemarks(page)

  await expect(found(page).getByRole('listitem')).toHaveCount(3)
  await expect(found(page)).toContainText('marks no opening Scene')
  await expect(found(page)).toContainText('The arrival')

  // Pressing the Remark about the Flag puts the Scene that sets it on the writing
  // surface, which is where the Author answers it.
  await found(page).getByRole('button', { name: /sets the Flag coat/ }).click()
  await expect(page).toHaveURL(new RegExp(`scene=${arrival.id}`))
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()
})

test('goes to a Scene by its name', async ({ page, request }) => {
  const { story } = await whole(request)

  await page.goto(`/stories/${story.id}`)
  await page.getByLabel('Go to a Scene').fill('The platform')
  await page.getByLabel('Go to a Scene').press('Enter')

  await expect(page.getByRole('group', { name: 'Writing The platform' })).toBeVisible()
  // The field is given back empty, so the next Scene is typed rather than
  // corrected over the last one.
  await expect(page.getByLabel('Go to a Scene')).toHaveValue('')
})

test('lands a Scene the keyboard makes beside the Scene it leaves', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  const arrival = await seedScene(story, 'The arrival')

  await page.goto(`/stories/${story.id}`)
  // The two buttons hidden on the card until they take focus: the one that
  // begins the aiming, and the one that lands it on a Scene there is nothing to
  // aim at yet. Pressed rather than clicked, which is the route they exist for.
  await page.getByRole('button', { name: 'Draw an Exit from The arrival' }).press('Enter')
  await page.getByRole('button', { name: 'Exit from The arrival to a new Scene' }).press('Enter')

  await expect(page.getByRole('group', { name: /^Writing / })).toBeVisible()
  const written = await page.locator('[data-scene]').last().getAttribute('data-scene')
  const placed = await readScenePlacement(written!)
  const left = await readScenePlacement(arrival.id)

  expect(placed).toMatchObject({ x: left.x + NODE_WIDTH + NODE_GAP, y: left.y })
})
