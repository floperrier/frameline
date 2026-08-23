import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { test, writeStory } from './author'

/**
 * The two facts about language the product keeps apart: the Locale, which is the
 * language a person reads the interface in, and a Story's Language, which is the
 * language the work is written in. Everything else about them is the same in a
 * one-language product, so this is the spec that proves they are not.
 *
 * The rest of the suite runs pinned to `en-US` — see `playwright.config.ts` — so
 * this is also the only place the interface is exercised in French at all.
 */

/**
 * Everything on the page a person could read: the text, and the attributes that
 * are read out rather than shown. A translation nobody wrote reaches the screen
 * as the key that was asked for, so this is what a missing one looks like.
 */
async function everythingShown(page: Page) {
  return page.evaluate(() => {
    const read = ['alt', 'placeholder', 'aria-label', 'title']
    const said = [document.body.textContent ?? '']
    for (const element of document.querySelectorAll(read.map(at => `[${at}]`).join(', '))) {
      for (const attribute of read) said.push(element.getAttribute(attribute) ?? '')
    }
    return said.join('\n')
  })
}

/** What a key looks like when it reaches a screen instead of the words it names. */
const A_RAW_KEY = new RegExp(
  '\\b(common|conditions|cut|editor|error|landing|languages'
  + '|locale|preview|reading|refusals|scene|stories)\\.[a-z][\\w.]*', 'i')

test.describe('an interface read in French', () => {
  test.use({ locale: 'fr-FR' })

  test('detection, the words, a refusal and the choice that outlasts the browser', async ({ page, request, baseURL }) => {
    const story = await writeStory(request)

    // Detection, with nothing in the address to say so: the Author asks for the
    // English address and lands on the French one.
    await page.goto('/stories')
    await expect(page).toHaveURL('/fr/stories')
    await expect(page.getByRole('heading', { name: 'Récits' })).toBeVisible()
    await expect(page.getByLabel('Titre d\'un nouveau Récit')).toBeVisible()
    expect(await everythingShown(page)).not.toMatch(A_RAW_KEY)

    // A bookmark deep in the editor is detected too, which is the whole reason
    // detection is not limited to the front door.
    await page.goto(`/stories/${story.id}`)
    await expect(page).toHaveURL(`/fr/stories/${story.id}`)
    await expect(page.getByRole('link', { name: 'Tous les Récits' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publier ce Récit', exact: true })).toBeVisible()

    // The words of the craft, on a Scene opened for editing: a Shot is a Plan and
    // a Flag is a Marqueur, as `CONTEXT.md` says they are shown.
    await page.getByRole('button', { name: 'Ouvrir Scène The street' }).click()
    await expect(page.getByRole('button', { name: 'Ajouter un Plan' })).toBeVisible()
    await expect(page.getByLabel('Marqueurs posés à l\'entrée dans The street')).toBeVisible()
    expect(await everythingShown(page)).not.toMatch(A_RAW_KEY)

    // What the bench says about its own writing is in the Locale twice over: the
    // words, and the clock read the French way rather than the English one.
    const shot = page.getByRole('textbox', { name: 'Plan 1' })
    await shot.fill('Une porte s\'ouvre.')
    await shot.blur()
    await expect(page.getByText(/^Enregistré à \d{2}:\d{2}$/)).toBeVisible()

    // The Aperçu, where a Story's own words and the tool's are on screen at once.
    await page.goto(`/fr/stories/${story.id}/preview`)
    await expect(page.getByText('Sur la table de montage')).toBeVisible()
    expect(await everythingShown(page)).not.toMatch(A_RAW_KEY)

    // A refusal the server gives, in the language the request was made in: this
    // one is a phrase the API wrote, not a string the page had waiting.
    const empty = await (await request.post('/api/stories', {
      data: { title: 'Un Récit vide' },
    })).json()
    await page.goto(`/fr/stories/${empty.id}`)
    await page.getByRole('button', { name: 'Publier ce Récit', exact: true }).click()
    await expect(page.getByRole('alert'))
      .toHaveText('Un Récit a besoin d\'une Scène d\'ouverture avant d\'être publié.')

    // The Reader's page carries no locale segment whatever language it is read
    // in — see `docs/adr/0012-the-public-link-carries-no-locale.md` — and the
    // chrome around the Story is still the French this browser announced.
    await page.goto(`/fr/stories/${story.id}`)
    await page.getByRole('button', { name: 'Publier ce Récit', exact: true }).click()
    // Published before the page is left: a navigation would abort the request
    // the click sent, and the link would still be nobody's but the Author's.
    await expect(page.getByRole('button', { name: 'Dépublier ce Récit' })).toBeVisible()
    await page.goto(`${baseURL}/read/${story.id}`)
    await expect(page).toHaveURL(`${baseURL}/read/${story.id}`)
    await expect(page.getByRole('button', { name: 'Plan suivant' })).toBeVisible()
    // Nothing to switch to here, so nothing is offered.
    await expect(page.getByRole('link', { name: 'English' })).toHaveCount(0)

    // A choice made by hand outlasts the browser that disagrees with it: the
    // Author says English once, and asking for the English address again is no
    // longer answered in French.
    await page.goto('/fr/stories')
    await page.getByRole('link', { name: 'English' }).click()
    await expect(page).toHaveURL('/stories')
    await expect(page.getByRole('heading', { name: 'Stories' })).toBeVisible()

    await page.goto('/stories')
    await expect(page).toHaveURL('/stories')
    await expect(page.getByRole('heading', { name: 'Stories' })).toBeVisible()
  })
})

test('a Story is announced in its own Language while the chrome stays the Reader\'s', async ({ page, request, browser, baseURL }) => {
  // A Story written in French, published, and opened by someone reading English:
  // the one screen where the Story's Language and the Reader's Locale are both
  // visible, and the reason there are two facts here rather than one.
  const story = await writeStory(request, 'fr')

  await page.goto(`/stories/${story.id}`)
  await page.getByRole('button', { name: 'Publish this Story', exact: true }).click()

  const reader = await (await browser.newContext({ locale: 'en-US' })).newPage()
  await reader.goto(`${baseURL}/read/${story.id}`)

  // The work says what it is written in, on its title and on the frame holding
  // the beat — the still, what it shows, and the text are all the Author's.
  await expect(reader.getByRole('heading', { name: story.title })).toHaveAttribute('lang', 'fr')
  await expect(reader.locator('figure')).toHaveAttribute('lang', 'fr')

  // The chrome around it is the Reader's own, and nothing pretends to translate
  // the Story: the text is exactly what the Author wrote.
  await expect(reader.locator('html')).toHaveAttribute('lang', 'en')
  await expect(reader.getByRole('button', { name: 'Next Shot' })).toBeVisible()
  await expect(reader.getByText('A door opens.')).toBeVisible()
})

test('a Story created without a Language said is English, and one said is kept', async ({ page, request }) => {
  await page.goto('/stories')
  await page.getByLabel('Title of a new Story').fill('A Story in French')
  await page.getByLabel('Language of a new Story').selectOption('fr')
  await page.getByRole('button', { name: 'Create Story' }).click()
  await expect(page.getByRole('link', { name: 'Open A Story in French' })).toBeVisible()

  const [listed] = await (await request.get('/api/stories')).json()
  const written = await (await request.get(`/api/stories/${listed.id}`)).json()
  expect(written.language).toBe('fr')

  // English is preselected, so the common case costs no interaction — and a
  // Story written before the column existed reads as English for the same reason.
  const plain = await (await request.post('/api/stories', {
    data: { title: 'A Story that said nothing' },
  })).json()
  expect(plain.language).toBe('en')
})
