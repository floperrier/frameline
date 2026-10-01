import { expect } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { live, opened, test, writeShot, writeStory } from './author'
import { formatted, line, run } from '../../shared/utils/formatted'
import type { Formatted } from '../../shared/utils/formatted'
import type { Arrival, Lasting, StoryInEditor } from '../../shared/utils/scenes'

/**
 * A run of a Shot's words carrying an Effect of its own — issue #361. What is held
 * here is what only a browser can say: that the toolbar writes both of a run's
 * Effects onto the words selected and takes both off the run the caret is in, that
 * the doors refuse in a sentence a run moved past the letter bound or given an
 * Effect it is not offered, and that the Reading moves a run on its letters while
 * a Reader by ear hears the words as written and never a stand-in. A run taken
 * apart still breaks its line only between its words, the Pause stops each of its
 * pieces, and a Reader who asked for less motion sees its words and nothing move.
 * The shape is `tests/unit/formatted.spec.ts`, and the drawing
 * `tests/unit/draw.spec.ts`. See `docs/adr/0051-an-effect-is-said-of-one-beat.md`.
 *
 * Played through the Reader's own door, on a Story published past the API, for the
 * reason `effects-played.spec.ts` gives, and in real time for its reason too: an
 * Effect is a CSS animation `page.clock` does not reach, so each is asked what it
 * is running rather than looked at.
 */

const SCRAMBLED: Arrival = { effect: 'scramble', over: 5000, strength: 'strong' }
const WAVING: Lasting = { effect: 'wave', every: 1600, strength: 'slight' }

async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

/** `writeStory`, open on the bench at its first Scene, and the box of that Scene's first Shot. */
async function writing(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await reread(request, story.id)
  await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
  await live(page)

  return { story, scenes, box: page.locator(`#shot-${scenes[0]!.shots[0]!.id}`) }
}

/** The toolbar of the first Shot of The street, which is there while the caret is in it. */
function toolbar(page: Page) {
  return page.getByRole('toolbar', { name: 'Formatting of Shot 1 of The street' })
}

/**
 * Takes words of the text being written, as a hand dragged across them, and waits
 * for the editor to have read the selection, as `formatted-written.spec.ts` does
 * and for its reasons.
 */
async function select(text: Locator, word: string) {
  await text.evaluate((field, taken) => {
    const walking = document.createTreeWalker(field, NodeFilter.SHOW_TEXT)
    for (let node = walking.nextNode(); node; node = walking.nextNode()) {
      const at = node.textContent!.indexOf(taken)
      if (at >= 0) return getSelection()!.setBaseAndExtent(node, at, node, at + taken.length)
    }
  }, word)
  await expect(toolbar(text.page()).getByRole('button', { name: 'Redact the Selection' }))
    .not.toHaveAttribute('aria-disabled')
}

/** A Story whose first Shot is the text given, published and open in the Reading. */
function reading(page: Page, request: APIRequestContext, text: Formatted) {
  return opened(page, request, async (_, scenes) => {
    const written = await request.patch(`/api/shots/${scenes[0]!.shots[0]!.id}`, { data: { formatted: text } })
    expect(written.status()).toBe(200)
  })
}

/**
 * Every animation under the frame on screen and where it stands, read once each is
 * `ready`, as `effects-played.spec.ts` reads them and for its reason.
 */
function everyEffect(frame: Locator) {
  return frame.locator('[data-effect]').evaluateAll(async (elements) => {
    const animations = elements.flatMap(element => element.getAnimations())
    await Promise.all(animations.map(animation => animation.ready))

    return animations.map(animation => ({
      name: (animation as CSSAnimation).animationName,
      iterations: animation.effect?.getTiming().iterations,
      state: animation.playState,
    }))
  })
}

test('Add an Effect over the words selected writes both marks, and Take the Effect Off takes both off',
  async ({ page, request }) => {
    const { story, box } = await writing(page, request)
    const bar = toolbar(page)
    const written = async () => (await reread(request, story.id)).scenes[0]!.shots[0]!.formatted

    await writeShot(box, 'Nothing here is precious, break it now.')
    await select(box, 'break it')
    const adding = bar.getByRole('button', { name: 'Add an Effect' })
    await expect(adding).toHaveAttribute('aria-expanded', 'false')
    await adding.click()
    await expect(adding).toHaveAttribute('aria-expanded', 'true')

    // Each sentence is named by its own words alone, so found by the whole name.
    await bar.getByRole('combobox', { name: 'As the words arrive', exact: true }).selectOption('scramble')
    await bar.getByRole('combobox', { name: 'While the words are on screen', exact: true }).selectOption('tremor')

    // A field of the row is named by its sentence as well as its own label, and the
    // arrows along the toolbar walk out of a field of seconds as out of a select.
    const seconds = bar.getByRole('spinbutton', { name: 'As the words arrive Seconds' })
    await seconds.focus()
    await seconds.press('ArrowRight')
    await expect(bar.getByRole('combobox', { name: 'As the words arrive Strength' })).toBeFocused()
    await box.blur()

    // Each starts at the time the row offers it from, and *Marked*. Matched rather
    // than equal, because the editor says each attribute it holds.
    await expect.poll(written).toMatchObject(formatted(line('Nothing here is precious, ', run('break it',
      { type: 'arrives', attrs: { effect: 'scramble', over: 1200, strength: 'marked' } },
      { type: 'lasts', attrs: { effect: 'tremor', every: 400, strength: 'marked' } },
    ), ' now.')))

    // On the bench the run is still, and marked under a dotted line.
    await expect(box.locator('.run').first()).toHaveText('break it')
    await expect(box.locator('.run').first()).toHaveCSS('text-decoration-style', 'dotted')

    // The caret put in the run, both come off the whole of it.
    await box.locator('.run').first().click()
    const takingOff = bar.getByRole('button', { name: 'Take the Effect Off' })
    await expect(takingOff).not.toHaveAttribute('aria-disabled')
    await takingOff.click()
    await expect(box.locator('.run')).toHaveCount(0)
    await box.blur()

    await expect.poll(written).toMatchObject(formatted(line('Nothing here is precious, break it now.')))
  })

