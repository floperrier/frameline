import { expect, type Page } from '@playwright/test'
import { live, opened, readTheStory, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Shot's text read where it arrives: after a wait, whole or a word at a time,
 * each part fading up, and leaving before the Image where the Shot says so. The
 * press under the frame shows the rest before it cuts, the clock holds a beat from
 * the text having arrived rather than from the Image landing, and a Reader by ear
 * has every word as the Shot lands. See issue #358 and
 * `docs/adr/0051-a-text-arrives-in-its-own-time.md`.
 *
 * Read through the Reader's own door, on a Story published past the API, for the
 * reason `cut-played.spec.ts` gives: the Reading is one component behind both
 * doors. `opened` is `./author`'s, and the Story it opens is the default two-Scene
 * one — *A door opens.* and *She steps out.*, then *Follow her out*.
 *
 * Two kinds of time, kept apart as `cut-played.spec.ts` keeps them. The arrival is
 * CSS, painted by the browser on a schedule of its own, so it is read in real time
 * and a fake clock would freeze nothing of it. The hold is a timer, so it is wound
 * on `page.clock` — which is what lets a minute of it go by during an arrival of
 * five seconds and prove that nothing moved.
 *
 * Real time is the one thing a slow runner has less of, so every arrival here is
 * written long enough that the assertion made during it cannot be met by the
 * arrival finishing on its own: a test that raced its own text would pass for the
 * wrong reason on a fast machine and fail on a slow one.
 *
 * A text cut into parts is in the page twice — the parts, hidden from the
 * accessibility tree, and an unsplit copy for whoever reads it by ear — so its
 * words are read through the frame and never through `getByText`, which would find
 * both.
 */

/** The frame on screen, whose accessible name is the whole of the beat's text. */
function frame(page: Page) {
  return page.getByRole('figure')
}

/** The caption the text is drawn in, which is what fades up and what leaves. */
function caption(page: Page) {
  return page.locator('.frame figcaption')
}

/**
 * What every part of the text on screen is painted at, the caption first. Read
 * once, the moment after whatever was pressed has been drawn, and never waited
 * for: a part that reached one by arriving on its own would pass a retried read,
 * and what is being read is whether the press put it there.
 */
function painted(page: Page) {
  return page.locator('.frame figcaption, .frame .unit').evaluateAll(async (parts) => {
    await new Promise(resolve => setTimeout(resolve))

    return parts.map(part => getComputedStyle(part).opacity)
  })
}

test('a text waits for its time, and is read by ear from the landing',
  async ({ page, request }) => {
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { textAfter: 10_000 } })
    })

    // The Image alone on screen for ten seconds, and nothing moved to make room
    // for what is coming: the caption is there at nought, holding its place.
    await expect(caption(page)).toHaveCSS('opacity', '0')

    // And every word already said to whoever reads by ear: opacity takes nothing
    // out of the accessibility tree, so a Reader by ear is never kept waiting on a
    // staging written for the eye.
    await expect(frame(page)).toHaveAccessibleName('A door opens.')

    // The press is named for what it would do now, which is not to cut: a Reader
    // by ear already has the text, and a press named *Next Shot* that did not move
    // would seem to them a press that is broken.
    await expect(page.getByRole('button', { name: 'Show the Whole Text' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next Shot' })).toHaveCount(0)

    // A wait short enough to watch run out, and the name follows the text in.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { textAfter: 300 } })
    })

    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()
    await expect(caption(page)).toHaveCSS('opacity', '1')
  })

test('an arrival over before the page is live still lets the clock cut',
  async ({ page, request }) => {
    // The server draws the beat, and the browser starts the arrival as it paints
    // that page: on a slow line the scripts that listen for its end come after it
    // has ended. Held back a second and a half here, which is a phone on a train,
    // against an arrival of a quarter of a second — *opens.* at seven characters
    // over thirty a second.
    await page.route('**/_nuxt/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      await route.continue()
    })
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, textBy: 'word', textPace: 30 },
      })
    })

    // A text nobody heard finish is still whole, so the hold arms and the Story
    // plays on rather than waiting for ever on a press for words already there.
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
  })

