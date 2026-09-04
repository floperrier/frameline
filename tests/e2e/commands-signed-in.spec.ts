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
 * The bar opened by its key, for the one width at which the control above the
 * graph is not on screen: the writing surface covers the bench below 44rem, and
 * what the bar is asked for there is the bench behind it. The surface carries a
 * *Commands* of its own at that width — the spec above holds it — so the key is
 * the second way in and not the only one.
 *
 * Pressed once, with none of the repeating `open` above does. The reason that
 * loop presses the control rather than the key is that the key is a toggle and a
 * repeat that was not needed puts the bar away again — so a loop around this one
 * would drive the very state it is waiting for. It needs none: by the time this
 * is reached the page has already answered a gesture, which is the whole of what
 * the loop is there to establish.
 */
async function openByKey(page: Page) {
  await page.keyboard.press('ControlOrMeta+k')
  await expect(typing(page)).toBeFocused()
}

/**
 * The bar of Commands: every act the bench is offering, reached by naming it.
 * What each spec here is really holding is the contract in
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md` — that a
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
  await expect(offered(page)).toHaveCount(7)
  for (const named of [
    'Go to Le café',
    'Go to The alley',
    'Fit the Graph',
    'Publish this Story',
    'Read the Remarks',
  ]) {
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
  await expect(offered(page).filter({ hasText: 'Add a Shot' })).toBeVisible()

  // Escape belongs to the bar while the bar is up. The page listens for the same
  // key to close the writing surface, and the Scene has to still be there after.
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)
  await typing(page).fill('Add a Shot')
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

test('on a phone the writing surface carries its own way into the bar', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await expect(page.getByRole('article', { name: 'The street' })).toBeVisible()

  await writeScene(page, 'The street')
  const surface = page.getByRole('group', { name: 'Writing The street' })
  await expect(surface).toBeVisible()

  // Wide, the row above the graph is beside the surface and carries the one
  // control: the surface draws none, so no screen shows the act twice.
  await expect(commanding(page)).toHaveCount(1)
  await expect(surface.getByRole('button', { name: 'Commands' })).toBeHidden()

  // Narrow, the surface covers that row, and the way in is the surface's own —
  // a press, where the key would ask for a keyboard a phone does not have.
  await page.setViewportSize({ width: 600, height: 800 })
  const within = surface.getByRole('button', { name: 'Commands' })
  await expect(within).toBeVisible()
  await within.click()
  await expect(typing(page)).toBeFocused()

  // And it reaches the bench the surface is covering, without the surface
  // having been closed. Named in full: *bar* alone would also answer with the
  // Condition on the way on from *The street* to *The bar*, which is on the bar
  // too and rightly, so the spec asks for the one act it is about to press.
  await typing(page).fill('Go to The bar')
  await expect(offered(page)).toHaveText(['Go to The bar'])
  await offered(page).click()
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toHaveValue('The bar')
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

  await page.getByRole('button', { name: 'Leave It' }).click()
  await expect(page.getByRole('article', { name: 'The bar' })).toBeVisible()
})

test('the bar names every act marked on a Scene being written, and no other', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)

  // The whole of the bar over a Scene being written, in the order the bench draws
  // it. Held exhaustively rather than by a filter apiece, because what this spec
  // is for is coverage: which acts are nameable is a decision, and a control that
  // arrives unmarked — or a mark nobody meant to add — has to arrive with a red
  // run rather than be noticed by an Author who went looking for it. The record
  // is `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
  //
  // Two acts are not among them, and rightly. The fit is gone because a Scene
  // being written folds the graph into a rail and takes the whole dial with it,
  // and marking the Opening Scene is gone because *The street* is already the one
  // the Story opens on — an act with nothing left to do is not offered. The bar
  // cannot offer an act the bench is not drawing, and the spec below holds the
  // mark where the act does have something to do.
  await expect(offered(page)).toHaveText([
    'Publish this Story',
    'Read the Remarks',
    'Go to The street',
    'Go to The bar',
    'Close this Panel',
    'Delete Scene',
    'Add a Flag',
    'Add a Condition to Shot 1 of The street',
    'Add a Condition to Shot 2 of The street',
    'Add a Shot',
    'Add a Condition to the Exit 1 to The bar',
    'Add an Exit',
  ])
})

test('an Author writes a way on by naming the act, and the hand lands on the select', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  // The bar, which nothing leads out of yet: the way on written here is its first.
  await writeScene(page, 'The bar')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)
  await typing(page).fill('exit')
  await expect(offered(page)).toHaveText(['Add an Exit'])
  await typing(page).press('Enter')

  // A select cannot be pressed, so the bar puts the hand on it: the bar is gone
  // and focus is on the field at the foot of the document, where one press opens
  // the list. Whether a browser opens it unasked is the browser's own, so the
  // spec holds focus and then chooses the way a keyboard would.
  await expect(page.locator('dialog.commands')).toBeHidden()
  const adding = page.getByRole('combobox', { name: 'An Exit from here' })
  await expect(adding).toBeFocused()
  await adding.selectOption({ label: 'The street' })

  // The act ran on the Story: The bar now has a way on to The street. Where a way
  // on already written leads is a row's own, and the exhaustive spec above holds
  // that the bar does not offer it.
  await expect(page.getByRole('combobox', { name: 'Where the Exit 1 out of The bar leads' }))
    .toHaveValue(/./)
})

test('an Author sets a Flag and marks the Opening Scene by naming them', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  // The second Scene written, so the Story already opens on the other one: what
  // marking does here is move the role rather than fill an empty seat.
  await writeScene(page, 'The bar')
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()

  await open(page)
  await typing(page).fill('Add a Flag')
  await offered(page).click()

  // The row is on the surface with the hand in it, which is what the control
  // does: a Command is that press and nothing more.
  await expect(page.getByRole('textbox', { name: 'Name of Flag 1 set on entering The bar' }))
    .toBeFocused()

  await open(page)
  await typing(page).fill('Opening')
  await expect(offered(page)).toHaveText(['Mark as the Opening Scene'])
  await offered(page).click()

  // The act ran on the Story: the Scene on the surface is the one the Story
  // opens on, and the radio that performs it says so.
  await expect(page.getByRole('radio', { name: 'Opening Scene The bar' })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Opening Scene The bar' })).toBeChecked()

  // And the act has left the bar, because there is nothing left for it to do: a
  // radio already checked answers a press with no change at all, so the row would
  // press a control and leave the Story exactly as it was.
  await open(page)
  await typing(page).fill('Opening')
  await expect(offered(page).filter({ hasText: 'Mark as the Opening Scene' })).toHaveCount(0)
})

/**
 * The bar and the surface that covers the bench. Below 44rem the writing surface
 * is the whole window and everything behind it is `inert`, and the bar still
 * reaches every one of those acts — which is why the bench is made unreachable
 * by `inert` rather than taken out of the page. A control that is merely out of
 * the keyboard's way is still a control the bar can press, and a bench that was
 * not drawn would be a bar with nothing left to offer: it reads the acts off the
 * controls themselves. See
 * `docs/adr/0036-the-surface-that-covers-the-bench-is-not-a-dialog.md`.
 */
test('the bar reaches the bench the writing surface is covering', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await expect(page.getByRole('article', { name: 'The street' })).toBeVisible()

  await page.setViewportSize({ width: 600, height: 800 })
  await writeScene(page, 'The street')
  await expect(page.getByRole('group', { name: 'Writing The street' })).toBeVisible()

  // Opened by the key rather than by the control above the graph, which the
  // surface covers: what the bar is asked to reach here is the bench behind it,
  // and the surface's own way in is held by the spec above. Named in full,
  // because *bar* alone answers with the Condition on the Exit to The bar too.
  await openByKey(page)
  await typing(page).fill('Go to The bar')
  await expect(offered(page)).toHaveText(['Go to The bar'])
  await offered(page).click()
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toHaveValue('The bar')

  // And Publish, which is drawn in the header the surface covers.
  await openByKey(page)
  await typing(page).fill('Publish')
  await offered(page).click()
  await expect.poll(() => page.request.get(`/api/stories/${story.id}`)
    .then(read => read.json())
    .then(read => Boolean(read.publishedAt))).toBe(true)
})
