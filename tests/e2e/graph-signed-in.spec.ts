import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { CONDITIONS_MAX, FLAGS_PER_SCENE, VISITS_MAX } from '../../shared/utils/scenes'
import {
  ONE_PIXEL,
  writeScene,
  readExits,
  readFlags,
  readSceneName,
  seedExit,
  seedFlags,
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

/** The Story as the bench reads it, which is what the Graph is drawn from. */
async function readGraph(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

/**
 * Opens the Scene an Exit leaves and hands back the field its text is written in.
 * An Exit is written in that Scene's own document — beside where it leads and the
 * Conditions it is offered under, see
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md` — so reaching one means
 * opening the Scene it leaves.
 */
async function writeExit(page: Page, from: string, to: string) {
  await writeScene(page, from)

  return page.getByRole('textbox', { name: `Exit to ${to}` })
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
      { id: scenes[0]!.id, name: 'The arrival' },
      { id: scenes[1]!.id, name: 'The platform' },
    ],
    exits: [],
  })

  // Nothing about where a Scene is drawn travels with it: the Graph is read off
  // the Story — see `docs/adr/0041-the-graph-is-drawn-from-the-story.md`.
  expect(read.scenes[0]).not.toHaveProperty('x')
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
    request.patch(`/api/scenes/${noId}`, { data: { name: 'Renamed' } }),
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
    request.patch(`/api/scenes/${theirScene.id}`, { data: { name: 'Mine now' } }),
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
  await expect(readSceneName(theirScene.id)).resolves.toBe('Their Scene')
  await expect(readExits(theirScene.id)).resolves.toEqual([theirExit])
  await expect(readFlags(theirScene.id)).resolves.toEqual({})
})

