import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { ONE_PIXEL, live, readExits, sceneNode, seedExit, seedScenes, test, toast } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The bench as one document: the rail, the writing and what the bench says beside
 * them — three regions that never trade width, at every width — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 *
 * That record names the claims it stands on and asks for them to be measured
 * rather than asserted, and this is where they are measured. Everything the
 * document is *made of* — that a Scene reads in the order the Graph draws it, that
 * an Exit names where it leads, that a Remark opens the Scene it is about — is
 * held in the specs those things belong to. What is here is what the bench
 * promises whole, and there are eight of them: that nothing runs off the side of
 * the page at any of five widths, that the count of controls on screen does not
 * grow with the Story, that a row not under the hand carries its marks at the
 * weight of the words around them and every one of them is still a tab stop where
 * it stands, that the bar of Commands grows with the Story in *Go to* and in
 * nothing else, that neither a tab order nor a press leaves anything in the
 * drawing, that a press on the drawing ends the typing it interrupted, that the
 * address still names a Scene and the document is scrolled to it, and that nothing
 * the bench offers answers to a name another thing it offers answers to.
 */

/**
 * A Story of `many` Scenes, chained by Exits, opening on the first: one Author's
 * work at whatever size a test needs it.
 *
 * Chained rather than left loose on purpose, and it matters most where the
 * controls are counted. A Story of forty Scenes nothing arrives at is forty
 * Remarks, and the Remarks are sentences the bench says about a Story an Author
 * is in the middle of — advisory, and growing with what is still to do rather than
 * with the work. What `0043` claims is that the *layout* does not hand the screen
 * more controls as the Story grows, so what it is measured on is a Story that
 * holds together at both sizes.
 *
 * The chain closes on itself — the last Scene leads back to the first — so that
 * every Scene of it is the same shape: one Exit leaving, one arriving, one beat.
 * With a loose end the last Scene of a Story of three carries no way on at all
 * while the third Scene of a Story of forty does, and the two counts would then
 * differ by the Story's ragged edge rather than by the layout, which is the thing
 * under test.
 *
 * The Opening Scene is marked through its own route, because a Scene seeded past
 * the API never becomes one.
 */
async function chained(request: APIRequestContext, many: number) {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story' },
  })).json() as { id: string, title: string }

  const scenes = await seedScenes(story,
    Array.from({ length: many }, (_, place) => `Scene ${place + 1}`))

  for (const [place, scene] of scenes.entries()) {
    await seedExit(scene.id, scenes[(place + 1) % many]!.id)
  }
  expect((await request.post(`/api/scenes/${scenes[0]!.id}/opening`)).ok()).toBeTruthy()

  return { story, scenes }
}

/**
 * Whether the page runs off its own side. Asked of the document element and of the
 * body both: a surface wider than the window shows up on one or the other
 * depending on which of them the overflow escapes from, and the claim is that
 * neither of them has any.
 */
function scrollsSideways(page: Page) {
  return page.evaluate(() => ({
    root: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    body: document.body.scrollWidth > document.body.clientWidth,
  }))
}

/**
 * How many controls are on screen, in the words `0043` defines them in: a control
 * whose box intersects the viewport and which is not `display: none`,
 * `visibility: hidden` or zero-sized, counted from the rendered page rather than
 * from the template.
 *
 * What counts as a control is what a hand or a keyboard can actually operate —
 * `button, input, select, textarea, a[href]` and anything given a tab stop of its
 * own. What is inside an `aria-hidden` subtree is not counted, and that is the
 * rail: it is a drawing that repeats what the document's own markup already says,
 * out of the accessibility tree and out of the tab order on purpose, so counting
 * its marks would be counting the Story twice.
 */
function controlsOnScreen(page: Page, within = 'body') {
  return page.evaluate((where) => {
    const controls = document.querySelector(where)!.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')

    return [...controls].filter((control) => {
      if (control.closest('[aria-hidden="true"]')) return false

      const drawn = getComputedStyle(control)
      if (drawn.display === 'none' || drawn.visibility === 'hidden') return false

      const box = control.getBoundingClientRect()
      if (!box.width || !box.height) return false

      return box.right > 0 && box.bottom > 0
        && box.left < window.innerWidth && box.top < window.innerHeight
    }).length
  }, within)
}

/**
 * How one control is drawn, in the three properties the weight rule is about: what
 * it stands on, what bounds it, and what it is written in. Read off the rendered
 * page rather than off the stylesheet, because what `0043` claims is the weight an
 * Author sees and not the rule that produced it.
 */
function drawnAs(control: Locator) {
  return control.evaluate((one) => {
    const drawn = getComputedStyle(one)

    return {
      stands: drawn.backgroundColor,
      bound: drawn.borderTopColor,
      written: drawn.color,
    }
  })
}

/** What a browser answers for a colour that is not there at all. */
const NOTHING = 'rgba(0, 0, 0, 0)'

/**
 * The five widths `0043` names. Nine hundred and seven hundred and sixty-eight are
 * inside the band between 705 and 1040 pixels where the layout this replaces had
 * no answer at all: wider than the width the gate folded at, narrower than the
 * width a table of nodes beside a gate needed. There is no such band here, because
 * nothing in the layout is measured in pixels of gate.
 */
const widths = [1440, 1180, 900, 768, 390]

