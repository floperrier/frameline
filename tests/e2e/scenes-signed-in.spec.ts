import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { CONDITIONS_MAX, SCENE_NAME_MAX_LENGTH } from '../../shared/utils/scenes'
import type { StoryInEditor } from '../../shared/utils/scenes'
import {
  A_SOUND, ONE_PIXEL, writeScene, readExits, readSceneName, readShotConditions, readShots,
  seedFlags, seedExit, seedScene, seedStory, test, toast,
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
 * The sentence a refusal about one Scene of the document is said in. It stands in
 * the document column's own furniture rather than in that Scene's section — a band
 * inside the scroller covers a row of the writing wherever it is put — so what
 * holds it against the Scene it concerns is the Scene's name inside it. There is
 * one refusal on the bench at a time, so the role is address enough. See `.refused`
 * in `app/pages/stories/[id]/index.vue`.
 */
function refusal(page: Page) {
  return page.getByRole('alert')
}

/**
 * Winds the document until one Scene's first row — the first of the Flags it sets
 * on entry, `.sets`, and not the section around it — sits at the very head of the
 * scroller, which is the wind the issue was measured at and the one a band stuck to
 * that head stood on. Instantly, over the scroller's own smooth behaviour, so that
 * what is measured after it is where the wind ended rather than where it was
 * passing through.
 */
async function windToFirstRow(page: Page, sceneId: string) {
  await page.evaluate((scene) => {
    const scroller = document.querySelector('.document')!
    const row = document.querySelector(`.writing [data-scene="${scene}"] .sets`)!
    const by = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top

    scroller.scrollTo({ top: scroller.scrollTop + by, behavior: 'instant' })
  }, sceneId)
}

/**
 * The widths the sentence is driven at. Five of them — 1440, 1180, 900, 768 and
 * 390 — are the widths `0043` names, which `bench-signed-in.spec.ts` draws the
 * whole bench at; 1280 is the window the issue measured in; 1024 and 704 are the
 * two the interface folds at, which a reading of one screen never crosses; and 640
 * and 520 stand between them. Four rounds of this were read at one width, fixed at
 * that width and found again one step to the side, so what the fifth is posed at is
 * the range: a spec posed where its fix was measured cannot fail, and guards
 * nothing.
 */
const widths = [1440, 1280, 1180, 1024, 900, 768, 704, 640, 520, 390]

/**
 * Winds one Scene's section up past the head of the scroller, a step at a time from
 * the wind that puts its first row there, and hands back five readings of the
 * sentence standing over it. The rounds before this one each posed one of them,
 * fixed what it said, and were undone by another:
 *
 * - `taken`: every control of the Scene that a point at its own middle did not
 *   answer for, said as the markup that took the point instead.
 * - `reached`: what a press taken anywhere inside the sentence's own box arrives
 *   at, where that is not the sentence. This is the reading nobody posed, and the
 *   one a Scene's Flag was deleted at: a band that answers no pointer passes
 *   `taken` and fails this, because an opaque band hands the press to the row it is
 *   hiding. Only a band standing over nothing passes the two together.
 * - `shut`: every wind at which the way back in did not answer for its own middle,
 *   which is the door being a door.
 * - `over`: how far the sentence ever reached into the scroller, which is the same
 *   property said as geometry rather than as a hit.
 * - `outside`: how far the sentence ever stood outside the window.
 *
 * The winding and the measuring both happen in the page: six hundred winds is six
 * hundred round trips to ask the browser for a geometry it already has.
 */
async function sweptUnder(page: Page, sceneId: string, winds = 60, step = 8) {
  return page.evaluate(({ sceneId, winds, step }) => {
    const scroller = document.querySelector('.document')!
    // Through `.writing`, because the Graph marks its own nodes with the Scene
    // they draw and one of those stands earlier in the document than the section.
    const section = document.querySelector(`.writing [data-scene="${sceneId}"]`)!
    const sentence = document.querySelector('[role="alert"]')!
    const door = sentence.querySelector('a')!
    const port = scroller.getBoundingClientRect()
    const from = scroller.scrollTop
      + section.querySelector('.sets')!.getBoundingClientRect().top - port.top

    const taken = new Set<string>()
    const reached = new Set<string>()
    const shut = new Set<number>()
    let over = 0
    let outside = 0

    const answers = (element: Element, at: DOMRect) =>
      element.contains(document.elementFromPoint(at.x + at.width / 2, at.y + at.height / 2))

    for (let wind = 0; wind < winds; wind++) {
      scroller.scrollTo({ top: from + wind * step, behavior: 'instant' })

      const said = sentence.getBoundingClientRect()
      over = Math.max(over, said.bottom - port.top)
      outside = Math.max(
        outside, -said.top, said.bottom - innerHeight, -said.left, said.right - innerWidth)
      // Line by line rather than at the middle of the rectangle around the whole
      // of it: the way back in is an inline run, and where it is drawn on two lines
      // the middle of that rectangle falls in the gap at the end of the first.
      if (![...door.getClientRects()].every(line => answers(door, line))) shut.add(wind)

      // What a press taken anywhere in the band arrives at: a grid over the whole
      // of its rectangle, edges in, a pixel inside so that the point is in the band
      // and not on the line around it.
      for (let across = 0; across <= 8; across++) {
        for (let down = 0; down <= 4; down++) {
          const hit = document.elementFromPoint(
            said.left + 1 + (said.width - 2) * across / 8,
            said.top + 1 + (said.height - 2) * down / 4)

          if (!sentence.contains(hit)) reached.add(hit?.outerHTML.slice(0, 40) ?? 'nothing')
        }
      }

      for (const control of section.querySelectorAll('input, textarea, button, select, a')) {
        // A control the interface hides from the eye — the field an Image is
        // chosen in, which its own label is drawn in place of — is not a control
        // a pointer is aimed at, and the point at its middle is a point in
        // whatever stands over it.
        if (control.classList.contains('visually-hidden')) continue

        const box = control.getBoundingClientRect()
        const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        // Only what a hand could actually aim at: a control wound off the
        // scroller, or one a fold has carried across the foot of the window, is
        // not a question about what covers it. A pixel inside the window rather
        // than on its edge, because a control lying half over the edge has its
        // middle in the last fraction of a pixel of it, where `elementFromPoint`
        // answers nothing at all.
        if (middle.x < port.left || middle.x > Math.min(port.right, innerWidth) - 1) continue
        if (middle.y < port.top || middle.y > Math.min(port.bottom, innerHeight) - 1) continue
        if (answers(control, box)) continue

        taken.add(`${document.elementFromPoint(middle.x, middle.y)?.outerHTML.slice(0, 40)
          ?? 'nothing'} over ${control.outerHTML.slice(0, 40)}`)
      }
    }

    // Rounded, because what the scroller gives back it gives back in device pixels
    // and a band drawn flush against its head stands a rounding off it.
    return {
      taken: [...taken],
      reached: [...reached],
      shut: [...shut],
      over: Math.round(Math.max(0, over)),
      outside: Math.round(Math.max(0, outside)),
    }
  }, { sceneId, winds, step })
}

/** The same sweep at every width, said so that a failure names the width it is at. */
async function sweptAtEveryWidth(page: Page, sceneId: string) {
  const swept = []
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 })
    await expect(refusal(page)).toBeVisible()
    swept.push({ width, ...await sweptUnder(page, sceneId) })
  }

  return swept
}