test('a first press shows the rest of a text coming word by word, and the second cuts',
  async ({ page, request }) => {
    // One character a second: *opens.* is seven seconds in, which no press of this
    // test is late enough to meet.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { textBy: 'word', textPace: 1 },
      })
    })

    // Two units, *door* and *opens.* — the first word arrives with the caption and
    // is not faded twice — drawn with nothing slipped between them: the caption is
    // set `pre-wrap`, so a stray space in the markup would be a space on screen.
    await expect(page.locator('.frame .unit')).toHaveCount(2)
    expect(await page.locator('.frame .shot > [aria-hidden="true"]').textContent())
      .toBe('A door opens.')
    await expect(frame(page)).toHaveAccessibleName('A door opens.')

    // The rest, at once: every part at one in the tick of the press.
    await page.getByRole('button', { name: 'Show the Whole Text' }).click()
    expect(await painted(page)).toEqual(['1', '1', '1'])

    // The Path did not move, so the Reader is left on the press they made — which
    // is now named for the next one.
    const next = page.getByRole('button', { name: 'Next Shot' })
    await expect(next).toBeFocused()

    await next.click()
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
  })

test('a first press shows the whole of a text fading up slowly, and the second cuts',
  async ({ page, request }) => {
    // Three seconds to fade up, the longest a part is allowed: a title over its
    // Image. The press is found by the name it carries only while the text is
    // still coming, so a text that had finished on its own would leave nothing to
    // press, and the read after it is made once.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { textOver: 3000 } })
    })

    await page.getByRole('button', { name: 'Show the Whole Text' }).click()
    expect(await painted(page)).toEqual(['1'])

    const next = page.getByRole('button', { name: 'Next Shot' })
    await expect(next).toBeFocused()

    await next.click()
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
  })

for (const { told, text } of [
  { told: 'a text of many words', text: 'A door opens.' },
  // A text of one word has no unit after the one the caption brings, so the
  // caption is the last part to arrive and the one whose end says the text is
  // whole. A hold that waited on a unit would wait for ever.
  { told: 'a text of one word, whose caption is the last to arrive', text: 'Rain.' },
]) {
  test(`the hold counts from the text having arrived, for ${told}`,
    async ({ page, request }) => {
      await page.clock.install()
      await opened(page, request, async (_, scenes) => {
        await request.patch(`/api/scenes/${scenes[0]!.id}`, {
          data: { cutAfter: 500, textAfter: 5000, textBy: 'word' },
        })
        await request.patch(`/api/shots/${scenes[0]!.shots[0]!.id}`, { data: { text } })
      })

      // A minute of clock during a wait of five seconds, and the beat is where it
      // was: the hold is not armed until the text is whole, so the clock never
      // cuts a text short and never makes the press that shows the rest.
      await page.clock.runFor(60_000)
      await expect(frame(page)).toHaveAccessibleName(text)
      const coming = page.getByRole('button', { name: 'Show the Whole Text' })
      await expect(coming).toBeVisible()

      // In real time, the text arrives — and the hold starts from there.
      const next = page.getByRole('button', { name: 'Next Shot' })
      await expect(next).toBeVisible({ timeout: 10_000 })
      await page.clock.runFor(500)
      await expect(frame(page)).toHaveAccessibleName('She steps out.')
    })
}

