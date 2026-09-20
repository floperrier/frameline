import { expect } from '@playwright/test'
import { A_SOUND, seedPublication, seedScene, seedStory, test, writeStory } from './author'
import { SOUND_MAX_BYTES, SOUND_TRANSCRIPT_MAX_LENGTH } from '../../shared/utils/sound'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/** The first Scene of a Story written the way an Author writes one, and its Shots. */
async function openScene(request: APIRequestContext) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()

  return { story, scene: read.scenes[0]!, shots: read.scenes[0]!.shots }
}

/** Reads the Story back, to see what a request left behind. */
export async function reread(request: APIRequestContext, storyId: string) {
  return await (await request.get(`/api/stories/${storyId}`)).json() as StoryInEditor
}

test('a Story arrives carrying no Sound anywhere, and says so of every row', async ({ request }) => {
  const { scene, shots } = await openScene(request)

  expect(scene.sound).toBeNull()
  expect(scene.soundOfSceneId).toBeNull()
  expect(scene.transcript).toBe('')
  expect(scene.soundLoops).toBe(true)
  expect(shots[0]!.sound).toBeNull()
  expect(shots[0]!.transcript).toBe('')
})

/** An MPEG-4 head with nothing behind it: enough to be taken, never to be played. */
const AN_M4A = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(16),
])

test('an Author deposits a Sound on a Scene, and it is served where the Scene says', async ({ request }) => {
  const { story, scene } = await openScene(request)

  const deposited = await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })
  expect(deposited.status()).toBe(200)
  expect(await deposited.json()).toMatchObject({ sound: `/api/scenes/${scene.id}/sound` })

  const after = await reread(request, story.id)
  expect(after.scenes[0]!.sound).toBe(`/api/scenes/${scene.id}/sound`)

  const served = await request.get(`/api/scenes/${scene.id}/sound`)
  expect(served.status()).toBe(200)
  // Served under the type its own first bytes say it is, and never sniffed past it.
  expect(served.headers()['content-type']).toBe('audio/mpeg')
  expect(served.headers()['x-content-type-options']).toBe('nosniff')
  expect(served.headers()['cache-control']).toContain('no-store')
  expect(Buffer.compare(await served.body(), A_SOUND)).toBe(0)
})

test('an Author deposits a Sound on a Shot, and takes it off again', async ({ request }) => {
  const { story, shots } = await openScene(request)

  await request.put(`/api/shots/${shots[0]!.id}/sound`, { data: AN_M4A })
  expect((await reread(request, story.id)).scenes[0]!.shots[0]!.sound)
    .toBe(`/api/shots/${shots[0]!.id}/sound`)
  expect((await request.get(`/api/shots/${shots[0]!.id}/sound`)).headers()['content-type'])
    .toBe('audio/mp4')

  const removed = await request.delete(`/api/shots/${shots[0]!.id}/sound`)
  expect(removed.status()).toBe(200)

  const after = await reread(request, story.id)
  expect(after.scenes[0]!.shots[0]!.sound).toBeNull()
  // Whatever cannot be reached reads as absent, which is what a Shot with no
  // Sound and a Shot nobody ever wrote have in common.
  expect((await request.get(`/api/shots/${shots[0]!.id}/sound`)).status()).toBe(404)
})

test('a deposit of the wrong kind, too heavy, or absent is refused by its reason', async ({ request }) => {
  const { scene } = await openScene(request)

  const opus = await request.put(`/api/scenes/${scene.id}/sound`, {
    data: Buffer.concat([Buffer.from('OggS'), Buffer.alloc(24)]),
  })
  expect(opus.status()).toBe(400)
  expect((await opus.json()).message).toContain('A Sound is an AAC or an MP3 file')

  const tooHeavy = await request.put(`/api/scenes/${scene.id}/sound`, {
    data: Buffer.concat([A_SOUND, Buffer.alloc(SOUND_MAX_BYTES)]),
  })
  expect(tooHeavy.status()).toBe(400)
  expect((await tooHeavy.json()).message).toContain('cannot weigh more than 2 MB')

  const nothing = await request.put(`/api/scenes/${scene.id}/sound`)
  expect(nothing.status()).toBe(400)
  expect((await nothing.json()).message).toContain('A Sound is a file to upload.')
})

