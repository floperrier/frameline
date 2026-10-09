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
      props: Record<string, { id?: string } | undefined>
      subTree: Node
      bu: (() => void)[] | null
    }
    type Node = {
      component?: Instance
      suspense?: { activeBranch?: Node }
      children?: unknown
    } | null
    const kinds: Record<string, string> = {
      Writing: 'story', ShotRow: 'shot', ShotPlays: 'shot', ExitRow: 'exit', Asking: 'scene',
    }
    const counts: Record<string, number> = {}

    function walk(node: Node) {
      if (!node) return
      if (node.component) {
        const instance = node.component
        const kind = instance.type.__name
        const of = kind && kinds[kind]
        if (of) {
          const key = `${kind} ${instance.props[of]?.id ?? ''}`
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

/** The Story `writeStory` writes, with a Question on *The street*, open on the bench. */
async function bench(page: Page, request: APIRequestContext) {
  const story = await writeStory(request)
  const read = await reread(request, story.id)
  const [street, bar] = read.scenes
  await request.patch(`/api/scenes/${street!.id}`, { data: { question: 'Which way?', questionFlag: 'way' } })

  await page.goto(`/stories/${story.id}?scene=${street!.id}`)
  await live(page)

  return { story, street: street!, bar: bar!, exit: read.exits[0]! }
}

test('typing in a Shot draws again that Shot\'s row and nothing else of the document', async ({ page, request }) => {
  const { story, street, bar, exit } = await bench(page, request)
  const [first, second] = street.shots

  // The editor is mounted on the beat first, which is a change of its own.
  const box = page.getByRole('textbox', { name: 'Shot 1 of The street', exact: true })
  await box.click()
  await expect(page.locator(`[id="shot-${first!.id}"].ProseMirror`)).toBeFocused()

  await count(page)
  const counted = await updated(page)
  // Every row of both Scenes is counted, and the document too.
  expect(Object.keys(counted).sort()).toEqual([
    `Asking ${bar.id}`, `Asking ${street.id}`,
    `ExitRow ${exit.id}`,
    ...[first!, second!, bar.shots[0]!].flatMap(shot => [`ShotPlays ${shot.id}`, `ShotRow ${shot.id}`]),
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

test('typing in a way on\'s words, a Question or its Flag draws again that row alone', async ({ page, request }) => {
  const { street, exit } = await bench(page, request)

  for (const [field, row] of [
    [page.getByRole('textbox', { name: 'What the Exit 1 out of The street says', exact: true }), `ExitRow ${exit.id}`],
    [page.getByLabel('Question put to the Reader before the Exits The street', { exact: true }), `Asking ${street.id}`],
    [page.getByLabel('Flag the answer is held under The street', { exact: true }), `Asking ${street.id}`],
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

    const after = await updated(page)
    expect(after[row]!.n).toBeGreaterThan(0)
    expect(Object.entries(after).filter(([key, { n }]) => key !== row && n)).toEqual([])
  }
})

test('a closed fold draws no controls, and draws them before it shows open', async ({ page, request }) => {
  await bench(page, request)
  const name = 'Shot 2 of The street'
  const fold = page.locator('details.plays', {
    has: page.locator('summary > .visually-hidden').getByText(name, { exact: true }),
  })

  // Shut, every fold of the document is its line and nothing under it.
  await expect(page.locator('details.plays')).toHaveCount(5)
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
