import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { CONDITIONS_MAX, SCENE_NAME_MAX_LENGTH, VISITS_MAX } from '../../shared/utils/scenes'
import {
  writeScene, openTab, readExits, readSceneName, readShotConditions, readShots, seedFlags,
  seedExit, seedScene, seedStory, test,
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

test('an Author renames a Scene in the panel', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arival')
  await page.goto(`/stories/${story.id}`)

  // On its card the Scene's name is read rather than offered to be written.
  await expect(page.getByRole('heading', { name: 'The arival' })).toBeVisible()
  await writeScene(page, 'The arival')

  // Leaving the field is what writes it, as it is for a Shot and for an Exit.
  const named = page.getByRole('textbox', { name: 'Name of this Scene' })
  await named.fill('The arrival')
  await named.blur()

  await expect(async () => {
    await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
  }).toPass()
  // And the card answers to the new name: the name it carries is the Scene's, so
  // everything that says which Scene this is has followed the correction.
  await expect(page.getByRole('article', { name: 'The arrival' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Write Scene The arrival' })).toBeVisible()
  // The panel's heading is the field, so what it is called is what the field
  // holds: the label saying which Scene this is sits outside it rather than in
  // front of the name.
  await expect(page.locator('.panel').getByRole('heading', { name: 'The arrival' }))
    .toBeVisible()
})

test('a Scene renamed to nothing is left as it was', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')

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
  await writeScene(page, 'The arrival')
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

  // The Scene being written is in the address since
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, so the reload
  // comes back to it and there is nothing to open again.
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('Second')
})

test('a Shot’s three controls are marks on one line', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['First', 'Second', 'Third'])

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')

  // Each image says what it does and which Shot it does it to — the words moved
  // to where assistive technology alone reads them, they did not go.
  const earlier = page.getByRole('button', { name: 'Move earlier Shot 2' })
  await expect(earlier).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move later Shot 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Shot 2' })).toBeVisible()

  // The whole point of the marks: each control is about as wide as it is tall
  // rather than as wide as the sentence it used to be set in, so the three sit on
  // one line in the width a node gives a Shot.
  const control = (await earlier.boundingBox())!
  expect(control.width).toBeLessThan(control.height * 2)
  const strip = (await page.locator('.written .row').nth(1).boundingBox())!
  expect(strip.height).toBeLessThan(control.height * 2)
})