/** What the server says when the session has shut, which is the sentence with a door in it. */
const SIGNED_OUT = 'You are no longer signed in, so nothing was written.'

/**
 * Where the three things a sentence arriving above the document can move stand: the
 * beat under the Author's hands, the head of the scroller, and the head of the
 * column the scroller stands in. Read in one pass, because two round trips are two
 * frames and the second could be a different screen.
 */
function where(beat: Locator) {
  return beat.evaluate((field) => {
    const said = document.querySelector('.refused')?.getBoundingClientRect()

    return {
      beat: field.getBoundingClientRect().top,
      head: document.querySelector('.document')!.getBoundingClientRect().top,
      column: document.querySelector('.middle')!.getBoundingClientRect().top,
      tall: said?.height ?? 0,
      ends: said?.bottom ?? 0,
    }
  })
}

/** What a sweep of a sentence standing over nothing says, at every width. */
const standsOverNothing = widths.map(width =>
  ({ width, taken: [], reached: [], shut: [], over: 0, outside: 0 }))

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

  await expect(refusal(page)).toHaveText('In “The arrival”: A Scene needs a name.')
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

    // The five parts of a Scene, in the order a Reader meets them, each headed
    // and counted where it starts: the Flags set on entry, what it is heard
    // under, how its run is cut, the run of beats, the ways on.
    await expect(arrival.locator('.held > h3'))
      .toHaveText([/Flags\s*1/, 'Sound', 'Cut', /Shots\s*2/, /Exits\s*1/])

    // And all five are on the surface together, which is what taking the tabs
    // out bought: a Condition and the Flags that satisfy it are read at once.
    await expect(arrival.getByRole('textbox', { name: 'Shot 1 of The arrival', exact: true }))
      .toBeVisible()
    await expect(page.getByLabel('Name of Flag 1 set on entering The arrival')).toHaveValue('coat')
    await expect(arrival.locator('.ways > ol > li > .numbered')).toHaveText('1')
    await expect(page.getByLabel('Where the Exit 1 out of The arrival leads'))
      .toHaveValue(platform.id)

    // The count follows the Story rather than the page it was drawn on.
    await arrival.getByRole('button', { name: 'Add a Shot' }).click()
    await expect(arrival.locator('.held > h3').nth(3)).toHaveText(/Shots\s*3/)
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
  // And the join says nothing. The field it took off the screen writes itself one
  // last time on the way out — a browser tells a control it was typed in the
  // moment the caret leaves it, and being removed is one of the ways it leaves —
  // so a bench that sent that write would be asking for a beat it had just taken
  // away, and reading the whole Story back over the beat the caret had just moved
  // to. See issue #325, where that read is what swallowed the newline below.
  await expect(refusal(page)).toHaveCount(0)

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
    // A fraction of a pixel rather than none: the seven Scenes standing above
    // Eight before the correction are each a hair taller or shorter than the one
    // Scene standing above it after, and the sub-pixel remainder is not the room
    // the correction claimed back.
    expect((await writing.boundingBox())!.y).toBeLessThanOrEqual(before + 1)
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

    const moveLaterButton = writing
      .getByRole('button', { name: 'Move Later the Exit 1 to Six, out of Five', exact: true })
    // Named by place as well as destination (see the comment beside the mark
    // in Writing.vue), and the place moving later is the point of the first
    // act below — so this is matched on the destination alone, which the
    // renumbering never touches, rather than on a place number the renumbering
    // is about to change out from under it.
    const deleteButton = writing
      .getByRole('button', { name: /^Delete the Exit \d+ to Seven, out of Five$/ })
    // Both controls stand fully in view before the baseline is taken. Left to
    // itself, a short viewport has one of them sitting a few pixels past its
    // bottom edge — a control that is not fully in view is not fully clickable,
    // and Playwright scrolls it the rest of the way in before the click lands.
    // That scroll is the click's own precondition and not this act's doing, so
    // the test does what a hand about to press these would do too: reach them
    // first, then measure.
    await moveLaterButton.scrollIntoViewIfNeeded()
    await deleteButton.scrollIntoViewIfNeeded()
    const before = (await writing.boundingBox())!.y

    // Neither of these can raise a line above the caret, and the claim is worth a
    // test because it is the reason they are run without holding the document
    // still. A column is a Scene's distance from the opening in Exits taken, so
    // renumbering the ways on out of Five reorders the columns beyond Five's and
    // nothing else; taking one away can only lengthen a Scene's distance or leave
    // it unreached, and a Scene nothing reaches is read after every column the
    // opening does. Both happen under the Author's hands, never over them.
    await moveLaterButton.click()
    await expect.poll(async () => (await readExits(fifth.id)).map(way => way.toSceneId))
      .toEqual([scenes[6]!.id, scenes[5]!.id, scenes[7]!.id])
    await expect.poll(async () => Math.abs((await writing.boundingBox())!.y - before))
      .toBeLessThanOrEqual(2)

    await deleteButton.click()
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

