import { expect } from '@playwright/test'
import { begin, readTheStory, seedPublished, test, writeStory } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Condition on a Flag holds however the value is spelt, and the Preview
 * reaches what an answer opens — issue #416. The Street asks for a word: its
 * way into the Vault waits on `rosebud`, and its way into the Bar on nothing at
 * all.
 */
test('an answer opens the way on that waits on it however it is spelt, and the Preview reaches it',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes, exits } = await (await request.get(`/api/stories/${story.id}`))
      .json() as StoryInEditor
    const street = scenes[0]!
    const vault = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The vault' },
    })).json()
    const gold = await (await request.post(`/api/scenes/${vault.id}/shots`)).json()
    await request.patch(`/api/shots/${gold.id}`, {
      data: { text: 'Gold, and {word} on the door.', description: '' },
    })
    const opens = await (await request.post(`/api/scenes/${street.id}/exits`, {
      data: { toSceneId: vault.id },
    })).json()
    await request.patch(`/api/exits/${opens.id}`, { data: { text: 'Open the vault' } })
    await request.put(`/api/exits/${opens.id}/conditions`, {
      data: { conditions: [{ flag: 'word', is: 'rosebud' }] },
    })
    await request.put(`/api/exits/${exits[0]!.id}/conditions`, {
      data: { conditions: [{ flag: 'word', is: '' }] },
    })
    await request.patch(`/api/scenes/${street.id}`, {
      data: { question: 'What is the word?', questionFlag: 'word' },
    })
    await seedPublished(story)

    // The Reader types it with capitals, an accent and spaces round it, and is
    // offered the way that waits on it and not the one that waits on nothing.
    await page.goto(`/read/${story.id}`)
    await begin(page)
    const reading = page.locator('.reading')
    await reading.getByRole('button', { name: 'Next Shot' }).click()
    await reading.getByRole('button', { name: 'Next Shot' }).click()
    const field = reading.getByLabel('What is the word?')
    await field.fill('  ROSÉBUD ')
    await field.press('Enter')
    await expect(reading.getByRole('button', { name: 'Open the vault' })).toBeVisible()
    await expect(reading.getByRole('button', { name: 'Follow her out' })).toHaveCount(0)
    await reading.getByRole('button', { name: 'Open the vault' }).click()
    await expect(reading.locator('.frame .shot')).toHaveText('Gold, and ROSÉBUD on the door.')

    // On the bench, a Condition's Flag field offers the Flag the Question holds,
    // as it offers one a Scene sets.
    await page.goto(`/stories/${story.id}?scene=${vault.id}`)
    await expect(page.locator(`[id="flag-${opens.id}-0"]`))
      .toHaveAttribute('list', `flags-${opens.id}-0`)
    await expect(page.locator(`[id="flags-${opens.id}-0"] option`)).toHaveAttribute('value', 'word')

    // The Preview opened on the Vault stands there, through the answer its way in
    // waits on, as the Condition spells it.
    const preview = await readTheStory(page)
    await expect(preview.locator('.frame .shot')).toHaveText('Gold, and rosebud on the door.')

    // Back across the Exit, the way waiting on nothing is listed as not offered;
    // and back again, the Question is put with that answer in its field.
    await preview.getByRole('button', { name: 'Step Back' }).click()
    await expect(preview.getByRole('button', { name: 'Open the vault' })).toBeVisible()
    await expect(preview.locator('.hidden')).toContainText('Follow her out')
    await preview.getByRole('button', { name: 'Step Back' }).click()
    await expect(preview.getByLabel('What is the word?')).toHaveValue('rosebud')
  })
