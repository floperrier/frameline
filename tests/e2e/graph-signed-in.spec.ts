import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  CUT_CONDITIONS_MAX,
  FLAGS_PER_SCENE,
  GRAPH_REACH,
  NODE_GAP,
  NODE_WIDTH,
  NODES_PER_COLUMN,
  VISITS_MAX,
} from '../../shared/utils/scenes'
import {
  readCuts,
  readFlags,
  readScenePlacement,
  seedCut,
  seedScene,
  seedScenes,
  seedStory,
  test,
} from './author'

/** Draws a Cut between the two Scenes of a graph, as the page's own form would. */
async function drawCut(request: APIRequestContext, fromSceneId: string, toSceneId: string) {
  const drawn = await request.post(`/api/scenes/${fromSceneId}/cuts`, { data: { toSceneId } })
  expect(drawn.status()).toBe(201)
  return await drawn.json()
}

const noId = '00000000-0000-4000-8000-000000000000'

/** A Story with two Scenes, which is the smallest graph a Cut can join. */
async function openGraph(request: APIRequestContext, names = ['The arrival', 'The platform']) {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  const scenes = []
  for (const name of names) {
    const created = await request.post(`/api/stories/${story.id}/scenes`, { data: { name } })
    expect(created.status()).toBe(201)
    scenes.push(await created.json())
  }

  return { story, scenes }
}

test('every Scene is a node of the graph, and the first one opens the Story', async ({ request }) => {
  const { story, scenes } = await openGraph(request)

  const read = await (await request.get(`/api/stories/${story.id}`)).json()

  expect(read).toMatchObject({
    openingSceneId: scenes[0]!.id,
    scenes: [
      { id: scenes[0]!.id, name: 'The arrival', x: expect.any(Number), y: expect.any(Number) },
      { id: scenes[1]!.id, name: 'The platform', x: expect.any(Number), y: expect.any(Number) },
    ],
    cuts: [],
  })

  // Scenes are laid out apart from one another, so a new one is not hidden under
  // the last until the Author has moved it.
  expect(read.scenes[0].y).not.toBe(read.scenes[1].y)
})

test('a Scene node stays where the Author put it', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const scene = scenes[0]!

  const moved = await request.patch(`/api/scenes/${scene.id}`, { data: { x: 420, y: 260 } })

  expect(moved.status()).toBe(200)
  await expect(moved.json()).resolves.toMatchObject({ id: scene.id, x: 420, y: 260 })
  const read = await (await request.get(`/api/stories/${story.id}`)).json()
  expect(read.scenes[0]).toMatchObject({ id: scene.id, x: 420, y: 260 })
})

test('a Scene cannot be put out of the graph’s reach', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const scene = scenes[0]!

  const refused = await Promise.all([
    request.patch(`/api/scenes/${scene.id}`, { data: { x: -1, y: 0 } }),
    request.patch(`/api/scenes/${scene.id}`, { data: { x: 0, y: GRAPH_REACH + 1 } }),
    request.patch(`/api/scenes/${scene.id}`, { data: { x: 'over there', y: 0 } }),
  ])

  for (const response of refused) expect(response.status()).toBe(400)
  await expect(readScenePlacement(scene.id)).resolves.toMatchObject({ x: 0 })
})

test('Scenes go on in columns, so that none is placed out of reach', async ({ request }) => {
  const names = Array.from({ length: NODES_PER_COLUMN + 1 }, (_, place) => `Scene ${place + 1}`)
  const { scenes } = await openGraph(request, names)

  // The column the Author has filled is left for a new one beside it, rather
  // than going on down past the far edge of the graph.
  expect(scenes.at(-1)).toMatchObject({ x: NODE_WIDTH + NODE_GAP, y: 0 })
  for (const scene of scenes) {
    expect(scene.y).toBeLessThanOrEqual(GRAPH_REACH)
    expect(scene.x).toBeLessThanOrEqual(GRAPH_REACH)
  }
})

test('a Cut without text is refused rather than emptied', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const drawn = await request.post(`/api/scenes/${scenes[0]!.id}/cuts`, {
    data: { toSceneId: scenes[1]!.id },
  })
  const cut = await drawn.json()
  await request.patch(`/api/cuts/${cut.id}`, { data: { text: 'Follow her out' } })

  const response = await request.patch(`/api/cuts/${cut.id}`, { data: {} })

  expect(response.status()).toBe(400)
  await expect(readCuts(scenes[0]!.id)).resolves.toMatchObject([{ text: 'Follow her out' }])
})

