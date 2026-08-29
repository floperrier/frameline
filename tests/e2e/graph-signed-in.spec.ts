import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  CONDITIONS_MAX,
  FLAGS_PER_SCENE,
  GRAPH_REACH,
  NODE_GAP,
  NODE_HEIGHT,
  NODE_PITCH,
  NODE_SPACING,
  NODE_WIDTH,
  NODES_PER_COLUMN,
  snappedWithinReach,
  VISITS_MAX,
} from '../../shared/utils/scenes'
import {
  ONE_PIXEL,
  openTab,
  writeScene,
  readExits,
  readFlags,
  readSceneName,
  readScenePlacement,
  seedExit,
  seedScene,
  seedScenes,
  seedStory,
  test,
  toast,
} from './author'

/** Draws an Exit between the two Scenes of a graph, past the gesture that draws one. */
async function drawExit(request: APIRequestContext, fromSceneId: string, toSceneId: string) {
  const drawn = await request.post(`/api/scenes/${fromSceneId}/exits`, { data: { toSceneId } })
  expect(drawn.status()).toBe(201)
  return await drawn.json()
}

const noId = '00000000-0000-4000-8000-000000000000'

/**
 * Opens the panel an Exit is written in, from the row of the node's strip that
 * names it — the route an Author has without a pointer, and the one a test can
 * take to an Exit whose line is off the fold of the bench.
 */
async function openWayOn(page: Page, from: string, to: string) {
  await openTab(page, 'Ways on')
  await page.getByRole('button', { name: `${to} — way on from ${from}` }).click()
}

/** A Story with two Scenes, which is the smallest graph an Exit can join. */
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
    exits: [],
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

test('a Scene is written where the Author places it, or where the graph has room', async ({
  request,
}) => {
  const { story } = await openGraph(request)

  // A placement the Author sends is the placement the Scene is written at, rather
  // than the next spot down the column.
  const placed = await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The buffet', x: 740, y: 260 },
  })
  expect(placed.status()).toBe(201)
  await expect(readScenePlacement((await placed.json()).id))
    .resolves.toMatchObject({ x: 740, y: 260 })

  // One outside the graph's reach is refused, and half a placement is no
  // placement: neither writes a Scene.
  const refused = await Promise.all([
    request.post(`/api/stories/${story.id}/scenes`,
      { data: { name: 'Nowhere', x: GRAPH_REACH + 1, y: 0 } }),
    request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'Nowhere', x: 40 } }),
  ])
  for (const response of refused) expect(response.status()).toBe(400)

  // And a Scene sent with no placement at all is still placed by the endpoint,
  // under the three already written.
  const chosen = await request.post(`/api/stories/${story.id}/scenes`,
    { data: { name: 'The tunnel' } })
  expect(chosen.status()).toBe(201)
  expect(await chosen.json()).toMatchObject({ x: 0, y: 3 * NODE_SPACING })
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

test('an Exit without text is refused rather than emptied', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const drawn = await request.post(`/api/scenes/${scenes[0]!.id}/exits`, {
    data: { toSceneId: scenes[1]!.id },
  })
  const exit = await drawn.json()
  await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Follow her out' } })

  const response = await request.patch(`/api/exits/${exit.id}`, { data: {} })

  expect(response.status()).toBe(400)
  await expect(readExits(scenes[0]!.id)).resolves.toMatchObject([{ text: 'Follow her out' }])
})

test('an Exit is drawn between two Scenes, written, and taken away', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]

  const drawn = await request.post(`/api/scenes/${from.id}/exits`, { data: { toSceneId: to.id } })
  expect(drawn.status()).toBe(201)
  const exit = await drawn.json()
  expect(exit).toMatchObject({ fromSceneId: from.id, toSceneId: to.id, text: '' })

  // The text is what the Reader will be offered, so it is written after the Exit
  // is drawn, as a Shot is.
  const written = await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Follow her out' } })
  expect(written.status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    exits: [{ id: exit.id, fromSceneId: from.id, toSceneId: to.id, text: 'Follow her out' }],
  })

  expect((await request.delete(`/api/exits/${exit.id}`)).status()).toBe(200)
  await expect(readExits(from.id)).resolves.toEqual([])
})

test('the ways on are offered in the order the Author put them in', async ({ request }) => {
  const { story, scenes } = await openGraph(
    request, ['The platform', 'The buffet', 'The tunnel', 'The train'])
  const [from, ...elsewhere] = scenes as [{ id: string }, ...{ id: string }[]]
  const drawn = []
  for (const [place, to] of elsewhere.entries()) {
    const exit = await drawExit(request, from.id, to.id)
    // The Exit is drawn last among the ways on, which is where a new one belongs.
    expect(exit.position).toBe(place)
    await request.patch(`/api/exits/${exit.id}`, { data: { text: `To ${place}` } })
    drawn.push(exit)
  }
  const [first, second, third] = drawn as [{ id: string }, { id: string }, { id: string }]

  const renumbered = await request.put(`/api/scenes/${from.id}/exits/places`,
    { data: { places: [third.id, first.id, second.id] } })

  expect(renumbered.status()).toBe(200)
  await expect(readExits(from.id)).resolves.toMatchObject([
    { text: 'To 2', position: 0 }, { text: 'To 0', position: 1 }, { text: 'To 1', position: 2 },
  ])

  // And the Story is read in that order, which is the order the Reader meets.
  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    exits: [
      { text: 'To 2', position: 0 },
      { text: 'To 0', position: 1 },
      { text: 'To 1', position: 2 },
    ],
  })
})

test('taking an Exit away leaves the ways on numbered without a gap', async ({ request }) => {
  const { scenes } = await openGraph(request, ['The platform', 'The buffet', 'The tunnel'])
  const [from, ...elsewhere] = scenes as [{ id: string }, ...{ id: string }[]]
  const drawn = []
  for (const to of elsewhere) drawn.push(await drawExit(request, from.id, to.id))

  expect((await request.delete(`/api/exits/${drawn[0]!.id}`)).status()).toBe(200)

  await expect(readExits(from.id)).resolves.toMatchObject([{ id: drawn[1]!.id, position: 0 }])
})

test('the ways on are renumbered across a Scene deleted out from under one',
  async ({ request }) => {
    const { scenes } = await openGraph(
      request, ['The platform', 'The buffet', 'The tunnel', 'The train'])
    const [from, buffet, tunnel, train] = scenes as { id: string }[] as
      [{ id: string }, { id: string }, { id: string }, { id: string }]
    const drawn = []
    for (const to of [buffet, tunnel, train]) drawn.push(await drawExit(request, from.id, to.id))

    // Deleting the Scene in the middle takes the Exit arriving at it by cascade,
    // which is the one way an Exit leaves without closing the gap behind it.
    expect((await request.delete(`/api/scenes/${tunnel.id}`)).status()).toBe(200)
    await expect(readExits(from.id)).resolves.toMatchObject([
      { toSceneId: buffet.id, position: 0 }, { toSceneId: train.id, position: 2 },
    ])

    // Renumbering names the two that are left, and the hole closes behind them:
    // a sequence is written as the Places it counts out, not as a swap across
    // whatever numbering was there before.
    expect((await request.put(`/api/scenes/${from.id}/exits/places`,
      { data: { places: [drawn[2]!.id, drawn[0]!.id] } })).status()).toBe(200)
    await expect(readExits(from.id)).resolves.toMatchObject([
      { toSceneId: train.id, position: 0 }, { toSceneId: buffet.id, position: 1 },
    ])
  })

test('an Exit only joins Scenes of the same Story', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const elsewhere = await openGraph(request, ['Another Scene'])

  const response = await request.post(`/api/scenes/${scenes[0]!.id}/exits`, {
    data: { toSceneId: elsewhere.scenes[0]!.id },
  })

  expect(response.status()).toBe(404)
  await expect(readExits(scenes[0]!.id)).resolves.toEqual([])
})

test('the opening Scene can be changed', async ({ request }) => {
  const { story, scenes } = await openGraph(request)

  const opened = await request.post(`/api/scenes/${scenes[1]!.id}/opening`)

  expect(opened.status()).toBe(200)
  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ openingSceneId: scenes[1]!.id })
})

test('deleting a Scene takes the Exits touching it, and the opening with it', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const [opening, other] = scenes as [{ id: string }, { id: string }]
  await request.post(`/api/scenes/${opening.id}/exits`, { data: { toSceneId: other.id } })
  await request.post(`/api/scenes/${other.id}/exits`, { data: { toSceneId: opening.id } })

  expect((await request.delete(`/api/scenes/${opening.id}`)).status()).toBe(200)

  // Both Exits are gone — the one that left the Scene and the one that arrived —
  // and the Story is left with no opening Scene for the Author to name again.
  await expect(readExits(other.id)).resolves.toEqual([])
  await expect((await request.get(`/api/stories/${story.id}`)).json())
    .resolves.toMatchObject({ openingSceneId: null, exits: [] })
})

