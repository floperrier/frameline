import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sceneNode, seedScenes, test, writeScene, writeStory } from './author'

/**
 * The field one Scene's name is written in. Every Scene of the Story is writable
 * where it stands, and each field is named for the Scene it names — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 */
function naming(page: Page, scene: string) {
  return page.getByRole('textbox', { name: `Name of ${scene}` })
}

/**
 * Where the caret ended up. *Go to* winds the document to a Scene rather than
 * opening one — there is nothing to open — so what says the act ran is the mark
 * the rail lights and the address under it, and not a field taking focus. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 */
async function caretIn(page: Page, scene: string) {
  await expect(sceneNode(page, scene)).toHaveClass(/here/)
}

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
  // Publish above them and every act of the Scene the caret is in. A bar that
  // started empty would be a search. The Remarks are named *Close* because they
  // stand open — they flow in a region of their own now rather than covering the
  // table, so there is room to say what they found without being asked, and a
  // Command is named for what pressing it does. See
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  for (const named of [
    'Go to Le café',
    'Go to The alley',
    'Publish this Story',
    'Close the Remarks',
  ]) {
    await expect(offered(page).filter({ hasText: named })).toBeVisible()
  }

  // `cafe` for *Le café*: the accent is on the letter and not on every keyboard,
  // so the Scene answers to the name as it is typed.
  await typing(page).fill('cafe')
  await expect(offered(page)).toHaveText(['Go to Le café'])
  await offered(page).click()

  // The caret is in that Scene, and the bar has gone.
  await caretIn(page, 'Le café')
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

  await caretIn(page, 'Le café')
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
  await caretIn(page, second)
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
  // one, and the caret is in it. Its section of the document is named by the
  // Scene, so the name was written to the Story and read back rather than only
  // put on screen.
  await expect(naming(page, 'The quay at dawn')).toBeFocused()
  await expect(page.getByRole('group', { name: 'Writing The quay at dawn' })).toBeVisible()

  // And it is a Scene of the Story like every other, with a mark of its own on the
  // rail: *Go to* winds the document to a Scene rather than opening it, so it is
  // an act every Scene of the Story still has — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await writeScene(page, 'The street')
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

  // A name that answers: the Scene it reaches — and every act naming it on the
  // Scene being written — and still no offer. An Author halfway through typing a
  // name they already have is not making a second one.
  await typing(page).fill('The b')
  await expect(offered(page)).toContainText(['Go to The bar'])
  await expect(offered(page).filter({ hasText: 'Write a Scene named' })).toHaveCount(0)
})

test('the bar offers the acts of the Scene being written, and Escape leaves that Scene open', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  await expect(page.locator('.writing')).toBeVisible()

  await open(page)
  // The acts inside the writing surface are on offer because the surface is
  // open: what the bar lists is what the bench is drawing.
  await expect(offered(page).filter({ hasText: 'Add a Shot' })).toBeVisible()

  // Escape belongs to the bar while the bar is up. The page listens for the same
  // key to close the writing surface, and the Scene has to still be there after.
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.locator('.writing')).toBeVisible()

  await open(page)
  await typing(page).fill('Add a Shot')
  await offered(page).click()

  // The act ran on the Story: a third Shot where the Scene had two.
  await expect(page.getByRole('textbox', { name: 'Shot 3 of The street', exact: true }))
    .toBeVisible()
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
  await expect(page.locator('.writing')).toBeVisible()

  await open(page)
  await typing(page).fill('Delete Scene')
  await offered(page).click()

  // The bar goes and the question comes up in its place: a Command is one press
  // of one control, and this control asks.
  await expect(page.locator('dialog.commands')).toBeHidden()
  await expect(page.getByRole('dialog')).toContainText('This cannot be undone')

  await page.getByRole('button', { name: 'Leave It' }).click()
  await expect(page.getByRole('group', { name: 'Writing The bar' })).toBeVisible()
})