test('a Scene being written has an address, and a stale one is not an error', async ({
  page,
  request,
}) => {
  const { story, scenes } = await openGraph(request)
  await page.goto(`/stories/${story.id}`)

  // The Story opens on its Opening Scene: there is always a Scene on the bench,
  // and with nothing in the address it is the one a Reading starts on.
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

  // A node pressed on the Graph puts its Scene in the address, and replaces the
  // entry rather than adding one: the browser's back leaves the Story rather
  // than walking the Author node by node through everything they opened.
  await writeScene(page, 'The platform')
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[1]!.id}$`))

  // What the address carries survives a reload, which is what makes a link to a
  // Scene one an Author can send themselves.
  await page.reload()
  await expect(page.getByRole('group', { name: 'Writing The platform' })).toBeVisible()

  // And an address naming a Scene the Story no longer holds opens the Story
  // where a Reading would: the Author deleted that Scene themselves, and a
  // not-found would be the bench reporting their own act back to them as an error.
  await page.goto(`/stories/${story.id}?scene=${noId}`)
  await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
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

  await ways.getByRole('button', { name: 'Move Earlier the Exit 2 to The tunnel' }).click()
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
  await expect(ways.getByRole('button', { name: 'Move Earlier the Exit 1 to The tunnel' }))
    .toBeDisabled()
  await expect(ways.getByRole('button', { name: 'Move Later the Exit 2 to The buffet' }))
    .toBeDisabled()
})

test('a way on’s four controls are marks, as a Shot’s are', async ({ page, request }) => {
  const { story, scenes } = await openGraph(request, ['The platform', 'The buffet'])
  const [from, buffet] = scenes as [{ id: string }, { id: string }]
  await drawExit(request, from.id, buffet.id)

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The platform')

  // Each one says what it does and which way on it does it to, the words read by
  // assistive technology alone — they moved, they did not go.
  const earlier = page.getByRole('button', { name: 'Move Earlier the Exit 1 to The buffet' })
  await expect(earlier).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move Later the Exit 1 to The buffet' }))
    .toBeVisible()
  await expect(page.getByRole('button', { name: 'Duplicate Exit to The buffet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete the Exit 1 to The buffet' }))
    .toBeVisible()

  // The two that renumber used to spell their sentences out while a beat's
  // twenty rows above carried arrows. One act, one document, one vocabulary: each
  // control is about as wide as it is tall, so all four sit on one line — held
  // here because an accessible name reads the same whether the control is a mark
  // or a sentence, and nothing else would notice them going back.
  const control = (await earlier.boundingBox())!
  expect(control.width).toBeLessThan(control.height * 2)
  const strip = (await page.locator('.panel .ways .written .row').first().boundingBox())!
  expect(strip.height).toBeLessThan(control.height * 2)
})

test('an Exit is reached, written and taken away without a pointer',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform'])
    const [from, to] = scenes as [{ id: string }, { id: string }]
    await drawExit(request, from.id, to.id)

    await page.goto(`/stories/${story.id}`)

    // The Story opens on The arrival, whose document is where the way on is
    // written: nothing about it is on the Graph but the line.
    await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()

    // Where it leads, what the Reader presses, and the Conditions it is offered
    // under: three fields of one row, each reached by the key that reaches every
    // other field on the surface.
    const leads = page.getByLabel('Where the Exit 1 out of The arrival leads')
    await expect(leads).toHaveValue(to.id)

    const exitText = page.getByRole('textbox', { name: 'Exit to The platform' })
    await exitText.focus()
    await expect(exitText).toBeFocused()
    await exitText.fill('Follow her out')
    await exitText.blur()
    await expect(async () => {
      await expect(readExits(from.id)).resolves.toMatchObject([{ text: 'Follow her out' }])
    }).toPass()

    // And taken away from the same row, by the mark at the end of it.
    await page.getByRole('button', { name: 'Delete the Exit 1 to The platform' }).press('Enter')
    await expect(async () => {
      await expect(readExits(from.id)).resolves.toEqual([])
    }).toPass()

    // The Scene never left: nothing about a way on takes the surface away from
    // the Scene it belongs to.
    await expect(page.getByRole('group', { name: 'Writing The arrival' })).toBeVisible()
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

  // The Conditions of a way on are written beside the Scene, one tab away from
  // the Flags they are tested against.
  await page.getByRole('button', { name: 'Add a Condition to the Exit 1 to The platform' }).click()
  // The name of the Flag and the value it holds are written one at a time,
  // because the Flag alone is half a Condition and is written as soon as it has
  // a name — and the value is then typed into the same field the Author was
  // left holding.
  const tested = page.getByLabel('Flag of Condition 1 of the Exit 1 to The platform')
  await expect(tested).toBeFocused()
  await tested.fill('coat')
  await tested.blur()
  const is = page.getByLabel('holds for Condition 1 of the Exit 1 to The platform')
  await is.fill('on')
  // A second Condition, added from the keyboard while the first is being
  // written, which is what makes several in a row one gesture repeated: what was
  // typed is written on the way, and the hand lands in the new row.
  await is.press('Enter')
  await expect(page.getByLabel('Flag of Condition 2 of the Exit 1 to The platform'))
    .toBeFocused()
  // Exactly, because "Condition 2 of the Exit 1 to The platform" is also the tail
  // of the labels on the fields of that Condition.
  await page
    .getByLabel('Condition 2 of the Exit 1 to The platform', { exact: true })
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
  // The reload comes back to the Scene being written, which the address carries
  // and which writing a way on no longer takes out of it.
  await page.reload()
  await expect(page.getByLabel('Name of Flag 1 set on entering The arrival'))
    .toHaveValue('coat')
  await expect(page.getByLabel('Value 1 of Flag 1 set on entering The arrival'))
    .toHaveValue('on')
  await expect(page.getByLabel('Condition 1 of the Exit 1 to The platform', { exact: true }))
    .toHaveValue('flag')
  await expect(page.getByLabel('Flag of Condition 1 of the Exit 1 to The platform'))
    .toHaveValue('coat')
  await expect(page.getByLabel('Condition 2 of the Exit 1 to The platform', { exact: true }))
    .toHaveValue('visits')

  // And an Exit with every Condition taken off it is offered always again.
  for (const place of [2, 1]) {
    await page.getByRole('button',
      { name: `Remove Condition ${place} of the Exit 1 to The platform` }).click()
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

    const called = (place: number) => `Flag ${place} set on entering The arrival`
    await page.getByRole('button', { name: 'Add a Flag to The arrival' }).click()
    await page.getByLabel(`Name of ${called(1)}`).fill('weather')
    await page.getByLabel(`Value 1 of ${called(1)}`).fill('rain')

    // A second value, and a third: the Flag gains a field rather than a
    // punctuation mark, and each press leaves the hand in the field it made.
    for (const [place, value] of [[2, 'sun'], [3, 'haze']] as const) {
      await page.getByRole('button', { name: `Add a Value to ${called(1)}` }).click()
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
    await expect(page.getByLabel(/^Name of Flag/).first()).toBeVisible()
    const weather = called(await rowOfFlag(page, 'weather'))

    for (const [place, value] of [[1, 'rain'], [2, 'sun'], [3, 'haze']] as const) {
      await expect(page.getByLabel(`Value ${place} of ${weather}`)).toHaveValue(value)
    }

    // A value taken off leaves the rest of the draw where it was.
    await page.getByRole('button', { name: `Remove Value 2 of ${weather}` }).click()
    await expect(async () => {
      await expect(readFlags(arrival.id))
        .resolves.toEqual({ weather: ['rain', 'haze'], coat: 'on' })
    }).toPass()
  })

/**
 * The densest row in the product, at the narrowest width the product is read at.
 * A Flag of two values carries three marks that act on a value and one that ends
 * the whole Flag, and the last of those is destructive: it is held in a column of
 * its own so that a sentence which wraps cannot leave it standing on a line by
 * itself with nothing beside it to say what it removes.
 */
test('the mark that ends a Flag stands beside it at the width of a phone',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request)
    const [arrival] = scenes as [{ id: string }, { id: string }]
    await seedFlags(arrival.id, { courage: ['high', 'low'] })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')

    const called = 'Flag 1 set on entering The arrival'
    await expect(page.getByLabel(`Name of ${called}`)).toHaveValue('courage')

    // The sentence has wrapped at this width — that is the case being held, not an
    // incidental — and the mark still shares its lines rather than falling under
    // them.
    const row = page.locator('.panel .flags .sets').first()
    const sentence = (await row.locator('> .sentence').boundingBox())!
    const field = (await page.getByLabel(`Value 1 of ${called}`).boundingBox())!
    expect(sentence.height).toBeGreaterThan(field.height * 1.5)

    const ends = (await page.getByRole('button', { name: `Remove ${called}` }).boundingBox())!
    expect(ends.y + ends.height / 2).toBeGreaterThan(sentence.y)
    expect(ends.y + ends.height / 2).toBeLessThan(sentence.y + sentence.height)
    expect(ends.x).toBeGreaterThan(sentence.x + sentence.width - 1)
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

test('a second way on to the same Scene is written by duplicating the first',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform'])
    const [from, to] = scenes as [{ id: string }, { id: string }]
    const first = await drawExit(request, from.id, to.id)

    await page.goto(`/stories/${story.id}`)

    // Duplicated from the way on's own row, which is the deliberate act: neither
    // the gesture that draws an Exit nor the field that adds one offers a Scene
    // this Scene already reaches, so a second way on to the same Scene is asked
    // for and never slipped into. The bench says so out loud, because the copy
    // lands at the foot of a list the Author may have scrolled past.
    await writeScene(page, 'The arrival')
    const duplicate = page.getByRole('button', { name: 'Duplicate Exit to The platform' })
      .first()
    await duplicate.click()
    await expect(toast(page))
      .toHaveText('Another Exit from The arrival to The platform written')
    await expect.poll(() => readExits(from.id)).toMatchObject([
      { id: first.id, position: 0, conditions: [] },
      { toSceneId: to.id, position: 1, conditions: [] },
    ])

    /**
     * The row of the ways on a Place is offered at, which is where an Exit's
     * Conditions are written: beside the Scene the two ways on leave, and told
     * apart by the Place each carries.
     */
    const wayOnAt = (place: number) => page.locator('.panel .ways > ol > li').nth(place - 1)

    await expect(wayOnAt(2).locator('> .numbered')).toHaveText('2')

    // A Condition on the first, because a Condition is what the pair is for: two
    // ways on to one Scene are offered under opposite tests.
    await page.getByRole('button', { name: 'Add a Condition to the Exit 1 to The platform' })
      .click()
    const flag = page.getByLabel('Flag of Condition 1 of the Exit 1 to The platform')
    await flag.fill('coat')
    await flag.blur()
    const holds = page.getByLabel('holds for Condition 1 of the Exit 1 to The platform')
    await holds.fill('on')
    await holds.blur()

    // Duplicated again, the Conditions come with it — and the duplicate is last
    // among the ways on, not beside the Exit it was copied from.
    await duplicate.click()
    await expect.poll(() => readExits(from.id)).toMatchObject([
      { id: first.id, position: 0, conditions: [{ flag: 'coat', is: 'on' }] },
      { position: 1, conditions: [] },
      { toSceneId: to.id, position: 2, conditions: [{ flag: 'coat', is: 'on' }] },
    ])
    const copied = (await readExits(from.id))[2]!

    // What is written against the third row is written on the copy alone.
    await expect(wayOnAt(3).locator('> .numbered')).toHaveText('3')
    const opposite = page.getByLabel('holds for Condition 1 of the Exit 3 to The platform')
    await opposite.fill('off')
    await opposite.blur()

    await expect.poll(() => readExits(from.id)).toMatchObject([
      { id: first.id, conditions: [{ flag: 'coat', is: 'on' }] },
      { conditions: [] },
      { id: copied.id, conditions: [{ flag: 'coat', is: 'off' }] },
    ])
  })

test('where a way on leads is a field, and the Exit keeps what it carries',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform', 'The bar'])
    const [arrival, platform, bar] = scenes as [{ id: string }, { id: string }, { id: string }]
    const exit = await drawExit(request, arrival.id, platform.id)
    await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Follow her out' } })
    await request.put(`/api/exits/${exit.id}/conditions`, {
      data: { conditions: [{ flag: 'coat', is: 'on' }] },
    })

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')

    // Dragging the endpoint across the canvas is one way; the other is the field
    // that says where the way on leads, which is the only way for an Author who
    // never opens a canvas — see
    // `docs/adr/0034-a-story-is-written-without-the-canvas.md`.
    const leads = page.getByLabel('Where the Exit 1 out of The arrival leads')
    await expect(leads).toHaveValue(platform.id)

    // It offers the Scenes the way on may be led to and the one it already leads
    // to, and no other: never the Scene it leaves, and never a Scene that Scene
    // already reaches.
    await expect(leads.locator('option')).toHaveText(['The platform', 'The bar'])

    await leads.selectOption(bar.id)
    await expect.poll(() => readExits(arrival.id)).toMatchObject([
      { id: exit.id, toSceneId: bar.id, position: 0, text: 'Follow her out' },
    ])

    // The text and the Conditions travel with it: the Exit was led elsewhere and
    // not deleted and drawn again.
    await expect.poll(async () => (await readExits(arrival.id))[0]!.conditions)
      .toMatchObject([{ flag: 'coat', is: 'on' }])
    await expect(page.getByRole('textbox', { name: 'Exit to The bar' }))
      .toHaveValue('Follow her out')
  })

test('a way on is written by naming where it leads, and a name nothing answers to writes the Scene',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request, ['The arrival', 'The platform', 'The bar'])
    const [arrival, platform, bar] = scenes as [{ id: string }, { id: string }, { id: string }]

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')

    // The field at the foot of the ways on offers the Scenes a way on out of here
    // may land on — never the Scene it leaves — and takes any name at all.
    const adding = page.getByLabel('An Exit from here')
    const offered = () => page.locator('.adding datalist option')
      .evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))
    await expect.poll(offered).toEqual(['The platform', 'The bar'])

    // A name the Story answers to joins the two, however it is cased or accented
    // — the way the bar of Commands reads a name — and the hand lands on the words
    // the Reader will press, which is the other half of the way on.
    await adding.fill('the BAR')
    await adding.press('Enter')
    await expect.poll(() => readExits(arrival.id))
      .toMatchObject([{ toSceneId: bar.id, position: 0 }])
    await expect(toast(page)).toHaveText('Exit from The arrival to The bar drawn')
    await expect(page.getByRole('textbox', { name: 'Exit to The bar' })).toBeFocused()

    // Named, it forgets: a control that acts must not stand there holding the last
    // thing it did, and the Scene it just landed on is no longer on offer.
    await expect(adding).toHaveValue('')
    await expect.poll(offered).toEqual(['The platform'])

    // And a name nothing answers to writes the Scene at the far end, joined
    // already: this is how every Scene after the first is born.
    await adding.fill('The buffet')
    await adding.press('Enter')
    await expect(toast(page))
      .toHaveText('“The buffet” written, and an Exit from The arrival to it drawn')

    const read = await readGraph(request, story.id)
    const written = read.scenes.find(held => held.name === 'The buffet')!
    expect(written).toBeTruthy()
    await expect.poll(() => readExits(arrival.id)).toMatchObject([
      { toSceneId: bar.id, position: 0 },
      { toSceneId: written.id, position: 1 },
    ])
    await expect(page.getByRole('textbox', { name: 'Exit to The buffet' })).toBeFocused()

    // The Graph has drawn the new Scene one column on from the one it leaves, with
    // nothing placed by anybody.
    const arrivalNode = page.locator('.graph').getByRole('button', { name: 'Go to The arrival' })
    const buffetNode = page.locator('.graph').getByRole('button', { name: 'Go to The buffet' })
    expect((await buffetNode.boundingBox())!.x).toBeGreaterThan((await arrivalNode.boundingBox())!.x)

    // `platform` is untouched and still reachable from the field.
    expect(platform.id).toBeTruthy()
    await expect.poll(offered).toEqual(['The platform'])
  })

test('the Graph is drawn from the Story, and redrawn as the Story changes', async ({ page, request }) => {
  const { story, scenes } = await openGraph(
    request, ['The arrival', 'The platform', 'The bar', 'The tunnel', 'The loose end'])
  const [arrival, platform, bar, tunnel] = scenes as { id: string }[]
  await drawExit(request, arrival!.id, platform!.id)
  await drawExit(request, arrival!.id, bar!.id)
  await drawExit(request, platform!.id, tunnel!.id)

  await page.goto(`/stories/${story.id}`)

  // Every Scene is a node, named for what pressing it does, and every Exit but
  // one to the Scene itself is a line.
  const graph = page.getByRole('navigation', { name: 'Graph' })
  const node = (name: string) => graph.getByRole('button', { name: `Go to ${name}` })
  const at = async (name: string) => (await node(name).boundingBox())!
  await expect(graph.getByRole('button')).toHaveCount(5)
  await expect(graph.locator('line')).toHaveCount(3)

  // Laid out left to right by distance from the opening, in Exits taken; the two
  // ways on out of one Scene read top to bottom in the order they are offered;
  // and a Scene nothing reaches stands after the last column the opening does,
  // drawn as the loose end it is.
  expect((await at('The platform')).x).toBeGreaterThan((await at('The arrival')).x)
  expect((await at('The bar')).x).toBe((await at('The platform')).x)
  expect((await at('The bar')).y).toBeGreaterThan((await at('The platform')).y)
  expect((await at('The tunnel')).x).toBeGreaterThan((await at('The bar')).x)
  expect((await at('The loose end')).x).toBeGreaterThan((await at('The tunnel')).x)
  await expect(node('The arrival')).toHaveClass(/opens/)
  await expect(node('The loose end')).toHaveClass(/unreached/)
  await expect(node('The arrival')).toContainText('0 Shots')

  // The Story opens on its Opening Scene, and a press on a node puts that Scene
  // on the surface under the Graph — which the node then says.
  await expect(node('The arrival')).toHaveAttribute('aria-current', 'true')
  await node('The bar').click()
  await expect(page.getByRole('group', { name: 'Writing The bar' })).toBeVisible()
  await expect(node('The bar')).toHaveAttribute('aria-current', 'true')
  await expect(node('The arrival')).not.toHaveAttribute('aria-current', 'true')

  // Nothing is placed by hand, so the Graph follows the Story: another Opening
  // Scene is another first column.
  await page.getByRole('radio', { name: 'Opening Scene The bar' }).check()
  await expect(node('The bar')).toHaveClass(/opens/)
  await expect.poll(async () => (await at('The arrival')).x > (await at('The bar')).x).toBe(true)
})

test('a Scene is split before one of its Shots, and its ways on move to the second half',
  async ({ page, request }) => {
    const { story, scenes } = await openGraph(request)
    const [arrival, platform] = scenes as [{ id: string }, { id: string }]
    await drawExit(request, arrival.id, platform.id)
    const shots: { id: string }[] = []
    for (const text of ['One', 'Two', 'Three']) {
      const shot = await (await request.post(`/api/scenes/${arrival.id}/shots`)).json()
      await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
      shots.push(shot)
    }

    // Never before the first Shot: the Scene would be left with none, and a
    // Scene renamed is not a Scene split.
    const refused = await request.post(`/api/scenes/${arrival.id}/split`, {
      data: { shotId: shots[0]!.id, name: 'Half' },
    })
    expect(refused.status()).toBe(400)

    await page.goto(`/stories/${story.id}`)
    await expect(page.getByRole('button', { name: 'Split the Scene before Shot 1' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Split the Scene before Shot 2' }).click()
    await expect(toast(page))
      .toHaveText('“The arrival” split: what followed is now “The arrival, continued”')

    // The second half opens for writing under a provisional name made of the
    // first's, selected so the first thing typed replaces it.
    const naming = page.getByLabel('Name of this Scene')
    await expect(naming).toBeFocused()
    await expect(naming).toHaveValue('The arrival, continued')

    // The Shots from the one split before are its, renumbered from the first;
    // every way on out of the first half is its too; and one Exit, unphrased,
    // joins the two — so a Reading plays what it played, with one press between.
    const read = await readGraph(request, story.id)
    const half = read.scenes.find(scene => scene.name === 'The arrival, continued')!
    expect(half.shots.map(shot => [shot.text, shot.position])).toEqual([['Two', 0], ['Three', 1]])
    expect(read.scenes.find(scene => scene.id === arrival.id)!.shots.map(shot => shot.text))
      .toEqual(['One'])
    await expect(readExits(arrival.id)).resolves.toMatchObject([{ toSceneId: half.id, text: '' }])
    await expect(readExits(half.id)).resolves.toMatchObject([{ toSceneId: platform.id }])
  })
