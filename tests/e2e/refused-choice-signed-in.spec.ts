import { neon } from '@neondatabase/serverless'
import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { live, test, writeStory } from './author'

/**
 * A choice the server refuses does not stay on screen. The bench lays the Story it
 * reads back over the one it holds, so that whatever an act did not change keeps
 * its object; a choice sent without being written into that Story first leaves the
 * read equal to what is held, and laid over, nothing would put the control back.
 * After a refusal the read is put in place whole instead — see
 * `docs/adr/0008-refetch-is-for-a-refusal.md` and issue #479. Each control is held
 * to what the database says, read past the API, rather than to what it showed
 * before the choice.
 */

const sql = neon(process.env.DATABASE_URL!)

/** What the server answers once, in the place of the request it was asked to refuse. */
const REFUSED = 'Not that one.'

/** The sentence a refusal is said in. There is one on the bench at a time. */
function refusal(page: Page) {
  return page.getByRole('alert')
}

function readTheStory(request: APIRequestContext, id: string) {
  return request.get(`/api/stories/${id}`).then(read => read.json() as Promise<StoryInEditor>)
}

/** `writeStory`, with a third Scene for its Exit to be led to, opened on the bench. */
async function benchWithThreeScenes(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The yard' } })
  const { scenes, exits } = await readTheStory(request, story.id)

  await page.goto(`/stories/${story.id}`)
  await live(page)

  const sceneNamed = (name: string) => scenes.find(scene => scene.name === name)!
  return {
    story,
    street: sceneNamed('The street'),
    bar: sceneNamed('The bar'),
    yard: sceneNamed('The yard'),
    exit: exits[0]!,
  }
}

/** Refuses the next request of `method` to `url` with a 400, and lets every other one through. */
async function refuseOnce(page: Page, url: string, method: string) {
  let refused = false
  await page.route(url, async (route) => {
    if (refused || route.request().method() !== method) return route.continue()
    refused = true
    await route.fulfill({ status: 400, json: { message: REFUSED } })
  })
}

test('the Scene an Exit is led to goes back to the one it leads to when the server refuses it',
  async ({ page, request }) => {
    const { bar, yard, exit } = await benchWithThreeScenes(page, request)
    const leads = page.locator(`#leads-${exit.id}`)
    await expect(leads).toHaveValue(bar.id)

    await refuseOnce(page, `**/api/exits/${exit.id}/scene`, 'PUT')
    await leads.selectOption(yard.id)

    await expect(refusal(page)).toContainText(REFUSED)
    const [held] = await sql`select to_scene_id from exits where id = ${exit.id}`
    expect(held!.to_scene_id).toBe(bar.id)
    await expect(leads).toHaveValue(held!.to_scene_id)

    // And a choice the server keeps is still kept, and still shown.
    await leads.selectOption(yard.id)
    await expect.poll(async () =>
      (await sql`select to_scene_id from exits where id = ${exit.id}`)[0]!.to_scene_id).toBe(yard.id)
    await expect(leads).toHaveValue(yard.id)
  })

test('the face the text is set in goes back to the one the Story holds when the server refuses it',
  async ({ page, request }) => {
    const { story } = await benchWithThreeScenes(page, request)
    await page.getByText('How it is read').click()
    const face = page.locator('#story-text-face')
    await expect(face).toHaveValue('prose')

    await refuseOnce(page, `**/api/stories/${story.id}`, 'PATCH')
    await face.selectOption('typewriter')

    await expect(refusal(page)).toContainText(REFUSED)
    const [held] = await sql`select text_face from stories where id = ${story.id}`
    expect(held!.text_face).toBe('prose')
    await expect(face).toHaveValue(held!.text_face)
  })

test('stepping back goes back to what the Story offers when the server refuses it',
  async ({ page, request }) => {
    const { story } = await benchWithThreeScenes(page, request)
    await page.getByText('How it is read').click()
    const stepping = page.locator('#story-steps-back')
    await expect(stepping).toHaveValue('yes')

    await refuseOnce(page, `**/api/stories/${story.id}`, 'PATCH')
    await stepping.selectOption('no')

    await expect(refusal(page)).toContainText(REFUSED)
    const [held] = await sql`select steps_back from stories where id = ${story.id}`
    expect(held!.steps_back).toBe(true)
    await expect(stepping).toHaveValue(held!.steps_back ? 'yes' : 'no')
  })

/**
 * Two acts whose reads cross on the way back, the newer of them failing. The older
 * came back, and it is what the bench shows: a read that fails drops nothing, where
 * on #471 the older answer was thrown away for being overtaken and the bench stayed
 * as it was before either act, without a word.
 */
test('a read that came back is kept when a newer one fails', async ({ page, request }) => {
  const { story, street, bar } = await benchWithThreeScenes(page, request)

  let reads = 0
  let overtaken = () => {}
  const failed = new Promise<void>(done => (overtaken = done))
  await page.route(`**/api/stories/${story.id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    reads++
    if (reads === 1) {
      // Read now, so the answer holds the first act and not the second, and held
      // until the second read has failed.
      const response = await route.fetch()
      await failed
      return route.fulfill({ response })
    }
    // Every read after it fails, the one `$fetch` sends again on a 503 as well.
    await route.fulfill({ status: 503, json: { message: 'The Story could not be read.' } })
    overtaken()
  })

  const shotsOf = (scene: string) => page.getByRole('textbox', { name: new RegExp(`^Shot \\d+ of ${scene}$`) })
  await expect(shotsOf('The bar')).toHaveCount(1)
  await expect(shotsOf('The street')).toHaveCount(2)

  await page.locator(`.writing [data-scene="${bar.id}"]`).getByRole('button', { name: /^Add a Shot/ }).click()
  await expect.poll(() => reads).toBe(1)
  await page.locator(`.writing [data-scene="${street.id}"]`).getByRole('button', { name: /^Add a Shot/ }).click()

  // The first act's read lands: the bar has the Shot it added. The second act's
  // never came back, so its Shot is not on the bench yet, and nothing is said,
  // because the bench does show a Story the server held.
  await expect(shotsOf('The bar')).toHaveCount(2)
  await expect(shotsOf('The street')).toHaveCount(2)
  await expect(refusal(page)).toHaveCount(0)
})

/** Where no read comes back at all, the Author is told, and the bench keeps what it showed. */
test('a read that fails is said beside the bench', async ({ page, request }) => {
  const { story, bar } = await benchWithThreeScenes(page, request)
  const said = 'The Story could not be read.'

  // Every read fails, the one `$fetch` sends again on a 503 as well.
  await page.route(`**/api/stories/${story.id}`, route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, json: { message: said } })
    : route.continue())

  await page.locator(`.writing [data-scene="${bar.id}"]`).getByRole('button', { name: /^Add a Shot/ }).click()

  await expect(refusal(page)).toContainText(said)
  await expect(page.getByRole('textbox', { name: 'Shot 1 of The bar', exact: true })).toBeVisible()
  const shots = await sql`select id from shots where scene_id = ${bar.id}`
  expect(shots).toHaveLength(2)
})
