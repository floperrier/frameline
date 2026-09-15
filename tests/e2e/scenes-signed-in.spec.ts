import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { CONDITIONS_MAX, SCENE_NAME_MAX_LENGTH, VISITS_MAX } from '../../shared/utils/scenes'
import {
  writeScene, readExits, readSceneName, readShotConditions, readShots, seedFlags,
  seedExit, seedScene, seedStory, test,
} from './author'

const noId = '00000000-0000-4000-8000-000000000000'

/**
 * The field one beat is typed in, found by the Place its Scene numbers it at and
 * by the Scene it is in. Every Scene of the document is written where it stands
 * and every beat of every Scene has a field of its own, so there is nothing to put
 * in a gate before typing in it and nothing but the Scene's own name to tell one
 * Shot 1 from another — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which is what took the
 * gate and the strip that moved it away.
 */
function shot(page: Page, place: number, scene = 'The arrival') {
  return page.getByRole('textbox', { name: `Shot ${place} of ${scene}`, exact: true })
}

/** One Scene's section of the document, which is what its name is heard on. */
function written(page: Page, scene: string) {
  return page.getByRole('group', { name: `Writing ${scene}` })
}

/**
 * The same section, found by the Scene's own id. Which one to reach for is not a
 * preference: a Scene's section is named by the Scene, and the name is a field
 * typed in place, so a test that changes the name has its locator go out from
 * under it on the first keystroke. Where the name is what is being written, the
 * id is what the section answers to.
 */
function sectionOf(page: Page, sceneId: string) {
  return page.locator(`.writing [data-scene="${sceneId}"]`)
}

/**
 * The field one Scene's name is written in, reached through the Scene's own id for
 * the same reason and then by its place on the slate rather than by its label: the
 * label says which Scene it names, so the first keystroke of a rename takes the
 * locator out from under a test that asked by it.
 */
function naming(page: Page, sceneId: string) {
  return sectionOf(page, sceneId).locator('.named input')
}

/**
 * What the browser would hand a click aimed at the middle of an element: the
 * element itself, or whatever is laid over it, said as its markup so a failure
 * names the thing that took the pointer. Nothing about the tree can settle this —
 * a layer over a field leaves the field exactly where the markup says it is, with
 * the right role and the right name, and takes the click all the same.
 */
function under(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)

    if (element.contains(hit)) return 'itself'

    return hit?.outerHTML.slice(0, 60) ?? 'nothing'
  })
}

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
    `/api/scenes/${scene.id}`, { data: { name: 'The arrival' } })

  expect(renamed.status()).toBe(200)
  await expect(renamed.json()).resolves.toMatchObject({ id: scene.id, name: 'The arrival' })
  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{ id: scene.id, name: 'The arrival' }],
  })
})

test('a Scene cannot be renamed to nothing, or to more than a name', async ({ request }) => {
  const { scene } = await openScene(request, 'The arrival')
  const rename = (name: string) => request.patch(
    `/api/scenes/${scene.id}`, { data: { name } })

  const refused = await Promise.all([rename('  '), rename('x'.repeat(SCENE_NAME_MAX_LENGTH + 1))])

  expect(refused.map(response => response.status())).toEqual([400, 400])
  expect((await refused[0]!.json()).message).toContain('A Scene needs a name.')
  expect((await refused[1]!.json()).message).toContain('cannot be longer than')
  // The refusals have to mean the Scene was left alone, not merely that the
  // answer said nothing about a name that was written anyway.
  await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
})

test('an Author renames a Scene where it stands in the document', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arival')
  await page.goto(`/stories/${story.id}`)

  // The name is the heading and the heading is written in: a bare field, with no
  // mode to enter first and nothing to open.
  await expect(page.getByRole('heading', { name: 'The arival' })).toBeVisible()
  await writeScene(page, 'The arival')

  // Leaving the field is what writes it, as it is for a Shot and for an Exit.
  const named = naming(page, scene.id)
  await named.fill('The arrival')
  await named.blur()

  await expect(async () => {
    await expect(readSceneName(scene.id)).resolves.toBe('The arrival')
  }).toPass()
  // And everything that says which Scene this is has followed the correction: a
  // Scene's section of the document is named by the Scene it holds — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await expect(written(page, 'The arrival')).toBeVisible()
  // The slate's heading is the field, so what the Scene is called is what the
  // field holds: the label saying which Scene this is sits outside it rather than
  // in front of the name.
  await expect(written(page, 'The arrival').getByRole('heading', { name: 'The arrival' }))
    .toBeVisible()
})

