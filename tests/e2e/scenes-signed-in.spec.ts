import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { CONDITIONS_MAX, SCENE_NAME_MAX_LENGTH, VISITS_MAX } from '../../shared/utils/scenes'
import {
  openNode, readSceneName, readShotConditions, readShots, seedScene, seedStory, test,
} from './author'

const noId = '00000000-0000-4000-8000-000000000000'

/** A Story with one Scene in it, which is where every test below starts. */
async function openScene(request: APIRequestContext, name = 'A Scene') {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  const created = await request.post(`/api/stories/${story.id}/scenes`, { data: { name } })
  expect(created.status()).toBe(201)

  return { story, scene: await created.json() }
}

/** Adds Shots to a Scene, writing the given text to each. */
async function writeShots(request: APIRequestContext, sceneId: string, texts: string[]) {
  const shots = []
  for (const text of texts) {
    const added = await request.post(`/api/scenes/${sceneId}/shots`)
    expect(added.status()).toBe(201)
    const shot = await added.json()
    await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
    shots.push(shot)
  }

  return shots
}

test('an Author writes a Scene as a run of Shots', async ({ request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['She steps off the train.', 'The platform is empty.'])

  const read = await (await request.get(`/api/stories/${story.id}`)).json()

  expect(read).toMatchObject({
    id: story.id,
    title: 'A Story',
    scenes: [{
      id: scene.id,
      name: 'The arrival',
      shots: [
        { text: 'She steps off the train.', position: 0 },
        { text: 'The platform is empty.', position: 1 },
      ],
    }],
  })
})

test('a Scene needs a name', async ({ request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()

  const response = await request.post(`/api/stories/${story.id}/scenes`, { data: { name: '  ' } })

  expect(response.status()).toBe(400)
  expect((await response.json()).message).toContain('A Scene needs a name.')
})

test('an Author corrects the name of a Scene', async ({ request }) => {
  const { story, scene } = await openScene(request, 'The arival')

  const renamed = await request.patch(
    `/api/scenes/${scene.id}`, { data: { name: 'The arrival', x: scene.x, y: scene.y } })

  expect(renamed.status()).toBe(200)
  await expect(renamed.json()).resolves.toMatchObject({ id: scene.id, name: 'The arrival' })
  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{ id: scene.id, name: 'The arrival' }],
  })
})

test('a Scene keeps its name where a request carries none', async ({ request }) => {
  const { scene } = await openScene(request, 'The arrival')

  const moved = await request.patch(`/api/scenes/${scene.id}`, { data: { x: 40, y: 60 } })

  expect(moved.status()).toBe(200)
  await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
})

test('a Scene cannot be renamed to nothing, or to more than a name', async ({ request }) => {
  const { scene } = await openScene(request, 'The arrival')
  const rename = (name: string) => request.patch(
    `/api/scenes/${scene.id}`, { data: { name, x: scene.x, y: scene.y } })

  const refused = await Promise.all([rename('  '), rename('x'.repeat(SCENE_NAME_MAX_LENGTH + 1))])

  expect(refused.map(response => response.status())).toEqual([400, 400])
  expect((await refused[0]!.json()).message).toContain('A Scene needs a name.')
  expect((await refused[1]!.json()).message).toContain('cannot be longer than')
  // The refusals have to mean the Scene was left alone, not merely that the
  // answer said nothing about a name that was written anyway.
  await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
})