test('a graph that was never drawn reads as absent', async ({ request }) => {
  const { scenes } = await openGraph(request)

  const responses = await Promise.all([
    request.patch(`/api/scenes/${noId}`, { data: { x: 10, y: 10 } }),
    request.post(`/api/scenes/${noId}/opening`),
    request.post(`/api/scenes/${noId}/exits`, { data: { toSceneId: scenes[0]!.id } }),
    request.post(`/api/scenes/${scenes[0]!.id}/exits`, { data: { toSceneId: noId } }),
    request.patch(`/api/exits/${noId}`, { data: { text: 'Follow her' } }),
    request.put(`/api/exits/${noId}/conditions`, { data: {} }),
    request.put(`/api/scenes/${noId}/flags`, { data: { sets: {} } }),
    request.put(`/api/scenes/${noId}/exits/places`, { data: { places: [noId] } }),
    request.delete(`/api/exits/${noId}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)
})

test('the graph belongs to the Author who wrote the Story', async ({ request, otherAuthor }) => {
  const theirStory = await seedStory(otherAuthor, 'Their Story')
  const theirScene = await seedScene(theirStory, 'Their Scene')
  const theirOther = await seedScene(theirStory, 'Their other Scene')
  const theirExit = await seedExit(theirScene.id, theirOther.id)

  const responses = await Promise.all([
    request.patch(`/api/scenes/${theirScene.id}`, { data: { x: 999, y: 999 } }),
    request.post(`/api/scenes/${theirScene.id}/opening`),
    request.post(`/api/scenes/${theirScene.id}/exits`, { data: { toSceneId: theirOther.id } }),
    request.patch(`/api/exits/${theirExit.id}`, { data: { text: 'Mine now' } }),
    request.put(`/api/exits/${theirExit.id}/conditions`, {
      data: { conditions: [{ flag: 'mine', is: 'now' }] },
    }),
    request.put(`/api/scenes/${theirScene.id}/flags`, { data: { sets: { mine: 'now' } } }),
    request.put(`/api/scenes/${theirExit.fromSceneId}/exits/places`,
      { data: { places: [theirExit.id] } }),
    request.delete(`/api/exits/${theirExit.id}`),
  ])

  for (const response of responses) expect(response.status()).toBe(404)

  // The 404s have to mean the graph was left alone, not merely that the answer
  // said nothing about a graph that was changed anyway.
  await expect(readScenePlacement(theirScene.id)).resolves.toMatchObject({ x: 0, y: 0 })
  await expect(readExits(theirScene.id)).resolves.toEqual([theirExit])
  await expect(readFlags(theirScene.id)).resolves.toEqual({})
})

test('an Author lays out the graph from the page alone', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  const node = page.getByRole('article', { name: 'The arrival' })
  await expect(node).toBeVisible()

  // The card itself takes focus and the four arrow keys — there is no handle,
  // because there is nothing on a card to type into — which is also the only way
  // a test can say where a Scene ended up.
  await node.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(async () => {
    const node = await readScenePlacement(scenes[0]!.id)
    expect(node).toMatchObject({ x: 20, y: 20 })
  }).toPass()

  // And the pointer drags it from anywhere on the card, which is how an Author
  // actually lays out a graph: the point taken here is the foot of the card,
  // which carries no control at all.
  const box = (await node.boundingBox())!
  const held = { x: box.x + box.width / 2, y: box.y + box.height - 8 }
  await page.mouse.move(held.x, held.y)
  await page.mouse.down()
  await page.mouse.move(held.x + 100, held.y + 60, { steps: 5 })
  await page.mouse.up()
  await expect(async () => {
    await expect(readScenePlacement(scenes[0]!.id)).resolves.toMatchObject({ x: 120, y: 80 })
  }).toPass()

  // The button that writes the Scene is pressed and never dragged, so a hand that
  // wanders while pressing it leaves the Scene where it was.
  const write = page.getByRole('button', { name: 'Write Scene The arrival' })
  const button = (await write.boundingBox())!
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2)
  await page.mouse.down()
  await page.mouse.move(button.x + button.width / 2 + 80, button.y + button.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(readScenePlacement(scenes[0]!.id)).resolves.toMatchObject({ x: 120, y: 80 })

  // An Exit to write the text of, drawn through the hidden button rather than by
  // hand: the gesture has its own specs below, and the Scene this one lands on is
  // stacked below the bench's own fold where a pointer would have to scroll to it.
  // Drawn before anything is written, because writing a Scene folds the graph into
  // a rail and a rail is pressed rather than drawn on.
  await page.getByRole('button', { name: 'Draw an Exit from The arrival' }).press('Enter')
  await page.getByRole('button', { name: 'Exit from The arrival to The platform' }).press('Enter')

  // Everything written about a Scene is on the surface the bench folds open for
  // it, so from here that surface is opened.
  await writeScene(page, 'The arrival')
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // The Scene keeps a bare strip of the ways on, and the Exit's own text is
  // written in the panel a row of that strip hands over to.
  await expect(page.getByRole('textbox', { name: 'Exit to The platform' })).toBeHidden()
  await openWayOn(page, 'The arrival', 'The platform')

  const exitText = page.getByRole('textbox', { name: 'Exit to The platform' })
  await expect(exitText).toBeVisible()
  await exitText.fill('Follow her out')
  await exitText.blur()

  // One panel, so writing the other Scene takes the Exit's place in it.
  await writeScene(page, 'The platform')
  await page.getByRole('radio', { name: 'Opening Scene The platform' }).check()

  // Reloading before a write has landed would abort it, so what the page did is
  // read back past it first — and that is also what proves the Exit persisted.
  await expect(async () => {
    await expect(readExits(scenes[0]!.id))
      .resolves.toMatchObject([{ toSceneId: scenes[1]!.id, text: 'Follow her out' }])
    await expect(readScenePlacement(scenes[1]!.id))
      .resolves.toMatchObject({ openingSceneId: scenes[1]!.id })
  }).toPass()

  // What the page shows has to be what was written, not what the page remembers.
  // A reload comes back to the Scene that was being written, because the address
  // carries it — see the spec of its own below — so nothing is opened again here.
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Opening Scene The platform' })).toBeChecked()
  await writeScene(page, 'The arrival')
  await openWayOn(page, 'The arrival', 'The platform')
  await expect(page.getByRole('textbox', { name: 'Exit to The platform' }))
    .toHaveValue('Follow her out')
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .toHaveCSS('translate', '120px 80px')

  // Taken away from the panel it is written in, which goes with it.
  await page.getByRole('button', { name: 'Delete Exit to The platform' }).click()
  await expect(page.getByRole('textbox', { name: 'Exit to The platform' })).toBeHidden()
  await expect(readExits(scenes[0]!.id)).resolves.toEqual([])
})

test('writing a Scene takes the width, and folds the graph into a rail', async ({
  page,
  request,
}) => {
  const { story } = await openWideGraph(request)
  await page.goto(`/stories/${story.id}`)

  const graph = page.locator('.graph')
  const panel = page.locator('.panel')
  const level = page.locator('.zooming .level')
  const scrolledTo = () => graph.evaluate(
    box => ({ x: Math.round(box.scrollLeft), y: Math.round(box.scrollTop) }))
  const whole = (await graph.boundingBox())!.width

  // Where the Author left the bench: pulled back a step, and pushed away from the
  // corner it opens at. Both are theirs, and the fold has to give both back.
  await page.getByRole('button', { name: 'Pull back from the graph' }).click()
  await expect(level).toContainText('75%')
  // A step of the zoom travels, and what a box scrolls across is what is drawn in
  // it: pushed while the scale is still on its way, the bench would be pushed
  // against an extent still shrinking under it, and the browser would put the
  // scroll back where that extent allows rather than where the push asked.
  await expect.poll(() => graph.evaluate(box => Math.round(box.scrollWidth)))
    .toBe(Math.round(WIDE_SURFACE * 0.75))
  await graph.evaluate(box => box.scrollTo(300, 120))
  const left = await scrolledTo()

  await writeScene(page, 'The arrival')
  // The Scene is carried in the address, so the fold lands with the navigation
  // rather than with the press: what is measured below is waited for first.
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // The Scene takes the width of the bench and the graph folds beside it rather
  // than the two sharing it: a Shot written in three hundred and eighty pixels is
  // written in a column narrower than a phone.
  const rail = (await graph.boundingBox())!
  const surface = (await panel.boundingBox())!
  expect(rail.width).toBeLessThan(whole / 4)
  expect(surface.width).toBeGreaterThan(rail.width * 3)
  expect(surface.x).toBeGreaterThanOrEqual(rail.x + rail.width - 1)

  // The rail is the graph drawn small and not a list of names: every Scene is
  // still at the coordinates it is stored at, nothing is renumbered, and the
  // drawing itself is what is scaled. The Scene being written is marked on it.
  const arrival = page.getByRole('article', { name: 'The arrival' })
  await expect(arrival).toHaveCSS('translate', '600px 300px')
  await expect(arrival).toHaveClass(/writing/)
  expect(Number(await page.locator('.surface').evaluate(
    drawn => getComputedStyle(drawn).scale))).toBeLessThan(1)

  // Pressing another card in the rail changes the Scene being written and leaves
  // the graph folded: the rail is how an Author moves about their own Story while
  // they are writing it.
  await page.getByRole('article', { name: 'The platform' }).click()
  await expect(page.getByRole('group', { name: 'Writing The platform' })).toBeVisible()
  expect((await graph.boundingBox())!.width).toBeCloseTo(rail.width, 0)

  // And unfolding gives back the scale and the scroll the Author left, because a
  // fold that forgets is a fresh search rather than a fold.
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(level).toContainText('75%')
  expect((await graph.boundingBox())!.width).toBeCloseTo(whole, 0)
  await expect.poll(scrolledTo).toEqual(left)

  // Below the width the graph already breaks at there is no room for two of them,
  // so one of them is on screen at a time: the Scene covers the bench, and is
  // closed by the same control that closes it at any other width.
  await page.setViewportSize({ width: 600, height: 800 })
  await writeScene(page, 'The arrival')
  await expect.poll(async () => (await panel.boundingBox())!.x).toBeLessThan(
    (await graph.boundingBox())!.x + 1)
  await page.getByRole('button', { name: 'Close this panel' }).click()
  await expect(panel).toHaveCount(0)
})

test('a Scene being written has an address, and a stale one is not an error', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The arrival')
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[0]!.id}$`))

  // Every Scene written after the first replaces that entry rather than adding
  // one, so the browser's back closes the writing instead of walking the Author
  // card by card through everything they opened on the way.
  await page.getByRole('article', { name: 'The platform' }).click()
  await expect(page.getByRole('group', { name: 'Writing The platform' })).toBeVisible()
  await page.goBack()
  await expect(page.locator('.panel')).toHaveCount(0)
  await expect(page).toHaveURL(`/stories/${story.id}`)

  // What the address carries survives a reload, which is what makes a link to a
  // Scene one an Author can send themselves.
  await writeScene(page, 'The arrival')
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[0]!.id}$`))
  await page.reload()
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // A Shot stops the reversal: it is written in the Scene's own surface and has no
  // address of its own.
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[0]!.id}$`))

  // And an address naming a Scene the Story no longer holds opens the Story with
  // nothing written: the Author deleted that Scene themselves, and a not-found
  // would be the bench reporting their own act back to them as an error.
  await page.goto(`/stories/${story.id}?scene=${noId}`)
  await expect(page.getByRole('article', { name: 'The arrival' })).toBeVisible()
  await expect(page.locator('.panel')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('the panel is closed by Escape, and focus comes back to the card', async ({
  page,
  request,
}) => {
  const { story } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  const write = page.getByRole('button', { name: 'Write Scene The arrival' })
  await write.click()
  await expect(write).toHaveAttribute('aria-expanded', 'true')

  // The panel opens on the field the Scene is named in, so the keyboard has
  // reached what it opened.
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.locator('.panel')).toHaveCount(0)
  await expect(write).toHaveAttribute('aria-expanded', 'false')
  await expect(write).toBeFocused()
})