test('a Scene renamed to nothing is left as it was', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')

  const named = naming(page, scene.id)
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
  await page.getByRole('button', { name: 'Move Later Shot 1' }).click()

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

  // The marks act on the row they are drawn on, and every beat of the run has its
  // own: there is no beat to put in a gate first.
  await expect(shot(page, 2)).toBeVisible()

  // Each image says what it does and which Shot it does it to — the words moved
  // to where assistive technology alone reads them, they did not go.
  const earlier = page.getByRole('button', { name: 'Move Earlier Shot 2' })
  await expect(earlier).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move Later Shot 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Shot 2' })).toBeVisible()

  // The whole point of the marks: each control is about as wide as it is tall
  // rather than as wide as the sentence it used to be set in, so the four sit on
  // one line at the trailing edge of the beat's own row.
  const control = (await earlier.boundingBox())!
  expect(control.width).toBeLessThan(control.height * 2)
  const row = (await page.locator('[data-shot] .beneath .row').nth(1).boundingBox())!
  expect(row.height).toBeLessThan(control.height * 2)
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

  // The Scene is written where it stands, so what it is made of is on the page
  // the moment the page is: a heading, and the run of Shots under it.
  await expect(page.getByRole('heading', { name: 'The arrival' })).toBeVisible()
  await writeScene(page, 'The arrival')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toHaveValue('She steps off the train.')

  await page.getByRole('button', { name: 'Add a Shot' }).click()
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeVisible()
})

test('everything a Scene holds is on the surface at once, each part counted',
  async ({ page, request }) => {
    const { story, scene } = await openScene(request, 'The arrival')
    await writeShots(request, scene.id, ['She steps off the train.', 'The doors close.'])
    await seedFlags(scene.id, { coat: 'on' })
    const platform = await seedScene(story, 'The platform')
    await seedExit(scene.id, platform.id)

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The arrival')
    // The document holds every Scene of the Story, each written where it stands,
    // so what is asked about one Scene is asked of that Scene's own section.
    const arrival = written(page, 'The arrival')

    // The three parts of a Scene, in the order a Reader meets them, each headed
    // and counted where it starts: the Flags set on entry, the run of beats, the
    // ways on.
    await expect(arrival.locator('.held > h3'))
      .toHaveText([/Flags\s*1/, /Shots\s*2/, /Exits\s*1/])

    // And all three are on the surface together, which is what taking the tabs
    // out bought: a Condition and the Flags that satisfy it are read at once.
    await expect(arrival.getByRole('textbox', { name: 'Shot 1 of The arrival', exact: true }))
      .toBeVisible()
    await expect(page.getByLabel('Name of Flag 1 set on entering The arrival')).toHaveValue('coat')
    await expect(arrival.locator('.ways > ol > li > .numbered')).toHaveText('1')
    await expect(page.getByLabel('Where the Exit 1 out of The arrival leads'))
      .toHaveValue(platform.id)

    // The count follows the Story rather than the page it was drawn on.
    await arrival.getByRole('button', { name: 'Add a Shot' }).click()
    await expect(arrival.locator('.held > h3').nth(1)).toHaveText(/Shots\s*3/)
  })

