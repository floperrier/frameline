import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { test as base } from '@playwright/test'
import { sealSession, type H3Event } from 'h3'

const sql = neon(process.env.DATABASE_URL!)

export type Author = { id: string, email: string, name: string | null }

/**
 * Signs a test Author in without going through OAuth. Driving GitHub's or
 * Google's login page from a test is not something we can do, so instead we
 * seal the very `nuxt-session` cookie nuxt-auth-utils would have written at the
 * end of `signInAuthor` — same password, same session shape. Everything past
 * the redirect is then exercised for real.
 */
export const test = base.extend<{ author: Author }>({
  author: async ({}, use) => {
    const [author] = await sql`
      insert into authors (email, name)
      values (${`e2e-${randomUUID()}@example.test`}, 'An Author')
      returning id, email, name` as Author[]

    await use(author!)

    // Stories cascade from their Author, so one delete clears the whole test.
    await sql`delete from authors where id = ${author!.id}`
  },

  context: async ({ context, baseURL, author }, use) => {
    await context.addCookies([
      { name: 'nuxt-session', value: await sealAuthorSession(author), url: baseURL! },
    ])
    await use(context)
  },

  extraHTTPHeaders: async ({ author }, use) => {
    await use({ cookie: `nuxt-session=${await sealAuthorSession(author)}` })
  },
})

async function sealAuthorSession(author: Author) {
  const session = { id: randomUUID(), createdAt: Date.now(), data: { user: author } }

  // `sealSession` only reaches into `context.sessions`, so a stub stands in for
  // the request an event would otherwise carry.
  const event = { context: { sessions: { 'nuxt-session': session } } } as unknown as H3Event

  return sealSession(event, {
    name: 'nuxt-session',
    password: process.env.NUXT_SESSION_PASSWORD!,
  })
}
