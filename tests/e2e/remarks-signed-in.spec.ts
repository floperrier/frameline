import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import {
  readTheStory, seedExit, seedFlags, seedScene, seedStory, test, writeScene,
} from './author'

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

  // Read with The platform in the gate. All three are said here: the reading is
  // the gate's other face rather than a column beside it, so while an Author is
  // writing there is nothing else on screen saying any of them — see
  // `docs/adr/0042-the-scene-is-written-where-it-stands.md`.
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The platform')
  await expect(found(page)).toContainText('3')

  await openRemarks(page)
  await expect(found(page).getByRole('listitem')).toHaveCount(3)
  await expect(found(page)).toContainText('marks no opening Scene')

  // Pressing the Remark about the Flag puts the Scene that sets it on the writing
  // surface, which is where the Author answers it.
  await found(page).getByRole('button', { name: /sets the Flag coat/ }).click()
  await expect(page).toHaveURL(new RegExp(`scene=${arrival.id}`))
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // And the Scene in the gate keeps its own sentence here, as every Scene does.
  await openRemarks(page)
  await expect(found(page)).toContainText('No Exit arrives at The arrival')
})

test('is opened by naming it, like every other act of the bench', async ({ page, request }) => {
  const { story } = await whole(request)

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Commands' }).click()
  await page.getByRole('textbox', { name: 'Type a name' }).fill('Remarks')
  await page.getByRole('button', { name: 'Read the Remarks' }).click()

  await expect(found(page)).toContainText('Nothing to report')

  // And the bar names it for what pressing it will do from where the list now
  // stands: a summary toggles, so the act on an open list is to close it.
  await page.getByRole('button', { name: 'Commands' }).click()
  await page.getByRole('textbox', { name: 'Type a name' }).fill('Remarks')
  await expect(page.getByRole('button', { name: 'Close the Remarks' })).toBeVisible()
})

test('says what it found whichever face the gate is showing', async ({ page, request }) => {
  // Written through the API rather than seeded, because the first Scene it writes
  // becomes the one the Story opens on.
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The arrival' } })
  const platform = await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name: 'The platform' } })).json()

  // No Exit at all, so nothing arrives at the second Scene: the bench says so.
  await page.goto(`/stories/${story.id}`)
  await openRemarks(page)
  await expect(found(page).getByRole('button', { name: /No Exit arrives at The platform/ }))
    .toBeVisible()

  // And it goes on saying so with that Scene in the gate. The reading says it too
  // in the Scene's own words, but only on the face an Author has turned to: two
  // voices for one fact was the objection while the reading was a column beside
  // the writing, and it is a face of the same box now — see
  // `docs/adr/0042-the-scene-is-written-where-it-stands.md`.
  await page.goto(`/stories/${story.id}?scene=${platform.id}`)
  await openRemarks(page)
  await expect(found(page)).toContainText('No Exit arrives at The platform')
  await expect(found(page)).toContainText('The platform holds no Shot')

  await readTheStory(page)
  await expect(page.getByText('Nothing leads to The platform yet')).toBeVisible()
})
