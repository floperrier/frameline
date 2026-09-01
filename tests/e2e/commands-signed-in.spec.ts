import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedScenes, test, writeScene, writeStory } from './author'

/** The field the bar is typed into, which is the bar's own accessible name. */
function typing(page: Page) {
  return page.getByRole('textbox', { name: 'Name an act, or a Scene' })
}

/** Every Command the bar is offering under what has been typed, in its order. */
function offered(page: Page) {
  return page.locator('dialog.commands li button')
}

/**
 * Opens the bar with the key it answers to. A press is a moment and not a
 * state: sent before Nuxt has hydrated the page it lands on a document with no
 * listener on it and is gone, and nothing retries it the way Playwright retries
 * a click. So it is pressed until the bar is up — and only while it is not,
 * because the same keys put it away again.
 */
async function openOnKeys(page: Page) {
  await expect(async () => {
    if (!await page.locator('dialog.commands[open]').count()) {
      await page.keyboard.press('ControlOrMeta+k')
    }
    await expect(typing(page)).toBeVisible({ timeout: 1000 })
  }).toPass()
}

/**
 * The bar of Commands: every act the bench is offering, reached by naming it.
 * What each spec here is really holding is the contract in
 * `docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md` — that a
 * Command is a control already on the bench and running one presses it — so each
 * asserts the act happened on the Story and not merely that the bar closed.
 */
test('an Author goes to a Scene by naming it, accents or none', async ({ page, request }) => {
  const story = await writeStory(request)
  await seedScenes(story, ['Le café', 'The alley'])
  await page.goto(`/stories/${story.id}`)

  await page.getByRole('button', { name: 'Commands', exact: true }).click()

  // Everything the bench can do, before a letter is typed: the four Scenes, the
  // fit above them and the Publish beside it. A bar that started empty would be
  // a search.
  await expect(offered(page)).toHaveCount(6)
  for (const named of ['Go to Le café', 'Go to The alley', 'Fit the graph', 'Publish this Story']) {
    await expect(offered(page).filter({ hasText: named })).toBeVisible()
  }

  // `cafe` for *Le café*: the accent is on the letter and not on every keyboard,
  // so the Scene answers to the name as it is typed.
  await typing(page).fill('cafe')
  await expect(offered(page)).toHaveText(['Go to Le café'])
  await offered(page).click()

  // The Scene is on the writing surface, and the bar has gone.
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' }))
    .toHaveValue('Le café')
  await expect(page.locator('dialog.commands')).toBeHidden()
})

test('the bar opens and closes on the key, and Enter runs the first Command', async ({ page, request }) => {
  const story = await writeStory(request)
  await seedScenes(story, ['Le café'])
  await page.goto(`/stories/${story.id}`)

  // `ControlOrMeta` is the key this platform writes the shortcut with, which is
  // the same reading the legend above the bench makes of it.
  await openOnKeys(page)
  await expect(typing(page)).toBeFocused()

  // The same keys again put it away: the hand that reached for the bar is the
  // hand that changed its mind.
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.locator('dialog.commands')).toBeHidden()

  await openOnKeys(page)
  await typing(page).fill('Le café')
  await typing(page).press('Enter')

  await expect(page.getByRole('textbox', { name: 'Name of this Scene' }))
    .toHaveValue('Le café')
})

test('the keyboard walks the Commands the typed name reaches', async ({ page, request }) => {
  const story = await writeStory(request)
  await seedScenes(story, ['The alley', 'The attic'])
  await page.goto(`/stories/${story.id}`)

  await openOnKeys(page)
  await typing(page).fill('Go to The a')
  await expect(offered(page)).toHaveCount(2)
  // Which of the two the bench draws second is the bench's to settle, so the
  // second one is read rather than named: what is held here is where the keys go.
  const second = (await offered(page).nth(1).innerText()).replace('Go to ', '')

  // Down from the field arrives at the first, down again at the second, and up
  // from the first goes back to the field. Nothing wraps: a list that came round
  // to the top would be one an Author cannot tell the end of.
  await typing(page).press('ArrowDown')
  await expect(offered(page).nth(0)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(offered(page).nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(offered(page).nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(typing(page)).toBeFocused()

  // Enter on the one under focus runs that one and not the first.
  await typing(page).press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' }))
    .toHaveValue(second)
})

test('a name nothing answers to leaves the bench alone', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await openOnKeys(page)
  await typing(page).fill('a Scene nobody wrote')

  await expect(offered(page)).toHaveCount(0)
  await expect(page.locator('dialog.commands')).toContainText('Nothing here answers to that.')

  // Enter on nothing does nothing, rather than running whatever stood first
  // before the field was typed in.
  await typing(page).press('Enter')
  await expect(typing(page)).toBeFocused()
})

test('the bar offers the acts of the Scene being written, and Escape leaves that Scene open', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await openOnKeys(page)
  // The acts inside the writing surface are on offer because the surface is
  // open: what the bar lists is what the bench is drawing.
  await expect(offered(page).filter({ hasText: 'Add Shot' })).toBeVisible()

  // Escape belongs to the bar while the bar is up. The page listens for the same
  // key to close the writing surface, and the Scene has to still be there after.
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await openOnKeys(page)
  await typing(page).fill('Add Shot')
  await offered(page).click()

  // The act ran on the Story: a third Shot where the Scene had two.
  await expect(page.getByRole('textbox', { name: 'Shot 3', exact: true })).toBeVisible()
})

test('an Author publishes a Story from the bar', async ({ page, request, baseURL }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await openOnKeys(page)
  await typing(page).fill('Publish')
  await offered(page).click()

  await expect(page.getByRole('link', { name: `${baseURL}/read/${story.id}` })).toBeVisible()

  // And the act that undoes it is in the bar the moment the bench draws it,
  // where the act that did it no longer is.
  await openOnKeys(page)
  await typing(page).fill('publish this story')
  await expect(offered(page)).toHaveText(['Unpublish this Story'])
})

test('a destructive Command asks before it acts, as its own control does', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The bar')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await openOnKeys(page)
  await typing(page).fill('Delete Scene')
  await offered(page).click()

  // The bar goes and the question comes up in its place: a Command is one press
  // of one control, and this control asks.
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.getByRole('dialog')).toContainText('This cannot be undone')

  await page.getByRole('button', { name: 'Leave it' }).click()
  await expect(page.getByRole('article', { name: 'The bar' })).toBeVisible()
})
