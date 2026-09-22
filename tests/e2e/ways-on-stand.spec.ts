import { expect } from '@playwright/test'
import { live, seedPublished, test, writeStory } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The other half of the Cut: the ways on may stand for a time of their own,
 * after which the first one still offered is taken — the one already holding
 * focus, and the one Enter would press — and a Scene may give them no time at
 * all, flowing into the next without ever asking. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 *
 * Real, short stands throughout, the way `cut-played.spec.ts` keeps time for a
 * hold: what is being read here is a CSS animation as much as a clock, and a
 * fake one would freeze the very thing being looked at.
 */
async function opened(
  page: Page,
  request: APIRequestContext,
  write: (story: { id: string }, scenes: StoryInEditor['scenes']) => Promise<void>,
) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`))
    .json() as StoryInEditor

  await write(story, scenes)
  await seedPublished(story)
  await page.goto(`/read/${story.id}`)
  // The clock is started by the component that holds the Path, so a page that has
  // loaded and not yet been attached to is a page nothing is holding a countdown on.
  await live(page)
}

/**
 * A second way on out of the Scene `writeStory` gives, to a Scene of its own — so
 * a spec can tell which of two ways on the clock took.
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
    await opened(page, request, async (story, scenes) => {
      await addSecondExit(request, story, scenes[0]!.id)
      // Half a second: long enough for a retrying assertion to read a real bar
      // draining, short enough that no spec here waits it out on purpose.
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 500 } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()

    // Both ways on stand, written in the order the Author drew them, and the bar
    // carries the time the Scene gave them.
    await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wait in the street' })).toBeVisible()
    await expect(page.locator('.expiring')).toHaveAttribute('style', /500ms/)

    // Nothing is pressed: the first Exit written is the one the clock takes.
    await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
    await expect(page.getByText('Nobody comes.')).toHaveCount(0)
  })

test('the Reader who has stopped the clock is not carried through an Exit either',
  async ({ page, request }) => {
    await opened(page, request, async (story, scenes) => {
      await addSecondExit(request, story, scenes[0]!.id)
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 500 } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()

    const follow = page.getByRole('button', { name: 'Follow her out' })
    const waitInStreet = page.getByRole('button', { name: 'Wait in the street' })
    await expect(follow).toBeVisible()
    await page.getByRole('button', { name: 'Pause the Reading' }).click()

    // Well past the 500ms the Scene gave the ways on, and both still stand.
    await page.waitForTimeout(800)
    await expect(follow).toBeVisible()
    await expect(waitInStreet).toBeVisible()
  })

test('a Scene that flows on paints no ways on at all, and the next Scene\'s first beat arrives',
  async ({ page, request }) => {
    await opened(page, request, async (story, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, { data: { exitsAfter: 0 } })
    })

    await page.getByRole('button', { name: 'Next Shot' }).click()
    await page.getByRole('button', { name: 'Next Shot' }).click()

    // The one Exit written is taken without ever being asked: no list of ways on
    // and no bar counting down either, and the Scene it leads to is already on
    // screen.
    await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
    await expect(page.locator('.exits')).toHaveCount(0)
    await expect(page.locator('.expiring')).toHaveCount(0)
  })
