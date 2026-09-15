import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import {
  live, readTheStory, sceneNode, seedExit, seedFlags, seedScene, seedStory, test, writeScene,
} from './author'

/**
 * What the bench reads back to the Author: the Remarks it finds in the Story,
 * counted beside the document and opening into a list each line of which presses
 * to the Scene it is about — see
 * `docs/adr/0032-the-bench-reads-the-story-back.md`, whose row above the bench
 * `docs/adr/0043-a-story-is-written-as-one-document.md` replaced with a region of
 * its own.
 *
 * The reading itself is held to a literal in `tests/unit/remarks.spec.ts`. What
 * is proved here is the other half: that the count is on the screen, that it is
 * reached by naming it like every other act, that a Remark leads to its Scene by
 * the rail's own press, and that the two the Preview says in the Scene's own words
 * are dropped while it is the reading on screen and said again when it is not.
 */

/**
 * The disclosure the Remarks are counted and read in, and the line that opens it.
 * Reached by its own mark rather than by a role: a `<summary>` is exposed
 * differently by each engine, and what this spec is about is what the disclosure
 * says rather than which role its handle carries.
 */
function found(page: Page) {
  return page.locator('.found')
}

/**
 * Makes sure the list is open, which at the width these specs run at it already
 * is: the Remarks stand in a region of their own beside the document rather than
 * laid over the head of the bench, so there is room to leave them open and they
 * say what they found without being asked. Asked rather than pressed, because a
 * `<summary>` toggles and a press on an open list would close it.
 *
 * Waited for first, because which side of the fold the bench is on is a thing only
 * the browser knows: the bench is rendered whole by the server with the Remarks
 * open, and a press that landed before the page was answering would be a press
 * the fold then argued with.
 */
async function openRemarks(page: Page) {
  await live(page)
  if (await found(page).evaluate(one => (one as HTMLDetailsElement).open)) return

  await page.locator('.found summary').click()
}

/** A Story of two Scenes joined by an Exit, which the bench has nothing to say about. */
async function whole(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  const scenes = []
  for (const name of ['The arrival', 'The platform']) {
    scenes.push(await (await request.post(
      `/api/stories/${story.id}/scenes`, { data: { name } })).json())
  }
  await request.post(`/api/scenes/${scenes[0]!.id}/exits`, { data: { toSceneId: scenes[1]!.id } })
  for (const scene of scenes) {
    const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
    await request.patch(`/api/shots/${shot.id}`, {
      data: { text: 'A door opens.', description: '' },
    })
  }

  return { story, scenes }
}

test('says it found nothing in a Story that holds together', async ({ page, request }) => {
  const { story } = await whole(request)

  await page.goto(`/stories/${story.id}`)
  await expect(found(page)).toContainText('0')

  await openRemarks(page)
  await expect(found(page)).toContainText('Nothing to report')
})

test('counts what it finds, and goes to the Scene a Remark names', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  const arrival = await seedScene(story, 'The arrival')
  const platform = await seedScene(story, 'The platform')
  // A Story opening nowhere — a seeded Scene never becomes the opening one, which
  // only the endpoint that writes a Scene does — a Scene nothing arrives at, and a
  // Flag nothing tests: three findings, and none of them a refusal.
  await seedExit(arrival.id, platform.id)
  await seedFlags(arrival.id, { coat: 'on' })

  // Read with the caret in The platform. All three are said here: the writing is
  // the reading on screen, and it says none of them in the Scene's own words, so
  // a Remark dropped would be a fact said by nobody — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The platform')
  await expect(found(page)).toContainText('3')

  await openRemarks(page)
  await expect(found(page).getByRole('listitem')).toHaveCount(3)
  await expect(found(page)).toContainText('marks no opening Scene')

  // Pressing the Remark about the Flag puts the caret in the Scene that sets it,
  // which is where the Author answers it.
  await found(page).getByRole('button', { name: /sets the Flag coat/ }).click()
  await expect(page).toHaveURL(new RegExp(`scene=${arrival.id}`))
  await expect(sceneNode(page, 'The arrival')).toHaveClass(/here/)

  // And the Scene the caret is in keeps its own sentence here, as every Scene does.
  await openRemarks(page)
  await expect(found(page)).toContainText('No Exit arrives at The arrival')
})

test('is opened and closed by naming it, like every other act of the bench',
  async ({ page, request }) => {
    const { story } = await whole(request)
    const naming = async (typed: string) => {
      await page.getByRole('button', { name: 'Commands' }).click()
      await page.getByRole('textbox', { name: 'Type a name' }).fill(typed)
    }

    await page.goto(`/stories/${story.id}`)

    // The list is open where there is room for it, so the act the bar offers is
    // the one that closes it: a summary toggles, and a Command whose name and act
    // disagree is the one thing `0035` marks a control to prevent.
    await naming('Remarks')
    await page.getByRole('button', { name: 'Close the Remarks' }).click()
    await expect(found(page).locator('.none')).toBeHidden()

    // And named again for what pressing it will do from where the list now stands.
    await naming('Remarks')
    await page.getByRole('button', { name: 'Read the Remarks' }).click()
    await expect(found(page)).toContainText('Nothing to report')

    // At the fold the Remarks are the line and their count, and the bar is how a
    // keyboard opens them there as well as here: what folds is the width they are
    // said in and never their voice — see
    // `docs/adr/0043-a-story-is-written-as-one-document.md`.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(found(page)).toHaveJSProperty('open', false)

    await naming('Remarks')
    await page.getByRole('button', { name: 'Read the Remarks' }).click()
    await expect(found(page)).toContainText('Nothing to report')
  })