test.describe('dragging a Shot', () => {
  // Tall enough that a Scene of three Shots is on screen at once, so the drags
  // below say what a drop does and nothing about what a long run scrolls — that
  // is the test at the end of this block, which asks for a short bench instead.
  test.use({ viewport: { width: 1280, height: 1400 }, hasTouch: true })

  test('an Author drags a Shot by its number to the Place it belongs', async ({
    page, request,
  }) => {
    const { story, scene } = await openScene(request, 'The arrival')
    const [first, , third] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])
    const number = (shot: { id: string }) => page.locator(`[data-shot="${shot.id}"] .shot-number`)

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')
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

    // The Scene being written is in the address since
    // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, so the reload
    // comes back to it and there is nothing to open again.
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Shot 3' })).toHaveValue('First')

    // A finger says nothing here: it scrolls the panel, and the two controls are
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

  test('a Shot let go of away from the run is left where it was', async ({ page, request }) => {
    const { story, scene } = await openScene(request, 'The arrival')
    const [first] = await writeShots(request, scene.id, ['First', 'Second', 'Third'])
    const number = (shot: { id: string }) => page.locator(`[data-shot="${shot.id}"] .shot-number`)

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')

    // Let go of over the bare bench rather than over a Place: one panel holds one
    // Scene's run, so anywhere that is not a row of it is nowhere the drop could
    // mean anything. The hit-test asks the whole page, and what it comes back
    // with is held against the run before a Place is written.
    const held = await pointOn(number(first!))
    const bench = (await page.locator('.graph').boundingBox())!
    await page.mouse.move(held.x, held.y)
    await page.mouse.down()
    await page.mouse.move(bench.x + bench.width / 2, bench.y + bench.height - 20, { steps: 5 })
    await page.mouse.up()

    // Nothing was renumbered: the drop said nothing rather than something else.
    await expect(readShots(scene.id)).resolves.toMatchObject([
      { text: 'First', position: 0 },
      { text: 'Second', position: 1 },
      { text: 'Third', position: 2 },
    ])
  })

  // Twice over, because the run is written twice: a glide of a few pixels a frame
  // for an Author who asked for nothing, and a stride of a Shot's row every fifth
  // of a second for one who asked for less motion. Both travel the same distance
  // in the same time, and the Place has to be reachable either way.
  for (const motion of ['no-preference', 'reduce'] as const) {
    test.describe(`to a Place off screen, with ${motion} motion`, () => {
      // Tall enough that the whole of the panel is on screen — bands, foot and
      // all, so every point this drag needs is one a hand could reach — and short
      // enough that a Scene of fourteen Shots still overflows the height of the
      // bench the panel is capped at, which is what gives the run somewhere to go.
      test.use({ viewport: { width: 1280, height: 1100 }, reducedMotion: motion })

      test('a Shot dragged to the edge of a long run scrolls the panel to it', async ({
        page, request,
      }) => {
        const { story, scene } = await openScene(request, 'The arrival')
        const texts = [...Array(14)].map((_, at) => `Shot ${at + 1}`)
        const written = await writeShots(request, scene.id, texts)
        const number = (shot: { id: string }) =>
          page.locator(`[data-shot="${shot.id}"] .shot-number`)
        const first = written[0]!
        const last = written.at(-1)!

        await page.goto(`/stories/${story.id}`)
        await writeScene(page, 'The arrival')

        // The Place the drag is aimed at is off the foot of the panel when it
        // begins: the panel is capped at the height of the bench, and the run is
        // longer than that. The whole of the panel is on screen, which is what
        // makes the rest of this a gesture rather than an arrangement of points.
        const body = page.locator('.panel')
        const box = (await body.boundingBox())!
        expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height)
        expect((await number(last).boundingBox())!.y).toBeGreaterThan(box.y + box.height)

        const held = await pointOn(number(first))
        await page.mouse.move(held.x, held.y)
        await page.mouse.down()

        // The band is measured after the press, not before it: pressing a Shot's
        // number focuses that Shot's field, and a browser that scrolls the page
        // to show it has moved the panel since the box above was taken.
        const pressed = (await body.boundingBox())!
        const band = { x: held.x, y: pressed.y + pressed.height - 8 }

        // Into the band at the panel's bottom edge, and then nothing: the hand
        // stays where it is while the run carries the list past it.
        const scrolled = () => body.evaluate(scroller => scroller.scrollTop)
        const elsewhere = () => page.evaluate(() => [
          window.scrollY, document.querySelector('.graph')!.scrollTop,
        ])
        const before = await elsewhere()
        await page.mouse.move(band.x, band.y, { steps: 5 })
        await expect.poll(scrolled).toBeGreaterThan(0)

        // Out of the band and back into the middle of the run, where the hand is
        // over a row rather than an edge: the run stops with it.
        await page.mouse.move(band.x, pressed.y + pressed.height / 2, { steps: 5 })
        const stopped = await scrolled()
        await page.waitForTimeout(300)
        expect(await scrolled()).toBe(stopped)

        // Back into the band, and this time all the way to the foot of the run.
        // Long enough for it to cross a Scene of fourteen Shots on a machine with
        // other things on its mind: it travels five hundred pixels a second, and
        // there are about nine hundred of them to cross.
        await page.mouse.move(band.x, band.y, { steps: 5 })
        await expect.poll(
          () => body.evaluate(scroller => scroller.scrollHeight - scroller.clientHeight
            - scroller.scrollTop),
          { timeout: 15_000 },
        ).toBeLessThan(2)
        await expect(number(last)).toBeInViewport()

        // Neither the bench nor the window went anywhere while it ran: the only
        // thing the run scrolls is the panel the drag is inside.
        expect(await elsewhere()).toEqual(before)

        // Onto the Shot that stood last, which is the Place the Author aimed at,
        // asked for where it stands now that the list has stopped moving.
        const onto = await pointOn(number(last))
        await page.mouse.move(onto.x, onto.y, { steps: 5 })
        await page.mouse.up()

        await expect(async () => {
          await expect(readShots(scene.id)).resolves.toMatchObject([
            ...texts.slice(1).map((text, at) => ({ text, position: at })),
            { text: 'Shot 1', position: texts.length - 1 },
          ])
        }).toPass()

        // And no run outlives the gesture that started it: the same point in the
        // band, with nothing in hand, scrolls nothing.
        await page.mouse.move(band.x, band.y, { steps: 5 })
        const ended = await body.evaluate(scroller => scroller.scrollTop)
        await page.waitForTimeout(300)
        expect(await body.evaluate(scroller => scroller.scrollTop)).toBe(ended)
      })
    })
  }

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
   * panel a Scene is written in — which is the ceiling the drag is written with.
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

  // A card carries nothing to type into: what a Scene is made of is read in the
  // panel, and the graph is read without it.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await writeScene(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')

  await page.getByRole('button', { name: 'Add Shot' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
})

test('what a Scene holds stands behind three tabs, each carrying its count',
  async ({ page, request }) => {
    const { story, scene } = await openScene(request, 'The arrival')
    await writeShots(request, scene.id, ['She steps off the train.', 'The doors close.'])
    await seedFlags(scene.id, { coat: 'on' })
    const platform = await seedScene(story, 'The platform')
    await seedExit(scene.id, platform.id)
    // Laid beside the first rather than on top of it: a seeded Scene is stacked
    // where the last one is, and a card under another is a card no hand reaches.
    await request.patch(`/api/scenes/${platform.id}`, { data: { x: 600, y: 0 } })

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')

    // Each tab says how much is behind it, which is what a fold owes: an Author
    // knows there is a way on to look at before pressing anything.
    await expect(page.getByRole('tab')).toHaveText([/Shots\s*2/, /Flags\s*1/, /Ways on\s*1/])

    // The Shots are open when the Scene arrives, and they are the only thing that
    // is: writing Shots is what a Scene is opened for, and the common act costs
    // no press.
    await expect(page.getByRole('tab', { name: /^Shots/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('textbox', { name: 'Shot 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add a Flag to The arrival' })).toHaveCount(0)
    await expect(page.getByRole('button',
      { name: 'Add a Condition to the way on 1 to The platform' })).toHaveCount(0)

    // And each of the other two does behind its tab exactly what it did before
    // there was one.
    await openTab(page, 'Flags')
    await expect(page.getByLabel('Name of Flag 1 set on entering The arrival')).toHaveValue('coat')
    await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveCount(0)

    await openTab(page, 'Ways on')
    await expect(page.locator('.panel .ways > ol > li > .numbered')).toHaveText('1')
    await expect(page.locator('.panel .ways .arrival'))
      .toHaveText('The platform — way on from The arrival')

    // The count follows the Story rather than the page it was drawn on: a Shot
    // added while another tab is open is counted the moment it lands.
    await openTab(page, 'Shots')
    await page.getByRole('button', { name: 'Add Shot' }).click()
    await expect(page.getByRole('tab', { name: /^Shots/ })).toHaveText(/Shots\s*3/)

    // Another Scene opens on its own Shots: the tab left open on one Scene is not
    // a thing an Author asked to be true of the next.
    await openTab(page, 'Ways on')
    await writeScene(page, 'The platform')
    await expect(page.getByRole('tab', { name: /^Shots/ })).toHaveAttribute('aria-selected', 'true')
  })

test('an Author writes a Story from the page alone', async ({ page, request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await page.goto(`/stories/${story.id}`)

  // The one control that makes a Scene out of nothing. It lands under a
  // provisional name with the panel open on that name, selected, so naming it is
  // the first thing typed rather than a step before it existed.
  await page.getByRole('button', { name: 'Write the first Scene' }).click()
  await expect(page.getByText('“A new Scene” created')).toBeVisible()
  const named = page.getByRole('textbox', { name: 'Name of this Scene' })
  await expect(named).toBeFocused()
  await named.fill('The arrival')
  await named.blur()
  // The card, rather than the heading on it: the panel the gesture opened is
  // named by the Scene too, so a heading alone is two things on this page.
  await expect(page.getByRole('article', { name: 'The arrival' })).toHaveCount(1)

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
  // The Scene being written is in the address since
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, so the reload
  // comes back to it and there is nothing to open again.
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('The platform is empty.')

  await page.getByRole('button', { name: 'Delete Shot 1' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeHidden()

  // Deleting a Scene takes Shots and Exits with it, so it is asked about first —
  // on the bench's own surface, read like any other part of the interface.
  await page.getByRole('button', { name: 'Delete Scene The arrival' }).click()
  const asking = page.getByRole('dialog')
  await expect(asking).toContainText('“The arrival” goes, and with it 1 Shot')
  await asking.getByRole('button', { name: 'Delete Scene' }).click()
  await expect(page.getByText('No Scenes yet.')).toBeVisible()
})

test('a Scene dismissed from the confirmation is left exactly as it was', async ({
  page,
  request,
}) => {
  const { story, scene } = await openScene(request, 'The booth')
  await writeShots(request, scene.id, ['The projector ticks over.', 'Nobody is in it.'])
  const lobby = await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name: 'The lobby' } })).json()
  // An Exit at each end, because the schema cascades a delete from both of them and
  // only the ways on were ever counted.
  await request.post(`/api/scenes/${scene.id}/exits`, { data: { toSceneId: lobby.id } })
  await request.post(`/api/scenes/${lobby.id}/exits`, { data: { toSceneId: scene.id } })

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The booth')
  const control = page.getByRole('button', { name: 'Delete Scene The booth' })
  await control.click()

  const asking = page.getByRole('dialog')
  await expect(asking).toContainText(
    '“The booth” goes, and with it 2 Shots, 1 Exit leaving it and 1 Exit arriving at it.')

  // What a stray Enter would land on is the answer that destroys nothing.
  await expect(asking.getByRole('button', { name: 'Leave it' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(asking).toBeHidden()
  await expect(control).toBeFocused()

  // Dismissed means untouched, which the page cannot be asked about: the Scene,
  // its Shots and the Exits at both of its ends are read past the API.
  await expect(readSceneName(scene.id)).resolves.toBe('The booth')
  await expect(readShots(scene.id)).resolves.toHaveLength(2)
  await expect(readExits(scene.id)).resolves.toHaveLength(1)
  await expect(readExits(lobby.id)).resolves.toHaveLength(1)
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

test('an Author writes a Condition on a Shot, and it reads as one line', async ({
  page,
  request,
}) => {
  const { story, scene } = await openScene(request, 'The booth')
  await writeShots(request, scene.id, ['You have been here before.'])

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The booth')
  await page.getByRole('button', { name: 'Add a Condition to Shot 1 of The booth' }).click()

  // Every field says which Condition of which Shot it belongs to, and nothing but
  // assistive technology reads it: the row itself is the sentence.
  const called = 'Condition 1 of Shot 1 of The booth'
  const flag = page.getByLabel(`Flag of ${called}`)
  await flag.fill('coat')
  await flag.blur()
  const holds = page.getByLabel(`holds for ${called}`)
  await holds.fill('on')
  await holds.blur()

  // The whole point of the row: one Condition on one line in the width a node
  // gives it, so five of them are five lines rather than twenty.
  const field = (await flag.boundingBox())!
  const lines = async (place: number) =>
    (await page.locator('.when').nth(place).boundingBox())!.height / field.height
  expect(await lines(0)).toBeLessThan(2)

  await expect(async () => {
    await expect(readShotConditions(scene.id)).resolves.toEqual([[{ flag: 'coat', is: 'on' }]])
  }).toPass()

  // A visit count is the long sentence of the two — it names a Scene and counts
  // entries of it — and two lines is as far as it is allowed to run.
  await page.getByRole('button', { name: 'Add a Condition to Shot 1 of The booth' }).click()
  await page
    .getByLabel('Condition 2 of Shot 1 of The booth', { exact: true })
    .selectOption('visits')
  expect(await lines(1)).toBeLessThan(3)
})

test('a Shot’s Conditions are refused where an Exit’s would be', async ({
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
  await writeScene(page, 'The booth')

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
  // The Scene being written is in the address since
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, so the reload
  // comes back to it and there is nothing to open again.
  await page.reload()
  await expect(page.getByLabel('Condition 1 of Shot 1 of The booth', { exact: true }))
    .toHaveValue('visits')
  await expect(page.getByLabel('times for Condition 1 of Shot 1 of The booth')).toHaveValue('2')

  await page.getByRole('button', { name: 'Remove Condition 1 of Shot 1 of The booth' }).click()
  await expect(async () => {
    await expect(readShotConditions(scene.id)).resolves.toEqual([[]])
  }).toPass()
})
