import { expect, type Locator, type Page } from '@playwright/test'
import { NODE_GAP, NODE_WIDTH } from '../../shared/utils/scenes'
import {
  writeScene,
  readShots,
  seedCut,
  seedFlags,
  seedPublication,
  seedScene,
  seedScenes,
  seedShotConditions,
  seedStory,
  test,
} from './author'

/** The sentence the first Cue says, which is how the guidance is recognised. */
const FIRST_CUE = /Every Story starts with a Scene/

/** The sentence said next, once the Story has the Scene the first asked for. */
const NEXT_CUE = /A Scene is written in the panel/

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
  // the graph scrolls, the panel opens beside it, the window changes shape — and
  // the light is on the target rather than where the target was.
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
  await seedFlags(arrival.id, { courage: 'high' })
  // The Condition names the value the Flag holds, which is the step the Preview
  // teaches, and the Story is out at its link, which is the last one.
  await seedShotConditions(platform.shots[0]!.id, [{ flag: 'courage', is: 'high' }])
  await seedPublication(story)

  await page.goto(`/stories/${story.id}`)

  // Nothing in the panel, and nothing asked for: the panel is opened for the sake
  // of what is written in it, and this Story is already written. This is what an
  // Author finds when they open a Leader.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(bubble(page)).toBeHidden()
  await expect(page.locator('.spotlight')).toBeHidden()
})

/**
 * A Story is allowed to sit with no opening Scene — the Author decides where
 * their Story starts — and the only way to arrive there is to delete the Scene it
 * opened on. The guidance has to follow: the last step is a Publish that would
 * refuse, and what is left to do is the mark in the panel.
 */
