import { expect } from '@playwright/test'
import { test, writeStory } from './author'

/**
 * The chain a displayed word travels: what the browser announces, the route it
 * is answered at, the cookie that remembers the answer, the message file the
 * word comes out of, and the language the document says it is in.
 *
 * One string is translated so far — the heading over an Author's Stories — and
 * that is enough to prove every link of the chain. The rest of the suite runs
 * pinned to `en-US`, see `playwright.config.ts`, so this is the only place the
 * interface is exercised in French at all.
 */

test.describe('a browser announcing French', () => {
  test.use({ locale: 'fr-FR' })

  test('is answered in French, wherever it asks, and is not asked twice', async ({ page, request }) => {
    const story = await writeStory(request)

    // Detection, with nothing in the address to say so: the Author asks for the
    // English address and lands on the French one.
    await page.goto('/stories')
    await expect(page).toHaveURL('/fr/stories')
    await expect(page.getByRole('heading', { name: 'Récits' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    // A bookmark deep in the editor is detected too, which is the whole reason
    // detection is not limited to the front door.
    await page.goto(`/stories/${story.id}`)
    await expect(page).toHaveURL(`/fr/stories/${story.id}`)

    // What was detected is remembered rather than worked out again on every
    // page: the cookie holds it, and a reload lands where the last answer did.
    const remembered = (await page.context().cookies())
      .find(cookie => cookie.name === 'i18n_redirected')
    expect(remembered?.value).toBe('fr')

    await page.reload()
    await expect(page).toHaveURL(`/fr/stories/${story.id}`)
  })

  test('reads a published Story at the link the Author handed out', async ({ page, request, baseURL }) => {
    const story = await writeStory(request)
    // Everything but the heading is still authored in English, and stays so
    // until the tickets that move the rest of the strings.
    await page.goto(`/stories/${story.id}`)
    await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Unpublish this Story' })).toBeVisible()

    // The public link carries no locale segment in either language — see
    // `docs/adr/0012-the-public-link-carries-no-locale.md` — so a French browser
    // is answered at exactly the address that was copied.
    await page.goto(`${baseURL}/read/${story.id}`)
    await expect(page).toHaveURL(`${baseURL}/read/${story.id}`)
    await expect(page.getByRole('heading', { name: story.title })).toBeVisible()
  })
})

// A browser announcing a language nothing here is written in. It stands for
// announcing nothing as well: `navigator.language` always says something, so a
// browser that announces nothing is not a thing a test can build, and
// `fallbackLocale` in `nuxt.config.ts` is what answers it.
test.describe('a browser announcing German', () => {
  test.use({ locale: 'de-DE' })

  test('gets English, the language every unprefixed address is served in', async ({ page }) => {
    await page.goto('/stories')
    await expect(page).toHaveURL('/stories')
    await expect(page.getByRole('heading', { name: 'Stories' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test('a browser announcing English gets English, and says so in the document', async ({ page }) => {
  await page.goto('/stories')
  await expect(page).toHaveURL('/stories')
  await expect(page.getByRole('heading', { name: 'Stories' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