test('draws the bench at every width without running off the side of the page',
  async ({ page, request }) => {
    const { story } = await chained(request, 10)

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/stories/${story.id}`)
      await live(page)
      await expect(page.locator('.rail')).toBeVisible()
      await expect(page.locator('.writing')).toBeVisible()

      expect({ width, ...await scrollsSideways(page) })
        .toEqual({ width, root: false, body: false })
    }
  })

test('folds the Remarks and then the rail, and hides neither', async ({ page, request }) => {
  const { story } = await chained(request, 10)

  // Wide: the three regions stand side by side, and the Remarks are open without
  // being asked — there is room for them, so they say what they found.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/stories/${story.id}`)
  await live(page)
  const rail = (await page.locator('.rail').boundingBox())!
  const middle = (await page.locator('.document').boundingBox())!
  // `aside.said`, because `p.said` is what a Reader presses on a way on: the
  // region the bench speaks from and the words an Exit carries are two different
  // things, each named in its own component's scoped block.
  const said = (await page.locator('aside.said').boundingBox())!

  expect(rail.width).toBe(220)
  expect(middle.x).toBeGreaterThanOrEqual(rail.x + rail.width)
  expect(said.x).toBeGreaterThanOrEqual(middle.x + middle.width)
  await expect(page.locator('.found')).toHaveJSProperty('open', true)

  // The first fold: what the bench says goes to the head of the document, where
  // the document is what the window is for, so the Remarks are the line and their
  // count until they are asked for. What folds is the width they are said in and
  // never their voice — the rail spans both rows beside them, and the count is on
  // the screen.
  await page.setViewportSize({ width: 900, height: 900 })
  await expect.poll(async () => (await page.locator('aside.said').boundingBox())!.y)
    .toBeLessThan((await page.locator('.document').boundingBox())!.y)
  await expect(page.locator('.found')).toHaveJSProperty('open', false)
  // One Remark, and the same one at every width: the chain closes on itself, and
  // the way on that closes it is one no Reading is ever handed — see
  // `docs/adr/0048-a-scene-is-entered-once.md`. What is under test is that the
  // count is on the screen once the list is folded shut, whatever it counts.
  await expect(page.locator('.found summary')).toContainText('1')
  expect((await page.locator('.rail').boundingBox())!.width).toBe(220)

  // The second: the rail narrows to a strip the drawing scrolls sideways through,
  // and the document keeps the window. Nothing is covered and nothing is taken
  // away — every Scene still has its point, at the size a finger needs, and the
  // line that opens the Remarks is still there to be pressed.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await page.locator('.rail').boundingBox())!.width)
    .toBeLessThan(96)
  await expect(page.locator('.rail .mark')).toHaveCount(10)
  await expect(page.locator('.found summary')).toBeVisible()
  await expect(page.locator('.writing')).toBeVisible()

  // And pressing it says what the bench found, at the width the record folds them
  // at: the fold took their width and never their voice — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await page.locator('.found summary').click()
  await expect(page.locator('.found'))
    .toContainText('The Exit 1 out of Scene 10 leads back to a Scene')

  // Which leaves the writing where it was, rather than under anything: the list
  // flows at the head of the document and the document keeps the rest.
  const document = (await page.locator('.document').boundingBox())!
  const remarks = (await page.locator('.found').boundingBox())!
  expect(remarks.y + remarks.height).toBeLessThanOrEqual(document.y + 1)
})

test('offers no more controls on a Story of forty Scenes than on one of three',
  async ({ page, request }, testInfo) => {
    // The claim the whole record stands on, and the one number it was written
    // against: ninety-two controls, measured on the gate this replaces.
    //
    // It is a sharper claim since #252 than it was before it. Until then every
    // Scene of the document but one was read, and reading takes no controls, so
    // what the count proved was that thirty-nine read Scenes cost nothing. Now
    // every Scene of the document is written where it stands and carries a full
    // set of its own marks, and what holds the number down is the window: a
    // control is counted where its box meets the viewport, and a document is as
    // tall as the Story however many Scenes are in it. Three Scenes fill the
    // window and so do forty.
    await page.setViewportSize({ width: 1440, height: 900 })

    const small = await chained(request, 3)
    await page.goto(`/stories/${small.story.id}`)
    await live(page)
    await expect(page.locator('.writing')).toBeVisible()
    const few = await controlsOnScreen(page)
    const inTheDocument = await controlsOnScreen(page, '.writing')

    const large = await chained(request, 40)
    await page.goto(`/stories/${large.story.id}`)
    await live(page)
    await expect(page.locator('.writing')).toBeVisible()
    await expect(page.locator('.rail .mark')).toHaveCount(40)
    const many = await controlsOnScreen(page)
    const alsoInTheDocument = await controlsOnScreen(page, '.writing')

    // Kept with the run rather than printed by it: `0043` asks for the number and
    // not only for the comparison — ninety-two is what it is answering — and a
    // number that is only ever compared is a number nobody can quote. Attached, so
    // it is in the report a green run leaves behind without a line of standard
    // output nothing else in this suite writes.
    await testInfo.attach('controls on screen at 1440', {
      contentType: 'text/plain',
      body: `three Scenes: ${few} on the page, ${inTheDocument} in the document; `
        + `forty Scenes: ${many} on the page, ${alsoInTheDocument} in the document`,
    })

    // The Story really did grow, and the screen really did not. Equality and not a
    // ceiling: the claim `0043` stands on is that the layout hands the screen the
    // same controls at either size, and a ceiling is satisfied by a bench drawing
    // none at all.
    expect(few).toBeGreaterThan(0)
    expect(many).toBe(few)

    // And the document is why, said on its own rather than read out of a total.
    // A total is the page's, and the page holds things that answer to something
    // other than the size of the Story: the Story's own edge is a fixed row, and
    // the Remarks are sentences about what is still to do, which a Story held
    // together at both sizes has none of either way. What the layout promises is
    // narrower and is the whole of the claim — that a Scene added to the document
    // adds no control to the bench — so it is measured where it is made.
    expect(alsoInTheDocument).toBe(inTheDocument)
  })

