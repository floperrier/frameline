import { expect } from '@playwright/test'
import { foldNamed, live, test, unfold, writeStory } from './author'
import {
  TEXT_AFTER_MAX,
  TEXT_OVER_MAX,
  TEXT_PACE_MAX,
  TEXT_STAYS_MAX,
} from '../../shared/utils/scenes'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * How the texts of a Scene arrive, written where the Scene and the Shot are
 * written: after how long, by what unit and at what pace, over how long each part
 * appears and for how long the text stays. Every answer is picked from a
 * `<select>`, and the Story comes back holding what was said. See
 * `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
 */
async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

/** The Story open at the Scene being written, which is where a text's arrival is said. */
async function writing(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await reread(request, story.id)
  const scene = scenes[0]!

  await page.goto(`/stories/${story.id}?scene=${scene.id}`)
  await live(page)

  return { story, scene, shot: scene.shots[0]! }
}

test('a Scene says how its texts arrive, and the Story comes back holding it',
  async ({ page, request }) => {
    const { story } = await writing(page, request)
    const sceneOf = async () => (await reread(request, story.id)).scenes[0]!
    const arrives = page.getByLabel('The text arrives The street', { exact: true })
    const comes = page.getByLabel('The text comes The street', { exact: true })
    const appears = page.getByLabel('The text appears The street', { exact: true })
    const stays = page.getByLabel('The text stays The street', { exact: true })
    const wait = page.getByLabel('Seconds before the text of The street arrives', { exact: true })
    const pace = page.getByLabel('Pace of the text of The street, in characters a second',
      { exact: true })

    // Every Story written so far has its text land with the Image, whole, at once
    // and until the Cut, so that is what the fields say before an Author does —
    // folded with everything else the Scene's head chooses from a list, and said
    // on its line by nothing, because a Scene that says only that spends no words
    // on it.
    await expect(foldNamed(page, 'The street')).not.toHaveAttribute('open')
    const fold = await unfold(page, 'The street')
    await expect(fold.locator('summary')).not.toContainText('Text')
    await expect(arrives).toBeVisible()
    await expect(arrives).toHaveValue('image')
    await expect(comes).toHaveValue('whole')
    await expect(appears).toHaveValue('once')
    await expect(stays).toHaveValue('cut')
    await expect(wait).toHaveCount(0)
    await expect(pace).toHaveCount(0)

    // A wait written where the text appears at once also writes the brief fade.
    await arrives.selectOption('After a time')
    await expect(wait).toHaveValue('1')
    await expect.poll(async () => {
      const { textAfter, textOver } = await sceneOf()
      return { textAfter, textOver }
    }).toEqual({ textAfter: 1000, textOver: 200 })

    await wait.fill('2.5')
    await wait.blur()
    await expect.poll(async () => (await sceneOf()).textAfter).toBe(2500)

    await comes.selectOption('Word by word')
    await expect.poll(async () => (await sceneOf()).textBy).toBe('word')
    await pace.fill('20')
    await pace.blur()
    await expect.poll(async () => (await sceneOf()).textPace).toBe(20)

    await appears.selectOption('At once')
    await expect.poll(async () => (await sceneOf()).textOver).toBe(0)

    await stays.selectOption('For a time')
    await expect.poll(async () => (await sceneOf()).textStays).toBe(3000)

    // A Scene that says otherwise says it on its line, so what it says is read
    // unasked, and its fold comes back shut like every other.
    await page.reload()
    await live(page)
    await expect(fold).not.toHaveAttribute('open')
    await expect(fold.locator('summary')).toContainText(
      'Text after 2.5 s · Text word by word, 20 characters a second · Text stays 3 s')
    await unfold(page, 'The street')
    await expect(arrives).toHaveValue('time')
    await expect(wait).toHaveValue('2.5')
    await expect(comes).toHaveValue('word')
    await expect(pace).toHaveValue('20')
    await expect(stays).toHaveValue('time')

    await stays.selectOption('Until the Cut')
    await expect.poll(async () => (await sceneOf()).textStays).toBeNull()

    // And back at every default, the fields stay where the hand is.
    await arrives.selectOption('With the Image')
    await comes.selectOption('All at once')
    await expect.poll(async () => {
      const { textAfter, textBy, textOver, textStays } = await sceneOf()
      return { textAfter, textBy, textOver, textStays }
    }).toEqual({ textAfter: 0, textBy: 'whole', textOver: 0, textStays: null })
    await expect(arrives).toBeVisible()
  })

test('a Shot answers as its Scene says until it answers for itself',
  async ({ page, request }) => {
    const { story, scene } = await writing(page, request)
    const shotOf = async () => (await reread(request, story.id)).scenes[0]!.shots[0]!
    const row = (label: string) =>
      page.getByLabel(`${label} Shot 1 of The street`, { exact: true })
    const arrives = row('This Shot’s text arrives')
    const comes = row('This Shot’s text comes')
    const appears = row('This Shot’s text appears')
    const stays = row('This Shot’s text stays')
    const pace = page.getByLabel(
      'Pace of the text of Shot 1 of The street, in characters a second', { exact: true })
    const fold = page.locator('summary', { hasText: 'As its Scene plays Shot 1 of The street' })

    // A beat that answers as its Scene says keeps the row folded under its words.
    await expect(foldNamed(page, 'Shot 1 of The street')).not.toHaveAttribute('open')
    await unfold(page, 'Shot 1 of The street')
    for (const select of [arrives, comes, appears, stays]) {
      await expect(select).toHaveValue('scene')
    }
    await expect(pace).toHaveCount(0)

    await stays.selectOption('Until the Cut')
    await expect.poll(async () => (await shotOf()).textStays).toBe(0)

    await comes.selectOption('Letter by letter')
    await expect.poll(async () => (await shotOf()).textBy).toBe('letter')
    await expect(pace).toHaveValue('15')

    // A reload brings the fold back shut, whatever the Shot says: its line says it.
    await page.reload()
    await live(page)
    await expect(foldNamed(page, 'Shot 1 of The street')).not.toHaveAttribute('open')
    await unfold(page, 'Shot 1 of The street')
    await expect(stays).toHaveValue('cut')
    await expect(comes).toHaveValue('letter')

    // The unit wrote the brief fade beside it, so the fade is answered back too.
    await comes.selectOption('As the Scene says')
    await appears.selectOption('As the Scene says')
    await stays.selectOption('As the Scene says')
    await expect.poll(async () => {
      const { textBy, textPace, textOver, textStays } = await shotOf()
      return { textBy, textPace, textOver, textStays }
    }).toEqual({ textBy: null, textPace: null, textOver: null, textStays: null })
    await expect(pace).toHaveCount(0)
    await expect(arrives).toBeVisible()

    // A beat with no words has nothing to arrive, so it carries no row; one back at
    // its Scene's answers is folded again once the page is drawn afresh.
    const empty = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
    await page.reload()
    await live(page)
    await expect(fold).toBeVisible()
    await expect(foldNamed(page, 'Shot 1 of The street')).not.toHaveAttribute('open')
    // Opened, the wordless beat's fold holds its other answers and not that row.
    await unfold(page, 'Shot 3 of The street')
    await expect(page.locator(`#shot-cut-after-${empty.id}`)).toBeVisible()
    await expect(page.locator(`#shot-text-after-${empty.id}`)).toHaveCount(0)
  })