test('an Author renames a Scene in its node', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arival')
  await page.goto(`/stories/${story.id}`)

  // Folded, the node says the name rather than offering it to be written.
  await expect(page.getByRole('heading', { name: 'The arival' })).toBeVisible()
  await openNode(page, 'The arival')

  // Leaving the field is what writes it, as it is for a Shot and for a Cut.
  const named = page.getByRole('textbox', { name: 'Name of this Scene' })
  await named.fill('The arrival')
  await named.blur()

  await expect(async () => {
    await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
  }).toPass()
  // And the node answers to the new name, heading or no heading: the name it
  // carries is the Scene's, so everything that says which Scene this is has
  // followed the correction.
  await expect(page.getByRole('article', { name: 'The arrival' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fold Scene The arrival' })).toBeVisible()
  // The heading is the field, so what it is called is what the field holds: the
  // label saying which Scene this is sits outside it rather than in front of the
  // name.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
})

test('a Scene renamed to nothing is left as it was', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await page.goto(`/stories/${story.id}`)
  await openNode(page, 'The arrival')

  const named = page.getByRole('textbox', { name: 'Name of this Scene' })
  await named.fill('  ')
  await named.blur()

  await expect(page.getByRole('alert')).toHaveText('A Scene needs a name.')
  // The refusal reads the Story back, so the field says what the Scene is
  // really called rather than the nothing that was refused.
  await expect(named).toHaveValue('The arrival')
  await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
})

test('the Shots of a Scene are renumbered as one sequence', async ({ request }) => {
  const { story, scene } = await openScene(request)
  const [first, second, third] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])
  const inOrder = (...shots: { id: string }[]) => ({ data: { places: shots.map(shot => shot.id) } })

  const renumbered = await request.put(
    `/api/scenes/${scene.id}/shots/places`, inOrder(third!, first!, second!))

  expect(renumbered.status()).toBe(200)
  await expect(readShots(scene.id)).resolves.toMatchObject([
    { text: 'Third', position: 0 }, { text: 'First', position: 1 }, { text: 'Second', position: 2 },
  ])

  // And the Story is read in that order, which is the order the Reader plays.
  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{ shots: [{ text: 'Third' }, { text: 'First' }, { text: 'Second' }] }],
  })
})

test('a sequence a Scene does not hold leaves its Places alone', async ({ request }) => {
  const { scene } = await openScene(request)
  const [first, second, third] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])
  const { scene: elsewhere } = await openScene(request, 'Another Scene')
  const [foreign] = await writeShots(request, elsewhere.id, ['Somewhere else'])
  const ids = (...shots: { id: string }[]) => shots.map(shot => shot.id)

  const refused = await Promise.all([
    // One missing, one foreign, one twice: each of the three ways a sequence
    // stops being the Scene's own numbering.
    ids(third!, first!),
    ids(third!, first!, second!, foreign!),
    ids(third!, first!, second!, second!),
  ].map(places => request.put(`/api/scenes/${scene.id}/shots/places`, { data: { places } })))

  for (const response of refused) {
    expect(response.status()).toBe(400)
    expect((await response.json()).message).toContain('renumbered all at once')
  }

  await expect(readShots(scene.id)).resolves.toMatchObject([
    { text: 'First', position: 0 }, { text: 'Second', position: 1 }, { text: 'Third', position: 2 },
  ])
})

test('an Author renumbers the Shots of a Scene from the controls', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['First', 'Second', 'Third'])

  await page.goto(`/stories/${story.id}`)
  await openNode(page, 'The arrival')
  await page.getByRole('button', { name: 'Move later Shot 1' }).click()

  // The control sends the whole run in its new order, so what the Scene holds is
  // the numbering and not a swap the page kept to itself.
  await expect(async () => {
    await expect(readShots(scene.id)).resolves.toMatchObject([
      { text: 'Second', position: 0 },
      { text: 'First', position: 1 },
      { text: 'Third', position: 2 },
    ])
  }).toPass()

  await page.reload()
  await openNode(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('Second')
})

