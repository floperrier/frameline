import { expect } from '@playwright/test'
import {
  ONE_PIXEL, live, readShots, sceneNode, seedExit, seedScenes, seedStory, test,
} from './author'
import type { Author } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The Contact Sheet: the whole Story seen rather than read — every Shot of every
 * Scene as the Image it carries, in bands, one band a Scene. It is the second of
 * the three readings `docs/adr/0043-a-story-is-written-as-one-document.md` turns
 * the one document over to, and the claims held here are the ones issue #256 made
 * of it: that a Story of fourteen Shots is one window at 1440, that choosing a
 * frame and writing its Description writes the field the writing writes, that the
 * sheet is walked by `Tab` and by the arrows, and that a frame is named for its
 * Scene and its Place rather than for the file behind it.
 *
 * What the sheet is a reading *of* — the order the bands come in — is
 * `tests/unit/graph.spec.ts`, where `inDocumentOrder` is held against the boxes
 * the Graph draws. One walk answers both, so there is nothing to re-prove here.
 */

/**
 * A Story written through the API the way an Author writes one: Scenes in the
 * order given, each with the Shots asked for, joined by the Exits asked for and
 * opening on the first. Written rather than seeded because what the sheet draws
 * is Shots, and a Scene the API makes arrives with none.
 *
 * `ways` names the Exits by the Places of the Scenes they join, and a Story that
 * says nothing about them is chained one to the next — which is the shape every
 * claim here but the convergence is made on.
 */
async function sheetStory(
  request: APIRequestContext,
  shape: [name: string, shots: number][],
  ways?: [from: number, to: number][],
) {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story' },
  })).json() as { id: string }

  const scenes = []
  for (const [name, many] of shape) {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json() as { id: string, name: string }

    const shots = []
    for (let at = 0; at < many; at++) {
      shots.push(await (await request.post(`/api/scenes/${scene.id}/shots`)).json() as { id: string })
    }
    scenes.push({ ...scene, shots })
  }

  const joined = ways ?? scenes.slice(1).map((_, at): [number, number] => [at, at + 1])
  for (const [from, to] of joined) {
    await request.post(`/api/scenes/${scenes[from]!.id}/exits`, {
      data: { toSceneId: scenes[to]!.id },
    })
  }
  await request.post(`/api/scenes/${scenes[0]!.id}/opening`)

  return { story, scenes }
}

/** Turns the middle of the bench onto the Contact Sheet, and waits for it to be there. */
async function seeTheSheet(page: Page) {
  const sheet = page.getByRole('region', { name: 'Contact Sheet' })
  if (!await sheet.isVisible()) {
    await page.getByRole('button', { name: 'See the Contact Sheet' }).click()
  }
  await expect(sheet).toBeVisible()

  return sheet
}

/** Every frame of the sheet, which is one button apiece. */
function frames(page: Page) {
  return page.locator('.sheet .frames button')
}

/**
 * One frame, by the name it answers to. Exact and scoped to the bands, because a
 * Remark says *The Image of Shot 1 of The street has no Description* on the other
 * side of the bench: a name held loosely would reach it too.
 */
function frame(page: Page, name: string) {
  return page.locator('.sheet .frames').getByRole('button', { name, exact: true })
}

/** What each frame answers to, read off the sheet rather than written down here. */
function named(page: Page) {
  return frames(page).locator('.visually-hidden').allTextContents()
}

/**
 * How many presses of a key it takes to put focus on the element with `id`, up to
 * a ceiling. Counted rather than waited for: a `Tab` that arrives eventually
 * arrives on a Story of forty Scenes too, and how many presses it took getting
 * there is the whole of the claim. A walk that has not arrived by the ceiling is
 * the defect, and counting past it says nothing the ceiling does not.
 */