/**
 * The Scene's own Sound section has an order too, and it is the order the section
 * is drawn in: the file of the Author's own first, then the list of what the
 * Story and the library already carry, then the two acts on what that list is
 * standing on. Held here because nothing else holds it — the section stands below
 * the Flags, so a control added to it breaks no walk and the next person to add
 * one would not know there was an order to keep.
 *
 * Walked twice, because *Listen* and *Take This Sound* both act on what the
 * `<select>` is standing on and do nothing at all on nothing: standing on nothing
 * they are disabled, which is not a tab stop, and the walk is two stops long.
 */
test('the Sound a Scene is heard under is chosen in the order the section draws',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
    await page.goto(`/stories/${story.id}`)
    await expect(written(page, 'The arrival')).toBeVisible()

    const section = sectionOf(page, scenes[0]!.id)
    const depositing = section.getByLabel('Upload a Sound for The arrival')
    const picking = section.getByLabel('The Sound of The arrival')
    const listening = section.getByRole('button', { name: 'Listen The arrival' })
    const taking = section.getByRole('button', { name: 'Take This Sound The arrival' })

    // Standing on nothing, the two acts are drawn and refuse the walk, which is
    // what a control that would do nothing owes an Author. What the `<select>`
    // stands on is its own placeholder and never nothing: a value matching no
    // option leaves `selectedIndex` at -1, which draws the field blank and puts
    // *No Sound* — written and translated — out of reach.
    await expect(picking).toHaveJSProperty('selectedIndex', 0)
    await expect(listening).toBeDisabled()
    await expect(taking).toBeDisabled()

    await depositing.focus()
    await page.keyboard.press('Tab')
    await expect(picking).toBeFocused()

    // Standing on a Sound of the library, both act and both take their place.
    await picking.selectOption({ index: 1 })
    await expect(listening).toBeEnabled()

    await depositing.focus()
    for (const stop of [picking, listening, taking]) {
      await page.keyboard.press('Tab')
      await expect(stop).toBeFocused()
    }
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
    'Duplicate the Exit 1 to La gare, out of The street',
    'Duplicate the Exit 1 to La gare, out of The bar',
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
  // the other one: the sentence is about where the Author was typing, not about
  // where the caret happens to stand. See
  // `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`, whose rule is that
  // the work being written survives the refusal.
  const named = naming(page, platform!.id)
  await named.fill('  ')
  await named.blur()

  // Said in the words, because it is not said by the geometry: the sentence stands
  // above the document rather than in the section of the Scene it is about, which
  // is the one place on the bench it covers no row of the writing.
  const refused = refusal(page)
  await expect(refused).toHaveText('In “The platform”: A Scene needs a name.')
  await expect(page.locator('.writing [role="alert"]')).toHaveCount(0)

  // And what the Story's own edge is refused is about no Scene, so it names none
  // and is said under that edge: the two things a refusal is about are a Scene of
  // the Story and the Story, and nothing is said as both.
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
    await expect(refusal(page)).toHaveText('In “The arrival”: A Scene needs a name.')
    // Not under the Story's edge, which is where a refusal goes that is about no
    // Scene at all — and this one is about a Scene.
    await expect(page.locator('main > [role="alert"]')).toHaveCount(0)
  })