test('a Cut is drawn between two Scenes, written, and taken away', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]

  const drawn = await request.post(`/api/scenes/${from.id}/cuts`, { data: { toSceneId: to.id } })
  expect(drawn.status()).toBe(201)
  const cut = await drawn.json()
  expect(cut).toMatchObject({ fromSceneId: from.id, toSceneId: to.id, text: '' })

  // The text is what the Reader will be offered, so it is written after the Cut
  // is drawn, as a Shot is.
  const written = await request.patch(`/api/cuts/${cut.id}`, { data: { text: 'Follow her out' } })
  expect(written.status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    cuts: [{ id: cut.id, fromSceneId: from.id, toSceneId: to.id, text: 'Follow her out' }],
  })

  expect((await request.delete(`/api/cuts/${cut.id}`)).status()).toBe(200)
  await expect(readCuts(from.id)).resolves.toEqual([])
})

test('the ways on are offered in the order the Author put them in', async ({ request }) => {
  const { story, scenes } = await openGraph(
    request, ['The platform', 'The buffet', 'The tunnel', 'The train'])
  const [from, ...elsewhere] = scenes as [{ id: string }, ...{ id: string }[]]
  const drawn = []
  for (const [place, to] of elsewhere.entries()) {
    const cut = await drawCut(request, from.id, to.id)
    // The Cut is drawn last among the ways on, which is where a new one belongs.
    expect(cut.position).toBe(place)
    await request.patch(`/api/cuts/${cut.id}`, { data: { text: `To ${place}` } })
    drawn.push(cut)
  }
  const [first, second, third] = drawn as [{ id: string }, { id: string }, { id: string }]

  await request.post(`/api/cuts/${third.id}/move`, { data: { direction: 'earlier' } })
  await expect(readCuts(from.id)).resolves.toMatchObject([
    { text: 'To 0' }, { text: 'To 2' }, { text: 'To 1' },
  ])

  await request.post(`/api/cuts/${first.id}/move`, { data: { direction: 'later' } })
  await expect(readCuts(from.id)).resolves.toMatchObject([
    { text: 'To 2' }, { text: 'To 0' }, { text: 'To 1' },
  ])

  // The Cuts at either end have nowhere to go, and asking is not an error.
  const atTheEnds = await Promise.all([
    request.post(`/api/cuts/${third.id}/move`, { data: { direction: 'earlier' } }),
    request.post(`/api/cuts/${second.id}/move`, { data: { direction: 'later' } }),
  ])
  for (const response of atTheEnds) expect(response.status()).toBe(200)

  // And the Story is read in that order, which is the order the Reader meets.
  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    cuts: [
      { text: 'To 2', position: 0 },
      { text: 'To 0', position: 1 },
      { text: 'To 1', position: 2 },
    ],
  })
})

test('taking a Cut away leaves the ways on numbered without a gap', async ({ request }) => {
  const { scenes } = await openGraph(request, ['The platform', 'The buffet', 'The tunnel'])
  const [from, ...elsewhere] = scenes as [{ id: string }, ...{ id: string }[]]
  const drawn = []
  for (const to of elsewhere) drawn.push(await drawCut(request, from.id, to.id))

  expect((await request.delete(`/api/cuts/${drawn[0]!.id}`)).status()).toBe(200)

  await expect(readCuts(from.id)).resolves.toMatchObject([{ id: drawn[1]!.id, position: 0 }])
})

