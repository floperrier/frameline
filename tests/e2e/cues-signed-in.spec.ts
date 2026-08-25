import { expect, type Locator, type Page } from '@playwright/test'
import { seedCut, seedScene, seedStory, test } from './author'

/** The sentence the first Cue says, which is how the guidance is recognised. */
const FIRST_CUE = /Every Story starts with a Scene/

/** The sentence said next, once the Story has the Scene the first asked for. */
const NEXT_CUE = /A node stays folded/

// The one spec the guidance is left switched on for; every other one waves it
// away, the way an Author who knows their way around the bench does.
test.use({ guided: true })

/** The bubble, whichever of its two placements it is in. */
function bubble(page: Page) {
  return page.getByRole('complementary', { name: 'Next' })
}

test('the bench asks a new Story for its first Scene', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  await page.goto(`/stories/${story.id}`)

  await expect(bubble(page)).toContainText(FIRST_CUE)

  // The light sits on the field itself, and does not cover it.
  const field = page.getByLabel('Name of a new Scene')
  expect(await page.locator('.spotlight').boundingBox()).toEqual(await field.boundingBox())

  // And follows it. The bench moves under the light for all sorts of reasons —
  // the graph scrolls, a node folds, the window changes shape — and the light is
  // on the target rather than where the target was.
  await page.setViewportSize({ width: 900, height: 700 })
  await expect
    .poll(() => page.locator('.spotlight').boundingBox())
    .toEqual(await field.boundingBox())

  // The very field being pointed at is still typed into, which is why none of
  // this is modal.
  await field.fill('The arrival')
  await page.getByRole('button', { name: 'Create Scene' }).click()

  // Met by the Author doing the thing, with nothing to confirm: the sentence is
  // the next one before the Scene has finished landing.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(bubble(page)).toContainText(NEXT_CUE)
})

test('the Cue is recomputed from the Story on every load', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')

  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toBeVisible()

  // Nothing was stored, so a reload with the Story still empty asks again.
  await page.reload()
  await expect(bubble(page)).toContainText(FIRST_CUE)

  // A Scene written from somewhere else entirely is a step met: the Story is what
  // is asked, and the answer moves on without the page being told anything.
  await seedScene(story, 'The arrival')
  await page.reload()
  await expect(bubble(page)).toContainText(/branches between Scenes/)
})

test('a Story that is past every step is guided not at all', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  const arrival = await seedScene(story, 'The arrival')
  const platform = await seedScene(story, 'The platform')
  await seedCut(arrival.id, platform.id)

  await page.goto(`/stories/${story.id}`)

  // Every node folded, and nothing is asked of them: a node is opened for the
  // sake of what is written in it, and this Story is already written. This is
  // what an Author finds when they open a Leader.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(bubble(page)).toBeHidden()
  await expect(page.locator('.spotlight')).toBeHidden()
})

test('an Author who knows what they are doing waves the guidance away', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  await page.goto(`/stories/${story.id}`)

  await bubble(page).getByRole('button', { name: 'I can take it from here' }).click()
  await expect(bubble(page)).toBeHidden()

  // Dismissal is the one thing about the guidance that is stored anywhere, and
  // it outlives the page it was made on.
  await page.reload()
  await expect(page.getByText('No Scenes yet.')).toBeVisible()
  await expect(bubble(page)).toBeHidden()
})

/**
 * The path from a Story with nothing in it to two Scenes joined by a Cut, walked
 * as one spec rather than one per step: what the guidance is is the order the
 * steps come in, and a spec per step would never have crossed from one to the
 * next.
 *
 * A tall bench, because the second Scene is stacked under the first and the Cut
 * between them is drawn by hand across both nodes.
 */
test('the bench walks an Author from a bare Story to two Scenes and a Cut', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto(`/stories/${story.id}`)

  // Named, and the light is on the field it is named in.
  await lights(page, page.getByLabel('Name of a new Scene'))
  await page.getByLabel('Name of a new Scene').fill('The arrival')
  await page.getByRole('button', { name: 'Create Scene' }).click()

  // Opened. The guidance asks for the node rather than unfolding it itself, and
  // nothing inside the Scene is pointed at until the Author has done so.
  await expect(bubble(page)).toContainText(/A node stays folded/)
  const fold = page.getByRole('button', { name: 'Open Scene The arrival' })
  await lights(page, fold)
  await fold.click()

  // Written. The sentence carries the whole gesture — a Shot is added and then
  // written — so it is said from the corner until there is a field to say it at.
  await expect(bubble(page)).toContainText(/A Shot is one beat/)
  await expect(bubble(page)).toHaveClass(/adrift/)
  await page.getByRole('button', { name: 'Add Shot' }).click()
  const shot = page.getByRole('textbox', { name: 'Shot 1' })
  await lights(page, shot)
  await shot.fill('She steps off the train.')
  await shot.blur()

  // A second Scene, asked for in the field the first was named in.
  await expect(bubble(page)).toContainText(/branches between Scenes/)
  await lights(page, page.getByLabel('Name of a new Scene'))
  await page.getByLabel('Name of a new Scene').fill('The platform')
  await page.getByRole('button', { name: 'Create Scene' }).click()

  // And the Cut, drawn from the strip the light is now on.
  await expect(bubble(page)).toContainText(/A Cut is the way on/)
  const arrival = page.getByRole('article', { name: 'The arrival' })
  await lights(page, arrival.locator('.strip'))
  await drag(page, arrival.locator('.strip'), page.getByRole('article', { name: 'The platform' }))

  await expect(page.getByRole('status')).toHaveText('Cut from The arrival to The platform drawn')
  await expect(bubble(page)).toBeHidden()
  await expect(page.locator('.spotlight')).toBeHidden()
})

/** That the light is on this control, and on nothing else. */
async function lights(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  await expect.poll(() => page.locator('.spotlight').boundingBox())
    .toEqual(await target.boundingBox())
}

/** A Cut drawn by hand, from a node's strip onto the node it lands on. */
async function drag(page: Page, from: Locator, onto: Locator) {
  const strip = (await from.boundingBox())!
  const node = (await onto.boundingBox())!
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2)
  await page.mouse.down()
  await page.mouse.move(node.x + node.width / 2, node.y + node.height / 2, { steps: 5 })
  await page.mouse.up()
}
