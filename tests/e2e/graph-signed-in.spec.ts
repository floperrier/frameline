import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  CONDITIONS_MAX,
  FLAGS_PER_SCENE,
  GRAPH_REACH,
  NODE_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  NODES_PER_COLUMN,
  VISITS_MAX,
} from '../../shared/utils/scenes'
import {
  openNode,
  readCuts,
  readFlags,
  readScenePlacement,
  seedCut,
  seedScene,
  seedScenes,
  seedStory,
  test,
} from './author'

/** Draws a Cut between the two Scenes of a graph, past the gesture that draws one. */
async function drawCut(request: APIRequestContext, fromSceneId: string, toSceneId: string) {
  const drawn = await request.post(`/api/scenes/${fromSceneId}/cuts`, { data: { toSceneId } })
  expect(drawn.status()).toBe(201)
  return await drawn.json()
}

const noId = '00000000-0000-4000-8000-000000000000'

/**
 * Opens the panel a Cut is written in, from the row of the node's strip that
 * names it — the route an Author has without a pointer, and the one a test can
 * take to a Cut whose line is off the fold of the bench.
 */
async function openWayOn(page: Page, from: string, to: string) {
  await page.getByRole('button', { name: `${to} — way on from ${from}` }).click()
}

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

  const renumbered = await request.put(`/api/scenes/${from.id}/cuts/places`,
    { data: { places: [third.id, first.id, second.id] } })

  expect(renumbered.status()).toBe(200)
  await expect(readCuts(from.id)).resolves.toMatchObject([
    { text: 'To 2', position: 0 }, { text: 'To 0', position: 1 }, { text: 'To 1', position: 2 },
  ])

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

