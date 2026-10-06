import { randomUUID } from 'node:crypto'
import { expect, type Browser, type Page } from '@playwright/test'
import { ONE_PIXEL, forgetName, live, test, writeStory, type Author } from './author'
import type { StoryInEditor } from '../../shared/utils/scenes'

/**
 * A Story's public link is presented wherever it is pasted by what the Story is
 * already presented by on a shelf — its title, its Synopsis and its Cover — and
 * every page names itself in the browser's tab.
 */

/**
 * What an unfurler is handed: the page as the server renders it, fetched by a
 * browser holding no cookie and running no JavaScript, so nothing the client
 * would write afterwards can stand in for what the server did not. Read by a
 * real HTML parser rather than a pattern, so a title that came through unescaped
 * would come apart here as it would in a chat.
 */
async function unfurled(browser: Browser, baseURL: string, path: string) {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  const page = await context.newPage()
  const response = await page.goto(path)

  return { page, status: response!.status(), html: await response!.text() }
}

/** A tag of the head by the name or the property it carries. */
function meta(page: Page, key: string) {
  return page.locator(`head meta[name="${key}"], head meta[property="${key}"]`)
}

/**
 * A Story whose two Scenes each carry one Image, the first of them opening it,
 * read back the way the bench reads it.
 */
async function storyWithImages(request: Parameters<typeof writeStory>[0]) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  const [street, bar] = read.scenes
  const first = street!.shots[0]!
  const late = bar!.shots[0]!
  for (const shot of [first, late]) {
    expect((await request.put(`/api/shots/${shot.id}/image`, { data: ONE_PIXEL })).status()).toBe(200)
  }
  await request.post(`/api/scenes/${street!.id}/opening`)

  return { story, street: street!, first, late }
}

/**
 * Visits each page of the table and reads its tab: a published Story to name
 * the reading page and the bench by, an Author's Profile under their Name and
 * then under none, and the page a Profile nobody has stands in for.
 */
async function namesEveryPage(
  { page, request, author }: { page: Page, request: Parameters<typeof writeStory>[0], author: Author },
  prefix: '' | '/fr',
  titles: { catalogue: string, lists: string, stories: string, unnamed: string, gone: string },
) {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  await request.post(`/api/scenes/${read.scenes[0]!.id}/opening`)
  await request.post(`/api/stories/${story.id}/publish`)

  for (const [path, title] of [
    [prefix || '/', 'Frameline'],
    [`${prefix}/catalogue`, `${titles.catalogue} · Frameline`],
    [`${prefix}/lists`, `${titles.lists} · Frameline`],
    [`${prefix}/stories`, `${titles.stories} · Frameline`],
    [`${prefix}/stories/${story.id}`, 'A Story · Frameline'],
    [`/read/${story.id}`, 'A Story · Frameline'],
    [`${prefix}/profile/${author.id}`, `${author.name} · Frameline`],
    [`${prefix}/profile/${randomUUID()}`, `${titles.gone} · Frameline`],
  ] as const) {
    await page.goto(path)
    await expect(page, path).toHaveTitle(title)
  }

  await forgetName(author)
  await page.goto(`${prefix}/profile/${author.id}`)
  await expect(page).toHaveTitle(`${titles.unnamed} · Frameline`)
}

test('every page names itself in English', async ({ page, request, author }) => {
  await namesEveryPage({ page, request, author }, '', {
    catalogue: 'Catalogue', lists: 'Lists', stories: 'Stories',
    unnamed: 'An Author', gone: 'No such Story.',
  })
})

test.describe('read in French', () => {
  test.use({ locale: 'fr-FR' })

  test('every page names itself in French', async ({ page, request, author }) => {
    await namesEveryPage({ page, request, author }, '/fr', {
      catalogue: 'Catalogue', lists: 'Listes', stories: 'Récits',
      unnamed: 'Un Auteur', gone: 'Ce Récit n\'existe pas.',
    })
  })
})

test('the bench\'s tab follows the title as it is rewritten', async ({ page, request }) => {
  const story = await writeStory(request)

  await page.goto(`/stories/${story.id}`)
  await live(page)
  await expect(page).toHaveTitle('A Story · Frameline')
  await page.locator('#story-title').fill('A Story Renamed')
  await expect(page).toHaveTitle('A Story Renamed · Frameline')
})

