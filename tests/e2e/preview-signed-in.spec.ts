import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import type { Condition } from '../../shared/utils/scenes'
import {
  live, readShotConditions, readTheStory, sceneNode, seedPublication, seedScenes, seedStory,
  test, writeStory,
} from './author'

/**
 * The Story read where it is written: the reading the middle of the bench holds
 * when the Author asks for it, in the document's own place — see
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md`, whose engine rule
 * `docs/adr/0043-a-story-is-written-as-one-document.md` keeps and whose *beside*
 * it supersedes. Everything about the Reading is asserted inside it rather than
 * on the page, because the writing says the same words in its own section of the
 * document.
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
  await expect.poll(() => benchIn(page).locator('.entered li').allTextContents())
    .toEqual(['The street', 'The bar'])
})

test('a way on pressed in the reading moves the writing with it', async ({ page, request }) => {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const preview = await writing(page, story.id, scenes[0]!.id)

  // There is one notion of where the Author is and it is the Path, so taking the
  // way on hands the writing the Scene it leads to — and the address carrying the
  // Scene says so too. The reading stays the reading on screen: taking a way on is
  // reading on, and the Scene is written where it stood when the Author turns the
  // middle back to the writing.
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

    // A Scene with no Shots in it, reached from the bar and leading on out of it,
    // so the Reading stands somewhere the frame has nothing to hold and is still
    // offered a way on.
    const wings = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The wings' },
    })).json()
    const alley = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name: 'The alley' },
    })).json()
    for (const [from, to, text] of [
      [scenes[1]!.id, wings.id, 'Slip out the back'],
      [wings.id, alley.id, 'Out to the alley'],
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
    await expect(preview.getByRole('button', { name: 'Out to the alley' })).toBeVisible()
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
    // pointer gesture: the second way on moved earlier is the first way on. Each
    // mark is named by the Place of the row it renumbers, the way the same mark is
    // in the writing, so the two rows are told apart where both lead to one Scene.
    await preview.getByRole('button', {
      name: 'Move Earlier the Exit 2 to The alley, out of The street',
    }).click()
    await expect(ways).toHaveText(['Stay outside', 'Follow her out'])

    // And it is written on the Story rather than held on the screen: the Places
    // the server hands back are the ones the Author set.
    const { exits } = await scenesOf(request, story.id)
    expect(exits.filter(exit => exit.text).map(exit => exit.text))
      .toEqual(['Stay outside', 'Follow her out'])

    // The controls stop at the ends of the list they renumber — and the mark the
    // Author just pressed answers to the Place it moved the row to.
    await expect(preview.getByRole('button', {
      name: 'Move Earlier the Exit 1 to The alley, out of The street',
    })).toBeDisabled()
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

test('stepping back and reading again are offered only once the Reading has moved',
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
    const back = preview.getByRole('button', { name: 'Step Back' })
    const next = preview.getByRole('button', { name: 'Next Shot' })

    // Nothing has been read, so there is no beat behind and nothing to read
    // again: both offers are out of the document rather than sitting under the
    // first frame drawing it over. Out of the tab order with them: the beat the
    // Reader lands on leads to the one control the Reading has, and from there
    // straight out to the bench.
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(again).toHaveCount(0)
    await expect(back).toHaveCount(0)
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

    // One press, and there is a beat behind and a Reading to go back to the start
    // of: both offers arrive, and arrive after the control that is still the next
    // thing to do — so a Reader tabbing on meets the beat, then the beat behind
    // it, then the way out of the whole Reading.
    await next.click()
    await expect(preview.getByText('She steps out.')).toBeVisible()
    await expect(again).toBeVisible()
    await next.focus()
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(again).toBeFocused()

    // The step back is the Author's too, and it is a move like any other: one
    // beat back is the first beat again, under the seed they have been reading
    // by, and both offers go with the Reading that has stopped having moved.
    await back.click()
    await expect(preview.getByText('A door opens.')).toBeVisible()
    await expect(back).toHaveCount(0)
    await expect(again).toHaveCount(0)
    await next.click()
    await expect(preview.getByText('She steps out.')).toBeVisible()

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
 * wants it off, and the way up out of the bar wants the Reader to have come
 * through the yard. Neither is offered to a Reading that walks straight in, which
 * is exactly the Author's question — why not. The yard is the other way into the
 * bar, so the second of the two opens for a Reading that goes round by it.
 *
 * Two ways round rather than one Scene entered twice: a Reading stands in a Scene
 * at most once, so what makes a Condition about a Scene turn over is which way the
 * Reader came — see `docs/adr/0048-a-scene-is-entered-once.md`.
 */
