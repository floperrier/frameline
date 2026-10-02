import { readFile } from 'node:fs/promises'
import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import type { Changes } from '../../shared/utils/changes'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { live, test, toast, writeShot, writeStory, type Author } from './author'

/**
 * The bench of a published Story says what differs between the Story as it is
 * written and Readers' Edition — issue #422. What differs is counted by Scene:
 * the Scenes the Edition does not have, the ones it has in another form, and how
 * many of its own the Story no longer has.
 */

/** The Story as its Author's bench reads it. */
async function onTheBench(request: APIRequestContext, id: string): Promise<StoryInEditor> {
  const answered = await request.get(`/api/stories/${id}`)
  expect(answered.status()).toBe(200)
  return answered.json()
}

async function publish(request: APIRequestContext, id: string) {
  expect((await request.post(`/api/stories/${id}/publish`)).status()).toBe(200)
}

const NOTHING: Changes = { story: false, added: [], changed: [], gone: 0 }

test('the bench\'s read says what differs from Readers\' Edition', async ({ request }) => {
  const story = await writeStory(request)
  const changes = async () => (await onTheBench(request, story.id)).changes

  // Never published, there is no Edition to differ from, and the bench is never
  // handed one.
  const unpublished = await onTheBench(request, story.id)
  expect(unpublished.changes).toBeNull()
  expect(unpublished).not.toHaveProperty('edition')
  const [street] = unpublished.scenes
  const shot = street!.shots[0]!

  await publish(request, story.id)
  expect(await changes()).toEqual(NOTHING)

  // Other words on a Shot are a change to its Scene, and the same words put back
  // are none.
  expect((await request.patch(`/api/shots/${shot.id}`, { data: { text: 'Something else.' } })).ok())
    .toBe(true)
  expect(await changes()).toEqual({ ...NOTHING, changed: [street!.id] })
  expect((await request.patch(`/api/shots/${shot.id}`, { data: { text: shot.text } })).ok())
    .toBe(true)
  expect(await changes()).toEqual(NOTHING)

  // A Scene written since is one the Edition does not have, until it is published.
  const platform = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The platform' },
  })).json()
  expect(await changes()).toEqual({ ...NOTHING, added: [platform.id] })
  await publish(request, story.id)
  expect(await changes()).toEqual(NOTHING)

  // Deleted, it is one of the Edition's the Story no longer has.
  expect((await request.delete(`/api/scenes/${platform.id}`)).ok()).toBe(true)
  expect(await changes()).toEqual({ ...NOTHING, gone: 1 })
})

/** The Sample, planted the way `sample-signed-in.spec.ts` plants it. */
async function plant(author: Author) {
  await plantSample(author.id, 'en', {
    db: drizzle(process.env.DATABASE_URL!, { schema }),
    image: name => readFile(imagePath(name)),
    sound: file => readFile(soundPath(file)),
  })
}

test('the bench marks each Scene of the Sample written since Readers\' Edition, and says so beside the link',
  async ({ page, request, author }) => {
    await plant(author)
    const [{ id }] = await (await request.get('/api/stories')).json()
    const [opening, second, third] = (await onTheBench(request, id)).scenes
    const marks = page.locator('.published-mark')
    const markOf = (sceneId: string) => page.locator(`#scene-${sceneId} .published-mark`)
    const line = page.locator('.live')
    const publishChanges = page.getByRole('button', { name: 'Publish the Changes' })

    // Before the first Publish the bench takes, the Story has no Edition to
    // differ from — it was planted through `plantSample` outside Nitro, so
    // without one — and no Scene is marked.
    await page.goto(`/stories/${id}`)
    await live(page)
    await expect(page.locator(`#scene-${opening!.id}`)).toBeVisible()
    await expect(marks).toHaveCount(0)

    // Published with its Images and Sounds, the Sample is read as it stands.
    await publish(request, id)
    await page.reload()
    await live(page)
    await expect(line).toContainText('Readers read this Story as it stands.')
    await expect(publishChanges).toHaveCount(0)
    await expect(marks).toHaveCount(0)

    // Other words typed on the second Scene's first Shot mark that Scene and no
    // other, as soon as they are kept.
    const box = page.locator(`#scene-${second!.id}`)
      .getByRole('textbox', { name: 'Shot 1 of What an Exit offers', exact: true })
    await writeShot(box, 'Somewhere else entirely.')
    await box.blur()
    await expect(markOf(second!.id)).toHaveText('Changed since published')
    await expect(marks).toHaveCount(1)
    await expect(line).toContainText('1 Scene changed since you published.')
    await expect(publishChanges).toBeVisible()

    // The same words typed back are no change.
    await writeShot(box, second!.shots[0]!.text)
    await box.blur()
    await expect(marks).toHaveCount(0)
    await expect(line).toContainText('Readers read this Story as it stands.')

    // Another Image on the first Shot that has one marks its Scene.
    const framed = opening!.shots.find(shot => shot.image)!
    expect((await request.put(`/api/shots/${framed.id}/image`, {
      data: await readFile(imagePath('an-image')),
    })).ok()).toBe(true)
    await page.reload()
    await live(page)
    await expect(markOf(opening!.id)).toHaveText('Changed since published')

    // A Scene written since is one Readers have not been given.
    const platform = await (await request.post(`/api/stories/${id}/scenes`, {
      data: { name: 'The platform' },
    })).json()
    await page.reload()
    await live(page)
    await expect(markOf(platform.id)).toHaveText('Not yet published')

    await publishChanges.click()
    await expect(toast(page)).toHaveText('Your changes are published: Readers read them from now on.')
    await expect(marks).toHaveCount(0)
    await expect(line).toContainText('Readers read this Story as it stands.')

    // A Scene Readers read, deleted, is counted on the line, having no section left
    // to be marked on.
    expect((await request.delete(`/api/scenes/${third!.id}`)).ok()).toBe(true)
    await page.reload()
    await live(page)
    await expect(line).toContainText('1 Scene Readers read is deleted.')
  })