async function pressesTo(page: Page, key: string, id: string, ceiling = 50) {
  for (let presses = 1; presses <= ceiling; presses++) {
    await page.keyboard.press(key)
    if (await page.evaluate(() => document.activeElement?.id) === id) return presses
  }

  return Infinity
}

/** Reads a Story back past the page, to see what a field written on the sheet left behind. */
async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

test('draws a Story of fourteen Shots in one window at 1440', async ({ page, request }) => {
  // Fourteen is the number #256 names, and it is a real Story rather than one
  // Scene of fourteen beats: three bands, so what has to fit is the headings as
  // well as the frames.
  const { story } = await sheetStory(request, [['The street', 5], ['The bar', 5], ['The room', 4]])

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/stories/${story.id}`)
  await live(page)
  await seeTheSheet(page)
  await expect(frames(page)).toHaveCount(14)

  // One window: the bands have nothing to scroll, and neither has the page. Read
  // off the scroller rather than off a bounding box, because what *fits* is the
  // question and a box says only where something starts.
  const scrolls = await page.locator('.sheet .bands').evaluate(bands => ({
    down: bands.scrollHeight > bands.clientHeight,
    sideways: bands.scrollWidth > bands.clientWidth,
  }))
  expect(scrolls).toEqual({ down: false, sideways: false })
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)

  // And nothing is laid over anything: the Shot under the hand is a column beside
  // the bands, not a card on top of them — the defect this layout is written to
  // avoid. See `docs/adr/0043-a-story-is-written-as-one-document.md`.
  const bands = (await page.locator('.sheet .bands').boundingBox())!
  const shown = (await page.locator('.sheet .shown').boundingBox())!
  expect(shown.x).toBeGreaterThanOrEqual(bands.x + bands.width)
})

test('writes a Description on the sheet into the field the writing holds',
  async ({ page, request }) => {
    const { story, scenes } = await sheetStory(request, [['The street', 2]])
    const shot = scenes[0]!.shots[0]!
    await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })

    await page.goto(`/stories/${story.id}`)
    await live(page)
    const sheet = await seeTheSheet(page)

    // The frame is chosen, and the Shot under the hand is the one chosen: this is
    // the reading a Description is written in because it is the reading an Author
    // is looking at the Image in.
    await frames(page).first().click()
    await expect(sheet.getByRole('img', { name: 'The image of Shot 1 of The street' }))
      .toBeVisible()

    const field = sheet.getByLabel('Description of the image of Shot 1')
    await field.fill('A door onto a wet street, opening.')
    await field.blur()

    // The same field the writing writes, through the same request: one Image, one
    // Description, whichever reading the Author wrote it in.
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.shots[0]!.description)
      .toBe('A door onto a wet street, opening.')

    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await expect(page.getByRole('group', { name: 'Writing The street' })
      .getByLabel('Description of the image of Shot 1'))
      .toHaveValue('A door onto a wet street, opening.')

    // And a Shot with no Image has nothing to describe, so the sheet asks nothing
    // of the Author there — the same rule the beat's own row keeps.
    await seeTheSheet(page)
    await frames(page).nth(1).click()
    await expect(sheet.getByLabel('Description of the image of Shot')).toBeHidden()
  })

test('walks the sheet by Tab and by the arrows, naming a frame by its Scene and its Place',
  async ({ page, request }) => {
    // Four bands, and every band but the last carries a mark out of it. Those marks
    // stand in a band's header, ahead of that band's frames, so a sheet that left
    // them all tabbable puts one of them between the chosen frame and the field
    // beside it for every Exit of the rest of the Story — which is the whole of
    // what the roving tabindex is here to prevent, and which a Story of two bands
    // whose second has no Exit cannot show.
    const { story, scenes } = await sheetStory(
      request, [['The street', 3], ['The bar', 3], ['The alley', 2], ['The room', 2]])
    // An Image apiece, so that every frame answers to the Scene and the Place
    // alone: a Shot carrying none says so in its name as well, which is the claim
    // the spec under this one is for.
    for (const scene of scenes) {
      for (const shot of scene.shots) {
        await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
      }
    }

    await page.goto(`/stories/${story.id}`)
    await live(page)
    const sheet = await seeTheSheet(page)

    // One tab stop for the frames of the whole sheet, which is what makes the
    // reading usable at the size it is for: a Story of forty Scenes is some
    // hundreds of frames, and a `Tab` that walked every one of them would put the
    // Description field of the frame just chosen hundreds of presses away. `Tab`
    // reaches the chosen frame and leaves it for that field; the arrows walk the
    // frames. The marks in a band's header rove with them, so a band that is not
    // the one under the hand adds nothing to the walk either.
    await expect(page.locator('.sheet .frames button[tabindex="0"]')).toHaveCount(1)

    const first = frame(page, 'Shot 1 of The street')
    await first.focus()
    // Counted rather than taken on trust: three bands of marks lie between this
    // frame and the field in the source, and *one press* is the claim — an
    // assertion that focus arrives in the end would hold at forty presses too.
    const describing = `sheet-description-${scenes[0]!.shots[0]!.id}`
    expect(await pressesTo(page, 'Tab', describing)).toBe(1)
    await page.keyboard.press('Shift+Tab')
    await expect(first).toBeFocused()

    // Left and right run the Shots of the Story in the order they are drawn,
    // straight across the seam between one band and the next: the arrows walk the
    // Story rather than the grid, which wraps at whatever the width allows.
    await page.keyboard.press('ArrowRight')
    await expect(frame(page, 'Shot 2 of The street')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(frame(page, 'Shot 1 of The bar')).toBeFocused()

    // Up and down walk band to band at the same Place — what the third beat of the
    // next Scene looks like, which is the question a sheet is read with.
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowUp')
    await expect(frame(page, 'Shot 2 of The street')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(frame(page, 'Shot 2 of The bar')).toBeFocused()

    // And the frame reached by the arrows is the Shot under the hand: focus is the
    // whole of the act, so a frame chosen by a press, by `Tab` or by an arrow is
    // chosen the same way.
    await expect(sheet.getByRole('heading', { name: 'Shot 2 of The bar' })).toBeVisible()
  })

test('names every frame of a Story that converges once, and the Shots of one Scene apart',
  async ({ page, request }) => {
    // A Story that converges — two ways out of the opening, both landing on one
    // Scene — and two Shots alike in the first, carrying the same bytes and the
    // same words. Nothing here distinguishes one frame from another except the
    // Scene it is in and the Place it stands at, which is what the name is made of.
    const { story, scenes } = await sheetStory(
      request,
      [['The street', 2], ['The bar', 1], ['The alley', 1], ['The room', 1]],
      [[0, 1], [0, 2], [1, 3], [2, 3]],
    )
    for (const shot of scenes[0]!.shots) {
      await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })
      await request.patch(`/api/shots/${shot.id}`, {
        data: { text: 'A door opens.', description: 'A door.' },
      })
    }

    await page.goto(`/stories/${story.id}`)
    await live(page)
    await seeTheSheet(page)

    // Collapsed, because a name is written across lines in the template and what
    // an assistive technology hears is the words rather than the whitespace
    // between them.
    const names = (await named(page)).map(name => name.replace(/\s+/g, ' ').trim())
    expect(names).toHaveLength(5)
    expect([...new Set(names)]).toHaveLength(names.length)

    // The marks that go where an Exit lands are the other place a name repeats: a
    // Story that converges offers the same Scene out of two bands, so what each
    // mark answers to is the Exit it is read off and not the Scene alone.
    const ways = await page.locator('.sheet .way').evaluateAll(
      marks => marks.map(mark => mark.getAttribute('aria-label')))
    expect(ways).toContain('Go to The room, by the Exit 1 out of The bar')
    expect(ways).toContain('Go to The room, by the Exit 1 out of The alley')
    expect([...new Set(ways)]).toHaveLength(ways.length)
  })

test('draws a Shot with no Image as a Shot with no Image, so the holes are countable',
  async ({ page, request }) => {
    const { story, scenes } = await sheetStory(request, [['The street', 3], ['The bar', 2]])
    await request.put(`/api/shots/${scenes[0]!.shots[0]!.id}/image`, { data: ONE_PIXEL })
    await request.put(`/api/shots/${scenes[1]!.shots[1]!.id}/image`, { data: ONE_PIXEL })

    await page.goto(`/stories/${story.id}`)
    await live(page)
    await seeTheSheet(page)

    // Two of five carry an Image, and the other three are drawn as what they are
    // rather than as an empty box — which is the whole of what this reading is
    // good at: how much of the work is still a grey rectangle.
    await expect(frames(page)).toHaveCount(5)
    await expect(page.locator('.sheet .frames img')).toHaveCount(2)
    await expect(page.locator('.sheet .frames button.bare')).toHaveCount(3)

    // And said in words as well as drawn, because the question the sheet answers
    // is not one only an eye may ask.
    await expect(frame(page, 'Shot 2 of The street — no Image yet')).toBeVisible()
  })

test('follows the caret, and moves it by a band\'s own marks', async ({ page, request }) => {
  const { story, scenes } = await sheetStory(request, [['The street', 1], ['The bar', 1]])

  await page.goto(`/stories/${story.id}`)
  await live(page)
  const sheet = await seeTheSheet(page)
  await expect(sheet.getByRole('heading', { name: 'Shot 1 of The street' })).toBeVisible()

  // A mark on a band is where its Exit lands, and pressing it moves the caret —
  // the same act the rail's own press is, so the two cannot disagree about where
  // a Scene is. The reading stays where it was: the Author is looking on, not
  // asking to write.
  await sheet.getByRole('button', { name: 'Go to The bar, by the Exit 1 out of The street' })
    .click()
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[1]!.id}`))
  await expect(sheet).toBeVisible()

  // And the sheet follows it: the Shot under the hand is the first of the Scene
  // the caret is now in, so the detail and the rail are saying one thing about
  // where the Author is.
  await expect(sheet.getByRole('heading', { name: 'Shot 1 of The bar' })).toBeVisible()
  await expect(sceneNode(page, 'The bar')).toHaveClass(/\bhere\b/)

  // The rail moves it back, from outside the reading, and the sheet follows that
  // too — a marker keyed to the page rather than to the act is what would not.
  await sceneNode(page, 'The street').click()
  await expect(sheet.getByRole('heading', { name: 'Shot 1 of The street' })).toBeVisible()
})

