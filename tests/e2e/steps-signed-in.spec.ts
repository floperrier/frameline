import { expect, type Locator, type Page } from '@playwright/test'
import {
  writeScene,
  readShotConditions,
  readShots,
  readTheStory,
  seedChain,
  seedExit,
  seedFlags,
  seedPublication,
  sceneNode,
  seedScene,
  seedScenes,
  seedShotConditions,
  seedStory,
  test,
  toast,
} from './author'

/** One Scene's own section of the document, which is where that Scene is written. */
function written(page: Page, scene: string) {
  return page.getByRole('group', { name: `Writing ${scene}` })
}

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
  // the graph scrolls, the document scrolls beside it, the window changes shape —
  // and the light is on the target rather than where the target was.
  await page.setViewportSize({ width: 900, height: 700 })
  await expect
    .poll(() => page.locator('.spotlight').boundingBox())
    .toEqual(await field.boundingBox())

  // The very control being pointed at is still pressed, which is why none of
  // this is modal.
  await field.click()

  // Met by the Author doing the thing, with nothing to confirm: the sentence is
  // the next one before the Scene has finished landing. It arrives under a
  // provisional name, in a section of the document of its own, which is where the
  // Author corrects it.
  await expect(page.getByRole('group', { name: 'Writing A new Scene' })).toBeVisible()
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
  await seedPublication(story, arrival)

  await page.goto(`/stories/${story.id}`)

  // Nothing asked for and nothing lit: the guidance speaks for the sake of what is
  // still to be written, and this Story is already written. This is what an Author
  // finds when they open a Sample.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(bubble(page)).toBeHidden()
  await expect(page.locator('.spotlight')).toBeHidden()
})