test('the ways on are renumbered across a Scene deleted out from under one',
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

    // Renumbering names the two that are left, and the hole closes behind them:
    // a sequence is written as the Places it counts out, not as a swap across
    // whatever numbering was there before.
    expect((await request.put(`/api/scenes/${from.id}/cuts/places`,
      { data: { places: [drawn[2]!.id, drawn[0]!.id] } })).status()).toBe(200)
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { toSceneId: train.id, position: 0 }, { toSceneId: buffet.id, position: 1 },
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
    request.put(`/api/scenes/${noId}/cuts/places`, { data: { places: [noId] } }),
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
    request.put(`/api/scenes/${theirCut.fromSceneId}/cuts/places`,
      { data: { places: [theirCut.id] } }),
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

  // Laying a node out needs nothing opened — the slate carries the handle. Everything
  // written about a Scene is inside the node, so from here the nodes are opened.
  await openNode(page, 'The arrival')

  // A Cut to write the text of, drawn through the hidden button rather than by
  // hand: the gesture has its own specs below, and the Scene this one lands on is
  // stacked below the bench's own fold where a pointer would have to scroll to it.
  await page.getByRole('button', { name: 'Draw a Cut from The arrival' }).press('Enter')
  await page.getByRole('button', { name: 'Cut from The arrival to The platform' }).press('Enter')

  // The node keeps a bare strip of the ways on, and the writing is done in the
  // panel that strip opens.
  await expect(page.getByRole('textbox', { name: 'Cut to The platform' })).toBeHidden()
  await openWayOn(page, 'The arrival', 'The platform')

  const cutText = page.getByRole('textbox', { name: 'Cut to The platform' })
  await expect(cutText).toBeVisible()
  await cutText.fill('Follow her out')
  await cutText.blur()

  // The panel is above the nodes, so it is let go of before the node under it is
  // the one being worked in.
  await page.keyboard.press('Escape')
  await openNode(page, 'The platform')
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
  // A reload folds every node again: what is folded is the Author's view of the
  // graph and not a thing about the Story, so nothing was written to remember it.
  // The Scene below is opened first: an open node overlaps the one under it, and
  // the one that comes to the front is the one being worked in.
  await page.reload()
  await openNode(page, 'The platform')
  await openNode(page, 'The arrival')
  await openWayOn(page, 'The arrival', 'The platform')
  await expect(page.getByRole('textbox', { name: 'Cut to The platform' }))
    .toHaveValue('Follow her out')
  await expect(page.getByRole('radio', { name: 'Opening Scene The platform' })).toBeChecked()
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .toHaveCSS('translate', '120px 80px')

  // Taken away from the panel it is written in, which goes with it.
  await page.getByRole('button', { name: 'Delete Cut to The platform' }).click()
  await expect(page.getByRole('textbox', { name: 'Cut to The platform' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'The platform — way on from The arrival' }))
    .toBeHidden()
  await expect(readCuts(scenes[0]!.id)).resolves.toEqual([])
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

test('the bench says when a write was kept, and a move says nothing', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  expect((await request.post(`/api/scenes/${scenes[0]!.id}/shots`)).status()).toBe(201)
  await page.goto(`/stories/${story.id}`)

  // Nothing has been written in this session, so the bench has nothing to say
  // about when: a time here before the first write would be a claim about a page
  // that has only been read, and it would have had to come off the server.
  const keptAt = page.getByText(/^Kept at /)
  await expect(keptAt).toHaveCount(0)

  await openNode(page, 'The arrival')
  const text = page.getByRole('textbox', { name: 'Shot 1' })
  await text.fill('She steps off the train.')

  // The field the writing left flashes. The animation is what the test waits for
  // rather than the class that starts it, because the class is taken off again
  // the moment it ends and would be gone before an assertion could see it.
  const flashed = page.evaluate(() => new Promise<string>(resolve =>
    document.addEventListener(
      'animationstart', event => resolve((event.target as HTMLElement).id), { once: true })))
  await text.blur()
  await expect(flashed).resolves.toBe(await text.getAttribute('id'))

  await expect(keptAt).toHaveCount(1)
  const said = (await keptAt.textContent())!

  // Both marks are quiet on purpose. A live region firing every time a field is
  // left would talk over the next thing typed, so a write that landed is seen and
  // never heard — what does get announced is a refusal, and there was none.
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Moving a node is drawing and not writing, so it leaves the time alone even
  // though it reaches the server like everything else.
  await page.getByRole('button', { name: 'Move Scene The arrival' }).click()
  await page.keyboard.press('ArrowRight')
  await expect(async () => {
    await expect(readScenePlacement(scenes[0]!.id)).resolves.toMatchObject({ x: 20 })
  }).toPass()
  await expect(keptAt).toHaveText(said)
})

test('the graph of several dozen Scenes is read folded', async ({ page, author }) => {
  const story = await seedStory(author, 'A long Story')
  const names = Array.from({ length: 40 }, (_, place) => `Scene ${place + 1}`)
  const scenes = await seedScenes(story, names)
  await seedCut(scenes[0]!.id, scenes[1]!.id)

  await page.goto(`/stories/${story.id}`)

  // Every Scene is a node, and the last of them is reachable by scrolling the
  // graph rather than lost outside it.
  await expect(page.getByRole('article')).toHaveCount(40)
  const last = page.getByRole('article', { name: 'Scene 40' })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeVisible()

  // Forty nodes and not one open editor among them, which is what makes forty
  // Scenes readable rather than merely present: a folded node says what is in the
  // Scene and where it leads, and says it in a fraction of an open node's height.
  await expect(page.getByLabel('Flags set on entering Scene 40')).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Scene 1', exact: true }))
    .toContainText('1 Shot, on to Scene 2')
  await expect(last).toContainText('1 Shot, no way on')
  const folded = (await last.boundingBox())!.height
  expect(folded).toBeLessThan(NODE_HEIGHT / 3)

  // The editor comes on demand, and for the one Scene asked for: the other
  // thirty-nine are still folded behind it.
  await page.getByRole('button', { name: 'Open Scene Scene 40' }).click()
  await expect(page.getByLabel('Flags set on entering Scene 40')).toBeVisible()
  expect((await last.boundingBox())!.height).toBeGreaterThan(folded)
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveCount(1)
})