test('draws a row\'s marks at the weight of the words until the hand arrives at the row',
  async ({ page, request }) => {
    // The other half of the count above, and the reason the count is allowed to
    // stand still while the Story grows: the marks are all drawn, all of the time,
    // and what changes is their weight. Issue #253.
    const { story, scenes } = await chained(request, 10)

    // A run of three, so that one beat of it has all four of its marks with
    // something to do: the first of a run has nothing before it to be split from
    // and nothing above it to be moved past, and `chained` seeds one beat a Scene.
    for (let more = 0; more < 2; more++) {
      expect((await request.post(`/api/scenes/${scenes[0]!.id}/shots`)).ok()).toBeTruthy()
    }

    await page.goto(`/stories/${story.id}`)
    await live(page)

    const beat = page.locator(`#scene-${scenes[0]!.id} .shots > li`).nth(1)
    const taking = beat.getByRole('button', { name: 'Delete Shot 2 of Scene 1' })

    // The two weights, taken off the page rather than written down here. The words
    // a mark stands among are the Place in the margin of its own row — this row's
    // own and not a Condition's, which is numbered in a gutter of its own further
    // in; a control at full strength is the one that adds a beat to the end of the
    // run, a hand's width below and never quiet, because it acts on the Scene
    // rather than on a row of it.
    const place = beat.locator('> .numbered')
    const asWords = {
      stands: NOTHING,
      bound: NOTHING,
      written: (await drawnAs(place)).written,
    }
    const asAControl = await drawnAs(page.locator(`#scene-${scenes[0]!.id} .adds button`))
    expect(asAControl).not.toEqual(asWords)

    // Polled rather than read once: the weight changes over a tenth of a second,
    // and a value read inside that is a value the mark is on its way through.
    await expect.poll(() => drawnAs(taking)).toEqual(asWords)

    // The pointer arrives at the row. On the Place, which is no control, so what
    // answers is the row and not the mark's own hover.
    await place.hover()
    await expect.poll(() => drawnAs(taking)).toEqual(asAControl)

    // The hand comes off it, and the keyboard walks in instead: every mark is a
    // tab stop where it stands, in the order the row draws it, and none of them is
    // anywhere else in the document — `display: none` was never the mechanism, so
    // there is nothing to take out and put back.
    //
    // The row is drawn as matter, then what is said of that matter, then the acts
    // on the row: the Image, the words, the Description of the Image, the Sound,
    // the Transcript of the Sound, the Cut, and `.beneath` last by construction —
    // so the Sound's own controls come before the acts, on the same side of the
    // words as the Description, because the Transcript sits under the Sound as the
    // Description sits under the Image. The Cut comes after both, because it is
    // what the beat does at its end rather than what it carries.
    //
    // This beat carries neither Image nor Sound, so neither thing said of them is
    // drawn, and *Listen* and *Take This Sound* are disabled until the `<select>`
    // is standing on something — a disabled control is no tab stop, which is two
    // stops a row this row does not spend.
    await page.mouse.move(0, 0)
    await beat.locator('textarea').focus()

    for (const stop of [
      beat.getByLabel('The Sound of Shot 2 of Scene 1'),
      beat.getByLabel('Upload a Sound for Shot 2 of Scene 1'),
      beat.getByLabel('This Shot is cut Shot 2 of Scene 1', { exact: true }),
      beat.getByLabel('The Cut is made Shot 2 of Scene 1', { exact: true }),
      beat.getByRole('button', { name: 'Add a Condition to Shot 2 of Scene 1' }),
      beat.getByRole('button', { name: 'Split Scene 1 before Shot 2' }),
      beat.getByRole('button', { name: 'Move Earlier Shot 2 of Scene 1' }),
      beat.getByRole('button', { name: 'Move Later Shot 2 of Scene 1' }),
      beat.getByRole('button', { name: 'Delete Shot 2 of Scene 1' }),
    ]) {
      await page.keyboard.press('Tab')
      await expect(stop).toBeFocused()
    }

    // And the caret in the row is the same arrival as the pointer on it: an Author
    // who never touches a mouse never meets a quiet row.
    await expect.poll(() => drawnAs(taking)).toEqual(asAControl)
  })

test('names every Scene in the bar, and the acts of the rows of the Scene the caret is in',
  async ({ page, request }) => {
    const ten = await chained(request, 10)
    await page.goto(`/stories/${ten.story.id}`)
    await live(page)
    await page.getByRole('button', { name: 'Commands' }).click()

    const offered = page.locator('dialog.commands li button')
    await expect(offered.first()).toBeVisible()

    // Every Scene of the Story, named: the rail carries a mark apiece and the bar
    // reads the rail, so anywhere in a document ten Scenes long is one name away.
    await expect(offered.filter({ hasText: 'Go to' })).toHaveCount(10)

    // And the acts of the rows of the Scene the caret is in — the beat's offer of
    // a Condition and the way on's — which is what the weight rule above had to
    // leave alone. They are still named because weight is not presence: the bar
    // asks the browser whether a control is drawn, `checkVisibility()`, and that
    // question does not consult opacity or colour. See
    // `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
    for (const named of [
      'Add a Condition to Shot 1 of Scene 1',
      'Add a Condition to the Exit 1 to Scene 2, out of Scene 1',
    ]) {
      await expect(offered.filter({ hasText: named })).toBeVisible()
    }

    const onTen = await offered.count()

    const forty = await chained(request, 40)
    await page.goto(`/stories/${forty.story.id}`)
    await live(page)
    await page.getByRole('button', { name: 'Commands' }).click()
    await expect(offered.first()).toBeVisible()

    // Thirty more Scenes are thirty more Commands and not one more than that: a
    // mark that acts on one row is drawn on every Scene and named in the Scene the
    // caret stands in, so the thirty-nine Scenes the caret is not in hand the bar
    // their *Go to* and nothing else. That is `0043`'s own rule — drawn
    // everywhere, named where the Author is — and it is why a Story of forty
    // Scenes does not offer forty *Delete Scene*s under one another.
    expect(await offered.count()).toBe(onTen + 30)
  })