test('the doors take the fields their own row holds, and refuse what is not one',
  async ({ request }) => {
    const story = await writeStory(request)
    const { scenes } = await reread(request, story.id)
    const scene = `/api/scenes/${scenes[0]!.id}`
    const shot = `/api/shots/${scenes[0]!.shots[0]!.id}`

    async function refuses(door: string, data: Record<string, unknown>, said: string) {
      const answer = await request.patch(door, { data })

      expect([door, data, answer.status()]).toEqual([door, data, 400])
      expect([door, data, (await answer.json()).message]).toEqual([door, data, said])
    }

    const after = 'A text arrives after a whole number of milliseconds, up to ten seconds.'
    const by = 'A text arrives all at once, or line by line, word by word or letter by letter.'
    const pace = 'A text arrives at a whole number of characters a second, from 1 to 60.'
    const over = 'A text appears over a whole number of milliseconds, up to three seconds.'
    const stays = 'A text stays for a whole number of milliseconds, up to a minute.'
    const nought = 'A Scene keeps its texts until the Cut or for a time, and nought is neither.'

    await refuses(scene, { textAfter: null }, after)
    await refuses(scene, { textAfter: TEXT_AFTER_MAX + 1 }, after)
    await refuses(scene, { textAfter: 1.5 }, after)
    await refuses(scene, { textAfter: '1000' }, after)
    await refuses(scene, { textBy: 'sentence' }, by)
    await refuses(scene, { textBy: null }, by)
    await refuses(scene, { textPace: 0 }, pace)
    await refuses(scene, { textPace: TEXT_PACE_MAX + 1 }, pace)
    await refuses(scene, { textPace: 1.5 }, pace)
    await refuses(scene, { textPace: '15' }, pace)
    await refuses(scene, { textOver: TEXT_OVER_MAX + 1 }, over)
    await refuses(scene, { textOver: null }, over)
    await refuses(scene, { textStays: TEXT_STAYS_MAX + 1 }, stays)
    await refuses(scene, { textStays: 0 }, nought)

    // A Shot's null is the Shot saying nothing, and its nought is *until the Cut*.
    for (const field of ['textAfter', 'textBy', 'textPace', 'textOver', 'textStays']) {
      expect([field, (await request.patch(shot, { data: { [field]: null } })).status()])
        .toEqual([field, 200])
    }
    expect((await request.patch(shot, { data: { textStays: 0 } })).status()).toBe(200)
    await refuses(shot, { textBy: 'sentence' }, by)
  })

