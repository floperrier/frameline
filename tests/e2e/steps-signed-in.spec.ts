import { expect, type Locator, type Page } from '@playwright/test'
import {
  writeScene,
  readShotConditions,
  readShots,
  seedExit,
  seedFlags,
  seedPublication,
  seedScene,
  seedScenes,
  seedShotConditions,
  seedStory,
  test,
  toast,
} from './author'

/** The sentence the first Step says, which is how the guidance is recognised. */
const FIRST_STEP = /Every Story starts with a Scene/

/**
 * The sentence said next, once the Story has the Scene the first asked for. The
 * gesture that makes a Scene opens it for writing as well, so nothing is asked
 * about the writing surface and what is asked for next is a Shot.
 */
const NEXT_STEP = /A Shot is an Image and its text/

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

  await expect(bubble(page)).toContainText(FIRST_STEP)

  // The light sits on the control itself, and does not cover it.
  const field = page.getByRole('button', { name: 'Write the First Scene' })
  expect(await page.locator('.spotlight').boundingBox()).toEqual(await field.boundingBox())

  // And follows it. The bench moves under the light for all sorts of reasons —
  // the graph scrolls, the panel opens beside it, the window changes shape — and
  // the light is on the target rather than where the target was.
  await page.setViewportSize({ width: 900, height: 700 })
  await expect
    .poll(() => page.locator('.spotlight').boundingBox())
    .toEqual(await field.boundingBox())

  // The very control being pointed at is still pressed, which is why none of
  // this is modal.
  await field.click()

  // Met by the Author doing the thing, with nothing to confirm: the sentence is
  // the next one before the Scene has finished landing. It arrives under a
  // provisional name, which the panel the same gesture opened is where the Author
  // corrects.
  await expect(page.getByRole('article', { name: 'A new Scene' })).toHaveCount(1)
  await expect(bubble(page)).toContainText(NEXT_STEP)
})