test('keeps the rail out of the accessibility tree and out of the tab order',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, 10)

    await page.goto(`/stories/${story.id}`)
    await live(page)

    // The drawing repeats what the document says in words, so it says none of it a
    // second time: the Scenes, where each stands and what arrives at it are all in
    // the document's own markup.
    await expect(page.locator('.rail')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('.rail .mark')).toHaveCount(10)
    await expect(page.locator('.writing .scene')).toHaveCount(10)

    // And no tab order runs through it. Walked rather than read off the
    // attributes: `tabindex="-1"` is the mechanism, and what is claimed is that a
    // hand on the keyboard never lands in a drawing.
    await page.locator('body').press('Tab')
    const landed: string[] = []
    for (let step = 0; step < 40; step++) {
      landed.push(await page.evaluate(() =>
        document.activeElement?.closest('.rail') ? 'the rail' : 'the bench'))
      await page.keyboard.press('Tab')
    }

    expect([...new Set(landed)]).toEqual(['the bench'])

    // What does reach every Scene is the bar every act is named in, which reads
    // the rail's own marks: see
    // `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
    await page.getByRole('button', { name: 'Commands' }).click()
    await page.getByRole('textbox', { name: 'Type a name' }).fill('Go to Scene 7')
    // In the bar, because the document has one of these of its own: the way on at
    // the foot of Scene 6 lands on Scene 7 and its row carries a control named for
    // exactly that.
    await page.locator('dialog.commands').getByRole('button', { name: 'Go to Scene 7' }).click()
    await expect(page).toHaveURL(/scene=/)
    await expect(page.locator('.rail .here')).toHaveAttribute('data-scene', scenes[6]!.id)

    // And it lands the caret where a press on the mark itself does, because it is
    // that mark it presses: one answer to where the focus goes, given in the page's
    // own handler — see the spec below and #265.
    await expect(page.getByRole('textbox', { name: 'Name of Scene 7' })).toBeFocused()
  })

test('leaves no caret in the rail when a mark is pressed, at either width and on every reading',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, 10)

    await page.goto(`/stories/${story.id}`)
    await live(page)

    // The pointer half of the walk above, which neither a `Tab` nor an axe run
    // reaches: a mark is a `<button>` at `tabindex="-1"` inside an `aria-hidden`
    // drawing, and that pair keeps a keyboard out while letting a mouse press
    // straight through — a button still takes the focus on one, and the caret was
    // ending up in a subtree the accessibility tree does not have.
    //
    // Pressed at the width the rail is a plate of two hundred and twenty pixels
    // and at the width it folds to a strip, because what the fold narrows is the
    // window on the drawing and never what can be pressed.
    for (const [width, height, place] of [[1440, 900, 7], [390, 844, 3]] as const) {
      await page.setViewportSize({ width, height })
      await sceneNode(page, `Scene ${place}`).click()

      // The caret is where the document was wound, in the field the Author is about
      // to type in: the Scene's own name, the first of its section.
      await expect(page.getByRole('textbox', { name: `Name of Scene ${place}` })).toBeFocused()
    }

    // The other two readings, where the writing is `display: none` and no field of
    // that Scene is laid out for the caret to follow the wind into. Nothing the page
    // does can move it there, so what has to hold is the drawing refusing the press
    // its own focus — and a mark pressed with the focus already on `<body>` could
    // not tell that apart from the defect, so the caret is put on a control of the
    // bench first and read back off it after.
    await page.setViewportSize({ width: 1440, height: 900 })
    const commanding = page.getByRole('button', { name: 'Commands' })

    for (const [turn, drawn, place] of [
      ['See the Contact Sheet', '.sheet', 5],
      ['Read the Story', '.preview', 2],
    ] as const) {
      await page.getByRole('button', { name: turn }).click()
      await expect(page.locator(drawn)).toBeVisible()
      await commanding.focus()

      await sceneNode(page, `Scene ${place}`).click()

      // The press was answered — the rail lights the Scene it went to — and the
      // hand that made it took nothing away from the keyboard.
      await expect(page.locator('.rail .here'))
        .toHaveAttribute('data-scene', scenes[place - 1]!.id)
      await expect(commanding).toBeFocused()

      // And because nothing took the caret, the bench says where it went: these
      // two readings are the only place that sentence is left to say, the writing
      // answering with a field that announces the Scene under its own name.
      await expect(toast(page)).toHaveText(`Writing Scene ${place}`)
    }
  })

