import { expect } from '@playwright/test'
import { live, test, writeStory } from './author'
import type { APIRequestContext, Page } from '@playwright/test'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A change draws again the row it changes and no other — issues #449 and #480,
 * and `docs/adr/0043-a-story-is-written-as-one-document.md`. A beat's row is
 * `ShotRow`, a way on's `ExitRow`, a beat's fold of how it plays `ShotPlays` and a
 * Scene's Question `Asking`, each a component handed its own Shot, Exit or Scene.
 *
 * Two components drawn inside the rows are counted as well, because each reads
 * what the document hands every row: `Conditions`, which reads the Scenes, the
 * Exits and the Flags of the Story as the bench names them, and `Landing`, which
 * reads the Scenes a way on may land on.
 *
 * What is counted is what Vue does, not what the page shows, because a row drawn
 * again to the same elements changes nothing on the screen and costs the whole
 * render all the same. The built app keeps no devtools, but it keeps the app on
 * the element it mounts and the tree of what it drew under it, which is enough to
 * find every one of those components and hear each one update.
 */

async function reread(request: APIRequestContext, id: string) {
  return await (await request.get(`/api/stories/${id}`)).json() as StoryInEditor
}

/** What one component is drawn from, which tells two of a kind apart. */
type Drawn = { kind: string, of: string }

/**
 * Starts counting the updates of every row of the document, and of the document
 * itself, from now on. Read back by `updated`.
 */
async function count(page: Page) {
  await page.evaluate(() => {
    type Instance = {
      type: { __name?: string }
      props: Record<string, unknown>
      subTree: Node
      bu: (() => void)[] | null
    }
    type Node = {
      component?: Instance
      suspense?: { activeBranch?: Node }
      children?: unknown
    } | null
    // What tells two of a kind apart: the id of what it is drawn from, and for a
    // list of landings the Scene it leaves and, on a way on's own row, the one it
    // leads to.
    const kinds: Record<string, (props: Record<string, unknown>) => string> = {
      Writing: props => (props.story as { id: string }).id,
      ShotRow: props => (props.shot as { id: string }).id,
      ShotPlays: props => (props.shot as { id: string }).id,
      ExitRow: props => (props.exit as { id: string }).id,
      Asking: props => (props.scene as { id: string }).id,
      Conditions: props => props.id as string,
      Landing: props => `${props.from}>${props.led ?? ''}`,
    }
    const counts: Record<string, number> = {}

    function walk(node: Node) {
      if (!node) return
      if (node.component) {
        const instance = node.component
        const kind = instance.type.__name
        const of = kind && kinds[kind]
        if (of) {
          const key = `${kind} ${of(instance.props)}`
          counts[key] = 0
          ;(instance.bu ??= []).push(() => counts[key]!++)
        }
        return walk(instance.subTree)
      }
      if (node.suspense) return walk(node.suspense.activeBranch ?? null)
      if (Array.isArray(node.children)) for (const child of node.children) walk(child as Node)
    }

    const mounted = document.getElementById('__nuxt') as unknown as { _vnode: Node }
    walk(mounted._vnode)
    ;(window as unknown as { updated: Record<string, number> }).updated = counts
  })
}

/** What updated since `count`, once the page has drawn a frame and settled after it. */
async function updated(page: Page) {
  return await page.evaluate(async () => {
    await new Promise(drawn => requestAnimationFrame(() => setTimeout(drawn, 0)))
    const counts = (window as unknown as { updated: Record<string, number> }).updated
    return Object.fromEntries(Object.entries(counts).map(([key, n]) => {
      const [kind, of] = key.split(' ')
      return [key, { kind, of, n }]
    })) as Record<string, Drawn & { n: number }>
  })
}

/**
 * The Story `writeStory` writes, with a Question on *The street*, a third Scene
 * nothing leads to, *The roof*, whose one way on leads to *The bar*, and three
 * more Shots on *The bar*, each playing
 * under a Condition of one kind: that the Exit out of *The street* was taken,
 * that the Flag the Question holds holds a value, and that *The roof* was
 * entered. Opened on the bench at *The street*.
 */
