import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { readTheStory, sceneNode, test, writeStory } from './author'

/**
 * The Story read where it is written: the other face of the gate the Scene is
 * written in, in the same box in the same place on the Graph — see
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md` and
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md`. Everything about the
 * Reading is asserted inside it rather than on the page, because the Scene being
 * written says the same words on the other face.
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

  return await readTheStory(page)
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
  // way on hands the writing the Scene it leads to — and the address carrying the
  // Scene says so too. The face stays as it was: taking a way on is reading on,
  // and the Scene is there on the other face of the gate when the Author turns
  // back to it.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Follow her out' }).click()

  await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`scene=${scenes[1]!.id}`))

  await page.getByRole('button', { name: 'Write the Scene' }).click()
  await expect(page.getByRole('group', { name: 'Writing The bar' })).toBeVisible()
})

test('a mark pressed on the rail routes the reading to that Scene', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const preview = await writing(page, story.id, scenes[0]!.id)

  await expect(preview.getByText('A door opens.')).toBeVisible()

  // The other half of the same cursor: the writing moved, so the reading is
  // replayed to where the writing now is. The rail does not move between the
  // readings and neither does the reading that is up — a mark pressed while the
  // Story is being read is the Author reading on, not asking to write. See
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  await sceneNode(page, 'The bar').click()
  await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()
})

test('what an Author types reaches the reading', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)

  // Typed on the face a Scene is written on, and read on the other one: the two
  // are the same box on the table — see
  // `docs/adr/0042-the-scene-is-written-where-it-stands.md`.
  const beat = page.locator(`#shot-${scenes[0]!.shots[0]!.id}`)
  await beat.fill('A door opens onto the rain.')
  await beat.blur()

  const preview = await readTheStory(page)
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
    const [street, bar] = scenes
    const preview = await writing(page, story.id, street!.id)

    // Every beat replaces what was on screen, the control that was pressed
    // included, so the Reading has to say where the Reader now is: on the frame
    // while a Scene is playing, and on the first Exit once it has played out.
    // Without it focus falls to the document and the next Shot is a tab from the
    // top of the page.
    //
    // The move is the one call at the foot of `moveTo` in
    // `app/components/Reading.vue`, made on the tick the beat is drawn on, so a
    // beat this can see is a beat focus has already been moved for: waiting for
    // the beat is waiting for the move, and there is nothing left to poll for. A
    // poll would also pass on the instant focus passed through the frame and say
    // nothing about where it was left, which is the whole of what a Reader
    // tabbing on has.
    //
    // What holds focus is named, and named inside the reading, rather than
    // matched by a word in a class: `frame` is a substring of the `frames` a
    // Story's header draws, and an assertion that would survive focus landing
    // there is not an assertion about this Reading.
    const holds = (what: Locator) => what.evaluate(el => el === document.activeElement)

    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.locator('.frame .shot')).toHaveText('She steps out.')
    expect(await holds(preview.locator('.frame'))).toBe(true)

    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    expect(await holds(preview.locator('.exits .splice').first())).toBe(true)

    // Taking the way on moves the writing to the Scene it lands in as well, and
    // that move is the page's rather than the Reading's. Waited for too, so what
    // is asserted is where the two of them leave focus and not where it stood
    // between them.
    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect(page).toHaveURL(new RegExp(`scene=${bar!.id}`))
    await expect(preview.locator('.frame .shot')).toHaveText('Smoke, and no one she knows.')
    expect(await holds(preview.locator('.frame'))).toBe(true)
  })

test('reading again is offered only once the Reading has moved',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const street = scenes[0]!

    // The street draws its weather, which is the whole of what the bench's one
    // control changes — and the only way an Author redraws the opening frame now
    // that the reading itself does not offer one.
    await request.put(`/api/scenes/${street.id}/flags`, {
      data: { sets: { weather: ['rain', 'sun'] } },
    })

    const preview = await writing(page, story.id, street.id)
    const bench = benchIn(page)
    const again = preview.getByRole('button', { name: 'Read Again from the Start' })
    const next = preview.getByRole('button', { name: 'Next Shot' })

    // Nothing has been read, so there is nothing to read again and the offer is
    // out of the document rather than sitting under the first frame drawing it
    // over. Out of the tab order with it: the beat the Reader lands on leads to
    // the one control the Reading has, and from there straight out to the bench.
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(again).toHaveCount(0)
    await next.focus()
    await page.keyboard.press('Tab')
    await expect(bench.getByRole('button', { name: 'Draw Again' })).toBeFocused()

    // The draw an Author wanted the first frame redrawn for still redraws it,
    // with the offer absent: a reroll is another seed and not a move, so what it
    // leaves behind is the same first beat and the same tab order.
    const drawn = async () =>
      ((await bench.getByText(/weather = /).innerText()).match(/rain|sun/) ?? [])[0]
    const first = await drawn()
    await expect.poll(async () => {
      await bench.getByRole('button', { name: 'Draw Again' }).click()
      return await drawn()
    }).not.toBe(first)
    await expect(preview.getByText('Shot 1 of 2')).toBeVisible()
    await expect(again).toBeHidden()

    // One press, and there is a Reading to go back to the start of: the offer
    // arrives, and arrives after the control that is still the next thing to do,
    // so a Reader tabbing on meets the beat before the way out of it.
    await next.click()
    await expect(preview.getByText('She steps out.')).toBeVisible()
    await expect(again).toBeVisible()
    await next.focus()
    await page.keyboard.press('Tab')
    await expect(again).toBeFocused()

    // And taken back to the start it is gone again, until the Reading moves once
    // more: what the offer says about the Reading is read off the Reading.
    await again.click()
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(again).toHaveCount(0)
    await next.click()
    await expect(again).toBeVisible()
  })

test('a Story that ends where it opens offers reading it again with the ending',
  async ({ page, request }) => {
    const story = await (await request.post('/api/stories', {
      data: { title: 'A Story of one beat', language: 'en' },
    })).json()
    const street = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The street' },
    })).json()
    const shot = await (await request.post(`/api/scenes/${street.id}/shots`)).json()
    await request.patch(`/api/shots/${shot.id}`, {
      data: { text: 'A door opens.', description: '' },
    })

    const preview = await writing(page, story.id, street.id)
    const again = preview.getByRole('button', { name: 'Read Again from the Start' })

    // One Shot and no way out, so the first press is the whole Story: the offer
    // is not there to be pressed before it and is there the moment the path ends,
    // taking the focus the press took away with its own button — #221 unchanged
    // on the Story that reaches the ending soonest.
    await expect(again).toHaveCount(0)
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByRole('status').and(preview.locator('.ended')))
      .toHaveText('The path ends here.')
    await expect(again).toBeVisible()
    await expect(again).toBeFocused()
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

    // While a Shot is playing there are no Exits to explain: the Scene has not
    // asked anything yet.
    await expect(bench.getByText('Exits this Reading is not offered')).toBeHidden()

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

test('the reading takes the document’s place, at every width', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)

  // A wide window, one inside the fold that sends what the bench says beside the
  // document to the head of it, and a phone. There is no width at which the
  // writing and the reading stand side by side and none at which either is
  // unreachable: the middle of the bench is one reading at a time and a control
  // chooses which — see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`, which supersedes the
  // *beside* of `0030` and keeps its engine rule.
  for (const size of [
    { width: 1600, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)

    const named = page.getByRole('textbox', { name: 'Name of The street' })
    const preview = previewIn(page)
    const boxes = async () => ({
      document: (await page.locator('.document').boundingBox())!,
      rail: (await page.locator('.rail').boundingBox())!,
      // `aside.said` and not `.said`: what a Reader presses to take a way on is
      // said too, on a row of the document.
      said: (await page.locator('aside.said').boundingBox())!,
    })

    // The writing is the reading that is up, and the control that turns the
    // middle over says what pressing it does.
    await expect(named).toBeVisible()
    await expect(preview).toBeHidden()

    const before = await boxes()

    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(preview).toBeVisible()
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(named).toBeHidden()

    // What changes is what the middle is a reading of, never where anything is:
    // the rail and the Remarks do not move, the document keeps the box it had,
    // and the Preview is inside it rather than beside it.
    expect(await boxes()).toEqual(before)
    const turned = (await page.locator('.preview').boundingBox())!
    expect(turned.x).toBeGreaterThanOrEqual(before.document.x)
    expect(turned.x + turned.width).toBeLessThanOrEqual(before.document.x + before.document.width)

    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await expect(named).toBeVisible()
    await expect(preview).toBeHidden()
  }
})

test('turning the gate over is an act of the bench, named in the bar', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)

  await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)

  /** What the bar is offering under a name, which is the bar's own list. */
  const named = async (name: string) => {
    await page.getByRole('button', { name: 'Commands' }).click()
    await expect(page.getByRole('textbox', { name: 'Type a name' })).toBeFocused()
    await page.getByRole('textbox', { name: 'Type a name' }).fill(name)

    return page.locator('dialog.commands li button')
  }

  await (await named('Read the Story')).first().click()
  await expect(previewIn(page)).toBeVisible()

  // And the bar names it for what pressing it will do from the face that is up,
  // the way it names Publish and Unpublish on the one fact.
  await (await named('Write the Scene')).first().click()
  await expect(page.getByRole('textbox', { name: 'Name of The street' })).toBeVisible()
})