test('a node is a strip and a body, and only the body scrolls', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  const opening = scenes[0]!
  // Enough Shots that the node is taller than the bench, which is what puts a
  // scrollbar inside it and makes it worth asking which column carries it.
  for (const _ of [1, 2, 3]) await request.post(`/api/scenes/${opening.id}/shots`)

  await page.goto(`/stories/${story.id}`)
  // Addressed by class, where the rest of the suite goes through roles: which
  // column of a node carries the scrollbar is a fact about the drawing, and the
  // drawing has no accessible name to ask for it by.
  const node = page.getByRole('article', { name: 'The arrival' })
  const strip = node.locator('.strip')
  await openNode(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 3' })).toBeVisible()

  // The strip is a column of the node rather than something inside what scrolls,
  // so it runs the node's full height, between the node's own two hairlines.
  const tall = (await node.boundingBox())!
  expect((await strip.boundingBox())!.height).toBeCloseTo(tall.height - 2, 0)
  expect(tall.height).toBeLessThanOrEqual((await page.locator('.graph').boundingBox())!.height)

  // The strip takes the touch, which is what makes a Cut immediate under a finger
  // with no long press to wait out; the body beside it keeps its own, so the node
  // is still a node a thumb can scroll.
  const touching = (part: typeof strip) =>
    part.evaluate(held => getComputedStyle(held).touchAction)
  expect(await touching(strip)).toBe('none')
  expect(await touching(node.locator('.body'))).not.toBe('none')

  // And it stays where it is while the body beside it scrolls, which is what will
  // let a finger start a gesture on it without the node losing its place.
  const body = node.locator('.body')
  await body.evaluate(scrolled => scrolled.scrollBy(0, 200))
  await expect.poll(() => body.evaluate(scrolled => scrolled.scrollTop)).toBeGreaterThan(0)
  expect((await strip.boundingBox())!.y).toBeCloseTo(tall.y + 1, 0)
})

test('the Opening Scene is the one whose strip is marked', async ({ page, request }) => {
  const { story } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  const stripOf = (name: string) => page
    .getByRole('article', { name })
    .locator('.strip')
    .evaluate(strip => getComputedStyle(strip).backgroundColor)

  // The first Scene written opens the Story, and its strip is the grease pencil
  // where every other node's is the groove the bench is cut with.
  const plain = await stripOf('The platform')
  const marked = await stripOf('The arrival')
  expect(marked).not.toBe(plain)

  // Naming another Scene moves the mark, and it moves on the strip rather than
  // anywhere the node has to be opened to see.
  await openNode(page, 'The platform')
  await page.getByRole('radio', { name: 'Opening Scene The platform' }).check()
  await expect.poll(() => stripOf('The platform')).toBe(marked)
  expect(await stripOf('The arrival')).toBe(plain)
})