test('a Scene is typed as one document, beat after beat', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['She steps off the train.'])

  await page.goto(`/stories/${story.id}`)
  await writeScene(page, 'The arrival')

  // Enter at the end of a beat writes it and opens the next, with the caret
  // already in it: an Author writing forwards never leaves the keyboard.
  const first = shot(page, 1)
  await first.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeFocused()
  await page.keyboard.type('The doors close.')
  await page.keyboard.press('Enter')
  // The caret lands in the new beat once the Story has been read back and drawn,
  // so the test waits for it the way an Author's eye does.
  await expect(page.getByRole('textbox', { name: 'Shot 3' })).toBeFocused()
  await page.keyboard.type('The platform empties.')
  await page.getByRole('textbox', { name: 'Shot 3' }).blur()

  await expect.poll(() => readShots(scene.id)).toMatchObject([
    { text: 'She steps off the train.', position: 0 },
    { text: 'The doors close.', position: 1 },
    { text: 'The platform empties.', position: 2 },
  ])

  // In the middle of the run the beat is written where the caret was and not at
  // the foot of the Scene.
  await shot(page, 1).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Shot 2' })).toBeFocused()
  await page.keyboard.type('She looks back.')
  await page.getByRole('textbox', { name: 'Shot 2' }).blur()

  await expect.poll(() => readShots(scene.id)).toMatchObject([
    { text: 'She steps off the train.' },
    { text: 'She looks back.' },
    { text: 'The doors close.' },
    { text: 'The platform empties.' },
  ])

  // Backspace at the head of an empty beat takes it away and puts the caret at
  // the end of the one before, the way it joins two paragraphs anywhere else.
  const second = page.getByRole('textbox', { name: 'Shot 2' })
  await second.fill('')
  await second.press('Backspace')
  await expect(page.getByRole('textbox', { name: 'Shot 1' })).toBeFocused()
  await expect.poll(() => readShots(scene.id)).toHaveLength(3)

  // Shift held, it writes the second line of one beat rather than a second beat.
  await page.keyboard.press('Shift+Enter')
  await expect.poll(() => page.getByRole('textbox', { name: 'Shot 1' }).inputValue())
    .toBe('She steps off the train.\n')
  await expect(page.getByRole('textbox', { name: 'Shot 4' })).toHaveCount(0)
})

/**
 * A Story of several Scenes, chained and opening on the first, for the tests that
 * are about the document holding all of them rather than about one Scene.
 */
async function chained(request: APIRequestContext, names: string[]) {
  const { story, scene } = await openScene(request, names[0]!)
  const scenes = [scene]

  for (const name of names.slice(1)) {
    const next = await (await request.post(
      `/api/stories/${story.id}/scenes`, { data: { name } })).json()
    await request.post(`/api/scenes/${scenes.at(-1)!.id}/exits`, { data: { toSceneId: next.id } })
    scenes.push(next)
  }
  expect((await request.post(`/api/scenes/${scene.id}/opening`)).ok()).toBeTruthy()

  return { story, scenes }
}

test('every Scene of the document is written where it stands', async ({ page, request }) => {
  const { story, scenes } = await chained(request, ['The arrival', 'The platform', 'The bar'])
  const [, platform, bar] = scenes
  await writeShots(request, platform!.id, ['The platform is empty.'])

  await page.goto(`/stories/${story.id}`)

  // Nothing is opened first. The caret is in the Opening Scene, because that is
  // where an address naming no Scene puts it, and the third Scene of the Story is
  // written by typing in it — which is the whole of what `#252` is: a Story of
  // forty Scenes is forty writable Scenes and no gate to move between them. See
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await expect(written(page, 'The arrival')).toBeVisible()
  const named = naming(page, bar!.id)
  await named.fill('The late bar')
  await named.blur()
  await expect.poll(() => readSceneName(bar!.id)).toBe('The late bar')

  // And so is a beat of the second, in the field that beat has of its own: one
  // field per Shot, over the whole document.
  const beat = shot(page, 1, 'The platform')
  await beat.fill('The platform is bare.')
  await beat.blur()
  await expect.poll(() => readShots(platform!.id)).toMatchObject([{ text: 'The platform is bare.' }])
})