test.describe('dragging a Shot', () => {
  // Tall enough that a Scene of three Shots is on screen at once, because the
  // drag reaches only what the Author can see: there is no auto-scroll at the
  // edge of the run, and the page says so where the gesture is written.
  test.use({ viewport: { width: 1280, height: 1400 }, hasTouch: true })

  test('an Author drags a Shot by its number to the Place it belongs', async ({
    page, request,
  }) => {
    const { story, scene } = await openScene(request, 'The arrival')
    const [first, , third] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])
    const number = (shot: { id: string }) => page.locator(`[data-shot="${shot.id}"] .shot-number`)

    await page.goto(`/stories/${story.id}`)
    await openNode(page, 'The arrival')
    await dragShot(page, number(first!), number(third!))

    // Dropped on the Shot that stood last, it takes that Place and the two it
    // passed come up one apiece: a drag crosses the run rather than swapping
    // with a neighbour, which is what it is for.
    await expect(async () => {
      await expect(readShots(scene.id)).resolves.toMatchObject([
        { text: 'Second', position: 0 },
        { text: 'Third', position: 1 },
        { text: 'First', position: 2 },
      ])
    }).toPass()

    await page.reload()
    await openNode(page, 'The arrival')
    await expect(page.getByRole('textbox', { name: 'Shot 3' })).toHaveValue('First')

    // A finger says nothing here: it scrolls the node, and the two controls are
    // its route to the same renumbering. The same gesture as above, aimed at the
    // same two Shots and carrying the same points — everything but the finger it
    // is made with — so what leaves the Scene as it was is the finger itself.
    //
    // What this pins is the scrolling: give the number a `touch-action` of none
    // and the finger renumbers, which is the browser saying the gesture was the
    // page's rather than the scroller's. The Shot drag refuses a finger twice
    // over, and the second refusal — `pointerType`, for a run with nothing to
    // scroll — is not one an assertion here can tell apart from the first.
    await touchShot(page, number(third!), number(first!))
    await expect(readShots(scene.id)).resolves.toMatchObject([
      { text: 'Second', position: 0 },
      { text: 'Third', position: 1 },
      { text: 'First', position: 2 },
    ])
  })

  test('a Shot let go of over another Scene is left where it was', async ({ page, request }) => {
    const { story, scene } = await openScene(request, 'The arrival')
    const [first] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])
    const elsewhere = await (await request.post(`/api/stories/${story.id}/scenes`,
      { data: { name: 'The platform' } })).json()
    const [theirs] = await writeShots(request, elsewhere.id, ['Theirs'])
    const number = (shot: { id: string }) => page.locator(`[data-shot="${shot.id}"] .shot-number`)

    // Side by side, so both runs are on the bench at once and the hand can carry
    // a Shot from one node into the other.
    await request.patch(`/api/scenes/${scene.id}`, { data: { x: 0, y: 0 } })
    await request.patch(`/api/scenes/${elsewhere.id}`, { data: { x: 360, y: 0 } })

    await page.goto(`/stories/${story.id}`)
    await openNode(page, 'The arrival')
    await openNode(page, 'The platform')
    await dragShot(page, number(first!), number(theirs!))

    // A row of another Scene is no Place of this one, so neither Scene was
    // renumbered: the drop said nothing rather than something else.
    await expect(readShots(scene.id)).resolves.toMatchObject([
      { text: 'First', position: 0 },
      { text: 'Second', position: 1 },
      { text: 'Third', position: 2 },
    ])
    await expect(readShots(elsewhere.id)).resolves.toMatchObject([{ text: 'Theirs', position: 0 }])
  })

  /**
   * The same drag by finger rather than by mouse. Driven through the browser
   * itself — Playwright's touchscreen taps but does not drag — so the page
   * answers a real finger rather than an event a test made up, which is the
   * whole of what is under test here.
   */
  async function touchShot(page: Page, held: Locator, onto: Locator) {
    const from = await pointOn(held)
    const to = await pointOn(onto)
    const finger = await page.context().newCDPSession(page)
    const touch = (type: string, at: { x: number, y: number }) => finger.send(
      'Input.dispatchTouchEvent',
      { type, touchPoints: type === 'touchEnd' ? [] : [{ x: at.x, y: at.y }] },
    )

    await touch('touchStart', from)
    await touch('touchMove', to)
    await touch('touchEnd', to)
    await page.waitForTimeout(500)
  }

  /**
   * Drags a Shot by its number onto another's, which is what renumbers a Scene
   * by hand. By mouse, because that is the input the gesture answers to.
   *
   * Aimed at the top of each number rather than its middle: a number is as tall
   * as the Shot it belongs to, and the third of them has its middle below the
   * bench a Scene is opened on — which is the ceiling the drag is written with.
   */
  async function dragShot(page: Page, held: Locator, onto: Locator) {
    const from = await pointOn(held)
    const to = await pointOn(onto)

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 5 })
    await page.mouse.up()
  }

  /** Where on a Shot's number a gesture takes hold of it. */
  async function pointOn(number: Locator) {
    const box = (await number.boundingBox())!

    return { x: box.x + box.width / 2, y: box.y + 12 }
  }
})

