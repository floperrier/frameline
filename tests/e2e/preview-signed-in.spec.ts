import { expect } from '@playwright/test'
import { test, writeStory } from './author'

test('an Author plays their own Story before anyone else can see it', async ({ page, request }) => {
  const story = await writeStory(request)

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('link', { name: 'Preview this Story' }).click()

  // One Shot at a time, and nothing to take while the Scene still has Shots.
  await expect(page.getByText('A door opens.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow her out' })).toBeHidden()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('She steps out.')).toBeVisible()

  // The Cut is offered at the end of the Scene, and taking it moves the Reading.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Follow her out' }).click()
  await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()

  // The bar has no Cut out of it, so the Reader is told the path ends there.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByRole('status')).toHaveText('The path ends here.')

  await page.getByRole('button', { name: 'Read again from the start' }).click()
  await expect(page.getByText('A door opens.')).toBeVisible()
})