test('a way on can still be moved across a Scene deleted out from under one',
  async ({ request }) => {
    const { scenes } = await openGraph(
      request, ['The platform', 'The buffet', 'The tunnel', 'The train'])
    const [from, buffet, tunnel, train] = scenes as { id: string }[] as
      [{ id: string }, { id: string }, { id: string }, { id: string }]
    const drawn = []
    for (const to of [buffet, tunnel, train]) drawn.push(await drawCut(request, from.id, to.id))

    // Deleting the Scene in the middle takes the Cut arriving at it by cascade,
    // which is the one way a Cut leaves without closing the gap behind it.
    expect((await request.delete(`/api/scenes/${tunnel.id}`)).status()).toBe(200)
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { toSceneId: buffet.id, position: 0 }, { toSceneId: train.id, position: 2 },
    ])

    // The way on after the hole still moves earlier across it, rather than being
    // answered with a move that did nothing.
    expect((await request.post(`/api/cuts/${drawn[2]!.id}/move`,
      { data: { direction: 'earlier' } })).status()).toBe(200)
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { toSceneId: train.id }, { toSceneId: buffet.id },
    ])
  })

test('a Cut only joins Scenes of the same Story', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const elsewhere = await openGraph(request, ['Another Scene'])

  const response = await request.post(`/api/scenes/${scenes[0]!.id}/cuts`, {
    data: { toSceneId: elsewhere.scenes[0]!.id },
  })

  expect(response.status()).toBe(404)
  await expect(readCuts(scenes[0]!.id)).resolves.toEqual([])
})

test('the opening Scene can be changed', async ({ request }) => {
  const { story, scenes } = await openGraph(request)

  const opened = await request.post(`/api/scenes/${scenes[1]!.id}/opening`)

  expect(opened.status()).toBe(200)
  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ openingSceneId: scenes[1]!.id })
})

test('deleting a Scene takes the Cuts touching it, and the opening with it', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const [opening, other] = scenes as [{ id: string }, { id: string }]
  await request.post(`/api/scenes/${opening.id}/cuts`, { data: { toSceneId: other.id } })
  await request.post(`/api/scenes/${other.id}/cuts`, { data: { toSceneId: opening.id } })

  expect((await request.delete(`/api/scenes/${opening.id}`)).status()).toBe(200)

  // Both Cuts are gone — the one that left the Scene and the one that arrived —
  // and the Story is left with no opening Scene for the Author to name again.
  await expect(readCuts(other.id)).resolves.toEqual([])
  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ openingSceneId: null, cuts: [] })
})