test('the arrows walk the run, and the arrows with Control walk the Story',
  async ({ page, request }) => {
    // The middle Scene holds no beat at all, which is where the walk used to stop:
    // the key was listened for on a beat's own field, so a Scene with no field had
    // nothing to hear it and the Scene after it was unreachable from the keyboard.
    const { story, scenes } = await chained(
      request, ['The arrival', 'The platform', 'The bar'])
    const [arrival, platform, bar] = scenes
    await writeShots(request, arrival!.id, ['She steps off the train.', 'The doors close.'])
    await writeShots(request, bar!.id, ['Smoke, and no one she knows.'])

    await page.goto(`/stories/${story.id}`)
    const beat = (place: number) => shot(page, place)
    const named = (scene: string) => page.getByRole('textbox', { name: `Name of ${scene}` })

    // Alt and the arrows stay inside the Scene: they are how the run is walked,
    // and the run is the Scene's own — see
    // `docs/adr/0033-a-scene-is-written-as-one-document.md`.
    await beat(1).click()
    await page.keyboard.press('Alt+ArrowDown')
    await expect(beat(2)).toBeFocused()
    await page.keyboard.press('Alt+ArrowUp')
    await expect(beat(1)).toBeFocused()

    // Control and the arrows walk Scene to Scene, which is what a document holding
    // the whole Story needs and a document holding one Scene did not. The caret
    // arrives at the head of the next Scene, in its name, and the address goes
    // with it: there is one notion of where the Author is standing.
    await page.keyboard.press('Control+ArrowDown')
    await expect(named('The platform')).toBeFocused()
    await expect(page).toHaveURL(new RegExp(`scene=${platform!.id}`))

    // And it walks on from where it landed. The caret is in a name and the Scene
    // it is in holds no beat, and the walk is the same act from either: it is the
    // Scene's own section that hears the key, not one field of it.
    await page.keyboard.press('Control+ArrowDown')
    await expect(named('The bar')).toBeFocused()
    await expect(page).toHaveURL(new RegExp(`scene=${bar!.id}`))

    // There is nothing past the last Scene: the arrows walk the Story, they do not
    // write one.
    await page.keyboard.press('Control+ArrowDown')
    await expect(page).toHaveURL(new RegExp(`scene=${bar!.id}`))
    await expect(named('The bar')).toBeFocused()

    // And back up the Story the same way, to the same end.
    await page.keyboard.press('Control+ArrowUp')
    await expect(named('The platform')).toBeFocused()
    await page.keyboard.press('Control+ArrowUp')
    await expect(named('The arrival')).toBeFocused()
    await expect(page).toHaveURL(new RegExp(`scene=${arrival!.id}`))

    await page.keyboard.press('Control+ArrowUp')
    await expect(page).toHaveURL(new RegExp(`scene=${arrival!.id}`))
    await expect(named('The arrival')).toBeFocused()
  })

test('a Scene written at the foot of another puts the hand on what the Reader presses',
  async ({ page, request }) => {
    const { story, scenes } = await chained(
      request, ['One', 'Two', 'Three', 'Four', 'Five', 'Six'])
    const last = scenes.at(-1)!

    await page.goto(`/stories/${story.id}?scene=${last.id}`)
    const writing = written(page, 'Six')
    await expect(writing).toBeInViewport()

    const adding = writing.getByRole('combobox', { name: 'An Exit from here Six' })
    await adding.fill('Seven')
    await adding.press('Enter')
    await expect(written(page, 'Seven')).toBeVisible()

    // The hand lands on what the Reader will press, which is the other half of the
    // way on the Author has just said the end of — and it is on screen where they
    // left off rather than somewhere they have to be scrolled to. A Scene named at
    // the foot of another lands one Exit further from the opening, which is under
    // the Scene it was named in and never above it, so nothing here needs holding
    // still: see the test below for the act that does move the words.
    const said = writing.getByLabel('What the Exit 1 out of Six says')
    await expect(said).toBeFocused()
    await expect(said).toBeInViewport()
  })

