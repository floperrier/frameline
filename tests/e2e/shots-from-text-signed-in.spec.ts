import { expect } from '@playwright/test'
import type { APIRequestContext, Locator } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'
import { live, readShots, seedScene, seedStory, test, toast, writeScene, writeStory } from './author'

/**
 * A text pasted under a Scene, made into as many Shots as it has blocks — issue
 * #438, `docs/adr/0076-pasted-text-is-cut-at-its-empty-lines.md`.
 */

async function shotsIn(request: APIRequestContext, storyId: string, sceneId: string) {
  const read: StoryInEditor = await (await request.get(`/api/stories/${storyId}`)).json()
  return read.scenes.find(scene => scene.id === sceneId)!.shots
}

type Held = { editor: { state: { selection: { from: number } } } }
const caret = (editor: Locator) => editor.evaluate(field => (field as unknown as Held).editor.state.selection.from)

test('a text pasted under a new Scene becomes a Shot per block, its spoken one given its Speaker',
  async ({ page, request }) => {
    const story = await writeStory(request)
    const yard = await (await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The yard' } })).json()

    await page.goto(`/stories/${story.id}`)
    await writeScene(page, 'The yard')

    // The control stands beside *Add Shots from Images*, and opens the field in
    // place with the hand in it; Esc closes it and gives the hand back.
    const opening = page.getByRole('button', { name: 'Add Shots from Text to The yard', exact: true })
    await expect(opening).toHaveAttribute('data-command', 'Add Shots from Text')
    await opening.click()
    const field = page.getByRole('textbox', { name: 'Text of the new Shots The yard' })
    await expect(field).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(field).toBeHidden()
    await expect(opening).toBeFocused()

    await opening.click()
    const adding = page.getByRole('button', { name: 'Add the Shots', exact: true })
    await expect(field).toHaveAccessibleDescription('Makes no Shot')
    await expect(adding).toBeDisabled()

    // A block over the length a Shot may hold is named, and nothing is sent.
    await field.fill(`Short.\n\n${'x'.repeat(2001)}`)
    await expect(field).toHaveAccessibleDescription('New Shot 2 would hold more than 2000 characters')
    await expect(adding).toBeDisabled()

    await field.fill([
      'A door opens.',
      'She steps out.',
      '',
      'MARIE',
      'Come in.',
      '',
      '',
      '   ',
      'Rain on the glass.',
      '',
      'The {coat} on its *hook*.',
    ].join('\n'))
    await expect(field).toHaveAccessibleDescription('Makes 4 Shots, 1 of them spoken')
    await adding.click()

    await expect(toast(page)).toHaveText('4 Shots added to “The yard”.')
    await expect(field).toBeHidden()
    const shots = await shotsIn(request, story.id, yard.id)
    expect(shots.map(shot => shot.text)).toEqual([
      'A door opens.\nShe steps out.',
      'MARIE\nCome in.',
      'Rain on the glass.',
      'The {coat} on its *hook*.',
    ])
    expect(shots.map(shot => shot.formatted!.content.map(block => block.type)))
      .toEqual([['line', 'line'], ['speech'], ['line'], ['line']])
    expect(shots[1]!.formatted!.content[0]).toMatchObject({
      type: 'speech',
      content: [{ type: 'speaker', content: [{ type: 'text', text: 'MARIE' }] }, { type: 'line' }],
    })

    // The caret lands at the head of the first of them.
    const first = page.locator(`[id="shot-${shots[0]!.id}"].ProseMirror`)
    await expect(first).toBeFocused()
    await expect.poll(() => caret(first)).toBe(1)

    // Three lines and no empty line between them are three Shots, at the end of the run.
    await opening.click()
    await field.fill('One.\nTwo.\nThree.')
    await expect(field).toHaveAccessibleDescription('Makes 3 Shots')
    await adding.click()
    await expect(toast(page)).toHaveText('3 Shots added to “The yard”.')
    await expect(readShots(yard.id)).resolves.toMatchObject([
      ...shots.map(shot => ({ id: shot.id, position: shot.position })),
      { text: 'One.', position: 4 },
      { text: 'Two.', position: 5 },
      { text: 'Three.', position: 6 },
    ])
  })

test('the door makes the Shots it is given in one request, and refuses a list of none',
  async ({ request, otherAuthor }) => {
    const story = await writeStory(request)
    const yard = await (await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The yard' } })).json()
    const line = (text: string) => ({ type: 'doc', content: [{ type: 'line', content: [{ type: 'text', text }] }] })

    const made = await request.post(`/api/scenes/${yard.id}/shots`, { data: { formatted: [line('One.'), line('Two.')] } })
    expect(made.status()).toBe(201)
    expect((await made.json()).map((shot: { text: string, position: number }) => [shot.text, shot.position]))
      .toEqual([['One.', 0], ['Two.', 1]])

    const none = await request.post(`/api/scenes/${yard.id}/shots`, { data: { formatted: [] } })
    expect(none.status()).toBe(400)
    expect((await none.json()).message).toBe('Shots are added from a list of 1 to 200 texts.')

    const long = await request.post(`/api/scenes/${yard.id}/shots`, { data: { formatted: [line('x'.repeat(2001))] } })
    expect(long.status()).toBe(400)
    expect((await long.json()).message).toBe('A Shot cannot hold more than 2000 characters.')

    // Without a body, one empty Shot, as ever.
    const empty = await request.post(`/api/scenes/${yard.id}/shots`)
    expect(await empty.json()).toMatchObject({ text: '', position: 2 })

    // Somebody else's Scene is not one there is to add to.
    const theirs = await seedScene(await seedStory(otherAuthor, 'Their Story'), 'Their Scene')
    const refused = await request.post(`/api/scenes/${theirs.id}/shots`, { data: { formatted: [line('Mine.')] } })
    expect(refused.status()).toBe(404)
    await expect(readShots(theirs.id)).resolves.toHaveLength(1)
  })