test('a graph that was never drawn reads as absent', async ({ request }) => {
  const { scenes } = await openGraph(request)

  const responses = await Promise.all([
    request.patch(`/api/scenes/${noId}`, { data: { x: 10, y: 10 } }),
    request.post(`/api/scenes/${noId}/opening`),
    request.post(`/api/scenes/${noId}/cuts`, { data: { toSceneId: scenes[0]!.id } }),
    request.post(`/api/scenes/${scenes[0]!.id}/cuts`, { data: { toSceneId: noId } }),
    request.patch(`/api/cuts/${noId}`, { data: { text: 'Follow her' } }),
    request.put(`/api/cuts/${noId}/conditions`, { data: {} }),
    request.put(`/api/scenes/${noId}/flags`, { data: { sets: {} } }),
    request.post(`/api/cuts/${noId}/move`, { data: { direction: 'earlier' } }),
    request.delete(`/api/cuts/${noId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)
})

test('the graph belongs to the Author who wrote the Story', async ({ request, otherAuthor }) => {
  const theirStory = await seedStory(otherAuthor, 'Their Story')
  const theirScene = await seedScene(theirStory, 'Their Scene')
  const theirOther = await seedScene(theirStory, 'Their other Scene')
  const theirCut = await seedCut(theirScene.id, theirOther.id)

  const responses = await Promise.all([
    request.patch(`/api/scenes/${theirScene.id}`, { data: { x: 999, y: 999 } }),
    request.post(`/api/scenes/${theirScene.id}/opening`),
    request.post(`/api/scenes/${theirScene.id}/cuts`, { data: { toSceneId: theirOther.id } }),
    request.patch(`/api/cuts/${theirCut.id}`, { data: { text: 'Mine now' } }),
    request.put(`/api/cuts/${theirCut.id}/conditions`, {
      data: { conditions: [{ flag: 'mine', is: 'now' }] },
    }),
    request.put(`/api/scenes/${theirScene.id}/flags`, { data: { sets: { mine: 'now' } } }),
    request.post(`/api/cuts/${theirCut.id}/move`, { data: { direction: 'later' } }),
    request.delete(`/api/cuts/${theirCut.id}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)

  // The 404s have to mean the graph was left alone, not merely that the answer
  // said nothing about a graph that was changed anyway.
  await expect(readScenePlacement(theirScene.id)).resolves.toMatchObject({ x: 0, y: 0 })
  await expect(readCuts(theirScene.id)).resolves.toEqual([theirCut])
  await expect(readFlags(theirScene.id)).resolves.toEqual({})
})

test('an Author lays out the graph from the page alone', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  const node = page.getByRole('article', { name: 'The arrival' })
  await expect(node).toBeVisible()

  // The handle moves the node by the keyboard as well as by the pointer, which
  // is also the only way a test can say where a Scene ended up.
  const handle = page.getByRole('button', { name: 'Move Scene The arrival' })
  await handle.click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(async () => {
    const node = await readScenePlacement(scenes[0]!.id)
    expect(node).toMatchObject({ x: 20, y: 20 })
  }).toPass()

  // And the pointer drags it, which is how an Author actually lays out a graph.
  const grip = (await handle.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 + 100, grip.y + grip.height / 2 + 60, { steps: 5 })
  await page.mouse.up()
  await expect(async () => {
    await expect(readScenePlacement(scenes[0]!.id)).resolves.toMatchObject({ x: 120, y: 80 })
  }).toPass()

  await page.getByLabel('Cut from The arrival to').selectOption({ label: 'The platform' })
  await page.getByRole('button', { name: 'Draw Cut from The arrival' }).click()

  const cutText = page.getByRole('textbox', { name: 'Cut to The platform' })
  await expect(cutText).toBeVisible()
  await cutText.fill('Follow her out')
  await cutText.blur()

  await page.getByRole('radio', { name: 'Opening Scene The platform' }).check()

  // Reloading before a write has landed would abort it, so what the page did is
  // read back past it first — and that is also what proves the Cut persisted.
  await expect(async () => {
    await expect(readCuts(scenes[0]!.id))
      .resolves.toMatchObject([{ toSceneId: scenes[1]!.id, text: 'Follow her out' }])
    await expect(readScenePlacement(scenes[1]!.id))
      .resolves.toMatchObject({ openingSceneId: scenes[1]!.id })
  }).toPass()

  // What the page shows has to be what was written, not what the page remembers.
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Cut to The platform' }))
    .toHaveValue('Follow her out')
  await expect(page.getByRole('radio', { name: 'Opening Scene The platform' })).toBeChecked()
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .toHaveCSS('translate', '120px 80px')

  await page.getByRole('button', { name: 'Delete Cut to The platform' }).click()
  await expect(page.getByRole('textbox', { name: 'Cut to The platform' })).toBeHidden()
})

test('two Scenes moved one after the other are both written', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  // Moving one Scene and then another straight away has to write both: a single
  // wait shared by the graph would drop the first.
  for (const name of ['The arrival', 'The platform']) {
    await page.getByRole('button', { name: `Move Scene ${name}` }).click()
    await page.keyboard.press('ArrowRight')
  }

  await expect(async () => {
    for (const scene of scenes) {
      await expect(readScenePlacement(scene.id)).resolves.toMatchObject({ x: 20 })
    }
  }).toPass()
})

test('the graph shows several dozen Scenes', async ({ page, author }) => {
  const story = await seedStory(author, 'A long Story')
  const names = Array.from({ length: 40 }, (_, place) => `Scene ${place + 1}`)
  await seedScenes(story, names)

  await page.goto(`/stories/${story.id}`)

  // Every Scene is a node, and the last of them is reachable by scrolling the
  // graph rather than lost outside it.
  await expect(page.getByRole('article')).toHaveCount(40)
  const last = page.getByRole('article', { name: 'Scene 40' })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeVisible()
})

