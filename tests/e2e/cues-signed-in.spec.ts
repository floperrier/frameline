import { expect, type Page } from '@playwright/test'
import { seedScene, seedStory, test } from './author'

/** The sentence the first Cue says, which is how the guidance is recognised. */
const FIRST_CUE = /Every Story starts with a Scene/

/** The bubble, whichever of its two placements it is in. */
function bubble(page: Page) {
  return page.getByRole('complementary', { name: 'Next' })
}

test('the bench asks a new Story for its first Scene', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  await page.goto(`/stories/${story.id}`)

  await expect(bubble(page)).toContainText(FIRST_CUE)

  // The light sits on the field itself, and does not cover it.
  const field = page.getByLabel('Name of a new Scene')
  expect(await page.locator('.spotlight').boundingBox()).toEqual(await field.boundingBox())

  // The very field being pointed at is still typed into, which is why none of
  // this is modal.
  await field.fill('The arrival')
  await page.getByRole('button', { name: 'Create Scene' }).click()

  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(bubble(page)).toBeHidden()
  await expect(page.locator('.spotlight')).toBeHidden()
})

test('the Cue is recomputed from the Story on every load', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')

  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toBeVisible()

  // Nothing was stored, so a reload with the Story still empty asks again.
  await page.reload()
  await expect(bubble(page)).toContainText(FIRST_CUE)

  await seedScene(story, 'The arrival')
  await page.reload()
  await expect(bubble(page)).toBeHidden()
})

test('a Story that already has Scenes is guided not at all', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  await seedScene(story, 'The arrival')

  await page.goto(`/stories/${story.id}`)

  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(bubble(page)).toBeHidden()
})

test('an Author who knows what they are doing waves the guidance away', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  await page.goto(`/stories/${story.id}`)

  await bubble(page).getByRole('button', { name: 'I can take it from here' }).click()
  await expect(bubble(page)).toBeHidden()

  // Dismissal is the one thing about the guidance that is stored anywhere, and
  // it outlives the page it was made on.
  await page.reload()
  await expect(page.getByText('No Scenes yet.')).toBeVisible()
  await expect(bubble(page)).toBeHidden()
})