test('lands the caret on the frame the sheet turned to when a mark ends typing in its field',
  async ({ page, request }) => {
    // Ten bands of three, so the sheet has something to wind, and an Image on one
    // Shot of the first Scene, so the one field this reading has is laid out for
    // the caret to be typing in. Nothing in Scene 5 has one: the general case, and
    // the one where the field the caret was in is not there to be put back into.
    const { story, scenes } = await chained(request, 10)
    for (const [place, scene] of scenes.entries()) {
      const second = await (await request.post(`/api/scenes/${scene.id}/shots`)).json() as { id: string }
      if (place === 0) {
        expect((await request.put(`/api/shots/${second.id}/image`, { data: ONE_PIXEL })).ok()).toBeTruthy()
      }
      expect((await request.post(`/api/scenes/${scene.id}/shots`)).ok()).toBeTruthy()
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}`)
    await live(page)
    await page.getByRole('button', { name: 'See the Contact Sheet' }).click()
    const sheet = page.getByRole('region', { name: 'Contact Sheet' })
    await expect(sheet).toBeVisible()

    // The caret in the sheet's own field, with a Description half typed in it. The
    // press on a mark refuses its own focus, so nothing about it ends this typing;
    // the act does, by hand, and then owes the caret a landing.
    await sheet.getByRole('button', { name: 'Shot 2 of Scene 1', exact: true }).click()
    const described = sheet.getByLabel('Description of the image of Shot 2 of Scene 1')
    await described.click()
    await described.pressSequentially('A door onto a wet street.')

    await sceneNode(page, 'Scene 5').click()
    await expect(page.locator('.rail .here')).toHaveAttribute('data-scene', scenes[4]!.id)

    // The writing lays out no name of Scene 5 while it is dark behind the sheet,
    // and the wind has turned the detail to Scene 5, taking the field the caret
    // was in with it. So the caret is on the first frame of the band the sheet was
    // wound to — laid out, named by the Scene, and the frame the detail is now
    // showing. Not the rail, and not `<body>`: a blur with no landing after it is a
    // caret left nowhere, and the next `Tab` starting over from the top of the page.
    await expect(sheet.getByRole('button', { name: /^Shot 1 of Scene 5/ })).toBeFocused()
    await expect(page.locator('#shown-heading')).toHaveText(/Shot 1 of Scene 5/)

    // Landed with the scroll held: the wind has just stood the band of Scene 5 at
    // the head of the sheet — the room it keeps above itself and no more — and it
    // is still there once the caret is down.
    const bands = page.locator('.sheet .bands')
    const headOfBand = () => page.evaluate((id) => {
      const scroller = document.querySelector('.sheet .bands')!.getBoundingClientRect()
      const band = document.querySelector<HTMLElement>(`[data-band="${id}"]`)!
      const room = parseFloat(getComputedStyle(band).scrollMarginBlockStart)
      return Math.round(band.getBoundingClientRect().top - scroller.top - room)
    }, scenes[4]!.id)
    await expect.poll(headOfBand).toBe(0)
    await expect.poll(() => bands.evaluate(one => one.scrollTop)).toBeGreaterThan(0)

    // The typing that press ended is written, and the bench said nothing over the
    // frame: it names the Scene it stands in as it takes the focus.
    await expect.poll(async () => (await (await request.get(`/api/stories/${story.id}`)).json() as
      { scenes: { id: string, shots: { description: string | null }[] }[] })
      .scenes.find(scene => scene.id === scenes[0]!.id)?.shots[1]?.description)
      .toBe('A door onto a wet street.')
    await expect(toast(page)).toBeEmpty()
  })

test('writes the name under the caret when that Scene’s own mark is what ends the typing',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, 10)

    await page.goto(`/stories/${story.id}`)
    await live(page)

    // A field of the document writes what was typed in it when it loses the caret,
    // and a mark refuses a press its own focus — so a mark pressed while the Scene
    // it names is the one under the caret takes no caret away and ends nothing. The
    // press gives the field that ending itself, or the Author watches a name they
    // typed stand on the screen, and on the mark, over a Story that never held it.
    //
    // Made at both widths, because what the fold narrows is the drawing and never
    // what a press means.
    for (const [width, height, place, renamed] of [
      [1440, 900, 7, 'The quay at dawn'],
      [390, 844, 3, 'Le café'],
    ] as const) {
      await page.setViewportSize({ width, height })

      // Another Scene's mark first, which is the press that moves the address, and
      // the one that lands the caret in the name it goes to.
      await sceneNode(page, `Scene ${place}`).click()
      const named = page.getByRole('textbox', { name: `Name of Scene ${place}` })
      await expect(named).toBeFocused()

      // Typed over the old name rather than filled: what a field commits on is the
      // caret leaving it after a hand changed the value, and a value set any other
      // way has nothing to commit.
      await named.press('ControlOrMeta+a')
      await named.pressSequentially(renamed)

      // And now that same Scene's own mark, which the typed name has already
      // renamed — the drawing reads the Story the field is writing through.
      await sceneNode(page, renamed).click()

      // The caret stayed where the Author left it: asking for the Scene it is
      // already in winds the document and takes nothing else. And the Story holds
      // the name, read back from the API rather than off the screen that never lost
      // it.
      await expect(page.getByRole('textbox', { name: `Name of ${renamed}` })).toBeFocused()
      await expect.poll(async () => ((await (await request.get(`/api/stories/${story.id}`))
        .json()) as StoryInEditor).scenes.find(scene => scene.id === scenes[place - 1]!.id)?.name)
        .toBe(renamed)

      // Nothing was said out loud over it either: arriving where you already were
      // is not news, and the sentence would land on an Author mid-word.
      await expect(toast(page)).toBeEmpty()
    }
  })

test('scrolls the document to the Scene the address names', async ({ page, request }) => {
  const { story, scenes } = await chained(request, 10)
  const eighth = scenes[7]!

  // The address is a query and stays one: a fragment never reaches the server, and
  // a bench rendered whole is a server's answer — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await page.goto(`/stories/${story.id}?scene=${eighth.id}`)
  await live(page)

  const scroller = page.locator('.document')
  const section = page.locator(`#scene-${eighth.id}`)

  // The document really did wind: the Scene is eight sections down, and the
  // arithmetic cannot say whether anything moved.
  await expect.poll(() => scroller.evaluate(one => one.scrollTop)).toBeGreaterThan(0)

  const showing = (await scroller.boundingBox())!
  const at = (await section.boundingBox())!
  expect(at.y).toBeGreaterThanOrEqual(showing.y)
  expect(at.y).toBeLessThan(showing.y + showing.height)

  // And the Scene it wound to is the one the caret is in, with its mark lit on the
  // rail: one notion of where the Author is, said in both places.
  await expect(section.getByRole('textbox', { name: 'Name of Scene 8' })).toBeVisible()
  await expect(page.locator('.rail .here')).toHaveAttribute('data-scene', eighth.id)
})

