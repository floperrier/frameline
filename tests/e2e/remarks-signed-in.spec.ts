import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import {
  readTheStory, sceneNode, seedExit, seedFlags, seedScene, seedStory, test,
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
 * reached by naming it like every other act, that pressing a Remark opens the
 * Scene it names, and that it falls silent where the Preview is already saying
 * the same thing.
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
 * Makes sure the list is open, which since `0043` it already is: the Remarks stand
 * in a region of their own beside the document rather than laid over the head of
 * the bench, so there is room to leave them open and they say what they found
 * without being asked. Asked rather than pressed, because a `<summary>` toggles
 * and a press on an open list would close it.
 */
async function openRemarks(page: Page) {
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

test('counts what it finds, and opens the Scene a Remark names', async ({ page, author }) => {
  const story = await seedStory(author, 'A Story')
  const arrival = await seedScene(story, 'The arrival')
  const platform = await seedScene(story, 'The platform')
  // A Story opening nowhere — a seeded Scene never becomes the opening one, which
  // only the endpoint that writes a Scene does — a Scene nothing arrives at, and a
  // Flag nothing tests: three findings, and none of them a refusal.
  await seedExit(arrival.id, platform.id)
  await seedFlags(arrival.id, { coat: 'on' })

  // Read with the caret in The platform. All three are said here: the Preview is
  // the other reading the middle of the bench can hold rather than a column beside
  // the writing, so while an Author is writing there is nothing else on screen
  // saying any of them — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await page.goto(`/stories/${story.id}`)
  // By the rail's own mark, which is what moves the caret now: every Scene of the
  // document is written where it stands, so there is nothing to open — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  const platformMark = sceneNode(page, 'The platform')
  await platformMark.click()
  await expect(platformMark).toHaveClass(/here/)
  await expect(found(page)).toContainText('3')

  await openRemarks(page)
  await expect(found(page).getByRole('listitem')).toHaveCount(3)
  await expect(found(page)).toContainText('marks no opening Scene')

  // Pressing the Remark about the Flag puts the Scene that sets it on the writing
  // surface, which is where the Author answers it.
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
  })

test('says what it found whichever reading the bench is showing', async ({ page, request }) => {
  // Written through the API rather than seeded, because the first Scene it writes
  // becomes the one the Story opens on.
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The arrival' } })
  const platform = await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name: 'The platform' } })).json()

  // No Exit at all, so nothing arrives at the second Scene: the bench says so.
  await page.goto(`/stories/${story.id}`)
  await openRemarks(page)
  await expect(found(page).getByRole('button', { name: /No Exit arrives at The platform/ }))
    .toBeVisible()

  // And it goes on saying so with the caret in that Scene. The Preview says it too
  // in the Scene's own words, but only while it is the reading on screen: two
  // voices for one fact was the objection while the reading was a column beside
  // the writing, and it takes the middle of the bench now — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await page.goto(`/stories/${story.id}?scene=${platform.id}`)
  await openRemarks(page)
  await expect(found(page)).toContainText('No Exit arrives at The platform')
  await expect(found(page)).toContainText('The platform holds no Shot')

  await readTheStory(page)
  await expect(page.getByText('Nothing leads to The platform yet')).toBeVisible()
})
