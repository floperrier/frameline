import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { test as base } from '@playwright/test'
import type { Cut, Scene, Shot } from '../../shared/utils/scenes'
import { sealSession, type H3Event } from 'h3'

const sql = neon(process.env.DATABASE_URL!)

export type Author = { id: string, email: string, name: string | null }
type Story = { id: string, title: string }


/**
 * Signs a test Author in without going through OAuth. Driving GitHub's or
 * Google's login page from a test is not something we can do, so instead we
 * seal the very `nuxt-session` cookie nuxt-auth-utils would have written at the
 * end of `signInAuthor` — same password, same session shape. Everything past
 * the redirect is then exercised for real.
 *
 * `otherAuthor` is a second Author nobody is signed in as, so that what one
 * Author cannot reach can be written by someone real rather than made up.
 */
export const test = base.extend<{ author: Author, otherAuthor: Author }>({
  author: ({}, use) => withFreshAuthor(use),

  otherAuthor: ({}, use) => withFreshAuthor(use),

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

/** Seeds an Author for the length of one test, and takes them away after it. */
async function withFreshAuthor(use: (author: Author) => Promise<void>) {
  const [author] = await sql`
    insert into authors (email, name)
    values (${`e2e-${randomUUID()}@example.test`}, 'An Author')
    returning id, email, name` as Author[]

  await use(author!)

  // Stories cascade from their Author, so one delete clears the whole test.
  await sql`delete from authors where id = ${author!.id}`
}

/**
 * Writes a Story on behalf of an Author the test is not signed in as — the one
 * thing the API deliberately offers no way to do.
 */
export async function seedStory(author: Author, title: string) {
  const [story] = await sql`
    insert into stories (author_id, title)
    values (${author.id}, ${title})
    returning id, title` as Story[]

  return story!
}

/** Writes a Scene, and a Shot in it, on behalf of an Author nobody is signed in as. */
export async function seedScene(story: Story, name: string) {
  const [scene] = await sql`
    insert into scenes (story_id, name)
    values (${story.id}, ${name})
    returning id, name` as Pick<Scene, 'id' | 'name'>[]

  const [shot] = await sql`
    insert into shots (scene_id, text, position)
    values (${scene!.id}, 'Their Shot', 0)
    returning id, text, position` as Shot[]

  return { ...scene!, shots: [shot!] }
}

/** Writes a whole column of Scenes at once, for a graph too large to build a request at a time. */
export async function seedScenes(story: Story, names: string[]) {
  return await sql`
    insert into scenes (story_id, name, y)
    select ${story.id}, name, (place - 1) * 340
    from unnest(${names}::text[]) with ordinality as named (name, place)
    returning id, name` as Pick<Scene, 'id' | 'name'>[]
}

/** Draws a Cut on behalf of an Author nobody is signed in as. */
export async function seedCut(fromSceneId: string, toSceneId: string, text = 'Their Cut') {
  const [cut] = await sql`
    insert into cuts (from_scene_id, to_scene_id, text)
    values (${fromSceneId}, ${toSceneId}, ${text})
    returning id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text` as Cut[]

  return cut!
}

/** Reads the Cuts leaving a Scene past the API. */
export async function readCuts(fromSceneId: string) {
  return await sql`
    select id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text
    from cuts where from_scene_id = ${fromSceneId}
    order by created_at, id` as Cut[]
}

/** Reads where a Scene's node sits, and which Scene its Story opens on. */
export async function readSceneNode(id: string) {
  const [node] = await sql`
    select scenes.x, scenes.y, stories.opening_scene_id as "openingSceneId"
    from scenes join stories on stories.id = scenes.story_id
    where scenes.id = ${id}` as { x: number, y: number, openingSceneId: string | null }[]

  return node!
}

/** Reads a Scene's Shots past the API, in the order the Scene numbers them. */
export async function readShots(sceneId: string) {
  return await sql`
    select id, text, position from shots
    where scene_id = ${sceneId}
    order by position` as Shot[]
}

/** Reads a Story past the API, to see what a refused request left behind. */
export async function readStory(id: string) {
  const [story] = await sql`select id, title from stories where id = ${id}` as Story[]

  return story
}

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
