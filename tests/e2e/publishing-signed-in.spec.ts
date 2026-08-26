import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { test, writeStory } from './author'

/**
 * Someone arriving at the public link for the first time: their own context, so
 * no session, no cookie and no cache of ours — and a second arrival is a second
 * Reader rather than the first one going round again, which is what lets one
 * Reading be compared with another.
 */
async function readerAt(browser: Browser, link: string) {
  const page = await (await browser.newContext()).newPage()
  const response = await page.goto(link)
  return { page, status: response!.status() }
}

/** Reads the Story `writeStory` wrote from its first Shot to its ending. */
async function readToTheEnd(page: Page) {
  await expect(page.getByText('A door opens.')).toBeVisible()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('She steps out.')).toBeVisible()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Follow her out' }).click()
  await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByRole('status')).toHaveText('The path ends here.')
}

/**
 * The whole product in one path: an Author signed in, a Story of two Scenes
 * joined by a Cut, a Publish, and someone with no account reading it to an
 * ending at the link — then the link taken away, and given back.
 */
test('an Author publishes a Story and a Reader reads it at the public link', async ({ page, request, browser, baseURL }) => {
  const story = await writeStory(request)

  // The link is the Story's own id, so it can be named before it exists.
  const publicLink = `${baseURL}/read/${story.id}`

  // Unpublished, the Story is nobody's but its Author's, and the dead link says
  // so in words: a refusal a Reader reads has to survive the page it lands on.
  const early = await readerAt(browser, publicLink)
  expect(early.status).toBe(404)
  await expect(early.page.getByRole('heading', { name: 'No such Story.' })).toBeVisible()

  // `exact` throughout: a role's name matches by substring otherwise, and
  // "Publish this Story" is one of "Unpublish this Story" — so the loose locator
  // presses the opposite button the moment the Story is published.
  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: publicLink })).toBeVisible()

  // A Reader with no account plays the Story out on the engine the Preview ran.
  const reader = await readerAt(browser, publicLink)
  expect(reader.status).toBe(200)
  await expect(reader.page.getByRole('heading', { name: story.title })).toBeVisible()
  await readToTheEnd(reader.page)

  // A second Reader starts the Story over, and the first stays where they were:
  // a Reading carries its own State and shares it with nobody.
  const other = await readerAt(browser, publicLink)
  await expect(other.page.getByText('A door opens.')).toBeVisible()
  await expect(reader.page.getByRole('status')).toHaveText('The path ends here.')

  // Unpublishing takes the link away from everyone who had it.
  await page.getByRole('button', { name: 'Unpublish this Story' }).click()
  await expect(page.getByRole('button', { name: 'Publish this Story', exact: true })).toBeVisible()
  expect((await readerAt(browser, publicLink)).status).toBe(404)

  // Publishing again revives the same link rather than minting another, which is
  // what a stable link means to an Author who unpublished to fix a Scene.
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: publicLink })).toBeVisible()
  const again = await readerAt(browser, publicLink)
  expect(again.status).toBe(200)
  await expect(again.page.getByText('A door opens.')).toBeVisible()
})

test('a Story with no opening Scene cannot be published', async ({ page, request }) => {
  // A Story with no Scenes has no opening Scene, and so nothing for a Reading to
  // start on: published, its link would answer every Reader with an ending.
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story with nothing in it' },
  })).json()

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'A Story needs an opening Scene before it can be published. '
    + 'Open a Scene on the graph and mark it as the one to start on.')
  await expect(page.getByRole('button', { name: 'Publish this Story', exact: true })).toBeVisible()
})
