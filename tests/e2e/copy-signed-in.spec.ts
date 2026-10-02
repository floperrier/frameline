import { readFile } from 'node:fs/promises'
import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { SAMPLES, imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { Condition, StoryInEditor } from '../../shared/utils/scenes'
import { seedStory, test, type Author } from './author'

/** The Sample, planted the way `sample-signed-in.spec.ts` plants it. */
async function plant(author: Author) {
  await plantSample(author.id, 'en', {
    db: drizzle(process.env.DATABASE_URL!, { schema }),
    image: name => readFile(imagePath(name)),
    sound: file => readFile(soundPath(file)),
  })
}

async function read(request: APIRequestContext, id: string): Promise<StoryInEditor> {
  return (await request.get(`/api/stories/${id}`)).json()
}

/** The ids a Story's Conditions name, of Scenes and of Exits alike. */
function namedIn(story: StoryInEditor) {
  const conditions: Condition[] = [
    ...story.scenes.flatMap(scene => scene.shots.flatMap(shot => shot.conditions)),
    ...story.exits.flatMap(exit => exit.conditions),
  ]
  return conditions.flatMap(condition =>
    'scene' in condition ? [condition.scene] : 'exit' in condition ? [condition.exit] : [])
}

function idsOf(story: StoryInEditor) {
  return new Set([
    ...story.scenes.map(scene => scene.id),
    ...story.scenes.flatMap(scene => scene.shots.map(shot => shot.id)),
    ...story.exits.map(exit => exit.id),
  ])
}

test('a Story is copied whole from the shelf, into another Language, and the copy opens on the bench', async ({
  page,
  request,
  author,
}) => {
  await plant(author)
  const [{ id }] = await (await request.get('/api/stories')).json()
  const planted = await read(request, id)
  const [opening, , last] = planted.scenes

  // Two references the Sample does not make of itself: a Cover named, and a
  // Scene heard under the Sound another carries.
  expect((await request.patch(`/api/stories/${id}`, {
    data: { coverShotId: opening!.shots[0]!.id },
  })).ok()).toBe(true)
  expect((await request.patch(`/api/scenes/${last!.id}`, {
    data: { soundOfSceneId: opening!.id },
  })).ok()).toBe(true)
  const original = await read(request, id)

  await page.goto('/stories')
  const duplicate = page.getByRole('button', { name: `Duplicate ${SAMPLES.en.title}` })
  const title = page.getByLabel('Title of the copy')
  const language = page.getByLabel('Language of the copy')
  const write = page.getByRole('button', { name: 'Write the Copy' })

  // The form opens filled with what the Story already is, its title ready to
  // be typed over.
  await duplicate.click()
  await expect(duplicate).toHaveAttribute('aria-expanded', 'true')
  await expect(title).toBeFocused()
  await expect(title).toHaveValue(SAMPLES.en.title)
  expect(await title.evaluate((field: HTMLInputElement) =>
    [field.selectionStart, field.selectionEnd])).toEqual([0, SAMPLES.en.title.length])
  await expect(language).toHaveValue('en')

  // Escape closes it, and so does the button again, each time back on the button.
  await title.press('Escape')
  await expect(title).toBeHidden()
  await expect(duplicate).toBeFocused()
  await duplicate.click()
  await expect(title).toBeVisible()
  await duplicate.click()
  await expect(title).toBeHidden()
  await expect(duplicate).toHaveAttribute('aria-expanded', 'false')
  await expect(duplicate).toBeFocused()

  // A refusal is said under the form, and leaves the title as it was typed.
  await duplicate.click()
  await title.fill('   ')
  await write.click()
  await expect(page.getByRole('alert')).toHaveText('A Story needs a title.')
  await expect(title).toHaveValue('   ')
  await expect(page).toHaveURL(/\/stories$/)

  await title.fill('Un récit copié')
  await language.selectOption('fr')
  await write.click()

  await page.waitForURL(url => /^\/stories\/[0-9a-f-]{36}$/.test(url.pathname))
  const copyId = new URL(page.url()).pathname.split('/').at(-1)!
  expect(copyId).not.toBe(id)
  await expect(page.getByLabel('Title of this Story')).toHaveValue('Un récit copié')

  const copy = await read(request, copyId)
  expect(copy).toMatchObject({
    title: 'Un récit copié',
    language: 'fr',
    synopsis: original.synopsis,
    stepsBack: original.stepsBack,
    textFace: original.textFace,
    textAlign: original.textAlign,
    publishedAt: null,
    listed: false,
  })
  expect(original.publishedAt).not.toBeNull()
  expect(copy.scenes.map(scene => scene.name)).toEqual(original.scenes.map(scene => scene.name))
  expect(copy.scenes.map(scene => scene.shots.length))
    .toEqual(original.scenes.map(scene => scene.shots.length))
  expect(copy.scenes.map(scene => scene.sets)).toEqual(original.scenes.map(scene => scene.sets))
  expect(copy.scenes.map(scene => scene.shots.map(shot => shot.text)))
    .toEqual(original.scenes.map(scene => scene.shots.map(shot => shot.text)))
  expect(copy.exits.map(exit => exit.text)).toEqual(original.exits.map(exit => exit.text))

  // Every reference inside the copy names the copy's own rows.
  const own = idsOf(copy)
  const theirs = idsOf(original)
  expect(copy.openingSceneId).toBe(copy.scenes[0]!.id)
  expect(copy.coverShotId).toBe(copy.scenes[0]!.shots[0]!.id)
  expect(copy.scenes[2]!.soundOfSceneId).toBe(copy.scenes[0]!.id)
  for (const exit of copy.exits) {
    expect(own.has(exit.fromSceneId) && own.has(exit.toSceneId)).toBe(true)
  }
  const named = namedIn(copy)
  expect(named).toHaveLength(namedIn(original).length)
  expect(named.length).toBeGreaterThan(0)
  for (const named of namedIn(copy)) {
    expect(own.has(named)).toBe(true)
    expect(theirs.has(named)).toBe(false)
  }

  // The bytes came with it.
  const image = async (story: StoryInEditor) =>
    (await request.get(story.scenes[0]!.shots[0]!.image!)).body()
  expect((await image(copy)).equals(await image(original))).toBe(true)

  // The original is untouched, and the shelf holds the two of them.
  expect(await read(request, id)).toEqual(original)
  const shelf = await (await request.get('/api/stories')).json()
  expect(shelf.map((story: { id: string }) => story.id)).toEqual([copyId, id])
  await page.goto('/stories')
  await expect(page.getByRole('listitem').filter({ hasText: 'Un récit copié' }))
    .toContainText('Not published')

  // Deleting the original leaves the copy whole, its bytes with it.
  expect((await request.delete(`/api/stories/${id}`)).ok()).toBe(true)
  expect(await read(request, copyId)).toEqual(copy)
  expect((await request.get(copy.scenes[0]!.sound!)).ok()).toBe(true)
  expect((await request.get(copy.scenes[0]!.shots[0]!.image!)).ok()).toBe(true)
})

test('a Story is copied by its own Author alone, under a title and in a Language', async ({
  request,
  otherAuthor,
}) => {
  const theirs = await seedStory(otherAuthor, 'Their Story')
  const notMine = await request.post(`/api/stories/${theirs.id}/copy`, {
    data: { title: 'Mine now', language: 'en' },
  })
  expect(notMine.status()).toBe(404)

  const mine = await (await request.post('/api/stories', { data: { title: 'Mine' } })).json()
  const blank = await request.post(`/api/stories/${mine.id}/copy`, {
    data: { title: '  ', language: 'en' },
  })
  expect(blank.status()).toBe(400)
  expect((await blank.json()).message).toBe('A Story needs a title.')

  const elsewhere = await request.post(`/api/stories/${mine.id}/copy`, {
    data: { title: 'Mine again', language: 'xx' },
  })
  expect(elsewhere.status()).toBe(400)
  expect((await elsewhere.json()).message).toBe('A Story is written in one language.')

  // Nothing was written by any of them, and a Story with no Scene yet copies
  // into one with none.
  await expect((await request.get('/api/stories')).json()).resolves.toHaveLength(1)
  const empty = await request.post(`/api/stories/${mine.id}/copy`, {
    data: { title: 'Mine again', language: 'it' },
  })
  expect(empty.status()).toBe(201)
  const copied = await empty.json()
  expect(copied).toEqual({ id: expect.any(String), title: 'Mine again', language: 'it' })
  expect(await read(request, copied.id)).toMatchObject({ openingSceneId: null, scenes: [], exits: [] })
})
