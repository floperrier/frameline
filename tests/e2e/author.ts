import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { test as base, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { DISMISSED } from '../../app/utils/steps'
import type { Condition, Exit, Scene, Sets, Shot } from '../../shared/utils/scenes'
import { NODE_GAP, NODE_SPACING, NODE_WIDTH, NODES_PER_COLUMN } from '../../shared/utils/scenes'
import { sealSession, type H3Event } from 'h3'

const sql = neon(process.env.DATABASE_URL!)

/**
 * One real PNG, a single pixel of it, for the specs that attach an image to a
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
 *
 * `guided` is whether the bench's guided path is left switched on. It is off for
 * every spec but its own: a Story part-written is a Story the guidance has
 * something to say about, and the bubble it says it in is a panel over the bench
 * that a spec about something else would be clicking through. Waving it away is
 * exactly what an Author who knows what they are doing does, and it is a key in
 * local storage per Story — which a spec cannot write before it knows which
 * Story, so the read is answered instead, for every Story at once.
 */
export const test = base.extend<{ author: Author, otherAuthor: Author, guided: boolean }>({
  author: ({}, use) => withFreshAuthor(use),

  otherAuthor: ({}, use) => withFreshAuthor(use),

  guided: [false, { option: true }],

  page: async ({ page, guided }, use) => {
    if (!guided) {
      await page.addInitScript((waved) => {
        const read = Storage.prototype.getItem
        Storage.prototype.getItem = function (key: string) {
          return key.startsWith(waved) ? '1' : read.call(this, key)
        }
      }, DISMISSED)
    }

    await use(page)
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
 * Takes an Author's Name away, which is the state an account is in when the
 * provider handed none back. The fixture Author arrives with one, because that
 * is the ordinary case and every other spec would otherwise be asked for a Name
 * the first time it lists something.
 *
 * The Author it hands back is the one to sign in again as: the session is sealed
 * with the Name it was sealed at, so a browser signed in before this still
 * carries the Name the database no longer holds.
 */
export async function forgetName(author: Author): Promise<Author> {
  await sql`update authors set name = null where id = ${author.id}`

  return { ...author, name: null }
}

/**
 * Seals the session again for an Author a spec has changed underneath the
 * browser, which is what signing in afresh would do.
 */
export async function signInAgain(context: BrowserContext, author: Author, baseURL?: string) {
  await context.clearCookies({ name: 'nuxt-session' })
  await context.addCookies([
    { name: 'nuxt-session', value: await sealAuthorSession(author), url: baseURL! },
  ])
}

/** Puts the picture a provider handed back on an Author, the way signing in does. */
export async function seedAvatar(author: Author, avatar: string) {
  await sql`update authors set avatar = ${avatar} where id = ${author.id}`
}

/** Reads what an Author is called past the API, to see what a rename really wrote. */
export async function readAuthorName(id: string) {
  const [author] = await sql`select name from authors where id = ${id}` as { name: string | null }[]

  return author!.name
}

/** Lists a Story past the API, on behalf of an Author nobody is signed in as. */
export async function seedListed(story: Story) {
  await sql`update stories set listed = true where id = ${story.id}`
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

/**
 * Publishes a Story past the API, on behalf of an Author nobody is signed in as.
 * It is also the shape a Story published before the Catalogue existed has: a row
 * with `published_at` set and nobody ever having said anything about listing it.
 */
export async function seedPublished(story: Story) {
  await sql`update stories set published_at = now() where id = ${story.id}`
}

/**
 * Writes a Comment under a Story on behalf of an Author nobody is signed in as —
 * a second Author answering, which the API deliberately offers no way to fake.
 */
export async function seedComment(story: Story, author: Author, text: string) {
  const [comment] = await sql`
    insert into comments (story_id, author_id, text)
    values (${story.id}, ${author.id}, ${text})
    returning id, text` as { id: string, text: string }[]

  return comment!
}

/** Reads what stands under a Story past the API, oldest first, to see what a delete left. */
export async function readComments(storyId: string) {
  return await sql`
    select id, text from comments where story_id = ${storyId}
    order by created_at` as { id: string, text: string }[]
}

/**
 * Writes a List for an Author nobody is signed in as, so a spec has somebody
 * else's shelf to fail to reach. The API deliberately offers no way to write one
 * for another Author.
 */
export async function seedList(author: Author, title: string | null) {
  const [list] = await sql`
    insert into lists (author_id, title)
    values (${author.id}, ${title})
    returning id, title` as { id: string, title: string | null }[]

  return list!
}

/** Reads what is in a List past the API, to see what gathering a Story really wrote. */
export async function readListStories(listId: string) {
  return await sql`
    select stories.id, stories.title
    from list_stories join stories on stories.id = list_stories.story_id
    where list_stories.list_id = ${listId}
    order by list_stories.added_at desc` as { id: string, title: string }[]
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
  const scenes = await sql`
    insert into scenes (story_id, name, x, y)
    select
      ${story.id},
      name,
      ((place - 1) / ${NODES_PER_COLUMN}) * ${NODE_WIDTH + NODE_GAP},
      ((place - 1) % ${NODES_PER_COLUMN}) * ${NODE_SPACING}
    from unnest(${names}::text[]) with ordinality as named (name, place)
    returning id, name` as Pick<Scene, 'id' | 'name'>[]

  // A Shot apiece, written rather than empty, because a Scene the API made
  // arrives with none and an Author's first move inside one is to write a Shot:
  // a graph seeded without them is a graph no Author would have stopped at.
  await sql`
    insert into shots (scene_id, text, position)
    select id, 'Their Shot', 0 from unnest(${scenes.map(scene => scene.id)}::uuid[]) as seeded (id)`

  return scenes
}

/**
 * Puts a Scene on the surface it is written on, the way the Author would. A
 * card carries nothing to type into — the Scene's name, the image of its first
 * Shot, its Shot count and where its ways on land — so a test that writes
 * anything about a Scene from the page opens its panel first.
 */
export async function writeScene(page: Page, name: string) {
  // Folded into a rail, the card itself is what is pressed: the button on it is
  // drawn at the rail's own scale and is no target for a hand — see
  // `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`. Either way the
  // press is a toggle, so a Scene pressed twice is closed.
  if (await page.locator('.bench.folded').count()) {
    return await page.getByRole('article', { name }).click()
  }

  await page.getByRole('button', { name: `Write Scene ${name}` }).click()
}

/**
 * What the bench has just said out loud. Reached by its own mark rather than by
 * the `status` role alone: the reading beside a Scene being written is a live
 * region too, so a bare role on this page can mean either of them.
 */
export function toast(page: Page) {
  return page.locator('.toast')
}

/** Draws an Exit on behalf of an Author nobody is signed in as. */
export async function seedExit(fromSceneId: string, toSceneId: string, text = 'Their Exit') {
  const drawn = await sql`
    insert into exits (from_scene_id, to_scene_id, text, position)
    values (${fromSceneId}, ${toSceneId}, ${text},
      coalesce((select max(position) + 1 from exits where from_scene_id = ${fromSceneId}), 0))
    returning
      id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text, position, conditions`

  return (drawn as Exit[])[0]!
}

/** Reads the Exits leaving a Scene past the API, in the Places the Scene numbers them at. */
export async function readExits(fromSceneId: string) {
  return await sql`
    select
      id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text, position, conditions
    from exits where from_scene_id = ${fromSceneId}
    order by position` as Exit[]
}

/**
 * Publishes a Story past the API, so a spec can start from one already out. The
 * opening Scene comes with it — the API refuses to publish a Story without one,
 * and a Scene seeded past the API leaves it unset — so what is seeded is a Story
 * the product would have allowed.
 */
export async function seedPublication(story: Story) {
  await sql`
    update stories set
      published_at = now(),
      opening_scene_id = coalesce(
        opening_scene_id,
        (select id from scenes where story_id = ${story.id} order by created_at limit 1))
    where id = ${story.id}`
}

/** Sets the Flags a Scene carries, past the API, on behalf of an Author. */
export async function seedFlags(sceneId: string, sets: Sets) {
  await sql`update scenes set sets = ${JSON.stringify(sets)}::jsonb where id = ${sceneId}`
}

/** Puts the Conditions a Shot plays under on it, past the API. */
export async function seedShotConditions(shotId: string, conditions: Condition[]) {
  await sql`
    update shots set conditions = ${JSON.stringify(conditions)}::jsonb where id = ${shotId}`
}

/** Reads the Flags a Scene sets on entry, past the API. */
export async function readFlags(sceneId: string) {
  const [scene] = await sql`
    select sets from scenes where id = ${sceneId}` as { sets: Sets }[]

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

/** Reads what a Scene is called past the API, to see what a rename really wrote. */
export async function readSceneName(id: string) {
  const [scene] = await sql`select name from scenes where id = ${id}` as { name: string }[]

  return scene!.name
}

/** Reads a Scene's Shots past the API, in the order the Scene numbers them. */
export async function readShots(sceneId: string) {
  return await sql`
    select id, text, position from shots
    where scene_id = ${sceneId}
    order by position` as Shot[]
}

/** Reads the Conditions each Shot of a Scene plays under, past the API and in Place order. */
export async function readShotConditions(sceneId: string) {
  const shots = await sql`
    select conditions from shots where scene_id = ${sceneId}
    order by position` as Pick<Shot, 'conditions'>[]

  return shots.map(shot => shot.conditions)
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
 * A Story of two Scenes joined by an Exit, written through the API the way the
 * Author's own hands would write it — so a Preview and a Reading both have real
 * Shots to play. Shared by the two specs that need a readable Story, because a
 * Reader must meet exactly what a Preview showed.
 */
export async function writeStory(request: APIRequestContext, language = 'en') {
  const story = await (await request.post('/api/stories', {
    data: { title: 'A Story', language },
  })).json()

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

  const exit = await (await request.post(`/api/scenes/${scenes[0]!.id}/exits`, {
    data: { toSceneId: scenes[1]!.id },
  })).json()
  await request.patch(`/api/exits/${exit.id}`, { data: { text: 'Follow her out' } })

  return story as { id: string, title: string, language: string }
}