test('the bench takes the room the window leaves it', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)

  // A wide window, one inside the fold where what the bench says beside the
  // document goes to the head of it, and a phone — where the rail narrows to a
  // strip of dots. Three regions that never trade width at any of them, and no
  // fold that hides anything: see
  // `docs/adr/0043-a-story-is-written-as-one-document.md`.
  for (const size of [
    { width: 1600, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
    await expect(page.locator('.writing')).toBeVisible()

    const read = await page.evaluate(() => {
      const bench = document.querySelector('main > .bench')!.getBoundingClientRect()

      return {
        scrolls: document.documentElement.scrollHeight > innerHeight,
        // What the bench leaves unused between its own foot and the page's.
        below: Math.round(innerHeight - bench.bottom),
      }
    })

    // Nothing to scroll at all: the bench ends where the page does, and a Story
    // longer than the window scrolls inside the document — the one scroller on
    // the bench — rather than down the page.
    expect(read.scrolls).toBe(false)
    expect(read.below).toBeLessThanOrEqual(1)
  }
})

test('a refusal from the reading is said, whatever the writing was refused before it',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const street = scenes[0]!
    const alley = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The alley' },
    })).json() as { id: string }
    const out = await (await request.post(`/api/scenes/${street.id}/exits`, {
      data: { toSceneId: alley.id },
    })).json() as { id: string }

    await page.goto(`/stories/${story.id}?scene=${street.id}`)

    // A write refused in a Scene's own section, which is where that sentence
    // belongs: the Scene claims the one refusal the page holds. The field is found
    // on the slate rather than by its label, which says the name it is about to
    // stop holding.
    const named = page.locator(`.writing [data-scene="${street.id}"] .named input`)
    await named.fill('  ')
    await named.blur()
    await expect(page.getByRole('alert')).toHaveText('A Scene needs a name.')

    // The reading takes the document's place, so the Scene that claimed the last
    // sentence is not on screen to say the next one. What the reading is refused
    // is about the Story and belongs under the Story's own edge, which is where
    // the page draws what no Scene has claimed.
    const preview = await readTheStory(page)
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()

    // Renumbering a list the Story no longer holds, which is what an Exit taken
    // away behind the page's back leaves the reading holding.
    await request.delete(`/api/exits/${out.id}`)
    await preview.getByRole('button', { name: 'Move Earlier the Exit to The alley' }).click()

    await expect(page.locator('main > [role="alert"]'))
      .toHaveText(/renumbered all at once/)
  })
