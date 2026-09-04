import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { test, writeScene, writeStory } from './author'

/**
 * The Story read beside the Scene being written — see
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md`. Everything about the
 * Reading is asserted inside it rather than on the page, because the Scene being
 * written is on the same screen and says the same words: the beat in the frame is
 * the text in a field of the writing surface, and the ways on are a strip beside
 * it.
 */
function previewIn(page: Page) {
  return page.getByRole('region', { name: /^Preview/ })
}

/** What is on the bench under the reading, which no Reader is ever shown. */
function benchIn(page: Page) {
  return page.getByRole('region', { name: /On the bench/ })
}

/**
 * The Story opened with one Scene being written, which is the state the reading
 * exists in. The Scene carries its own address since `0029`, so the bench is
 * reached at it rather than pressed into it.
 */
async function writing(page: Page, storyId: string, sceneId: string) {
  await page.goto(`/stories/${storyId}?scene=${sceneId}`)

  return previewIn(page)
}

/** The Scenes of a Story, in the order the Author wrote them. */
async function scenesOf(request: APIRequestContext, storyId: string) {
  const { scenes, exits } = await (await request.get(`/api/stories/${storyId}`)).json()

  return { scenes, exits } as {
    scenes: { id: string, name: string, shots: { id: string }[] }[]
    exits: { id: string, text: string, toSceneId: string }[]
  }
}

test('an Author plays their own Story beside the Scene they are writing',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const preview = await writing(page, story.id, scenes[0]!.id)

    // One Shot at a time, and nothing to take while the Scene still has Shots.
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeHidden()
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByText('She steps out.')).toBeVisible()

    // The Exit is offered at the end of the Scene, and taking it moves the Reading.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()

    // The bar has no Exit out of it, so the Reader is told the path ends there —
    // in a live region that was in the document, empty and drawing nothing,
    // before it had anything to say: a screen reader announces the change to a
    // node it already holds, never a node arriving with its sentence inside it.
    const ending = preview.getByRole('status').and(preview.locator('.ended'))
    const region = await ending.elementHandle()
    await expect(ending).toBeEmpty()
    await expect(ending).toHaveCSS('opacity', '0')
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(ending).toHaveText('The path ends here.')
    // Same node, so the sentence was a change and not an arrival.
    expect(await ending.evaluate((el, held) => el === held, region)).toBe(true)
    // The last press took its own button away, so focus lands on the one left.
    const again = preview.getByRole('button', { name: 'Read Again from the Start' })
    await expect(again).toBeFocused()

    await again.click()
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(preview.locator('.frame')).toBeFocused()
  })

test('the reading is stopped on the Scene being written', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)

  // The bar is a Scene away from where a Reading starts, so a Path is replayed to
  // it: the Author is put in front of the beat a Reader who came that way reads,
  // not in front of the Scene played bare.
  const preview = await writing(page, story.id, scenes[1]!.id)
  await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()

  // And the State that Path accumulated came with it: the street was entered on
  // the way through, which is the whole difference between replaying and playing.
  await expect(benchIn(page).getByText('The street × 1')).toBeVisible()
})

test('a way on pressed in the reading moves the writing with it', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const preview = await writing(page, story.id, scenes[0]!.id)

  // There is one notion of where the Author is and it is the Path, so taking the
  // way on hands the writing surface the Scene it leads to — and the address
  // carrying the Scene says so too.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Follow her out' }).click()

  await expect(page.getByRole('group', { name: 'Writing The bar' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[1]!.id}`))
})

test('a card pressed in the rail routes the reading to that Scene', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const preview = await writing(page, story.id, scenes[0]!.id)

  await expect(preview.getByText('A door opens.')).toBeVisible()

  // The other half of the same cursor: the writing moved, so the reading is
  // replayed to where the writing now is.
  await writeScene(page, 'The bar')
  await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()
})

test('what an Author types reaches the reading', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const preview = await writing(page, story.id, scenes[0]!.id)

  const beat = page.locator(`#shot-${scenes[0]!.shots[0]!.id}`)
  await beat.fill('A door opens onto the rain.')
  await beat.blur()

  await expect(preview.getByText('A door opens onto the rain.')).toBeVisible()
})

test('a Scene nothing leads to says so rather than being played bare',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const attic = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The attic' },
    })).json()

    const preview = await writing(page, story.id, attic.id)

    // No Path arrives there, so there is no State to play the Scene against and
    // the pane says which Scene it could not reach rather than inventing one.
    await expect(preview.getByText('Nothing leads to The attic yet')).toBeVisible()

    // And it reads as far as it can from the opening Scene, which is still the
    // Story the Author is looking at.
    await expect(preview.getByText('A door opens.')).toBeVisible()
  })