test('a Scene sets Flags on entry, and a Cut carries Conditions', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]

  // A Cut is drawn offered to everyone, as a Scene starts setting nothing.
  const cut = await drawCut(request, from.id, to.id)
  expect(cut.conditions).toEqual([])

  const flagged = await request.put(`/api/scenes/${from.id}/flags`, {
    data: { sets: { coat: 'on', 'the key': 'found' } },
  })
  expect(flagged.status()).toBe(200)

  // Two Conditions at once, which is what one could not ask: the Reader has the
  // coat on *and* has been here before.
  const both = [
    { scene: from.id, visits: 'at least', times: 2 },
    { flag: 'coat', is: 'on' },
  ]
  const conditioned = await request.put(`/api/cuts/${cut.id}/conditions`, {
    data: { conditions: both },
  })
  expect(conditioned.status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{ id: from.id, sets: { coat: 'on', 'the key': 'found' } }, { id: to.id, sets: {} }],
    cuts: [{ id: cut.id, conditions: both }],
  })

  // Sending no Conditions is how a Cut goes back to being offered to everyone,
  // and sending no Flags is how a Scene stops setting them.
  await request.put(`/api/cuts/${cut.id}/conditions`, { data: {} })
  await request.put(`/api/scenes/${from.id}/flags`, { data: { sets: {} } })
  await expect(readCuts(from.id)).resolves.toMatchObject([{ conditions: [] }])
  await expect(readFlags(from.id)).resolves.toEqual({})
})

test('half a Flag, and a Condition of no shape, are refused rather than stored', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]
  const cut = await drawCut(request, from.id, to.id)

  await request.put(`/api/scenes/${from.id}/flags`, { data: { sets: { coat: 'on' } } })
  await request.put(`/api/cuts/${cut.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })

  const tooMany = Object.fromEntries(
    Array.from({ length: FLAGS_PER_SCENE + 1 }, (_, place) => [`flag ${place}`, 'set']),
  )
  const conditionsPastTheCap = Array.from(
    { length: CUT_CONDITIONS_MAX + 1 },
    (_, place) => ({ flag: `flag ${place}`, is: 'set' }),
  )

  const refused = await Promise.all([
    // A name with no value is a Flag the engine could not tell from an unset one.
    request.put(`/api/scenes/${from.id}/flags`, { data: { sets: { coat: ' ' } } }),
    request.put(`/api/scenes/${from.id}/flags`, { data: { sets: { ' ': 'on' } } }),
    // A name holding the separator, or a newline, is one the editor could not
    // show back as the line the Author typed.
    request.put(`/api/scenes/${from.id}/flags`, { data: { sets: { 'coat = on': 'yes' } } }),
    request.put(`/api/scenes/${from.id}/flags`, { data: { sets: { coat: 'on\nand off' } } }),
    request.put(`/api/scenes/${from.id}/flags`, { data: { sets: 'coat = on' } }),
    request.put(`/api/scenes/${from.id}/flags`, { data: { sets: tooMany } }),
    // Neither of the two shapes, or one carrying more than its own test: a
    // Condition is flat, so a test nested in it is not a Condition — it belongs
    // in the list beside it, and there are only so many places there.
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ flag: '', is: 'on' }] },
    }),
    request.put(`/api/cuts/${cut.id}/conditions`, { data: { conditions: [{ of: 'nothing' }] } }),
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ flag: 'coat', is: 'on', and: { flag: 'key', is: 'found' } }] },
    }),
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ scene: 'The arrival', visits: 'at least', times: 2 }] },
    }),
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ scene: from.id, visits: 'as often as', times: 2 }] },
    }),
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ scene: from.id, visits: 'at least', times: VISITS_MAX + 1 }] },
    }),
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ scene: from.id, visits: 'at least', times: 1.5 }] },
    }),
    // One bad member is a bad list, wherever in it it sits.
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: [{ flag: 'coat', is: 'on' }, { of: 'nothing' }] },
    }),
    // A list is a list of Conditions, not a Condition.
    request.put(`/api/cuts/${cut.id}/conditions`, {
      data: { conditions: { flag: 'coat', is: 'on' } },
    }),
    request.put(`/api/cuts/${cut.id}/conditions`, { data: { conditions: conditionsPastTheCap } }),
  ])

  for (const response of refused) expect(response.status()).toBe(400)

  // The list at the cap is the one thing here that is not too long.
  const atTheCap = conditionsPastTheCap.slice(0, CUT_CONDITIONS_MAX)
  const allowed = await request.put(`/api/cuts/${cut.id}/conditions`, {
    data: { conditions: atTheCap },
  })
  expect(allowed.status()).toBe(200)
  await request.put(`/api/cuts/${cut.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })

  // Every refusal left what the Author had already written where it was.
  await expect(readFlags(from.id)).resolves.toEqual({ coat: 'on' })
  await expect(readCuts(from.id))
    .resolves.toMatchObject([{ conditions: [{ flag: 'coat', is: 'on' }] }])
})