test('winds the document back to the Scene the caret is already in', async ({ page, request }) => {
  const { story, scenes } = await chained(request, 10)
  const eighth = scenes[7]!

  // That Scene written down to a length worth winding to: a section of one beat
  // stands whole on the screen wherever its head is put, so a wind to its head and
  // a scroll to the beat under the caret are the same pixel and the claim below
  // would be one nothing could break.
  for (let beats = 0; beats < 8; beats++) {
    expect((await request.post(`/api/scenes/${eighth.id}/shots`)).ok()).toBeTruthy()
  }

  await page.goto(`/stories/${story.id}?scene=${eighth.id}`)
  await live(page)

  const scroller = page.locator('.document')
  await expect.poll(() => scroller.evaluate(one => one.scrollTop)).toBeGreaterThan(0)

  // The caret put in the last beat of that Scene, which is where an Author who has
  // written their way down it and then read back up has left it.
  const beat = page.getByRole('textbox', { name: 'Shot 9 of Scene 8', exact: true })
  await beat.click()

  // The document scrolls under the caret: an Author reads their way back up the
  // Story without leaving the Scene they are writing, and the address does not
  // move because nothing about which Scene that is has changed.
  await scroller.evaluate(one => one.scrollTo({ top: 0, behavior: 'instant' }))
  await expect.poll(() => scroller.evaluate(one => one.scrollTop)).toBe(0)
  await expect(page.locator('.rail .here')).toHaveAttribute('data-scene', eighth.id)

  // So asking for that Scene again is asking to be taken back to it, which is the
  // whole of what *Go to* can still mean there. An act with nothing left to do is
  // one the bar of Commands should not be offering, and the rail offers this one
  // for every Scene of the Story — see
  // `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
  await sceneNode(page, eighth.name).click()

  // Polled to the end of the wind rather than measured at the start of it. The
  // document scrolls smoothly, so a section eight down is still on its way long
  // after the scroller's first pixel has moved, and a box read then is a box
  // nothing will be at.
  await expect.poll(async () => {
    const showing = (await scroller.boundingBox())!
    const at = (await page.locator(`#scene-${eighth.id}`).boundingBox())!

    return at.y >= showing.y && at.y < showing.y + showing.height
  }).toBe(true)

  // And the caret is still in the beat, which is the other half of what the wind
  // is for: an Author who asked to be taken back to the Scene they are writing did
  // not ask to be lifted out of the word they were typing and put in its name. The
  // wind is what the press moves, so it is also the wind that has to survive the
  // caret being put back where it already was.
  await expect(beat).toBeFocused()

  // And the address did not move, because which Scene the caret is in did not.
  await expect(page).toHaveURL(new RegExp(`scene=${eighth.id}$`))
})

/**
 * The roles a name is a *name* in: what a hand or a keyboard operates, the two
 * containers the bench names for a Scene, and an image, whose alt is an accessible
 * name like any other.
 *
 * A heading is left out on purpose and not by oversight: every Scene's section
 * carries the same three — *Flags*, *Shots*, *Exits* — which
 * `docs/adr/0043-a-story-is-written-as-one-document.md` chose over a hundred and
 * twenty named regions, so they repeat by design. So is an option, for the other
 * reason: an option is a value inside one field rather than a control of the
 * bench, and two fields offer the same values by design — every Condition that
 * asks about a Scene offers every Scene of the Story. What is asked of an option is
 * asked field by field instead, by `offeredTwiceOn` below.
 */
const NAMED = [
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio',
  'spinbutton', 'slider', 'group', 'region', 'img',
]

/**
 * Every accessible name on one surface, read out of the browser's own
 * accessibility tree rather than off the template: what is asserted is what a
 * screen reader would announce and what `getByRole` resolves in strict mode, which
 * is the whole point of the property.
 */
async function namesOn(surface: Locator) {
  const tree = await surface.ariaSnapshot()

  return [...tree.matchAll(/^\s*-\s+(\w+)\s+"((?:[^"\\]|\\.)*)"/gm)]
    .filter(([, role]) => NAMED.includes(role!))
    .map(([, role, name]) => `${role} ${name!.replace(/\\(.)/g, '$1')}`)
}

/**
 * The options one field of a surface offers twice: two the Author cannot choose
 * between, because nothing but the words tells them apart. Where a way on leads and
 * which Scene a Condition counts are both chosen by id from a list the bench names,
 * so both are named the way every other control naming a Scene is. The list a way
 * on is named from is a datalist and not a field, and is left alone on purpose:
 * its options are the Author's own names, because a name typed there is the name
 * the Scene is written under.
 */
async function offeredTwiceOn(surface: Locator) {
  return surface.locator('select').evaluateAll(fields => fields.flatMap((field) => {
    const offered = [...field.options].map(option => option.label)

    return [...new Set(offered.filter((name, at) => offered.indexOf(name) !== at))]
      .map(name => `option ${name} in ${field.id}`)
  }))
}

/** The names a surface says twice, which is the whole of what is asserted below. */
async function saidTwiceOn(surface: Locator) {
  const said = await namesOn(surface)

  return [
    ...new Set(said.filter((name, at) => said.indexOf(name) !== at)),
    ...await offeredTwiceOn(surface),
  ].sort()
}

/**
 * A Story built to collide every way at once, written through the API the way an
 * Author's own hands would write it:
 *
 * - two Scenes called *The bar*, which the API allows and which the bench itself
 *   produces — a Scene split twice leaves two called *{name}, continued* — so
 *   every Shot, every Image, every Description and both sections answer to one
 *   pair of facts. Issue #284.
 * - two Exits of one Scene leading to one Scene, twice over: the pair out of the
 *   first *The bar* that no Reading is offered, and the pair out of *La gare* that
 *   every Reading is. The Place is the only thing that tells the rows apart, in the
 *   writing and in the Preview both. Issue #276.
 * - a Scene with a way on to each of the two Scenes called *The bar*, so the two
 *   rows of the reading the Author renumbers are told apart by the name the bench
 *   draws and by nothing else. It is *La gare*, and it is the Scene the Story opens
 *   on: a Reading stands in a Scene at most once, so the Scene whose ways on lead
 *   to both bars cannot be one either bar leads to — see
 *   `docs/adr/0048-a-scene-is-entered-once.md`.
 * - two Shots of one Scene waiting on one dead pair, and two Exits of another
 *   waiting on the same, so the Remarks have two findings apiece to say.
 * - a Shot asking about one of the two Scenes called *The bar*, so the field that
 *   says which Scene is asked about is drawn, and offers both of them.
 * - a fourth Scene nothing arrives at, *Le quai*, with one way on to the first
 *   *The bar*: the field saying where that way on leads offers the Scenes it may
 *   land on and the one it already does, which are both Scenes called *The bar*.
 *   Out of the two bars the same field offers nothing at all, because everything
 *   else in the Story already reaches them.
 *
 * `ticket` is set to *found* and nothing else, so *lost* is a value no Scene ever
 * sets: the Conditions written on it are the dead ones. Every beat of the two
 * Scenes a Reading passes through waits on it, so both Scenes play nothing at all
 * and the ways on are on screen in the Preview without a press — which is what
 * puts the marks that renumber them under the sweep.
 */