test('an open node grows with its writing while folded nodes stay one size', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openGraph(request, ['The arrival', 'The platform', 'The bar'])
  // Two ways on out of one Scene and none out of the others: what a folded node
  // says is not the same length for each, and its height has to be all the same.
  await drawCut(request, scenes[1]!.id, scenes[0]!.id)
  await drawCut(request, scenes[1]!.id, scenes[2]!.id)
  // A Shot apiece, because a Scene an Author has written in has one and a folded
  // node counts them.
  for (const scene of scenes) await request.post(`/api/scenes/${scene.id}/shots`)

  // Room enough that the node grows rather than meeting the ceiling on the first
  // Shot, which is the growth this is about.
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto(`/stories/${story.id}`)

  const heightOf = async (name: string) =>
    (await page.getByRole('article', { name }).boundingBox())!.height
  const names = ['The arrival', 'The platform', 'The bar']
  const folded = await Promise.all(names.map(heightOf))
  expect(new Set(folded).size).toBe(1)

  // Opened, a node is as tall as what is in it...
  await openNode(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toBeVisible()
  const opened = await heightOf('The arrival')
  expect(opened).toBeGreaterThan(folded[0]!)

  // ...and a second Shot makes it taller still, instead of being written into a
  // box of a fixed height that the Author has to scroll to reach it in.
  await page.getByRole('button', { name: 'Add Shot to The arrival' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
  await expect.poll(() => heightOf('The arrival')).toBeGreaterThan(opened)
  expect(await heightOf('The arrival'))
    .toBeLessThanOrEqual((await page.locator('.graph').boundingBox())!.height)

  // The two the Author did not open are the size they were, and the size of each
  // other: the shape of a long Story is read off nodes that are all one size.
  expect(await heightOf('The platform')).toBe(folded[1])
  expect(await heightOf('The bar')).toBe(folded[2])
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
    { length: CONDITIONS_MAX + 1 },
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
  const atTheCap = conditionsPastTheCap.slice(0, CONDITIONS_MAX)
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
  await openNode(page, 'The platform')

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
  await openNode(page, 'The platform')
  await expect(page.getByRole('button', { name: 'Move earlier the Cut to The tunnel' }))
    .toBeDisabled()
  await expect(page.getByRole('button', { name: 'Move later the Cut to The buffet' }))
    .toBeDisabled()

  // And by hand: a row dragged onto another takes the Place that row stood at.
  await dragWayOn(page, 'The platform', 'The buffet', 'The tunnel')
  await expect(async () => {
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { toSceneId: buffet.id, position: 0 },
      { toSceneId: tunnel.id, position: 1 },
    ])
  }).toPass()

  // And back the other way, which is the same arithmetic reversed: a row dropped
  // on one later than itself passes it rather than swapping with it.
  await expect(page.getByRole('button', { name: 'The buffet — way on from The platform' }))
    .toHaveText(/1\s+The buffet/)
  await dragWayOn(page, 'The platform', 'The buffet', 'The tunnel')
  await expect(async () => {
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { toSceneId: tunnel.id, position: 0 },
      { toSceneId: buffet.id, position: 1 },
    ])
  }).toPass()

  // A drag that renumbered is not also a press, so it opened no panel: the
  // gesture said what it meant once.
  await expect(page.getByRole('textbox', { name: 'Cut to The buffet' })).toBeHidden()
})

/** Drags one row of a Scene's strip onto another, which is what renumbers by hand. */
async function dragWayOn(page: Page, from: string, dragged: string, onto: string) {
  const row = async (to: string) => (await page
    .getByRole('button', { name: `${to} — way on from ${from}` }).boundingBox())!
  const held = await row(dragged)
  const target = await row(onto)

  await page.mouse.move(held.x + held.width / 2, held.y + held.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    target.x + target.width / 2, target.y + target.height / 2, { steps: 5 })
  await page.mouse.up()
}

/**
 * A graph laid out at named points. Where the nodes sit decides what a test can
 * aim at: a Cut between two nodes in a row draws a line of no height, which is
 * nothing a pointer can be told to press, and two Cuts leaving on the same
 * bearing draw one line's target over the other's.
 */
async function layOut(request: APIRequestContext, at: Record<string, [number, number]>) {
  const opened = await openGraph(request, Object.keys(at))
  for (const scene of opened.scenes) {
    const [x, y] = at[scene.name]!
    const placed = await request.patch(`/api/scenes/${scene.id}`, { data: { x, y } })
    expect(placed.status()).toBe(200)
  }

  return opened
}