test('deleting a Shot leaves the Scene numbered without a gap', async ({ request }) => {
  const { scene } = await openScene(request)
  const [, second] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])

  expect((await request.delete(`/api/shots/${second!.id}`)).status()).toBe(200)

  await expect(readShots(scene.id)).resolves.toEqual([
    { id: expect.any(String), text: 'First', position: 0 },
    { id: expect.any(String), text: 'Third', position: 1 },
  ])

  // A Shot that is gone stays gone, however it is reached for.
  expect((await request.delete(`/api/shots/${second!.id}`)).status()).toBe(404)
})

test('deleting a Scene takes its Shots with it', async ({ request }) => {
  const { story, scene } = await openScene(request)
  await writeShots(request, scene.id, ['First', 'Second'])

  expect((await request.delete(`/api/scenes/${scene.id}`)).status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ scenes: [] })
  await expect(readShots(scene.id)).resolves.toEqual([])
})

test('a Scene that was never written reads as absent', async ({ request }) => {
  const responses = await Promise.all([
    request.get(`/api/stories/${noId}`),
    request.post(`/api/stories/${noId}/scenes`, { data: { name: 'A Scene' } }),
    request.delete(`/api/scenes/${noId}`),
    request.post(`/api/scenes/${noId}/shots`),
    request.patch(`/api/shots/${noId}`, { data: { text: 'A line', description: '' } }),
    request.put(`/api/scenes/${noId}/shots/places`, { data: { places: [noId] } }),
    request.delete(`/api/shots/${noId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)
})

test('Scenes and Shots belong to the Author who wrote the Story', async ({ request, otherAuthor }) => {
  const theirStory = await seedStory(otherAuthor, 'Their Story')
  const theirScene = await seedScene(theirStory, 'Their Scene')
  const theirShot = theirScene.shots[0]!

  const responses = await Promise.all([
    request.get(`/api/stories/${theirStory.id}`),
    request.post(`/api/stories/${theirStory.id}/scenes`, { data: { name: 'Mine now' } }),
    request.delete(`/api/scenes/${theirScene.id}`),
    request.post(`/api/scenes/${theirScene.id}/shots`),
    request.patch(`/api/shots/${theirShot.id}`, { data: { text: 'Mine now', description: '' } }),
    request.put(`/api/scenes/${theirScene.id}/shots/places`,
      { data: { places: [theirShot.id] } }),
    request.delete(`/api/shots/${theirShot.id}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)

  // The 404s have to mean the Scene was left alone, not merely that the answer
  // said nothing about a Scene that was changed anyway.
  await expect(readShots(theirScene.id)).resolves.toEqual([theirShot])
})

test('the Story page shows a Scene and the Shots in it', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['She steps off the train.'])

  await page.goto(`/stories/${story.id}`)

  // A node is folded until the Author opens it: what a Scene is made of is read
  // there, and the graph is read without it.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await openNode(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')

  await page.getByRole('button', { name: 'Add Shot' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
})

test('an Author writes a Story from the page alone', async ({ page, request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await page.goto(`/stories/${story.id}`)

  await page.getByLabel('Name of a new Scene').fill('The arrival')
  await page.getByRole('button', { name: 'Create Scene' }).click()
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await expect(page.getByText('“The arrival” created')).toBeVisible()
  await openNode(page, 'The arrival')

  // Blurring the Shot is what writes it, so each is left before the next is added.
  for (const [place, line] of ['She steps off the train.', 'The platform is empty.'].entries()) {
    await page.getByRole('button', { name: 'Add Shot' }).click()
    const shot = page.getByRole('textbox', { name: `Shot ${place + 1}` })
    await expect(shot).toBeVisible()
    await shot.fill(line)
    await shot.blur()
    await expect(shot).toHaveValue(line)
  }

  await page.getByRole('button', { name: 'Move earlier Shot 2' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('The platform is empty.')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toHaveValue('She steps off the train.')

  // What the page shows has to be what was written, not what the page remembers.
  await page.reload()
  await openNode(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('The platform is empty.')

  await page.getByRole('button', { name: 'Delete Shot 1' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeHidden()

  // Deleting a Scene takes Shots with it, so it is asked about first.
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete Scene The arrival' }).click()
  await expect(page.getByText('No Scenes yet.')).toBeVisible()
})

test('a Shot carries the Conditions it plays under', async ({ request }) => {
  const { story, scene } = await openScene(request, 'The booth')
  const [always, onReturn] = await writeShots(
    request, scene.id, ['The projector ticks over.', 'You have been here before.'])

  const written = await request.put(`/api/shots/${onReturn!.id}/conditions`, {
    data: { conditions: [{ scene: scene.id, visits: 'at least', times: 2 }] },
  })
  expect(written.status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{
      shots: [
        { id: always!.id, conditions: [] },
        { id: onReturn!.id, conditions: [{ scene: scene.id, visits: 'at least', times: 2 }] },
      ],
    }],
  })

  // Sending none is how a Shot goes back to playing for every Reading.
  await request.put(`/api/shots/${onReturn!.id}/conditions`, { data: {} })
  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{ shots: [{ conditions: [] }, { conditions: [] }] }],
  })
})

test('a Shot’s Conditions are refused where a Cut’s would be', async ({
  request,
  otherAuthor,
}) => {
  const { story, scene } = await openScene(request, 'The booth')
  const [shot] = await writeShots(request, scene.id, ['The projector ticks over.'])
  await request.put(`/api/shots/${shot!.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })

  const elsewhere = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')

  const refused = await Promise.all([
    // The same flat language, so the same refusals — one reader serves both.
    request.put(`/api/shots/${shot!.id}/conditions`, {
      data: { conditions: [{ flag: '', is: 'on' }] },
    }),
    request.put(`/api/shots/${shot!.id}/conditions`, { data: { conditions: [{ of: 'nothing' }] } }),
    request.put(`/api/shots/${shot!.id}/conditions`, {
      data: { conditions: [{ scene: scene.id, visits: 'at least', times: VISITS_MAX + 1 }] },
    }),
    request.put(`/api/shots/${shot!.id}/conditions`, {
      data: {
        conditions: Array.from({ length: CONDITIONS_MAX + 1 },
          (_, place) => ({ flag: `flag ${place}`, is: 'set' })),
      },
    }),
  ])
  for (const response of refused) expect(response.status()).toBe(400)

  // A Scene outside this Story is a Scene this Condition cannot count, and
  // another Author's Shot is one nobody here can write at all.
  const outside = await request.put(`/api/shots/${shot!.id}/conditions`, {
    data: { conditions: [{ scene: elsewhere.id, visits: 'at least', times: 2 }] },
  })
  expect(outside.status()).toBe(404)
  const theirs = await request.put(`/api/shots/${elsewhere.shots[0]!.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })
  expect(theirs.status()).toBe(404)

  // Every refusal left what the Author had already written where it was.
  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ scenes: [{ shots: [{ conditions: [{ flag: 'coat', is: 'on' }] }] }] })
})

test('an Author puts a Condition on a Shot from the page alone', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The booth')
  await writeShots(request, scene.id, ['The projector ticks over.'])

  await page.goto(`/stories/${story.id}`)
  await openNode(page, 'The booth')

  await page.getByRole('button', { name: 'Add a Condition to Shot 1 of The booth' }).click()
  // A visit count is whole the moment it is chosen, and starts on the Scene the
  // Shot belongs to — the return the Author is writing for.
  await page
    .getByLabel('Condition 1 of Shot 1 of The booth', { exact: true })
    .selectOption('visits')

  await expect(async () => {
    await expect(readShotConditions(scene.id)).resolves.toEqual([
      [{ scene: scene.id, visits: 'at least', times: 2 }],
    ])
  }).toPass()

  // What the page shows has to be what was written, not what the page remembers.
  await page.reload()
  await openNode(page, 'The booth')
  await expect(page.getByLabel('Condition 1 of Shot 1 of The booth', { exact: true }))
    .toHaveValue('visits')
  await expect(page.getByLabel('times for Condition 1 of Shot 1 of The booth')).toHaveValue('2')

  await page.getByRole('button', { name: 'Remove Condition 1 of Shot 1 of The booth' }).click()
  await expect(async () => {
    await expect(readShotConditions(scene.id)).resolves.toEqual([[]])
  }).toPass()
})