test('re-rooting the Story leaves the words where the hand left them',
  async ({ page, request }) => {
    const { story, scenes } = await chained(
      request, ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'])
    const fifth = scenes[4]!

    await page.goto(`/stories/${story.id}?scene=${fifth.id}`)
    const writing = written(page, 'Five')
    await expect(writing).toBeInViewport()
    const before = (await writing.boundingBox())!.y

    // Marking a Scene halfway down the document as the one the Story opens on
    // re-roots the order the whole document is read in: the four Scenes that stood
    // above the Author's hands go below them, and the section under the caret is
    // suddenly the first of eight. The document is where all of that happens and
    // the screen is where none of it may. Halfway down is the case with the room
    // to do it in: the scroller holds the four Scenes the correction asks it for,
    // so the words do not move at all. The test below is the case with none.
    await sectionOf(page, fifth.id)
      .getByRole('button', { name: /^Mark as the Opening Scene/ }).click()
    await expect(page.locator('.rail .mark.opens')).toHaveAttribute('data-scene', fifth.id)
    await expect(written(page, 'One')).toBeVisible()

    await expect.poll(async () => Math.abs((await writing.boundingBox())!.y - before))
      .toBeLessThanOrEqual(2)
    await expect(writing).toBeInViewport()
  })

test('re-rooting from the foot of the document gives back the room there is',
  async ({ page, request }) => {
    const { story, scenes } = await chained(
      request, ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'])
    const last = scenes.at(-1)!

    await page.goto(`/stories/${story.id}?scene=${last.id}`)
    const writing = written(page, 'Eight')
    await expect(writing).toBeInViewport()
    const before = (await writing.boundingBox())!.y

    // The same act at the one place it cannot be paid for. Marking the last Scene
    // of the document as the opening puts it first, so the seven sections the
    // scroller was standing below are suddenly under it and the correction asks
    // for room that is no longer there: a few thousand pixels back, against a
    // scroller that has some three thousand to give. It stops at its top, which is
    // as near as the page can be to where the hand left the words — and the Scene
    // the caret is in is the head of the document, so it is still on screen and it
    // is never further down the window than it was. That bound is the claim
    // `withoutJumping` makes; staying put is what the claim buys where there is
    // room, and it is the test above.
    await sectionOf(page, last.id)
      .getByRole('button', { name: /^Mark as the Opening Scene/ }).click()
    await expect(page.locator('.rail .mark.opens')).toHaveAttribute('data-scene', last.id)

    await expect.poll(() => page.locator('.document').evaluate(box => box.scrollTop)).toBe(0)
    await expect(writing).toBeInViewport()
    expect((await writing.boundingBox())!.y).toBeLessThanOrEqual(before)
  })

test('renumbering and taking away a way on leave the words where the hand left them',
  async ({ page, request }) => {
    const { story, scenes } = await chained(
      request, ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'])
    const fifth = scenes[4]!
    for (const landing of [scenes[6]!, scenes[7]!]) {
      await request.post(`/api/scenes/${fifth.id}/exits`, { data: { toSceneId: landing.id } })
    }

    await page.goto(`/stories/${story.id}?scene=${fifth.id}`)
    const writing = written(page, 'Five')
    await expect(writing).toBeInViewport()
    const before = (await writing.boundingBox())!.y

    // Neither of these can raise a line above the caret, and the claim is worth a
    // test because it is the reason they are run without holding the document
    // still. A column is a Scene's distance from the opening in Exits taken, so
    // renumbering the ways on out of Five reorders the columns beyond Five's and
    // nothing else; taking one away can only lengthen a Scene's distance or leave
    // it unreached, and a Scene nothing reaches is read after every column the
    // opening does. Both happen under the Author's hands, never over them.
    await writing
      .getByRole('button', { name: 'Move Later the Exit 1 to Six, out of Five', exact: true })
      .click()
    await expect.poll(async () => (await readExits(fifth.id)).map(way => way.toSceneId))
      .toEqual([scenes[6]!.id, scenes[5]!.id, scenes[7]!.id])
    await expect.poll(async () => Math.abs((await writing.boundingBox())!.y - before))
      .toBeLessThanOrEqual(2)

    await writing
      .getByRole('button', { name: 'Delete the Exit 1 to Seven, out of Five', exact: true })
      .click()
    await expect.poll(async () => (await readExits(fifth.id)).length).toBe(2)
    await expect.poll(async () => Math.abs((await writing.boundingBox())!.y - before))
      .toBeLessThanOrEqual(2)
    await expect(writing).toBeInViewport()
  })

test('the mark that moves where the Story opens is a tab stop on every Scene it stands on',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, ['One', 'Two', 'Three'])
    await page.goto(`/stories/${story.id}`)
    await expect(written(page, 'Three')).toBeVisible()

    // The Scene the Story opens on says so in a word and carries no control, since
    // there is nothing left for one to do; every other carries the act that moves
    // the opening, and on each of them it is the stop after the name. A radio group
    // across the document would put only its checked member on the tab order, which
    // on a Story of forty Scenes is thirty-nine marks a keyboard cannot reach —
    // against `docs/adr/0043-a-story-is-written-as-one-document.md`, which says a
    // control keeps its place in the tab order wherever it stands.
    const marking = (sceneId: string) => sectionOf(page, sceneId)
      .getByRole('button', { name: /^Mark as the Opening Scene/ })

    await expect(marking(scenes[0]!.id)).toHaveCount(0)
    await expect(sectionOf(page, scenes[0]!.id).locator('.opening'))
      .toHaveText(/^Opening Scene/)

    for (const scene of scenes.slice(1)) {
      await naming(page, scene.id).focus()
      await page.keyboard.press('Tab')
      await expect(marking(scene.id)).toBeFocused()
    }

    // And an arrow on it goes nowhere and writes nothing. In a radio group the one
    // press moves the focus, checks what it lands on and sends the write in the
    // same gesture, so an Author walking their document with the arrows would
    // re-root their Story without having asked for anything.
    await marking(scenes[1]!.id).focus()
    await page.keyboard.press('ArrowDown')
    await expect(marking(scenes[1]!.id)).toBeFocused()

    // Read after a write made later and waited for: the two would leave in the one
    // queue, so a press the arrow had sent would be back before this one.
    const named = naming(page, scenes[2]!.id)
    await named.fill('Third')
    await named.blur()
    await expect.poll(() => readSceneName(scenes[2]!.id)).toBe('Third')

    const read = await (await request.get(`/api/stories/${story.id}`)).json()
    expect(read.openingSceneId).toBe(scenes[0]!.id)
  })

test('two Scenes leading to one Scene name their rows apart', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The street')
  const write = async (name: string) => await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name } })).json()
  const bar = await write('The bar')
  const station = await write('La gare')
  for (const from of [scene, bar]) {
    await request.post(`/api/scenes/${from.id}/exits`, { data: { toSceneId: station.id } })
    await writeShots(request, from.id, ['A door opens.', 'She steps out.'])
  }

  await page.goto(`/stories/${story.id}`)
  await expect(written(page, 'La gare')).toBeVisible()

  // A Story that converges is the ordinary case, and it is where a name read off
  // where a row lands stops telling two rows apart: both Scenes offer their Exit 1
  // to the same Scene, and both number their beats from one. So every control of a
  // row says which Scene it is in as well as which row it acts on, and each of
  // these answers to one control on the whole page.
  for (const said of [
    'Delete the Exit 1 to La gare, out of The street',
    'Delete the Exit 1 to La gare, out of The bar',
    'Duplicate Exit to La gare, out of The street',
    'Duplicate Exit to La gare, out of The bar',
    'Go to La gare, by the Exit 1 out of The street',
    'Go to La gare, by the Exit 1 out of The bar',
    'Add a Condition to the Exit 1 to La gare, out of The street',
    'Add a Condition to the Exit 1 to La gare, out of The bar',
    'Split The street before Shot 2',
    'Split The bar before Shot 2',
  ]) {
    await expect(page.getByRole('button', { name: said, exact: true })).toHaveCount(1)
  }

  for (const said of ['Image of Shot 1 of The street', 'Image of Shot 1 of The bar']) {
    await expect(page.getByLabel(said, { exact: true })).toHaveCount(1)
  }
})