test('a Cut is written in the panel its own line opens', async ({ page, request }) => {
  const { story, scenes } = await layOut(request, {
    'The arrival': [0, 0],
    'The platform': [400, 220],
    'The bar': [100, 620],
  })
  const [from, platform, bar] = scenes as [{ id: string }, { id: string }, { id: string }]
  const first = await drawCut(request, from.id, platform.id)
  const second = await drawCut(request, from.id, bar.id)

  await page.goto(`/stories/${story.id}`)

  const drawing = (cut: { id: string }) => page.locator(`[data-cut="${cut.id}"]`)
  const lineOf = (cut: { id: string }) => drawing(cut).locator('line.aimed')
  const panelOn = (scene: string) =>
    page.getByRole('group', { name: `Writing the Cut to ${scene}` })

  // Every way on is labelled on the bench with the Place it is offered at, on a
  // disc near the Scene it leaves.
  await expect(drawing(first).locator('text.place')).toHaveText('1')
  await expect(drawing(second).locator('text.place')).toHaveText('2')

  // Pressing a line opens the panel at the middle of that line, and the Cut it
  // holds is lit on the bench.
  await lineOf(first).click()
  await expect(panelOn('The platform')).toBeVisible()
  await expect(drawing(first).locator('line.lit')).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Cut to The platform' })).toBeFocused()

  // To the pixel, give or take the half one a panel of an odd height is centred
  // on: the line's own middle is where the panel's middle is.
  const online = (await lineOf(first).boundingBox())!
  const opened = (await panelOn('The platform').boundingBox())!
  expect(Math.abs((opened.x + opened.width / 2) - (online.x + online.width / 2)))
    .toBeLessThan(1)
  expect(Math.abs((opened.y + opened.height / 2) - (online.y + online.height / 2)))
    .toBeLessThan(1)

  // The panel is on the surface the nodes are on, so the bench carries it as it
  // scrolls rather than leaving it behind on the line it no longer sits over.
  const bench = page.locator('.graph')
  await bench.evaluate(scrolled => scrolled.scrollTop = 60)
  await expect(async () => {
    const scrolled = (await panelOn('The platform').boundingBox())!
    expect(scrolled.y).toBeCloseTo(opened.y - 60, 0)
  }).toPass()
  await bench.evaluate(scrolled => scrolled.scrollTop = 0)

  // One panel at a time: opening another closes the first.
  await lineOf(second).click()
  await expect(panelOn('The bar')).toBeVisible()
  await expect(panelOn('The platform')).toBeHidden()
  await expect(drawing(first).locator('line.lit')).toHaveCount(0)

  // Escape closes it, and so does a press on the bare bench.
  await page.keyboard.press('Escape')
  await expect(panelOn('The bar')).toBeHidden()

  await lineOf(second).click()
  await expect(panelOn('The bar')).toBeVisible()
  const surface = (await bench.boundingBox())!
  await page.mouse.click(surface.x + surface.width / 2, surface.y + surface.height - 20)
  await expect(panelOn('The bar')).toBeHidden()

  // What is written in the panel is written on the Cut: its text, and a Condition
  // it is offered under.
  await lineOf(first).click()
  const cutText = page.getByRole('textbox', { name: 'Cut to The platform' })
  await cutText.fill('Follow her out')
  await cutText.blur()

  await page.getByRole('button', { name: 'Add a Condition to the Cut to The platform' }).click()
  const flag = page.getByLabel('Flag of Condition 1 of the Cut to The platform')
  await flag.fill('coat')
  await flag.blur()

  await expect(async () => {
    await expect(readCuts(from.id)).resolves.toMatchObject([
      { id: first.id, text: 'Follow her out', conditions: [{ flag: 'coat', is: '' }] },
      { id: second.id },
    ])
  }).toPass()

  // And taken away from the same panel, which goes with the line it sat on.
  await page.getByRole('button', { name: 'Delete Cut to The platform' }).click()
  await expect(panelOn('The platform')).toBeHidden()
  await expect(async () => {
    await expect(readCuts(from.id)).resolves.toMatchObject([{ id: second.id, position: 0 }])
  }).toPass()
})