test('a card keeps its own shape, and drags from the image on it', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openGraph(request)
  const shot = await (await request.post(`/api/scenes/${scenes[0]!.id}/shots`)).json()
  expect((await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })).status()).toBe(200)

  await page.goto(`/stories/${story.id}`)
  const card = page.getByRole('article', { name: 'The arrival' })
  const face = card.locator('.card')

  // Writing the Scene is said on the bench and changes nothing else about the
  // card: folded into the rail it is the same card at the rail's own scale, and it
  // is exactly as it was again once the graph is whole. Pinned to the pixel,
  // because the class that says a Scene is being written once collided with the one
  // a Shot's own writing wears and inherited its grid gap, which shifted the card's
  // face sideways the moment an Author pressed Write.
  const box = (await card.boundingBox())!
  const shut = (await face.boundingBox())!
  await writeScene(page, 'The arrival')
  await expect(card).toHaveClass(/writing/)
  const scale = Number(
    await page.locator('.surface').evaluate(drawn => getComputedStyle(drawn).scale))
  const drawn = (await face.boundingBox())!
  const railed = (await card.boundingBox())!
  expect(drawn.width).toBeCloseTo(shut.width * scale, 0)
  expect(drawn.x - railed.x).toBeCloseTo((shut.x - box.x) * scale, 0)

  await page.keyboard.press('Escape')
  await expect.poll(async () => await face.boundingBox()).toEqual(shut)

  // And the image is part of the handle. A browser drags an image out of a page by
  // itself, and that native drag took the gesture and left the Scene where it was.
  const image = (await card.locator('.frame img').boundingBox())!
  const held = { x: image.x + image.width / 2, y: image.y + image.height / 2 }
  await page.mouse.move(held.x, held.y)
  await page.mouse.down()
  await page.mouse.move(held.x + 120, held.y + 60, { steps: 8 })
  await page.mouse.up()

  await expect.poll(() => readScenePlacement(scenes[0]!.id)).toMatchObject({ x: 120, y: 60 })
})

test('an Exit takes the Scene\u2019s place in the panel, and hands it back', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openGraph(request)
  await drawExit(request, scenes[0]!.id, scenes[1]!.id)
  await page.goto(`/stories/${story.id}`)

  await writeScene(page, 'The arrival')
  await openWayOn(page, 'The arrival', 'The platform')

  // One panel: the Exit took the Scene's place in it rather than opening beside it.
  await expect(page.getByRole('group', { name: 'Writing the Exit to The platform' }))
    .toBeVisible()
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toHaveCount(0)

  // And it is only as tall as what it is writing: an Exit is three controls and a
  // line of text, so a panel held at the bench's own height would be a column of
  // empty steel beside a graph the Author is trying to read.
  expect((await page.locator('.panel').boundingBox())!.height)
    .toBeLessThan((await page.locator('.graph').boundingBox())!.height)

  // And it names the Scene it leaves, which is the way back to that Scene.
  await page.getByRole('button', { name: 'Back to The arrival' }).click()
  await expect(page.getByRole('textbox', { name: 'Name of this Scene' }))
    .toHaveValue('The arrival')
  await expect(page.getByRole('textbox', { name: 'Exit to The platform' })).toBeHidden()
})

