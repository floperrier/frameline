import { expect, type APIRequestContext } from '@playwright/test'
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
  await request.put(`/api/cuts/${cuts[0].id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })

  // A second way out of the street, asking for the coat she is wearing to be off.
  const alley = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The alley' },
  })).json()
  const shut = await (await request.post(`/api/scenes/${street.id}/cuts`, {
    data: { toSceneId: alley.id },
  })).json()
  await request.patch(`/api/cuts/${shut.id}`, { data: { text: 'Stay outside' } })
  await request.put(`/api/cuts/${shut.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'off' }] },
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

/**
 * A Story whose ways on ask for things: the street puts a coat on, one way out
 * wants it off, and another wants the street entered twice. Neither is offered
 * on a first reading, which is exactly the Author's question — why not.
 */
async function writeConditionalStory(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`)).json()
  const street = scenes[0]

  await request.put(`/api/scenes/${street.id}/flags`, { data: { sets: { coat: 'on' } } })

  for (const [name, text, conditions] of [
    ['The alley', 'Stay outside', [{ flag: 'coat', is: 'off' }]],
    ['The stairs', 'Go up', [{ scene: street.id, visits: 'at least', times: 2 }]],
  ] as const) {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json()
    const cut = await (await request.post(`/api/scenes/${street.id}/cuts`, {
      data: { toSceneId: scene.id },
    })).json()
    await request.patch(`/api/cuts/${cut.id}`, { data: { text } })
    await request.put(`/api/cuts/${cut.id}/conditions`, { data: { conditions } })
  }

  return story
}

test('the Preview shows the Author the State the Reading has accumulated', async ({ page, request }) => {
  const story = await writeConditionalStory(request)

  await page.goto(`/stories/${story.id}/preview`)
  const bench = page.locator('.bench')

  // On the very first Shot, before the Scene has played out: what the street set
  // on entry, and the visit it was entered on.
  await expect(bench.getByText('coat = on')).toBeVisible()
  await expect(bench.getByText('The street × 1')).toBeVisible()

  // Nothing the Reading has not touched is listed — the alley is a Scene of this
  // Story, and no Reading has been in it.
  await expect(bench.getByText('The alley')).toBeHidden()

  // The bar sets no Flags, so arriving there leaves the coat where the street
  // put it and adds a Scene to the count.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Follow her out' }).click()
  await expect(bench.getByText('The bar × 1')).toBeVisible()
  await expect(bench.getByText('coat = on')).toBeVisible()
})

test('the Preview says why a way on is missing, and does not offer it', async ({ page, request }) => {
  const story = await writeConditionalStory(request)

  await page.goto(`/stories/${story.id}/preview`)
  const bench = page.locator('.bench')

  // While a Shot is playing there are no ways on to explain: the Scene has not
  // asked anything yet.
  await expect(bench.getByText('Ways on this Reading is not offered')).toBeHidden()

  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Next Shot' }).click()

  // The way on that holds is offered as a control, and the two the State hides
  // are on the bench instead, struck through and each naming the test it failed
  // with both values — a Flag holding something else, and a Scene not entered
  // often enough yet.
  await expect(page.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  await expect(bench.locator('s').filter({ hasText: 'Stay outside' })).toBeVisible()
  await expect(bench.getByText('needs coat to hold off, holds on')).toBeVisible()
  await expect(bench.getByText('needs at least 2 visits to The street, entered once'))
    .toBeVisible()

  // A hidden way on is text on a bench and nothing more: no control, and so no
  // keyboard path that could take it.
  await expect(page.getByRole('button', { name: 'Stay outside' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Go up' })).toHaveCount(0)
})

test('a Reader of the published Story is shown none of the bench', async ({ page, request, browser, baseURL }) => {
  const story = await writeConditionalStory(request)
  await request.post(`/api/stories/${story.id}/publish`)

  const reader = await (await browser.newContext()).newPage()
  await reader.goto(`${baseURL}/read/${story.id}`)

  // The same engine, the same Shots, the same one way on — and not a word about
  // the State behind them or the ways on it is hiding.
  await expect(reader.getByText('A door opens.')).toBeVisible()
  await reader.getByRole('button', { name: 'Next Shot' }).click()
  await reader.getByRole('button', { name: 'Next Shot' }).click()
  await expect(reader.getByRole('button', { name: 'Follow her out' })).toBeVisible()

  await expect(reader.locator('.bench')).toHaveCount(0)
  await expect(reader.locator('s')).toHaveCount(0)
  await expect(reader.getByText('coat')).toHaveCount(0)
  await expect(reader.getByText('Stay outside')).toHaveCount(0)
})
