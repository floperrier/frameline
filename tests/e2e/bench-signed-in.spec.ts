import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { live, sceneNode, seedExit, seedScenes, test } from './author'

/**
 * The bench as one document: the rail, the writing and what the bench says beside
 * them — three regions that never trade width, at every width — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 *
 * That record names the claims it stands on and asks for them to be measured
 * rather than asserted, and this is where they are measured. Everything the
 * document is *made of* — that a Scene reads in the order the Graph draws it, that
 * an Exit names where it leads, that a Remark opens the Scene it is about — is
 * held in the specs those things belong to. What is here is the layout's own
 * promises, and there are six of them: that nothing runs off the side of the page
 * at any of five widths, that the count of controls on screen does not grow with
 * the Story, that a row not under the hand carries its marks at the weight of the
 * words around them and every one of them is still a tab stop where it stands,
 * that the bar of Commands grows with the Story in *Go to* and in nothing else,
 * that no tab order runs through the drawing, and that the address still names a
 * Scene and the document is scrolled to it.
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

  expect(rail.width).toBe(120)
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
  await expect(page.locator('.found summary')).toContainText('0')
  expect((await page.locator('.rail').boundingBox())!.width).toBe(120)

  // The second: the rail narrows to a strip of dots and the document keeps the
  // window. Nothing is covered and nothing is taken away — every Scene still has
  // its mark, and the line that opens the Remarks is still there to be pressed.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await page.locator('.rail').boundingBox())!.width)
    .toBeLessThan(48)
  await expect(page.locator('.rail .mark')).toHaveCount(10)
  await expect(page.locator('.found summary')).toBeVisible()
  await expect(page.locator('.writing')).toBeVisible()

  // And pressing it says what the bench found, at the width the record folds them
  // at: the fold took their width and never their voice — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await page.locator('.found summary').click()
  await expect(page.locator('.found')).toContainText('Nothing to report')

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
    await page.mouse.move(0, 0)
    await beat.locator('textarea').focus()

    for (const named of [
      'Add a Condition to Shot 2 of Scene 1',
      'Split Scene 1 before Shot 2',
      'Move Earlier Shot 2 of Scene 1',
      'Move Later Shot 2 of Scene 1',
      'Delete Shot 2 of Scene 1',
    ]) {
      await page.keyboard.press('Tab')
      await expect(beat.getByRole('button', { name: named })).toBeFocused()
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

  await page.goto(`/stories/${story.id}?scene=${eighth.id}`)
  await live(page)

  const scroller = page.locator('.document')
  await expect.poll(() => scroller.evaluate(one => one.scrollTop)).toBeGreaterThan(0)

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

  // And the address did not move, because which Scene the caret is in did not.
  await expect(page).toHaveURL(new RegExp(`scene=${eighth.id}$`))
})

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
