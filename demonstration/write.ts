/**
 * Writes the demonstration work into a running Frameline and publishes it.
 *
 *   node --env-file=.env demonstration/write.ts --author me@example.com
 *   node demonstration/write.ts --origin https://… --author me@example.com
 *
 * It goes through the HTTP API an Author's own browser goes through — a Story, a
 * Scene, a Shot, a still, a Cut, a Condition, a Publish, in that order — so the
 * work cannot end up in a shape the editor could not have produced. The one thing
 * it does past the API is look the Author up by email, because signing in means
 * GitHub or Google and a script cannot hold a person's password: with the row in
 * hand it seals the same `nuxt-session` cookie nuxt-auth-utils would have written,
 * exactly as the end-to-end suite does in `tests/e2e/author.ts`.
 *
 * Node 22.18 or newer runs it as it stands, because it strips the types itself.
 *
 * Two things have to be true of the environment it runs against: `DATABASE_URL`
 * and `NUXT_SESSION_PASSWORD` are the ones that instance uses, and the Author has
 * signed in there at least once. Against production that means the production
 * values — see `docs/deploy.md` — and running it twice writes the work twice,
 * because publishing is the only thing here that is not an addition.
 */
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { neon } from '@neondatabase/serverless'
import { sealSession, type H3Event } from 'h3'
import { SHOT_IMAGE_MAX_BYTES } from '../shared/utils/scenes.ts'
import type { Condition } from '../shared/utils/scenes.ts'
import { REEL_CHANGE, type Lit, type Still } from './reel-change.ts'

const run = promisify(execFile)

/** The size every still is shot at: sixteen by nine, the shape of a gate. */
const FRAME = '1600x900'

const origin = argument('origin') ?? 'http://localhost:3100'
const email = argument('author')

if (!email) throw new Error('Which Author is writing this: --author <email>')

const cookie = `nuxt-session=${await sealAuthorSession(await authorNamed(email))}`

const story = await api('POST', '/api/stories', { title: REEL_CHANGE.title }) as { id: string }

// Scenes first, so a Cut has both its ends to join by the time it is drawn.
const written = new Map<string, string>()

for (const scene of REEL_CHANGE.scenes) {
  const [x, y] = scene.at
  const { id } = await api('POST', `/api/stories/${story.id}/scenes`, { name: scene.name }) as
    { id: string }

  written.set(scene.name, id)
  await api('PATCH', `/api/scenes/${id}`, { x, y })
  if (scene.sets) await api('PUT', `/api/scenes/${id}/flags`, { sets: scene.sets })

  for (const shot of scene.shots) {
    const { id: shotId } = await api('POST', `/api/scenes/${id}/shots`) as { id: string }
    await api('PATCH', `/api/shots/${shotId}`, { text: shot.text })
    await attach(shotId, await develop(shot.still))
    process.stdout.write('.')
  }
}

for (const cut of REEL_CHANGE.cuts) {
  const { id } = await api('POST', `/api/scenes/${sceneNamed(cut.from)}/cuts`, {
    toSceneId: sceneNamed(cut.to),
  }) as { id: string }

  await api('PATCH', `/api/cuts/${id}`, { text: cut.text })
  if (cut.when) {
    await api('PUT', `/api/cuts/${id}/condition`, { condition: identified(cut.when) })
  }
}

await api('POST', `/api/stories/${story.id}/publish`)

console.log(`\n${REEL_CHANGE.title} is readable at ${origin}/read/${story.id}`)

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

/**
 * The still the recipe describes, as the bytes of a JPEG. Three passes over one
 * ImageMagick invocation, in the order light reaches film: what glows is screened
 * onto the ground, because light adds; what the light falls on is laid over it,
 * because a dark shape in front of a lamp has to be able to block it; and the
 * grain and the falloff at the corners go over everything, so one still is graded
 * like the next.
 */
async function develop(still: Still) {
  const [top, bottom] = still.ground

  const { stdout } = await run('magick', [
    '-size', FRAME, `gradient:${top}-${bottom}`,
    ...(still.glow ?? []).flatMap(lit => layer(lit, 'black', 'screen')),
    ...(still.form ?? []).flatMap(lit => layer(lit, 'none', 'over')),
    '-attenuate', String(still.grain ?? 1), '+noise', 'Gaussian',
    // The corners fall away, the way they do through any real lens, and the whole
    // still comes back a little off full colour: nothing here was ever graded.
    '(', '-size', FRAME, 'radial-gradient:#ffffff-#333333', ')', '-compose', 'multiply', '-composite',
    '-modulate', '100,88',
    '-depth', '8', '-strip', '-quality', '84', 'jpg:-',
  ], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })

  // Grain is the worst thing that can be done to a JPEG, so the one thing a still
  // can get wrong by itself is coming out too heavy for the Shot's own row. Said
  // here rather than found out by a refused PUT halfway through writing the work.
  if (stdout.length > SHOT_IMAGE_MAX_BYTES) {
    throw new Error(`A still developed to ${stdout.length} bytes, past what a Shot may carry`)
  }

  return stdout
}

/** One shape on its own transparent or black sheet, blurred and dimmed, then composited. */
function layer(lit: Lit, over: string, compose: string) {
  return [
    '(', '-size', FRAME, `xc:${over}`,
    '-fill', lit.colour, '-draw', lit.draw,
    '-blur', `0x${lit.blur ?? 4}`,
    ...(lit.opacity === undefined
      ? []
      : ['-alpha', 'set', '-channel', 'A', '-evaluate', 'multiply', String(lit.opacity), '+channel']),
    ')', '-compose', compose, '-composite',
  ]
}

/** Attaches a still. The whole body is the file, as the editor's picker sends it. */
async function attach(shotId: string, image: Buffer) {
  const response = await fetch(`${origin}/api/shots/${shotId}/image`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'image/jpeg' },
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