test('a copy and a split carry how the texts arrive',
  async ({ request }) => {
    const story = await writeStory(request)
    const { scenes } = await reread(request, story.id)
    const street = scenes[0]!
    const [first, second] = street.shots
    const said = { textAfter: 1000, textBy: 'word', textPace: 20, textOver: 200, textStays: 3000 }
    const own = { textAfter: 0, textBy: 'letter', textPace: 30, textOver: 0, textStays: 0 }
    const five = (held: Record<string, unknown>) => ({
      textAfter: held.textAfter,
      textBy: held.textBy,
      textPace: held.textPace,
      textOver: held.textOver,
      textStays: held.textStays,
    })

    await request.patch(`/api/scenes/${street.id}`, { data: said })
    await request.patch(`/api/shots/${first!.id}`, { data: own })
    await request.patch(`/api/shots/${second!.id}`, { data: { ...own, textBy: 'line' } })

    const copy = await (await request.post(`/api/scenes/${street.id}/duplicate`)).json()
    const copied = (await reread(request, story.id)).scenes.find(scene => scene.id === copy.id)!
    expect(five(copied)).toEqual(said)
    expect(copied.shots.map(five)).toEqual([own, { ...own, textBy: 'line' }])

    // The second half of a split is a Scene of the Scene's five; a Shot moved into
    // it keeps its own.
    const split = await (await request.post(`/api/scenes/${street.id}/split`, {
      data: { shotId: second!.id, name: 'The street, after' },
    })).json()
    await expect.poll(async () => {
      const after = (await reread(request, story.id)).scenes.find(scene => scene.id === split.id)
      return after && five(after)
    }).toEqual(said)
    const moved = (await reread(request, story.id)).scenes.find(scene => scene.id === split.id)!
    expect(moved.shots.map(five)).toEqual([{ ...own, textBy: 'line' }])
  })
