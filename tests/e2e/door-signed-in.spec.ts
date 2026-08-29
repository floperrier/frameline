import { expect } from '@playwright/test'
import { writeScene, readShots, seedScene, seedStory, test } from './author'

/**
 * The door shutting under an Author who is already writing — the one refusal that
 * arrives on a page nothing navigated to. The cookie is cleared the way a browser
 * sweep, a sign-out in another tab or a rotated `NUXT_SESSION_PASSWORD` clears
 * it, and everything after that is what the Author sees: the refusal in their own
 * words, the door beside it, and the field they were typing in still theirs. See
 * `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`.
 *
 * The cookie is the only thing signing these two tests in, so the Story is seeded
 * past the API: the rest of the suite also carries the sealed session as a header
 * on every request the browser makes, and a header no cookie sweep can clear
 * would leave the door open with the cookie gone.
 */

const SHUT = 'You are no longer signed in, so nothing was written.'
const DOOR = 'Sign in again in a new tab'

test.use({ extraHTTPHeaders: {} })

test('a write with the door shut is refused in words, offers the door, and keeps what was typed', async ({
  page, context, author,
}) => {
  const story = await seedStory(author, 'A Story')
  const scene = await seedScene(story, 'The street')

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The street')

  // Kept to be put back, because the whole point of the second tab is that this
  // one is still the tab it was.
  const sealed = await context.cookies()
  await context.clearCookies()

  const shot = page.getByRole('textbox', { name: 'Shot 1' })
  await shot.fill('Typed after the door shut.')
  await shot.blur()

  // The words are the server's, negotiated from the request that carried the
  // write, and `Unauthorized` reaches no screen.
  const refusal = page.getByRole('alert')
  await expect(refusal).toContainText(SHUT)
  await expect(refusal).not.toContainText('Unauthorized')

  // The door is inside the refusal, so it is announced with the sentence that
  // gives it its sense, and it opens beside this tab rather than in it.
  const door = refusal.getByRole('link', { name: DOOR })
  await expect(door).toHaveAttribute('target', '_blank')
  await expect(door).toHaveAttribute('href', '/')
  await expect(door).not.toBeFocused()

  // Nothing navigated — the Scene being written is in the address since
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, and it is the
  // one that was being written before the door shut — and what was typed is
  // still on screen and still writable.
  await expect(page).toHaveURL(`/stories/${story.id}?scene=${scene.id}`)
  await expect(shot).toHaveValue('Typed after the door shut.')
  await expect(shot).toBeEditable()

  // The refusal said nothing was written, and nothing was: the Scene still holds
  // the Shot as it stood before the door shut.
  await expect(readShots(scene.id)).resolves.toMatchObject([{ text: 'Their Shot' }])

  await context.addCookies(sealed)
  await shot.fill('Typed once the door was open again.')
  await shot.blur()

  // The next attempt clears the refusal — nothing watched for the door reopening.
  await expect(page.getByRole('alert')).toBeHidden()
  await expect(page.getByText(/^Kept at \d{1,2}:\d{2}/)).toBeVisible()
  await expect(readShots(scene.id))
    .resolves.toMatchObject([{ text: 'Typed once the door was open again.' }])
})

test('the Stories list refuses in the same voice', async ({ page, context, author }) => {
  await seedStory(author, 'A Story')

  await page.goto('/stories')
  await context.clearCookies()

  const titling = page.getByLabel('Title of a new Story')
  await titling.fill('A Story nobody may write')
  await page.getByRole('button', { name: 'Create Story' }).click()

  const refusal = page.getByRole('alert')
  await expect(refusal).toContainText(SHUT)
  await expect(refusal.getByRole('link', { name: DOOR })).toHaveAttribute('target', '_blank')

  // The list is still the list, and the title is still in the field, to be
  // written again once the door is open.
  await expect(page).toHaveURL('/stories')
  await expect(titling).toHaveValue('A Story nobody may write')
  await expect(page.getByRole('link', { name: 'Open A Story' })).toBeVisible()
})
