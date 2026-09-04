import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { test, writeStory } from './author'

/**
 * A Reader with no account, in a browser of their own: no session, no cookie and
 * no storage but what this Reading writes. Handed back with the context so the
 * spec can open a second page in the same browser — the same Reader, back for
 * more — as well as a second browser, which is somebody else.
 */
async function reader(browser: Browser, link: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(link)
  return { context, page }
}

const pickedUp = (page: Page) => page.getByRole('status').filter({ hasText: 'Picked up where you left off.' })

test('a Reader who leaves a Story comes back to where they stood', async ({ page, request, browser, baseURL }) => {
  const story = await writeStory(request)
  const link = `${baseURL}/read/${story.id}`

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: link })).toBeVisible()

  // Nothing has been read: nothing to come back to, and nothing said about it.
  const { page: reading } = await reader(browser, link)
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await expect(pickedUp(reading)).toHaveCount(0)

  // One Shot on, and a reload lands on that Shot, saying so — once.
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByText('She steps out.')).toBeVisible()
  await reading.reload()
  await expect(reading.getByText('She steps out.')).toBeVisible()
  await expect(reading.getByText('Shot 2 of 2')).toBeVisible()
  await expect(pickedUp(reading)).toBeVisible()

  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(pickedUp(reading)).toHaveCount(0)

  // An Exit taken is a Scene arrived at, and coming back arrives there again.
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()
  await reading.reload()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()
  await expect(pickedUp(reading)).toBeVisible()

  // Somebody else opening the same link is at the start: nothing was shared.
  const { page: other } = await reader(browser, link)
  await expect(other.getByText('A door opens.')).toBeVisible()
  await expect(pickedUp(other)).toHaveCount(0)

  // Starting over is kept too: the next visit is the start, with nothing to say.
  await reading.getByRole('button', { name: 'Read again from the start' }).click()
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await reading.reload()
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await expect(pickedUp(reading)).toHaveCount(0)

  // An ending is nowhere to be put back at: the Story opens at its start.
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByRole('status')).toHaveText('The path ends here.')
  await reading.reload()
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await expect(pickedUp(reading)).toHaveCount(0)
})

test('a Reader is not put back where the Story has moved from under them', async ({ page, request, browser, baseURL }) => {
  const story = await writeStory(request)
  const link = `${baseURL}/read/${story.id}`

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: link })).toBeVisible()

  const { page: reading } = await reader(browser, link)
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()

  // The Author takes the Exit the Reader took away, past the page: the Story as
  // published no longer has the route the kept Path walked.
  const { exits } = await (await request.get(`/api/stories/${story.id}`)).json()
  await request.delete(`/api/exits/${exits[0].id}`)

  await reading.reload()
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await expect(pickedUp(reading)).toHaveCount(0)
})
