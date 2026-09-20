import { expect } from '@playwright/test'
import { live, test, writeStory } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The Cut written where the Scene, the Shot and the Exit are written: when a Shot
 * leaves the screen, how it leaves it, and how long the ways on stand at the end
 * of a run. Nothing reads these columns in the reading yet, so what is proved here
 * is the whole of what the panel is for — that an Author can say it, and that the
 * Story comes back holding what they said. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 *
 * Every answer is picked from a `<select>` and never typed, which is what keeps
 * the noughts the columns hold out of the Author's hands: a Shot held until the
 * press and ways on offered for no time at all are sentences here.
 */
async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

/** The Story open at the Scene being written, which is where a Cut is said. */
async function writing(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await reread(request, story.id)

  await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
  await live(page)

  return story
}

test('a Scene says when its Shots are cut and how long its ways on stand',
  async ({ page, request }) => {
    const story = await writing(page, request)
    const when = page.getByLabel('The Shots are cut The street', { exact: true })
    const stands = page.getByLabel('Seconds a Shot of The street stands', { exact: true })

    // Every Story written so far waits for the press, so that is what the panel
    // says before an Author says anything — and there is no number beside it,
    // because a duration nobody wrote is not a duration.
    await expect(when).toHaveValue('press')
    await expect(stands).toHaveCount(0)

    await when.selectOption('After a time')
    await expect(stands).toHaveValue('4')
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.cutAfter)
      .toBe(4000)

    // The seconds are the Author's to write over, and the column holds them as
    // milliseconds.
    await stands.fill('2.5')
    await stands.blur()
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.cutAfter)
      .toBe(2500)

    // The third sentence in the panel: how long the ways on are offered, which is
    // until one is taken until the Scene says otherwise.
    const offered = page.getByLabel('The Exits are offered The street', { exact: true })
    const standing = page.getByLabel(
      'Seconds the Exits of The street stand', { exact: true })
    await expect(offered).toHaveValue('taken')
    await offered.selectOption('For a time')
    await expect(standing).toHaveValue('10')
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.exitsAfter)
      .toBe(10_000)

    // Offered for no time at all is the Scene flowing into the next without
    // asking, which is the one nought an Author picks rather than types.
    await offered.selectOption('Not at all — the Scene flows on')
    await expect(standing).toHaveCount(0)
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.exitsAfter)
      .toBe(0)

    await page.reload()
    await live(page)
    await expect(when).toHaveValue('clock')
    await expect(stands).toHaveValue('2.5')
    await expect(offered).toHaveValue('none')
  })

test('a Shot answers as its Scene says until it answers for itself',
  async ({ page, request }) => {
    const story = await writing(page, request)
    const shotOf = async () => (await reread(request, story.id)).scenes[0]!.shots[0]!
    const when = page.getByLabel('This Shot is cut Shot 1 of The street', { exact: true })
    const made = page.getByLabel('The Cut is made Shot 1 of The street', { exact: true })

    await expect(when).toHaveValue('scene')
    await expect(made).toHaveValue('scene')

    // Nought is what the column holds for a beat waiting for the press, and it is
    // never shown as one: the Author picks the sentence and the sentinel stays in
    // the column.
    await when.selectOption('At the press')
    await expect.poll(async () => (await shotOf()).cutAfter).toBe(0)
    await expect(page.getByLabel('Seconds Shot 1 of The street stands', { exact: true }))
      .toHaveCount(0)

    await made.selectOption('Through the image')
    await expect.poll(async () => {
      const { cutOver, cutThrough } = await shotOf()
      return { cutOver, cutThrough }
    }).toEqual({ cutOver: 800, cutThrough: 'image' })

    await page.reload()
    await live(page)
    await expect(when).toHaveValue('press')
    await expect(made).toHaveValue('image')

    // Handed back to the Scene, both of the Shot's own columns are null again —
    // one answer, and never a pair that could disagree.
    await made.selectOption('As the Scene says')
    await expect.poll(async () => {
      const { cutOver, cutThrough } = await shotOf()
      return { cutOver, cutThrough }
    }).toEqual({ cutOver: null, cutThrough: null })
  })

test('an Exit says how the passage out is made, and a hard cut says nothing more',
  async ({ page, request }) => {
    const story = await writing(page, request)
    const way = 'the Exit 1 to The bar, out of The street'
    const made = page.getByLabel(`The Cut is made ${way}`, { exact: true })
    const takes = page.getByLabel(`Seconds the Cut of ${way}, takes`, { exact: true })

    await expect(made).toHaveValue('hard')
    await expect(takes).toHaveCount(0)

    await made.selectOption('Through black')
    await expect(takes).toHaveValue('1.2')
    await expect.poll(async () => {
      const { cutOver, cutThrough } = (await reread(request, story.id)).exits[0]!
      return { cutOver, cutThrough }
    }).toEqual({ cutOver: 1200, cutThrough: 'black' })

    await page.reload()
    await live(page)
    await expect(made).toHaveValue('black')
    await expect(takes).toHaveValue('1.2')

    // Hard again, and the duration goes with it. There is no third value in the
    // column and none in the panel: under a cut of no duration there is nothing
    // left to pass through.
    await made.selectOption('Hard')
    await expect(takes).toHaveCount(0)
    await expect.poll(async () => (await reread(request, story.id)).exits[0]!.cutOver)
      .toBe(0)
  })