/**
 * A Story is allowed to sit with no opening Scene — the Author decides where
 * their Story starts — and the only way to arrive there is to delete the Scene it
 * opened on. The guidance has to follow: the last step is a Publish that would
 * refuse, and what is left to do is the mark on a Scene's slate.
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
  // mark instead — on the Scene now on the surface, since there always is one.
  await expect(bubble(page)).toContainText(/nothing marks where this Story does/)

  await writeScene(page, 'The platform')
  await lights(page, written(page, 'The platform').locator('.opening'))
  await page.getByRole('button', { name: 'Mark as the Opening Scene The platform' }).click()

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
  // It puts the caret in the Scene it wrote, on the provisional name and selected,
  // so the Author names it where it stands and is asked for what goes in it rather
  // than for the surface they are already looking at.
  await lights(page, page.getByRole('button', { name: 'Write the First Scene' }))
  await page.getByRole('button', { name: 'Write the First Scene' }).click()
  const named = page.getByLabel('Name of A new Scene')
  await expect(named).toBeFocused()
  await page.keyboard.type('The arrival')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // Written. The sentence carries the whole gesture — a Shot is added and then
  // written — and so does the light: a Scene arrives with no beat in it, so the
  // Step points at the control that writes one until there is a field to point at.
  // Nothing is said from the corner, which is where a Step pointing at nothing
  // stands over the very control its sentence asks for.
  await expect(bubble(page)).toContainText(NEXT_STEP)
  await expect(bubble(page)).not.toHaveClass(/adrift/)
  const adds = written(page, 'The arrival').getByRole('button', { name: 'Add a Shot' })
  await lights(page, adds)
  await adds.click()
  const shot = page.getByRole('textbox', { name: 'Shot 1' })
  await lights(page, shot)
  await shot.fill('She steps off the train.')
  await shot.blur()

  // The second Scene and the Exit to it, which are one act and so one Step:
  // written at the foot of the Scene the Author is already writing in, where the
  // light is, by naming the Scene the way on leads to. Nothing is closed and
  // nothing is switched to first — the Step before this one left them in this
  // document, and what it points at answers a press from where they stand.
  await expect(bubble(page)).toContainText(/branches between Scenes/)
  await lights(page, written(page, 'The arrival').locator('form.adding'))
  const adding = page.getByLabel('An Exit from here The arrival')
  await adding.fill('The platform')
  await adding.press('Enter')

  await expect(toast(page))
    .toHaveText('“The platform” written, and an Exit from The arrival to it drawn')

  // Born under the name typed, already joined, and drawn on the Graph at once.
  await expect(sceneNode(page, 'The platform')).toHaveCount(1)
  const read = await (await page.request.get(`/api/stories/${story.id}`)).json()
  const beside = read.scenes.find((scene: { name: string }) => scene.name === 'The platform')

  // A Flag on the first Scene, in the list the light moves to once the caret is
  // back in that Scene. The light is on the whole list rather than on a field of
  // it, because a Flag is the row it is added as.
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  await writeScene(page, 'The arrival')
  // The light is on the Flags of the Scene the caret is in, and on no other
  // Scene's: the document holds forty of these lists on a Story of forty Scenes,
  // so what a Step points at is scoped to the Scene it is about — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await lights(page, written(page, 'The arrival').locator('.flags'))
  await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
  await page.getByLabel('Name of Flag 1 set on entering The arrival').fill('courage')
  const value = page.getByLabel('Value 1 of Flag 1 set on entering The arrival')
  await value.fill('high')
  await value.blur()

  // And a Condition on the second Scene, which has no Shot in it yet: the
  // sentence carries that whole gesture, because the Step names the Conditions of
  // the Shot in the Scene the caret is in, whichever Scene that is.
  await expect(bubble(page)).toContainText(/A Condition makes the same Scene play differently/)
  // The one move in this walk the guidance does not ask for. Writing a way on
  // leaves the caret in the Scene it was named in, so the light is still on the
  // first Scene here — and this Step is the one whose predicate reads a Scene of
  // the Story rather than the Scene it lights, which is issue #278. Until that is
  // settled the walk has to stand where the Step is met, and it says so rather
  // than reading as something an Author would have done.
  await writeScene(page, 'The platform')
  // The Scene the way on wrote holds no beat either, so the Step asks for one
  // where the control that writes it stands, in the Scene the caret is in. Pressed
  // at the light rather than through a panel that had drifted over it, which is
  // what this moment was until #257.
  const beat = written(page, 'The platform').getByRole('button', { name: 'Add a Shot' })
  await lights(page, beat)
  await beat.click()

  // The light is on the Conditions of the Shot in the Scene the caret is in, which
  // is the one the sentence just asked for.
  const carrier = 'Shot 1 of The platform'
  await lights(page, written(page, 'The platform').locator('.conditions').first())
  await page.getByRole('button', { name: `Add a Condition to ${carrier}` }).click()

  // Written against a value the Flag does not hold, which is what the sentence
  // asked for and what gives the Preview something to explain.
  await page.getByLabel(`Flag of Condition 1 of ${carrier}`).fill('courage')
  const holds = page.getByLabel(`holds for Condition 1 of ${carrier}`)
  await holds.fill('low')
  await holds.blur()

  // The reading, which is where the Condition stops being an idea about State and
  // becomes a Shot that does not play. It is one of the three readings the middle
  // of the bench turns to, so the Step points at the control that turns it there —
  // the gesture its sentence asks for — and the reading is behind that press. The
  // Condition is read back out of the Story first: the write goes when the field
  // is left, and a light that arrived before it would be over a reading of a Story
  // that had not been written yet.
  await expect.poll(() => readShotConditions(beside.id))
    .toEqual([[{ flag: 'courage', is: 'low' }]])
  await expect(bubble(page)).toContainText(/Nothing plays that Shot/)
  const turning = page.getByRole('button', { name: 'Read the Story' })
  await lights(page, turning)
  await turning.click()
  const preview = page.getByRole('region', { name: /^Preview/ })
  await expect(preview).toBeVisible()

  // The reading is replayed to the Scene being written, and its bench names the
  // Shot the Reading left out and both sides of the test it failed.
  const bench = page.getByRole('region', { name: /On the bench/ })
  await expect(bench.getByText('needs courage to hold low, holds high')).toBeVisible()

  // Corrected where it was written, which is all the Step ever asked of the
  // Story: nowhere is it written that the reading was read. The middle is turned
  // back to the writing to write it, which is the one thing the readings cost.
  await page.getByRole('button', { name: 'Write the Scene' }).click()
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
  // because the bench moves under it — the document scrolls beside it, the graph
  // is pulled back — and a rectangle read while it is still on its way would be
  // held against a light that has already arrived.
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
 * carried down the window by the document growing above it is a target that has
 * moved like any other. Proved on the step whose target is at the foot of a
 * Scene's section — the way on written from here — because everything written
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

  const adding = written(page, 'The arrival').locator('form.adding')
  await expect(bubble(page)).toContainText(/An Exit is the way on/)
  await lights(page, adding)

  // Asked for with no motion, so the step arrives rather than travels: what is
  // held against the light is where the line ends up, never a frame of it on the
  // way there.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Add a Shot to The arrival' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
  await lights(page, adding)

  // And the document narrowing under a window that changed shape, which moves the
  // line the other way — far enough down a shorter window to leave it, so the
  // document is wound back to it first: a target off the window is not lit at all,
  // which is its own spec below.
  await page.setViewportSize({ width: 900, height: 700 })
  await adding.scrollIntoViewIfNeeded()
  await lights(page, adding)
})

/**
 * The guidance at the width of a phone, where the bench is one column: the
 * header, the Graph and the document are all drawn, so every Step has something
 * on screen to point at, and the light lands on it rather than being said
 * adrift.
 */