test('the Step is recomputed from the Story on every load', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')

  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toBeVisible()

  // Nothing was stored, so a reload with the Story still empty asks again.
  await page.reload()
  await expect(bubble(page)).toContainText(FIRST_STEP)

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
  await seedExit(arrival.id, platform.id)
  await seedFlags(arrival.id, { courage: 'high' })
  // The Condition names the value the Flag holds, which is the step the Preview
  // teaches, and the Story is out at its link, which is the last one.
  await seedShotConditions(platform.shots[0]!.id, [{ flag: 'courage', is: 'high' }])
  await seedPublication(story)

  await page.goto(`/stories/${story.id}`)

  // Nothing in the panel, and nothing asked for: the panel is opened for the sake
  // of what is written in it, and this Story is already written. This is what an
  // Author finds when they open a Sample.
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
  await seedExit(platform!.id, bar!.id)

  // The Flag and the Condition go on every Scene, so that the Story is past both
  // of those steps whichever Scene the deletion leaves second. What the deletion
  // takes away is the opening Scene and nothing else: the Exit it leaves behind
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
 * A tall bench, because the path is walked in the Scene's own document and the
 * way on it asks for is at the foot of it, under everything written above.
 */
test('the bench walks an Author from a bare Story to a published one', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto(`/stories/${story.id}`)

  // Made, and the light is on the one control that makes a Scene out of nothing.
  // It opens the panel on the Scene it wrote, with the provisional name selected,
  // so the Author names it there and is asked for what goes in it rather than for
  // the surface they are already looking at.
  await lights(page, page.getByRole('button', { name: 'Write the First Scene' }))
  await page.getByRole('button', { name: 'Write the First Scene' }).click()
  const named = page.getByLabel('Name of this Scene')
  await expect(named).toBeFocused()
  await page.keyboard.type('The arrival')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('article', { name: 'The arrival' })).toHaveCount(1)

  // Written. The sentence carries the whole gesture — a Shot is added and then
  // written — so it is said from the corner until there is a field to say it at.
  await expect(bubble(page)).toContainText(NEXT_STEP)
  await expect(bubble(page)).toHaveClass(/adrift/)
  await page.getByRole('button', { name: 'Add a Shot' }).click()
  const shot = page.getByRole('textbox', { name: 'Shot 1' })
  await lights(page, shot)
  await shot.fill('She steps off the train.')
  await shot.blur()

  // The second Scene and the Exit to it, which are one act and so one Step:
  // written at the foot of the Scene the Author is already writing in, where the
  // light is. Nothing is closed and nothing is switched to first — the Step
  // before this one left them in this document, and what it points at answers a
  // press from where they stand. The canvas would not: it is folded into a rail
  // while a Scene is open, and the gesture the sentence names as the other route
  // is not offered there.
  await expect(bubble(page)).toContainText(/branches between Scenes/)
  await lights(page, page.locator('.panel .adding'))
  await page
    .getByLabel('An Exit from here')
    .selectOption({ label: 'To a Scene that is not there yet' })

  await expect(toast(page)).toHaveText('Exit from The arrival to A new Scene drawn')

  // Born beside the Scene it leaves, already joined, and named in the panel the
  // same act moved on to.
  await expect(page.getByLabel('Name of this Scene')).toBeFocused()
  await page.keyboard.type('The platform')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveCount(1)
  const read = await (await page.request.get(`/api/stories/${story.id}`)).json()
  const beside = read.scenes.find((scene: { name: string }) => scene.name === 'The platform')

  // A Flag on the first Scene, in the list the light moves to once the Scene is
  // back in the panel. The light is on the whole list rather than on a field of
  // it, because a Flag is the row it is added as.
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  await writeScene(page, 'The arrival')
  // The Flags stand behind a tab, so the Author presses it before the light has a
  // rectangle to sit on. The path itself gained no Step naming the tab — the
  // sentence is the same one either way, and until the tab is pressed the bubble
  // carries it adrift rather than pointing at nothing.
  await lights(page, page.locator('.panel .flags'))
  await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
  await page.getByLabel('Name of Flag 1 set on entering The arrival').fill('courage')
  const value = page.getByLabel('Value 1 of Flag 1 set on entering The arrival')
  await value.fill('high')
  await value.blur()

  // And a Condition on the second Scene, which has no Shot in it yet: the
  // sentence carries that whole gesture, because the Step names the Conditions of
  // the Shot in the panel and the panel holds whichever Scene the Author put
  // there.
  await expect(bubble(page)).toContainText(/A Condition makes the same Scene play differently/)
  await writeScene(page, 'The platform')
  await page.getByRole('button', { name: 'Add a Shot to The platform' }).click()

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

  // The Preview, which is where the Condition stops being an idea about State and
  // becomes a Shot that does not play — and which is already on screen, beside
  // the Scene being written, so the Step points at it rather than sending the
  // Author anywhere. The Condition is read back out of the Story first: the write
  // goes when the field is left, and a light that arrived before it would be over
  // a reading of a Story that had not been written yet.
  await expect.poll(() => readShotConditions(beside.id))
    .toEqual([[{ flag: 'courage', is: 'low' }]])
  await expect(bubble(page)).toContainText(/Nothing plays that Shot/)
  const preview = page.getByRole('region', { name: /^Preview/ })
  await lights(page, preview)

  // The reading is replayed to the Scene being written, and its bench names the
  // Shot the Reading left out and both sides of the test it failed.
  const bench = page.getByRole('region', { name: /On the bench/ })
  await expect(bench.getByText('needs courage to hold low, holds high')).toBeVisible()

  // Corrected where it was written, which is all the Step ever asked of the
  // Story: nowhere is it written that the Preview was read.
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

/**
 * The light is on a rectangle read off the page a frame at a time, so a target
 * carried up the panel by the document growing under it is a target that has
 * moved like any other. Proved on the step whose target is at the foot of the
 * Scene's document — the way on written from here — because everything written
 * above it pushes it.
 */
test('the light follows its target as the document grows above it', async ({
  page,
  author,
}) => {
  // A Scene with something written in it, which is the Story the way on is asked
  // of: a seeded Scene arrives with a Shot in it, the way an Author's does.
  const story = await seedStory(author, 'A Story')
  await seedScene(story, 'The arrival')
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')

  const adding = page.locator('.panel .adding')
  await expect(bubble(page)).toContainText(/An Exit is the way on/)
  await lights(page, adding)

  // Asked for with no motion, so the step arrives rather than travels: what is
  // held against the light is where the line ends up, never a frame of it on the
  // way there.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Add a Shot to The arrival' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
  await lights(page, adding)

  // And the panel narrowing under a window that changed shape, which moves the
  // line the other way.
  await page.setViewportSize({ width: 900, height: 700 })
  await lights(page, adding)
})

/**
 * The guidance and the surface that covers the bench. Below 44rem the writing
 * surface is the whole window, and everything it covers is `inert` — which is
 * precisely why the panel is not a `<dialog>` there: the spotlight and the
 * bubble are drawn over the bench rather than in the top layer, and a modal
 * surface would put the very field being pointed at on the far side of them.
 *
 * So the guidance still reaches into the surface, and stops pointing at what the
 * surface covers: a light on a control the Author cannot press is guidance being
 * wrong about the screen.
 */
test('the guidance reaches the surface that covers the bench, and nothing behind it', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  // One statement apiece, because the second Scene has to be the second one the
  // bench reads back: the Condition the path teaches is asked of that Scene, and
  // two Scenes written in one insert share a moment and are ordered by their ids.
  const arrival = await seedScene(story, 'The arrival')
  const platform = await seedScene(story, 'The platform')
  await seedExit(arrival.id, platform.id)

  // Opened at the address the writing carries, because the card that opens it is
  // behind a header that stays on screen at a phone's width — a press on a Scene
  // at this width is the graph's spec and not this one's.
  await page.setViewportSize({ width: 600, height: 800 })
  await page.goto(`/stories/${story.id}?scene=${arrival.id}`)
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // What is asked for is a Flag, which is set in the panel: the light is on the
  // section of the Scene's own document, over the surface covering the bench.
  await expect(bubble(page)).toContainText(/State is what one Reading carries with it/)
  await lights(page, page.locator('[data-step="scene-flags"]'))

  // And the bubble carrying the sentence is on top of the surface rather than
  // under it, which is the whole of what the top layer would have cost.
  expect(await page.evaluate(() => {
    const said = document.querySelector('.bubble')!.getBoundingClientRect()
    const over = document.elementFromPoint(said.x + said.width / 2, said.y + said.height / 2)

    return said.width > 0 && !!over?.closest('.bubble')
  })).toBe(true)

  // A Flag set, and what is asked for next is a Condition — also in the panel.
  await seedFlags(arrival.id, { courage: 'high' })
  await page.reload()
  await expect(bubble(page)).toContainText(/A Condition makes the same Scene play differently/)

  // The Story is past both of those, and what is left to point at is behind the
  // surface: the Publish in the header the panel covers. Nothing is lit, because
  // nothing there can be pressed, and the sentence is said adrift instead.
  await seedShotConditions(platform.shots[0]!.id, [{ flag: 'courage', is: 'high' }])
  await page.request.post(`/api/scenes/${arrival.id}/opening`)
  await page.reload()
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()
  await expect(bubble(page)).toContainText(/That is a Story that works/)
  await expect(bubble(page)).toHaveClass(/adrift/)
  await expect(page.locator('.spotlight')).toHaveCount(0)

  // Closed, the Publish is reachable again and the light goes back onto it.
  await page.getByRole('button', { name: 'Close this Panel' }).click()
  await lights(page, page.getByRole('button', { name: 'Publish this Story' }))
})
