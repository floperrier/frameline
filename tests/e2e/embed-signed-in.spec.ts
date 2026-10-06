import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect } from '@playwright/test'
import { drizzle } from 'drizzle-orm/neon-http'
import { SAMPLES, imagePath } from '../../demonstration/samples'
import { soundPath } from '../../demonstration/sounds'
import * as schema from '../../server/db/schema'
import { plantSample } from '../../server/utils/samples'
import { live, test, toast, writeStory, type Author } from './author'
import type { APIRequestContext } from '@playwright/test'

/**
 * A published Story laid inside somebody else's page, from the code its Author
 * copies off the bench — issue #414 and
 * `docs/adr/0068-a-story-plays-inside-another-page.md`.
 *
 * The page it is laid in is a blog served by the spec itself at `127.0.0.1`,
 * which is a site of its own beside the suite's `localhost`, so the frame is
 * framed by another site exactly as an Author's blog would frame it. Served for
 * real rather than answered by the browser's router: a page the router answers
 * counts as a public one, and the browser refuses a public page a frame of a
 * server on the local network, which is all the suite's server is.
 */

/** The English Sample, planted the way a new account is given it: published. */
async function planted(author: Author, request: APIRequestContext) {
  await plantSample(author.id, 'en', {
    db: drizzle(process.env.DATABASE_URL!, { schema }),
    image: name => readFile(imagePath(name)),
    sound: file => readFile(soundPath(file)),
  })
  const [sample] = await (await request.get('/api/stories')).json() as { id: string }[]
  return sample!
}

test('the code copied off the bench plays the Story inside a blog\'s column',
  async ({ page, request, browser, baseURL, author }) => {
    const sample = await planted(author, request)
    // A title that has to be escaped to stay one attribute of the code.
    const title = 'Rain, "the street" & <night>'
    await request.patch(`/api/stories/${sample.id}`, { data: { title } })

    // The bench hands the code over and says so, from a control the bar of
    // Commands offers too.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/stories/${sample.id}`)
    await live(page)
    const copy = page.getByRole('button', { name: 'Copy the Embed Code' })
    await expect(copy).toHaveAttribute('data-command', 'Copy the Embed Code')
    await copy.click()
    await expect(toast(page)).toHaveText('The embed code is copied.')
    const code = await page.evaluate(() => navigator.clipboard.readText())
    expect(code).toBe(`<iframe src="${baseURL}/embed/${sample.id}" `
      + 'title="Rain, &quot;the street&quot; &amp; &lt;night&gt;" allow="fullscreen; autoplay" '
      + 'loading="lazy" style="width: 100%; height: 640px; border: 0"></iframe>')

    // A Reader with no account of ours, on a blog whose column is 720 pixels wide,
    // with the code pasted into it as it was copied.
    const blog = createServer((_, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(`<!doctype html><title>A blog</title><main style="width: 720px">${code}</main>`)
    }).listen(0, '127.0.0.1')
    await once(blog, 'listening')
    const reader = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
    await reader.goto(`http://127.0.0.1:${(blog.address() as AddressInfo).port}/`)
    const frame = reader.frameLocator('iframe')

    // The title card and one way out, to the reading page, in a tab of its own:
    // nothing the reading page draws around the Story comes with it.
    await expect(frame.getByRole('heading', { name: title })).toBeVisible()
    // Answering, as `live` waits for on a page of its own.
    const embedded = reader.frame({ url: `${baseURL}/embed/${sample.id}` })!
    await embedded.waitForFunction(() => '__vue_app__' in document.getElementById('__nuxt')!)
    const onward = frame.getByRole('link', { name: 'Read on Frameline' })
    await expect(onward).toHaveAttribute('href', `/read/${sample.id}`)
    await expect(onward).toHaveAttribute('target', '_blank')
    await expect(onward).toHaveAttribute('rel', 'noopener')
    await expect(frame.getByRole('link', { name: 'An Author' })).toHaveAttribute('target', '_blank')
    await expect(frame.getByRole('heading', { name: 'Comments' })).toHaveCount(0)
    await expect(frame.getByText('Favourite')).toHaveCount(0)
    await expect(frame.getByRole('link', { name: 'Find Stories in the Catalogue' })).toHaveCount(0)

    // Its head sends a search engine to the reading page rather than to the frame.
    expect(await embedded.title()).toBe(`${title} · Frameline`)
    await expect(frame.locator('link[rel="canonical"]'))
      .toHaveAttribute('href', `${baseURL}/read/${sample.id}`)
    await expect(frame.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')

    // At the height the code gives the frame, the card's press is in it, and once
    // begun so are the opening Shot and the press that goes on from it, with
    // nothing scrolled.
    const beginning = frame.getByRole('button', { name: 'Begin' })
    await expect(beginning).toBeInViewport({ ratio: 1 })
    await beginning.click()
    const next = frame.getByRole('button', { name: 'Next Shot' })
    await expect(frame.getByText(SAMPLES.en.scenes[0]!.shots[0]!.text)).toBeInViewport()
    await expect(next).toBeInViewport({ ratio: 1 })
    // The code allows the frame the whole screen, so the Reading offers it.
    await expect(frame.getByRole('button', { name: 'Full Screen' })).toBeVisible()

    // The opening Scene is cut by the clock, so it is paused before it is walked;
    // a press still goes on. Each press waits for the one before it to land, and
    // *Next Shot* is drawn no longer once the Exits are, so none can overshoot.
    await frame.getByRole('button', { name: 'Pause the Reading' }).click()
    const skip = frame.getByRole('button', { name: 'Skip the second Scene' })
    await expect(async () => {
      if (await skip.isHidden()) await next.click({ timeout: 1000 })
      await expect(skip).toBeVisible({ timeout: 1000 })
    }).toPass()
    await skip.click()
    await expect(frame.locator('.frame .shot')).toContainText('A Condition is one flat test on State')
    blog.close()
  })

test('only the embed may be framed by another site', async ({ request, author }) => {
  const sample = await planted(author, request)

  const embed = await request.get(`/embed/${sample.id}`)
  expect(embed.status()).toBe(200)
  expect(embed.headers()['content-security-policy']).toBe('frame-ancestors *')
  expect(embed.headers()['x-frame-options']).toBeUndefined()

  // The reading page, the bench and the API keep refusing every other site.
  for (const path of [`/read/${sample.id}`, `/stories/${sample.id}`, `/api/read/${sample.id}`]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['content-security-policy'], path).toBe('frame-ancestors \'self\'')
    expect(response.headers()['x-frame-options'], path).toBe('SAMEORIGIN')
  }
})

test('an unpublished Story has no embed', async ({ page, request }) => {
  const story = await writeStory(request)

  const response = await page.goto(`/embed/${story.id}`)
  expect(response!.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'No such Story.' })).toBeVisible()
})