test('a refusal takes its room out of the document and moves nothing under the hands',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
    const [, platform] = scenes
    // A run long enough to carry the window past the Scene above it, so the
    // scroller has room above the hands to give back: that is what the correction
    // winds on, and what a document standing at its own head has none of.
    const beats = await writeShots(
      request, platform!.id, Array.from({ length: 20 }, (_, beat) => `Beat ${beat + 1}.`))

    await page.goto(`/stories/${story.id}`)

    // The beat under the hands is the one whose write is refused, which is the
    // worst case for a sentence that takes its room above the document: the Author
    // is looking at the field, and the whole document is about to be pushed down by
    // the height of a band they did not ask for.
    let refusing = true
    await page.route(`**/api/shots/${beats[14]!.id}`, route => refusing
      ? route.fulfill({ status: 401, json: { message: SIGNED_OUT } })
      : route.continue())

    const beat = shot(page, 15, 'The platform')
    const held = []

    // Posed across the range, because the room the sentence takes is not one
    // number: at 1440 it is a line and at 390 in either language it is three or
    // four, and a correction that answered for one line would pass the width it was
    // written at and move the writing by three at the width under it.
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 })

      // Cleared first, so that what the next reading measures is the sentence
      // arriving rather than one sentence replaced by another.
      refusing = false
      await beat.click()
      await page.keyboard.type('.')
      // Waited for, because the next write is only refused if it goes out after the
      // route has been turned round: a clearing write still in the air would be
      // refused itself and the reading would be of no arrival at all.
      const kept = page.waitForResponse(`**/api/shots/${beats[14]!.id}`)
      await beat.blur()
      await kept
      await expect(refusal(page)).toBeHidden()
      // The mark that says the write was kept arrives with it and grows the Story's
      // own edge, which moves the bench under it: a reading taken before it lands
      // would read that as the sentence moving the writing.
      await expect(page.getByText(/^Kept at /)).toBeVisible()

      refusing = true
      await beat.click()
      await page.keyboard.type(' She waits.')
      const before = await where(beat)

      await beat.blur()
      await expect(refusal(page)).toContainText(SIGNED_OUT)
      const after = await where(beat)

      held.push({
        width,
        // Rounded rather than held to the pixel: the scroller is wound back in
        // device pixels and what is left of a correction of forty-odd is the
        // rounding. A correction that stopped being made would move the beat by the
        // whole room the sentence took.
        moved: Math.round(after.beat - before.beat) || 0,
        // Nothing above the scroller before, a sentence of its own height above it
        // after, and the scroller beginning exactly where that sentence ends: it
        // keeps its own height out here as it kept it in the flow, and what it took
        // it took out of the document rather than off the top of it.
        room: Math.round(before.head - before.column) === 0
          && after.tall > 0 && Math.round(after.head - after.ends) === 0
          ? 'its own'
          : `${before.head - before.column} above the scroller before, `
            + `${after.head - after.column} after, for a sentence `
            + `${after.tall} tall ending at ${after.ends}`,
      })
    }

    expect(held).toEqual(widths.map(width => ({ width, moved: 0, room: 'its own' })))
  })