async function writeConditionalStory(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  const [street, bar] = scenes

  await request.put(`/api/scenes/${street!.id}/flags`, { data: { sets: { coat: 'on' } } })
  await request.put(`/api/scenes/${bar!.id}/flags`, { data: { sets: { drink: 'whisky' } } })

  /** A Scene written at the far end of a phrased Exit out of one the Story holds. */
  const wayOn = async (from: string, name: string, text: string, conditions: Condition[] = []) => {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json() as { id: string }
    const exit = await (await request.post(`/api/scenes/${from}/exits`, {
      data: { toSceneId: scene.id },
    })).json() as { id: string }
    await request.patch(`/api/exits/${exit.id}`, { data: { text } })
    if (conditions.length) {
      await request.put(`/api/exits/${exit.id}/conditions`, { data: { conditions } })
    }

    return scene
  }

  const alley = await wayOn(street!.id, 'The alley', 'Stay outside', [{ flag: 'coat', is: 'off' }])
  const yard = await wayOn(street!.id, 'The yard', 'Round the back')
  // The other way into the bar, which is what the way up out of it asks for.
  const inTheBack = await (await request.post(`/api/scenes/${yard.id}/exits`, {
    data: { toSceneId: bar!.id },
  })).json() as { id: string }
  await request.patch(`/api/exits/${inTheBack.id}`, { data: { text: 'In through the back' } })
  await wayOn(bar!.id, 'The stairs', 'Go up', [{ scene: yard.id, entered: true }])

  return { story, street: street!.id, bar: bar!.id, alley: alley.id, yard: yard.id }
}

/**
 * Out of the bar by the door the Reading came in through, and into it again by the
 * yard — so the same Scene is arrived at the other way, holding what that way set.
 *
 * A step back is a shorter Path and not a second arrival, which is what lets one
 * Reading try both ways round: the bar stepped out of was never entered twice, and
 * the arrival by the yard is the only one this Reading has.
 */
async function backAndRoundTheYard(preview: Locator) {
  await preview.getByRole('button', { name: 'Step Back' }).click()
  await preview.getByRole('button', { name: 'Step Back' }).click()
  await preview.getByRole('button', { name: 'Round the back' }).click()
  await preview.getByRole('button', { name: 'In through the back' }).click()
}

