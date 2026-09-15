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

/**
 * The bubble, whichever of its two placements it is in. Named by its heading,
 * which is a displayed string and so is not *Next* in the one spec below that
 * reads the bench in French.
 */
function bubble(page: Page, heading = 'Next') {
  return page.getByRole('complementary', { name: heading })
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
  const arrival = read.scenes.find((scene: { name: string }) => scene.name === 'The arrival')

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

  // And a Condition, on the Shot of the Scene the caret is in. Writing a way on
  // leaves the caret in the Scene it was named in, so that is still the first
  // Scene, and the light is on the Conditions of the Shot written there. Nothing
  // moves the caret: the Step is met wherever the Condition is written — issue
  // #278 — and the Flag this Scene sets on entry is in State by the time its own
  // Shot plays, so the lesson holds here.
  await expect(bubble(page)).toContainText(/A Condition makes the same Scene play differently/)
  const carrier = 'Shot 1 of The arrival'
  await lights(page, written(page, 'The arrival').locator('.conditions').first())
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
  await expect.poll(() => readShotConditions(arrival.id))
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

/**
 * That the light is on this control, and on nothing else — on as much of it as
 * anybody can see, which is the whole of it wherever the control is whole on the
 * screen. A control standing over the edge of a scroller or of the window is lit
 * to that edge and no further, so what the light is held against is the control's
 * rectangle cut the same way; that the cutting itself is right is the sweep's
 * question further down, and this one is which control.
 */
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

  await expect.poll(() => page.locator('.spotlight').boundingBox()).toEqual(await cut(target))
}