test('a Sound of somebody else’s Story is not refused so much as absent', async ({ request, otherAuthor }) => {
  const theirs = await seedStory(otherAuthor, 'Theirs')
  const scene = await seedScene(theirs, 'The street')

  expect((await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })).status()).toBe(404)
  expect((await request.get(`/api/scenes/${scene.id}/sound`)).status()).toBe(404)
})

test('a Transcript and a loop are written beside the Sound they belong to', async ({ request }) => {
  const { story, scene, shots } = await openScene(request)
  await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })

  await request.patch(`/api/scenes/${scene.id}`, {
    data: { transcript: 'Rain on a tin roof, steady.', soundLoops: false },
  })
  await request.put(`/api/shots/${shots[0]!.id}/sound`, { data: A_SOUND })
  await request.patch(`/api/shots/${shots[0]!.id}`, {
    data: { text: 'A door opens.', description: '', transcript: 'A door slams.' },
  })

  const after = await reread(request, story.id)
  expect(after.scenes[0]!.transcript).toBe('Rain on a tin roof, steady.')
  expect(after.scenes[0]!.soundLoops).toBe(false)
  expect(after.scenes[0]!.shots[0]!.transcript).toBe('A door slams.')
  // A body naming only the Sound's own fields leaves the name where it was.
  expect(after.scenes[0]!.name).toBe(scene.name)
})

test('a Scene takes its Sound from a Scene that carries one, and never from one that names', async ({ request }) => {
  const story = await writeStory(request)
  const read = await reread(request, story.id)
  const carrier = read.scenes[0]!
  const second = await seedScene(story, 'The bar')
  const third = await seedScene(story, 'The alley')

  await request.put(`/api/scenes/${carrier.id}/sound`, { data: A_SOUND })

  const named = await request.patch(`/api/scenes/${second.id}`, {
    data: { soundOfSceneId: carrier.id },
  })
  expect(named.status()).toBe(200)
  // By id, not by position: `writeStory` already seeds a Scene of its own before
  // `second` is written, so `second` is not the Story's second Scene by the
  // order Scenes come back in.
  const sceneNamed = (read: StoryInEditor, id: string) => read.scenes.find(scene => scene.id === id)!
  expect(sceneNamed(await reread(request, story.id), second.id).soundOfSceneId).toBe(carrier.id)

  // One hop and no further: the Scene named has to carry bytes of its own.
  const chained = await request.patch(`/api/scenes/${third.id}`, {
    data: { soundOfSceneId: second.id },
  })
  expect(chained.status()).toBe(400)
  expect((await chained.json()).message).toContain('A Scene takes its Sound')

  // And never from itself, nor from a Scene of somebody else’s Story.
  expect((await request.patch(`/api/scenes/${third.id}`, {
    data: { soundOfSceneId: third.id },
  })).status()).toBe(400)

  // Nor from a Scene nobody seeded: a well-formed id names nothing here.
  expect((await request.patch(`/api/scenes/${third.id}`, {
    data: { soundOfSceneId: '00000000-0000-4000-8000-000000000000' },
  })).status()).toBe(400)

  // Not even spelled in another letter case. `fourth` carries bytes of its own
  // and nothing names it yet, so a naive string comparison of the URL segment
  // against the body would miss this — the two spellings read as different
  // strings, and only Postgres, not JavaScript, would notice that they name the
  // same Scene, leaving it named after itself with its own bytes cleared.
  const fourth = await seedScene(story, 'The rooftop')
  await request.put(`/api/scenes/${fourth.id}/sound`, { data: A_SOUND })
  expect((await request.patch(`/api/scenes/${fourth.id.toUpperCase()}`, {
    data: { soundOfSceneId: fourth.id },
  })).status()).toBe(400)

  // Nor may a carrier already named by another take on a naming of its own: that
  // would leave the Scene naming it two hops from the bytes, which nothing here
  // ever walks back to fix.
  const reNamed = await request.patch(`/api/scenes/${carrier.id}`, {
    data: { soundOfSceneId: fourth.id },
  })
  expect(reNamed.status()).toBe(400)
  expect((await reNamed.json()).message).toContain('A Scene takes its Sound')

  // Taking the naming away is saying it names nothing.
  await request.patch(`/api/scenes/${second.id}`, { data: { soundOfSceneId: null } })
  expect(sceneNamed(await reread(request, story.id), second.id).soundOfSceneId).toBeNull()
})

