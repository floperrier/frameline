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

    // The bar has no Exit out of it, so the Reader is told the path ends there.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByRole('status')).toHaveText('The path ends here.')

    await preview.getByRole('button', { name: 'Read again from the start' }).click()
    await expect(preview.getByText('A door opens.')).toBeVisible()
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
    await preview.getByRole('button', { name: 'Move earlier the Exit to The alley' }).click()
    await expect(ways).toHaveText(['Stay outside', 'Follow her out'])

    // And it is written on the Story rather than held on the screen: the Places
    // the server hands back are the ones the Author set.
    const { exits } = await scenesOf(request, story.id)
    expect(exits.filter(exit => exit.text).map(exit => exit.text))
      .toEqual(['Stay outside', 'Follow her out'])

    // The controls stop at the ends of the list they renumber.
    await expect(preview.getByRole('button', { name: 'Move earlier the Exit to The alley' }))
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
      await bench.getByRole('button', { name: 'Draw again' }).click()
      return await played()
    }).not.toBe(first)

    await expect(preview.getByText('Shot 3 of 3')).toBeVisible()
    expect((await played()).toLowerCase()).toContain(await drawn())
  })