test('winds to the Scene the caret is already in, from the rail and from the bar',
  async ({ page, request }) => {
    // Twelve bands of three: enough that the sheet has something to scroll, which
    // is the whole of what asking for the Scene the caret is already in means.
    // The address does not move on that press, so a reading that does not wind
    // itself does nothing at all — and the bench is not the document: the writing
    // is `display: none` behind this reading, and `scrollIntoView` on a box that is
    // not laid out moves nothing.
    const { story } = await sheetStory(
      request, Array.from({ length: 12 }, (_, at): [string, number] => [`Scene ${at + 1}`, 3]))

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}`)
    await live(page)
    await seeTheSheet(page)

    const bands = page.locator('.sheet .bands')
    const wound = () => bands.evaluate(scroller => scroller.scrollTop)
    const toTheFoot = () => bands.evaluate(
      scroller => scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' }))

    // The caret is in the Scene the Story opens on, and the sheet is read to the
    // foot of the Story.
    await toTheFoot()
    expect(await wound()).toBeGreaterThan(0)

    // A frame chosen far down the Story, so that what the sheet says about where
    // the Author is has somewhere wrong to stay.
    await bands.getByRole('button', { name: 'Shot 2 of Scene 7' }).click()
    await expect(page.locator('#shown-heading')).toHaveText(/Shot 2 of Scene 7/)

    // The rail's own mark for that same Scene: the Author has read their way down
    // and asked to be taken back to what they are writing.
    await sceneNode(page, 'Scene 1').click()
    await expect.poll(wound).toBe(0)

    // The bands are not the whole of the sheet. The detail, the one tab stop among
    // the frames and the marks in the tab order all answer to the same address, or
    // the first `Tab` takes the frame that is off screen and the browser undoes the
    // wind on the way to it.
    await expect(page.locator('#shown-heading')).toHaveText(/Shot 1 of Scene 1/)
    await expect(page.locator('.sheet .print[tabindex="0"]'))
      .toHaveAccessibleName(/Shot 1 of Scene 1/)
    await expect.poll(wound).toBe(0)

    // And the bar of Commands, which is the same act named rather than pressed.
    await toTheFoot()
    expect(await wound()).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Commands' }).click()
    await page.getByRole('textbox', { name: 'Type a name' }).fill('Go to Scene 1')
    await page.locator('dialog.commands li button').first().click()
    await expect.poll(wound).toBe(0)
  })

test('says what the Preview was drowning out, because the sheet is not saying it',
  async ({ page, request }) => {
    // A Scene nothing arrives at and nothing is written in: two Remarks, and the
    // Preview says one of them in the Scene's own words while it is the reading on
    // screen. The Contact Sheet says neither, so the nearer voice is the bench's
    // again — `docs/adr/0032-the-bench-reads-the-story-back.md`, whose rule `0043`
    // generalises from one Scene to every reading.
    // Two Scenes and no Exit: the first written is the one the Story opens on, so
    // the second is the Scene nothing arrives at.
    const { story, scenes } = await sheetStory(
      request, [['The arrival', 1], ['The platform', 0]], [])
    const platform = scenes[1]!

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}?scene=${platform.id}`)
    await live(page)
    await seeTheSheet(page)

    const found = page.locator('.found')
    await expect(found).toContainText('No Exit arrives at The platform')
    await expect(found).toContainText('The platform holds no Shot')

    // And in the bench's own words rather than the reading's: the sheet says
    // nothing about where a Reading gets to, so there is no nearer voice to yield
    // to and nothing on this surface is saying it twice.
    await expect(page.getByText('Nothing leads to The platform yet')).toBeHidden()
  })