/** What is left of an element inside every scroller over it, and inside the window. */
function cut(target: Locator) {
  return target.evaluate((of) => {
    const seen = of.getBoundingClientRect()
    let [top, left, right, bottom] = [seen.top, seen.left, seen.right, seen.bottom]

    for (let over = of.parentElement; over; over = over.parentElement) {
      if (getComputedStyle(over).overflow === 'visible') continue

      const clip = over.getBoundingClientRect()
      top = Math.max(top, clip.top)
      left = Math.max(left, clip.left)
      right = Math.min(right, clip.right)
      bottom = Math.min(bottom, clip.bottom)
    }

    const x = Math.max(left, 0)
    const y = Math.max(top, 0)

    return { x, y, width: Math.min(right, innerWidth) - x, height: Math.min(bottom, innerHeight) - y }
  })
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
 * mark wound above that edge is clipped while its rectangle goes on meeting the
 * window. The whole of the band is walked here rather than its far end, because
 * what was wrong with it was every frame of it: a mark the document had only half
 * swallowed was lit over the whole of its rectangle, and the overhang landed on
 * the bench. Measured at 900 tall on a Story of forty at the Flags Step, wound two
 * pixels at a time: fifty-eight pixels of scroll with the light outside the
 * document at every one of the six widths below, thirty of them with the `header`
 * under the middle of it at 1280 and twenty-eight with the Remarks' own summary at
 * the widths the bench folds what it says over the document at, and fifty-seven of
 * the worst frame's fifty-nine pixels above the edge.
 *
 * So the sweep starts with the mark whole inside the document, ends with it wholly
 * past the edge, and at every frame in between says three things: the light is
 * exactly what is left of the mark inside the document and the window — which is
 * nothing at all once nothing is left — nothing outside the document stands under
 * the middle of it, and the sentence is whole on the screen, still the same
 * sentence, and never over the light.
 *
 * Six widths, which is both sides of both folds `app/assets/css/folds.css` names,
 * and both languages, because how tall the sentence is decides where it is placed
 * and the French one is not the length of the English.
 */
for (const spoken of [
  { locale: 'en-US', at: '', heading: 'Next',
    asked: /State is what one Reading carries/ },
  { locale: 'fr-FR', at: '/fr', heading: 'Ensuite',
    asked: /L’État est ce qu’une Lecture emporte/ },
]) {
  test.describe(`a bench read in ${spoken.locale}`, () => {
    test.use({ locale: spoken.locale })
    // Six widths of sweeping, at some forty frames each, is longer than a spec
    // that presses two controls.
    test.slow()

    test('a Step whose target the document is clipping is lit on what is left of it', async ({
      page,
      author,
    }) => {
      const story = await seedStory(author, 'A Story')
      await seedChain(story, [
        'The arrival', 'The platform', 'The bar', 'The alley', 'The quay',
        'The market', 'The bridge', 'The rooftop', 'The garden', 'The last train',
      ])

      // The document is wound by hand, and a wind that animates would be read
      // halfway through.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`${spoken.at}/stories/${story.id}`)
      await expect(bubble(page, spoken.heading)).toContainText(spoken.asked)

      // The mark itself rather than the Scene's own section of the document,
      // because a section is addressed by a name the Locale writes and which Scene
      // carries the mark is another spec's question: it is written on the Scene the
      // caret is in and on no other, so this reaches one element.
      const flags = page.locator('[data-step="scene-flags"]')

      for (const across of [1280, 1025, 1024, 705, 704, 390]) {
        // Wound back to the head of the document first, so that the light is on
        // the whole of its target before the width changes under it — which is
        // also the other end of what this asserts, at every one of the six.
        await page.locator('.document').evaluate((scroller) => {
          scroller.scrollTop = 0
        })
        await page.setViewportSize({ width: across, height: 900 })
        await lights(page, flags)

        // Then to twelve pixels inside the document's own top edge, which is the
        // last frame the whole of the mark is on the screen, and down from there
        // past the mark's own length.
        await page.evaluate(() => {
          const scroller = document.querySelector('.document')!
          const target = document.querySelector('[data-step="scene-flags"]')!

          scroller.scrollTop
            += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12
        })

        const tall = (await flags.boundingBox())!.height
        for (let past = 0; past < tall + 24; past += 2) {
          const frame = await wound(page, past ? 2 : 0)
          const where = `${across} wide, wound to ${frame.at.toFixed(0)}`

          // The light is exactly what is left of the mark once the document and
          // the window have each had their cut of it, and nothing at all where
          // nothing is left — which is the half-clipped case and the wholly
          // clipped one as one case.
          same(frame.lit, frame.rest, where)

          // And nothing outside the document is under the middle of it. The
          // rectangle could be inside the document and the light still be drawn
          // over the bench if anything stood between the two, so this is asked of
          // the page rather than of the arithmetic — and it is what answered the
          // `header` and then the Story's own title field before #280.
          expect(frame.on ?? true, where).toBe(true)

          // The sentence is the same sentence wherever it is placed, whole on the
          // screen, and never over the light: the Author is being asked to press
          // the very control it is on.
          expect(frame.sentence, where).toMatch(spoken.asked)
          expect(frame.said.top, where).toBeGreaterThanOrEqual(0)
          expect(frame.said.left, where).toBeGreaterThanOrEqual(0)
          expect(frame.said.bottom, where).toBeLessThanOrEqual(900)
          expect(frame.said.right, where).toBeLessThanOrEqual(across)
          if (frame.lit) {
            const beside = frame.said.bottom <= frame.lit.top
              || frame.said.top >= frame.lit.bottom
            expect(beside, where).toBe(true)
          }
        }
      }
    })
  })
}

/** A rectangle on its way out of the browser, which is a plain object. */
type Seen = { top: number, left: number, width: number, height: number,
  right: number, bottom: number }

/**
 * One frame of a wind: the document moved, two animation frames given to the loop
 * that follows the target, and then everything an assertion is made of read at
 * once. One round trip rather than six, because the sweep is hundreds of frames
 * long and six reads a frame would be six hundred.
 *
 * What is left of the mark is worked out here too, from the mark's own rectangle
 * and the document's and the window's, which is three readings of the page rather
 * than the arithmetic the component does.
 */
async function wound(page: Page, by: number) {
  return page.evaluate(async (by) => {
    const scroller = document.querySelector('.document')!
    scroller.scrollTop += by
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)

    const box = (of: Element | null): Seen | undefined => of?.getBoundingClientRect().toJSON()
    const lit = box(document.querySelector('.spotlight'))
    const mark = box(document.querySelector('[data-step="scene-flags"]'))!
    const cut = box(scroller)!
    const said = document.querySelector('.bubble')!

    const top = Math.max(mark.top, cut.top, 0)
    const left = Math.max(mark.left, cut.left, 0)
    const width = Math.min(mark.right, cut.right, innerWidth) - left
    const height = Math.min(mark.bottom, cut.bottom, innerHeight) - top
    const over = lit && document.elementFromPoint(
      lit.left + lit.width / 2, lit.top + lit.height / 2)

    return {
      at: scroller.scrollTop,
      lit,
      rest: width > 0 && height > 0
        ? { top, left, width, height, right: left + width, bottom: top + height }
        : undefined,
      on: over ? scroller.contains(over) : undefined,
      said: box(said)!,
      sentence: said.querySelector('.asked')!.textContent ?? '',
    }
  }, by)
}

/**
 * Two rectangles the same, to the pixel the browser lays out in: the light is a
 * style written in `px` and read back off the page, so what is asked of the two is
 * that they are equal rather than that they are the same object.
 */
function same(seen: Seen | undefined, want: Seen | undefined, where: string) {
  expect(Boolean(seen), where).toBe(Boolean(want))
  if (!seen || !want) return

  for (const edge of ['top', 'left', 'width', 'height'] as const) {
    expect(seen[edge], `${where}, ${edge}`).toBeCloseTo(want[edge], 0)
  }
}

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

  // And the target wound to the head of the document, where it is whole on the
  // screen and there is room for the sentence on neither side of it. To the
  // document's own top edge rather than to a line of the window: the document
  // starts under the Story's edge, so winding the mark to the window's hundred and
  // twentieth pixel put it above that edge, where it is clipped and nobody can see
  // it, and the light this was holding it against was the one #280 took away.
  //
  // A window short enough to leave no room under the mark, and wide enough to
  // leave none over it. Wide because the sentence is placed from the mark's own top
  // edge and the mark can stand no higher than the document does, so what decides
  // whether it fits above is how deep the Story's edge is — a question of width and
  // not of height. 77 pixels of edge here against a panel of 204; at 800 the bench
  // folds what it says into a band over the document and the edge is 184, which is
  // near enough the panel that a machine whose fonts run a line taller answers the
  // other way. That is a pose, not a spec.
  await page.setViewportSize({ width: 1440, height: 300 })
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