test('the guidance reaches every part of the bench at the width of a phone', async ({
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

  await page.setViewportSize({ width: 600, height: 800 })
  await page.goto(`/stories/${story.id}?scene=${arrival.id}`)
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // What is asked for is a Flag, which is set in the document: the light is on
  // that section of the Scene's own document.
  await expect(bubble(page)).toContainText(/State is what one Reading carries with it/)
  await lights(page, page.locator('[data-step="scene-flags"]'))

  // And the bubble carrying the sentence is on top of the bench rather than
  // under anything. Read by hit-testing its own middle, which asks the browser
  // where a pointer would land rather than reading a stacking order out of the
  // stylesheet — so the bubble is given a pointer for the length of the read and
  // has it taken away again inside the same frame. It answers none of its own:
  // wherever it is placed it stands over the document, and a panel that swallowed
  // a press would make the very control its sentence names unreachable.
  expect(await page.evaluate(() => {
    const bubble = document.querySelector<HTMLElement>('.bubble')!
    const said = bubble.getBoundingClientRect()
    bubble.style.pointerEvents = 'auto'
    const over = document.elementFromPoint(said.x + said.width / 2, said.y + said.height / 2)
    bubble.style.pointerEvents = ''

    return said.width > 0 && !!over?.closest('.bubble')
  })).toBe(true)

  // What it does not do is take that press: the guidance answers a pointer on its
  // own control and nowhere else, so what is under the sentence is worked at
  // normally — the defect the corner placement was plugged against, held here for
  // every placement: the panel stands on controls of the Scene being written
  // wherever it is put — three of them at 1280 by 720 — and each is still pressed
  // through it.
  expect(await page.evaluate(() => {
    const said = document.querySelector('.bubble')!.getBoundingClientRect()
    const under = document.elementFromPoint(said.x + said.width / 2, said.y + said.height / 2)

    return !under?.closest('.bubble')
  })).toBe(true)

  // A Flag set, and what is asked for next is a Condition — also in the document.
  await seedFlags(arrival.id, { courage: 'high' })
  await page.reload()
  await expect(bubble(page)).toContainText(/A Condition makes the same Scene play differently/)

  // The Story is past both of those, and what is left to point at is the Publish
  // in the header, which is on screen at every width.
  await seedShotConditions(platform.shots[0]!.id, [{ flag: 'courage', is: 'high' }])
  await page.request.post(`/api/scenes/${arrival.id}/opening`)
  await page.reload()
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()
  await expect(bubble(page)).toContainText(/That is a Story that works/)
  await lights(page, page.getByRole('button', { name: 'Publish this Story' }))
})

/**
 * The document holds every Scene of the Story at once, so five of the eight Steps
 * have a field per Scene to choose between and a selector over the document would
 * take the first — the Scene the Story opens on, however far the Author has walked
 * from it. What settles it is the mark and not the selector: a target inside the
 * document is written on the Scene the caret is in and on no other, so the light
 * is where the Author is standing. See
 * `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.
 */
test('the Step lights the Scene the caret is in, not the first of ten', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  const scenes = await seedChain(story, [
    'The arrival', 'The platform', 'The bar', 'The alley', 'The quay',
    'The market', 'The bridge', 'The rooftop', 'The garden', 'The last train',
  ])

  await page.goto(`/stories/${story.id}`)
  // Every Scene is written and joined and none of them sets a Flag, so what the
  // bench asks for is the Flag — which is set in the document, once per Scene.
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)

  // The fifth of the ten, halfway down a Story that reads in the order it was
  // chained in.
  await writeScene(page, scenes[4]!.name)
  await lights(page, written(page, scenes[4]!.name).locator('.flags'))

  // And nothing at all is marked in the Scene the document opens with, which is
  // where a selector over the whole document would have put the light.
  await expect(written(page, scenes[0]!.name).locator('[data-step]')).toHaveCount(0)
})