test('a Condition counts only a Scene of the Cut’s own Story', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]
  const cut = await drawCut(request, from.id, to.id)
  const elsewhere = await openGraph(request, ['A Scene of another Story'])

  // Second in the list, so the refusal is of the list rather than of its head.
  const refused = await request.put(`/api/cuts/${cut.id}/conditions`, {
    data: {
      conditions: [
        { scene: from.id, visits: 'at least', times: 2 },
        { scene: elsewhere.scenes[0]!.id, visits: 'at least', times: 2 },
      ],
    },
  })

  // The Scene is looked up where the Condition is written, so a Scene outside
  // the Story names nothing and nothing is written.
  expect(refused.status()).toBe(404)
  await expect(readCuts(from.id)).resolves.toMatchObject([{ conditions: [] }])
})

test('an Author orders the ways on from the page alone', async ({ page, request }) => {
  const { story, scenes } = await openGraph(
    request, ['The platform', 'The buffet', 'The tunnel'])
  const [from, buffet, tunnel] = scenes as [{ id: string }, { id: string }, { id: string }]
  await drawCut(request, from.id, buffet.id)
  await drawCut(request, from.id, tunnel.id)

  await page.goto(`/stories/${story.id}`)

  await page.getByRole('button', { name: 'Move earlier the Cut to The tunnel' }).click()
  await expect(async () => {
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { toSceneId: tunnel.id, position: 0 },
      { toSceneId: buffet.id, position: 1 },
    ])
  }).toPass()

  // The way on that comes first has nowhere earlier to go, and the page says so
  // rather than asking.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Move earlier the Cut to The tunnel' }))
    .toBeDisabled()
  await expect(page.getByRole('button', { name: 'Move later the Cut to The buffet' }))
    .toBeDisabled()
})

test('an Author sets a Flag and two Conditions from the page alone', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]
  await drawCut(request, from.id, to.id)

  await page.goto(`/stories/${story.id}`)

  const flags = page.getByLabel('Flags set on entering The arrival')
  await flags.fill('coat = on')
  await flags.blur()

  await page.getByRole('button', { name: 'Add a Condition to the Cut to The platform' }).click()
  await page.getByLabel('Flag of Condition 1 of the Cut to The platform').fill('coat')
  const holds = page.getByLabel('holds for Condition 1 of the Cut to The platform')
  await holds.fill('on')
  await holds.blur()

  // A second Condition on the same Cut, which is what one could not say.
  await page.getByRole('button', { name: 'Add a Condition to the Cut to The platform' }).click()
  // Exactly, because "Condition 2 of the Cut to The platform" is also the tail
  // of the labels on the fields of that Condition.
  await page.getByLabel('Condition 2 of the Cut to The platform', { exact: true })
    .selectOption('visits')

  // Read back past the page, which is what proves all of it landed — and has to
  // happen before the reload, which would abort a write still in flight.
  await expect(async () => {
    await expect(readFlags(from.id)).resolves.toEqual({ coat: 'on' })
    await expect(readCuts(from.id)).resolves.toMatchObject([{
      conditions: [
        { flag: 'coat', is: 'on' },
        { scene: from.id, visits: 'at least', times: 2 },
      ],
    }])
  }).toPass()

  // What the page shows has to be what was written, not what the page remembers.
  await page.reload()
  await expect(page.getByLabel('Flags set on entering The arrival')).toHaveValue('coat = on')
  await expect(page.getByLabel('Condition 1 of the Cut to The platform', { exact: true }))
    .toHaveValue('flag')
  await expect(page.getByLabel('Flag of Condition 1 of the Cut to The platform'))
    .toHaveValue('coat')
  await expect(page.getByLabel('Condition 2 of the Cut to The platform', { exact: true }))
    .toHaveValue('visits')

  // And a Cut with every Condition taken off it is offered always again.
  for (const place of [2, 1]) {
    await page.getByRole('button',
      { name: `Remove Condition ${place} of the Cut to The platform` }).click()
  }
  await expect(async () => {
    await expect(readCuts(from.id)).resolves.toMatchObject([{ conditions: [] }])
  }).toPass()
})
