import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { SAMPLES, imagePath } from '../../demonstration/samples'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import { test, type Author } from './author'

/**
 * What an Author finds in an account that was just created. Planting is called
 * here exactly as production calls it — the same function, over the same
 * committed images — with the database and the images handed in, because this
 * process is not nitro and has neither auto-import.
 *
 * What no test here covers is *when* planting fires: that a Sample is planted on
 * account creation and never again lives in `signInAuthor`, and the end-to-end
 * suite bypasses sign-in by construction — it seeds the Author and seals the
 * session cookie itself, because driving GitHub's or Google's login page from a
 * test is not something we can do. An accepted gap, stated rather than hidden.
 */
async function plant(author: Author, language: string) {
  await plantSample(author.id, language, {
    db: drizzle(process.env.DATABASE_URL!, { schema }),
    image: name => readFile(imagePath(name)),
  })
}

test('a new account arrives with a Sample in it', async ({ page, request, author }) => {
  await plant(author, 'en')

  // Exactly one Story, and it is the Sample.
  const listed = await (await request.get('/api/stories')).json()
  expect(listed).toEqual([{ id: expect.any(String), title: SAMPLES.en.title }])

  await page.goto('/stories')
  await page.getByRole('link', { name: `Open ${SAMPLES.en.title}` }).click()

  // The whole work is there: its three Scenes, the Flags one of them sets, and
  // the Conditions its Shots play under.
  const story = await (await request.get(`/api/stories/${listed[0].id}`)).json()
  expect(story.scenes.map((scene: { name: string }) => scene.name))
    .toEqual(SAMPLES.en.scenes.map(scene => scene.name))
  expect(story.openingSceneId).toBe(story.scenes[0].id)
  expect(story.publishedAt).not.toBeNull()
  expect(story.cuts).toHaveLength(SAMPLES.en.cuts.length)
  expect(story.scenes[1].sets).toEqual(SAMPLES.en.scenes[1]!.sets)
  expect(story.scenes.flatMap((scene: { shots: { conditions: unknown[] }[] }) =>
    scene.shots.flatMap(shot => shot.conditions)).length).toBeGreaterThan(0)

  // A Shot is an Image and its text, so the bytes committed beside the work have
  // to have arrived as an image a browser will take.
  const image = await request.get(story.scenes[0].shots[0].image)
  expect(image.headers()['content-type']).toBe('image/webp')

  // And it is published, so it reads at its public link the way it previews.
  await page.goto(`/read/${story.id}`)
  await expect(page.getByText(SAMPLES.en.scenes[0]!.shots[0]!.text)).toBeVisible()
})

test('the Sample planted is the one written in the Locale', async ({ request, author }) => {
  await plant(author, 'fr')

  await expect((await request.get('/api/stories')).json())
    .resolves.toEqual([{ id: expect.any(String), title: SAMPLES.fr.title }])
})

test('a Locale no Sample is written in is given none', async ({ request, author }) => {
  await plant(author, 'de')

  await expect((await request.get('/api/stories')).json()).resolves.toEqual([])
})

test('the Sample is the Author’s, like any other Story', async ({ page, request, author }) => {
  await plant(author, 'en')

  const [sample] = await (await request.get('/api/stories')).json()

  const renamed = await request.patch(`/api/stories/${sample.id}`, { data: { title: 'Mine now' } })
  expect(await renamed.json()).toEqual({ id: sample.id, title: 'Mine now' })

  expect((await request.delete(`/api/stories/${sample.id}`)).status()).toBe(200)

  // Deleting means deleting: nothing puts a Sample back.
  await page.goto('/stories')
  await expect(page.getByText('No Stories yet.')).toBeVisible()
})