/**
 * How many controls the sheet hands the screen, in the words `0043` counts them
 * in: a control whose box intersects the viewport and which is not `display:
 * none`, `visibility: hidden` or zero-sized. Its own copy rather than a shared
 * one, because what is asked here is narrower than the bench's total — the claim
 * is about one reading, whose bands are a scroller of their own.
 */
function controlsOnScreen(page: Page, within: string) {
  return page.evaluate((where) => {
    const controls = document.querySelector(where)!.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')

    return [...controls].filter((control) => {
      const drawn = getComputedStyle(control)
      if (drawn.display === 'none' || drawn.visibility === 'hidden') return false

      const box = control.getBoundingClientRect()
      if (!box.width || !box.height) return false

      return box.right > 0 && box.bottom > 0
        && box.left < window.innerWidth && box.top < window.innerHeight
    }).length
  }, within)
}

/** How many of a Story's frames the browser actually went and fetched. */
function fetched(page: Page) {
  return page.evaluate(() => performance.getEntriesByType('resource')
    .filter(asked => asked.name.includes('/image')).length)
}

/**
 * A Story of `scenes` Scenes chained into a ring, one Shot apiece, with an Image
 * on the first `images` of them. Seeded past the API because what is under test
 * is the drawing of a long Story rather than the writing of one; the Images go
 * through it, because the bytes are read at that boundary.
 */
