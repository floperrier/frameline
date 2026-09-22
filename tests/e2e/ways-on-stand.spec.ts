import { expect } from '@playwright/test'
import { opened, test } from './author'
import type { APIRequestContext } from '@playwright/test'

/**
 * The other half of the Cut: the ways on may stand for a time of their own,
 * after which the first one still offered is taken — the one the Place puts
 * first, and the one Enter presses from inside the list — and a Scene may give
 * them no time at all, flowing into the next without ever asking. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`. `opened`,
 * shared with `cut-played.spec.ts`, is `./author`'s.
 *
 * Nothing here reads an animation: the first two cases read a value carried on
 * the Path and an attribute rendered from it, not a bar's progress, so both are
 * moved onto `page.clock` — installed before the Story is opened, the way
 * `cut-played.spec.ts` already does for its own pause test, so a stand this
 * short is not a real 500ms window a click has to beat. The third needs no
 * clock at all: a Reader paused before a flowing Scene's last beat never starts
 * one, so what it proves holds the moment the beat arrives.
 */
async function addSecondExit(request: APIRequestContext, story: { id: string }, fromSceneId: string) {
  const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The alley' },
  })).json()
  const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
  await request.patch(`/api/shots/${shot.id}`, { data: { text: 'Nobody comes.', description: '' } })

  const exit = await (await request.post(`/api/scenes/${fromSceneId}/exits`, {
    data: { toSceneId: scene.id },
  })).json()
  await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Wait in the street' } })
}

test('the first Exit offered is taken when the ways on run out of time, and the second is not',
  async ({ page, request }) => {
    await page.clock.install()
    await opened(page, request, async (story, scenes) => {
      await addSecondExit(request, story, scenes[0]!.id)
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 10_000 } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()

    // Both ways on stand, written in the order the Author drew them, and the bar
    // carries the time the Scene gave them.
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wait in the street' })).toBeVisible()
    await expect(page.locator('.expiring')).toHaveAttribute('style', /10000ms/)

    // Nothing is pressed: the first Exit written is the one the clock takes.
    await page.clock.fastForward(10_000)
    await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
    await expect(page.getByText('Nobody comes.')).toHaveCount(0)
  })

test('the ways on say how long they stand, ahead of the list rather than behind it',
  async ({ page, request }) => {
    await page.clock.install()
    await opened(page, request, async (story, scenes) => {
      await addSecondExit(request, story, scenes[0]!.id)
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 10_000 } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()

    // The bar is decoration and says nothing; the sentence is what says a clock
    // is running on the choice at all. Read off the accessibility tree, where the
    // order is the whole of the assertion: the focus lands inside the list, and a
    // sentence behind the list is a sentence reached by walking the virtual
    // cursor past every way on while the clock runs.
    await expect(page.locator('.reading')).toMatchAriaSnapshot(`
      - status: The Exits stand for 10 seconds.
      - list:
        - listitem:
          - button /Follow her out/
        - listitem:
          - button /Wait in the street/
    `)
  })

test('the ways on say they are being asked, where no clock is running on them',
  async ({ page, request }) => {
    await page.clock.install()
    await opened(page, request, async (_, scenes) => {
      // The commonest shape there is: a Scene that plays its run by itself, and a
      // choice at the end of it that stands until the Reader takes one.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { cutAfter: 500 } })
    })

    // The Reader steps off the frame onto a control of their own, where the clock
    // no longer takes the focus back — so from here nothing about the run reaches
    // them by the focus moving, the ways on arriving included.
    await page.clock.fastForward(500)
    const pause = page.getByRole('button', { name: 'Pause the Reading' })
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(pause).toBeFocused()

    // The run ends under them and the choice arrives with the focus where they
    // left it. What says a choice is there at all is the sentence over the list,
    // and it is owed whether or not a clock is running on the ways on: this Scene
    // puts none on them.
    await page.clock.fastForward(500)
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(pause).toBeFocused()
    await expect(page.getByRole('status')
      .filter({ hasText: 'The Exits stand until you take one.' })).toHaveCount(1)
  })

test('the Reader who has stopped the clock is not carried through an Exit either',
  async ({ page, request }) => {
    await page.clock.install()
    await opened(page, request, async (story, scenes) => {
      await addSecondExit(request, story, scenes[0]!.id)
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 10_000 } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()

    const follow = page.getByRole('button', { name: 'Follow her out' })
    const waitInStreet = page.getByRole('button', { name: 'Wait in the street' })
    await expect(follow).toBeVisible()

    // Six seconds into a stand of ten, and stopped there.
    await page.clock.fastForward(6000)
    await page.getByRole('button', { name: 'Pause the Reading' }).click()

    // Well past the ten seconds the Scene gave the ways on, and both still stand.
    await page.clock.fastForward(60_000)
    await expect(follow).toBeVisible()
    await expect(waitInStreet).toBeVisible()
  })

test('a Reader paused before a flowing Scene\'s last beat is offered nothing there either',
  async ({ page, request }) => {
    await opened(page, request, async (story, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 0 } })
    })

    // Paused from the opening beat — the control is on screen from the first
    // Shot, a flowing Scene being clocked like any other — and left that way
    // through both presses, so pausing and arriving happen in the same order a
    // Reader could manage by hand.
    await page.getByRole('button', { name: 'Pause the Reading' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()

    // The run is exhausted and the one Exit written is offered, but the watch
    // that would take it returns early on a paused Reading — the same guard
    // that stops a clocked hold. `asking` is what keeps it off screen even so:
    // without it, the exits it is offered would still be painted.
    await expect(page.getByText('She steps out.')).toBeVisible()
    await expect(page.locator('.exits')).toHaveCount(0)
    await expect(page.locator('.expiring')).toHaveCount(0)

    // Resumed, the Scene flows on the way it would have without the pause.
    await page.getByRole('button', { name: 'Resume the Reading' }).click()
    await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
  })