test('a Transcript longer than one is refused, and names the limit', async ({ request }) => {
  const { scene } = await openScene(request)

  const tooLong = await request.patch(`/api/scenes/${scene.id}`, {
    data: { transcript: 'w'.repeat(SOUND_TRANSCRIPT_MAX_LENGTH + 1) },
  })
  expect(tooLong.status()).toBe(400)
  expect((await tooLong.json()).message).toContain(`${SOUND_TRANSCRIPT_MAX_LENGTH} characters`)
})

/** One Scene's own section of the document, which is where that Scene is written. */
function writing(page: Page, scene = 'The street') {
  return page.getByRole('group', { name: `Writing ${scene}` })
}

test('an Author takes a Sound from the library, and the Scene carries its own bytes after', async ({ page, request }) => {
  const { story, scene } = await openScene(request)

  await page.goto(`/stories/${story.id}`)
  const soundField = writing(page).getByLabel('The Sound of The street')
  // Selected by value rather than by the option's full label, which also carries
  // a duration this test has no reason to hardcode.
  const rain = await soundField.getByRole('option', { name: /Rain/ }).getAttribute('value')
  await soundField.selectOption(rain!)
  await writing(page).getByRole('button', { name: 'Take This Sound The street', exact: true }).click()

  // The bytes are copied into the row at the moment of the pick, so the Story
  // depends on no file the product might later withdraw.
  await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.sound)
    .toBe(`/api/scenes/${scene.id}/sound`)
  await expect(writing(page).getByLabel('Transcript The street')).toBeVisible()
})

test('an Author deposits a Sound on a Scene by choosing a file, and the row carries it after', async ({ page, request }) => {
  const { story, scene } = await openScene(request)

  await page.goto(`/stories/${story.id}`)
  const picker = writing(page).getByLabel('Upload a Sound for The street')
  await picker.scrollIntoViewIfNeeded()
  await picker.setInputFiles({ name: 'silence.mp3', mimeType: 'audio/mpeg', buffer: A_SOUND })

  // The bytes are copied into the row at the moment of the pick, the same as a
  // Sound taken from the library: see the test above.
  await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.sound)
    .toBe(`/api/scenes/${scene.id}/sound`)
  await expect(writing(page).getByLabel('The Sound of The street')).toBeVisible()
  await expect(writing(page).getByLabel('Transcript The street')).toBeVisible()
})

test('a Scene takes its Sound from another, and says whose it is', async ({ page, request }) => {
  // `writeStory` writes The street and The bar already, joined by one Exit.
  const { story, scene } = await openScene(request)
  await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })

  await page.goto(`/stories/${story.id}`)
  await writing(page, 'The bar').getByLabel('The Sound of The bar')
    .selectOption({ label: 'The street' })
  await writing(page, 'The bar').getByRole('button', { name: 'Take This Sound The bar' }).click()

  await expect.poll(async () => (await reread(request, story.id)).scenes[1]!.soundOfSceneId)
    .toBe(scene.id)
  await expect(writing(page, 'The bar')).toContainText('Heard under The street')
  // The Transcript belongs to the carrier, so the Scene naming one has no field
  // for it: the same rain is transcribed once.
  await expect(writing(page, 'The bar').getByLabel('Transcript The bar')).toHaveCount(0)
})

test('removing a Sound others are heard under asks first, and says how many fall silent', async ({ page, request }) => {
  const { story, scene } = await openScene(request)
  const read = await reread(request, story.id)
  const alley = await seedScene(story, 'The alley')
  await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })
  for (const named of [read.scenes[1]!, alley]) {
    await request.patch(`/api/scenes/${named.id}`, { data: { soundOfSceneId: scene.id } })
  }

  await page.goto(`/stories/${story.id}`)
  await writing(page).getByRole('button', { name: 'Remove the Sound' }).click()

  const asked = page.getByRole('dialog')
  await expect(asked).toContainText('the 2 Scenes heard under it fall silent')
  await asked.getByRole('button', { name: 'Remove the Sound' }).click()

  await expect.poll(async () => (await reread(request, story.id)).scenes[0]!.sound).toBeNull()
})