test('an Author who deleted the Scene their Story opened on is sent to the mark', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  const [arrival, platform, bar] = await seedScenes(
    story, ['The arrival', 'The platform', 'The bar'])
  await seedCut(platform!.id, bar!.id)

  // The Flag and the Condition go on every Scene, so that the Story is past both
  // of those steps whichever Scene the deletion leaves second. What the deletion
  // takes away is the opening Scene and nothing else: the Cut it leaves behind
  // joins the two Scenes that outlive it.
  for (const scene of [arrival, platform, bar]) {
    await seedFlags(scene!.id, { courage: 'high' })
    const [shot] = await readShots(scene!.id)
    await seedShotConditions(shot!.id, [{ flag: 'courage', is: 'high' }])
  }
  await page.request.post(`/api/scenes/${arrival!.id}/opening`)

  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toContainText(/That is a Story that works/)

  // The Scene the Story opens on goes, and the Story is left with nowhere for a
  // Reading to start.
  await writeScene(page, 'The arrival')
  await page.getByRole('button', { name: 'Delete Scene The arrival' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete Scene', exact: true }).click()

  // The bench stops asking for the Publish, which would refuse, and asks for the
  // mark instead — from the corner while the panel is closed, because the mark is
  // set in the panel.
  await expect(bubble(page)).toContainText(/nothing marks where this Story does/)
  await expect(bubble(page)).toHaveClass(/adrift/)

  await writeScene(page, 'The platform')
  await lights(page, page.locator('.panel .opening'))
  await page.getByRole('radio', { name: 'Opening Scene The platform' }).check()

  // Marked, and the path is back at the step it was on.
  await expect(bubble(page)).toContainText(/That is a Story that works/)
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
 * The whole path, from a Story with nothing in it to a link anybody can read,
 * walked as one spec rather than one per step: what the guidance is is the order
 * the steps come in, and a spec per step would never have crossed from one to the
 * next.
 *
 * A tall bench, because the second Scene is stacked under the first and the Cut
 * between them is drawn by hand across both cards.
 */
test('the bench walks an Author from a bare Story to a published one', async ({
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

  // Written. The guidance asks for the panel rather than opening it itself, and
  // nothing inside the Scene is pointed at until the Author has done so.
  await expect(bubble(page)).toContainText(NEXT_CUE)
  const write = page.getByRole('button', { name: 'Write Scene The arrival' })
  await lights(page, write)
  await write.click()

  // Written. The sentence carries the whole gesture — a Shot is added and then
  // written — so it is said from the corner until there is a field to say it at.
  await expect(bubble(page)).toContainText(/A Shot is a Still and its text/)
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

  // And the Cut, drawn from the strip the light is now on. The second Scene is
  // laid out beside the first before the hand goes down: the API stacks a new
  // Scene under the last, the bubble pointing at the strip is drawn over the
  // bench just below it, and a hand cannot let go through the guidance.
  await expect(bubble(page)).toContainText(/A Cut is the way on/)
  const read = await (await page.request.get(`/api/stories/${story.id}`)).json()
  const beside = read.scenes.find((scene: { name: string }) => scene.name === 'The platform')
  await page.request.patch(`/api/scenes/${beside.id}`, {
    data: { x: NODE_WIDTH + NODE_GAP, y: 0 },
  })
  await page.reload()

  const arrival = page.getByRole('article', { name: 'The arrival' })
  await lights(page, arrival.locator('.strip'))
  await drag(page, arrival.locator('.strip'), page.getByRole('article', { name: 'The platform' }))

  await expect(page.getByRole('status')).toHaveText('Cut from The arrival to The platform drawn')

  // A Flag on the first Scene, in the field the light moves to once the Scene is
  // back in the panel.
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  await writeScene(page, 'The arrival')
  const flags = page.getByLabel('Flags set on entering The arrival')
  await lights(page, flags)
  await flags.fill('courage = high')
  await flags.blur()

  // And a Condition on the second Scene, which has no Shot in it yet: the
  // sentence carries that whole gesture, because the Cue names the Conditions of
  // the Shot in the panel and the panel holds whichever Scene the Author put
  // there.
  await expect(bubble(page)).toContainText(/A Condition makes the same Scene play differently/)
  await writeScene(page, 'The platform')
  await page.getByRole('button', { name: 'Add Shot to The platform' }).click()

  // The light is on the Conditions of the Shot in the panel, which is the one the
  // sentence just asked for.
  const carrier = 'Shot 1 of The platform'
  await lights(page, page.locator('.panel .conditions').first())
  await page.getByRole('button', { name: `Add a Condition to ${carrier}` }).click()

  // Written against a value the Flag does not hold, which is what the sentence
  // asked for and what gives the Preview something to explain.
  await page.getByLabel(`Flag of Condition 1 of ${carrier}`).fill('courage')
  const holds = page.getByLabel(`holds for Condition 1 of ${carrier}`)
  await holds.fill('low')
  await holds.blur()

  // The Preview, which is where the Condition stops being an idea about State
  // and becomes a Shot that does not play.
  await expect(bubble(page)).toContainText(/Nothing plays that Shot/)
  await lights(page, page.getByRole('link', { name: 'Preview this Story' }))
  await page.getByRole('link', { name: 'Preview this Story' }).click()

  // Taken to the second Scene, where the bench names the Shot the Reading left
  // out and both sides of the test it failed.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Cut to The platform' }).click()
  const bench = page.getByRole('region', { name: /On the bench/ })
  await expect(bench.getByText('needs courage to hold low, holds high')).toBeVisible()

  // Back to the bench and corrected, which is all the step ever asked of the
  // Story: nowhere is it written that the Preview was opened. The panel is closed
  // again, because what is in it is how the Author is looking at the work and does
  // not survive leaving the page.
  await page.getByRole('link', { name: 'Back to the Story' }).click()
  await lights(page, page.getByRole('link', { name: 'Preview this Story' }))
  await expect(page.locator('.panel')).toHaveCount(0)
  await writeScene(page, 'The platform')
  await holds.fill('high')
  await holds.blur()

  // And the reward: a Story that works, out at a link anybody can read.
  await expect(bubble(page)).toContainText(/That is a Story that works/)
  const publish = page.getByRole('button', { name: 'Publish this Story' })
  await lights(page, publish)
  await publish.click()

  await expect(page.getByRole('link', { name: new RegExp(`/read/${story.id}$`) })).toBeVisible()
  await expect(bubble(page)).toBeHidden()
  await expect(page.locator('.spotlight')).toBeHidden()
})

/** That the light is on this control, and on nothing else. */
async function lights(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  // The target is read until it holds still before it is read for the comparison,
  // because the bench moves under it — the panel opens beside it, the graph is
  // pulled back — and a rectangle read while it is still on its way would be held
  // against a light that has already arrived.
  let last: string | undefined
  await expect.poll(async () => {
    const seen = JSON.stringify(await target.boundingBox())
    const held = seen === last
    last = seen

    return held
  }).toBe(true)

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

/**
 * The light is on a rectangle read off the page a frame at a time, so a bench
 * drawn at three quarters of its size, or pushed across the screen under the
 * hand, is a target that has moved like any other. Proved on the step whose
 * target is on the surface itself — the strip a Cut is drawn from — because that
 * is the only kind of target the scale touches at all.
 */
test('the light follows its target through a zoom and a push', async ({
  page,
  author,
  request,
}) => {
  const story = await seedStory(author, 'A Story')
  await seedScenes(story, ['The arrival', 'The platform'])
  // Laid out far apart, so the bench has somewhere to be pushed to and something
  // to be pulled back from — and read back in the order the graph draws them,
  // because the light is on the first card of it and the seed does not promise
  // which Scene that is.
  const read = await (await request.get(`/api/stories/${story.id}`)).json()
  await request.patch(`/api/scenes/${read.scenes[0].id}`, { data: { x: 600, y: 300 } })
  await request.patch(`/api/scenes/${read.scenes[1].id}`, { data: { x: 2400, y: 1400 } })
  await page.goto(`/stories/${story.id}`)

  const strip = page.locator('[data-cue="draw-cut"]').first()
  await expect(bubble(page)).toContainText(/A Cut is the way on/)
  await lights(page, strip)

  // Asked for with no motion, so the step arrives rather than travels: what is
  // held against the light is where the strip ends up, never a frame of it on the
  // way there.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Pull back from the graph' }).click()
  // Once the bench says how far back it is standing, it is standing there: the
  // reading and the scale are written in the one render.
  await expect(page.locator('.zooming .level')).toContainText('75%')
  await lights(page, strip)

  const box = (await page.locator('.graph').boundingBox())!
  await page.mouse.move(box.x + box.width - 60, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 160, box.y + 240, { steps: 5 })
  await page.mouse.up()
  await lights(page, strip)
})
