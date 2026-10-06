import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import {
  expect, test as base, type APIRequestContext, type BrowserContext, type Locator, type Page,
} from '@playwright/test'
import { DISMISSED } from '../../app/utils/steps'
import type { Condition, Exit, Scene, Sets, Shot, StoryInEditor } from '../../shared/utils/scenes'
import { sealSession, type H3Event } from 'h3'
import { routeToLocalProxy } from '../../server/db/endpoint'

// The suite's own database sits behind a local proxy, not on Neon, and every
// spec that writes to it directly comes through here.
routeToLocalProxy()
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

/**
 * One real MP3, a few frames of silence, for the specs that deposit a Sound. A
 * file rather than a shape, for the reason the pixel above is one — and an MP3
 * rather than an `.m4a`, because the Chromium Playwright ships carries no AAC
 * decoder and a browser that cannot decode what it is handed proves nothing.
 */
export const A_SOUND = readFileSync(new URL('silence.mp3', import.meta.url))

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

  // One connection per request. Playwright sends every API request a worker makes
  // through one keep-alive agent that sets no idle limit of its own — Node heeds
  // the server's `Keep-Alive: timeout=5` only on an agent that has one — so the
  // socket one test left idle is the one the next test's first request is written
  // on. When that gap is the server's own, six seconds with its grace, and the
  // server is busy rendering for three other browsers, its timer closes the socket
  // under a request that has just arrived: `read ECONNRESET`, on a POST nothing may
  // send again. A connection closed behind its response is never left idle.
  request: async ({ playwright, extraHTTPHeaders }, use) => {
    const request = await playwright.request.newContext({
      extraHTTPHeaders: { ...extraHTTPHeaders, connection: 'close' },
    })
    await use(request)
    await request.dispose()
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
 * a time, and hands them back in the order it was asked for.
 *
 * The ids are drawn here rather than read back out of the insert, because Postgres
 * promises no order for the rows `RETURNING` emits — `with ordinality` orders what
 * the insert reads, never what comes back — so a chain of Exits built by walking
 * the result was a chain whose depth nobody chose. See issue #261.
 */
export async function seedScenes(story: Story, names: string[]) {
  const scenes: Pick<Scene, 'id' | 'name'>[] = names.map(name => ({ id: randomUUID(), name }))

  await sql`
    insert into scenes (id, story_id, name)
    select id, ${story.id}, name
    from unnest(${scenes.map(scene => scene.id)}::uuid[], ${names}::text[]) as seeded (id, name)`

  // A Shot apiece, written rather than empty, because a Scene the API made
  // arrives with none and an Author's first move inside one is to write a Shot:
  // a graph seeded without them is a graph no Author would have stopped at.
  await sql`
    insert into shots (scene_id, text, position)
    select id, 'Their Shot', 0 from unnest(${scenes.map(scene => scene.id)}::uuid[]) as seeded (id)`

  return scenes
}

/**
 * A Story long enough to read down, in one known order: the Scenes named, each
 * joined to the one after it, and the first marked as the Scene the Story opens
 * on. The order a Story is written in is read off the Story — how far each Scene
 * stands from the opening, in Exits taken — so a chain is the one shape whose
 * document runs in the order it was asked for, and the opening has to be named or
 * the walk starts from whichever Scene the insert happened to hand back first,
 * which is issue #261 one column over. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 */
export async function seedChain(story: Story, names: string[]) {
  const scenes = await seedScenes(story, names)
  for (const [place, scene] of scenes.entries()) {
    if (place) await seedExit(scenes[place - 1]!.id, scene.id)
  }
  await sql`update stories set opening_scene_id = ${scenes[0]!.id} where id = ${story.id}`

  return scenes
}

/**
 * Puts the caret in a Scene, the way an Author would: by pressing its mark on the
 * rail. Every Scene of the Story is written where it stands since #252, so the
 * writing surface is up for all of them at once and waiting for it says nothing
 * about where the caret is. What a press moves is the caret — the rail lights that
 * Scene's mark, the address names it, and the marks a row carries for the bar of
 * Commands and for the guided path go with it — so the lit mark is what this waits
 * for. A Scene whose mark is already lit is left alone, because pressing it would
 * be asking to go where the caret already is. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 *
 * The server draws the first Scene lit, so a mark lit is no sign that anything
 * answers yet: the page is waited on until it is `live` below, or the press the
 * caller makes next lands on a button the browser has not taken over.
 */
export async function writeScene(page: Page, name: string) {
  await live(page)
  const mark = sceneNode(page, name)
  await expect(mark).toBeVisible()
  if (!(await mark.getAttribute('class'))?.split(' ').includes('here')) await mark.click()

  await expect(mark).toHaveClass(/\bhere\b/)
}

/**
 * A Scene as the rail draws it: the Graph is two hundred and twenty pixels down
 * the side of the document, and a Scene in it is a point and no words — no image,
 * no name, nothing but where it stands and the lines arriving at it — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md` and
 * `docs/adr/0045-the-rail-draws-the-ways-on.md`.
 *
 * `getByRole` cannot reach one, and that is the rail working as designed rather
 * than an oversight to route around. The rail is `aria-hidden` with every mark at
 * `tabindex="-1"`, because every fact it draws — where a Scene stands in the
 * Story, whether the Story opens on it, whether anything arrives at it, which
 * Scenes its ways on reach — is said in words in the document's own markup, and a drawing in the accessibility tree
 * would be the whole Story announced twice with a tab order running through it.
 * So a mark is found by the name the bar of Commands reads it under, which is the
 * one thing about the rail that does still reach the keyboard:
 * `app/components/Commands.vue` filters by `checkVisibility()`, which does not
 * consult `aria-hidden` — see
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
 * Scoped to the rail all the same, because a way on's own row in the Scene being
 * written carries a control named *Go to* the Scene it lands on.
 *
 * Still `sceneNode` rather than `sceneMark`. *Node* is `CONTEXT.md`'s word for a
 * Scene as the Graph draws it, and the rail is the Graph read small rather than a
 * second surface; *mark* is the class the rail gives it, and it is a word two
 * other things on the bench already carry — the controls that renumber a row, and
 * what `0035` calls a control named for the bar — so it is not the word to take
 * for this one.
 */
export function sceneNode(page: Page, name: string) {
  return page.locator(`.rail [data-command="Go to ${name}"]`)
}

/**
 * Turns the middle of the bench onto the Story read on the engine a Reader runs.
 * The rail and the Remarks do not move between the readings — what changes is
 * what the middle is a reading of, never where anything is — so the Preview
 * arrives in the document's own place rather than in a box of its own. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which keeps `0030`'s
 * engine rule and supersedes its *beside*.
 */
export async function readTheStory(page: Page) {
  const preview = page.getByRole('region', { name: /^Preview/ })
  if (!await preview.isVisible()) {
    await page.getByRole('button', { name: 'Read the Story' }).click()
  }
  await expect(preview).toBeVisible()

  return preview
}

/**
 * Writes a Shot's text as an Author does since #359: a Shot nobody is writing in
 * is its text drawn in a box, and pressing the box mounts the one editor in its
 * place, under the same id and name and with the focus — so the press comes
 * first, and nothing is typed until the editor has the caret, or the keys land on
 * a box that is about to go. Everything in it is then replaced, a line at a time,
 * because a line break in the editor is `Shift+Enter` and `Enter` opens the next
 * Shot. It writes nothing until the caret leaves, as a field did, so a caller that
 * wants it written blurs it.
 */
export async function writeShot(box: Locator, text: string) {
  const page = box.page()
  const id = await box.getAttribute('id')
  await box.click()
  await expect(page.locator(`[id="${id}"].ProseMirror`)).toBeFocused()

  await page.keyboard.press('ControlOrMeta+A')
  if (!text) return page.keyboard.press('Delete')
  for (const [at, line] of text.split('\n').entries()) {
    if (at) await page.keyboard.press('Shift+Enter')
    if (line) await page.keyboard.type(line)
  }
}

/**
 * Opens what a Shot plays as, which its row keeps folded under one line since
 * #401 — the Sound picker, the Cut, the Layout, the Movement, the Effects and how
 * its text arrives — or how a Scene plays, which its head keeps folded the same
 * way since #400. A fold already open is left alone, because a `<summary>`
 * toggles and a second press would shut it. Found by the name its line carries,
 * `Shot 2 of The street` or `The street`, and handed back for a caller that reads
 * what it holds.
 */
export async function unfold(page: Page, named: string) {
  await live(page)
  const fold = page.locator('details.plays', {
    has: page.locator('summary > .visually-hidden').getByText(named, { exact: true }),
  })
  if (!await fold.evaluate(details => (details as HTMLDetailsElement).open)) {
    await fold.locator('summary').click()
  }
  await expect(fold).toHaveAttribute('open')

  return fold
}

/**
 * Opens the rest of a Shot's styles under the formatting bar's one row, which the
 * bar keeps shut until *More Styles* is pressed since #398 — the small capitals,
 * the scripts, every select but the line's kind, and the Effects of the words. A
 * panel already open is left alone, because it stays open from Shot to Shot and a
 * second press would shut it.
 */
export async function moreStyles(toolbar: Locator) {
  const more = toolbar.getByRole('button', { name: /^More Styles/ })
  if (await more.getAttribute('aria-expanded') !== 'true') await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
}

/**
 * A Shot's words as the bench counts them — its lines joined by a line break —
 * read off the box or the editor, whichever is drawn: `toHaveText` reads the text
 * of every line run together.
 */
export function shotText(box: Locator) {
  return box.evaluate(drawn => [...drawn.querySelectorAll('p')].map(line => line.textContent).join('\n'))
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
 *
 * Which Scene opens is named rather than looked up. The Scenes `seedScenes` writes
 * share one `created_at` to the microsecond, being one insert, so asking the table
 * for its earliest asks it to pick, which is issue #261 again one column over.
 */
export async function seedPublication(story: Story, opening?: Pick<Scene, 'id'>) {
  await sql`
    update stories set
      published_at = now(),
      opening_scene_id = coalesce(opening_scene_id, ${opening?.id ?? null}::uuid)
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

/**
 * Waits for the page to be answering, which `page.goto` does not: it returns
 * when the document has loaded and not when Vue has attached anything to it, so
 * a form submitted before then is submitted by the browser instead — the page
 * reloads and what the Author typed is never written. Vue puts itself on the
 * element it mounts, so that is the mark there is to wait for.
 */
export async function live(page: Page) {
  await page.waitForFunction(() => {
    const mounted = document.getElementById('__nuxt')
    return !!mounted && '__vue_app__' in mounted
  })
}

/**
 * `writeStory`, changed as the caller asks, published, and opened into a live
 * Reading through the Reader's own door — the door `live` above waits for, so
 * a clock the Reading arms as it mounts is armed before the caller looks for
 * anything it starts. Shared by every spec that reads a Story published past
 * the API rather than writes one, because each would otherwise open it in
 * exactly the same few calls.
 */
export async function opened(
  page: Page,
  request: APIRequestContext,
  write: (story: { id: string }, scenes: StoryInEditor['scenes']) => Promise<void>,
) {
  const story = await writeStory(request)
  const { scenes } = await (await request.get(`/api/stories/${story.id}`))
    .json() as StoryInEditor

  await write(story, scenes)
  await seedPublished(story)
  await page.goto(`/read/${story.id}`)
  await begin(page)
}

/**
 * Begins a Reading from the title card every Story opens on since #409, which is
 * where the Reading is mounted and its clock started: nothing of it is on the page
 * before the press. Waited on until the page is `live` first, because a press on a
 * button the browser has not taken over does nothing at all. Found by its mark
 * rather than its name, because it says *Begin* or *Resume*, in the Reader's own
 * Locale. See `docs/adr/0063-a-story-opens-on-its-title-card.md`.
 */
export async function begin(page: Page) {
  await live(page)
  await page.locator('button.beginning').click()
  await expect(page.locator('.reading')).toBeVisible()
}