test('two Scenes moved one after the other are both written', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  // Moving one Scene and then another straight away has to write both: a single
  // wait shared by the graph would drop the first.
  for (const name of ['The arrival', 'The platform']) {
    await page.getByRole('article', { name }).focus()
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

  await writeScene(page, 'The arrival')
  const text = page.getByRole('textbox', { name: 'Shot 1' })
  await text.fill('She steps off the train.')

  // The field the writing left flashes. The animation is what the test waits for
  // rather than the class that starts it, because the class is taken off again
  // the moment it ends and would be gone before an assertion could see it.
  //
  // The mark's own animation and no other: the reading beside the Scene throws
  // its frame as it arrives, so the first animation anywhere on the bench is not
  // the one this is about. What is asserted is still which field was lit, which is
  // the whole of the claim.
  const flashed = page.evaluate(() => new Promise<string>((resolve) => {
    document.addEventListener('animationstart', (event) => {
      const field = event.target as HTMLElement
      if (field.classList.contains('kept')) resolve(field.id)
    })
  }))
  await text.blur()
  await expect(flashed).resolves.toBe(await text.getAttribute('id'))

  await expect(keptAt).toHaveCount(1)
  const said = (await keptAt.textContent())!

  // Both marks are quiet on purpose. A live region firing every time a field is
  // left would talk over the next thing typed, so a write that landed is seen and
  // never heard — what does get announced is a refusal, and there was none.
  await expect(toast(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Moving a node is drawing and not writing, so it leaves the time alone even
  // though it reaches the server like everything else. Laid out on the graph
  // rather than in the rail: a Scene is not moved at a tenth of its size.
  await page.keyboard.press('Escape')
  await expect(page.locator('.panel')).toHaveCount(0)
  await page.getByRole('article', { name: 'The arrival' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(async () => {
    await expect(readScenePlacement(scenes[0]!.id)).resolves.toMatchObject({ x: 20 })
  }).toPass()
  await expect(keptAt).toHaveText(said)
})

test('the graph of several dozen Scenes is read as cards', async ({ page, author }) => {
  const story = await seedStory(author, 'A long Story')
  const names = Array.from({ length: 40 }, (_, place) => `Scene ${place + 1}`)
  const scenes = await seedScenes(story, names)
  await seedExit(scenes[0]!.id, scenes[1]!.id)

  await page.goto(`/stories/${story.id}`)

  // Every Scene is a node, and the last of them is reachable by scrolling the
  // graph rather than lost outside it.
  await expect(page.getByRole('article')).toHaveCount(40)
  const last = page.getByRole('article', { name: 'Scene 40' })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeVisible()

  // Forty cards and nothing to type into among them, which is what makes forty
  // Scenes readable rather than merely present: a card says what is in the Scene
  // and where it leads, and every one of them is the same box.
  await expect(page.getByRole('tab', { name: /^Flags/ })).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Scene 1', exact: true }))
    .toContainText('1 Shot, on to Scene 2')
  await expect(last).toContainText('1 Shot, no way on')
  expect((await last.boundingBox())!.height).toBeCloseTo(NODE_HEIGHT, 0)

  // The editor comes on demand, on the surface the bench folds open, and for the
  // one Scene asked for: the graph goes on being forty cards of one size, drawn in
  // the rail beside it.
  await writeScene(page, 'Scene 40')
  await expect(page.getByRole('tab', { name: /^Flags/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveCount(1)
  await expect(page.getByRole('article')).toHaveCount(40)
  const railed = (await last.boundingBox())!.height
  expect(railed).toBeLessThan(NODE_HEIGHT)
  expect((await page.getByRole('article', { name: 'Scene 1', exact: true }).boundingBox())!.height)
    .toBeCloseTo(railed, 0)
})

test('a card names three of the ways on and counts the rest', async ({ page, author }) => {
  const story = await seedStory(author, 'A branching Story')
  const scenes = await seedScenes(
    story, ['The junction', 'North', 'South', 'East', 'West'])
  for (const landing of scenes.slice(1)) await seedExit(scenes[0]!.id, landing.id)

  await page.goto(`/stories/${story.id}`)

  // Three named and a count of the rest, because a card is the same size for
  // every Scene and where a Scene leads is what a graph is read for.
  await expect(page.getByRole('article', { name: 'The junction' }))
    .toContainText('1 Shot, on to North, South, East and 1 more')
})

test('a card is a strip and a face, and the panel beside it is what scrolls', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openGraph(request)
  const opening = scenes[0]!
  // Enough Shots that what is written about the Scene is taller than the panel,
  // which is what puts a scrollbar there and nowhere on the bench.
  for (const _ of [1, 2, 3]) await request.post(`/api/scenes/${opening.id}/shots`)

  await page.goto(`/stories/${story.id}`)
  // Addressed by class, where the rest of the suite goes through roles: which part
  // of the bench carries the scrollbar is a fact about the drawing, and the
  // drawing has no accessible name to ask for it by.
  const node = page.getByRole('article', { name: 'The arrival' })
  const strip = node.locator('.strip')
  const card = (await node.boundingBox())!

  // A card is the one size whatever the Scene holds, and the strip is a column of
  // it, so it runs the card's full height between its own two hairlines.
  expect(card.height).toBeCloseTo(NODE_HEIGHT, 0)
  expect((await strip.boundingBox())!.height).toBeCloseTo(card.height - 2, 0)

  // The whole card takes the touch: it is dragged from anywhere on it, and there
  // is nothing on it to scroll instead.
  expect(await node.evaluate(held => getComputedStyle(held).touchAction)).toBe('none')

  await writeScene(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 3' })).toBeVisible()

  // The surface is as tall as the bench and scrolls inside itself, so a Scene of
  // several Shots is read there rather than down the page — and the card it was
  // opened from is that very card again once the graph is unfolded.
  const panel = page.locator('.panel')
  expect((await panel.boundingBox())!.height)
    .toBeLessThanOrEqual((await page.locator('.graph').boundingBox())!.height)
  await panel.evaluate(scrolled => scrolled.scrollBy(0, 200))
  await expect.poll(() => panel.evaluate(scrolled => scrolled.scrollTop)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect.poll(async () => await node.boundingBox()).toEqual(card)
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

  // The card says it in words too, for whoever is not reading the colour.
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .toContainText('Opening Scene')
  await expect(page.getByRole('article', { name: 'The platform' }))
    .not.toContainText('Opening Scene')

  // Naming another Scene moves the mark, and it moves on the card rather than
  // anywhere the Author has to open a panel to see.
  await writeScene(page, 'The platform')
  await page.getByRole('radio', { name: 'Opening Scene The platform' }).check()
  await expect.poll(() => stripOf('The platform')).toBe(marked)
  expect(await stripOf('The arrival')).toBe(plain)
  await expect(page.getByRole('article', { name: 'The platform' }))
    .toContainText('Opening Scene')
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .not.toContainText('Opening Scene')
})

test('every card is one size, whatever the Scene in it holds', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request, ['The arrival', 'The platform', 'The bar'])
  // Two ways on out of one Scene and none out of the others: what a card says is
  // not the same length for each, and its height has to be all the same.
  await drawExit(request, scenes[1]!.id, scenes[0]!.id)
  await drawExit(request, scenes[1]!.id, scenes[2]!.id)
  // A Shot apiece, because a Scene an Author has written in has one and a card
  // counts them.
  for (const scene of scenes) await request.post(`/api/scenes/${scene.id}/shots`)

  await page.goto(`/stories/${story.id}`)

  const heightOf = async (name: string) =>
    (await page.getByRole('article', { name }).boundingBox())!.height
  const names = ['The arrival', 'The platform', 'The bar']
  const sizes = await Promise.all(names.map(heightOf))
  expect(new Set(sizes).size).toBe(1)
  expect(sizes[0]).toBeCloseTo(NODE_HEIGHT, 0)

  // Writing a Scene folds the graph into the rail and leaves every card as it was
  // beside the other two: the shape of a long Story is read off cards that are all
  // one size, at whichever size the bench is drawing them, and a second Shot grows
  // the surface it is written on rather than the bench.
  await writeScene(page, 'The arrival')
  await page.getByRole('button', { name: 'Add Shot to The arrival' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
  const railed = await Promise.all(names.map(heightOf))
  expect(new Set(railed).size).toBe(1)
  expect(railed[0]).toBeLessThan(sizes[0]!)

  await page.keyboard.press('Escape')
  await expect.poll(async () => await Promise.all(names.map(heightOf))).toEqual(sizes)
})

test('a Scene sets Flags on entry, and an Exit carries Conditions', async ({ request }) => {
  const { story, scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]

  // An Exit is drawn offered to everyone, as a Scene starts setting nothing.
  const exit = await drawExit(request, from.id, to.id)
  expect(exit.conditions).toEqual([])

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
  const conditioned = await request.put(`/api/exits/${exit.id}/conditions`, {
    data: { conditions: both },
  })
  expect(conditioned.status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{ id: from.id, sets: { coat: 'on', 'the key': 'found' } }, { id: to.id, sets: {} }],
    exits: [{ id: exit.id, conditions: both }],
  })

  // Sending no Conditions is how an Exit goes back to being offered to everyone,
  // and sending no Flags is how a Scene stops setting them.
  await request.put(`/api/exits/${exit.id}/conditions`, { data: {} })
  await request.put(`/api/scenes/${from.id}/flags`, { data: { sets: {} } })
  await expect(readExits(from.id)).resolves.toMatchObject([{ conditions: [] }])
  await expect(readFlags(from.id)).resolves.toEqual({})
})

test('half a Flag, and a Condition of no shape, are refused rather than stored', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]
  const exit = await drawExit(request, from.id, to.id)

  await request.put(`/api/scenes/${from.id}/flags`, { data: { sets: { coat: 'on' } } })
  await request.put(`/api/exits/${exit.id}/conditions`, {
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
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ flag: '', is: 'on' }] },
    }),
    request.put(`/api/exits/${exit.id}/conditions`, { data: { conditions: [{ of: 'nothing' }] } }),
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ flag: 'coat', is: 'on', and: { flag: 'key', is: 'found' } }] },
    }),
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ scene: 'The arrival', visits: 'at least', times: 2 }] },
    }),
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ scene: from.id, visits: 'as often as', times: 2 }] },
    }),
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ scene: from.id, visits: 'at least', times: VISITS_MAX + 1 }] },
    }),
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ scene: from.id, visits: 'at least', times: 1.5 }] },
    }),
    // One bad member is a bad list, wherever in it it sits.
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ flag: 'coat', is: 'on' }, { of: 'nothing' }] },
    }),
    // A list is a list of Conditions, not a Condition.
    request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: { flag: 'coat', is: 'on' } },
    }),
    request.put(`/api/exits/${exit.id}/conditions`, { data: { conditions: conditionsPastTheCap } }),
  ])

  for (const response of refused) expect(response.status()).toBe(400)

  // The list at the cap is the one thing here that is not too long.
  const atTheCap = conditionsPastTheCap.slice(0, CONDITIONS_MAX)
  const allowed = await request.put(`/api/exits/${exit.id}/conditions`, {
    data: { conditions: atTheCap },
  })
  expect(allowed.status()).toBe(200)
  await request.put(`/api/exits/${exit.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })

  // Every refusal left what the Author had already written where it was.
  await expect(readFlags(from.id)).resolves.toEqual({ coat: 'on' })
  await expect(readExits(from.id))
    .resolves.toMatchObject([{ conditions: [{ flag: 'coat', is: 'on' }] }])
})

test('a Condition counts only a Scene of the Exit’s own Story', async ({ request }) => {
  const { scenes } = await openGraph(request)
  const [from, to] = scenes as [{ id: string }, { id: string }]
  const exit = await drawExit(request, from.id, to.id)
  const elsewhere = await openGraph(request, ['A Scene of another Story'])

  // Second in the list, so the refusal is of the list rather than of its head.
  const refused = await request.put(`/api/exits/${exit.id}/conditions`, {
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
  await expect(readExits(from.id)).resolves.toMatchObject([{ conditions: [] }])
})

test('an Author orders the ways on from the page alone', async ({ page, request }) => {
  const { story, scenes } = await openGraph(
    request, ['The platform', 'The buffet', 'The tunnel'])
  const [from, buffet, tunnel] = scenes as [{ id: string }, { id: string }, { id: string }]
  await drawExit(request, from.id, buffet.id)
  await drawExit(request, from.id, tunnel.id)

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The platform')

  // In the strip beside the Scene, which is not the only place a way on is
  // renumbered any more: the reading offers the same pair of controls on the
  // choice buttons as they are read — see
  // `docs/adr/0030-a-story-is-read-where-it-is-written.md`.
  const ways = page.locator('.panel .ways')

  await openTab(page, 'Ways on')
  await ways.getByRole('button', { name: 'Move earlier the Exit to The tunnel' }).click()
  await expect(async () => {
    await expect(readExits(from.id)).resolves.toMatchObject([
      { toSceneId: tunnel.id, position: 0 },
      { toSceneId: buffet.id, position: 1 },
    ])
  }).toPass()

  // The way on that comes first has nowhere earlier to go, and the page says so
  // rather than asking. The reload comes back to the Scene being written, which the
  // address carries, so nothing is opened again here.
  await page.reload()
  await openTab(page, 'Ways on')
  await expect(ways.getByRole('button', { name: 'Move earlier the Exit to The tunnel' }))
    .toBeDisabled()
  await expect(ways.getByRole('button', { name: 'Move later the Exit to The buffet' }))
    .toBeDisabled()

  // And by hand: a row dragged onto another takes the Place that row stood at.
  await dragWayOn(page, 'The platform', 'The buffet', 'The tunnel')
  await expect(async () => {
    await expect(readExits(from.id)).resolves.toMatchObject([
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
    await expect(readExits(from.id)).resolves.toMatchObject([
      { toSceneId: tunnel.id, position: 0 },
      { toSceneId: buffet.id, position: 1 },
    ])
  }).toPass()

  // A drag that renumbered is not also a press, so it opened no panel: the
  // gesture said what it meant once.
  await expect(page.getByRole('textbox', { name: 'Exit to The buffet' })).toBeHidden()
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
 * aim at: an Exit between two nodes in a row draws a line of no height, which is
 * nothing a pointer can be told to press, and two Exits leaving on the same
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

test('an Exit is written in the panel its own line hands over to', async ({ page, request }) => {
  const { story, scenes } = await layOut(request, {
    'The arrival': [0, 0],
    'The platform': [400, 220],
    'The bar': [100, 620],
  })
  const [from, platform, bar] = scenes as [{ id: string }, { id: string }, { id: string }]
  const first = await drawExit(request, from.id, platform.id)
  const second = await drawExit(request, from.id, bar.id)

  await page.goto(`/stories/${story.id}`)

  const drawing = (exit: { id: string }) => page.locator(`[data-exit="${exit.id}"]`)
  const lineOf = (exit: { id: string }) => drawing(exit).locator('line.aimed')
  const panelOn = (scene: string) =>
    page.getByRole('group', { name: `Writing the Exit to ${scene}` })

  // Every way on is labelled on the bench with the Place it is offered at, on a
  // disc near the Scene it leaves.
  await expect(drawing(first).locator('text.place')).toHaveText('1')
  await expect(drawing(second).locator('text.place')).toHaveText('2')

  // Pressing a line puts that Exit in the panel at the edge of the bench, and the
  // Exit it holds is lit on the bench itself.
  await lineOf(first).click()
  await expect(panelOn('The platform')).toBeVisible()
  await expect(drawing(first).locator('line.lit')).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Exit to The platform' })).toBeFocused()

  // The panel is beside the graph rather than over it, so scrolling the bench
  // leaves it exactly where it was: what it is writing is not where it is drawn.
  const bench = page.locator('.graph')
  const docked = (await panelOn('The platform').boundingBox())!
  await bench.evaluate(scrolled => scrolled.scrollTop = 60)
  await expect.poll(() => bench.evaluate(scrolled => scrolled.scrollTop)).toBe(60)
  expect(await panelOn('The platform').boundingBox()).toEqual(docked)
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

  // What is written in the panel is written on the Exit: its text, and a Condition
  // it is offered under.
  await lineOf(first).click()
  const exitText = page.getByRole('textbox', { name: 'Exit to The platform' })
  await exitText.fill('Follow her out')
  await exitText.blur()

  await page.getByRole('button', { name: 'Add a Condition to the Exit to The platform' }).click()
  const flag = page.getByLabel('Flag of Condition 1 of the Exit to The platform')
  await flag.fill('coat')
  await flag.blur()

  await expect(async () => {
    await expect(readExits(from.id)).resolves.toMatchObject([
      { id: first.id, text: 'Follow her out', conditions: [{ flag: 'coat', is: '' }] },
      { id: second.id },
    ])
  }).toPass()

  // And taken away from the same panel, which goes with the Exit it was writing.
  await page.getByRole('button', { name: 'Delete Exit to The platform' }).click()
  await expect(panelOn('The platform')).toBeHidden()
  await expect(async () => {
    await expect(readExits(from.id)).resolves.toMatchObject([{ id: second.id, position: 0 }])
  }).toPass()
})

test('the strip is the way to an Exit for a hand that is not on a pointer',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform'])
    const [from, to] = scenes as [{ id: string }, { id: string }]
    await drawExit(request, from.id, to.id)

    await page.goto(`/stories/${story.id}`)

    // The card says where the Scene leads, and the panel says it again as the
    // strip of ways on: the card is read, the strip is the route.
    const node = page.getByRole('article', { name: 'The arrival' })
    await expect(node).toContainText('on to The platform')
    await writeScene(page, 'The arrival')
    await openTab(page, 'Ways on')

    // The strip holds the Place, where the way on arrives, and the two controls —
    // and no text and no Conditions: those are the Exit's own panel.
    const row = page.getByRole('button', { name: 'The platform — way on from The arrival' })
    await expect(row).toHaveText(/1\s+The platform/)
    await expect(page.getByRole('textbox', { name: 'Exit to The platform' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Delete Exit to The platform' })).toBeHidden()

    // Reached from the keyboard, the row hands the panel over to the Exit and puts
    // the focus in its text.
    await row.press('Enter')
    await expect(page.getByRole('textbox', { name: 'Exit to The platform' })).toBeFocused()

    // And Escape closes the panel, giving the focus back to the card of the Scene
    // the Exit leaves — which is where the way in started.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('group', { name: 'Writing the Exit to The platform' }))
      .toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Write Scene The arrival' })).toBeFocused()
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
  await drawExit(request, from.id, to.id)

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')
  await openTab(page, 'Flags')

  // A Flag is a row of two fields, a name and the value it holds, and neither of
  // them carries punctuation: the row is added with a control, and the hand is
  // put in its name field by the press that made it.
  await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
  const flag = page.getByLabel('Name of Flag 1 set on entering The arrival')
  await expect(flag).toBeFocused()
  await flag.fill('coat')
  await flag.blur()
  const holds = page.getByLabel('Value 1 of Flag 1 set on entering The arrival')
  await holds.fill('on')
  await holds.blur()

  await openWayOn(page, 'The arrival', 'The platform')
  await page.getByRole('button', { name: 'Add a Condition to the Exit to The platform' }).click()
  // The name of the Flag and the value it holds are written one at a time,
  // because the Flag alone is half a Condition and is written as soon as it has
  // a name — and the value is then typed into the same field the Author was
  // left holding.
  const tested = page.getByLabel('Flag of Condition 1 of the Exit to The platform')
  await expect(tested).toBeFocused()
  await tested.fill('coat')
  await tested.blur()
  const is = page.getByLabel('holds for Condition 1 of the Exit to The platform')
  await is.fill('on')
  // A second Condition, added from the keyboard while the first is being
  // written, which is what makes several in a row one gesture repeated: what was
  // typed is written on the way, and the hand lands in the new row.
  await is.press('Enter')
  await expect(page.getByLabel('Flag of Condition 2 of the Exit to The platform'))
    .toBeFocused()
  // Exactly, because "Condition 2 of the Exit to The platform" is also the tail
  // of the labels on the fields of that Condition.
  await page
    .getByLabel('Condition 2 of the Exit to The platform', { exact: true })
    .selectOption('visits')

  // Read back past the page, which is what proves all of it landed — and has to
  // happen before the reload, which would abort a write still in flight.
  await expect(async () => {
    await expect(readFlags(from.id)).resolves.toEqual({ coat: 'on' })
    await expect(readExits(from.id)).resolves.toMatchObject([{
      conditions: [
        { flag: 'coat', is: 'on' },
        { scene: from.id, visits: 'at least', times: 2 },
      ],
    }])
  }).toPass()

  // What the page shows has to be what was written, not what the page remembers.
  await page.reload()
  await writeScene(page, 'The arrival')
  await expect(page.getByLabel('Name of Flag 1 set on entering The arrival'))
    .toHaveValue('coat')
  await expect(page.getByLabel('Value 1 of Flag 1 set on entering The arrival'))
    .toHaveValue('on')
  await openWayOn(page, 'The arrival', 'The platform')
  await expect(page.getByLabel('Condition 1 of the Exit to The platform', { exact: true }))
    .toHaveValue('flag')
  await expect(page.getByLabel('Flag of Condition 1 of the Exit to The platform'))
    .toHaveValue('coat')
  await expect(page.getByLabel('Condition 2 of the Exit to The platform', { exact: true }))
    .toHaveValue('visits')

  // And an Exit with every Condition taken off it is offered always again.
  for (const place of [2, 1]) {
    await page.getByRole('button',
      { name: `Remove Condition ${place} of the Exit to The platform` }).click()
  }
  await expect(async () => {
    await expect(readExits(from.id)).resolves.toMatchObject([{ conditions: [] }])
  }).toPass()
})

/**
 * Which row of the Flags a named one is written on, since jsonb keeps a Scene's
 * Flags in an order of its own and the rows are numbered as they are drawn.
 */
async function rowOfFlag(page: Page, name: string) {
  const names = await page.getByLabel(/^Name of Flag/).all()
  for (const [at, field] of names.entries()) {
    if (await field.inputValue() === name) return at + 1
  }

  throw new Error(`No Flag named ${name} is written on the bench`)
}

test('an Author writes the values a Flag is drawn from, a field apiece',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request)
    const [arrival] = scenes as [{ id: string }, { id: string }]

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')
    await openTab(page, 'Flags')

    const called = (place: number) => `Flag ${place} set on entering The arrival`
    await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
    await page.getByLabel(`Name of ${called(1)}`).fill('weather')
    await page.getByLabel(`Value 1 of ${called(1)}`).fill('rain')

    // A second value, and a third: the Flag gains a field rather than a
    // punctuation mark, and each press leaves the hand in the field it made.
    for (const [place, value] of [[2, 'sun'], [3, 'haze']] as const) {
      await page.getByRole('button', { name: `Add a value to ${called(1)}` }).click()
      await expect(page.getByLabel(`Value ${place} of ${called(1)}`)).toBeFocused()
      await page.getByLabel(`Value ${place} of ${called(1)}`).fill(value)
    }

    await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
    await page.getByLabel(`Name of ${called(2)}`).fill('coat')
    await page.getByLabel(`Value 1 of ${called(2)}`).fill('on')
    await page.getByLabel(`Value 1 of ${called(2)}`).blur()

    // Three fields on one row and a list in the Story: what the Author wrote as
    // a row of values is what the Scene draws from on every entry.
    await expect(async () => {
      await expect(readFlags(arrival.id))
        .resolves.toEqual({ weather: ['rain', 'sun', 'haze'], coat: 'on' })
    }).toPass()

    // And it is shown back as the row it was written in. Which row a Flag is
    // drawn on is not what is being read: jsonb keeps a Scene's Flags in an
    // order of its own, so the row is found by the name written in it.
    // Nothing is pressed to get the Scene back: it is in the address, so the
    // reload comes back to it already being written — see
    // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`. It comes back on
    // the Shots, which is the tab a Scene always arrives on, so the Flags are
    // asked for again.
    await page.reload()
    await openTab(page, 'Flags')
    await expect(page.getByLabel(/^Name of Flag/).first()).toBeVisible()
    const weather = called(await rowOfFlag(page, 'weather'))

    for (const [place, value] of [[1, 'rain'], [2, 'sun'], [3, 'haze']] as const) {
      await expect(page.getByLabel(`Value ${place} of ${weather}`)).toHaveValue(value)
    }

    // A value taken off leaves the rest of the draw where it was.
    await page.getByRole('button', { name: `Remove value 2 of ${weather}` }).click()
    await expect(async () => {
      await expect(readFlags(arrival.id))
        .resolves.toEqual({ weather: ['rain', 'haze'], coat: 'on' })
    }).toPass()
  })

