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
import { soundTypeOf } from '../shared/utils/sound.ts'
import { SAMPLES, SAMPLE_LANGUAGES, imagePath, type SampleLanguage } from './samples.ts'
import { REEL_CHANGE } from './reel-change.ts'
import { soundPath } from './sounds.ts'
import { develop, type Shot, type WorkCondition } from './work.ts'

const origin = argument('origin') ?? 'http://localhost:3100'
const email = argument('author')

if (!email) throw new Error('Which Author is writing this: --author <email>')

const work = chosen()

const author = await authorNamed(email)
const cookie = `nuxt-session=${await sealAuthorSession(author)}`

const story = await api('POST', '/api/stories', {
  title: work.title,
  language: work.language,
}) as { id: string }

// Scenes first, so an Exit has both its ends to join by the time it is drawn.
const written = new Map<string, string>()
// Each Scene's ways on, by the Place they are drawn at there.
const drawn = new Map<string, string[]>()
// And every Condition last, because one may name an Exit, and an Exit has no id
// until it is drawn: each list waits here beside the door it is PUT through.
const conditioned: { path: string, when: WorkCondition[] }[] = []

for (const scene of work.scenes) {
  const { id } = await api('POST', `/api/stories/${story.id}/scenes`, { name: scene.name }) as
    { id: string }

  written.set(scene.name, id)
  if (scene.sets) await api('PUT', `/api/scenes/${id}/flags`, { sets: scene.sets })
  if (scene.sound) await deposit(`/api/scenes/${id}/sound`, scene.sound)
  // The Transcript, the Cut, the arrival of the text and the Question come through the
  // Scene's one door, and only what the work names goes through it: a field the work
  // left out is `undefined`, which `JSON.stringify` drops from the body, so the column
  // keeps the default every Story written before the Cut has. A work naming none
  // sends nothing.
  const says = {
    transcript: scene.transcript,
    layout: scene.layout,
    movementBy: scene.movementBy,
    movementDirection: scene.movementDirection,
    movementOver: scene.movementOver,
    cutAfter: scene.cutAfter,
    cutOver: scene.cutOver,
    cutThrough: scene.cutThrough,
    exitsAfter: scene.exitsAfter,
    textAfter: scene.textAfter,
    textBy: scene.textBy,
    textPace: scene.textPace,
    textOver: scene.textOver,
    textStays: scene.textStays,
    question: scene.question,
    questionFlag: scene.questionFlag,
  }

  if (Object.values(says).some(said => said !== undefined)) {
    await api('PATCH', `/api/scenes/${id}`, says)
  }

  for (const shot of scene.shots) {
    const { id: shotId } = await api('POST', `/api/scenes/${id}/shots`) as { id: string }
    await api('PATCH', `/api/shots/${shotId}`, {
      // A formatted text is refused beside plain words: the words are derived.
      ...shot.formatted ? { formatted: shot.formatted } : { text: shot.text },
      description: shot.description ?? '',
      transcript: shot.transcript ?? '',
      cutAfter: shot.cutAfter,
      cutOver: shot.cutOver,
      cutThrough: shot.cutThrough,
      layout: shot.layout,
      cropX: shot.cropX,
      cropY: shot.cropY,
      movementBy: shot.movementBy,
      movementDirection: shot.movementDirection,
      movementOver: shot.movementOver,
      imageArrives: shot.imageArrives,
      imageLasts: shot.imageLasts,
      textArrives: shot.textArrives,
      textLasts: shot.textLasts,
      textAfter: shot.textAfter,
      textBy: shot.textBy,
      textPace: shot.textPace,
      textOver: shot.textOver,
      textStays: shot.textStays,
    })
    const image = await imageOf(shot)
    if (image) await attach(shotId, image)
    if (shot.sound) await deposit(`/api/shots/${shotId}/sound`, shot.sound)
    if (shot.when) conditioned.push({ path: `/api/shots/${shotId}/conditions`, when: shot.when })
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

  await api('PATCH', `/api/exits/${id}`, {
    text: exit.text,
    cutOver: exit.cutOver,
    cutThrough: exit.cutThrough,
  })
  drawn.set(exit.from, [...drawn.get(exit.from) ?? [], id])
  if (exit.when) conditioned.push({ path: `/api/exits/${id}/conditions`, when: exit.when })
}

for (const { path, when } of conditioned) {
  await api('PUT', path, { conditions: when.map(identified) })
}

await api('POST', `/api/stories/${story.id}/publish`)

// The demonstration is listed as well as published, so a fresh install has a
// Catalogue with something in it — an empty one reads as broken rather than as
// new. A Sample written from here is a copy for whoever ran the script, and is
// left unlisted like the one planted in every new account.
//
// Every entry in the Catalogue is signed, so an Author with no Name yet is told
// where to write one rather than handed the API's refusal: the product asks for
// it in the listing on the bench, and this script is not that.
if (work === REEL_CHANGE) {
  if (!author.name) {
    throw new Error(
      `${email} has no Name yet, and a listed Story is signed. `
      + `Write one on ${origin}/stories, then run this again.`)
  }

  await api('POST', `/api/stories/${story.id}/listed`)
}

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

/** A Condition as the API takes it: a Scene or an Exit named in the work, identified here. */
function identified(condition: WorkCondition): Condition {
  if ('scene' in condition) return { ...condition, scene: sceneNamed(condition.scene) }
  if ('exit' in condition) return { ...condition, exit: exitNamed(condition.exit) }
  return condition
}

function sceneNamed(name: string) {
  const id = written.get(name)
  if (!id) throw new Error(`No Scene called ${name} was written`)
  return id
}

function exitNamed({ from, place }: { from: string, place: number }) {
  const id = drawn.get(from)?.[place - 1]
  if (!id) throw new Error(`The work names an Exit ${place} out of ${from} it does not write`)
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

/**
 * Deposits one of the library's Sounds, read from the folder on disk. The whole
 * body is the file, as the bench's own picker sends it, and the type is read off
 * the bytes the same way the server reads them.
 */
async function deposit(path: string, file: string) {
  const bytes = await readFile(soundPath(file))
  const response = await fetch(`${origin}${path}`, {
    method: 'PUT',
    headers: { cookie, 'content-type': soundTypeOf(bytes) ?? 'application/octet-stream' },
    body: new Uint8Array(bytes),
  })

  if (!response.ok) throw await refused(response, `PUT ${path}`)
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