test('the reading shows the Author the State it has accumulated', async ({ page, request }) => {
  const { story, street } = await writeConditionalStory(request)

  const preview = await writing(page, story.id, street)
  const bench = benchIn(page)
  /** The Scenes this Reading has entered, as the bench lists them. */
  const entered = () => bench.locator('.entered li').allTextContents()

  // On the very first Shot, before the Scene has played out: what the street set
  // on entry, and the Scene it is standing in. Named and not counted — a Reading
  // stands in a Scene at most once, so there is nothing to count.
  await expect(bench.getByText('coat = on')).toBeVisible()
  await expect.poll(entered).toEqual(['The street'])

  // Nothing the Reading has not touched is listed — the alley is a Scene of this
  // Story, and no Reading has been in it.
  await expect(bench.getByText('The alley')).toBeHidden()

  // The bar pours a drink on entry, which arrives on the bench as the Scene is
  // arrived at — and the coat the street put on outlives the Scene that set it.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Follow her out' }).click()
  await expect(bench.getByText('drink = whisky')).toBeVisible()
  await expect(bench.getByText('coat = on')).toBeVisible()
  await expect.poll(entered).toEqual(['The street', 'The bar'])

  // And the list is the Path and nothing else: stepping back out of the bar takes
  // it off again, because a shorter Path is a Reading that never went in.
  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await preview.getByRole('button', { name: 'Step Back' }).click()
  await preview.getByRole('button', { name: 'Step Back' }).click()
  await expect.poll(entered).toEqual(['The street'])
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

    // The ways on that hold are offered as controls, and the one the State hides
    // is on the bench instead, struck through and naming the test it failed with
    // both values.
    await expect(preview.getByRole('button', { name: 'Follow her out' })).toBeVisible()
    await expect(preview.getByRole('button', { name: 'Round the back' })).toBeVisible()
    await expect(bench.locator('s').filter({ hasText: 'Stay outside' })).toBeVisible()
    await expect(bench.getByText('needs coat to hold off, holds on')).toBeVisible()

    // A hidden way on is text on a bench and nothing more: no control, and so no
    // keyboard path that could take it and no Place to move it from.
    await expect(preview.getByRole('button', { name: 'Stay outside' })).toHaveCount(0)

    // Straight into the bar, and the way up is hidden by a Scene this Reading has
    // not been through — said in those words, naming the Scene as the bench names
    // it rather than as the id the Condition holds.
    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(bench.locator('s').filter({ hasText: 'Go up' })).toBeVisible()
    await expect(bench.getByText('needs The yard to have been entered, and it has not'))
      .toBeVisible()
    await expect(preview.getByRole('button', { name: 'Go up' })).toHaveCount(0)

    // The other way round: the Reader has been through the yard, so the way on the
    // bench was explaining is a control the Author can take and there is nothing
    // left to explain about it.
    await backAndRoundTheYard(preview)
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByRole('button', { name: 'Go up' })).toBeVisible()
    await expect(bench.getByText('needs The yard to have been entered')).toBeHidden()
  })

/**
 * The whole of what #305 gives an Author, driven as one gesture: the Condition is
 * written from the page — two plain questions and no number to type — and then
 * watched failing and holding in the reading beside it.
 */