/**
 * The first of the three things that leave a Step with nowhere to stand: the middle
 * of the bench turned over to the reading, which is the document and every mark in
 * it gone. The sentence does not go with them — it is carried from the corner, which
 * is the degradation
 * `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md` asks for — and it
 * comes back to the control it was on when the writing does.
 */
test('a Step whose target the reading took away says the same thing from the corner', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  await seedChain(story, ['The arrival', 'The platform'])

  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  await lights(page, written(page, 'The arrival').locator('.flags'))

  await readTheStory(page)
  await expect(bubble(page)).toHaveClass(/adrift/)
  await expect(page.locator('.spotlight')).toBeHidden()
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)

  await page.getByRole('button', { name: 'Write the Scene' }).click()
  await lights(page, written(page, 'The arrival').locator('.flags'))
})

/**
 * The second, and the one the document made likelier: every Scene of the Story is
 * written at once, so an Author reading down a Story carries the mark on the Scene
 * the caret is in a whole document away from the window. The sentence is placed
 * from that mark's own bottom edge and nothing above it was bounded, so anchored
 * to a target nobody can see it was said nowhere at all — measured at a top of
 * -16444px on a Story of forty in a window nine hundred tall, with the light
 * seventy pixels above that.
 */
test('a Step whose target the document scrolled past says the same thing from the corner', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  const scenes = await seedChain(story, [
    'The arrival', 'The platform', 'The bar', 'The alley', 'The quay',
    'The market', 'The bridge', 'The rooftop', 'The garden', 'The last train',
  ])

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  await lights(page, written(page, scenes[0]!.name).locator('.flags'))

  // Wound to the foot of the document, nine Scenes below the one the caret is in
  // and still standing in it: scrolling moves nothing but the window.
  await page.locator('.document').evaluate((scroller) => {
    scroller.scrollTop = scroller.scrollHeight
  })

  await expect(bubble(page)).toHaveClass(/adrift/)
  await expect(page.locator('.spotlight')).toBeHidden()
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  await readable(page)

  // And back on its target the moment the document is wound back to it.
  await page.locator('.document').evaluate((scroller) => {
    scroller.scrollTop = 0
  })
  await lights(page, written(page, scenes[0]!.name).locator('.flags'))
})

/**
 * The band the window could not see, which is the one the document opened: the
 * document is a scroller of its own and it starts under the Story's edge, so a
 * mark wound above its top edge is clipped and invisible while its rectangle still
 * meets the window. Driven at 1280 × 900 on a Story of forty before this was
 * closed: seventy-seven pixels of scroll — the document's own top offset — with
 * the light on the Story's `h1` and then on the `header`, and the sentence placed
 * against them. The whole of the band is here, in four-pixel steps, because what
 * was wrong with it was every frame of it and not its far end.
 */
