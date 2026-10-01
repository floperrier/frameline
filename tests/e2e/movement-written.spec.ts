import { expect } from '@playwright/test'
import { live, ONE_PIXEL, test, unfold, writeStory } from './author'
import type { APIRequestContext } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * The Movement of a Scene and of a Shot, written from the Scene's document and
 * asked of the doors: what an Author can say, what comes back, what is refused in
 * a sentence, and what *Duplicate Scene* and *Split* carry across.
 */
const aPercent = 'An Image moves by a whole number of percent, from nought to fifty.'
const aDirection = 'An Image moves closer, away, to the left, to the right, up or down.'
const aTime = 'A Movement takes a whole number of milliseconds, up to a minute.'

/** The Story as the editor's door gives it back, read again after each write. */
async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

test('the Movement written on a Scene reads back, and Not at all keeps the direction',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const street = (await reread(request, story.id)).scenes[0]!
    const first = async () => (await reread(request, story.id)).scenes[0]!

    await page.goto(`/stories/${story.id}?scene=${street.id}`)
    await unfold(page, 'The street')

    const moves = page.getByLabel('The Images move The street', { exact: true })
    const by = page.getByLabel('Percent the Images of The street move by', { exact: true })
    const takes = page.getByLabel('The Movement takes The street', { exact: true })
    const over = page.getByLabel('Seconds the Movement of The street takes', { exact: true })

    await expect(moves).toHaveValue('still')
    await expect(by).toHaveCount(0)
    await expect(takes).toHaveCount(0)

    await moves.selectOption('Closer')
    await expect(by).toHaveValue('15')
    await expect(takes.locator('option:checked')).toHaveText('As long as its Shot is on screen')
    await expect.poll(async () => (await first()).movementBy).toBe(15)

    await by.fill('25')
    await by.blur()
    await expect.poll(async () => (await first()).movementBy).toBe(25)
    // The choice is waited for in the Story before the seconds are typed over it,
    // because the field is drawn the moment the choice is put on the row, before
    // its write has landed. Typed at once, the two writes were in flight together,
    // and the first landing after the second left the Story at ten seconds.
    await takes.selectOption('A time of its own')
    await expect(over).toHaveValue('10')
    await expect.poll(async () => (await first()).movementOver).toBe(10_000)
    await over.fill('2.5')
    await over.blur()
    await expect.poll(async () => (await first()).movementOver).toBe(2500)

    await page.reload()
    await unfold(page, 'The street')
    await expect(moves).toHaveValue('closer')
    await expect(by).toHaveValue('25')
    await expect(over).toHaveValue('2.5')
    expect(await first()).toMatchObject({
      movementBy: 25, movementDirection: 'closer', movementOver: 2500,
    })

    // A nought typed is handed back; *Not at all* is what says it.
    await by.fill('0')
    await by.blur()
    await expect(by).toHaveValue('25')
    await over.fill('0')
    await over.blur()
    await expect(over).toHaveValue('2.5')
    expect(await first()).toMatchObject({ movementBy: 25, movementOver: 2500 })

    await moves.selectOption('Not at all')
    await expect.poll(async () => (await first()).movementBy).toBe(0)
    expect((await first()).movementDirection).toBe('closer')
    await expect(by).toHaveCount(0)
    await expect(takes).toHaveCount(0)
  })

test('a Shot answers for itself, and As the Scene says writes nulls',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const street = (await reread(request, story.id)).scenes[0]!
    const [shot, bare] = street.shots
    const own = async () => (await reread(request, story.id)).scenes[0]!.shots[0]!

    await request.put(`/api/shots/${shot!.id}/image`, { data: ONE_PIXEL })
    await page.goto(`/stories/${story.id}?scene=${street.id}`)
    await live(page)

    const moves = page.getByLabel('The Image of this Shot moves Shot 1 of The street', { exact: true })
    await unfold(page, 'Shot 1 of The street')
    await expect(moves).toHaveValue('scene')
    await expect(page.getByLabel('The Image of this Shot moves Shot 2 of The street', { exact: true }))
      .toHaveCount(0)
    expect(bare!.image).toBeNull()

    await moves.selectOption('To the left')
    await expect.poll(async () => (await own()).movementDirection).toBe('left')
    expect((await own()).movementBy).toBe(15)

    await moves.selectOption('As the Scene says')
    await expect.poll(async () => (await own()).movementDirection).toBeNull()
    expect((await own()).movementBy).toBeNull()
  })

test('the doors refuse a Movement out of bounds by its sentence and a Shot takes null',
  async ({ request }) => {
    const story = await writeStory(request)
    const { scenes } = await reread(request, story.id)
    const scene = `/api/scenes/${scenes[0]!.id}`
    const shot = `/api/shots/${scenes[0]!.shots[0]!.id}`

    async function refuses(door: string, data: Record<string, unknown>, said: string) {
      const answer = await request.patch(door, { data })

      expect([door, JSON.stringify(data), answer.status()])
        .toEqual([door, JSON.stringify(data), 400])
      expect([door, (await answer.json()).message]).toEqual([door, said])
    }

    for (const movementBy of [51, -1, 2.5, '15']) await refuses(shot, { movementBy }, aPercent)
    for (const movementOver of [60_001, -1]) await refuses(shot, { movementOver }, aTime)
    await refuses(shot, { movementDirection: 'sideways' }, aDirection)

    await refuses(scene, { movementBy: null }, aPercent)
    await refuses(scene, { movementDirection: null }, aDirection)
    await refuses(scene, { movementOver: null }, aTime)

    for (const field of ['movementBy', 'movementDirection', 'movementOver']) {
      expect((await request.patch(shot, { data: { [field]: null } })).status()).toBe(200)
    }
  })

test('a Scene duplicated and a Scene split carry the Movement',
  async ({ request }) => {
    const story = await writeStory(request)
    const street = (await reread(request, story.id)).scenes[0]!
    const [first, second] = street.shots

    await request.patch(`/api/scenes/${street.id}`, {
      data: { movementBy: 20, movementDirection: 'up', movementOver: 3000 },
    })
    await request.patch(`/api/shots/${first!.id}`, {
      data: { movementBy: 10, movementDirection: 'left', movementOver: null },
    })

    const made = await request.post(`/api/scenes/${street.id}/duplicate`)
    expect(made.status()).toBe(201)
    const { id: copyId } = await made.json() as { id: string }
    const copy = (await reread(request, story.id)).scenes.find(scene => scene.id === copyId)!
    expect(copy).toMatchObject({ movementBy: 20, movementDirection: 'up', movementOver: 3000 })
    expect(copy.shots[0]).toMatchObject({
      movementBy: 10, movementDirection: 'left', movementOver: null,
    })

    const split = await request.post(`/api/scenes/${street.id}/split`, {
      data: { shotId: second!.id, name: 'The street, later' },
    })
    expect(split.status()).toBe(201)
    const { id: laterId } = await split.json() as { id: string }
    const later = (await reread(request, story.id)).scenes.find(scene => scene.id === laterId)!
    expect(later).toMatchObject({ movementBy: 20, movementDirection: 'up', movementOver: 3000 })
  })
