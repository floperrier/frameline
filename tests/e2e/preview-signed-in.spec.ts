import { expect } from '@playwright/test'
import { test, writeStory } from './author'

test('an Author plays their own Story before anyone else can see it', async ({ page, request }) => {
  const story = await writeStory(request)

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('link', { name: 'Preview this Story' }).click()

  // One Shot at a time, and nothing to take while the Scene still has Shots.
  await expect(page.getByText('A door opens.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow her out' })).toBeHidden()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByText('She steps out.')).toBeVisible()

  // The Cut is offered at the end of the Scene, and taking it moves the Reading.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Follow her out' }).click()
  await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()

  // The bar has no Cut out of it, so the Reader is told the path ends there.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect(page.getByRole('status')).toHaveText('The path ends here.')

  await page.getByRole('button', { name: 'Read again from the start' }).click()
  await expect(page.getByText('A door opens.')).toBeVisible()
})

test('a Cut whose Condition fails is not among the ones offered', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes, cuts } = await (await request.get(`/api/stories/${story.id}`)).json()
  const street = scenes[0]

  // The street puts her coat on, and the way into the bar asks for it.
  await request.put(`/api/scenes/${street.id}/flags`, { data: { sets: { coat: 'on' } } })
  await request.put(`/api/cuts/${cuts[0].id}/condition`, {
    data: { condition: { flag: 'coat', is: 'on' } },
  })

  // A second way out of the street, asking for the coat she is wearing to be off.
  const alley = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The alley' },
  })).json()
  const shut = await (await request.post(`/api/scenes/${street.id}/cuts`, {
    data: { toSceneId: alley.id },
  })).json()
  await request.patch(`/api/cuts/${shut.id}`, { data: { text: 'Stay outside' } })
  await request.put(`/api/cuts/${shut.id}/condition`, {
    data: { condition: { flag: 'coat', is: 'off' } },
  })

  await page.goto(`/stories/${story.id}/preview`)
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Next Shot' }).click()

  // The Author is offered the one Cut whose Condition the Flags let through, and
  // is never shown the other — a failing Condition hides a Cut rather than
  // refusing it once taken.
  await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stay outside' })).toBeHidden()
})

test('the Reading is read by keyboard, and focus goes with each beat', async ({ page, request }) => {
  const story = await writeStory(request)
  await page.goto(`/stories/${story.id}/preview`)

  // Every beat replaces what was on screen, the control that was pressed
  // included, so the Reading has to say where the Reader now is: on the frame
  // while a Scene is playing, and on the first Cut once it has played out.
  // Without it focus falls to the document and the next Shot is a tab from the
  // top of the page.
  const focused = () => page.evaluate(() => document.activeElement?.className ?? '')

  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect.poll(focused).toContain('frame')

  await page.getByRole('button', { name: 'Next Shot' }).click()
  await expect.poll(focused).toContain('splice')

  await page.getByRole('button', { name: 'Follow her out' }).click()
  await expect.poll(focused).toContain('frame')
})