test('an Author writes a Condition about a Scene, and watches it hold and not hold',
  async ({ page, request }) => {
    const { story, bar, yard } = await writeConditionalStory(request)
    const shot = await (await request.post(`/api/scenes/${bar}/shots`)).json()
    await request.patch(`/api/shots/${shot.id}`, {
      data: { text: 'You came in the back way.', description: '' },
    })

    await page.goto(`/stories/${story.id}?scene=${bar}`)
    await live(page)

    // Written from the page. The row is whole the moment the question is chosen,
    // and what it asks is chosen from the two the language has: there is no number
    // to type after it, and none to get wrong.
    await page.getByRole('button', { name: 'Add a Condition to Shot 2 of The bar' }).click()
    const called = 'Condition 1 of Shot 2 of The bar'
    await page.getByLabel(called, { exact: true }).selectOption('entered')
    await page.getByLabel(`Scene asked about by ${called}`).selectOption({ label: 'The yard' })

    await expect(page.getByLabel(`entered for ${called}`)).toHaveValue('true')
    await expect(page.getByLabel(`times for ${called}`)).toHaveCount(0)
    await expect.poll(() => readShotConditions(bar))
      .toEqual([[], [{ scene: yard, entered: true }]])

    // Walking straight in, it does not hold: the beat is not in the run this
    // Reading plays, and the bench says which test it failed and how.
    await page.getByRole('button', { name: 'Read the Story' }).click()
    const preview = previewIn(page)
    const bench = benchIn(page)
    await expect(preview.getByText('Shot 1 of 1')).toBeVisible()
    await expect(bench.getByText('needs The yard to have been entered, and it has not'))
      .toBeVisible()

    // And round by the yard it holds: two Shots where there was one, and the beat
    // the Author wrote for that way in on the screen.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await backAndRoundTheYard(preview)
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByText('Shot 2 of 2')).toBeVisible()
    await expect(preview.locator('figure').getByText('You came in the back way.')).toBeVisible()
    await expect(bench.getByText('needs The yard to have been entered')).toBeHidden()
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

test('a Scene says something different to a Reading that came the other way',
  async ({ page, request }) => {
    const { story, street, bar, yard } = await writeConditionalStory(request)

    // A second Shot in the bar, played only for a Reader who came in the back way
    // — the line the Author used to need a second visit, or a second Scene, to
    // hold.
    const again = await (await request.post(`/api/scenes/${bar}/shots`)).json()
    await request.patch(`/api/shots/${again.id}`, {
      data: { text: 'You came in the back way.', description: '' },
    })
    await request.put(`/api/shots/${again.id}/conditions`, {
      data: { conditions: [{ scene: yard, entered: true }] },
    })

    const preview = await writing(page, story.id, street)
    const bench = benchIn(page)
    const frame = preview.locator('figure')

    // Walking straight in, the bar is the one Shot it always was: the run is
    // counted without the Shot this Reading is not being played, and the bench
    // says which one that is and why.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect(preview.getByText('Shot 1 of 1')).toBeVisible()
    await expect(bench.locator('s').filter({ hasText: 'You came in the back way.' }))
      .toBeVisible()
    await expect(bench.getByText('needs The yard to have been entered, and it has not'))
      .toBeVisible()

    // The bench names the beat, but the frame never plays it: the Scene runs
    // straight from its one Shot to the ways on.
    await expect(frame.getByText('Smoke, and no one she knows.')).toBeVisible()
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(frame.getByText('You came in the back way.')).toBeHidden()
    await expect(preview.getByRole('button', { name: 'Follow her out' })).toHaveCount(0)

    // Round by the yard, and the Scene plays the extra beat: two Shots where there
    // was one, and nothing left on the bench to explain.
    await backAndRoundTheYard(preview)
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByText('Shot 2 of 2')).toBeVisible()
    await expect(frame.getByText('You came in the back way.')).toBeVisible()
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
 * A Story whose seed can be read off the screen: the street draws its weather
 * from three values, so the same Path under a second seed is a Path the bench
 * says something different about. That difference is the whole of what #247
 * reported, so it is what the specs below hold the turn against.
 */
async function writeDrawingStory(request: APIRequestContext) {
  const story = await writeStory(request)
  const { scenes } = await scenesOf(request, story.id)
  await request.put(`/api/scenes/${scenes[0]!.id}/flags`, {
    data: { sets: { weather: ['rain', 'sun', 'haze'] } },
  })

  return { story, scenes }
}

/** The value the street drew for its weather, as the bench says it. */
async function drawnIn(page: Page) {
  const said = await benchIn(page).getByText(/weather = /).innerText()

  return (said.match(/rain|sun|haze/) ?? [])[0]
}

test('turning the middle of the bench over and back resumes the Reading the Author was in',
  async ({ page, request }) => {
    const { story, scenes } = await writeDrawingStory(request)
    const preview = await writing(page, story.id, scenes[0]!.id)

    // A beat in, so the Path has been walked as well as drawn.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByText('She steps out.')).toBeVisible()
    const weather = await drawnIn(page)

    // The Path is held above the document, by the bench, so the reading that
    // comes back is the Reading that went away: the same beat of the same Scene,
    // under the same draw. Turned over six times rather than once — three values
    // means a Path redrawn on every turn agrees with the one before it a third of
    // the time, and #247 was reproduced twelve times over on exactly that.
    for (let turn = 0; turn < 6; turn++) {
      await page.getByRole('button', { name: 'Write the Scene' }).click()
      await expect(preview).toBeHidden()
      await page.getByRole('button', { name: 'Read the Story' }).click()

      await expect(preview.getByText('She steps out.')).toBeVisible()
      await expect(preview.getByText('Shot 2 of 2')).toBeVisible()
      expect(await drawnIn(page)).toBe(weather)
    }

    // And the State is the one that Path accumulated rather than the one a Path
    // found afresh would have: a Reading that has taken a way on comes back
    // having taken it.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()

    await page.getByRole('button', { name: 'Write the Scene' }).click()
    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()
    await expect.poll(() => benchIn(page).locator('.entered li').allTextContents())
      .toEqual(['The street', 'The bar'])
    expect(await drawnIn(page)).toBe(weather)
  })

test('coming back to the writing puts the caret on the beat it was left on',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const street = scenes[0]!
    await page.goto(`/stories/${story.id}?scene=${street.id}`)
    await live(page)

    // The caret in the second beat of the Scene and part-way along the line,
    // which is where an Author who turned to the reading to judge what they had
    // just typed left it.
    const beat = page.locator(`#shot-${street.shots[1]!.id}`)
    await beat.click()
    await beat.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(3, 3))

    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(previewIn(page)).toBeVisible()

    // Staying in the document is not standing behind the reading: `display: none`
    // is what takes the writing off the screen, so it draws nothing over the
    // reading, offers nothing to the pointer, and is out of the tab order, out of
    // the accessibility tree and out of what the bar of Commands reads off the
    // bench — `app/components/Commands.vue` filters by `checkVisibility()`.
    await expect(beat).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Name of The street' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Write the Scene' }).click()

    // The writing is never taken out of the document — the reading takes its
    // place in front of it — so the field still holds its caret and putting the
    // focus back is the whole of coming back. #247 reported the panel this
    // document replaced putting the Author on the first beat of the Scene
    // instead.
    await expect(beat).toBeFocused()
    expect(await beat.evaluate(field => (field as HTMLTextAreaElement).selectionStart)).toBe(3)
    await expect(page.locator(`#shot-${street.shots[0]!.id}`)).not.toBeFocused()
  })

