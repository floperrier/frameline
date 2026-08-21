import { expect } from '@playwright/test'
import { test, writeStory } from './author'

/**
 * The whole product in one path: an Author signed in, a Story of two Scenes
 * joined by a Cut, a Publish, and someone with no account reading it to an
 * ending at the link — then the link taken away again.
 */
test('an Author publishes a Story and a Reader reads it at the public link', async ({ page, request, browser, baseURL }) => {
  const story = await writeStory(request)

  // The link is the Story's own id, so it can be named before it exists.
  const publicLink = `${baseURL}/read/${story.id}`

  // A Reader arrives in a context of their own: no session, no cookie, nothing
  // the Author's browser knows.
  const reader = await browser.newContext()
  const readerPage = await reader.newPage()

  // Unpublished, the Story is nobody's but its Author's.
  expect((await readerPage.goto(publicLink))!.status()).toBe(404)

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story' }).click()
  await expect(page.getByRole('link', { name: publicLink })).toBeVisible()

  // The Reading plays out on the same engine the Preview ran.
  await readerPage.goto(publicLink)
  await expect(readerPage.getByRole('heading', { name: story.title })).toBeVisible()
  await expect(readerPage.getByText('A door opens.')).toBeVisible()
  await readerPage.getByRole('button', { name: 'Next Shot' }).click()
  await expect(readerPage.getByText('She steps out.')).toBeVisible()
  await readerPage.getByRole('button', { name: 'Next Shot' }).click()
  await readerPage.getByRole('button', { name: 'Follow her out' }).click()
  await expect(readerPage.getByText('Smoke, and no one she knows.')).toBeVisible()
  await readerPage.getByRole('button', { name: 'Next Shot' }).click()
  await expect(readerPage.getByRole('status')).toHaveText('The path ends here.')

  // A second Reader starts the Story over, and the first one stays where they
  // were: a Reading carries its own State and shares it with nobody.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(publicLink)
  await expect(otherPage.getByText('A door opens.')).toBeVisible()
  await expect(readerPage.getByRole('status')).toHaveText('The path ends here.')

  // Unpublishing takes the link away from everyone who already had it.
  await page.getByRole('button', { name: 'Unpublish this Story' }).click()
  await expect(page.getByRole('button', { name: 'Publish this Story' })).toBeVisible()
  expect((await otherPage.goto(publicLink))!.status()).toBe(404)

  await reader.close()
  await other.close()
})