test('a published Story\'s link carries its title, its Synopsis and its Cover', async ({ browser, baseURL, request }) => {
  const { story, late } = await storyWithImages(request)
  const title = 'The "Lovers" <of> the Bridge & Co'
  const synopsis = 'Two strangers, one bridge, and the night between them.'
  for (const data of [{ title }, { synopsis }, { coverShotId: late.id }]) {
    expect((await request.patch(`/api/stories/${story.id}`, { data })).status()).toBe(200)
  }
  await request.post(`/api/stories/${story.id}/publish`)

  const { page, status, html } = await unfurled(browser, baseURL!, `/read/${story.id}`)
  expect(status).toBe(200)

  // Escaped on the way out, and so read back whole.
  expect(html).not.toContain(title)
  expect(await page.title()).toBe(`${title} · Frameline`)
  await expect(meta(page, 'og:title')).toHaveAttribute('content', title)
  await expect(meta(page, 'og:type')).toHaveAttribute('content', 'website')
  await expect(meta(page, 'og:site_name')).toHaveAttribute('content', 'Frameline')
  await expect(meta(page, 'og:url')).toHaveAttribute('content', `${baseURL}/read/${story.id}`)
  await expect(meta(page, 'description')).toHaveAttribute('content', synopsis)
  await expect(meta(page, 'og:description')).toHaveAttribute('content', synopsis)
  await expect(meta(page, 'twitter:card')).toHaveAttribute('content', 'summary_large_image')

  const image = await meta(page, 'og:image').getAttribute('content')
  expect(image).toMatch(new RegExp(`^https?://[^/]+/api/shots/${late.id}/image$`))

  // The image is as public as the link it presents, and answers whoever asks.
  const bytes = await page.context().request.get(image!)
  expect(bytes.status()).toBe(200)
  expect(bytes.headers()['content-type']).toMatch(/^image\//)

  await page.context().close()
})

test('with no Cover named, the Opening Scene\'s first Image presents the link', async ({ browser, baseURL, request }) => {
  const { story, first } = await storyWithImages(request)
  await request.post(`/api/stories/${story.id}/publish`)

  const { page } = await unfurled(browser, baseURL!, `/read/${story.id}`)
  await expect(meta(page, 'og:image'))
    .toHaveAttribute('content', new RegExp(`^https?://[^/]+/api/shots/${first.id}/image$`))

  await page.context().close()
})

test('a link to a Story with no Synopsis and no Image invents neither', async ({ browser, baseURL, request }) => {
  const story = await writeStory(request)
  const read: StoryInEditor = await (await request.get(`/api/stories/${story.id}`)).json()
  await request.post(`/api/scenes/${read.scenes[0]!.id}/opening`)
  await request.post(`/api/stories/${story.id}/publish`)

  const { page } = await unfurled(browser, baseURL!, `/read/${story.id}`)
  await expect(meta(page, 'og:title')).toHaveAttribute('content', 'A Story')
  for (const key of ['description', 'og:description', 'og:image']) {
    await expect(meta(page, key), key).toHaveCount(0)
  }
  await expect(meta(page, 'twitter:card')).toHaveAttribute('content', 'summary')

  await page.context().close()
})

test('an unpublished Story\'s link names no Story', async ({ browser, baseURL, request }) => {
  const story = await writeStory(request)
  const title = `Not Yet ${randomUUID()}`
  await request.patch(`/api/stories/${story.id}`, { data: { title } })

  const { page, status, html } = await unfurled(browser, baseURL!, `/read/${story.id}`)
  expect(status).toBe(404)
  expect(html).not.toContain(title)
  expect(await page.title()).toBe('No such Story. · Frameline')
  await expect(meta(page, 'og:title')).toHaveCount(0)

  await page.context().close()
})

test('the product\'s own address unfurls by its pitch', async ({ browser, baseURL }) => {
  const { page } = await unfurled(browser, baseURL!, '/')
  const pitch = 'An editor for interactive narrative works that speaks the grammar of cinema. Write in Shots, draw Exits between Scenes, and hand a Reader one link.'

  expect(await page.title()).toBe('Frameline')
  await expect(meta(page, 'og:title')).toHaveAttribute('content', 'Frameline')
  await expect(meta(page, 'description')).toHaveAttribute('content', pitch)
  await expect(meta(page, 'og:description')).toHaveAttribute('content', pitch)

  await page.context().close()
})
