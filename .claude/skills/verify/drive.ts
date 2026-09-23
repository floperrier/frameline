import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { chromium, type Browser, type Page } from '@playwright/test'
import { sealSession, type H3Event } from 'h3'
import { DISMISSED } from '../../../app/utils/steps.ts'

export { expect } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const state = join(root, '.verify')
const seeded = join(state, 'authors')

export const sql = neon(process.env.DATABASE_URL!)

export type Author = { id: string, email: string, name: string | null }

/**
 * Signs a fresh Author into the build `verify.sh launch` started, the way
 * `tests/e2e/author.ts` does: the row is inserted and the `nuxt-session` cookie
 * nuxt-auth-utils would have written is sealed with the same password, because
 * no agent can drive GitHub's or Google's login page. Everything past that
 * cookie is the real app.
 */
export async function session(label: string, { guided = false } = {}) {
  const port = readFileSync(join(state, 'server.port'), 'utf8').trim()
  const baseURL = `http://localhost:${port}`
  const run = join(state, 'runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`)
  mkdirSync(run, { recursive: true })

  const author = await seedAuthor()
  const browser = await chromium.launch()
  const context = await open(browser, baseURL, run, 'author')
  await context.addCookies([{ name: 'nuxt-session', value: await seal(author), url: baseURL }])
  if (!guided) {
    // The guided path's bubble covers the bench; an Author who knows the bench
    // waves it away, which is a key in local storage per Story.
    await context.addInitScript((waved) => {
      const read = Storage.prototype.getItem
      Storage.prototype.getItem = function (key: string) {
        return key.startsWith(waved) ? '1' : read.call(this, key)
      }
    }, DISMISSED)
  }
  const page = await context.newPage()
  let step = 0

  return {
    author,
    baseURL,
    run,
    page,
    /** The Author's own API client: same cookie jar as `page`. */
    request: context.request,
    /** Somebody with no account, in a context of their own. */
    async reader() {
      return (await open(browser, baseURL, run, 'reader')).newPage()
    },
    /** Waits until Vue has mounted, which `page.goto` does not. */
    async live(on: Page = page) {
      await on.waitForFunction(() => {
        const mounted = document.getElementById('__nuxt')
        return !!mounted && '__vue_app__' in mounted
      })
    },
    /** A numbered screenshot and ARIA snapshot of `on`, kept in `run`. */
    async proof(name: string, on: Page = page) {
      const file = join(run, `${String(++step).padStart(2, '0')}-${name}`)
      await on.screenshot({ path: `${file}.png`, fullPage: true })
      writeFileSync(`${file}.aria.txt`, await on.locator('body').ariaSnapshot())
    },
    async close() {
      await browser.close()
      await sql`delete from authors where id = ${author.id}`
    },
  }
}

async function open(browser: Browser, baseURL: string, run: string, who: string) {
  const context = await browser.newContext({
    baseURL,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  })
  const log = (line: string) => appendFileSync(join(run, 'browser.log'), `${who} ${line}\n`)
  context.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/')) {
      log(`${response.request().method()} ${url.pathname} ${response.status()}`)
    }
  })
  context.on('console', (message) => {
    if (message.type() === 'error') log(`console.error ${message.text()}`)
  })
  context.on('weberror', (error) => log(`pageerror ${error.error().message}`))
  return context
}

async function seedAuthor() {
  const [author] = await sql`
    insert into authors (email, name)
    values (${`verify-${randomUUID()}@example.test`}, 'A Verifier')
    returning id, email, name` as Author[]
  appendFileSync(seeded, `${author!.id}\n`)
  return author!
}

async function seal(author: Author) {
  const session = { id: randomUUID(), createdAt: Date.now(), data: { user: author } }
  const event = { context: { sessions: { 'nuxt-session': session } } } as unknown as H3Event
  return sealSession(event, { name: 'nuxt-session', password: process.env.NUXT_SESSION_PASSWORD! })
}

/** Deletes the Authors a session seeded and never closed, with the Stories that cascade from them. */
export async function sweep() {
  if (!existsSync(seeded)) return 0
  let deleted = 0
  for (const id of readFileSync(seeded, 'utf8').split('\n').filter(Boolean)) {
    deleted += (await sql`delete from authors where id = ${id} returning id`).length
  }
  rmSync(seeded)
  return deleted
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'sweep') {
  console.log(`deleted ${await sweep()} Author(s) an unclosed session left`)
}