async function collides(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story' },
  })).json() as { id: string }

  const scenes = []
  for (const name of ['The bar', 'La gare', 'The bar', 'Le quai']) {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json() as { id: string, name: string }

    const shots = []
    for (let at = 0; at < 2; at++) {
      shots.push(await (await request.post(`/api/scenes/${scene.id}/shots`)).json() as { id: string })
    }
    // An Image on the first beat of each, so the alt, the Description's label and
    // the Remark about an undescribed Image all have two of themselves to be.
    await request.put(`/api/shots/${shots[0]!.id}/image`, { data: ONE_PIXEL })
    scenes.push({ ...scene, shots })
  }
  const [bar, station, other, quay] = scenes

  const lost = [{ flag: 'ticket', is: 'lost' }]
  for (const shot of [...bar!.shots, ...station!.shots]) {
    await request.put(`/api/shots/${shot.id}/conditions`, { data: { conditions: lost } })
  }
  await request.put(`/api/scenes/${station!.id}/flags`, { data: { sets: { ticket: 'found' } } })
  await request.put(`/api/shots/${other!.shots[0]!.id}/conditions`, {
    data: { conditions: [{ scene: bar!.id, entered: true }] },
  })

  /** A way on, phrased where a Reader is meant to be offered it. */
  const way = async (from: string, to: string, says?: string) => {
    const exit = await (await request.post(`/api/scenes/${from}/exits`, {
      data: { toSceneId: to },
    })).json() as { id: string }
    if (says) await request.patch(`/api/exits/${exit.id}`, { data: { text: says } })

    return exit
  }

  // Out of the first *The bar*: two ways on to one Scene that no Reading is ever
  // offered.
  for (let at = 0; at < 2; at++) {
    const dead = await way(bar!.id, other!.id)
    await request.put(`/api/exits/${dead.id}/conditions`, { data: { conditions: lost } })
  }

  // Out of the Scene the reading stops in, which is the one the Story opens on:
  // one to each Scene called *The bar*, and a second to the same one. Phrased,
  // because what a Reader presses is the Author's own words and two ways on saying
  // nothing would read alike to a Reader too — which is the Story's own defect and
  // not the bench's.
  await way(station!.id, bar!.id, 'Follow her out')
  await way(station!.id, other!.id, 'On to the other bar')
  await way(station!.id, other!.id, 'Through the door')
  await way(quay!.id, bar!.id)
  expect((await request.post(`/api/scenes/${station!.id}/opening`)).ok()).toBeTruthy()

  return { story, bar: bar!, station: station!, other: other! }
}

/**
 * No control of the bench answers to a name another control answers to, on a Story
 * that collides every way the product allows — which is the property #268
 * established for a row, and which #276 and #284 close the last holes in.
 *
 * Asserted as the property and not as the three cases: the three were found one at
 * a time by three different readings, and a spec naming the strings each of them
 * fixed would go on passing the day a fourth key leaves a fact out. What is swept
 * is the whole bench — the three readings the middle turns the document over to,
 * the Remarks beside them, which are controls too since pressing one opens the
 * Scene it is about, the bar of Commands, which is the one surface that reads
 * every name the bench is offering side by side and the one an Author reaches a
 * Scene by, and the Story's own edge, where the Cover is named from among every
 * Image the Story carries — a radio apiece, named by the Shot's Place and its
 * Scene, and the one surface no other spec opens.
 *
 * At each of the five widths the layout folds at, because what is offered is not
 * the same set at all five: the bar reads the controls the bench is drawing right
 * now, a fold takes a column of the bench away by hiding it, and the Remarks are
 * open above one fold and asked for below it. And in both languages, because a
 * name is a sentence and two sentences that differ in English can be one in
 * French: half the words a key is written in are only ever read at `/fr`.
 *
 * The reading is stopped in *La gare*, whose ways on lead to both Scenes called
 * *The bar* and twice to one of them: the marks that renumber them are the
 * Preview's own controls, and they are named by the Place of the row and the name
 * the bench draws, exactly as the same marks are in the writing.
 *
 * Measured before it was written, on the same Story: 22 names said twice in the
 * writing, 4 of the Remarks' sentences, 2 on the Contact Sheet, 3 pairs in the
 * Preview and *Go to The bar* twice in the bar of Commands.
 */