async function bench(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const [street, bar] = (await reread(request, story.id)).scenes
  await request.patch(`/api/scenes/${street!.id}`, { data: { question: 'Which way?', questionFlag: 'way' } })
  const roof = await (await request.post(`/api/stories/${story.id}/scenes`, { data: { name: 'The roof' } })).json()
  await request.post(`/api/scenes/${roof.id}/shots`)
  await request.post(`/api/scenes/${roof.id}/exits`, { data: { toSceneId: bar!.id } })

  const [exit, down] = (await reread(request, story.id)).exits
  for (const condition of [
    { exit: exit!.id, taken: true },
    { flag: 'way', is: 'left' },
    { scene: roof.id, entered: true },
  ]) {
    const shot = await (await request.post(`/api/scenes/${bar!.id}/shots`)).json()
    await request.put(`/api/shots/${shot.id}/conditions`, { data: { conditions: [condition] } })
  }

  const read = await reread(request, story.id)
  await page.goto(`/stories/${story.id}?scene=${street!.id}`)
  await live(page)

  const [, held, roofHeld] = read.scenes
  const [, taken, flagged, entered] = held!.shots

  return {
    story, street: read.scenes[0]!, bar: held!, roof: roofHeld!, exit: exit!, down: down!,
    conditioned: { taken: taken!.id, flagged: flagged!.id, entered: entered!.id },
  }
}

/** The keys of what updated since `count`, sorted. */
async function updatedKeys(page: Page) {
  return Object.entries(await updated(page)).filter(([, { n }]) => n).map(([key]) => key).sort()
}

test('typing in a Shot draws again that Shot\'s row and nothing else of the document', async ({ page, request }) => {
  const { story, street, bar, roof, exit, down } = await bench(page, request)
  const [first] = street.shots

  // The editor is mounted on the beat first, which is a change of its own.
  const box = page.getByRole('textbox', { name: 'Shot 1 of The street', exact: true })
  await box.click()
  await expect(page.locator(`[id="shot-${first!.id}"].ProseMirror`)).toBeFocused()

  await count(page)
  const counted = await updated(page)
  // Every row of the three Scenes is counted, the lists drawn inside them, and
  // the document too.
  const shots = [...street.shots, ...bar.shots, ...roof.shots]
  expect(Object.keys(counted).sort()).toEqual([
    ...[street, bar, roof].map(scene => `Asking ${scene.id}`),
    `ExitRow ${exit.id}`, `ExitRow ${down.id}`,
    ...shots.flatMap(shot => [`ShotPlays ${shot.id}`, `ShotRow ${shot.id}`, `Conditions ${shot.id}`]),
    `Conditions ${exit.id}`, `Conditions ${down.id}`,
    `Landing ${street.id}>${bar.id}`, `Landing ${roof.id}>${bar.id}`,
    ...[street, bar, roof].map(scene => `Landing ${scene.id}>`),
    `Writing ${story.id}`,
  ].sort())

  await page.keyboard.press('End')
  await page.keyboard.type(' It rains.')
  await expect(box).toHaveText('A door opens. It rains.')

  const after = await updated(page)
  // The row, and the line of its fold, which says what the Shot plays as and so
  // reads its words: both are this Shot's, and neither is any other's.
  expect(after[`ShotRow ${first!.id}`]!.n).toBeGreaterThan(0)
  const others = Object.entries(after).filter(([, { of, n }]) => of !== first!.id && n)
  expect(others).toEqual([])
})