test('a Scene nobody has written a Shot into is offered with no frame at all',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)

    // A Scene with no Shots in it, reached from the bar and leading back out, so
    // the Reading stands somewhere the frame has nothing to hold.
    const wings = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The wings' },
    })).json()
    for (const [from, to, text] of [
      [scenes[1]!.id, wings.id, 'Slip out the back'],
      [wings.id, scenes[0]!.id, 'Back to the street'],
    ] as const) {
      const exit = await (await request.post(`/api/scenes/${from}/exits`, {
        data: { toSceneId: to },
      })).json()
      await request.patch(`/api/exits/${exit.id}`, { data: { text } })
    }

    const preview = await writing(page, story.id, wings.id)

    // The way on is offered on its own: nothing stands in for a frame there is no
    // Shot for, and the beat of the Scene left behind does not follow the Reading
    // into this one.
    await expect(preview.getByRole('button', { name: 'Back to the street' })).toBeVisible()
    await expect(preview.locator('figure')).toHaveCount(0)
    await expect(preview.getByText('Smoke, and no one she knows.')).toBeHidden()
  })

test('an Exit whose Condition fails is not among the ones offered', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes, exits } = await scenesOf(request, story.id)
  const street = scenes[0]!

  // The street puts her coat on, and the way into the bar asks for it.
  await request.put(`/api/scenes/${street.id}/flags`, { data: { sets: { coat: 'on' } } })
  await request.put(`/api/exits/${exits[0]!.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'on' }] },
  })

  // A second way out of the street, asking for the coat she is wearing to be off.
  const alley = await (await request.post(`/api/stories/${story.id}/scenes`, {
    data: { name: 'The alley' },
  })).json()
  const shut = await (await request.post(`/api/scenes/${street.id}/exits`, {
    data: { toSceneId: alley.id },
  })).json()
  await request.patch(`/api/exits/${shut.id}`, { data: { text: 'Stay outside' } })
  await request.put(`/api/exits/${shut.id}/conditions`, {
    data: { conditions: [{ flag: 'coat', is: 'off' }] },
  })

  const preview = await writing(page, story.id, street.id)
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()

  // The Author is offered the one Exit whose Condition the Flags let through, and
  // is never shown the other — a failing Condition hides an Exit rather than
  // refusing it once taken.
  await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Stay outside' })).toBeHidden()
})

test('the order the ways on are offered in is set on the buttons as they are read',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const street = scenes[0]!

    // A second way out of the street, so there is an order to set at all.
    const alley = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The alley' },
    })).json()
    const out = await (await request.post(`/api/scenes/${street.id}/exits`, {
      data: { toSceneId: alley.id },
    })).json()
    await request.patch(`/api/exits/${out.id}`, { data: { text: 'Stay outside' } })

    const preview = await writing(page, story.id, street.id)
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()

    const ways = preview.locator('.exits .splice')
    await expect(ways).toHaveText(['Follow her out', 'Stay outside'])

    // The pair of controls beside each button is the order, so it is set without a
    // pointer gesture: the second way on moved earlier is the first way on.
    await preview.getByRole('button', { name: 'Move Earlier the Exit to The alley' }).click()
    await expect(ways).toHaveText(['Stay outside', 'Follow her out'])

    // And it is written on the Story rather than held on the screen: the Places
    // the server hands back are the ones the Author set.
    const { exits } = await scenesOf(request, story.id)
    expect(exits.filter(exit => exit.text).map(exit => exit.text))
      .toEqual(['Stay outside', 'Follow her out'])

    // The controls stop at the ends of the list they renumber.
    await expect(preview.getByRole('button', { name: 'Move Earlier the Exit to The alley' }))
      .toBeDisabled()
  })

test('the reading is read by keyboard, and focus goes with each beat',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const preview = await writing(page, story.id, scenes[0]!.id)

    // Every beat replaces what was on screen, the control that was pressed
    // included, so the Reading has to say where the Reader now is: on the frame
    // while a Scene is playing, and on the first Exit once it has played out.
    // Without it focus falls to the document and the next Shot is a tab from the
    // top of the page.
    const focused = () => page.evaluate(() => document.activeElement?.className ?? '')

    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect.poll(focused).toContain('frame')

    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect.poll(focused).toContain('splice')

    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect.poll(focused).toContain('frame')
  })

/**
 * A Story whose ways on ask for things: the street puts a coat on, one way out
 * wants it off, and another wants the street entered twice. Neither is offered
 * on a first reading, which is exactly the Author's question — why not. The bar
 * pours a drink and lets the Reading back out, so a second Scene sets a Flag and
 * the street can be entered twice.
 */
async function writeConditionalStory(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const [street, bar] = scenes

  await request.put(`/api/scenes/${street!.id}/flags`, { data: { sets: { coat: 'on' } } })
  await request.put(`/api/scenes/${bar!.id}/flags`, { data: { sets: { drink: 'whisky' } } })

  const back = await (await request.post(`/api/scenes/${bar!.id}/exits`, {
    data: { toSceneId: street!.id },
  })).json()
  await request.patch(`/api/exits/${back.id}`, { data: { text: 'Back out' } })

  for (const [name, text, conditions] of [
    ['The alley', 'Stay outside', [{ flag: 'coat', is: 'off' }]],
    ['The stairs', 'Go up', [{ scene: street!.id, visits: 'at least', times: 2 }]],
  ] as const) {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json()
    const exit = await (await request.post(`/api/scenes/${street!.id}/exits`, {
      data: { toSceneId: scene.id },
    })).json()
    await request.patch(`/api/exits/${exit.id}`, { data: { text } })
    await request.put(`/api/exits/${exit.id}/conditions`, { data: { conditions } })
  }

  return { story, street: street!.id }
}

/**
 * From the ways on out of the street, round through the bar and back to them —
 * so the street has been entered twice and the same ways on are asked again.
 */
async function roundTheBlock(preview: Locator) {
  await preview.getByRole('button', { name: 'Follow her out' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Back out' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
}

test('the reading shows the Author the State it has accumulated', async ({ page, request }) => {
  const { story, street } = await writeConditionalStory(request)

  const preview = await writing(page, story.id, street)
  const bench = benchIn(page)

  // On the very first Shot, before the Scene has played out: what the street set
  // on entry, and the visit it was entered on.
  await expect(bench.getByText('coat = on')).toBeVisible()
  await expect(bench.getByText('The street × 1')).toBeVisible()

  // Nothing the Reading has not touched is listed — the alley is a Scene of this
  // Story, and no Reading has been in it.
  await expect(bench.getByText('The alley')).toBeHidden()

  // The bar pours a drink on entry, which arrives on the bench as the Scene is
  // arrived at — and the coat the street put on outlives the Scene that set it.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Follow her out' }).click()
  await expect(bench.getByText('drink = whisky')).toBeVisible()
  await expect(bench.getByText('The bar × 1')).toBeVisible()
  await expect(bench.getByText('coat = on')).toBeVisible()

  // Back where it started, and the count says so: a Scene entered twice is a
  // Scene the bench counts twice.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Back out' }).click()
  await expect(bench.getByText('The street × 2')).toBeVisible()
})

test('the reading says why a way on is missing, and does not offer it',
  async ({ page, request }) => {
    const { story, street } = await writeConditionalStory(request)

    const preview = await writing(page, story.id, street)
    const bench = benchIn(page)

    // While a Shot is playing there are no ways on to explain: the Scene has not
    // asked anything yet.
    await expect(bench.getByText('Ways on this Reading is not offered')).toBeHidden()

    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()

    // The way on that holds is offered as a control, and the two the State hides
    // are on the bench instead, struck through and each naming the test it failed
    // with both values — a Flag holding something else, and a Scene not entered
    // often enough yet.
    await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(bench.locator('s').filter({ hasText: 'Stay outside' })).toBeVisible()
    await expect(bench.getByText('needs coat to hold off, holds on')).toBeVisible()
    await expect(bench.getByText('needs at least 2 visits to The street, entered once'))
      .toBeVisible()

    // A hidden way on is text on a bench and nothing more: no control, and so no
    // keyboard path that could take it and no Place to move it from.
    await expect(preview.getByRole('button', { name: 'Stay outside' })).toHaveCount(0)
    await expect(preview.getByRole('button', { name: 'Go up' })).toHaveCount(0)

    // Round the block and back: the visit count the stairs asked for now holds, so
    // the way on the bench was explaining is a control the Author can take, and the
    // bench has one fewer to explain.
    await roundTheBlock(preview)
    await expect(preview.getByRole('button', { name: 'Go up' })).toBeVisible()
    await expect(bench.getByText('needs at least 2 visits')).toBeHidden()
    await expect(bench.getByText('needs coat to hold off, holds on')).toBeVisible()
  })

test('a Reader of the published Story is shown none of the bench',
  async ({ request, browser, baseURL }) => {
    const { story } = await writeConditionalStory(request)
    await request.post(`/api/stories/${story.id}/publish`)

    const reader = await (await browser.newContext()).newPage()
    await reader.goto(`${baseURL}/read/${story.id}`)

    // The same engine, the same Shots, the same one way on — and not a word about
    // the State behind them, the ways on it is hiding, or the order they are
    // offered in.
    await expect(reader.getByText('A door opens.')).toBeVisible()
    await reader.getByRole('button', { name: 'Next Shot' }).click()
    await reader.getByRole('button', { name: 'Next Shot' }).click()
    await expect(reader.getByRole('button', { name: 'Follow her out' })).toBeVisible()

    await expect(reader.getByRole('region', { name: /On the bench/ })).toHaveCount(0)
    await expect(reader.locator('s')).toHaveCount(0)
    await expect(reader.getByText('coat')).toHaveCount(0)
    await expect(reader.getByText('Stay outside')).toHaveCount(0)
    await expect(reader.getByRole('button', { name: /^Move / })).toHaveCount(0)
  })

test('a Scene says something different on a return visit', async ({ page, request }) => {
  const { story, street } = await writeConditionalStory(request)

  // A third Shot in the street, played only once it has been entered twice — the
  // line the Author used to need a second Scene to hold.
  const again = await (await request.post(`/api/scenes/${street}/shots`)).json()
  await request.patch(`/api/shots/${again.id}`, {
    data: { text: 'The same door, again.', description: '' },
  })
  await request.put(`/api/shots/${again.id}/conditions`, {
    data: { conditions: [{ scene: street, visits: 'at least', times: 2 }] },
  })

  const preview = await writing(page, story.id, street)
  const bench = benchIn(page)

  // First time through, the street is the two Shots it always was: the run is
  // counted without the Shot this Reading is not being played, and the bench
  // says which one that is and why.
  await expect(preview.getByText('Shot 1 of 2')).toBeVisible()
  await expect(bench.locator('s').filter({ hasText: 'The same door, again.' })).toBeVisible()
  await expect(bench.getByText('needs at least 2 visits to The street, entered once'))
    .toBeVisible()

  // The bench names the beat, but the frame never plays it: the Scene runs
  // straight from the second Shot to the ways on.
  const frame = preview.locator('figure')
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await expect(frame.getByText('She steps out.')).toBeVisible()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await expect(frame.getByText('The same door, again.')).toBeHidden()
  await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeVisible()

  // Round the block and back, and the Scene plays the extra beat: three Shots
  // where there were two, and nothing left on the bench to explain.
  await roundTheBlock(preview)
  await expect(preview.getByText('Shot 3 of 3')).toBeVisible()
  await expect(frame.getByText('The same door, again.')).toBeVisible()
  await expect(bench.getByText('Shots this Reading is not played')).toBeHidden()
})

test('a Scene draws one of several values, and the Author draws it again',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const street = scenes[0]!

    // The street's weather is drawn from three values, and a third beat is
    // written three times over, each variant playing under one of them.
    await request.put(`/api/scenes/${street.id}/flags`, {
      data: { sets: { weather: ['rain', 'sun', 'haze'] } },
    })
    for (const [value, text] of [
      ['rain', 'Rain on the awning.'],
      ['sun', 'Sun on the awning.'],
      ['haze', 'Haze over the street.'],
    ] as const) {
      const shot = await (await request.post(`/api/scenes/${street.id}/shots`)).json()
      await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
      await request.put(`/api/shots/${shot.id}/conditions`, {
        data: { conditions: [{ flag: 'weather', is: value }] },
      })
    }

    const preview = await writing(page, story.id, street.id)
    const bench = benchIn(page)
    const frame = preview.locator('figure')

    // The value drawn is on the bench beside the rest of the State, which is what
    // tells a variant that was not drawn from one whose Condition is wrong.
    await expect(bench.getByText(/weather = (rain|sun|haze)/)).toBeVisible()

    // The Scene is three beats long, not five: the two variants that were not
    // drawn are out of the run rather than gaps in it.
    await expect(preview.getByText('Shot 1 of 3')).toBeVisible()
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()

    /** The weather the frame is showing, and the weather the bench says was drawn. */
    const played = () => frame.locator('.shot').innerText()
    const drawn = async () =>
      ((await bench.getByText(/weather = /).innerText()).match(/rain|sun|haze/) ?? [])[0]

    const first = await played()
    expect(first).toMatch(/Rain on the awning\.|Sun on the awning\.|Haze over the street\./)
    expect(first.toLowerCase()).toContain(await drawn())

    // Drawing again keeps the Path — still the third beat of a three-beat
    // Scene — and only the draw changes, until a variant the Author has not seen
    // comes up. A press that draws the same value again is not a failure, so the
    // button is pressed until it differs rather than once.
    await expect.poll(async () => {
      await bench.getByRole('button', { name: 'Draw Again' }).click()
      return await played()
    }).not.toBe(first)

    await expect(preview.getByText('Shot 3 of 3')).toBeVisible()
    expect((await played()).toLowerCase()).toContain(await drawn())
  })

/**
 * The bench cannot hold the rail, a Scene and the reading at once below a
 * certain width, and between that width and the phone it used to draw all three
 * anyway — at widths none of them worked at. The reading folds away there and is
 * offered back by a control; the width is read off the writing column and is
 * written once, in `app/assets/css/folds.css`. See
 * `docs/adr/0037-the-reading-folds-before-the-writing-does.md`.
 */
const TWO_COLUMNS = { width: 1024, height: 800 }

/** Wide enough for the rail, the Scene and the reading side by side. */
const THREE_COLUMNS = { width: 1400, height: 800 }

/**
 * Whether the marks a beat is moved and deleted by share the line with the
 * control that puts a Condition on it. They are laid out to, and the first thing
 * a writing column too narrow to write in does is drop them onto a second line:
 * this is the row the fold's width was read off.
 */
async function beatReadsAcrossOneLine(page: Page, said: {
  condition: string
  mark: string
}) {
  await drawn(page)
  const conditions = await page.getByRole('button', { name: said.condition }).boundingBox()
  const marks = await page.getByRole('button', { name: said.mark }).boundingBox()

  return Math.abs(conditions!.y - marks!.y) < conditions!.height
}

/**
 * Waits for the faces the interface is set in. Both rows above are measurements
 * of rendered text, and a row read while the fallback face is still on screen is
 * a measurement of the wrong font: the interface's own is narrower, so the answer
 * flips as the swap lands.
 */
function drawn(page: Page) {
  return page.evaluate(() => document.fonts.ready.then(() => undefined))
}

/** The two controls that row is measured across, as this suite reads them. */
const IN_ENGLISH = { condition: 'Add a Condition to Shot 1 of The street', mark: 'Move Later Shot 1' }
const IN_FRENCH = { condition: 'Ajouter une Condition à Plan 1 de The street', mark: 'Déplacer après Plan 1' }

/**
 * Whether a Flag's row holds both of its values on one line. The second row the
 * fold's width was read off: a column too narrow breaks it after a dangling *or*
 * and drops the second value onto the next line. It is the looser of the two, so
 * a width the beat's row survives this one survives with room to spare — which
 * is the fact worth holding, because it is the pair that settled the number.
 */
async function flagReadsAcrossOneLine(page: Page) {
  await drawn(page)

  return await page.locator('.sets').first().evaluate((row) => {
    const parts = [...row.children] as HTMLElement[]

    return parts.at(-1)!.getBoundingClientRect().top
      <= parts[0]!.getBoundingClientRect().top + 2
  })
}

test('the reading folds away where the bench cannot hold three columns',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)

    await page.setViewportSize(THREE_COLUMNS)
    const preview = await writing(page, story.id, scenes[0]!.id)

    // Three columns: the reading stands beside the Scene, and there is nothing to
    // choose between, so the control that chooses is not drawn.
    await expect(preview).toBeVisible()
    await expect(page.getByRole('button', { name: 'Read the Story' })).toBeHidden()
    expect(await beatReadsAcrossOneLine(page, IN_ENGLISH)).toBe(true)

    // Narrowed into the band, the reading goes and the Scene keeps a column it can
    // still be written in — which is the whole of what the fold buys.
    await page.setViewportSize(TWO_COLUMNS)
    await expect(preview).toBeHidden()
    expect(await beatReadsAcrossOneLine(page, IN_ENGLISH)).toBe(true)

    // And it is a fold rather than an absence: the reading comes back in the
    // column the Scene was in, and the same control hands the Scene back.
    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(preview).toBeVisible()
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeHidden()

    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeVisible()
    await expect(preview).toBeHidden()

    // Widened again, both are on the bench whatever was last chosen in the band.
    await page.setViewportSize(THREE_COLUMNS)
    await expect(preview).toBeVisible()

    // And a Scene opened for writing opens on the Scene, whatever the reading was
    // last asked for: the focus the bench sends into the Scene's name has to land
    // somewhere that is drawn.
    await page.setViewportSize(TWO_COLUMNS)
    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(preview).toBeVisible()
    // The way out of the writing is on the surface being written, so leaving it
    // from the reading is two presses: back to the Scene, then close it.
    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await page.getByRole('button', { name: 'Close this Panel' }).click()
    await page.getByRole('button', { name: 'Write Scene The street' }).click()
    await expect(page.getByRole('textbox', { name: 'Name of this Scene' })).toBeFocused()
    await expect(preview).toBeHidden()
  })

/**
 * The width itself, held at both edges of the band in the language it was read
 * off. The number is a measurement of two rows of the document — a beat's marks
 * beside the control that puts a Condition on it, and a Flag's two values — and a
 * measurement nothing holds is a number that drifts. French, because it is the
 * longer of the two languages and therefore the one the rows wrap in first.
 *
 * Both edges, because either alone leaves the number free: at the band's own
 * width the bench must be folded, and one pixel above it the Preview must stand
 * beside a Scene whose two rows each still read across one line. A threshold
 * moved either way fails one of the two.
 */
test.describe('the width the reading folds at', () => {
  test.use({ locale: 'fr-FR' })

  /** The band's upper edge, which is 78rem, and the first width above it. */
  const FOLDED = { width: 1248, height: 800 }
  const BESIDE = { width: 1249, height: 800 }

  test('is the narrowest at which the Scene beside it still reads across one line',
    async ({ page, request }) => {
      const story = await writeStory(request, 'fr')
      const { scenes } = await scenesOf(request, story.id)
      // Two Flags of two values apiece, which is what makes a Flags row a row
      // rather than a pair of fields.
      await request.put(`/api/scenes/${scenes[0]!.id}/flags`, {
        data: { sets: { manteau: ['mis', 'ôté'], temps: ['pluie', 'soleil'] } },
      })

      await page.setViewportSize(FOLDED)
      await page.goto(`/fr/stories/${story.id}?scene=${scenes[0]!.id}`)
      await expect(page.getByRole('textbox', { name: 'Nom de cette Scène' })).toBeVisible()

      // At the band's own width the bench holds two columns, so the Scene has the
      // whole of the width the Preview would have shared.
      await expect(page.getByRole('region', { name: /^Aperçu/ })).toBeHidden()
      await expect(page.getByRole('button', { name: 'Lire le Récit' })).toBeVisible()

      // One pixel wider, all three stand, and both rows of the document still
      // read across one line each in the column that leaves. This is the
      // measurement: a threshold any lower and the beat's marks wrap here.
      await page.setViewportSize(BESIDE)
      await expect(page.getByRole('region', { name: /^Aperçu/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Lire le Récit' })).toBeHidden()
      expect(await beatReadsAcrossOneLine(page, IN_FRENCH)).toBe(true)
      expect(await flagReadsAcrossOneLine(page)).toBe(true)
    })
})

test('the fold is an act of the bench, named in the bar where the bench offers it',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)

    await page.setViewportSize(TWO_COLUMNS)
    const preview = await writing(page, story.id, scenes[0]!.id)

    /** What the bar is offering under a name, which is the bar's own list. */
    const named = async (name: string) => {
      await page.getByRole('button', { name: 'Commands' }).click()
      await expect(page.getByRole('textbox', { name: 'Type a name' })).toBeFocused()
      await page.getByRole('textbox', { name: 'Type a name' }).fill(name)

      return page.locator('dialog.commands li button')
    }

    await (await named('Read the Story')).first().click()
    await expect(preview).toBeVisible()

    // Above the band the bench draws no such control, and the bar offers nothing
    // the bench does not: an act that would do nothing is not on the list, and
    // what stands under the name instead is the offer to write a Scene under it.
    await page.setViewportSize(THREE_COLUMNS)
    await expect(await named('Write the Scene'))
      .toHaveText(['Write a Scene named Write the Scene'])
  })

test('the bench takes the height the window leaves it', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)

  // A window in the band, a tall one, and a phone — where the writing surface is
  // the page and the bench beneath it is the rail alone.
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    await writing(page, story.id, scenes[0]!.id)
    await expect(page.locator('.folded.bench')).toBeVisible()

    const read = await page.evaluate(() => {
      const bench = document.querySelector('.folded.bench')!.getBoundingClientRect()
      const panel = document.querySelector('.panel')!

      return {
        scrolls: document.documentElement.scrollHeight > innerHeight,
        // What the bench leaves unused between its own foot and the page's.
        below: Math.round(innerHeight - bench.bottom),
        // The writing surface is only a column of the bench where it is not the
        // whole page, which is what the phone makes it.
        column: getComputedStyle(panel).position !== 'fixed',
        panel: Math.round(panel.getBoundingClientRect().height),
        bench: Math.round(bench.height),
      }
    })

    // Nothing to scroll at all: the bench ends where the page does, bar the
    // page's own margin, and a Scene longer than the bench scrolls inside its own
    // column rather than down the page.
    expect(read.scrolls).toBe(false)
    expect(read.below).toBeLessThanOrEqual(32)
    if (read.column) expect(read.panel).toBe(read.bench)
  }
})
