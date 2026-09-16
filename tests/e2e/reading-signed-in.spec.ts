import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { forgetName, test, writeStory } from './author'

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
  await reading.getByRole('button', { name: 'Read Again from the Start' }).click()
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

test('a Reader who finishes a Story is led on to its Author and to the Catalogue', async ({
  page,
  request,
  browser,
  baseURL,
  author,
}) => {
  const story = await writeStory(request)
  const link = `${baseURL}/read/${story.id}`

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: link })).toBeVisible()

  // Read by somebody with no account at all, which is the whole claim: the
  // sealed session this suite hands every context travels in a header, so it is
  // emptied here as the Catalogue's own specs empty it, and the address and the
  // language are given by hand because a context opened this way takes neither.
  const context = await browser.newContext({ baseURL, locale: 'en-US', extraHTTPHeaders: {} })
  const reading = await context.newPage()
  await reading.goto(link)

  await expect(reading.getByText('Favourites and Lists are kept per account')).toBeVisible()

  // The header wears the wordmark every other public page wears, and it leads
  // where a Profile's leads: the room a Story is found in rather than sent from.
  await expect(reading.getByRole('link', { name: 'Frameline' }))
    .toHaveAttribute('href', '/catalogue')

  // Nothing that leads away is drawn in the reel: what the frame offers is the
  // Story and nothing beside it, and everything else waits under the Exits.
  await expect(reading.locator('.reading').getByRole('link')).toHaveCount(0)

  // Signed as an entry on a shelf is, and the Name is the way to the Author.
  await expect(reading.getByRole('link', { name: author.name! }))
    .toHaveAttribute('href', `/profile/${author.id}`)

  // The Story played to its end, and from the ending the Catalogue is one press.
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByRole('status')).toHaveText('The path ends here.')

  await reading.getByRole('link', { name: 'Find Stories in the Catalogue' }).click()
  await expect(reading).toHaveURL(`${baseURL}/catalogue`)

  // An Author who has never written a Name signs nothing, which is what a shelf
  // does: no byline, and never the one thing an account always has. The way on
  // to the Catalogue is unmoved — it was never the Author's to offer.
  await forgetName(author)
  await reading.goto(link)
  await expect(reading.getByRole('link', { name: 'Find Stories in the Catalogue' })).toBeVisible()
  await expect(reading.locator('.onward').getByRole('link', { name: author.name! })).toHaveCount(0)
  await expect(reading.getByText(author.email)).toHaveCount(0)
})

test('a Reader steps back a beat, inside a Scene and across the Exit they took', async ({ page, request, browser, baseURL }) => {
  const story = await writeStory(request)
  const link = `${baseURL}/read/${story.id}`

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: link })).toBeVisible()

  const { page: reading } = await reader(browser, link)
  const stepBack = reading.getByRole('button', { name: 'Step Back' })

  // Nothing is behind the first beat, so nothing is offered to step back to.
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await expect(stepBack).toHaveCount(0)

  // One beat on and one beat back, by the keyboard: the frame shows the Shot
  // before, the count says so, and the control goes away with the beat it undid.
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByText('She steps out.')).toBeVisible()
  await stepBack.press('Enter')
  await expect(reading.getByText('A door opens.')).toBeVisible()
  await expect(reading.getByText('Shot 1 of 2')).toBeVisible()
  await expect(stepBack).toHaveCount(0)

  // Out of the Scene by the Exit it offers, and back in by the same one: the
  // Street is where it was, played out, with its way on offered again.
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()

  await stepBack.click()
  await expect(reading.getByText('She steps out.')).toBeVisible()
  await expect(reading.getByText('Shot 2 of 2')).toBeVisible()
  await expect(reading.getByRole('button', { name: 'Follow her out' })).toBeVisible()

  // A step back is a move like any other, so it is kept like any other: the
  // Reading picked up next visit is the one that stepped back, not the one that
  // was three beats further on.
  await reading.reload()
  await expect(reading.getByText('She steps out.')).toBeVisible()
  await expect(pickedUp(reading)).toBeVisible()

  // And the way on taken again arrives where it did, with nothing counted twice:
  // the Story ends where it ended, one Shot after the Bar's own.
  await reading.getByRole('button', { name: 'Follow her out' }).click()
  await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reading.getByRole('status').filter({ hasText: 'The path ends here.' })).toBeVisible()
})

test('an Exit the Author closed is not crossed backwards, and the Scene behind it still is', async ({ page, request, browser, baseURL }) => {
  const story = await writeStory(request)
  const link = `${baseURL}/read/${story.id}`
  const { exits } = await (await request.get(`/api/stories/${story.id}`)).json()

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
  await expect(page.getByRole('link', { name: link })).toBeVisible()

  /**
   * Somebody who has never read this Story, standing in the bar: a Reader of
   * their own each time, because a browser that has read it already is put back
   * where it stood and would be reading a Path rather than the rule under test.
   * The street is read to its end on the way, which is the one thing every one of
   * these has in common.
   */
  async function inTheBar() {
    const { page: reading } = await reader(browser, link)
    await reading.getByRole('button', { name: 'Next Shot' }).click()
    await reading.getByRole('button', { name: 'Next Shot' }).click()
    await reading.getByRole('button', { name: 'Follow her out' }).click()
    await expect(reading.getByText('Smoke, and no one she knows.')).toBeVisible()
    return reading
  }

  const stepBack = (reading: Page) => reading.getByRole('button', { name: 'Step Back' })

  // The one way on out of the street says the Reader does not come back through
  // it. Nothing else about the Story changes.
  await request.patch(`/api/exits/${exits[0].id}`, { data: { stepsBack: false } })

  // Inside the street the beat before is still a beat before: a closed Exit
  // closes a door, it does not stop a Reader re-reading what they have read.
  const { page: reading } = await reader(browser, link)
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await stepBack(reading).click()
  await expect(reading.getByText('A door opens.')).toBeVisible()

  // Through the Exit, and there is no way back: the Story is there to be read
  // again from the start, and the beat behind is not on offer.
  const closed = await inTheBar()
  await expect(stepBack(closed)).toHaveCount(0)
  await expect(closed.getByRole('button', { name: 'Read Again from the Start' })).toBeVisible()

  // The Exit says it over its Story, which says the opposite: a Story that
  // crosses nothing back still crosses back the one Exit that says it does.
  await request.patch(`/api/stories/${story.id}`, { data: { stepsBack: false } })
  await request.patch(`/api/exits/${exits[0].id}`, { data: { stepsBack: true } })
  const open = await inTheBar()
  await stepBack(open).click()
  await expect(open.getByText('She steps out.')).toBeVisible()
  await expect(open.getByRole('button', { name: 'Follow her out' })).toBeVisible()

  // And an Exit that says nothing answers as its Story says, which now refuses.
  await request.patch(`/api/exits/${exits[0].id}`, { data: { stepsBack: null } })
  await expect(stepBack(await inTheBar())).toHaveCount(0)
})