test('a refusal at the foot of a long Scene is read without leaving the foot of it',
  async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    const { story, scenes } = await chained(request, ['The arrival', 'The platform', 'The bar'])
    const [, platform, bar] = scenes
    // A second way on, so the first has somewhere to be moved to, under a run of
    // twenty beats: the ways out are the last part of a Scene's section, and this
    // is what puts them two thousand pixels below the slate the sentence hangs on.
    // To the same Scene as the first, which two Exits under opposite Conditions is
    // what Conditions on an Exit are for — a way on leading back is refused, see
    // `docs/adr/0048-a-scene-is-entered-once.md`.
    await request.post(`/api/scenes/${platform!.id}/exits`, { data: { toSceneId: bar!.id } })
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
    const refused = refusal(page)
    await expect(refused).toContainText('Please sign in again.')
    // Whole, and not a sliver of it: the door is inside the sentence.
    await expect(refused).toBeInViewport({ ratio: 1 })
    expect((await refused.boundingBox())!.y).toBeGreaterThanOrEqual(0)
  })

/**
 * Stands a refusal carrying the way back in against the second Scene of a Story,
 * and hands back the Scene it is about. The gesture is a rename and the field it is
 * made in is found by its place on the slate rather than by its label: this is
 * driven in two languages, and the label is one of the things that change.
 */
async function refusedWithADoor(page: Page, request: APIRequestContext, said: string) {
  const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
  const [, platform] = scenes
  // A Flag drawn from two values, so the Scene's first row carries every kind of
  // control a row of Flags has: the name, both values, the mark that adds a third
  // and the three that take a value or the Flag away. It is the row a band stuck to
  // the head of the scroller stood on, and the row a press on the door deleted the
  // Flag out of.
  await seedFlags(platform!.id, { coat: ['on', 'off'] })
  // Long enough for the slate to leave the window with the Scene still in it, which
  // is the wind a band held to the scroller was read at.
  await writeShots(
    request, platform!.id, Array.from({ length: 20 }, (_, beat) => `Beat ${beat + 1}.`))

  await page.goto(`/stories/${story.id}`)

  // The worst of the sentences, and the widest: the session has shut, so the way
  // back in stands inside it — a control of its own, and the one thing the band
  // carries that a press is meant to arrive at.
  await page.route(`**/api/scenes/${platform!.id}`, route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 401, json: { message: said } })
    : route.continue())

  const named = naming(page, platform!.id)
  await named.fill('The platform again')
  await named.blur()

  await expect(refusal(page)).toContainText(said)

  return { section: sectionOf(page, platform!.id), scene: platform!.id }
}

test('a refusal standing over the document reaches no row of it, at every width',
  async ({ page, request }) => {
    const { section, scene } = await refusedWithADoor(page, request, SIGNED_OUT)

    // Against the Scene it concerns, said by the words: the sentence is not drawn
    // in that Scene's section any more, because there is no place in the section it
    // can be drawn without standing on a row of it.
    await expect(refusal(page)).toContainText('In “The platform again”:')

    // The row the issue measured on, and every kind of control it carries: the
    // name, two values, the mark that adds a third and the three that take a value
    // or the Flag away. Seven — the eighth a round of this counted was *Add a
    // Flag*, which stands under the row and not on it.
    await expect(section.locator('.sets').locator('input, button')).toHaveCount(7)

    // Posed where the fix could fail rather than where it was measured: every
    // width, and sixty winds of eight pixels from the one the issue names — the
    // slate just above the window, the Scene's first row at the head of the
    // scroller, which is where a band held to that head stood. Five readings at
    // each, because every round of this won one of them and lost another: no
    // control of the Scene loses a point at its own middle, no press taken inside
    // the sentence arrives anywhere but in the sentence, the door answers for its
    // own middle, the sentence reaches no part of the scroller, and it never stands
    // outside the window.
    expect(await sweptAtEveryWidth(page, scene)).toEqual(standsOverNothing)

    // And the gesture the hit test is about, at the narrowest width and the wind
    // the issue made it at: a press in the middle of the Flag's own name puts the
    // caret there. Driven as a click rather than a point, because a click is what
    // deleted the Flag.
    await page.setViewportSize({ width: 390, height: 844 })
    await windToFirstRow(page, scene)
    await expect(section.locator('.slate')).not.toBeInViewport()
    const flag = section.locator('.sets input').first()
    await flag.click()
    await expect(flag).toBeFocused()

    // And the door is a door: a real mouse press on it opens the way back in beside
    // this tab, which is the whole offer of the refusal — see
    // `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`. Driven at the
    // narrowest width and at the widest, because a band that answered no press
    // answered none at either.
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      const opening = page.waitForEvent('popup')
      await refusal(page).getByRole('link', { name: 'Sign In Again in a New Tab' }).click()
      const beside = await opening

      await expect(beside).toHaveURL(/\/stories$|\/$/)
      await beside.close()
      // And the tab holding the Story was never navigated: the Scene being written
      // is still on screen, with what was typed into it still in the field.
      await expect(page).toHaveURL(new RegExp(`/stories/`))
      await expect(naming(page, scene)).toHaveValue('The platform again')
    }
  })