test('a document turned over from a Scene down the Story comes back wound to it',
  async ({ page, author }) => {
    const story = await seedStory(author, 'A long Story')
    const scenes = await seedScenes(story, Array.from({ length: 12 }, (_, at) => `Scene ${at + 1}`))
    await seedPublication(story, scenes[0])

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}?scene=${scenes[10]!.id}`)
    await live(page)

    // The address wound the document down the Story, and nothing has been typed
    // into, so there is no beat for the turn back to come back to.
    const named = page.getByRole('textbox', { name: 'Name of Scene 11' })
    await expect(named).toBeInViewport()

    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(previewIn(page)).toBeVisible()
    await page.getByRole('button', { name: 'Write the Scene' }).click()

    // The one scroller on the bench is as tall as whichever reading is in it, so a
    // reading shorter than the Story takes the writing's scroll down with it. The
    // turn back winds the document to the Scene the address names, which is the
    // Scene the Author was in.
    await expect(named).toBeInViewport()
  })

test('the turn back answers to the address rather than to where the caret was left',
  async ({ page, author }) => {
    const story = await seedStory(author, 'A long Story')
    const scenes = await seedScenes(story, Array.from({ length: 12 }, (_, at) => `Scene ${at + 1}`))
    await seedPublication(story, scenes[0])

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
    await live(page)

    // The caret put in a beat, and then the address moved from the reading, where
    // no field of the Scene it goes to is laid out for the caret to follow the wind
    // into — the writing is dark behind the Preview, and behind the Contact Sheet
    // as well. So the caret is left standing eleven sections above the Scene the
    // Author is now in. The rail's mark is what moves the address here; the bar of
    // Commands, a Remark and a mark on a band of the sheet are the same act by the
    // same route and leave the caret in exactly the same place. Made from the
    // writing instead, that press takes the caret into the Scene it goes to — see
    // #265 — so the stale beat this turn has to ignore is one a move made from
    // either of the other two readings left behind.
    const beat = page.getByRole('textbox', { name: 'Shot 1 of Scene 1', exact: true })
    await beat.click()

    await page.getByRole('button', { name: 'Read the Story' }).click()
    await expect(previewIn(page)).toBeVisible()
    await sceneNode(page, 'Scene 12').click()
    await expect(page.locator('.rail .here')).toHaveAttribute('data-scene', scenes[11]!.id)

    await page.getByRole('button', { name: 'Write the Scene' }).click()

    // There is one notion of where the Author is and it is the Path, so the turn
    // back answers to the address and not to a mark the page kept: the document
    // comes back wound to the Scene the address names and the stale beat takes
    // nothing. Put back, it would have taken the Author — and the next word they
    // typed — into the Scene they left, with the address and the rail both saying
    // they were somewhere else.
    await expect(beat).not.toBeFocused()
    await expect(page.getByRole('textbox', { name: 'Name of Scene 12' })).toBeInViewport()
    await expect.poll(() => page.locator('.document').evaluate(one => one.scrollTop))
      .toBeGreaterThan(0)
  })

test('the bench is answered whole by the server, and the browser takes it over as it stands',
  async ({ page, request }) => {
    const { story, scenes } = await writeDrawingStory(request)

    // Everything the browser says as it takes the page over. What the bench opens
    // its Path at is not among it: the reading stands behind a `v-if` that is false
    // on the server, so nothing drawn from the Path is in the answer and a seed
    // drawn twice would show up nowhere for this to read. The rule the bench keeps
    // by opening at `UNDRAWN` — see
    // `docs/adr/0024-the-seed-belongs-to-the-position.md` — is held by the code and
    // by nothing here, which is what this spec is named for.
    const said: string[] = []
    page.on('console', message => said.push(message.text()))
    page.on('pageerror', error => said.push(String(error)))

    const answer = await page.goto(`/stories/${story.id}?scene=${scenes[0]!.id}`)
    const served = await answer!.text()
    await live(page)

    // The Story arrived written: the document is the server's answer rather than
    // something the browser assembles afterwards, which is why the Path is opened
    // undrawn at all.
    expect(served).toContain('A door opens.')
    expect(served).toContain('Smoke, and no one she knows.')

    // And nothing about it was wrong when the browser took it over.
    await expect(page.getByRole('textbox', { name: 'Name of The street' })).toBeVisible()
    expect(said.filter(line => /hydrat|mismatch/i.test(line))).toEqual([])
  })

test('the bench keeps no Reading between sessions', async ({ page, request }) => {
  const { story, scenes } = await writeDrawingStory(request)
  const preview = await writing(page, story.id, scenes[0]!.id)

  await preview.getByRole('button', { name: 'Next Shot' }).click()
  await expect(preview.getByText('She steps out.')).toBeVisible()

  // The Path is held above the document and nowhere else. An Author on the bench
  // restarts, rerolls and edits between reads, so a Preview that reopened
  // mid-Story would be a bench remembering what they have stopped meaning — see
  // `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`, which this
  // leaves exactly where it stood.
  await page.reload()
  const again = await readTheStory(page)
  await expect(again.getByText('A door opens.')).toBeVisible()
  await expect(again.getByText('Shot 1 of 2')).toBeVisible()
  await expect(again.getByRole('button', { name: 'Read Again from the Start' })).toHaveCount(0)

  // And nothing was written into the browser for a bench to read back.
  expect(await page.evaluate(id => localStorage.getItem(`reading-${id}`), story.id)).toBeNull()
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

test('turning the middle over is an act of the bench, named in the bar', async ({ page, request }) => {
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
  // strip the drawing scrolls sideways through. Three regions that never trade width at any of them, and no
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

    // A write refused in one Scene, which the sentence names: the Scene claims the
    // one refusal the page holds. The field is found on the slate rather than by
    // its label, which says the name it is about to stop holding.
    const named = page.locator(`.writing [data-scene="${street.id}"] .named input`)
    await named.fill('  ')
    await named.blur()
    await expect(page.getByRole('alert'))
      .toHaveText('In “The street”: A Scene needs a name.')
    // The refusal is said before the read it asks for has landed, and that read is
    // the one thing that can redraw the reading below: landing after the Exit is
    // taken away, it carried the control off from under the press (#287). The
    // field holding the name the Story kept is that read landed — `0008`'s
    // read-back is what puts it back — and from here to the press nothing on the
    // page reads the Story again: the turn and the beats are moves of the Path,
    // made in the browser. The sentence above happens to wait for the same read,
    // since it names the Scene only once the name is back, but that is its wording
    // and not its promise.
    await expect(named).toHaveValue('The street')

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
    await preview.getByRole('button', {
      name: 'Move Earlier the Exit 2 to The alley, out of The street',
    }).click()

    await expect(page.locator('main > [role="alert"]'))
      .toHaveText(/renumbered all at once/)
  })

test('the Author closes an Exit behind the Reader, and the reading says so on both sides',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const { scenes } = await scenesOf(request, story.id)
    const street = scenes[0]!

    // The Exit is written in the document, and the reading is the other face of
    // the same middle — so the bench is turned over between saying it and reading
    // it, which is the gesture an Author makes.
    const written = page.getByLabel('Stepping back the Exit 1 to The bar, out of The street')
    const turnToTheReading = () => readTheStory(page)
    const turnToTheWriting = () => page.getByRole('button', { name: 'Write the Scene' }).click()

    await page.goto(`/stories/${story.id}?scene=${street.id}`)
    await live(page)

    // The way on is crossed backwards until somebody says otherwise.
    await expect(written).toHaveValue('story')
    await written.selectOption('Not offered')

    const preview = await turnToTheReading()
    const stepBack = preview.getByRole('button', { name: 'Step Back' })

    // The mark stands beside the way on where the way on stands: at the end of
    // the Scene, among the Exits being offered, which is where an Author reads
    // what taking it will cost.
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await preview.getByRole('button', { name: 'Next Shot' }).click()
    await expect(preview.getByText('No way back')).toBeVisible()

    // Taken, and the beat behind is not on offer: what is left is reading again
    // from the start.
    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()
    await expect(stepBack).toHaveCount(0)
    await expect(preview.getByRole('button', { name: 'Read Again from the Start' }))
      .toBeVisible()

    // Said as the Story says instead, and the Story says it is crossed: the
    // Reading is the Reading it was — the Path is held above the document and the
    // turn does not end it — and the way back is back.
    await turnToTheWriting()
    await written.selectOption('As the Story says')
    await turnToTheReading()
    await expect(preview.getByText('No way back')).toHaveCount(0)
    await stepBack.click()
    await expect(preview.getByText('She steps out.')).toBeVisible()

    // And the Story answers for it: one press on the header's own fold closes
    // every Exit that has not spoken for itself. The reading stands where it
    // stood — at the end of the street, with its way on offered — so taking it
    // again is the same move under a Story that has changed its mind.
    await page.getByText('How it is read').click()
    await page.getByLabel('Stepping back across an Exit').selectOption('Not offered')
    await expect(preview.getByText('No way back')).toBeVisible()

    await preview.getByRole('button', { name: 'Follow her out' }).click()
    await expect(preview.getByText('Smoke, and no one she knows.')).toBeVisible()
    await expect(stepBack).toHaveCount(0)
  })
