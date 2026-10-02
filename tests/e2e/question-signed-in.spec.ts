import { expect } from '@playwright/test'
import { begin, live, opened, readTheStory, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Scene ends on a Question — issue #417. The bench half: the two fields that
 * write it stand between the Scene's Shots and its Exits, open wherever either
 * holds anything, and are taken away together. The Reading half: the Question is
 * put where the Exits would be, the answer is said by every text after it, and
 * it is kept with the Path in the Reader's browser.
 */

test('the bench writes a Scene\'s Question and its Flag, keeps them open, and takes them away', async ({ page, request }) => {
  const story = await writeStory(request)
  const read = () => request.get(`/api/stories/${story.id}`)
    .then(response => response.json() as Promise<StoryInEditor>)
  const street = (await read()).scenes.find(scene => scene.name === 'The street')!
  expect(street).toMatchObject({ question: '', questionFlag: '' })

  await page.goto(`/stories/${story.id}`)
  await live(page)

  const question = page.getByLabel('Question put to the Reader before the Exits').first()
  const flag = page.getByLabel('Flag the answer is held under').first()

  await page.getByRole('button', { name: 'Ask the Reader a Question The street', exact: true }).click()
  await expect(question).toBeFocused()

  await question.fill('What is your name?')
  await question.press('Tab')
  await flag.fill('name')
  await flag.press('Tab')
  await expect.poll(async () => {
    const { question, questionFlag } = (await read()).scenes.find(scene => scene.id === street.id)!
    return [question, questionFlag]
  }).toEqual(['What is your name?', 'name'])

  await page.reload()
  await live(page)
  await expect(question).toHaveValue('What is your name?')
  await expect(flag).toHaveValue('name')

  await page.getByRole('button', { name: 'Remove the Question The street', exact: true }).click()
  await expect(question).toHaveCount(0)
  await expect(flag).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ask the Reader a Question The street', exact: true }))
    .toBeVisible()
  // The press took its own button away with the fields, so the focus is handed to
  // the one that opens them again rather than dropped on the document.
  await expect(page.getByRole('button', { name: 'Ask the Reader a Question The street', exact: true }))
    .toBeFocused()
  await expect.poll(async () => {
    const { question, questionFlag } = (await read()).scenes.find(scene => scene.id === street.id)!
    return [question, questionFlag]
  }).toEqual(['', ''])
})

test('a Reading puts the Question before the Exits, says the answer after it, and keeps it', async ({ page, request }) => {
  let storyId = ''
  let streetId = ''
  await opened(page, request, async (story, scenes) => {
    storyId = story.id
    streetId = scenes[0]!.id
    await request.patch(`/api/scenes/${streetId}`, {
      data: { question: 'What is your name?', questionFlag: 'name' },
    })
    await request.patch(`/api/shots/${scenes[1]!.shots[0]!.id}`, {
      data: { text: 'Hello, {name}.', description: '' },
    })
  })
  const reading = page.locator('.reading')
  const said = reading.locator('.frame .shot')
  const field = reading.getByLabel('What is your name?')
  const way = reading.getByRole('button', { name: 'Follow her out' })
  const back = reading.getByRole('button', { name: 'Step Back' })

  // The run plays out, and the Question is put where the Exits would be offered,
  // with the focus in its field and no Exit beside it.
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await reading.getByRole('button', { name: 'Next Shot' }).click()
  await expect(field).toBeFocused()
  await expect(way).toHaveCount(0)

  // The keys a Reading is gone on with are the field's own while it is typed in.
  await field.pressSequentially('a b')
  await field.press('ArrowLeft')
  await field.press('ArrowRight')
  await expect(field).toHaveValue('a b')
  await expect(way).toHaveCount(0)

  // The Flag the answer is held under is the Author's, and is never shown.
  await expect(reading.locator('form')).toHaveText(/^\s*What is your name\?\s*Answer\s*$/)
  expect(await reading.ariaSnapshot()).not.toMatch(/\bname\b(?!\?)/)

  await field.fill('Ada')
  await field.press('Enter')
  await expect(way).toBeFocused()
  await way.click()
  await expect(said).toHaveText('Hello, Ada.')

  // The answer is part of the Path, so a Reader who comes back has still said it.
  await page.reload()
  await begin(page)
  await expect(said).toHaveText('Hello, Ada.')

  // Back across the Exit to the ways on, and back again to the Question, with the
  // answer that was given in the field.
  await back.click()
  await expect(way).toBeVisible()
  await back.click()
  await expect(field).toHaveValue('Ada')
  await expect(way).toHaveCount(0)

  // The Preview is the same Reading, so it asks too; and a Reader who answers
  // nothing has answered, and the Flag holds nothing.
  await page.goto(`/stories/${storyId}?scene=${streetId}`)
  const preview = await readTheStory(page)
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  const asked = preview.getByLabel('What is your name?')
  await expect(asked).toBeFocused()
  await expect(asked).toHaveValue('')
  await asked.press('Enter')
  await preview.getByRole('button', { name: 'Follow her out' }).click()
  await expect(preview.locator('.frame .shot')).toHaveText('Hello, .')
})

test('a Question the clock cuts to says it waits, to a Reader standing on a control of their own',
  async ({ page, request }) => {
    await page.clock.install()
    await opened(page, request, async (_, scenes) => {
      await request.patch(`/api/scenes/${scenes[0]!.id}`, {
        data: { cutAfter: 500, question: 'What is your name?', questionFlag: 'name' },
      })
    })

    // The Reader steps onto Pause, where the clock leaves them, so the Question
    // arriving moves no focus into its field and reaches them by the status alone.
    await page.clock.fastForward(500)
    const pause = page.getByRole('button', { name: 'Pause the Reading' })
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(pause).toBeFocused()

    await page.clock.fastForward(500)
    await expect(page.getByLabel('What is your name?')).toBeVisible()
    await expect(pause).toBeFocused()
    await expect(page.getByRole('status')
      .filter({ hasText: 'A Question waits for your answer.' })).toHaveCount(1)
  })