test('the words of a Scene are counted as the beat is typed', async ({ page, request }) => {
  const { story, scene } = await openScene(request, 'The arrival')
  await writeShots(request, scene.id, ['A door opens.'])

  await page.goto(`/stories/${story.id}`)
  const counted = written(page, 'The arrival').locator('.words')
  await expect(counted).toHaveText('3 words')

  // Counted as the beat is typed and not when the field is left: it is the one
  // figure on the bench that answers to a keystroke, which is why it is drawn by a
  // component of its own rather than read straight into the document — see
  // `app/components/Words.vue`.
  const field = shot(page, 1, 'The arrival')
  await field.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' She steps out')
  await expect(counted).toHaveText('6 words')
})

test('a refusal is said against the Scene it is about', async ({ page, request }) => {
  const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
  const [arrival, platform] = scenes

  await page.goto(`/stories/${story.id}`)

  // The caret opens in the Opening Scene, and what is refused is a write made in
  // the other one: the sentence belongs where the Author was typing, not where the
  // caret happens to stand. See
  // `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`, whose rule is that
  // the work being written survives the refusal.
  const named = naming(page, platform!.id)
  await named.fill('  ')
  await named.blur()

  const refused = sectionOf(page, platform!.id).getByRole('alert')
  await expect(refused).toHaveText('A Scene needs a name.')
  await expect(sectionOf(page, arrival!.id).getByRole('alert')).toHaveCount(0)

  // And what the Story's own edge is refused is about no Scene, so it is said
  // under that edge: the two places a refusal is drawn are the Scene it is about
  // and the Story, and nothing is drawn in both.
  await named.fill('The platform is empty')
  await named.blur()
  await expect(refused).toHaveCount(0)

  const title = page.getByRole('textbox', { name: 'Title of this Story' })
  await title.fill('  ')
  await title.blur()
  await expect(page.locator('main > [role="alert"]')).toHaveText('A Story needs a title.')
})