test('a Step whose target the document clipped is lit on nothing at all', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  const scenes = await seedChain(story, [
    'The arrival', 'The platform', 'The bar', 'The alley', 'The quay',
    'The market', 'The bridge', 'The rooftop', 'The garden', 'The last train',
  ])

  // The document is wound by hand, and a wind that animates would be read halfway
  // through.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)
  const flags = written(page, scenes[0]!.name).locator('.flags')
  await lights(page, flags)

  // Wound a pixel past the point where the mark's own foot meets the document's
  // top edge — a scroll offset is fractional, and a rectangle landing exactly on
  // the edge is a rounding away from either answer. From here on nobody can see
  // the mark, and its rectangle meets the window for as long as the edge is below
  // the top of the screen.
  await page.evaluate(() => {
    const scroller = document.querySelector('.document')!
    const target = document.querySelector('[data-step="scene-flags"]')!

    scroller.scrollTop
      += target.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top + 1
  })

  for (let past = 0; past < 72; past += 4) {
    // Nothing is lit, which is the whole of not being lit on the wrong control:
    // the Step falls to the corner and says the same thing from there.
    await expect(page.locator('.spotlight')).toBeHidden()
    await expect(bubble(page)).toHaveClass(/adrift/)
    await expect(bubble(page)).toContainText(/State is what one Reading carries/)
    await readable(page)

    await page.locator('.document').evaluate((scroller) => {
      scroller.scrollTop += 4
    })
  }

  // And back on its target the moment the document is wound back to it.
  await page.locator('.document').evaluate((scroller) => {
    scroller.scrollTop = 0
  })
  await lights(page, flags)
})

/**
 * The other placement against a target, and the third thing that leaves a Step with
 * nowhere to stand. A window the target sits near the foot of is an ordinary
 * window — a phone held sideways is under four hundred pixels tall and the panel is
 * a good half of that — and a sentence placed twelve pixels under the target there
 * would run off the bottom of the screen. It is said above the target instead,
 * which is still against the control it names; only a target with room on neither
 * side sends it to the corner, and the light stays on it throughout, which is what
 * tells that apart from a target that has left the window.
 */
test('a Step whose sentence will not fit under its target says it above', async ({
  page,
  author,
}) => {
  const story = await seedStory(author, 'A Story')
  await seedChain(story, ['The arrival', 'The platform'])
  // The document is wound by hand here, and a wind that animates would be read
  // halfway through.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 800, height: 700 })
  await page.goto(`/stories/${story.id}`)
  await expect(bubble(page)).toContainText(/State is what one Reading carries/)

  const flags = written(page, 'The arrival').locator('.flags')
  await lights(page, flags)
  expect(await placed(page, flags)).toBe('under')

  // The same bench in a window too short under the target for the sentence.
  await page.setViewportSize({ width: 800, height: 420 })
  await lights(page, flags)
  expect(await placed(page, flags)).toBe('above')

  // And the target wound to the head of the document in a window shorter still,
  // where it is whole on the screen and there is room for the sentence on neither
  // side of it. To the document's own top edge rather than to a line of the
  // window: the document starts under the Story's edge — a hundred and
  // eighty-four pixels down at this width — so winding the mark to the window's
  // hundred and twentieth pixel put it above that edge, where it is clipped and
  // nobody can see it, and the light this was holding it against was the one
  // #280 took away.
  await page.setViewportSize({ width: 800, height: 340 })
  await page.evaluate(() => {
    const scroller = document.querySelector('.document')!
    const target = document.querySelector('[data-step="scene-flags"]')!

    scroller.scrollTop
      += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  })
  await expect(bubble(page)).toHaveClass(/adrift/)
  await lights(page, flags)
  expect(await placed(page, flags)).toBe('adrift')
})

/**
 * Where the sentence ended up: under the control it is about, above it, or in the
 * corner. Whole on the screen in every one of the three, which is what they are
 * all for.
 */
async function placed(page: Page, target: Locator) {
  await readable(page)
  if (/\badrift\b/.test(await bubble(page).getAttribute('class') ?? '')) return 'adrift'

  const said = (await bubble(page).boundingBox())!

  return said.y > (await target.boundingBox())!.y ? 'under' : 'above'
}

/** That the whole of the sentence is somewhere a person can read it. */
async function readable(page: Page) {
  const said = (await bubble(page).boundingBox())!
  const window = page.viewportSize()!

  expect(said.x).toBeGreaterThanOrEqual(0)
  expect(said.y).toBeGreaterThanOrEqual(0)
  expect(said.x + said.width).toBeLessThanOrEqual(window.width)
  expect(said.y + said.height).toBeLessThanOrEqual(window.height)
}