test('deleting a Scene others are heard under says so before it goes', async ({ page, request }) => {
  const { story, scene } = await openScene(request)
  const read = await reread(request, story.id)
  await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })
  await request.patch(`/api/scenes/${read.scenes[1]!.id}`, {
    data: { soundOfSceneId: scene.id },
  })

  await page.goto(`/stories/${story.id}`)
  await writing(page).getByRole('button', { name: 'Delete Scene' }).click()

  // The confirmation is the only place this can be said: with `on delete set
  // null`, nothing in the Story remembers afterwards, so no Remark can see it.
  await expect(page.getByRole('dialog')).toContainText('One Scene is heard under it')
})

/** The field the bar is typed into, which is the bar's own accessible name. */
function typing(page: Page) {
  return page.getByRole('textbox', { name: 'Type a name' })
}

/** The control the bar is opened by, named for the bar and carrying its key. */
function commanding(page: Page) {
  return page.getByRole('button', { name: 'Commands' })
}

/** Every Command the bar is offering under what has been typed, in its order. */
function offered(page: Page) {
  return page.locator('dialog.commands li button')
}

/**
 * Opens the bar by its control, repeated until it takes: `page.goto` returns
 * when the document has loaded and not when Vue has attached anything to it.
 */
async function open(page: Page) {
  const up = page.locator('dialog.commands[open]')

  await expect(async () => {
    if (!await up.count()) await commanding(page).click()
    await expect(typing(page)).toBeFocused({ timeout: 1000 })
  }).toPass()
}

test('Remove the Sound is named in the bar once the Scene is heard under one', async ({ page, request }) => {
  const { story, scene } = await openScene(request)
  await request.put(`/api/scenes/${scene.id}/sound`, { data: A_SOUND })

  await page.goto(`/stories/${story.id}`)
  await open(page)
  await typing(page).fill('Remove the Sound')
  await expect(offered(page)).toHaveText(['Remove the Sound'])
})

test('a beat strikes with a Sound taken from the library, transcribed beside it', async ({ page, request }) => {
  const { story, shots } = await openScene(request)

  await page.goto(`/stories/${story.id}`)
  // The picker beside a beat carries the library alone and no second group: a
  // Shot's Sound is never named, because a struck sound weighs 20 KB and is
  // re-picked in one press.
  await expect(writing(page).locator('[data-shot] optgroup')).toHaveCount(0)

  // Selected by value rather than by the option's full label, which also carries
  // a duration this test has no reason to hardcode — the same reason the Scene's
  // own version of this test reads the value back first.
  const shotSoundField = writing(page).getByLabel('The Sound of Shot 1 of The street')
  const doorClosing = await shotSoundField.getByRole('option', { name: /A door closing/ })
    .getAttribute('value')
  await shotSoundField.selectOption(doorClosing!)
  // Named for the beat as well as for the act, because the Scene's own Take
  // stands above it in the same section.
  await writing(page)
    .getByRole('button', { name: 'Take This Sound Shot 1 of The street' })
    .click()

  await expect.poll(async () =>
    (await reread(request, story.id)).scenes[0]!.shots[0]!.sound)
    .toBe(`/api/shots/${shots[0]!.id}/sound`)

  await writing(page).getByLabel('The Transcript of Shot 1 of The street').fill('A door closes.')
  await writing(page).getByLabel('Shot 1 of The street', { exact: true }).click()

  await expect.poll(async () =>
    (await reread(request, story.id)).scenes[0]!.shots[0]!.transcript)
    .toBe('A door closes.')

  // And it strikes rather than being held: there is no loop to answer for.
  await expect(writing(page).getByLabel('Held under the Scene')).toHaveCount(0)
})

test('an Author deposits a Sound on a beat by choosing a file, and it plays beside the Transcript', async ({ page, request }) => {
  const { story, shots } = await openScene(request)

  await page.goto(`/stories/${story.id}`)
  const picker = writing(page).getByLabel('Upload a Sound for Shot 1 of The street')
  await picker.scrollIntoViewIfNeeded()
  await picker.setInputFiles({ name: 'silence.mp3', mimeType: 'audio/mpeg', buffer: A_SOUND })

  await expect.poll(async () =>
    (await reread(request, story.id)).scenes[0]!.shots[0]!.sound)
    .toBe(`/api/shots/${shots[0]!.id}/sound`)
  await expect(writing(page).getByLabel('The Sound of Shot 1 of The street')).toBeVisible()
  await expect(writing(page).getByLabel('The Transcript of Shot 1 of The street')).toBeVisible()
})