test('a write that lands in one Scene leaves the Scene another write is waiting on',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
    const [arrival, platform] = scenes

    await page.goto(`/stories/${story.id}`)

    // Both are held at the door, so the order they land in is the test's to say
    // rather than the network's: the clicked write lands while the typed one is
    // still on its way, which is the ordinary case — a click goes out at once and
    // what was typed waits its turn in the queue behind the write before it.
    let landShot = () => {}
    let landRename = () => {}
    const shotLanding = new Promise<void>((resolve) => { landShot = resolve })
    const renameLanding = new Promise<void>((resolve) => { landRename = resolve })
    await page.route(`**/api/scenes/${platform!.id}/shots`, async (route) => {
      await shotLanding
      await route.continue()
    })
    await page.route(`**/api/scenes/${arrival!.id}`, async (route) => {
      await renameLanding
      await route.continue()
    })

    // A beat added to one Scene, and then the other Scene emptied of its name
    // while that beat is still in the air: two acts in two Scenes, in flight
    // together.
    await sectionOf(page, platform!.id).getByRole('button', { name: /^Add a Shot/ }).click()
    const named = naming(page, arrival!.id)
    await named.fill('  ')
    await named.blur()

    // The beat lands, and what it lets go of has to be its own claim: the Scene
    // the page is holding is the one the rename is waiting on, and a Shot added in
    // the Scene under it has no business clearing it.
    landShot()
    await expect(shot(page, 1, 'The platform')).toBeVisible()

    landRename()
    await expect(sectionOf(page, arrival!.id).getByRole('alert'))
      .toHaveText('A Scene needs a name.')
    // Not under the Story's edge, which is where a refusal goes that is about no
    // Scene at all — and this one is about a Scene.
    await expect(page.locator('main > [role="alert"]')).toHaveCount(0)
  })

test('a refusal takes its own room under the slate, covering nothing and moving nothing',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
    const [arrival, platform] = scenes
    // A run long enough to carry the window past the Scene above it, so the
    // scroller has something above to give back: that is what absorbs the room a
    // refusal takes as it arrives.
    await writeShots(
      request, platform!.id, Array.from({ length: 20 }, (_, beat) => `Beat ${beat + 1}.`))

    await page.goto(`/stories/${story.id}`)

    // The rename is held at the door so that both measurements are of one screen:
    // what moves the beat has to be the sentence landing, never the network
    // landing between the two readings.
    let land = () => {}
    const landing = new Promise<void>((resolve) => { land = resolve })
    await page.route(`**/api/scenes/${arrival!.id}`, async (route) => {
      await landing
      await route.continue()
    })

    // A Scene emptied of its name up at the head of the document, while the Author
    // is typing twenty beats down in the Scene under it. The sentence takes its
    // room where nobody is looking, and the browser's scroll anchoring gives that
    // room back out of the scroller: the beat under the hands does not move.
    await naming(page, arrival!.id).fill('  ')
    const beat = shot(page, 15, 'The platform')
    await beat.click()
    await page.keyboard.type(' She waits.')
    const typedAt = (await beat.boundingBox())!.y

    land()
    await expect(sectionOf(page, arrival!.id).getByRole('alert'))
      .toHaveText('A Scene needs a name.')
    // Not held to the pixel: the scroller gives its room back in device pixels and
    // what is left of a band forty-odd pixels tall is the rounding. A band that
    // stopped being given back would move the beat by its whole height.
    expect(Math.abs((await beat.boundingBox())!.y - typedAt)).toBeLessThan(1)

    // And the sentence is not laid over the field the Author has to answer it in.
    // A Scene needs a name is the commonest refusal there is on a Scene, and a
    // zero-height sticky band carrying it read as the element under the middle of
    // the name, of the mark that moves where the Story opens and of the act that
    // takes the Scene away — three controls a pointer could no longer reach.
    const named = naming(page, platform!.id)
    await named.fill('  ')
    await named.blur()

    const section = sectionOf(page, platform!.id)
    const refused = section.getByRole('alert')
    await expect(refused).toHaveText('A Scene needs a name.')

    // Wound to the slate the sentence stands on: what is under a point is a
    // question about the window, and the caret is twenty beats past it.
    const slate = section.locator('.slate')
    await slate.scrollIntoViewIfNeeded()

    expect(await under(named)).toBe('itself')
    expect(await under(section.getByRole('button', { name: /^Mark as the Opening Scene/ })))
      .toBe('itself')
    expect(await under(section.getByRole('button', { name: /^Delete Scene/ }))).toBe('itself')
    // Readable in its turn: nothing of the writing is over the sentence either.
    expect(await under(refused)).toBe('itself')
    // The click an Author makes next lands in the field and not in the sentence
    // about it, which is the one thing `pointer-events: none` would also have
    // bought — and it would have left the field under an opaque band.
    await named.click()
    await expect(named).toBeFocused()

    const over = (await slate.boundingBox())!
    expect((await refused.boundingBox())!.y).toBeGreaterThanOrEqual(over.y + over.height)
  })

