/**
 * Writes one of the works in this directory into a running Frameline and
 * publishes it: *Reel Change* by default, or a Sample in the Language named.
 *
 *   node --env-file=.env demonstration/write.ts --author me@example.com
 *   node --env-file=.env demonstration/write.ts --author me@example.com --sample fr
 *   node demonstration/write.ts --origin https://… --author me@example.com
 *
 * It goes through the HTTP API an Author's own browser goes through — a Story, a
 * Scene, a Shot, an image, an Exit, a Condition, a Publish, in that order — so the
 * work cannot end up in a shape the editor could not have produced. The one thing
 * it does past the API is look the Author up by email, because signing in means
 * GitHub or Google and a script cannot hold a person's password: with the row in
 * hand it seals the same `nuxt-session` cookie nuxt-auth-utils would have written,
 * exactly as the end-to-end suite does in `tests/e2e/author.ts`.
 *
 * Node 22.18 or newer runs it as it stands, because it strips the types itself.
 * ImageMagick develops *Reel Change*'s images as the work is written; a Sample's
 * are the WebP files committed beside it, so a Sample needs none.
 *
 * Two things have to be true of the environment it runs against: `DATABASE_URL`
 * and `NUXT_SESSION_PASSWORD` are the ones that instance uses, and the Author has
 * signed in there at least once. Against production that means the production
 * values — see `docs/deploy.md` — and running it twice writes the work twice,
 * because publishing is the only thing here that is not an addition.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'
import { sealSession, type H3Event } from 'h3'
import { imageTypeOf } from '../shared/utils/scenes.ts'
import type { Condition } from '../shared/utils/scenes.ts'
import { SAMPLES, SAMPLE_LANGUAGES, imagePath, type SampleLanguage } from './samples.ts'
import { REEL_CHANGE } from './reel-change.ts'
import { develop, type Shot } from './work.ts'

const origin = argument('origin') ?? 'http://localhost:3100'
const email = argument('author')

if (!email) throw new Error('Which Author is writing this: --author <email>')

const work = chosen()

const cookie = `nuxt-session=${await sealAuthorSession(await authorNamed(email))}`

const story = await api('POST', '/api/stories', {
  title: work.title,
  language: work.language,
}) as { id: string }

// Scenes first, so an Exit has both its ends to join by the time it is drawn.
const written = new Map<string, string>()

for (const scene of work.scenes) {
  const [x, y] = scene.at
  const { id } = await api('POST', `/api/stories/${story.id}/scenes`, { name: scene.name }) as
    { id: string }

  written.set(scene.name, id)
  await api('PATCH', `/api/scenes/${id}`, { x, y })
  if (scene.sets) await api('PUT', `/api/scenes/${id}/flags`, { sets: scene.sets })

  for (const shot of scene.shots) {
    const { id: shotId } = await api('POST', `/api/scenes/${id}/shots`) as { id: string }
    await api('PATCH', `/api/shots/${shotId}`, {
      text: shot.text,
      description: shot.description ?? '',
    })
    const image = await imageOf(shot)
    if (image) await attach(shotId, image)
    if (shot.when) {
      await api('PUT', `/api/shots/${shotId}/conditions`, { conditions: shot.when.map(identified) })
    }
    process.stdout.write('.')
  }
}

// The first Scene written is already the one the Story opens on, so this says
// again what is usually already true. One request, and a work that opens
// somewhere other than where it starts needs nothing special here.
if (work.opening) await api('POST', `/api/scenes/${sceneNamed(work.opening)}/opening`)

for (const exit of work.exits) {
  const { id } = await api('POST', `/api/scenes/${sceneNamed(exit.from)}/exits`, {
    toSceneId: sceneNamed(exit.to),
  }) as { id: string }

  await api('PATCH', `/api/exits/${id}`, { text: exit.text })
  if (exit.when) {
    await api('PUT', `/api/exits/${id}/conditions`, { conditions: exit.when.map(identified) })
  }
}

await api('POST', `/api/stories/${story.id}/publish`)

// The demonstration is listed as well as published, so a fresh install has a
// Catalogue with something in it — an empty one reads as broken rather than as
// new. A Sample written from here is a copy for whoever ran the script, and is
// left unlisted like the one planted in every new account.
if (work === REEL_CHANGE) await api('POST', `/api/stories/${story.id}/listed`)

console.log(`\n${work.title} is readable at ${origin}/read/${story.id}`)

/**
 * The work this run writes: a Sample in the Language asked for, or the
 * demonstration where nothing is asked for.
 */
function chosen() {
  const language = argument('sample')
  if (language === undefined) return REEL_CHANGE

  const sample = SAMPLES[language as SampleLanguage]
  if (!sample) {
    throw new Error(`No Sample is written in ${language}: --sample ${SAMPLE_LANGUAGES.join(' | ')}`)
  }

  return sample
}

/**
 * The bytes of a Shot's image: a Sample's, read from the WebP committed beside
 * it, or the demonstration's, developed here and now from its recipe. A Shot
 * that names neither is text alone and carries nothing.
 */
async function imageOf(shot: Shot) {
  if (!shot.image) return undefined
  return typeof shot.image === 'string'
    ? await readFile(imagePath(shot.image))
    : await develop(shot.image)
}

/** A Condition as the API takes it: a Scene named in the work, identified here. */
function identified(condition: Condition) {
  return 'scene' in condition
    ? { ...condition, scene: sceneNamed(condition.scene) }
    : condition
}

function sceneNamed(name: string) {
  const id = written.get(name)
  if (!id) throw new Error(`No Scene called ${name} was written`)
  return id
}

/** Attaches an image. The whole body is the file, as the editor's picker sends it. */
async function attach(shotId: string, image: Buffer) {
  const response = await fetch(`${origin}/api/shots/${shotId}/image`, {
    method: 'PUT',
    // The type is read off the bytes the same way the server reads them, so an
    // image developed as a WebP is not announced as a JPEG.
    headers: { cookie, 'content-type': imageTypeOf(image) ?? 'application/octet-stream' },
    body: new Uint8Array(image),
  })

  if (!response.ok) throw await refused(response, `PUT /api/shots/${shotId}/image`)
}

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) throw await refused(response, `${method} ${path}`)
  return await response.json()
}

async function refused(response: Response, what: string) {
  return new Error(`${what} — ${response.status} ${await response.text()}`)
}

type Author = { id: string, email: string, name: string | null }

/** The Author this work belongs to, who has to have signed in here already. */
async function authorNamed(email: string) {
  const sql = neon(process.env.DATABASE_URL!)
  const [author] = await sql`
    select id, email, name from authors where email = ${email}` as Author[]

  if (!author) throw new Error(`No Author has signed in as ${email} at ${origin}`)
  return author
}

async function sealAuthorSession(author: Author) {
  const session = { id: randomUUID(), createdAt: Date.now(), data: { user: author } }
  // `sealSession` only reaches into `context.sessions`, so a stub stands in for
  // the request event a real one would ride on.
  const event = { context: { sessions: { 'nuxt-session': session } } } as unknown as H3Event

  return sealSession(event, { name: 'nuxt-session', password: process.env.NUXT_SESSION_PASSWORD! })
}

function argument(name: string) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}