async function seeded(
  request: APIRequestContext, author: Author, scenes: number, images: number,
) {
  const story = await seedStory(author, 'A Story')
  const written = await seedScenes(story,
    Array.from({ length: scenes }, (_, at) => `Scene ${at + 1}`))

  for (const [at, scene] of written.entries()) {
    await seedExit(scene.id, written[(at + 1) % scenes]!.id)
  }
  await request.post(`/api/scenes/${written[0]!.id}/opening`)

  // Together rather than one after the other: forty Images are forty round trips
  // to the database and back, and in a row they are what puts the test that draws
  // them at the edge of its budget on a loaded runner.
  await Promise.all(written.slice(0, images).map(async scene => {
    const [shot] = await readShots(scene.id)
    await request.put(`/api/shots/${shot!.id}/image`, { data: ONE_PIXEL })
  }))

  return story
}

test('draws a Story of forty Scenes whole without handing the screen more of it',
  async ({ page, request, author }, testInfo) => {
    // The heaviest thing this product renders: every Shot of a long Story as the
    // Image it carries. What holds the count down is the window — a control is
    // counted where its box meets the viewport, and the bands are as tall as the
    // Story however many Scenes are in it. Ten Scenes and forty, the same shape
    // apiece, so the first ten bands of either are the same pixels and the
    // difference between the two numbers is the Story and nothing else.
    const many = await seeded(request, author, 40, 40)
    const few = await seeded(request, author, 10, 10)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${few.id}`)
    await live(page)
    await seeTheSheet(page)
    await expect(frames(page)).toHaveCount(10)
    const onTen = await controlsOnScreen(page, '.sheet')

    await page.goto(`/stories/${many.id}`)
    await live(page)

    // What the page asks the server for between the press of the turn and the
    // fortieth frame being drawn, which is the property the stopwatch here was
    // standing in for: the Story is already in hand, so the turn is a render and
    // not a fetch. Images are out of the count on purpose — what the browser has
    // already gone and got for the writing's thumbnails is a claim about the
    // writing, and this is the sheet's spec.
    const asked: string[] = []
    page.on('request', ask => asked.push(ask.url()))

    const drawing = Date.now()
    await seeTheSheet(page)
    await expect(frames(page)).toHaveCount(40)
    const drawn = Date.now() - drawing
    const onForty = await controlsOnScreen(page, '.sheet')

    await testInfo.attach('the Contact Sheet at 1440', {
      contentType: 'text/plain',
      body: `ten Scenes: ${onTen} controls on screen; `
        + `forty Scenes: ${onForty} controls on screen, `
        + `forty frames drawn in ${drawn}ms over ${await fetched(page)} image requests`,
    })

    // Thirty more Scenes and not one more control on screen: both Stories fill the
    // window, so what is drawn is what fits it. Equality and not a ceiling, which
    // is the shape `0043`'s own claim is held in — see
    // `tests/e2e/bench-signed-in.spec.ts`, where the same number is taken of the
    // writing.
    expect(onTen).toBeGreaterThan(0)
    expect(onForty).toBe(onTen)

    // And the heaviest reading in the product is drawn out of the Story the page is
    // already holding: not one request left the browser for it. The wall clock this
    // replaces bounded how loaded the machine was rather than anything about the
    // sheet, and a run under load reddened it with nothing having changed.
    expect(asked.filter(url => url.includes('/api/') && !url.endsWith('/image'))).toEqual([])

    // Forty frames off forty addresses, each the Shot's own image asked for plainly:
    // a long Story costs the network the Shots it holds and never a second address
    // for one of them. Read off the frames rather than counted out of the browser's
    // resource log, which counts what the writing fetched eagerly and would redden
    // the day the writing stops.
    const addresses = await page.locator('.sheet .frames img').evaluateAll(
      images => images.map(image => image.getAttribute('src')))
    expect(addresses).toHaveLength(40)
    expect([...new Set(addresses)]).toHaveLength(40)

    // Nor does it run off the side of the page, at the width the bands have a
    // column beside them or at the width they do not.
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(page.locator('.sheet')).toBeVisible()
      expect(await page.evaluate(() => ({
        root: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        body: document.body.scrollWidth > document.body.clientWidth,
      }))).toEqual({ root: false, body: false })
    }
  })

test('hands the window nothing to scroll on a Story whose Remarks run past the fold',
  async ({ page, request, author }) => {
    // The bench is a window tall by construction, and on a Story of forty Scenes
    // with an Image on every Shot the window scrolled anyway: 2390 pixels at
    // 1440 × 900 — #285. What handed it the room was the Remarks: one visually
    // hidden span per Remark, positioned against the viewport because nothing
    // nearer was positioned, laid down the page at the rows the list scrolls them
    // to, 79 pixels a row from 206 down. Twelve Images is twelve *has no
    // Description* Remarks and a twelfth row at 1075, past the fold with room to
    // spare — the smallest Story that crossed it, rather than the forty the
    // defect was read on. One width, because it is the one the Remarks stand open
    // beside the document at: folded to the head of the document they are closed,
    // and a closed list lays nothing down.
    const story = await seeded(request, author, 12, 12)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}`)
    await live(page)
    await expect(page.locator('.writing')).toBeVisible()
    await page.waitForLoadState('networkidle')
    // The cause first, in the form that is true at any count, any row height and
    // any width: every one of those spans is laid out against the list and not
    // against the page. `offsetParent` is the nearest positioned ancestor, and
    // `body` there is the viewport. The page total alone is two rows of margin
    // from going green on a broken build — nine Remarks, or rows a fifth shorter,
    // and the twelfth span stops reaching the fold.
    expect(await page.locator('.found .visually-hidden').evaluateAll(spans =>
      spans.map(span => (span as HTMLElement).offsetParent?.tagName))).toEqual(Array(12).fill('UL'))

    // Then the symptom, which is what an Author would notice and what #285 is
    // written in terms of.
    expect(await scrollsDown(page)).toEqual({ root: 0, body: 0 })

    await seeTheSheet(page)
    await expect(frames(page)).toHaveCount(12)
    expect(await scrollsDown(page)).toEqual({ root: 0, body: 0 })
  })