test('the bar names every act marked on a Scene being written, and no other', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')
  await expect(page.locator('.writing')).toBeVisible()

  await open(page)

  // The whole of the bar over a Scene being written, in the order the bench draws
  // it. Held exhaustively rather than by a filter apiece, because what this spec
  // is for is coverage: which acts are nameable is a decision, and a control that
  // arrives unmarked — or a mark nobody meant to add — has to arrive with a red
  // run rather than be noticed by an Author who went looking for it. The record
  // is `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
  //
  // Marking the Opening Scene is not among them, because *The street* is already
  // the one the Story opens on — an act with nothing left to do is not offered.
  // The bar cannot offer an act the bench is not drawing, and the spec below
  // holds the mark where the act does have something to do.
  //
  // The Condition on the second beat *is* among them, and that is new with #252:
  // the run is one field per beat and every beat carries its own marks, where the
  // gate drew one beat and no other. What keeps the bar from growing with the
  // Story instead of with the Scene is the other half of the same rule — a mark
  // that acts on one row carries its Command name only in the Scene the caret
  // stands in, so *The bar* below contributes nothing at all. See
  // `docs/adr/0043-a-story-is-written-as-one-document.md`, which is where the rule
  // is written, and the spec under this one, which holds the silence.
  //
  // Four things did change, with
  // `docs/adr/0043-a-story-is-written-as-one-document.md`, and the order is one of
  // them: the bar reads the bench in document order, and the bench is now the
  // Story's own edge, then the rail, then the document, then what the bench says
  // beside it — so the Remarks, which used to be first because they were laid over
  // the head of the table, are last.
  //
  // *The whole Story* is gone with the gate: there is no gate to lift off a
  // drawing any more, because the drawing is a rail beside the document and the
  // whole Story is in the document at every moment.
  //
  // And *Go to The street* is back. It went when the Scene the gate stood on lost
  // its node; the rail draws every Scene of the Story, the one the caret is in
  // included, so every one of them is an act the bench is offering — and the act
  // has something left to do, because *Go to* now winds the document to a Scene
  // rather than opening it. The rail is `aria-hidden`, which the bar does not
  // consult: it filters by `checkVisibility()`.
  //
  // The Remarks are named *Close* rather than *Read* because they stand open:
  // they flow in a region of their own now instead of covering the table, so
  // there is room to say what they found without being asked, and a Command is
  // named for what pressing it does.
  await expect(offered(page)).toHaveText([
    'Read the Story',
    'Publish this Story',
    'Go to The street',
    'Go to The bar',
    'Delete Scene',
    'Add a Flag',
    'Add a Condition to Shot 1 of The street',
    'Add a Condition to Shot 2 of The street',
    'Add a Shot',
    'Add a Condition to the Exit 1 to The bar',
    'Add an Exit',
    'Close the Remarks',
  ])
})

test('an Author writes a way on by naming the act, and the hand lands on the field', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  // The bar, which nothing leads out of yet: the way on written here is its first.
  await writeScene(page, 'The bar')
  await expect(page.locator('.writing')).toBeVisible()

  await open(page)
  await typing(page).fill('exit')
  await expect(offered(page)).toHaveText(['Add an Exit'])
  await typing(page).press('Enter')

  // A field cannot be pressed, so the bar puts the hand on it: the bar is gone
  // and focus is at the foot of the document, where the Scene the way on leads
  // to is named.
  await expect(page.locator('dialog.commands')).toBeHidden()
  // Named for the Scene it leaves as well as for what it does: the document holds
  // one of these at the foot of every Scene, so the label says which foot.
  const adding = page.getByRole('combobox', { name: 'An Exit from here The bar' })
  await expect(adding).toBeFocused()
  await adding.fill('The street')
  await adding.press('Enter')

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
  await expect(page.locator('.writing')).toBeVisible()

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
  //
  // Read back past the page before the reload, because the radio is checked by
  // the browser the instant it is pressed and the write is still on its way out:
  // a reload on top of an unfinished request cancels it, and the bench comes back
  // saying what the Story never heard. The reload is here to prove the mark was
  // kept rather than drawn, so it has to happen after the keeping.
  const bar = await (await page.request.get(`/api/stories/${story.id}`)).json()
    .then((read: { scenes: { id: string, name: string }[] }) =>
      read.scenes.find(scene => scene.name === 'The bar')!)
  await expect(page.getByRole('radio', { name: 'Opening Scene The bar' })).toBeChecked()
  await expect
    .poll(async () => (await (await page.request.get(`/api/stories/${story.id}`)).json())
      .openingSceneId)
    .toBe(bar.id)

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
 * The bar at the width of a phone, where the bench is one column: the Graph, the
 * document and the header are all still drawn, so the bar reaches every one of
 * their acts — it reads the acts off the controls themselves.
 */
test('the bar reaches every act of the bench at the width of a phone', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}`)
  await expect(page.getByRole('group', { name: 'Writing The street' })).toBeVisible()

  await page.setViewportSize({ width: 600, height: 800 })
  await writeScene(page, 'The street')
  await expect(page.getByRole('group', { name: 'Writing The street' })).toBeVisible()

  // Opened by the key. Named in full, because *bar* alone answers with the
  // Condition on the Exit to The bar too.
  await openByKey(page)
  await typing(page).fill('Go to The bar')
  await expect(offered(page)).toHaveText(['Go to The bar'])
  await offered(page).click()
  await caretIn(page, 'The bar')

  // And Publish, which is drawn in the header.
  await openByKey(page)
  await typing(page).fill('Publish')
  await offered(page).click()
  await expect.poll(() => page.request.get(`/api/stories/${story.id}`)
    .then(read => read.json())
    .then(read => Boolean(read.publishedAt))).toBe(true)
})