/**
 * A Story of two Scenes with no Exit between them, opening on the first: nothing
 * arrives at the second, and the second holds no Shot. Written through the API
 * rather than seeded, because the first Scene it writes becomes the one the Story
 * opens on — which is what leaves the Preview able to read as far as the Scene the
 * caret is in and say that nothing leads to it.
 */
async function loose(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  const arrival = await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name: 'The arrival' } })).json()
  const shot = await (await request.post(`/api/scenes/${arrival.id}/shots`)).json()
  await request.patch(`/api/shots/${shot.id}`, { data: { text: 'A door opens.', description: '' } })
  const platform = await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name: 'The platform' } })).json()

  return { story, arrival, platform }
}

test('drops what the Preview is saying in the Scene\'s own words, and says it again after',
  async ({ page, request }) => {
    const { story, platform } = await loose(request)

    // The writing is the reading on screen, and it says neither of these in the
    // Scene's own words: both are the bench's to say.
    await page.goto(`/stories/${story.id}?scene=${platform.id}`)
    await openRemarks(page)
    await expect(found(page)).toContainText('No Exit arrives at The platform')
    await expect(found(page)).toContainText('The platform holds no Shot')
    await expect(found(page).getByRole('listitem')).toHaveCount(2)

    // The bench is turned over, and the Preview says in the Scene's own words that
    // nothing leads to it. The nearer voice wins, so the Remarks drop that one and
    // that one alone — see `docs/adr/0032-the-bench-reads-the-story-back.md`, whose
    // rule `docs/adr/0043-a-story-is-written-as-one-document.md` generalises from
    // one Scene to every reading.
    await readTheStory(page)
    await expect(page.getByText('Nothing leads to The platform yet')).toBeVisible()
    await expect(found(page)).not.toContainText('No Exit arrives at The platform')
    await expect(found(page)).toContainText('The platform holds no Shot')
    await expect(found(page).getByRole('listitem')).toHaveCount(1)

    // And it comes back the moment the reading does: the voice that was nearer has
    // fallen silent, and a fact said by nobody is what the rule exists to prevent.
    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await expect(found(page)).toContainText('No Exit arrives at The platform')
    await expect(found(page).getByRole('listitem')).toHaveCount(2)
  })

test('keeps a Scene\'s own Remark where the Preview only says the Story opens nowhere',
  async ({ page, author }) => {
    // Seeded, so no Scene is the one the Story opens on: the Preview then reports
    // that and nothing else — it never reads as far as the Scene the caret is in.
    const story = await seedStory(author, 'A Story')
    await seedScene(story, 'The arrival')
    const platform = await seedScene(story, 'The platform')

    await page.goto(`/stories/${story.id}?scene=${platform.id}`)
    await live(page)
    await readTheStory(page)
    await expect(page.getByText('This Story has no opening Scene')).toBeVisible()

    // That one is dropped, because the Preview is saying it. The Scene's own is
    // not: a voice that has fallen silent is not a voice, and the reading has to
    // know which — `docs/adr/0032-the-bench-reads-the-story-back.md`.
    await openRemarks(page)
    await expect(found(page)).not.toContainText('marks no opening Scene')
    await expect(found(page)).toContainText('No Exit arrives at The platform')
  })

test('leads to a Scene by the rail\'s own press, leaving the reading where it is',
  async ({ page, request }) => {
    const { story, arrival, platform } = await loose(request)

    // The Author is reading, and presses a Remark about a Scene they are not in.
    await page.goto(`/stories/${story.id}?scene=${arrival.id}`)
    await live(page)
    const preview = await readTheStory(page)
    await openRemarks(page)
    await found(page).getByRole('button', { name: /The platform holds no Shot/ }).click()

    // The caret moves, exactly as it does when the mark on the rail is pressed —
    // the same act, by the same route, so the two cannot disagree about where a
    // Scene is.
    await expect(page).toHaveURL(new RegExp(`scene=${platform.id}`))
    await expect(sceneNode(page, 'The platform')).toHaveClass(/\bhere\b/)

    // And the reading stays up: a Remark stands beside every reading, so pressing
    // one while the Story is being read is the Author reading on rather than asking
    // to write. The Preview follows the caret, which is the one notion of where
    // they are — `docs/adr/0030-a-story-is-read-where-it-is-written.md`.
    await expect(preview).toBeVisible()
    await expect(preview.getByText('Nothing leads to The platform yet')).toBeVisible()
  })

test('says nothing at the moment of a Publish', async ({ page, request }) => {
  const { story } = await loose(request)

  await page.goto(`/stories/${story.id}`)
  await openRemarks(page)
  await expect(found(page).getByRole('listitem')).toHaveCount(2)

  // A Story carrying Remarks publishes like any other: they are advisory, they are
  // not a refusal, and there is nothing to acknowledge on the way out — see
  // `docs/adr/0032-the-bench-reads-the-story-back.md` and
  // `docs/adr/0023-being-published-and-being-found-are-two-acts.md`.
  await page.getByRole('button', { name: 'Publish this Story' }).click()
  await expect(page.getByRole('link', { name: new RegExp(story.id) })).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
  await expect(found(page).getByRole('listitem')).toHaveCount(2)
})
