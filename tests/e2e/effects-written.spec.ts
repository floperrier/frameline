import { expect } from '@playwright/test'
import { ONE_PIXEL, live, test, writeStory } from './author'
import {
  ARRIVES_OVER_MAX, ARRIVES_OVER_MIN, LASTS_EVERY_MAX,
} from '../../shared/utils/scenes'
import type { APIRequestContext } from '@playwright/test'
import type { Shot, StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Shot's Effects written where its Cut is written, on the Shot's own row: four
 * sentences, the Image's two drawn only where there is an Image, each answered
 * from a `<select>` and, once answered, given its time and its strength. What is
 * proved here is that an Author can say each of them and that the Story comes
 * back holding what they said, and that the door behind the row takes nothing the
 * row could not have written. See
 * `docs/adr/0051-an-effect-is-said-of-one-beat.md`.
 */
async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

/** The four slots of a Shot, which is the whole of what an Effect is held in. */
function effectsOf(shot: Shot) {
  const { imageArrives, imageLasts, textArrives, textLasts } = shot
  return { imageArrives, imageLasts, textArrives, textLasts }
}

test('a Shot says what its Image and its text do as they arrive and while they stay',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await reread(request, story.id)
    // The first Shot carries an Image and the second does not, which is the whole
    // of what decides whether the Image's two sentences are drawn.
    await request.put(`/api/shots/${scenes[0]!.shots[0]!.id}/image`, { data: ONE_PIXEL })
    const shotOf = async () => (await reread(request, story.id)).scenes[0]!.shots[0]!

    await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
    await live(page)

    // The time and the strength are named by the sentence they answer and the word
    // for what they are, so each is read out as the question it belongs to. That
    // borrowed sentence is why every control here is found by its role and the
    // whole name the accessibility tree gives it: `getByLabel` reads the sentence
    // alone, and finds the answer, its time and its strength all three.
    const on = (sentence: string, place = 1) => page.getByRole('combobox', {
      name: `${sentence} Shot ${place} of The street`, exact: true,
    })
    const seconds = (sentence: string) => page.getByRole('spinbutton', {
      name: `${sentence} Shot 1 of The street Seconds`, exact: true,
    })
    const strength = (sentence: string) => page.getByRole('combobox', {
      name: `${sentence} Shot 1 of The street Strength`, exact: true,
    })

    // The text's two are on every row and the Image's two wait for an Image, as
    // the Description does: a Shot of words alone has nothing to shake but them.
    await expect(on('As the Image arrives')).toBeVisible()
    await expect(on('While the Image is on screen')).toBeVisible()
    await expect(on('As the Image arrives', 2)).toHaveCount(0)
    await expect(on('While the Image is on screen', 2)).toHaveCount(0)
    await expect(on('As the text arrives', 2)).toBeVisible()
    await expect(on('While the text is on screen', 2)).toBeVisible()

    // Every Story written so far carries none, and there is nothing beside an
    // answer nobody gave: no time and no strength for no Effect.
    for (const sentence of ['As the Image arrives', 'While the Image is on screen',
      'As the text arrives', 'While the text is on screen']) {
      await expect(on(sentence)).toHaveValue('')
      await expect(strength(sentence)).toHaveCount(0)
    }

    // A choice writes the whole Effect, starting where its time starts and at
    // *Marked*, because half of one is an Effect the door refuses.
    await on('As the Image arrives').selectOption('From white')
    await expect.poll(async () => (await shotOf()).imageArrives)
      .toEqual({ effect: 'from-white', over: 1200, strength: 'marked' })
    await expect(seconds('As the Image arrives')).toHaveValue('1.2')
    await expect(strength('As the Image arrives')).toHaveValue('marked')

    // Both are the Author's to write over, and the column holds the seconds as
    // milliseconds, as the Cut's does.
    await seconds('As the Image arrives').fill('2')
    await seconds('As the Image arrives').blur()
    await expect.poll(async () => (await shotOf()).imageArrives?.over).toBe(2000)
    await strength('As the Image arrives').selectOption('Strong')
    await expect.poll(async () => (await shotOf()).imageArrives?.strength).toBe('strong')

    // Another Effect in the same slot keeps the strength the slot was given, and
    // starts its own time rather than inheriting a time written for something else.
    await on('As the Image arrives').selectOption('A shake')
    await expect.poll(async () => (await shotOf()).imageArrives)
      .toEqual({ effect: 'shake', over: 500, strength: 'strong' })

    // Grain has no round to tell, so it is written without one and no field of
    // seconds is drawn beside it.
    await on('While the Image is on screen').selectOption('Film grain')
    await expect.poll(async () => (await shotOf()).imageLasts)
      .toEqual({ effect: 'grain', strength: 'marked' })
    await expect(seconds('While the Image is on screen')).toHaveCount(0)

    await on('As the text arrives').selectOption('From a blur')
    await expect.poll(async () => (await shotOf()).textArrives)
      .toEqual({ effect: 'from-blur', over: 1500, strength: 'marked' })

    // A pulse is given a round, and a flicker chosen over it gives the round up:
    // it keeps one pace, and a round left on it is a key the door would refuse.
    await on('While the text is on screen').selectOption('A pulse')
    await expect.poll(async () => (await shotOf()).textLasts)
      .toEqual({ effect: 'pulse', every: 900, strength: 'marked' })
    await expect(seconds('While the text is on screen')).toHaveValue('0.9')
    await on('While the text is on screen').selectOption('A flicker')
    await expect.poll(async () => (await shotOf()).textLasts)
      .toEqual({ effect: 'flicker', strength: 'marked' })
    await expect(seconds('While the text is on screen')).toHaveCount(0)

    // And the Story reads back what was said.
    await page.reload()
    await live(page)
    await expect(on('As the Image arrives')).toHaveValue('shake')
    await expect(seconds('As the Image arrives')).toHaveValue('0.5')
    await expect(strength('As the Image arrives')).toHaveValue('strong')
    await expect(on('While the Image is on screen')).toHaveValue('grain')
    await expect(on('As the text arrives')).toHaveValue('from-blur')
    await expect(on('While the text is on screen')).toHaveValue('flicker')

    // *No Effect* is null, the one answer every Story written so far holds, and
    // the time and the strength go with it.
    await on('As the text arrives').selectOption('No Effect')
    await expect.poll(async () => (await shotOf()).textArrives).toBeNull()
    await expect(strength('As the text arrives')).toHaveCount(0)
    // And a row writes its own Shot and no other.
    const [written, untouched] = (await reread(request, story.id)).scenes[0]!.shots
    expect(effectsOf(written!)).toEqual({
      imageArrives: { effect: 'shake', over: 500, strength: 'strong' },
      imageLasts: { effect: 'grain', strength: 'marked' },
      textArrives: null,
      textLasts: { effect: 'flicker', strength: 'marked' },
    })
    expect(effectsOf(untouched!)).toEqual({
      imageArrives: null, imageLasts: null, textArrives: null, textLasts: null,
    })
  })

