import { expect } from '@playwright/test'
import { live, seedPublished, test, writeStory } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The Cut read where it is obeyed: a Scene whose run is cut after a time plays
 * itself, the press always cuts ahead of the clock, and the Reader is given a way
 * to stop it — which is what WCAG 2.2.2 asks for the moment anything advances on
 * its own, and what nothing is given where nothing does. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 *
 * Read through the Reader's own door, on a Story published past the API: the
 * Reading is one component behind both doors, so what is proved here is proved of
 * an Author's Preview as well.
 *
 * The times are short on purpose — half a second held, three seconds waited out —
 * because the one thing a hold cannot be asserted without is time actually
 * passing.
 */
async function opened(
  page: Page,
  request: APIRequestContext,
  write: (scenes: StoryInEditor['scenes']) => Promise<void>,
) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`))
    .json() as StoryInEditor

  await write(scenes)
  await seedPublished(story)
  await page.goto(`/read/${story.id}`)
  // The clock is started by the component that holds the Path, so a page that has
  // loaded and not yet been attached to is a page nothing is holding a beat on.
  await live(page)
}

test('the clock makes the cut the press would have made, and the press cuts ahead of it',
  async ({ page, request }) => {
    await opened(page, request, async (scenes) => {
      // The Scene holds each Shot of its run for half a second, and its second
      // Shot answers for itself with a time no spec would wait out: what puts the
      // ways on on screen there can only be the press.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 500 } })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, {
        data: { cutAfter: 30_000 },
      })
    })

    // Nothing is pressed between here and the next beat.
    await expect(page.getByText('A door opens.')).toBeVisible()
    await expect(page.getByText('She steps out.')).toBeVisible()

    // A Path arrived at by waiting is the Path a hand would have arrived at, down
    // to where the Reader is put: the beat takes the focus the press would have
    // handed it, so a Story that plays itself is not one a screen reader loses.
    await expect(page.locator(':focus')).toContainText('She steps out.')

    // And the press always cuts early: the ways on arrive at once rather than in
    // the thirty seconds the Shot on screen asked to stand for.
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  })

test('the Reader stops the clock, and stepping back stops it for them',
  async ({ page, request }) => {
    await opened(page, request, async (scenes) => {
      // Two seconds: long enough that the control is pressed well inside the hold,
      // short enough that waiting one out twice is not a slow spec.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 2000 } })
    })

    const run = page.getByRole('button', { name: 'Run the Reading' })
    const held = page.getByText('A door opens.')

    await expect(held).toBeVisible()
    await page.getByRole('button', { name: 'Pause the Reading' }).click()

    // Well past the time the beat was held for, and the beat is where it was.
    await page.waitForTimeout(3000)
    await expect(held).toBeVisible()

    // The clock is the Reader's to start again, and it holds the beat it is
    // standing on for the whole of its time rather than for what was left of it:
    // nothing recorded how far the hold had got.
    await run.click()
    await expect(page.getByText('She steps out.')).toBeVisible()

    // Somebody who steps back has asked to stop. A Reader carried forward again a
    // few seconds later would have a control that undoes nothing.
    await page.getByRole('button', { name: 'Step Back' }).click()
    await expect(held).toBeVisible()
    await expect(run).toBeVisible()
    await page.waitForTimeout(3000)
    await expect(held).toBeVisible()
  })

test('one beat dissolves into the next, or the passage is made through black',
  async ({ page, request }) => {
    const frames = page.locator('.frame')

    await opened(page, request, async (scenes) => {
      // Three seconds of passage over a beat held for half a second: long enough
      // that two frames on screen at once is a fact a spec can read. The beat
      // arriving waits for the press, so the one passage is the only one — an
      // Author who writes a dissolve longer than the hold under it gets three
      // frames over each other, which is what they asked for and not what is
      // being read here.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, cutOver: 3000 },
      })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    await expect(page.getByText('A door opens.')).toBeVisible()

    // What the passage is made over is carried by the gate, because it is the one
    // thing that outlasts the beat — and a dissolve is both beats over each other
    // for the whole of it.
    await expect(page.locator('.gate')).toHaveAttribute('style', /3000ms/)
    await expect.poll(() => frames.count()).toBe(2)
    await expect(page.getByText('She steps out.')).toBeVisible()
    await expect.poll(() => frames.count()).toBe(1)

    // The other passage an Author can write over the same clock: the beat leaving
    // and the beat arriving take half the duration each, either side of a room
    // with nothing in it.
    await opened(page, request, async (scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, cutOver: 3000, cutThrough: 'black' },
      })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    await expect(page.locator('.frame.through-black-leave-active')).toHaveCount(1)
    await expect(page.getByText('She steps out.')).toBeVisible()
  })

test('a Reader who asked for less motion is given the rhythm without the passage',
  async ({ page, request }) => {
    // Asked of the browser rather than of the run, because `reducedMotion` handed
    // to `test.use` never reaches the context this suite seals its own cookie into.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await opened(page, request, async (scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, cutOver: 3000, cutThrough: 'black' },
      })
      await request.patch(`/api/shots/${scenes[0]!.shots[1]!.id}`, { data: { cutAfter: 0 } })
    })

    // The hold is the rhythm of the work rather than a decoration on it, so the
    // beat still arrives on its own.
    await expect(page.getByText('She steps out.')).toBeVisible()

    // And every passage is gone: the three seconds the Author wrote would still
    // have both beats on screen a second from now, and there is one.
    await expect(page.locator('.frame')).toHaveCount(1, { timeout: 1000 })
  })

test('a Story where nothing moves by itself is given no way to stop it',
  async ({ page, request }) => {
    await opened(page, request, async () => {})

    await expect(page.getByText('A door opens.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause the Reading' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Run the Reading' })).toHaveCount(0)
  })