test('a refusal at the foot of a long Scene is read without leaving the foot of it',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    const { story, scenes } = await chained(request, ['The arrival', 'The platform', 'The bar'])
    const [arrival, platform] = scenes
    // A second way on, so the first has somewhere to be moved to, under a run of
    // twenty beats: the ways out are the last part of a Scene's section, and this
    // is what puts them two thousand pixels below the slate the sentence hangs on.
    await request.post(`/api/scenes/${platform!.id}/exits`, { data: { toSceneId: arrival!.id } })
    await writeShots(
      request, platform!.id, Array.from({ length: 20 }, (_, beat) => `Beat ${beat + 1}.`))

    await page.goto(`/stories/${story.id}`)

    // The Author is at the foot of the Scene, which is where the act is: the
    // window holds the ways on and nothing of the slate above them.
    const says = page.getByRole('textbox', { name: 'What the Exit 1 out of The platform says' })
    await says.click()
    const section = sectionOf(page, platform!.id)
    await expect(section.locator('.slate')).not.toBeInViewport()

    // The ordinary worst case, and the one with the most to read: the session has
    // expired, so the sentence carries the way back in beside it.
    await page.route(`**/api/scenes/${platform!.id}/exits/places`, route => route.fulfill({
      status: 401,
      json: { message: 'Please sign in again.' },
    }))
    await section
      .getByRole('button', { name: 'Move Later the Exit 1 to The bar, out of The platform' })
      .click()

    // Said where the hands are. Held to the flow at the foot of the slate and
    // nothing else, this landed at y = −2374 on a window 720 tall: the whole of
    // what the screen showed was the list of Exits going from two to one.
    const refused = section.getByRole('alert')
    await expect(refused).toContainText('Please sign in again.')
    // Whole, and not a sliver of it: the door is inside the sentence.
    await expect(refused).toBeInViewport({ ratio: 1 })
    expect((await refused.boundingBox())!.y).toBeGreaterThanOrEqual(0)
  })

test('an Author writes a Story from the page alone', async ({ page, request }) => {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()
  await page.goto(`/stories/${story.id}`)

  // The one control that makes a Scene out of nothing. It lands under a
  // provisional name with the caret on that name, selected, so naming it is the
  // first thing typed rather than a step before it existed.
  await page.getByRole('button', { name: 'Write the First Scene' }).click()
  await expect(page.getByText('“A new Scene” created')).toBeVisible()
  const named = page.locator('.writing .named input')
  await expect(named).toBeFocused()
  await expect(named).toHaveValue('A new Scene')
  await named.fill('The arrival')
  await named.blur()
  // A Scene's section of the document is named by the Scene it holds, which is
  // what says the name reached the Story rather than only the field — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await expect(written(page, 'The arrival')).toBeVisible()

  // Blurring the Shot is what writes it, so each is left before the next is added.
  for (const [place, line] of ['She steps off the train.', 'The platform is empty.'].entries()) {
    await page.getByRole('button', { name: 'Add a Shot' }).click()
    const beat = shot(page, place + 1)
    await expect(beat).toBeVisible()
    await beat.fill(line)
    await beat.blur()
    await expect(beat).toHaveValue(line)
  }

  await shot(page, 2).click()
  await page.getByRole('button', { name: 'Move Earlier Shot 2' }).click()
  await expect(shot(page, 1)).toHaveValue('The platform is empty.')
  await expect(shot(page, 2)).toHaveValue('She steps off the train.')

  // What the page shows has to be what was written, not what the page remembers.
  // The Scene being written is in the address since
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, so the reload
  // comes back to it and there is nothing to open again.
  await page.reload()
  await expect(shot(page, 1)).toHaveValue('The platform is empty.')

  await page.getByRole('button', { name: 'Delete Shot 1' }).click()
  await expect(shot(page, 1)).toHaveValue('She steps off the train.')
  await expect(shot(page, 2)).toHaveCount(0)

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
  await expect(asking.getByRole('button', { name: 'Leave It' })).toBeFocused()
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