/**
 * Two typed changes to the same Flags, with the first one held back on its way out
 * for longer than the second takes altogether — which is what an Author on a slow
 * database is really typing into. Whichever of the two arrives last is the one the
 * Story keeps, because the endpoint takes the whole list, so the Author's own last
 * word loses unless the two are sent in the order they were typed.
 */
test('the second of two typed changes is the one the Story keeps', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  const [arrival] = scenes as [{ id: string }, { id: string }]

  // How many more writes to hold back on the wire, which the test arms before
  // each pair it types: the one in front is held for longer than a round trip, so
  // the one typed behind it has every chance to overtake it. What each write said
  // is read off the response rather than the request, because the order being
  // proved is the one the Story took them in and not the one they left the page in.
  const landed: string[] = []
  let holding = 0
  await page.route(`**/api/scenes/${arrival.id}/flags`, async (route) => {
    const { sets } = route.request().postDataJSON() as { sets: Record<string, string> }
    if (holding > 0) {
      holding -= 1
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    const response = await route.fetch()
    landed.push(sets.coat ?? '')
    await route.fulfill({ response })
  })

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')
  await openTab(page, 'Flags')

  const called = 'Flag 1 set on entering The arrival'
  await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
  await page.getByLabel(`Name of ${called}`).fill('coat')
  const value = page.getByLabel(`Value 1 of ${called}`)
  await value.fill('on')
  await value.blur()
  // Waited for, so that what follows is two changes racing each other and not
  // three: the row is whole from here on, and only its value moves.
  await expect(async () => {
    await expect(readFlags(arrival.id)).resolves.toEqual({ coat: 'on' })
  }).toPass()

  // Typed straight through, the way an Author changing their mind types, and with
  // nothing waited for in between: the second value is typed while the first is
  // still on the wire.
  holding = 1
  await value.fill('off')
  await value.blur()
  await value.fill('worn')
  await value.blur()

  // Longer than the hold, so what is being read is the order and not the wait.
  await expect.poll(() => landed, { timeout: 15_000 }).toEqual(['', 'on', 'off', 'worn'])
  await expect(readFlags(arrival.id)).resolves.toEqual({ coat: 'worn' })

  // A value still carrying the punctuation the interface no longer asks for is
  // refused by the server, which goes on holding every limit it held — and the
  // refusal reads the Story back without taking down the write typed behind it,
  // which lands after it and in its turn.
  holding = 1
  await value.fill('rain | sun')
  await value.blur()
  await value.fill('dry')
  await value.blur()

  // The refusal itself is not read here: the write typed behind it clears the
  // last one on its way out, which is the whole point — a Story that ends
  // holding the corrected value is a refusal that took nothing down with it.
  await expect.poll(() => landed, { timeout: 15_000 })
    .toEqual(['', 'on', 'off', 'worn', 'rain | sun', 'dry'])
  await expect(readFlags(arrival.id)).resolves.toEqual({ coat: 'dry' })
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

/** Puts the hand down on a Scene's strip, which is where an Exit is drawn from. */
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

test('an Exit is drawn by dragging from one Scene to another', async ({ page, request }) => {
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

  // The Scene that can take the Exit is lit, the Scene the line left is quiet, and
  // the node it left keeps a ring so the source is legible from across the bench.
  await expect(platform).toHaveClass(/lit/)
  await expect(arrival).toHaveClass(/quiet/)
  await expect(arrival).toHaveClass(/drawing/)

  // The line follows the hand, in the grease pencil, dashed and marching, with the
  // arrowhead that says it will land where it is.
  const line = drawnLine(page)
  await expect(line).toHaveAttribute('marker-end', 'url(#exit-head)')
  const drawn = await line.evaluate((held) => {
    const { stroke, strokeDasharray, animationName, animationDuration } = getComputedStyle(held)
    return { stroke, strokeDasharray, animationName, animationDuration }
  })
  expect(drawn.strokeDasharray).not.toBe('none')
  // Named against a pattern: the animation is declared in a scoped block, so Vue
  // hashes the keyframes' name.
  expect(drawn.animationName).toMatch(/^marching/)
  expect(Number.parseFloat(drawn.animationDuration)).toBeGreaterThan(0)
  // The grease pencil, which is the colour every finished Exit is drawn in.
  expect(drawn.stroke).toBe(
    await page.locator('svg line').first().evaluate(held => getComputedStyle(held).stroke))

  // And it is the first animation in the product, so it is the first thing that
  // stops for anyone who has asked for stillness: still dashed, no longer moving.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => line.evaluate(
    held => Number.parseFloat(getComputedStyle(held).animationDuration))).toBeLessThan(0.001)
  expect(await line.evaluate(held => getComputedStyle(held).strokeDasharray)).not.toBe('none')
  await page.emulateMedia({ reducedMotion: null })

  // Letting go over the Scene draws the Exit, the Story holds it, and the bench
  // says so out loud — a gesture is not a field, so this one is announced.
  await page.mouse.up()
  await expect(toast(page))
    .toHaveText('Exit from The arrival to The platform drawn')
  await expect.poll(() => readExits(scenes[0]!.id)).toMatchObject([
    { fromSceneId: scenes[0]!.id, toSceneId: scenes[1]!.id, position: 0 },
  ])

  // The gesture is over: nothing is lit, and the line is gone.
  await expect(drawnLine(page)).toHaveCount(0)
  await expect(platform).not.toHaveClass(/lit/)
})

