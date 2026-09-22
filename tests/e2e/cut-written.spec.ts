import { expect } from '@playwright/test'
import { live, test, writeStory } from './author'
import { CUT_AFTER_MAX, CUT_OVER_MAX, EXITS_AFTER_MAX } from '../../shared/utils/scenes'
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
  const scene = scenes[0]!

  await page.goto(`/stories/${story.id}?scene=${scene.id}`)
  await live(page)

  return { story, scene, shot: scene.shots[0]! }
}

test('a Scene says when its Shots are cut and how long its ways on stand',
  async ({ page, request }) => {
    const { story, scene, shot } = await writing(page, request)
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

    // Typed to nought, the hold is no hold: on a Scene that is said in null, so
    // the panel answers *at the press* and takes the field away with it. A panel
    // reading *after a time, 0 s* over a run the Reading holds until the press
    // would be the one thing `0050` promises cannot happen.
    await stands.fill('0')
    await stands.blur()
    await expect(when).toHaveValue('press')
    await expect(stands).toHaveCount(0)
    await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.cutAfter)
      .toBeNull()

    // And the door says the same, so nothing else can write the shape the panel
    // will not: a Scene's nought is refused where a Shot's is taken, which is the
    // whole reason nought exists.
    const refused = await request.patch(`/api/scenes/${scene.id}`, { data: { cutAfter: 0 } })
    expect(refused.status()).toBe(400)
    expect((await refused.json()).message)
      .toContain('A Scene holds its Shots for a time or until the Reader presses')
    expect((await request.patch(`/api/shots/${shot.id}`, { data: { cutAfter: 0 } })).status())
      .toBe(200)
  })

test('a Shot answers as its Scene says until it answers for itself',
  async ({ page, request }) => {
    const { story } = await writing(page, request)
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

    await made.selectOption('A dissolve')
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
    const { story } = await writing(page, request)
    const way = 'the Exit 1 to The bar, out of The street'
    const made = page.getByLabel(`The Cut is made ${way}`, { exact: true })
    const takes = page.getByLabel(`Seconds taken by the Cut of ${way}`, { exact: true })

    await expect(made).toHaveValue('hard')
    await expect(takes).toHaveCount(0)

    await made.selectOption('A fade to black')
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

/**
 * The three doors themselves, asked directly rather than through the panel: which
 * field each carrier's row holds, and where a null is a sentence rather than a
 * gap. The panel writes none of these bodies — it offers a `<select>` of the
 * answers that exist — so this is the half of the boundary nothing else reaches,
 * and issue #317 asked for it in as many words: the bounds readers, over a value
 * under, over, non-integer and of the wrong type.
 *
 * Every case asserts the sentence as well as the status, because the sentence is
 * the refusal: `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
test('the three doors take the fields their own row holds, and refuse what is not one',
  async ({ request }) => {
    const story = await writeStory(request)
    const { scenes, exits } = await reread(request, story.id)
    const scene = `/api/scenes/${scenes[0]!.id}`
    const shot = `/api/shots/${scenes[0]!.shots[0]!.id}`
    const exit = `/api/exits/${exits[0]!.id}`

    // The door named beside the answer, so a failure says which of the three it
    // came back through rather than only what it said.
    async function refuses(door: string, data: Record<string, unknown>, said: string) {
      const answer = await request.patch(door, { data })

      expect([door, answer.status()]).toEqual([door, 400])
      expect([door, (await answer.json()).message]).toEqual([door, said])
    }

    const aTime = 'A Shot stands for a whole number of milliseconds, up to a minute.'
    const aCut = 'A Cut takes a whole number of milliseconds, up to five seconds.'
    const aKind = 'A Cut is made in a dissolve or in a fade to black.'
    const offered = 'The Exits are offered for a whole number of milliseconds, up to a minute.'

    // A Scene and an Exit answer for their own cut with nothing above them, so
    // neither column takes the null a Shot may leave — and both doors refuse it
    // the way they refuse a number out of bounds, since a column that cannot hold
    // it has no second thing to say.
    await refuses(scene, { cutOver: null }, aCut)
    await refuses(exit, { cutOver: null }, aCut)

    // A Shot's does take it: null there is the Shot saying nothing, which is
    // *as the Scene says*.
    expect((await request.patch(shot, { data: { cutOver: null } })).status()).toBe(200)
    expect((await reread(request, story.id)).scenes[0]!.shots[0]!.cutOver).toBeNull()

    // Two words are the whole of the language a cut is made in.
    await refuses(scene, { cutThrough: 'grey' }, aKind)
    await refuses(shot, { cutThrough: 'grey' }, aKind)

    // One past each cap, read off the caps themselves so the spec cannot drift
    // from the field that offers them or the reader that holds them.
    await refuses(scene, { cutAfter: CUT_AFTER_MAX + 1 }, aTime)
    await refuses(shot, { cutAfter: CUT_AFTER_MAX + 1 }, aTime)
    await refuses(scene, { cutOver: CUT_OVER_MAX + 1 }, aCut)
    await refuses(exit, { cutOver: CUT_OVER_MAX + 1 }, aCut)
    await refuses(scene, { exitsAfter: EXITS_AFTER_MAX + 1 }, offered)

    // Under it, either side of nought: a Shot's nought is a sentence and anything
    // below it is not a duration at all.
    await refuses(shot, { cutAfter: -1 }, aTime)
    await refuses(exit, { cutOver: -1 }, aCut)

    // A time is a whole number of milliseconds, so a fraction of one is refused
    // rather than rounded — the field writes whole milliseconds and the column
    // holds them, and a reader that rounded would be a third opinion.
    await refuses(shot, { cutAfter: 1500.5 }, aTime)
    await refuses(scene, { cutOver: 800.5 }, aCut)

    // And a time is a number rather than what a number was typed into: the doors
    // read the body rather than parse it.
    await refuses(scene, { cutAfter: '4000' }, aTime)
    await refuses(exit, { cutThrough: 42 }, aKind)

    // An Exit is taken rather than held, so it has no `cutAfter` to write. What
    // the door does with one is not ignore it: a body naming nothing the row
    // holds is a body with no change in it, and this door asks for the one thing
    // an Exit cannot be without — see `readExitChanges`.
    await refuses(exit, { cutAfter: 4000 }, 'An Exit carries text.')
  })