test.describe('the same sentence read in French', () => {
  test.use({ locale: 'fr-FR' })

  // The way back in is *Se reconnecter dans un nouvel onglet* against *Sign In
  // Again in a New Tab*, and the sentence around it is longer too, so the band is
  // taller and wraps at widths where the English one does not: the length of a
  // label is part of this geometry, and the language a spec is read in is part of
  // the measurement. The reading that found the defect saw it as far up the range
  // as 760 in French and 650 in English, which one language alone would not say.
  test('reaches no row of the document either, at every width',
    async ({ page, request }) => {
      const { scene } = await refusedWithADoor(
        page, request, 'La connexion n\'est plus ouverte, donc rien n\'a été écrit.')

      await expect(refusal(page)).toContainText('Dans « The platform again » :')
      expect(await sweptAtEveryWidth(page, scene)).toEqual(standsOverNothing)
    })
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
  const write = async (name: string) => await (await request.post(
    `/api/stories/${story.id}/scenes`, { data: { name } })).json()
  const lobby = await write('The lobby')
  const foyer = await write('The foyer')
  // An Exit at each end, because the schema cascades a delete from both of them and
  // only the ways on were ever counted. The one arriving is written from a third
  // Scene rather than back out of the lobby: a Reading stands in a Scene at most
  // once — see `docs/adr/0048-a-scene-is-entered-once.md`.
  await request.post(`/api/scenes/${scene.id}/exits`, { data: { toSceneId: lobby.id } })
  await request.post(`/api/scenes/${foyer.id}/exits`, { data: { toSceneId: scene.id } })

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
  await expect(readExits(foyer.id)).resolves.toHaveLength(1)
})