test('letting go over the bare bench writes the Scene and exits to it', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openRow(request)
  await page.goto(`/stories/${story.id}`)

  // A point of bare bench beside the row, off the pitch on both axes so that the
  // snapping has something to do.
  const surface = (await page.locator('.surface').boundingBox())!
  const platform = (await page.getByRole('article', { name: 'The platform' }).boundingBox())!
  const drop = { x: platform.x + platform.width + 51, y: platform.y + 29 }

  await aimFrom(page, 'The arrival')
  await page.mouse.move(drop.x, drop.y, { steps: 5 })

  // Over the bench the line keeps its arrowhead: there is nothing there to refuse
  // the Exit, because the Scene it lands on is about to be written.
  await expect(drawnLine(page)).toHaveAttribute('marker-end', 'url(#exit-head)')
  await page.mouse.up()

  // The Scene is written under a provisional name, and the bench says the Exit was
  // drawn to it.
  await expect(toast(page)).toHaveText('Exit from The arrival to A new Scene drawn')
  const written = page.getByRole('article', { name: 'A new Scene' })
  await expect(written).toHaveCount(1)

  // It sits where the hand let go, snapped to the pitch the bench is pricked out
  // at and the arrow keys move a node by.
  const read = await (await request.get(`/api/stories/${story.id}`)).json()
  const scene = read.scenes.find((held: { name: string }) => held.name === 'A new Scene')
  const placement = await readScenePlacement(scene.id)
  expect(placement).toMatchObject(
    snappedWithinReach({ x: drop.x - surface.x, y: drop.y - surface.y }))
  expect(placement.x % NODE_PITCH).toBe(0)
  expect(placement.y % NODE_PITCH).toBe(0)

  // And the Exit that drew it is in the Story, leaving the Scene the gesture began
  // on for the Scene it wrote.
  await expect.poll(() => readExits(scenes[0]!.id)).toMatchObject([
    { fromSceneId: scenes[0]!.id, toSceneId: scene.id, position: 0 },
  ])

  // The panel arrives open on its name, in the field, with the provisional name
  // selected — so the name is replaced by typing it, without leaving the bench.
  const naming = page.getByLabel('Name of this Scene')
  await expect(naming).toBeFocused()
  await expect(naming).toHaveValue('A new Scene')
  // Typed and tabbed out of rather than filled through the field's own locator:
  // the panel is named by the Scene, so the name under the hand changes as it is
  // typed, and the field is reached from the keyboard that is already in it.
  await page.keyboard.type('The buffet')
  await page.keyboard.press('Tab')

  await expect.poll(() => readSceneName(scene.id)).toBe('The buffet')
  await expect(page.getByRole('article', { name: 'The buffet' })).toHaveCount(1)

  // And a hand that leaves the bench altogether has drawn nothing: pointer capture
  // keeps the line following it over the form at the top of the page, but a Scene
  // is written where the Author aimed on the bench or nowhere at all.
  await aimFrom(page, 'The arrival')
  const form = (await page.getByLabel('Name of a new Scene').boundingBox())!
  await page.mouse.move(form.x + form.width / 2, form.y + form.height / 2, { steps: 5 })
  await page.mouse.up()

  expect((await (await request.get(`/api/stories/${story.id}`)).json()).scenes).toHaveLength(3)
  await expect.poll(() => readExits(scenes[0]!.id)).toHaveLength(1)
})

test('an Exit cannot be drawn on a Scene itself, or twice to the same Scene', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openRow(request, ['The arrival', 'The platform', 'The bar'])
  await drawExit(request, scenes[0]!.id, scenes[1]!.id)
  await page.goto(`/stories/${story.id}`)

  await aimFrom(page, 'The arrival')

  // The Scene it already reaches is quiet, and the one it does not is lit: what a
  // Exit may land on is read off the bench rather than out of a list.
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveClass(/quiet/)
  await expect(page.getByRole('article', { name: 'The bar' })).toHaveClass(/lit/)

  // Over the Scene it already reaches, the line loses its arrowhead — said before
  // the Author lets go rather than after.
  await moveOver(page, 'The platform')
  await expect(drawnLine(page)).not.toHaveAttribute('marker-end')
  await page.mouse.up()

  // A second Exit to the same Scene is not what the hand drew, so nothing was
  // written: the one Exit seeded is still the only one leaving the Scene.
  await expect.poll(() => readExits(scenes[0]!.id)).toHaveLength(1)

  // And an Exit on the Scene it left is the other slip the hand cannot make, even
  // though the server would take it.
  await aimFrom(page, 'The arrival')
  await moveOver(page, 'The arrival')
  await expect(drawnLine(page)).not.toHaveAttribute('marker-end')
  await page.mouse.up()
  await expect.poll(() => readExits(scenes[0]!.id)).toHaveLength(1)
})

test('a second way on to the same Scene is written by duplicating the first',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform'])
    const [from, to] = scenes as [{ id: string }, { id: string }]
    const first = await drawExit(request, from.id, to.id)

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')
    await openWayOn(page, 'The arrival', 'The platform')

    const duplicate = page.getByRole('button', { name: 'Duplicate Exit to The platform' })
    /**
     * The row of the strip a way on is offered at, which is also how the bench says
     * a duplicate has landed on it. Waited for there rather than in the database,
     * because what follows a duplicate is typed into the panel: the read the
     * duplicate asks for replaces every Exit in the Story, and a Condition added
     * before it arrived would be taken off the screen by it — see
     * `docs/adr/0008-refetch-is-for-a-refusal.md`.
     *
     * The strip is the Scene's, and one panel holds one thing, so reading it means
     * taking the way back the Exit's panel offers to the Scene it leaves.
     */
    const wayOnAt = (place: number) =>
      page.getByRole('button', { name: `${place} The platform — way on from The arrival` })
    // The way back reopens the Scene on its Shots, which is the tab a Scene always
    // arrives on, so the strip is asked for again each time.
    const backToTheArrival = async () => {
      await page.getByRole('button', { name: 'Back to The arrival' }).click()
      await openTab(page, 'Ways on')
    }

    // Duplicated from the panel: a second Exit to the same Scene, last among the
    // ways on leaving it. The bench says so out loud, because an Exit that arrives
    // without a gesture arrives on a strip the Author may not be looking at.
    await duplicate.click()
    await expect(toast(page))
      .toHaveText('Another Exit from The arrival to The platform written')
    await backToTheArrival()
    await expect(wayOnAt(2)).toBeVisible()
    await expect.poll(() => readExits(from.id)).toMatchObject([
      { id: first.id, position: 0, conditions: [] },
      { toSceneId: to.id, position: 1, conditions: [] },
    ])

    // A Condition on the first, because a Condition is what the pair is for: two
    // ways on to one Scene are offered under opposite tests.
    await wayOnAt(1).click()
    await page.getByRole('button', { name: 'Add a Condition to the Exit to The platform' }).click()
    const flag = page.getByLabel('Flag of Condition 1 of the Exit to The platform')
    await flag.fill('coat')
    await flag.blur()
    const holds = page.getByLabel('holds for Condition 1 of the Exit to The platform')
    await holds.fill('on')
    await holds.blur()

    // Duplicated again, the Conditions come with it — and the duplicate is last
    // among the ways on, not beside the Exit it was copied from.
    await duplicate.click()
    await backToTheArrival()
    await expect(wayOnAt(3)).toBeVisible()
    await expect.poll(() => readExits(from.id)).toMatchObject([
      { id: first.id, position: 0, conditions: [{ flag: 'coat', is: 'on' }] },
      { position: 1, conditions: [] },
      { toSceneId: to.id, position: 2, conditions: [{ flag: 'coat', is: 'on' }] },
    ])
    const copied = (await readExits(from.id))[2]!

    // Its own panel opens from its own row of the strip — the rows are told apart
    // by the Place each is offered at — and what is written in it is written on the
    // copy alone.
    await wayOnAt(3).click()
    const opposite = page.getByLabel('holds for Condition 1 of the Exit to The platform')
    await opposite.fill('off')
    await opposite.blur()

    await expect.poll(() => readExits(from.id)).toMatchObject([
      { id: first.id, conditions: [{ flag: 'coat', is: 'on' }] },
      { conditions: [] },
      { id: copied.id, conditions: [{ flag: 'coat', is: 'off' }] },
    ])
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
  await expect(toast(page)).toHaveText('No Exit was drawn')

  // Letting the hand up after Escape draws nothing either: the gesture it would
  // have landed is already gone.
  await page.mouse.up()
  await expect.poll(() => readExits(scenes[0]!.id)).toEqual([])

  // The same for a gesture the keyboard began.
  await page.getByRole('button', { name: 'Draw an Exit from The arrival' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveClass(/lit/)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('article', { name: 'The platform' })).not.toHaveClass(/lit/)
  await expect.poll(() => readExits(scenes[0]!.id)).toEqual([])
})