test('the strip is the way to a Cut for a hand that is not on a pointer',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform'])
    const [from, to] = scenes as [{ id: string }, { id: string }]
    await drawCut(request, from.id, to.id)

    await page.goto(`/stories/${story.id}`)

    // Folded, the node says where it leads in a line. Open, it does not say it
    // twice: the strip says the same thing better.
    const node = page.getByRole('article', { name: 'The arrival' })
    await expect(node).toContainText('on to The platform')
    await openNode(page, 'The arrival')
    await expect(node).not.toContainText('on to The platform')

    // The strip holds the Place, where the way on arrives, and the two controls —
    // and no text and no Conditions: those are the panel's.
    const row = page.getByRole('button', { name: 'The platform — way on from The arrival' })
    await expect(row).toHaveText(/1\s+The platform/)
    await expect(row).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('textbox', { name: 'Cut to The platform' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Delete Cut to The platform' })).toBeHidden()

    // Reached from the keyboard, the row opens the panel and hands over the text.
    await row.press('Enter')
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('textbox', { name: 'Cut to The platform' })).toBeFocused()

    // And Escape gives the focus back to the row it was opened from, so the way in
    // is the way out.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('group', { name: 'Writing the Cut to The platform' }))
      .toBeHidden()
    await expect(row).toBeFocused()
  })

/**
 * Typed straight through, with nothing waited for in between: a write the Author
 * typed no longer reads the Story back, so the field they type in next is still
 * the one they were given — see `docs/adr/0008-refetch-is-for-a-refusal.md`. The
 * test that waited for each write to come back was the test hiding #40.
 */
test('an Author sets a Flag and two Conditions from the page alone', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]
  await drawCut(request, from.id, to.id)

  await page.goto(`/stories/${story.id}`)
  await openNode(page, 'The arrival')

  const flags = page.getByLabel('Flags set on entering The arrival')
  await flags.fill('coat = on')
  await flags.blur()

  await openWayOn(page, 'The arrival', 'The platform')
  await page.getByRole('button', { name: 'Add a Condition to the Cut to The platform' }).click()
  // The name of the Flag and the value it holds are written one at a time,
  // because the Flag alone is half a Condition and is written as soon as it has
  // a name — and the value is then typed into the same field the Author was
  // left holding.
  const flag = page.getByLabel('Flag of Condition 1 of the Cut to The platform')
  await flag.fill('coat')
  await flag.blur()
  const holds = page.getByLabel('holds for Condition 1 of the Cut to The platform')
  await holds.fill('on')
  await holds.blur()

  // A second Condition on the same Cut, which is what one could not say.
  await page.getByRole('button', { name: 'Add a Condition to the Cut to The platform' }).click()
  // Exactly, because "Condition 2 of the Cut to The platform" is also the tail
  // of the labels on the fields of that Condition.
  await page
    .getByLabel('Condition 2 of the Cut to The platform', { exact: true })
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
  await openNode(page, 'The arrival')
  await expect(page.getByLabel('Flags set on entering The arrival')).toHaveValue('coat = on')
  await openWayOn(page, 'The arrival', 'The platform')
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

/**
 * A graph of Scenes laid out in one row, so every node is on screen at once and
 * a gesture from any of them can reach any other. The API stacks a new Scene
 * under the last, which puts the second one half off the bench.
 */
async function openRow(request: APIRequestContext, names = ['The arrival', 'The platform']) {
  const opened = await openGraph(request, names)
  for (const [place, scene] of opened.scenes.entries()) {
    const placed = await request.patch(`/api/scenes/${scene.id}`, {
      data: { x: place * (NODE_WIDTH + NODE_GAP), y: 0 },
    })
    expect(placed.status()).toBe(200)
  }

  return opened
}