/**
 * The door itself, asked directly rather than through the row: the row offers
 * only Effects that exist, at times inside their bounds, so this is the half of
 * the boundary nothing else reaches. Every case asserts the sentence as well as
 * the status, because the sentence is the refusal:
 * `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
test('the door takes a whole Effect its carrier is offered, and refuses what is not one',
  async ({ request }) => {
    const story = await writeStory(request)
    const shot = `/api/shots/${(await reread(request, story.id)).scenes[0]!.shots[0]!.id}`

    async function refuses(data: Record<string, unknown>, said: string) {
      const answer = await request.patch(shot, { data })

      expect([data, answer.status()]).toEqual([data, 400])
      expect([data, (await answer.json()).message]).toEqual([data, said])
    }

    const anArrival = 'An Effect as the Image or the words arrive is one offered for them, '
      + 'lasts a whole number of milliseconds from 100 to 5000, and is slight, marked or strong.'
    const aLasting = 'An Effect while the Image or the words are on screen is one offered for '
      + 'them, with a round of a whole number of milliseconds from 200 to 4000 where it has '
      + 'one, and is slight, marked or strong.'

    // A flash from white is said of a picture, so the Image takes it and the words
    // do not: the carrier is the field's own, and the door holds each to its list.
    expect((await request.patch(shot, {
      data: { imageArrives: { effect: 'from-white', over: 1200, strength: 'marked' } },
    })).status()).toBe(200)
    await refuses({ textArrives: { effect: 'from-white', over: 1200, strength: 'marked' } },
      anArrival)

    // One past each bound, read off the bounds themselves so the spec cannot drift
    // from the field that offers them or the reader that holds them.
    await refuses({ imageArrives: { effect: 'shake', over: ARRIVES_OVER_MIN - 1, strength: 'marked' } },
      anArrival)
    await refuses({ imageArrives: { effect: 'shake', over: ARRIVES_OVER_MAX + 1, strength: 'marked' } },
      anArrival)
    await refuses({ textLasts: { effect: 'pulse', every: LASTS_EVERY_MAX + 1, strength: 'marked' } },
      aLasting)

    // Three degrees are the whole of a strength.
    await refuses({ textArrives: { effect: 'shake', over: 500, strength: 'loud' } }, anArrival)

    // A flicker keeps one pace, so a round written on one is a key it does not
    // take, refused rather than stored and never read.
    await refuses({ imageLasts: { effect: 'flicker', every: 900, strength: 'marked' } }, aLasting)

    // Seconds sent where milliseconds belong: a fraction, and under the bound
    // besides. The door reads the number rather than guessing at its unit.
    await refuses({ imageArrives: { effect: 'from-blur', over: 2.5, strength: 'marked' } },
      anArrival)

    // Nothing refused was written, and null is none rather than a refusal.
    const held = await reread(request, story.id)
    expect(held.scenes[0]!.shots[0]!.imageArrives)
      .toEqual({ effect: 'from-white', over: 1200, strength: 'marked' })
    expect((await request.patch(shot, { data: { imageArrives: null } })).status()).toBe(200)
    expect((await reread(request, story.id)).scenes[0]!.shots[0]!.imageArrives).toBeNull()
  })

test('a Scene written again or split keeps every Effect its Shots carry',
  async ({ request }) => {
    const story = await writeStory(request)
    const { scenes } = await reread(request, story.id)
    const street = scenes[0]!
    const [first, second] = street.shots

    const firstEffects = {
      imageArrives: { effect: 'from-blur', over: 1600, strength: 'marked' },
      imageLasts: { effect: 'grain', strength: 'strong' },
      textArrives: { effect: 'shake', over: 500, strength: 'slight' },
      textLasts: { effect: 'pulse', every: 800, strength: 'slight' },
    }
    const secondEffects = {
      imageArrives: null,
      imageLasts: { effect: 'tremor', every: 400, strength: 'strong' },
      textArrives: null,
      textLasts: { effect: 'flicker', strength: 'marked' },
    }
    expect((await request.patch(`/api/shots/${first!.id}`, { data: firstEffects })).status())
      .toBe(200)
    expect((await request.patch(`/api/shots/${second!.id}`, { data: secondEffects })).status())
      .toBe(200)

    // *Duplicate Scene* is the Scene met again, so its beats arrive and stand as
    // they did the first time.
    const made = await request.post(`/api/scenes/${street.id}/duplicate`)
    expect(made.status()).toBe(201)
    const { id: copyId } = await made.json() as { id: string }
    const copy = (await reread(request, story.id)).scenes.find(scene => scene.id === copyId)!
    expect(copy.shots.map(effectsOf)).toEqual([firstEffects, secondEffects])

    // *Split* moves the Shots from the one it splits before as rows, so what each
    // of them does goes with it.
    const split = await request.post(`/api/scenes/${street.id}/split`, {
      data: { shotId: second!.id, name: 'The street, later' },
    })
    expect(split.status()).toBe(201)
    const { id: laterId } = await split.json() as { id: string }
    const after = await reread(request, story.id)
    expect(after.scenes.find(scene => scene.id === street.id)!.shots.map(effectsOf))
      .toEqual([firstEffects])
    expect(after.scenes.find(scene => scene.id === laterId)!.shots.map(effectsOf))
      .toEqual([secondEffects])
  })