test('the keyboard draws the same Exit, through a button hidden until it is focused', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openRow(request)
  await page.goto(`/stories/${story.id}`)

  // The button is in the page for anything that reads it, and nothing an eye can
  // see until it takes focus — the pattern a skip link uses.
  const aim = page.getByRole('button', { name: 'Draw an Exit from The arrival' })
  const seen = async () => (await aim.boundingBox())!.width
  expect(await seen()).toBeLessThan(2)
  await aim.focus()
  expect(await seen()).toBeGreaterThan(2)

  // Pressing it enters the very state the drag enters, and says so, because a
  // gesture nobody can see beginning is one nobody can follow.
  await aim.press('Enter')
  await expect(toast(page))
    .toHaveText(/Drawing an Exit from The arrival/)
  await expect(page.getByRole('article', { name: 'The platform' })).toHaveClass(/lit/)
  await expect(page.getByRole('article', { name: 'The arrival' })).toHaveClass(/drawing/)

  // The Scene the line left offers the way out, and every Scene it may land on
  // offers the landing, named as the Exit it would draw.
  await expect(page.getByRole('button', { name: 'Abandon the Exit from The arrival' }))
    .toHaveCount(1)
  // Pressed rather than clicked, which is the whole point of it: the button is a
  // pixel of clipped nothing under the strip until focus reaches it.
  await page.getByRole('button', { name: 'Exit from The arrival to The platform' }).press('Enter')

  await expect(toast(page))
    .toHaveText('Exit from The arrival to The platform drawn')
  await expect.poll(() => readExits(scenes[0]!.id)).toMatchObject([
    { fromSceneId: scenes[0]!.id, toSceneId: scenes[1]!.id },
  ])

  // The graph is read back with the Exit in it, which is what the next gesture is
  // worked out from: the card now says where the Scene leads.
  await expect(page.getByRole('article', { name: 'The arrival' }))
    .toContainText('on to The platform')

  // And with the Exit drawn, the Scene it reaches is one the keyboard cannot land
  // on twice either: the button that would draw it again is offered disabled.
  await page.getByRole('button', { name: 'Draw an Exit from The arrival' }).press('Enter')
  await expect(page.getByRole('button', { name: 'Exit from The arrival to The platform' }))
    .toBeDisabled()
})

/**
 * A Story laid out far enough apart that the bench has somewhere to go: a graph
 * smaller than the window scrolls nowhere, zooms about nothing in particular and
 * would prove none of what follows.
 */
async function openWideGraph(request: APIRequestContext) {
  return await layOut(request, { 'The arrival': [600, 300], 'The platform': [2400, 1400] })
}

/**
 * Whether a Scene's card is wholly inside the window onto the graph, which is
 * what "on screen" means on a bench: a card can be in the browser's viewport and
 * still be clipped out of the frame it belongs to.
 */
async function framed(page: Page, name: string) {
  const card = (await page.getByRole('article', { name }).boundingBox())!
  const frame = (await page.locator('.graph').boundingBox())!

  return card.x >= frame.x - 1
    && card.y >= frame.y - 1
    && card.x + card.width <= frame.x + frame.width + 1
    && card.y + card.height <= frame.y + frame.height + 1
}

/** How wide the surface of that graph is, which is what the bench scrolls across. */
const WIDE_SURFACE = 2400 + NODE_WIDTH + NODE_GAP

test('the bench pulls back to the whole Story, and comes closer under the pointer', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openWideGraph(request)
  await page.goto(`/stories/${story.id}`)

  const node = page.getByRole('article', { name: 'The arrival' })
  const graph = page.locator('.graph')
  const level = page.locator('.zooming .level')
  const pullBack = page.getByRole('button', { name: 'Pull back from the graph' })
  const comeCloser = page.getByRole('button', { name: 'Come closer to the graph' })

  // Every load opens on the bench at its own size, which is as close as it comes:
  // a card is read and never typed into, so magnifying one buys nothing.
  await expect(level).toContainText('100%')
  await expect(comeCloser).toBeDisabled()
  const own = (await node.boundingBox())!.width

  // A step back draws the card smaller and leaves the Scene exactly where the
  // Author put it: the scale is how the graph is looked at, not what it holds.
  await pullBack.click()
  await expect(level).toContainText('75%')
  // Polled, because a step of the zoom travels rather than jumping: what is read
  // the instant the reading changes is a card halfway there.
  await expect.poll(async () => (await node.boundingBox())!.width).toBeCloseTo(own * 0.75, 0)
  await expect(readScenePlacement(scenes[0]!.id)).resolves.toMatchObject({ x: 600, y: 300 })

  // And the bench scrolls exactly as far as the surface is now drawn, rather than
  // as far as the surface would be at its own size.
  await expect.poll(() => graph.evaluate(box => box.scrollWidth))
    .toBeCloseTo(WIDE_SURFACE * 0.75, -0.5)

  // A quarter is the far end of it, which is where forty Scenes fit on a screen.
  await pullBack.click()
  await pullBack.click()
  await expect(level).toContainText('25%')
  await expect(pullBack).toBeDisabled()

  // The fit pulls back until the whole Story is inside the window onto it. Not
  // until the scroll runs out: a bench keeps room around the work on it, so there
  // is always somewhere left to push it.
  await comeCloser.click()
  await comeCloser.click()
  await page.getByRole('button', { name: 'Fit the graph' }).click()
  for (const name of ['The arrival', 'The platform']) {
    await expect.poll(() => framed(page, name)).toBe(true)
  }

  // The three shortcuts a viewport is expected to answer, taken off the browser's
  // own page zoom: `⌘0` fits, and the other two step about the middle of what is
  // on screen.
  for (let step = 0; step < 4; step++) await page.keyboard.press('Control+=')
  await expect(level).toContainText('100%')
  await page.keyboard.press('Control+-')
  await expect(level).toContainText('75%')
  await page.keyboard.press('Control+0')
  await expect(level).not.toContainText('75%')

  // The wheel with Ctrl held — which is what a trackpad sends while two fingers
  // pinch — comes closer about the pointer: the corner of the card the cursor is
  // on is the corner it is still on afterwards.
  for (let step = 0; step < 4; step++) await page.keyboard.press('Control+=')
  await pullBack.click()
  await expect.poll(async () => (await node.boundingBox())!.width).toBeCloseTo(own * 0.75, 0)
  await graph.evaluate((box) => {
    box.scrollLeft = 0
    box.scrollTop = 0
  })
  const corner = (await node.boundingBox())!
  await page.mouse.move(corner.x, corner.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -120)
  await page.keyboard.up('Control')

  await expect.poll(async () => (await node.boundingBox())!.width).toBeGreaterThan(corner.width)
  const anchored = (await node.boundingBox())!
  expect(Math.abs(anchored.x - corner.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(anchored.y - corner.y)).toBeLessThanOrEqual(2)

  // A step of the zoom travels, so that what moved can be seen to have moved —
  // and for an Author who has asked for no motion it is cut to the single tick
  // the stylesheet cuts every other transition on the page to.
  const easing = () => page.locator('.surface').evaluate(
    surface => Number.parseFloat(getComputedStyle(surface).transitionDuration))

  await pullBack.click()
  expect(await easing()).toBeGreaterThan(0.01)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await pullBack.click()
  expect(await easing()).toBeLessThan(0.001)

  // None of it is written anywhere: the bench opens at its own size again.
  await page.reload()
  await expect(level).toContainText('100%')
})

test('the bare bench is pushed about under the hand', async ({ page, request }) => {
  const { story, scenes } = await openWideGraph(request)
  const exit = await drawExit(request, scenes[0]!.id, scenes[1]!.id)
  await page.goto(`/stories/${story.id}`)

  const graph = page.locator('.graph')
  const scrolledTo = () => graph.evaluate(
    box => ({ x: Math.round(box.scrollLeft), y: Math.round(box.scrollTop) }))
  const panel = page.getByRole('group', { name: 'Writing The arrival' })

  // Dragging the bare bench moves the view, and moving the view says nothing about
  // what is being written. Bare bench: away from both cards, and away from the
  // zoom controls docked in the corner, which are a thing to press rather than a
  // place to push from.
  const box = (await graph.boundingBox())!
  const bare = { x: box.x + box.width - 60, y: box.y + 200 }
  await page.mouse.move(bare.x, bare.y)
  await page.mouse.down()
  await page.mouse.move(bare.x - 200, bare.y - 80, { steps: 5 })
  await page.mouse.up()

  await expect.poll(scrolledTo).toEqual({ x: 200, y: 80 })

  // A press that stayed put is a press, and a press on the bare bench has always
  // closed what is being written — on the rail the fold leaves as much as on the
  // graph, since the rail is that same bench drawn small.
  await writeScene(page, 'The arrival')
  await expect(panel).toBeVisible()
  const rail = (await graph.boundingBox())!
  await page.mouse.click(rail.x + rail.width / 2, rail.y + rail.height - 20)
  await expect(panel).toBeHidden()

  // Pulled back to a quarter, where the whole of this Story is on screen at once
  // and every line of it can be reached without scrolling to it.
  const pullBack = page.getByRole('button', { name: 'Pull back from the graph' })
  for (let step = 0; step < 3; step++) await pullBack.click()
  await expect(page.locator('.zooming .level')).toContainText('25%')

  // A press on an Exit's line is that Exit's own gesture still: it opens the panel
  // it has always opened rather than pushing the bench or closing anything.
  await page.locator(`[data-exit="${exit.id}"] line.aimed`).click()
  await expect(page.getByRole('group', { name: 'Writing the Exit to The platform' })).toBeVisible()

  // And a Scene dragged on a bench pulled back travels as far as the hand does: a
  // hundred pixels at a quarter is four hundred pixels of graph. The panel is
  // closed for it, because it narrows the graph and what is measured here is the
  // scale rather than the room left beside it — and the card is held to be in the
  // frame first, since a hand can only drag what is on the bench.
  await page.keyboard.press('Escape')
  const node = page.getByRole('article', { name: 'The arrival' })
  await node.scrollIntoViewIfNeeded()
  await expect.poll(() => framed(page, 'The arrival')).toBe(true)
  const card = (await node.boundingBox())!
  const held = { x: card.x + card.width / 2, y: card.y + card.height - 4 }
  await page.mouse.move(held.x, held.y)
  await page.mouse.down()
  await page.mouse.move(held.x + 100, held.y + 60, { steps: 5 })
  await page.mouse.up()

  await expect.poll(() => readScenePlacement(scenes[0]!.id)).toMatchObject({ x: 1000, y: 540 })
})