/**
 * A published Story heard under a Sound, which is what every claim about the
 * reading is made against. `named` has the second Scene take its Sound from the
 * first, which is the crossing that must not restart.
 *
 * The Sound is the MP3 fixture and never one of the library's own: a Sound has to
 * be decoded by the browser the suite runs in, and the open-source Chromium
 * Playwright ships carries no AAC decoder. Both kinds are taken by the product;
 * only this one can be listened to here.
 */
async function heardStory(
  request: APIRequestContext,
  { named = false, transcript = '' } = {},
) {
  const story = await writeStory(request)
  const [street, bar] = (await reread(request, story.id)).scenes

  await request.put(`/api/scenes/${street!.id}/sound`, { data: A_SOUND })
  if (transcript) await request.patch(`/api/scenes/${street!.id}`, { data: { transcript } })
  if (named) {
    await request.patch(`/api/scenes/${bar!.id}`, { data: { soundOfSceneId: street!.id } })
  }
  await seedPublication(story)

  return story
}

/** The same Story with nothing heard under it, which is the page as it was. */
async function silentStory(request: APIRequestContext) {
  const story = await writeStory(request)
  await seedPublication(story)

  return story
}

/** How far into the bed the browser has got, which is what says it did not restart. */
function playedFor(page: Page) {
  return page.evaluate(() => {
    const bed = document.querySelector<HTMLAudioElement>('[data-sound="scene"]')

    return bed?.currentTime ?? -1
  })
}

test('the title card is what a Reader presses on a Story that carries a Sound', async ({ page, request }) => {
  const story = await heardStory(request)

  await page.goto(`/read/${story.id}`)
  // Nothing plays until the press, so the first beat is not on screen either.
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible()
  await expect(page.getByText('A door opens.')).toHaveCount(0)

  await page.getByRole('button', { name: 'Begin' }).click()
  await expect(page.getByText('A door opens.')).toBeVisible()
})

test('a silent Story keeps the page it had: nothing to press, the first Shot at load', async ({ page, request }) => {
  const story = await silentStory(request)

  await page.goto(`/read/${story.id}`)
  await expect(page.getByText('A door opens.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Begin' })).toHaveCount(0)
})

test('the Sound holds across the cut where both Scenes are heard under one carrier', async ({ page, request }) => {
  const story = await heardStory(request, { named: true })

  await page.goto(`/read/${story.id}`)
  await page.getByRole('button', { name: 'Begin' }).click()
  await expect.poll(() => playedFor(page)).toBeGreaterThan(0.2)

  const before = await playedFor(page)
  // Two Shots to a Scene in the fixture `writeStory` writes: one `Next Shot`
  // lands on the second, and a second exhausts the run and draws the Exits.
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Next Shot' }).click()
  await page.getByRole('button', { name: 'Follow her out' }).click()

  // The observable form of "it did not restart": the clock is still climbing on
  // the far side of the cut.
  await expect(page.getByText('Smoke, and no one she knows.')).toBeVisible()
  await expect.poll(() => playedFor(page)).toBeGreaterThan(before)
})

