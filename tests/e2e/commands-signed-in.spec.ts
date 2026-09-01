import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedScenes, test, writeScene, writeStory } from './author'

/** The field the bar is typed into, which is the bar's own accessible name. */
function typing(page: Page) {
  return page.getByRole('textbox', { name: 'Type a name' })
}

/** The control the bar is opened by, named for the bar and carrying its key. */
function commanding(page: Page) {
  return page.getByRole('button', { name: 'Commands' })
}

/** Every Command the bar is offering under what has been typed, in its order. */
function offered(page: Page) {
  return page.locator('dialog.commands li button')
}

/**
 * Opens the bar by its control, which is also how a spec waits for the page to
 * be answering at all: `page.goto` returns when the document has loaded and not
 * when Vue has attached anything to it, so the first gesture of a test can land
 * on a page that is still inert.
 *
 * The press is repeated until it takes, and it is a press on the control rather
 * than the key deliberately. The key is a toggle, so a repeat that was not
 * needed puts the bar away again and the loop drives the very state it is
 * waiting for; the control only ever opens, so a repeat that was not needed
 * costs nothing. The keys have a spec of their own, which runs after this has
 * proved the page is live.
 */
async function open(page: Page) {
  const up = page.locator('dialog.commands[open]')

  await expect(async () => {
    if (!await up.count()) await commanding(page).click()
    await expect(typing(page)).toBeFocused({ timeout: 1000 })
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

  await expect(commanding(page).locator('kbd')).toHaveText([/⌘|Ctrl/, 'K'])
  await open(page)

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

  // The page has to be answering before a key press means anything, so the
  // pointer opens the bar once first and Escape puts it away.
  await open(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog.commands')).toBeHidden()

  // `ControlOrMeta` is the key this platform writes the shortcut with, which is
  // the same reading the legend above the bench makes of it.
  await page.keyboard.press('ControlOrMeta+k')
  await expect(typing(page)).toBeFocused()

  // The same keys again put it away: the hand that reached for the bar is the
  // hand that changed its mind.
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.locator('dialog.commands')).toBeHidden()

  // Put away and asked for again in one breath, which is what a hand that
  // changed its mind twice does. A `<dialog>` reports its own shutting from a
  // queued task, so the report of the first closing arrives after the second
  // opening: the bar has to still be there when it does.
  await page.keyboard.press('ControlOrMeta+k')
  await expect(typing(page)).toBeFocused()
  await expect(page.locator('dialog.commands[open]')).toHaveCount(1)

  await typing(page).fill('Le café')
  await typing(page).press('Enter')

  await expect(page.getByRole('textbox', { name: 'Name of this Scene' }))
    .toHaveValue('Le café')
})

test('the keyboard walks the Commands the typed name reaches', async ({ page, request }) => {
  const story = await writeStory(request)
  await seedScenes(story, ['The alley', 'The attic'])
  await page.goto(`/stories/${story.id}`)

  await open(page)
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

test('a name nothing answers to is offered as a Scene to write', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await open(page)
  await typing(page).fill('The quay at dawn')

  // Told that nothing answers, and handed the one thing left to do with the
  // name: the empty state is an invitation rather than a dead end.
  await expect(page.locator('dialog.commands')).toContainText('Nothing here answers to that.')
  await expect(offered(page)).toHaveText(['Write a Scene named The quay at dawn'])

  await typing(page).press('Enter')

  // The Scene arrives under the name that was typed rather than a provisional
  // one, and it is the Scene on the writing surface. The name is on the card as
  // well as in the field, so it was written to the Story and read back rather
  // than only put on screen.
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' }))
    .toHaveValue('The quay at dawn')
  await expect(page.getByRole('article', { name: 'The quay at dawn' })).toBeVisible()

  // And it is reachable by its name from the bar like every other Scene, which
  // is what says the Story holds it.
  await open(page)
  await typing(page).fill('The quay')
  await expect(offered(page)).toHaveText(['Go to The quay at dawn'])
})

test('the offer to write a Scene stands only where nothing answers', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await open(page)

  // Nothing typed: every Command, and no offer to write anything — there is no
  // name to write it under.
  await expect(offered(page).filter({ hasText: 'Write a Scene named' })).toHaveCount(0)

  // A name that answers: the Scene it reaches, and still no offer. An Author
  // halfway through typing a name they already have is not making a second one.
  await typing(page).fill('The str')
  await expect(offered(page)).toHaveText(['Go to The street'])
})

test('the bar offers the acts of the Scene being written, and Escape leaves that Scene open', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)
  // The acts inside the writing surface are on offer because the surface is
  // open: what the bar lists is what the bench is drawing.
  await expect(offered(page).filter({ hasText: 'Add Shot' })).toBeVisible()

  // Escape belongs to the bar while the bar is up. The page listens for the same
  // key to close the writing surface, and the Scene has to still be there after.
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)
  await typing(page).fill('Add Shot')
  await offered(page).click()

  // The act ran on the Story: a third Shot where the Scene had two.
  await expect(page.getByRole('textbox', { name: 'Shot 3', exact: true })).toBeVisible()
})

test('an Author publishes a Story from the bar', async ({ page, request, baseURL }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)

  await open(page)
  await typing(page).fill('Publish')
  await offered(page).click()

  await expect(page.getByRole('link', { name: `${baseURL}/read/${story.id}` })).toBeVisible()

  // And the act that undoes it is in the bar the moment the bench draws it,
  // where the act that did it no longer is.
  await open(page)
  await typing(page).fill('publish this story')
  await expect(offered(page)).toHaveText(['Unpublish this Story'])
})

test('a destructive Command asks before it acts, as its own control does', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The bar')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)
  await typing(page).fill('Delete Scene')
  await offered(page).click()

  // The bar goes and the question comes up in its place: a Command is one press
  // of one control, and this control asks.
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.getByRole('dialog')).toContainText('This cannot be undone')

  await page.getByRole('button', { name: 'Leave it' }).click()
  await expect(page.getByRole('article', { name: 'The bar' })).toBeVisible()
})