/**
 * A keydown as a layout other than the one the shortcut was written on sends it.
 * On a French keyboard the digit row carries letters until it is shifted, so
 * `⌘0` arrives as `à`: what says which key was pressed is where it sits, and that
 * is `code`.
 */
function pressAt(page: Page, key: string, code: string) {
  return page.evaluate(([key, code]) => document.dispatchEvent(new KeyboardEvent('keydown', {
    key, code, ctrlKey: true, bubbles: true, cancelable: true,
  })), [key, code])
}

test('the zoom is reached from where the hand is, whatever it is on', async ({
  page,
  request,
}) => {
  const { story } = await openWideGraph(request)
  // A window no taller than a laptop's, because the fault this holds against is a
  // control docked below the fold of one.
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/stories/${story.id}`)

  const level = page.locator('.zooming .level')
  const percent = async () => Number.parseInt(
    (await level.textContent())!.match(/(\d+)%/)![1]!, 10)
  await expect(level).toContainText('100%')

  // The controls are on screen without the page being scrolled to them: a control
  // that exists so nobody has to hunt for a Scene may not be hunted for itself.
  const controls = (await page.locator('.zooming').boundingBox())!
  expect(controls.y).toBeGreaterThanOrEqual(0)
  expect(controls.y + controls.height).toBeLessThanOrEqual(720)

  // One notch of a mouse wheel is a step back rather than a plunge: the ratio is
  // tuned for the scores of small deltas a pinch sends, and a notch is a hundred
  // of them at once.
  const graph = (await page.locator('.graph').boundingBox())!
  await page.mouse.move(graph.x + graph.width / 2, graph.y + graph.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 100)
  await page.keyboard.up('Control')
  await expect(level).not.toContainText('100%')
  const notch = await percent()
  expect(notch).toBeGreaterThan(60)
  expect(notch).toBeLessThan(95)

  // What Safari sends while two fingers pinch, which is not a wheel with Ctrl at
  // all: its own gestures, carrying the whole gesture's scale rather than a step.
  await page.locator('.graph').evaluate((box) => {
    const send = (kind: string, scale: number) => box.dispatchEvent(Object.assign(
      new Event(kind, { bubbles: true, cancelable: true }),
      { scale, clientX: 400, clientY: 300 }))
    send('gesturestart', 1)
    send('gesturechange', 0.5)
    send('gestureend', 0.5)
  })
  await expect.poll(percent).toBeLessThan(notch)

  // And the shortcuts, off a French layout, where none of the three keys carries
  // the character the shortcut is named after: the fit pulls back to the whole
  // Story, and the two steps go the two ways from there.
  await pressAt(page, 'à', 'Digit0')
  await expect.poll(percent).toBeLessThan(notch)
  const fitted = await percent()

  await pressAt(page, '=', 'Equal')
  await expect.poll(percent).toBeGreaterThan(fitted)
  const closer = await percent()

  await pressAt(page, ')', 'Minus')
  await expect.poll(percent).toBeLessThan(closer)

  // And the controls cover nothing, because anything they covered could not be
  // pressed. The card scrolled to the head of the bench is the case that caught
  // it: a control floating in that corner took the press meant for the button
  // that writes the Scene, and went on taking it.
  for (let step = 0; step < 4; step++) await pressAt(page, '=', 'Equal')
  await expect(level).toContainText('100%')

  const platform = page.getByRole('article', { name: 'The platform' })
  await platform.scrollIntoViewIfNeeded()
  await writeScene(page, 'The platform')
  await expect(page.getByRole('group', { name: 'Writing The platform' })).toBeVisible()
})

test('the bench takes the width it is given and never more', async ({ page, request }) => {
  const { story, scenes } = await openWideGraph(request)
  await page.goto(`/stories/${story.id}`)
  await expect(page.getByRole('article', { name: 'The arrival' })).toBeVisible()

  /**
   * The frame is exactly as wide as the bench, and the page does not scroll
   * sideways: the surface inside it is wider than any window — ten thousand
   * pixels are within a node's reach — and it is the graph that scrolls or is
   * pushed about, never the frame that grows to hold it.
   */
  const framed = async () => await page.evaluate(() => {
    const wide = (selector: string) =>
      Math.round(document.querySelector(selector)!.getBoundingClientRect().width)

    return {
      graph: wide('.graph') === wide('.bench'),
      sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })

  for (const width of [1512, 1100, 820]) {
    await page.setViewportSize({ width, height: 760 })
    expect(await framed()).toEqual({ graph: true, sideways: false })
  }

  // And after a node is dragged towards the edge of the screen, which is what
  // makes the surface wider than it was.
  await page.setViewportSize({ width: 1280, height: 760 })
  const node = page.getByRole('article', { name: 'The arrival' })
  await node.scrollIntoViewIfNeeded()
  const card = (await node.boundingBox())!
  await page.mouse.move(card.x + card.width / 2, card.y + card.height - 8)
  await page.mouse.down()
  await page.mouse.move(1275, card.y + card.height - 8, { steps: 8 })
  await page.mouse.up()

  await expect.poll(() => readScenePlacement(scenes[0]!.id).then(node => node.x))
    .toBeGreaterThan(600)
  expect(await framed()).toEqual({ graph: true, sideways: false })
})

test('the bench is pushed about on the Story an Author has on their first day', async ({
  page,
  request,
}) => {
  // Three Scenes in the column the server places them in, which is a Story that
  // fits on screen whole: the surface is no larger than the cards on it.
  const { story } = await openGraph(request, ['The arrival', 'The platform', 'The bar'])
  await page.goto(`/stories/${story.id}`)
  await expect(page.getByRole('article', { name: 'The arrival' })).toBeVisible()

  const graph = page.locator('.graph')
  const scrolledTo = () => graph.evaluate(
    box => ({ x: Math.round(box.scrollLeft), y: Math.round(box.scrollTop) }))

  // A bench keeps room around the work on it, so there is somewhere to push even
  // a Story that fits: without it the gesture would be dead on every new Story,
  // which is the one an Author meets first.
  expect(await graph.evaluate(
    box => box.scrollWidth > box.clientWidth && box.scrollHeight > box.clientHeight)).toBe(true)

  const box = (await graph.boundingBox())!
  const bare = { x: box.x + box.width - 120, y: box.y + box.height / 2 }
  await page.mouse.move(bare.x, bare.y)
  await page.mouse.down()
  await page.mouse.move(bare.x - 200, bare.y - 100, { steps: 8 })
  await page.mouse.up()

  await expect.poll(scrolledTo).toEqual({ x: 200, y: 100 })

  // And the fit brings the whole Story back into the frame, which is the way back
  // from a push that took the work off screen.
  await page.getByRole('button', { name: 'Fit the graph' }).click()
  for (const name of ['The arrival', 'The bar']) {
    await expect.poll(() => framed(page, name)).toBe(true)
  }
})

test('a Scene dragged past the edge of the bench stops there', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  // The panel narrows the graph, so the hand that is still holding a card can be
  // over the panel. What it may not do is take the card with it: a Scene dropped
  // under the panel is a Scene the Author cannot see and never aimed at.
  await writeScene(page, 'The arrival')
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  const frame = (await page.locator('.graph').boundingBox())!
  const node = page.getByRole('article', { name: 'The arrival' })
  const card = (await node.boundingBox())!
  await page.mouse.move(card.x + card.width / 2, card.y + card.height - 8)
  await page.mouse.down()
  // Well past the trailing edge of the graph, out over the panel and beyond it.
  await page.mouse.move(frame.x + frame.width + 300, card.y + card.height - 8, { steps: 10 })
  await page.mouse.up()

  // The hand stopped at the edge, so the card did: part of it is still on the
  // bench, which is what makes it a card the Author can take hold of again.
  await expect.poll(async () => {
    const dropped = (await node.boundingBox())!
    return dropped.x < frame.x + frame.width
  }).toBe(true)
  await expect.poll(() => readScenePlacement(scenes[0]!.id).then(node => node.x))
    .toBeLessThan(GRAPH_REACH)
})

test('the graduation says which scale the bench is at, and goes straight to another', async ({
  page,
  request,
}) => {
  const { story } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  const dial = page.getByRole('slider', { name: 'Zoom' })
  const level = page.locator('.level')
  await expect(dial).toHaveValue('100')

  // Dragged straight to a scale, rather than stepped to it a quarter at a time.
  await dial.fill('40')
  await expect(level).toContainText('40%')
  await expect(page.getByRole('article', { name: 'The arrival' })).toHaveCount(1)

  // The two buttons and the graduation are one state: stepping moves the thumb.
  await page.getByRole('button', { name: 'Pull back from the graph' }).click()
  await expect(dial).toHaveValue('25')
  await expect(level).toContainText('25%')

  // And what the hand can do that no control shows is written under them, with the
  // key this platform calls it by — and the keys are drawn as keys, so `⌘0` reads
  // as two of them pressed together rather than as a word.
  const graven = page.locator('.graven')
  await expect(graven).toContainText('fits')
  await expect(graven).toContainText('drag the bench to move the view')
  await expect(graven.locator('kbd')).toHaveCount(6)
  await expect(graven.locator('kbd').last()).toHaveText('0')
})
