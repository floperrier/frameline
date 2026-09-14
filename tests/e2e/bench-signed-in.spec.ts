import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
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
 * promises, and there are four of them: that nothing runs off the side of the page
 * at any of five widths, that the count of controls on screen does not grow with
 * the Story, that no tab order runs through the drawing, and that the address
 * still names a Scene and the document is scrolled to it.
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
 * The Scenes are found by name rather than taken in the order the insert handed
 * back, because `RETURNING` promises no order — see issue #261 — and the Opening
 * Scene is marked through its own route, because a Scene seeded past the API never
 * becomes one.
 */
async function chained(request: APIRequestContext, many: number) {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story' },
  })).json() as { id: string, title: string }

  const names = Array.from({ length: many }, (_, place) => `Scene ${place + 1}`)
  const seeded = await seedScenes(story, names)
  const scenes = names.map(name => seeded.find(scene => scene.name === name)!)

  for (const [place, scene] of scenes.slice(0, -1).entries()) {
    await seedExit(scene.id, scenes[place + 1]!.id)
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

  // The first fold: what the bench says goes to the head of the document, still
  // said in the same voice, with the rail spanning both rows beside them.
  await page.setViewportSize({ width: 900, height: 900 })
  await expect.poll(async () => (await page.locator('aside.said').boundingBox())!.y)
    .toBeLessThan((await page.locator('.document').boundingBox())!.y)
  await expect(page.locator('.found')).toBeVisible()
  expect((await page.locator('.rail').boundingBox())!.width).toBe(120)

  // The second: the rail narrows to a strip of dots and the document keeps the
  // window. Nothing is covered and nothing is taken away — every Scene still has
  // its mark, and the Remarks are still on the screen saying what they found.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await page.locator('.rail').boundingBox())!.width)
    .toBeLessThan(48)
  await expect(page.locator('.rail .mark')).toHaveCount(10)
  await expect(page.locator('.found')).toBeVisible()
  await expect(page.locator('.writing')).toBeVisible()
})

test('offers no more controls on a Story of forty Scenes than on one of three',
  async ({ page, request }) => {
    // The claim the whole record stands on, and the one number it was written
    // against: ninety-two controls, measured on the gate this replaces.
    await page.setViewportSize({ width: 1440, height: 900 })

    const small = await chained(request, 3)
    await page.goto(`/stories/${small.story.id}`)
    await live(page)
    await expect(page.locator('.panel')).toBeVisible()
    const few = await controlsOnScreen(page)
    const inTheDocument = await controlsOnScreen(page, '.writing')
    const written = await controlsOnScreen(page, '.panel')

    const large = await chained(request, 40)
    await page.goto(`/stories/${large.story.id}`)
    await live(page)
    await expect(page.locator('.panel')).toBeVisible()
    await expect(page.locator('.rail .mark')).toHaveCount(40)
    const many = await controlsOnScreen(page)
    const alsoInTheDocument = await controlsOnScreen(page, '.writing')

    // The Story really did grow, and the screen really did not.
    expect(few).toBeGreaterThan(0)
    expect(many).toBeLessThanOrEqual(few)

    // And the document is why, said on its own rather than read out of a total.
    // A total is the page's, and the page holds things that answer to something
    // other than the size of the Story: the Story's own edge is a fixed row, and
    // the Remarks are sentences about what is still to do, which a Story held
    // together at both sizes has none of either way. What the layout promises is
    // narrower and is the whole of the claim — that a Scene added to the document
    // adds no control to the bench — so it is measured where it is made. Every
    // Scene but the one the caret is in is read, and reading takes no controls;
    // the writing surface is the one section that has any, and #252 is where the
    // rest of the document becomes writable in its turn.
    expect(written).toBe(inTheDocument)
    expect(inTheDocument).toBe(alsoInTheDocument)
  })

test('keeps the rail out of the accessibility tree and out of the tab order',
  async ({ page, request }) => {
    const { story } = await chained(request, 10)

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
    await page.getByRole('button', { name: 'Go to Scene 7' }).click()
    await expect(page).toHaveURL(/scene=/)
    await expect(page.getByRole('group', { name: 'Writing Scene 7' })).toBeVisible()
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

  // And the Scene it wound to is the one being written, with its mark lit on the
  // rail: one notion of where the Author is, said in both places.
  await expect(page.getByRole('group', { name: `Writing ${eighth.name}` })).toBeVisible()
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
  await expect(page.getByRole('group', { name: `Writing ${eighth.name}` })).toBeAttached()

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
    await expect(page.getByRole('group', { name: 'Writing Scene 1' })).toBeVisible()
    await expect(page.locator('.writing .scene')).toHaveCount(2)
  })