test('typing in a way on\'s words, a Question or its Flag draws again that row, and what offers what it changed', async ({ page, request }) => {
  const { street, exit, conditioned } = await bench(page, request)

  for (const [field, rows] of [
    // A Condition asking whether that Exit was taken offers every Exit by its
    // words, so it says the new ones; the two Conditions of other kinds do not.
    [page.getByRole('textbox', { name: 'What the Exit 1 out of The street says', exact: true }),
      [`Conditions ${conditioned.taken}`, `ExitRow ${exit.id}`]],
    [page.getByLabel('Question put to the Reader before the Exits The street', { exact: true }),
      [`Asking ${street.id}`]],
    // The Flag the answer is held under is one of the Flags a Condition on a Flag
    // offers as it is typed in.
    [page.getByLabel('Flag the answer is held under The street', { exact: true }),
      [`Asking ${street.id}`, `Conditions ${conditioned.flagged}`]],
  ] as const) {
    // Each on a bench opened afresh, because the caret leaving the field before
    // writes it, and a write landing is another change than a key.
    await page.reload()
    await live(page)
    await field.click()
    await count(page)
    await field.press('End')
    await field.pressSequentially('s')
    await expect(field).toHaveValue(/s$/)

    expect(await updatedKeys(page)).toEqual([...rows].sort())
  }
})

test('typing in a Scene\'s name draws again what says it, and not the rows of other Scenes', async ({ page, request }) => {
  const { story, street, bar, roof, exit, down, conditioned } = await bench(page, request)
  // Found by its id, since the label it goes by says the name being typed.
  await expect(page.getByLabel('Name of The street', { exact: true })).toBeVisible()
  const field = page.locator(`[id="scene-name-${street.id}"]`)
  await field.click()
  await count(page)
  await field.press('End')
  await field.pressSequentially('s')
  await expect(field).toHaveValue('The streets')

  expect(await updatedKeys(page)).toEqual([
    // The field is the document's own.
    `Writing ${story.id}`,
    // Every control of the Scene's section is named by it, the lists of
    // Conditions on its rows among them.
    `Asking ${street.id}`,
    `ExitRow ${exit.id}`, `Conditions ${exit.id}`,
    ...street.shots.flatMap(shot => [`ShotRow ${shot.id}`, `ShotPlays ${shot.id}`, `Conditions ${shot.id}`]),
    // On another Scene's rows, the Conditions that name it: the Exit out of it, and
    // every Scene a Condition may ask about.
    `Conditions ${conditioned.taken}`, `Conditions ${conditioned.entered}`,
    // The lists of landings that offer it, the Scene nothing leads to's: on its
    // way on's row and at its foot. Every list is handed ids, which did not
    // change, and each reads the name of a Scene it offers by that Scene's id.
    `Landing ${roof.id}>${bar.id}`, `Landing ${roof.id}>`,
  ].sort())
  // The way on out of that other Scene is not drawn again: it is handed nothing
  // new, its list of landings is.
  expect((await updated(page))[`ExitRow ${down.id}`]!.n).toBe(0)
})

test('a closed fold draws no controls, and draws them before it shows open', async ({ page, request }) => {
  await bench(page, request)
  const name = 'Shot 2 of The street'
  const fold = page.locator('details.plays', {
    has: page.locator('summary > .visually-hidden').getByText(name, { exact: true }),
  })

  // Shut, every fold of the document is its line and nothing under it.
  await expect(page.locator('details.plays')).toHaveCount(10)
  await expect(page.locator('details.plays .answers')).toHaveCount(0)
  await expect(page.locator('details.plays select')).toHaveCount(0)

  // Everything that happens to the fold as it is pressed open, in the order it
  // happens: the answers are drawn first, and only then is it open.
  await fold.evaluate((details) => {
    const seen: string[] = []
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes') seen.push(`open ${details.hasAttribute('open')}`)
        else if ([...record.addedNodes].some(node => node instanceof Element && node.matches('.answers'))) {
          seen.push('drawn')
        }
      }
    }).observe(details, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true })
    ;(window as unknown as { seen: string[] }).seen = seen
  })

  await fold.locator('summary').click()
  await expect(fold).toHaveAttribute('open')
  await expect(fold.getByLabel(`This Shot is cut ${name}`, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual(['drawn', 'open true'])

  // Drawn once, and kept drawn while it is shut again; no other fold drew a thing.
  await fold.locator('summary').click()
  await expect(fold).not.toHaveAttribute('open')
  await expect(fold.locator('.answers')).toHaveCount(1)
  await expect(page.locator('details.plays .answers')).toHaveCount(1)
})