/** The middle of a node, in the page's own coordinates. */
async function middleOfNode(page: Page, name: string) {
  const box = (await page.getByRole('article', { name }).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Puts the hand down on a Scene's strip, which is where a Cut is drawn from. */
async function aimFrom(page: Page, name: string) {
  const strip = (await page.getByRole('article', { name }).locator('.strip').boundingBox())!
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2)
  await page.mouse.down()
}

/** Moves the hand over a Scene's node, in the steps a hand really crosses a bench in. */
async function moveOver(page: Page, name: string) {
  const middle = await middleOfNode(page, name)
  await page.mouse.move(middle.x, middle.y, { steps: 5 })
}

const drawnLine = (page: Page) => page.locator('svg line.drawn')

test('a Cut is drawn by dragging from one Scene to another', async ({ page, request }) => {
  const { story, scenes } = await openRow(request)
  await page.goto(`/stories/${story.id}`)

  const arrival = page.getByRole('article', { name: 'The arrival' })
  const platform = page.getByRole('article', { name: 'The platform' })

  // Nothing is drawn and nothing is lit until the hand goes down: the bench at
  // rest says nothing about a gesture nobody has begun.
  await expect(drawnLine(page)).toHaveCount(0)
  await expect(platform).not.toHaveClass(/lit/)

  await aimFrom(page, 'The arrival')
  await moveOver(page, 'The platform')

  // The Scene that can take the Cut is lit, the Scene the line left is quiet, and
  // the node it left keeps a ring so the source is legible from across the bench.
  await expect(platform).toHaveClass(/lit/)
  await expect(arrival).toHaveClass(/quiet/)
  await expect(arrival).toHaveClass(/drawing/)

  // The line follows the hand, in the grease pencil, dashed and marching, with the
  // arrowhead that says it will land where it is.
  const line = drawnLine(page)
  await expect(line).toHaveAttribute('marker-end', 'url(#cut-head)')
  const drawn = await line.evaluate((held) => {
    const { stroke, strokeDasharray, animationName, animationDuration } = getComputedStyle(held)
    return { stroke, strokeDasharray, animationName, animationDuration }
  })
  expect(drawn.strokeDasharray).not.toBe('none')
  // Named against a pattern: the animation is declared in a scoped block, so Vue
  // hashes the keyframes' name.
  expect(drawn.animationName).toMatch(/^marching/)
  expect(Number.parseFloat(drawn.animationDuration)).toBeGreaterThan(0)
  // The grease pencil, which is the colour every finished Cut is drawn in.
  expect(drawn.stroke).toBe(
    await page.locator('svg line').first().evaluate(held => getComputedStyle(held).stroke))

  // And it is the first animation in the product, so it is the first thing that
  // stops for anyone who has asked for stillness: still dashed, no longer moving.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => line.evaluate(
    held => Number.parseFloat(getComputedStyle(held).animationDuration))).toBeLessThan(0.001)
  expect(await line.evaluate(held => getComputedStyle(held).strokeDasharray)).not.toBe('none')
  await page.emulateMedia({ reducedMotion: null })

  // Letting go over the Scene draws the Cut, the Story holds it, and the bench
  // says so out loud — a gesture is not a field, so this one is announced.
  await page.mouse.up()
  await expect(page.getByRole('status'))
    .toHaveText('Cut from The arrival to The platform drawn')
  await expect.poll(() => readCuts(scenes[0]!.id)).toMatchObject([
    { fromSceneId: scenes[0]!.id, toSceneId: scenes[1]!.id, position: 0 },
  ])

  // The gesture is over: nothing is lit, and the line is gone.
  await expect(drawnLine(page)).toHaveCount(0)
  await expect(platform).not.toHaveClass(/lit/)
})

test('a Cut cannot be drawn on a Scene itself, or twice to the same Scene', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openRow(request, ['The arrival', 'The platform', 'The bar'])
  await drawCut(request, scenes[0]!.id, scenes[1]!.id)
  await page.goto(`/stories/${story.id}`)

  await aimFrom(page, 'The arrival')

  // The Scene it already reaches is quiet, and the one it does not is lit: what a
  // Cut may land on is read off the bench rather than out of a list.
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveClass(/quiet/)
  await expect(page.getByRole('article', { name: 'The bar' })).toHaveClass(/lit/)

  // Over the Scene it already reaches, the line loses its arrowhead — said before
  // the Author lets go rather than after.
  await moveOver(page, 'The platform')
  await expect(drawnLine(page)).not.toHaveAttribute('marker-end')
  await page.mouse.up()

  // A second Cut to the same Scene is not what the hand drew, so nothing was
  // written: the one Cut seeded is still the only one leaving the Scene.
  await expect.poll(() => readCuts(scenes[0]!.id)).toHaveLength(1)

  // And a Cut on the Scene it left is the other slip the hand cannot make, even
  // though the server would take it.
  await aimFrom(page, 'The arrival')
  await moveOver(page, 'The arrival')
  await expect(drawnLine(page)).not.toHaveAttribute('marker-end')
  await page.mouse.up()
  await expect.poll(() => readCuts(scenes[0]!.id)).toHaveLength(1)
})