/**
 * How far the page itself could scroll, on the document element and on the body
 * both — the same two the sideways claim asks, because which of them the overflow
 * escapes to depends on what handed it out.
 */
function scrollsDown(page: Page) {
  return page.evaluate(() => ({
    root: Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight),
    body: Math.max(0, document.body.scrollHeight - document.body.clientHeight),
  }))
}

test('lays the hidden span of the Shot under the hand out inside the pane that scrolls it',
  async ({ page, request }) => {
    // The last scroller on the bench a `.visually-hidden` span escaped from — #293,
    // found by the measurement that found the Remarks. The pane the Shot under the
    // hand is drawn in is `overflow-y: auto`, and the span in its Description's
    // label was positioned against the viewport because nothing nearer was
    // positioned: its lowest edge stood at 361 on a Story of forty Scenes at
    // 1440 × 900. That is above the fold, which is why it cost the window nothing
    // yet, and why a page total would stay green with the cause still there. So
    // the claim is the cause, in the form #285 holds the Remarks in: every hidden
    // span of the pane has the pane for `offsetParent`. One Shot with an Image is
    // the smallest Story that draws the pane with the field in it.
    const { story, scenes } = await sheetStory(request, [['The street', 1]])
    await request.put(`/api/shots/${scenes[0]!.shots[0]!.id}/image`, { data: ONE_PIXEL })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}`)
    await live(page)
    await seeTheSheet(page)
    await expect(page.locator('.sheet .shown input')).toBeVisible()

    expect(await page.locator('.sheet .shown .visually-hidden').evaluateAll(spans =>
      spans.map(span => (span as HTMLElement).offsetParent?.className))).toEqual(['shown'])
  })