test('a Shot carries the Conditions it plays under', async ({ request }) => {
  const { story, scene } = await openScene(request, 'The booth')
  const [always, onReturn] = await writeShots(
    request, scene.id, ['The projector ticks over.', 'You have been here before.'])

  const written = await request.put(`/api/shots/${onReturn!.id}/conditions`, {
    data: { conditions: [{ scene: scene.id, entered: true }] },
  })
  expect(written.status()).toBe(200)

  await expect((await request.get(`/api/stories/${story.id}`)).json()).resolves.toMatchObject({
    scenes: [{
      shots: [
        { id: always!.id, conditions: [] },
        { id: onReturn!.id, conditions: [{ scene: scene.id, entered: true }] },
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
    .selectOption('entered')
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
    // The shape that counted entries, which nothing reads any more (#307).
    request.put(`/api/shots/${shot!.id}/conditions`, {
      data: { conditions: [{ scene: scene.id, visits: 'at least', times: 1 }] },
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
    data: { conditions: [{ scene: elsewhere.id, entered: true }] },
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
  // A question about a Scene is whole the moment it is chosen: it starts on the
  // Scene the Shot belongs to, asked as *has been entered* — the return the Author
  // is writing for — and there is no number to type after it.
  await page
    .getByLabel('Condition 1 of Shot 1 of The booth', { exact: true })
    .selectOption('entered')

  await expect(async () => {
    await expect(readShotConditions(scene.id)).resolves.toEqual([
      [{ scene: scene.id, entered: true }],
    ])
  }).toPass()

  // What the page shows has to be what was written, not what the page remembers.
  // The Scene being written is in the address since
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, so the reload
  // comes back to it and there is nothing to open again.
  await page.reload()
  await expect(page.getByLabel('Condition 1 of Shot 1 of The booth', { exact: true }))
    .toHaveValue('entered')
  await expect(page.getByLabel('entered for Condition 1 of Shot 1 of The booth'))
    .toHaveValue('true')
  await expect(page.getByLabel('times for Condition 1 of Shot 1 of The booth')).toHaveCount(0)

  await page.getByRole('button', { name: 'Remove Condition 1 of Shot 1 of The booth' }).click()
  await expect(async () => {
    await expect(readShotConditions(scene.id)).resolves.toEqual([[]])
  }).toPass()
})

/**
 * The sentence the bench refuses a way on that comes back with, in the Language
 * the suite reads. Held here rather than typed into each expectation, because it
 * is said at two boundaries and read on one band.
 */
const COMES_BACK = 'A Reading stands in a Scene once, so an Exit cannot lead back to a Scene '
  + 'the Reader may already have come through. Duplicate that Scene, and lead the Exit to the copy.'

/**
 * Both halves of `docs/adr/0048-a-scene-is-entered-once.md` as one Author meets
 * them: the bench says no to the way on that would let a Reading come back, and
 * says what to write instead — which is the copy, written from the same slate and
 * ordinary from the moment it exists.
 *
 * One test and not two, because from the Author's side it is one act interrupted:
 * shipping the refusal without the copy would leave them with nowhere to go, and a
 * spec that drove them apart would not be driving what the ticket is.
 */
test('the bench refuses a way on that comes back, and an Author writes the Scene again instead',
  async ({ page, request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform', 'The bar'])
    const [arrival, bar] = [scenes[0]!, scenes[2]!]
    const [first, second] = await writeShots(
      request, arrival.id, ['She steps off the train.', 'The platform is empty.'])
    await request.put(`/api/shots/${first!.id}/image`, { data: ONE_PIXEL })
    await request.patch(`/api/shots/${first!.id}`, {
      data: { text: 'She steps off the train.', description: 'A platform at night' },
    })
    await request.put(`/api/shots/${second!.id}/conditions`, {
      data: { conditions: [{ flag: 'coat', is: 'on' }] },
    })

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The bar')

    // Nothing a Reading could have come through is on offer. Out of the last Scene
    // of a chain that is every other Scene of the Story, so the field at the foot
    // of the ways on offers nothing at all.
    const leaving = written(page, 'The bar')
    const adding = leaving.getByLabel('An Exit from here The bar')
    const offered = () => leaving.locator('.adding datalist option')
      .evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))
    await expect.poll(offered).toEqual([])

    // The field takes any name at all, so the refusal is what the Author meets: a
    // sentence naming the Scene it was written in, saying what was refused and what
    // to write instead. Nothing is left behind.
    await adding.fill('The arrival')
    await adding.press('Enter')
    await expect(refusal(page)).toHaveText(`In “The bar”: ${COMES_BACK}`)
    await expect.poll(() => readExits(bar.id)).toEqual([])

    // What to write instead, from the slate of the Scene to be met again. The act
    // is marked, so the bar of Commands offers it by name wherever the caret is.
    await writeScene(page, 'The arrival')
    const duplicate = written(page, 'The arrival').getByRole('button', { name: 'Duplicate Scene' })
    await expect(duplicate).toHaveAttribute('data-command', 'Duplicate Scene')
    await duplicate.click()

    // Two Scenes answer to one name now, so the bench numbers them — and says what
    // it did under the names it draws them by.
    await expect(toast(page)).toHaveText(
      '“The arrival (1)” duplicated as “The arrival (2)”, '
      + 'carrying its Shots and none of its ways on')

    const read = async () =>
      await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor
    const copies = (await read()).scenes.filter(scene => scene.name === 'The arrival')
    expect(copies).toHaveLength(2)
    const copy = copies.find(scene => scene.id !== arrival.id)!

    // It carries the Shots with their text, their Conditions and their order, and
    // none of the original's ways on.
    expect(copy.shots.map(shot => [shot.text, shot.description, shot.conditions])).toEqual([
      ['She steps off the train.', 'A platform at night', []],
      ['The platform is empty.', '', [{ flag: 'coat', is: 'on' }]],
    ])
    await expect.poll(() => readExits(copy.id)).toEqual([])

    // The Image is the copy's own Shot again rather than a reference to the Shot it
    // was made from: its own address, serving the same bytes.
    expect(copy.shots[0]!.image).toBe(`/api/shots/${copy.shots[0]!.id}/image`)
    const served = await request.get(copy.shots[0]!.image!)
    expect(Buffer.from(await served.body())).toEqual(ONE_PIXEL)

    // Ordinary from the moment it exists: renamed like any other Scene, and then
    // the way on the bench refused is written to it instead.
    const renaming = naming(page, copy.id)
    await renaming.fill('The arrival, again')
    await renaming.blur()
    await expect.poll(() => readSceneName(copy.id)).toBe('The arrival, again')

    await writeScene(page, 'The bar')
    const writing = written(page, 'The bar').getByLabel('An Exit from here The bar')
    await writing.fill('The arrival, again')
    await writing.press('Enter')
    await expect.poll(() => readExits(bar.id)).toMatchObject([{ toSceneId: copy.id }])
  })

/**
 * What a copy carries is the whole of the Scene rather than the part of it that
 * was written first. `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` puts
 * the bed on the Scene's own row and the strike on the Shot's, so a copy taking
 * the Images and leaving the Sounds would be the Scene met again in silence —
 * silently, which is the one way a copy must never differ from what it was made
 * from.
 *
 * Both ways a Scene is heard, because a copy has to answer for both: the Scene
 * carrying bytes is copied with them, and the Scene naming a carrier is copied
 * still naming it. That is one hop either way, since what the original named
 * carries bytes by construction.
 */
test('a duplicated Scene is heard under what it was heard under, and strikes as it struck',
  async ({ request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform'])
    const [arrival, platform] = [scenes[0]!, scenes[1]!]
    const [, second] = await writeShots(request, arrival.id, ['One', 'Two'])

    await request.put(`/api/scenes/${arrival.id}/sound`, { data: A_SOUND })
    await request.patch(`/api/scenes/${arrival.id}`, {
      data: { transcript: 'Rain on the roof', soundLoops: false },
    })
    await request.put(`/api/shots/${second!.id}/sound`, { data: A_SOUND })
    await request.patch(`/api/shots/${second!.id}`, { data: { transcript: 'A door slams' } })
    await request.patch(`/api/scenes/${platform.id}`, { data: { soundOfSceneId: arrival.id } })

    const copyOf = async (sceneId: string) => {
      const made = await request.post(`/api/scenes/${sceneId}/duplicate`)
      expect(made.status()).toBe(201)
      const { id } = await made.json() as { id: string }
      const read = await (await request.get(`/api/stories/${story.id}`)).json() as StoryInEditor

      return read.scenes.find(scene => scene.id === id)!
    }

    // The carrier's copy carries the bytes itself, at an address of its own, and
    // the two things that belong to those bytes come with them: the same rain,
    // transcribed once and played once.
    const carrier = await copyOf(arrival.id)
    expect(carrier.sound).toBe(`/api/scenes/${carrier.id}/sound`)
    expect(carrier.transcript).toBe('Rain on the roof')
    expect(carrier.soundLoops).toBe(false)
    const served = await request.get(carrier.sound!)
    expect(Buffer.compare(Buffer.from(await served.body()), A_SOUND)).toBe(0)

    // And the beat strikes with its own, transcribed as it was transcribed, while
    // the beat that struck with nothing goes on striking with nothing.
    expect(carrier.shots[1]!.sound).toBe(`/api/shots/${carrier.shots[1]!.id}/sound`)
    expect(carrier.shots[1]!.transcript).toBe('A door slams')
    expect(carrier.shots[0]!.sound).toBeNull()

    // The copy of a Scene that names one names the same Scene, and carries no
    // bytes — which is the Scene met again, heard under exactly what it was.
    const naming = await copyOf(platform.id)
    expect(naming.sound).toBeNull()
    expect(naming.soundOfSceneId).toBe(arrival.id)
  })

/**
 * The same refusal at both boundaries a way on is given a destination, and the two
 * things it does not refuse. Asked of the requests rather than of the bench,
 * because what is being held is the rule and not the sentence: the field withholds
 * the landings the server refuses, so the only way to write one from the bench is
 * by typing a name — which is the test above.
 */
test('a way on that comes back is refused wherever it is given a destination',
  async ({ request }) => {
    const { story, scenes } = await chained(request, ['The arrival', 'The platform', 'The bar'])
    const [arrival, platform, bar] = [scenes[0]!, scenes[1]!, scenes[2]!]

    // Written: the Scene at the far end already reaches the one the way on leaves.
    const back = await request.post(`/api/scenes/${bar.id}/exits`, {
      data: { toSceneId: arrival.id },
    })
    expect(back.status()).toBe(400)
    expect((await back.json()).message).toBe(COMES_BACK)

    // A way on to the Scene it leaves is that same test asked of one Scene, since
    // a Reading standing in a Scene has already entered it.
    const itself = await request.post(`/api/scenes/${bar.id}/exits`, {
      data: { toSceneId: bar.id },
    })
    expect(itself.status()).toBe(400)

    // Re-led: the same walk, asked of a way on that already exists. And a way on
    // re-led onwards is untouched — the rule is about coming back and not about
    // changing where something lands.
    const [leaving] = await readExits(platform.id)
    const led = await request.put(`/api/exits/${leaving!.id}/scene`, {
      data: { toSceneId: arrival.id },
    })
    expect(led.status()).toBe(400)
    expect((await led.json()).message).toBe(COMES_BACK)

    // Two Scenes of one column are neighbours, and one may lead to the other: the
    // kiosk and the platform are both reached from the arrival, and neither
    // reaches the other.
    const kiosk = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The kiosk' },
    })).json() as { id: string }
    expect((await request.post(`/api/scenes/${arrival.id}/exits`, {
      data: { toSceneId: kiosk.id },
    })).status()).toBe(201)
    expect((await request.post(`/api/scenes/${platform.id}/exits`, {
      data: { toSceneId: kiosk.id },
    })).status()).toBe(201)

    // Every refusal left the Story exactly as it was written.
    await expect.poll(() => readExits(bar.id)).toEqual([])
    await expect.poll(() => readExits(platform.id))
      .toMatchObject([{ toSceneId: bar.id }, { toSceneId: kiosk.id }])
  })