test('Escape abandons a gesture, by pointer and by keyboard', async ({ page, request }) => {
  const { story, scenes } = await openRow(request)
  await page.goto(`/stories/${story.id}`)

  // A gesture by pointer, abandoned mid-air: the line goes, the bench stops
  // lighting anything, and the Story is untouched.
  await aimFrom(page, 'The arrival')
  await moveOver(page, 'The platform')
  await expect(drawnLine(page)).toHaveCount(1)
  await page.keyboard.press('Escape')

  await expect(drawnLine(page)).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'The platform' })).not.toHaveClass(/lit/)
  await expect(page.getByRole('status')).toHaveText('No Cut was drawn')

  // Letting the hand up after Escape draws nothing either: the gesture it would
  // have landed is already gone.
  await page.mouse.up()
  await expect.poll(() => readCuts(scenes[0]!.id)).toEqual([])

  // The same for a gesture the keyboard began.
  await page.getByRole('button', { name: 'Draw a Cut from The arrival' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveClass(/lit/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('article', { name: 'The platform' })).not.toHaveClass(/lit/)
  await expect.poll(() => readCuts(scenes[0]!.id)).toEqual([])
})

test('the keyboard draws the same Cut, through a button hidden until it is focused', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openRow(request)
  await page.goto(`/stories/${story.id}`)

  // The button is in the page for anything that reads it, and nothing an eye can
  // see until it takes focus — the pattern a skip link uses.
  const aim = page.getByRole('button', { name: 'Draw a Cut from The arrival' })
  const seen = async () => (await aim.boundingBox())!.width
  expect(await seen()).toBeLessThan(2)
  await aim.focus()
  expect(await seen()).toBeGreaterThan(2)

  // Pressing it enters the very state the drag enters, and says so, because a
  // gesture nobody can see beginning is one nobody can follow.
  await aim.press('Enter')
  await expect(page.getByRole('status'))
    .toHaveText(/Drawing a Cut from The arrival/)
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveClass(/lit/)
  await expect(page.getByRole('article', { name: 'The arrival' })).toHaveClass(/drawing/)

  // The Scene the line left offers the way out, and every Scene it may land on
  // offers the landing, named as the Cut it would draw.
  await expect(page.getByRole('button', { name: 'Abandon the Cut from The arrival' }))
    .toHaveCount(1)
  // Pressed rather than clicked, which is the whole point of it: the button is a
  // pixel of clipped nothing under the strip until focus reaches it.
  await page.getByRole('button', { name: 'Cut from The arrival to The platform' }).press('Enter')

  await expect(page.getByRole('status'))
    .toHaveText('Cut from The arrival to The platform drawn')
  await expect.poll(() => readCuts(scenes[0]!.id)).toMatchObject([
    { fromSceneId: scenes[0]!.id, toSceneId: scenes[1]!.id },
  ])

  // The graph is read back with the Cut in it, which is what the next gesture is
  // worked out from: the folded node now says where the Scene leads.
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .toContainText('on to The platform')

  // And with the Cut drawn, the Scene it reaches is one the keyboard cannot land
  // on twice either: the button that would draw it again is offered disabled.
  await page.getByRole('button', { name: 'Draw a Cut from The arrival' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Cut from The arrival to The platform' }))
    .toBeDisabled()
})