/**
 * The doors asked directly for what the toolbar never writes, as
 * `formatted-written.spec.ts` asks them, the sentence asserted with the status
 * because the sentence is the refusal:
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
test('a document past the letter bound, or with a wave as it arrives, is refused in a sentence',
  async ({ request }) => {
    const story = await writeStory(request)
    const before = await reread(request, story.id)
    const shot = `/api/shots/${before.scenes[0]!.shots[0]!.id}`

    async function refuses(text: Formatted, said: string) {
      const answer = await request.patch(shot, { data: { formatted: text } })

      expect(answer.status()).toBe(400)
      expect((await answer.json()).message).toBe(said)
    }

    await refuses(formatted(line(run('a'.repeat(301), { type: 'lasts', attrs: WAVING }))),
      'The words a Shot moves letter by letter come to 300 letters at most.')
    // A wave is offered while the words stand and not as they arrive, and a short
    // run keeps the letter bound out of it.
    const waveArriving = { effect: 'wave', over: 1200, strength: 'slight' } as unknown as Arrival
    await refuses(formatted(line(run('A door opens.', { type: 'arrives', attrs: waveArriving }))),
      'An Effect as the Image or the words arrive is one offered for them, lasts a whole number of '
      + 'milliseconds from 100 to 5000, and is slight, marked or strong.')

    // Refused is refused: the Shot holds what it held.
    expect((await reread(request, story.id)).scenes[0]!.shots[0]!.formatted)
      .toEqual(before.scenes[0]!.shots[0]!.formatted)
  })

test('a scrambling run is read whole while its stand-ins are on screen', async ({ page, request }) => {
  await reading(page, request, formatted(line('A door ', run('opens', { type: 'arrives', attrs: SCRAMBLED }), '.')))

  const caption = page.locator('.frame figcaption')
  await expect(caption.locator('.visually-hidden')).toHaveText('A door opens.')

  // The copy that moves is hidden from the accessibility tree, and five seconds
  // over five letters puts a stand-in of the last one on screen for all of them.
  // Asked until one is, since the scramble may not have started at the first ask.
  const moving = caption.locator('[aria-hidden="true"]')
  await expect(moving).toHaveCount(1)
  await expect(moving.locator('.stand-in')).toHaveCount(5 * 3)
  await expect.poll(() => moving.locator('.stand-in').evaluateAll(standIns =>
    standIns.filter(standIn => getComputedStyle(standIn).opacity === '1').length)).toBeGreaterThan(0)

  // And whoever reads by ear has the sentence as written, never a stand-in.
  await expect(page.getByRole('figure')).toHaveAccessibleName('A door opens.')
})

test('a waving run runs one animation per letter, and the Pause stops every one of them',
  async ({ page, request }) => {
    await reading(page, request, formatted(line(run('sea', { type: 'lasts', attrs: WAVING }))))

    const frame = page.locator('.frame')
    const letters = frame.locator('[data-effect="wave"]')
    await expect(letters).toHaveCount(3)
    for (const letter of await letters.all()) {
      expect(await letter.evaluate(drawn => drawn.getAnimations().map(animation => ({
        name: (animation as CSSAnimation).animationName,
        iterations: animation.effect?.getTiming().iterations,
        state: animation.playState,
      })))).toEqual([{ name: expect.stringMatching(/^wave/), iterations: Infinity, state: 'running' }])
    }

    // A run is something that lasts, so the Story is given the Pause, and the
    // Pause reaches each letter of it as it reaches the Shot's own Effects.
    await page.getByRole('button', { name: 'Pause the Reading' }).click()
    expect((await everyEffect(frame)).map(({ state }) => state)).toEqual(['paused', 'paused', 'paused'])
  })

test('a run taken apart breaks its line between its words and never inside one',
  async ({ page, request }) => {
    // Narrow enough that a dozen words cannot stand on one line.
    await page.setViewportSize({ width: 360, height: 740 })
    const text = 'The rain had come down on the street all night and nobody had gone out into it.'
    await reading(page, request, formatted(line(run(text, { type: 'lasts', attrs: WAVING }))))

    // Each word's letters, as the line lays them out. Read by `offsetTop` rather
    // than the box on screen, because the wave moves each letter by a transform,
    // which the box on screen carries and the layout does not.
    const root = page.locator('.frame figcaption [aria-hidden="true"] .apart')
    await expect(root).toHaveCount(1)
    const words = await root.evaluate((drawn) => {
      const laid: number[][] = [[]]
      for (const piece of drawn.querySelectorAll<HTMLElement>('.letter, .gap')) {
        if (piece.classList.contains('gap')) laid.push([])
        else laid.at(-1)!.push(piece.offsetTop)
      }
      return laid
    })

    expect(words).toHaveLength(text.split(' ').length)
    // The run does wrap, rather than standing on one line past the frame's edge…
    expect(new Set(words.flat()).size).toBeGreaterThan(1)
    // …and every word stands on one line.
    for (const [place, tops] of words.entries()) {
      expect([text.split(' ')[place], new Set(tops).size]).toEqual([text.split(' ')[place], 1])
    }
  })

test('a run starting inside a word holds to the rest of it at the end of a line',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    // Every word begins outside its run and ends inside it, so wherever a line
    // ends, it ends on one of them, and only the joiner keeps the word whole.
    const rests = ['lit', 'swept', 'watched', 'named', 'loved', 'opened', 'numbered', 'remembered', 'visited',
      'broken', 'touched', 'spoken']
    await reading(page, request, formatted(line(...rests.flatMap((rest, place) => [place ? ' un' : 'Un',
      run(`${rest}${place < rests.length - 1 ? ',' : '.'}`, { type: 'lasts', attrs: WAVING })]))))

    // The words before each run are no element, so each is read by the box of its
    // last letter, and the run by the box of its first, on the same line when they
    // stand less than half a line apart: the wave moves a letter by a fraction of that.
    const roots = page.locator('.frame figcaption [aria-hidden="true"] .apart')
    await expect(roots).toHaveCount(rests.length)
    const laid = await roots.evaluateAll(drawn => drawn.map((root) => {
      const before = root.previousSibling!
      const last = document.createRange()
      last.setStart(before, before.textContent!.length - 1)
      last.setEnd(before, before.textContent!.length)
      const middleOf = (box: DOMRect) => (box.top + box.bottom) / 2
      const first = root.querySelector<HTMLElement>('.letter')!
      return {
        top: first.offsetTop,
        held: Math.abs(middleOf(last.getBoundingClientRect()) - middleOf(first.getBoundingClientRect()))
          < parseFloat(getComputedStyle(root).lineHeight) / 2,
      }
    }))

    // The words do wrap, and each is on one line where they do.
    expect(new Set(laid.map(({ top }) => top)).size).toBeGreaterThan(1)
    expect(laid.map(({ held }) => held)).toEqual(Array(rests.length).fill(true))
  })

test('under less motion a scrambling run shows its words and nothing in it moves',
  async ({ page, request }) => {
    // Asked of the browser rather than of the run, for the reason
    // `cut-played.spec.ts` gives.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await reading(page, request, formatted(line('A door ', run('opens', { type: 'arrives', attrs: SCRAMBLED }), '.')))

    const frame = page.locator('.frame')
    await expect(frame.locator('figcaption .visually-hidden')).toHaveText('A door opens.')
    await expect(frame.locator('.glyph')).toHaveCount(5)

    // A glyph and its three stand-ins a letter, and not one of them running.
    expect(await frame.locator('[data-effect]').evaluateAll(moving =>
      moving.map(element => element.getAnimations().length))).toEqual(Array(5 * 4).fill(0))
    expect(await frame.locator('.stand-in').evaluateAll(standIns =>
      standIns.map(standIn => getComputedStyle(standIn).opacity))).toEqual(Array(5 * 3).fill('0'))
    expect(await frame.locator('.glyph').evaluateAll(glyphs =>
      glyphs.map(glyph => getComputedStyle(glyph).opacity))).toEqual(Array(5).fill('1'))
  })

test('Duplicate Scene carries a run’s marks', async ({ request }) => {
  const story = await writeStory(request)
  const street = (await reread(request, story.id)).scenes[0]!
  const set = formatted(line('Nothing here is precious, ', run('break it', { type: 'lasts', attrs: WAVING }), ' now.'))
  expect((await request.patch(`/api/shots/${street.shots[0]!.id}`, { data: { formatted: set } })).status()).toBe(200)

  const made = await request.post(`/api/scenes/${street.id}/duplicate`)
  expect(made.status()).toBe(201)
  const { id: copyId } = await made.json() as { id: string }
  const { scenes } = await reread(request, story.id)
  const original = scenes.find(scene => scene.id === street.id)!.shots[0]!
  const copy = scenes.find(scene => scene.id === copyId)!.shots[0]!

  expect(original.formatted).toMatchObject(set)
  expect(copy.formatted).toEqual(original.formatted)
})