test('the pause and the step back show a text whole, and reading again plays it again',
  async ({ page, request }) => {
    // Ten seconds of wait, the longest there is, so nothing here is ever raced by
    // a text arriving on its own.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { textAfter: 10_000 } })
    })

    await expect(caption(page)).toHaveCSS('opacity', '0')

    // A paused Reader reads by hand, and cannot read half a text.
    await page.getByRole('button', { name: 'Pause the Reading' }).click()
    expect(await painted(page)).toEqual(['1'])
    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()

    // Running again, the next beat arrives in its own time.
    await page.getByRole('button', { name: 'Resume the Reading' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
    await expect(caption(page)).toHaveCSS('opacity', '0')

    // A step back is a reread, and pauses the Reading: the beat is there whole.
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(frame(page)).toHaveAccessibleName('A door opens.')
    expect(await painted(page)).toEqual(['1'])
    await expect(page.getByRole('button', { name: 'Next Shot' })).toBeVisible()

    // And reading again from the start is the Story from its start, so its opening
    // text arrives again rather than standing there already.
    await page.getByRole('button', { name: 'Resume the Reading' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
    await page.getByRole('button', { name: 'Read Again from the Start' }).click()
    await expect(frame(page)).toHaveAccessibleName('A door opens.')
    await expect(caption(page)).toHaveCSS('opacity', '0')
    await expect(page.getByRole('button', { name: 'Show the Whole Text' })).toBeVisible()
  })

test('a text that stays for a time leaves the Image alone, and is still read',
  async ({ page, request }) => {
    // The second beat's text stays half a second, and the Scene is held until the
    // press, so what takes the words off is the stay and nothing else.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, {
        data: { textStays: 500 },
      })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
    await expect(caption(page)).toHaveCSS('opacity', '0')

    // Gone from the screen, and not from the accessibility tree: a Reader by ear
    // is never told a beat by halves.
    await expect(frame(page)).toHaveAccessibleName('She steps out.')

    // The run over, the frame held behind the ways on is the frame as it was when
    // the run ended — the Image, alone.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(page.locator('.frame.pushed-back')).toHaveCount(1)
    await expect(caption(page)).toHaveCount(0)

    // Unless the Reader pressed on before the stay ran out, and then the words are
    // still there behind the ways on.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, {
        data: { textStays: 30_000 },
      })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(frame(page)).toHaveAccessibleName('She steps out.')
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(caption(page)).toHaveCount(1)
    await expect(caption(page)).toHaveCSS('opacity', '1')
  })

test('a Reader who asked for less motion is given the cadence without the fade',
  async ({ page, request }) => {
    // Asked of the browser rather than of the run, for the reason
    // `cut-played.spec.ts` gives: `reducedMotion` handed to `test.use` never
    // reaches the context this suite seals its own cookie into.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // One character a second: *door* is two seconds in and *opens.* seven.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { textBy: 'word', textPace: 1, textOver: 400 },
      })
    })
    const landed = Date.now()

    // The four hundred milliseconds each word was to fade over are gone, and the
    // time each word is due at stands: it is when the words come, which is the
    // work's.
    const units = page.locator('.frame .unit')
    const last = units.last()
    expect(await units.evaluateAll(parts =>
      parts.map(part => getComputedStyle(part).animationDuration)))
      .toEqual(['1e-05s', '1e-05s'])
    await expect(last).toHaveCSS('animation-delay', '7s')

    // A tab nobody is looking at stops the arrival where it stood, and looking at
    // it again starts it from there.
    const seen = (visible: boolean) => page.evaluate((visible) => {
      Object.defineProperty(document, 'visibilityState', {
        get: () => (visible ? 'visible' : 'hidden'),
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    }, visible)

    await seen(false)
    await expect(caption(page)).toHaveCSS('animation-play-state', 'paused')
    await expect(last).toHaveCSS('animation-play-state', 'paused')
    await seen(true)
    await expect(caption(page)).toHaveCSS('animation-play-state', 'running')

    // And the last word still arrives at its time, rather than with the first:
    // seven seconds from the paint, which is before `opened` has returned, so what
    // is held here is more than half of it.
    const next = page.getByRole('button', { name: 'Next Shot' })
    await expect(next).toBeVisible({ timeout: 15_000 })
    expect(Date.now() - landed).toBeGreaterThan(3500)
  })

