import { expect } from '@playwright/test'
import { live, test, unfold, writeStory } from './author'
import type { APIRequestContext } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

const aLayout = 'A Layout puts the Image above the text, or full screen.'
const aCrop = 'An Image is cropped around a whole percent across and down, from 0 to 100.'

/**
 * The Layout of a Scene and of a Shot, and the point a Shot's Image is cropped
 * around, asked of the doors directly: which words and numbers each takes, what
 * is refused in a sentence, and what *Duplicate Scene* and *Split* carry across.
 * Every refusal asserts the sentence as well as the status, because the sentence
 * is the refusal: `docs/adr/0009-a-refusal-travels-in-the-body.md`.
 */
async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

test('a Scene and a Shot take a Layout, and a Shot a point to be cropped around',
  async ({ request }) => {
    const story = await writeStory(request)
    const { scenes } = await reread(request, story.id)
    const scene = `/api/scenes/${scenes[0]!.id}`
    const shot = `/api/shots/${scenes[0]!.shots[0]!.id}`

    async function refuses(door: string, data: Record<string, unknown>, said: string) {
      const answer = await request.patch(door, { data })

      expect([door, JSON.stringify(data), answer.status()]).toEqual([door, JSON.stringify(data), 400])
      expect([door, (await answer.json()).message]).toEqual([door, said])
    }

    // What every Story written so far says.
    expect(scenes[0]!.layout).toBe('inset')
    expect(scenes[0]!.shots[0]).toMatchObject({ layout: null, cropX: 50, cropY: 50 })

    const full = await request.patch(scene, { data: { layout: 'full' } })
    expect((await full.json()).layout).toBe('full')
    await refuses(scene, { layout: null }, aLayout)
    await refuses(scene, { layout: 'wide' }, aLayout)

    expect((await (await request.patch(shot, { data: { layout: 'full' } })).json()).layout)
      .toBe('full')
    expect((await (await request.patch(shot, { data: { layout: null } })).json()).layout)
      .toBeNull()
    await refuses(shot, { layout: 'wide' }, aLayout)

    // Each axis lands on its own.
    expect(await (await request.patch(shot, { data: { cropX: 30 } })).json())
      .toMatchObject({ cropX: 30, cropY: 50 })
    for (const data of [{ cropX: 101 }, { cropY: -1 }, { cropX: 2.5 }, { cropY: '50' }]) {
      await refuses(shot, data, aCrop)
    }
  })

test('a Scene duplicated and a Scene split carry the Layout and the point',
  async ({ request }) => {
    const story = await writeStory(request)
    const street = (await reread(request, story.id)).scenes[0]!
    const [first, second] = street.shots

    await request.patch(`/api/scenes/${street.id}`, { data: { layout: 'full' } })
    await request.patch(`/api/shots/${first!.id}`, {
      data: { layout: 'inset', cropX: 20, cropY: 80 },
    })

    const made = await request.post(`/api/scenes/${street.id}/duplicate`)
    expect(made.status()).toBe(201)
    const { id: copyId } = await made.json() as { id: string }
    const copy = (await reread(request, story.id)).scenes.find(scene => scene.id === copyId)!
    expect(copy.layout).toBe('full')
    expect(copy.shots[0]).toMatchObject({ layout: 'inset', cropX: 20, cropY: 80 })

    await request.patch(`/api/shots/${second!.id}`, {
      data: { layout: 'inset', cropX: 10, cropY: 90 },
    })
    const split = await request.post(`/api/scenes/${street.id}/split`, {
      data: { shotId: second!.id, name: 'The street, later' },
    })
    expect(split.status()).toBe(201)
    const { id: laterId } = await split.json() as { id: string }
    const later = (await reread(request, story.id)).scenes.find(scene => scene.id === laterId)!
    expect(later.layout).toBe('full')
    expect(later.shots[0]).toMatchObject({ layout: 'inset', cropX: 10, cropY: 90 })
  })

test('an Author writes the Layout of a Scene and of a Shot from the Scene\'s document',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const street = (await reread(request, story.id)).scenes[0]!
    const shot = street.shots[0]!

    await page.goto(`/stories/${story.id}?scene=${street.id}`)
    await unfold(page, 'The street')

    const laid = page.getByLabel('The Shots are laid out The street', { exact: true })
    const reread0 = async () => (await reread(request, story.id)).scenes[0]!

    await expect(laid).toHaveValue('inset')
    await laid.selectOption('Image full screen, text over it')
    await expect.poll(async () => (await reread0()).layout).toBe('full')

    // A Shot answers *as the Scene says* until it is told otherwise, which is the
    // null the column holds.
    const own = page.getByLabel('This Shot is laid out Shot 1 of The street', { exact: true })
    await unfold(page, 'Shot 1 of The street')
    await expect(own).toHaveValue('scene')
    await own.selectOption('Image above the text')
    await expect.poll(async () => (await reread0()).shots[0]!.layout).toBe('inset')
    await own.selectOption('As the Scene says')
    await expect.poll(async () => (await reread0()).shots[0]!.layout).toBeNull()

    await page.reload()
    await live(page)
    await expect(laid).toHaveValue('full')
    await expect(own).toHaveValue('scene')
  })