test('sound turned off stays off across a reload, and the Path is intact beside it', async ({ page, request }) => {
  const story = await heardStory(request)

  await page.goto(`/read/${story.id}`)
  await page.getByRole('button', { name: 'Begin' }).click()
  await page.getByRole('button', { name: 'Turn the Sound Off' }).click()
  await page.getByRole('button', { name: 'Next Shot' }).click()

  // Every `play()` the next page makes, with the element's own `muted` read at
  // the moment of the call. The question is whether what the Reading plays out
  // of its mount is already silent, and only the call itself can answer it: by
  // the time a test could look at the element, the watch that mutes what is
  // playing has been and gone, and a page that let a frame out and one that
  // never did read the same. Installed before the reload, so the window it
  // records is the reloaded page's alone.
  await page.addInitScript(() => {
    const played: boolean[] = []
    Object.assign(window, { played })
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      played.push(this.muted)
      return play.call(this)
    }
  })

  await page.reload()
  // Muting is a property of the person and the Path is a reading of the Story:
  // two keys, two lifetimes, and the card says which of the two it read.
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByRole('button', { name: 'Turn the Sound On' })).toBeVisible()
  await expect(page.getByText('Picked up where you left off.')).toBeVisible()

  // And the bed the press starts is muted from its own first frame. The Reader
  // turned sound off before the reload; the answer is restored in a mount
  // registered above the one the opening bed plays out of, so it is the
  // Reader's and not the default by the time anything plays.
  const played = await page.evaluate(() => (window as unknown as { played: boolean[] }).played)
  expect(played.length).toBeGreaterThan(0)
  expect(played).not.toContain(false)
})

test('turning sound back on mid-Scene does not restart the bed', async ({ page, request }) => {
  const story = await heardStory(request)

  await page.goto(`/read/${story.id}`)
  await page.getByRole('button', { name: 'Begin' }).click()
  await expect.poll(() => playedFor(page)).toBeGreaterThan(0.2)

  const before = await playedFor(page)
  await page.getByRole('button', { name: 'Turn the Sound Off' }).click()
  await page.getByRole('button', { name: 'Turn the Sound On' }).click()

  // Read at once, before the clock could climb back past `before` on its own —
  // `expect.poll` would give a restart the run of its 5s timeout to catch up and
  // hide it. Muting silences the element; it does not tear the bed down and
  // rebuild it, so the clock it had already reached is not thrown back to zero
  // the moment sound is asked for again.
  expect(await playedFor(page)).toBeGreaterThan(before - 0.05)
})

/** What the strike element is doing, to see whether muting reaches it without a beat. */
function struck(page: Page) {
  return page.evaluate(() => {
    const strike = document.querySelector<HTMLAudioElement>('[data-sound="shot"]')

    return strike && { muted: strike.muted, paused: strike.paused }
  })
}

test('muting reaches a Shot already striking, not only the next beat', async ({ page, request }) => {
  const story = await writeStory(request)
  const [street] = (await reread(request, story.id)).scenes
  // The very first Shot of the Story: the beat that plays at the press itself,
  // with no beat before it to have moved the Path the strike is watched on.
  await request.put(`/api/shots/${street!.shots[0]!.id}/sound`, { data: A_SOUND })
  await seedPublication(story)

  await page.goto(`/read/${story.id}`)
  await page.getByRole('button', { name: 'Begin' }).click()

  // Playing and heard on the opening beat itself, before anything else is
  // pressed — proving the strike fires on the transition into a drawn Path
  // and not only on a move away from it.
  await expect.poll(async () => (await struck(page))?.paused).toBe(false)
  expect((await struck(page))?.muted).toBe(false)

  await page.getByRole('button', { name: 'Turn the Sound Off' }).click()
  // Muted at the press itself, with no beat in between to key a new watch.
  await expect.poll(async () => (await struck(page))?.muted).toBe(true)
  // The same element, still running: muting is not a pause.
  expect((await struck(page))?.paused).toBe(false)
})

test('the Transcript is in the page whether it is shown or not', async ({ page, request }) => {
  const story = await heardStory(request, { transcript: 'Rain on a tin roof.' })

  await page.goto(`/read/${story.id}`)
  await page.getByRole('button', { name: 'Begin' }).click()

  // Hidden, it is `visually-hidden` and still read by a screen reader: never out
  // of the accessibility tree, and never in a live region. Read by the class
  // rather than by `toBeVisible`, which a box clipped to a pixel still satisfies
  // — the same reason the sheet's own tests read `.visually-hidden` this way.
  const said = page.getByText('Rain on a tin roof.')
  const transcript = page.locator('p.transcript', { hasText: 'Rain on a tin roof.' })
  await expect(said).toBeAttached()
  await expect(transcript).toHaveClass(/visually-hidden/)

  await page.getByRole('button', { name: 'Show the Transcript' }).click()
  await expect(transcript).not.toHaveClass(/visually-hidden/)
  await expect(said).toBeVisible()
})