for (const spoken of [
  {
    locale: 'en-US',
    at: '',
    sheet: { turn: 'See the Contact Sheet', named: 'Contact Sheet' },
    preview: { turn: 'Read the Story', named: /^Preview/ },
    writing: 'Write the Scene',
    edge: { open: 'Synopsis and Cover', goTo: /^Go to / },
  },
  {
    locale: 'fr-FR',
    at: '/fr',
    sheet: { turn: 'Voir la Planche-contact', named: 'Planche-contact' },
    preview: { turn: 'Lire le Récit', named: /^Aperçu/ },
    writing: 'Écrire la Scène',
    edge: { open: 'Synopsis et Couverture', goTo: /^Aller à / },
  },
]) {
  test.describe(`a bench read in ${spoken.locale}`, () => {
    test.use({ locale: spoken.locale })

    test('says no name twice, in any reading of a Story built to collide, at any width',
      async ({ page, request }) => {
        const { story, station } = await collides(request)

        await page.goto(`${spoken.at}/stories/${story.id}?scene=${station.id}`)
        await live(page)

        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 })

          await expect(page.locator('.writing .scene')).toHaveCount(4)
          expect({ width, twice: await saidTwiceOn(page.locator('.writing')) })
            .toEqual({ width, twice: [] })

          // Fifteen sentences on this Story: a beat nobody wrote and an Image nobody
          // described in each of the four Scenes, the one Scene nothing arrives at,
          // the four beats waiting on a dead pair, and the two ways on waiting on the
          // same. Opened only where the fold left it closed: a `<summary>` toggles,
          // and above the fold the list is already open beside the document.
          const found = page.locator('.found')
          if (!await found.evaluate(one => (one as HTMLDetailsElement).open)) {
            await found.locator('summary').click()
          }
          await expect(found.getByRole('listitem')).toHaveCount(15)
          expect({ width, twice: await saidTwiceOn(found) }).toEqual({ width, twice: [] })

          // The Story's edge, with the Cover's frames opened over the table and
          // closed again so nothing below is pressed through them: four Images
          // on this Story, one on the first beat of each Scene.
          const edge = page.locator('main > header')
          await edge.getByText(spoken.edge.open).click()
          await expect(edge.getByRole('radio')).toHaveCount(4)
          expect({ width, twice: await saidTwiceOn(edge) }).toEqual({ width, twice: [] })
          await edge.getByText(spoken.edge.open).click()

          // The bar of Commands, opened by its key because the control that opens
          // it is itself one of the things a fold moves. Four Scenes, so four
          // ways of going to one.
          const bar = page.locator('dialog.commands')
          await page.keyboard.press('ControlOrMeta+k')
          await expect(bar.getByRole('button', { name: spoken.edge.goTo })).toHaveCount(4)
          expect({ width, twice: await saidTwiceOn(bar) }).toEqual({ width, twice: [] })
          await page.keyboard.press('Escape')
          await expect(bar).toBeHidden()

          await page.getByRole('button', { name: spoken.sheet.turn }).click()
          const sheet = page.getByRole('region', { name: spoken.sheet.named })
          await expect(sheet.locator('.band')).toHaveCount(4)
          expect({ width, twice: await saidTwiceOn(sheet) }).toEqual({ width, twice: [] })

          // The Preview, where the Author renumbers the ways on the Reading is
          // being offered: three rows, two of them leading to one Scene and two of
          // them to a Scene called what another Scene is called.
          await page.getByRole('button', { name: spoken.preview.turn }).click()
          const preview = page.getByRole('region', { name: spoken.preview.named })
          await expect(preview.getByRole('button', { name: 'Through the door' })).toBeVisible()
          expect({ width, twice: await saidTwiceOn(preview) }).toEqual({ width, twice: [] })

          await page.getByRole('button', { name: spoken.writing }).click()
        }
      })
  })
}

test('opens a Story whose address names a Scene that is gone where a Reading would',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, 3)
    const gone = scenes[2]!
    expect((await request.delete(`/api/scenes/${gone.id}`)).ok()).toBeTruthy()

    await page.goto(`/stories/${story.id}?scene=${gone.id}`)
    await live(page)

    // The Opening Scene, which is where a Reading starts. The stale address is not
    // an error and says nothing: the Story opens, and the Author carries on.
    await expect(page.locator('.rail .here')).toHaveAttribute('data-scene', scenes[0]!.id)
    await expect(page.locator('.writing .scene')).toHaveCount(2)
  })

/**
 * A Story of two Scenes both called *The bar*, the first opening on the second,
 * with two beats apiece so that either can be split. The smallest Story on which
 * the name the bench draws and the name the Author typed differ.
 */
async function twoBars(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story' },
  })).json() as { id: string, title: string }
  const bars = await seedScenes(story, ['The bar', 'The bar'])
  await seedExit(bars[0]!.id, bars[1]!.id)
  expect((await request.post(`/api/scenes/${bars[0]!.id}/opening`)).ok()).toBeTruthy()
  for (const bar of bars) {
    expect((await request.post(`/api/scenes/${bar.id}/shots`)).ok()).toBeTruthy()
  }

  return { story, bars }
}

/** What the rail calls one Scene, which is what every control naming it is named by. */
async function railName(page: Page, sceneId: string) {
  const said = await page.locator(`.rail .mark[data-scene="${sceneId}"]`)
    .getAttribute('data-command')

  return said!.replace(/^Go to /, '')
}

/**
 * What the bench says out loud about a Scene it has just written is held against
 * what the rail calls that Scene, on a Story where the two can differ. The sentence
 * is for a reader who cannot see where the caret went, and the rail is the reading
 * every other control is named from — see
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`. It is said
 * once the Story holds the Scene, because the number is drawn off the Story and
 * nothing can number a Scene that is not in it yet (#294).
 */
test('names a Scene it has just split off as the rail names it', async ({ page, request }) => {
  const { story, bars } = await twoBars(request)
  await page.goto(`/stories/${story.id}`)
  await live(page)

  // Each bar in turn, so the second half split off is the second *{name}, continued*
  // and the sentence has a number to get wrong.
  for (const [at, bar] of bars.entries()) {
    await page.getByRole('button', { name: `Split The bar (${at + 1}) before Shot 2` }).click()
    await expect(page.locator('.rail .mark')).toHaveCount(3 + at)

    // The one way on out of the half that was split is the Exit joining the two.
    // What was said is read once the rail has the new half, and read rather than
    // waited for: a sentence said too early stands there for its three seconds
    // and would otherwise be reported as nothing said.
    const [joined] = await readExits(bar.id)
    expect(await toast(page).textContent()).toBe(
      `“${await railName(page, bar.id)}” split: `
      + `what followed is now “${await railName(page, joined!.toSceneId)}”`)
  }
})

test('names the Scene a way on has just written, and the Scene it left, as the rail names them',
  async ({ page, request }) => {
    const { story, bars } = await twoBars(request)
    await page.goto(`/stories/${story.id}`)
    await live(page)

    // The words the bench numbers the first bar by, typed as a name: the Scene
    // written answers to them, so the number walks on past it and both bars are
    // renumbered under the Author's hands — including the one the way on left.
    const adding = page.locator(`#add-way-${bars[1]!.id}`)
    await adding.fill('The bar (1)')
    await adding.press('Enter')
    await expect(page.locator('.rail .mark')).toHaveCount(3)

    const [drawn] = await readExits(bars[1]!.id)
    expect(await toast(page).textContent()).toBe(
      `“${await railName(page, drawn!.toSceneId)}” written, `
      + `and an Exit from ${await railName(page, bars[1]!.id)} to it drawn`)
  })
