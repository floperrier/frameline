import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { test as base, type APIRequestContext } from '@playwright/test'
import type { Cut, Flags, Scene, Shot } from '../../shared/utils/scenes'
import { NODE_GAP, NODE_SPACING, NODE_WIDTH, NODES_PER_COLUMN } from '../../shared/utils/scenes'
import { sealSession, type H3Event } from 'h3'

const sql = neon(process.env.DATABASE_URL!)

/**
 * One real PNG, a single pixel of it, for the specs that attach a still to a
 * Shot. A file rather than a shape: the server reads the format out of the first
 * bytes, so only bytes a decoder would accept prove anything.
 */
export const ONE_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

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

/**
 * Writes a whole graph of Scenes at once, for one too large to build a request at
 * a time, laid out in the columns the API would have laid them out in.
 */
export async function seedScenes(story: Story, names: string[]) {
  return await sql`
    insert into scenes (story_id, name, x, y)
    select
      ${story.id},
      name,
      ((place - 1) / ${NODES_PER_COLUMN}) * ${NODE_WIDTH + NODE_GAP},
      ((place - 1) % ${NODES_PER_COLUMN}) * ${NODE_SPACING}
    from unnest(${names}::text[]) with ordinality as named (name, place)
    returning id, name` as Pick<Scene, 'id' | 'name'>[]
}

/** Draws a Cut on behalf of an Author nobody is signed in as. */
export async function seedCut(fromSceneId: string, toSceneId: string, text = 'Their Cut') {
  const drawn = await sql`
    insert into cuts (from_scene_id, to_scene_id, text, position)
    values (${fromSceneId}, ${toSceneId}, ${text},
      coalesce((select max(position) + 1 from cuts where from_scene_id = ${fromSceneId}), 0))
    returning
      id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text, position, conditions`

  return (drawn as Cut[])[0]!
}

/** Reads the Cuts leaving a Scene past the API, in the Places the Scene numbers them at. */
export async function readCuts(fromSceneId: string) {
  return await sql`
    select
      id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text, position, conditions
    from cuts where from_scene_id = ${fromSceneId}
    order by position` as Cut[]
}

/** Reads the Flags a Scene sets on entry, past the API. */
export async function readFlags(sceneId: string) {
  const [scene] = await sql`
    select sets from scenes where id = ${sceneId}` as { sets: Flags }[]

  return scene!.sets
}

/** Reads where a Scene sits in the graph, and which Scene its Story opens on. */
export async function readScenePlacement(id: string) {
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

/**
 * A Story of two Scenes joined by a Cut, written through the API the way the
 * Author's own hands would write it — so a Preview and a Reading both have real
 * Shots to play. Shared by the two specs that need a readable Story, because a
 * Reader must meet exactly what a Preview showed.
 */
export async function writeStory(request: APIRequestContext) {
  const story = await (await request.post('/api/stories', { data: { title: 'A Story' } })).json()

  const scenes = []
  for (const [name, texts] of [
    ['The street', ['A door opens.', 'She steps out.']],
    ['The bar', ['Smoke, and no one she knows.']],
  ] as const) {
    const scene = await (await request.post(`/api/stories/${story.id}/scenes`, {
      data: { name },
    })).json()
    for (const text of texts) {
      const shot = await (await request.post(`/api/scenes/${scene.id}/shots`)).json()
      await request.patch(`/api/shots/${shot.id}`, { data: { text, description: '' } })
    }
    scenes.push(scene)
  }

  const cut = await (await request.post(`/api/scenes/${scenes[0]!.id}/cuts`, {
    data: { toSceneId: scenes[1]!.id },
  })).json()
  await request.patch(`/api/cuts/${cut.id}`, { data: { text: 'Follow her out' } })

  return story as { id: string, title: string }
}
