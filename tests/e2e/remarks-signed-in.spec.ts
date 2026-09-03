import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { seedExit, seedFlags, seedScene, seedStory, test } from './author'

/**
 * What the bench reads back to the Author: the Remarks it finds in the Story,
 * counted in the row above the bench and opening into a list each line of which
 * presses to the Scene it is about — see
 * `docs/adr/0032-the-bench-reads-the-story-back.md`.
 *
 * The reading itself is held to a literal in `tests/unit/remarks.spec.ts`. What
 * is proved here is the other half: that the count is on the screen, that it is
 * reached by naming it like every other act, that pressing a Remark opens the
 * Scene it names, and that it falls silent where the Preview is already saying
 * the same thing.
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
  // A Story opening nowhere — a seeded Scene never becomes the opening one, which
  // only the endpoint that writes a Scene does — a Scene nothing arrives at, and a
  // Flag nothing tests: three findings, and none of them a refusal.
  await seedExit(arrival.id, platform.id)
  await seedFlags(arrival.id, { coat: 'on' })

  await page.goto(`/stories/${story.id}`)
  await expect(found(page)).toContainText('3')

  await openRemarks(page)
  await expect(found(page).getByRole('listitem')).toHaveCount(3)

  // The one Remark said of the Story itself is prose: there is no Scene to be
  // taken to, so it is not a control that would go nowhere when pressed.
  await expect(found(page)).toContainText('marks no opening Scene')
  await expect(found(page).getByRole('button', { name: /opening Scene/ })).toHaveCount(0)

  // Pressing the Remark about the Flag puts the Scene that sets it on the writing
  // surface, which is where the Author answers it.
  await found(page).getByRole('button', { name: /sets the Flag coat/ }).click()
  await expect(page).toHaveURL(new RegExp(`scene=${arrival.id}`))
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()
})

test('is opened by naming it, like every other act of the bench', async ({ page, request }) => {
  const { story } = await whole(request)

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Commands' }).click()
  await page.getByRole('textbox', { name: 'Type a name' }).fill('Remarks')
  await page.getByRole('button', { name: 'Read the Remarks' }).click()

  await expect(found(page)).toContainText('Nothing to report')
})

test('leaves to the Preview what the Preview is already saying', async ({ page, request }) => {
  // Written through the API rather than seeded, because the first Scene it writes
  // becomes the one the Story opens on: a Story opening nowhere is answered by a
  // sentence of the Preview's own and never reaches the one this test is about.
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The arrival' } })
  const platform = await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name: 'The platform' } })).json()

  // No Exit at all, so nothing arrives at the second Scene: the bench says so,
  // and so does the Preview beside it once that Scene is open.
  await page.goto(`/stories/${story.id}`)
  await openRemarks(page)
  await expect(found(page).getByRole('button', { name: /No Exit arrives at The platform/ }))
    .toBeVisible()

  await page.goto(`/stories/${story.id}?scene=${platform.id}`)
  await expect(page.getByText('Nothing leads to The platform yet')).toBeVisible()

  // The count drops it while that Scene is on the surface — one fact, one voice —
  // and the Scene holding no Shot is still counted.
  await openRemarks(page)
  await expect(found(page)).not.toContainText('No Exit arrives at The platform')
  await expect(found(page)).toContainText('The platform holds no Shot')
})