test('a Shot drawn in the place of another is a beat of its own, and arrives as it says',
  async ({ page, request }) => {
    // The street draws its weather from two values and each of its Shots plays
    // under one, so its run is one beat long whichever is drawn, and *Draw Again*
    // on the bench puts the other Shot on screen without the Path moving. Its texts
    // come a word a second after ten seconds of wait, and *She steps out.* says it
    // lands whole with its Image.
    const story = await writeStory(request)
    const { scenes } = await (await request.get(`/api/stories/${story.id}`))
      .json() as StoryInEditor
    const street = scenes[0]!
    const [opens, steps] = street.shots
    await request.put(`/api/scenes/${street.id}/flags`, {
      data: { sets: { weather: ['rain', 'sun'] } },
    })
    await request.patch(`/api/scenes/${street.id}`, {
      data: { textAfter: 10_000, textBy: 'word', textPace: 1 },
    })
    for (const [shot, is] of [[opens!, 'rain'], [steps!, 'sun']] as const) {
      await request.put(`/api/shots/${shot.id}/conditions`, {
        data: { conditions: [{ flag: 'weather', is }] },
      })
    }
    await request.patch(`/api/shots/${steps!.id}`, {
      data: { textAfter: 0, textBy: 'whole', textOver: 0 },
    })

    await page.goto(`/stories/${story.id}?scene=${street.id}`)
    const preview = await readTheStory(page)
    const draw = page.getByRole('region', { name: /On the bench/ })
      .getByRole('button', { name: 'Draw Again' })

    /** The text of the Shot on screen, read off the copy that is never cut up. */
    const played = () => preview.locator('figure .shot')
      .evaluate(shot => (shot.querySelector('.visually-hidden') ?? shot).textContent)

    /** Draws again until the Shot on screen is the one whose text is `text`. */
    async function drawUntil(text: string) {
      await expect.poll(async () => {
        const now = await played()
        if (now !== text) await draw.click()
        return now
      }, { intervals: [50], timeout: 15_000 }).toBe(text)
    }

    await drawUntil('She steps out.')
    await expect(preview.getByRole('button', { name: 'Next Shot' })).toBeVisible()

    // A text landing whole, and then a Shot whose text arrives drawn in its place:
    // it arrives, rather than standing there already as the one before it did.
    await drawUntil('A door opens.')
    const coming = preview.getByRole('button', { name: 'Show the Whole Text' })
    await expect(coming).toBeVisible()
    await expect(preview.locator('figcaption')).toHaveCSS('opacity', '0')

    // And the other way, with that text still ten seconds from arriving: the Shot
    // drawn in its place lands whole, so the one press cuts rather than being
    // spent showing a text that is already there.
    await drawUntil('She steps out.')
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  })

test('a Story whose only movement is its text is given the pause, and one silent is not',
  async ({ page, request }) => {
    // Nothing clocked anywhere: every Shot waits for the press, and the text fades
    // up over a fifth of a second. That is a thing moving by itself, and WCAG
    // 2.2.2 asks for a way to stop it.
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { textOver: 200 } })
    })
    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toBeVisible()

    // A Story that says nothing about its texts is every Story written before
    // this, and it is drawn exactly as it was: no arrival, no pause, and one name
    // on the press.
    await opened(page, request, async () => {})
    await expect(frame(page)).toHaveAccessibleName('A door opens.')
    await expect(caption(page)).not.toHaveClass(/\barriving\b/)
    expect(await caption(page).evaluate(one =>
      one.getAnimations({ subtree: true }).length)).toBe(0)
    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toHaveCount(0)
    await expect(page.locator('.next')).toHaveText('Next Shot')
  })

test('the Contact Sheet draws a text as it is written, and runs no arrival',
  async ({ page, request }) => {
    // Word by word after the longest wait there is, so a sheet that played the
    // arrival would still be playing it long after this has looked.
    const story = await writeStory(request)
    const { scenes } = await (await request.get(`/api/stories/${story.id}`))
      .json() as StoryInEditor
    await request.patch(`/api/scenes/${scenes[0]!.id}`, {
      data: { textAfter: 10_000, textBy: 'word' },
    })

    await page.goto(`/stories/${story.id}`)
    await live(page)
    await page.getByRole('button', { name: 'See the Contact Sheet' }).click()
    const sheet = page.getByRole('region', { name: 'Contact Sheet' })
    await expect(sheet).toBeVisible()

    // Still, as it keeps free of Sound and of the Cut: the sheet is the Story seen
    // rather than read, and the words are there as the Author wrote them.
    await expect(sheet.getByText('A door opens.', { exact: true })).toBeVisible()
    expect(await sheet.evaluate(one => one.getAnimations({ subtree: true }).length))
      .toBe(0)
  })
