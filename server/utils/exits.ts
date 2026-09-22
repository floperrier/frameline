import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { exits, scenes, stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Exits this Author drew, reached through the Scene an Exit leaves. Every
 * statement that writes an Exit is scoped by this, the way Scenes and Shots are
 * scoped by `scenesOf` — the scoping *is* the ownership check.
 */
export function exitsOf(authorId: string) {
  return useDb()
    .select({ id: exits.id })
    .from(exits)
    .innerJoin(scenes, eq(exits.fromSceneId, scenes.id))
    .innerJoin(stories, eq(scenes.storyId, stories.id))
    .where(eq(stories.authorId, authorId))
}

/**
 * Reads the text an Exit carries. Empty text is an Exit the Author has not phrased
 * yet rather than a bad request, but text that is missing altogether is: writing
 * it as empty would erase what the Exit already said.
 */
export async function readExitText(event: H3Event) {
  const body = await readBody<{ text?: unknown }>(event)

  if (typeof body?.text !== 'string') {
    throw createError({ statusCode: 400, message: saying(event)('refusals.exitText') })
  }

  const text = body.text

  if (text.length > EXIT_TEXT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.exitTextLong', { max: EXIT_TEXT_MAX_LENGTH }),
    })
  }

  return text
}

/**
 * Reads whether a Reading crosses this Exit backwards: true, false, or null for
 * the Exit answering as its Story says. Three answers to one question, which is
 * why they arrive in one field rather than as a pair of switches that could
 * disagree — see
 * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`. Anything else
 * in the field is refused rather than read as one of the three.
 */
export async function readExitStepsBack(event: H3Event) {
  const body = await readBody<{ stepsBack?: unknown }>(event)
  const stepsBack = body?.stepsBack

  if (stepsBack !== null && typeof stepsBack !== 'boolean') {
    throw createError({ statusCode: 400, message: saying(event)('refusals.exitStepsBack') })
  }

  return stepsBack
}

/**
 * What a PATCH may change about an Exit: the words the Reader presses, whether a
 * Reading crosses it backwards, and how the passage it makes is cut. Each is
 * read only where the body names it, so writing the one the Author changed
 * leaves the rest where they were — and null is a value here rather than an
 * absence, which is why the field is looked for against `undefined` and not
 * against nothing.
 *
 * `cutOver` and `cutThrough` take no null on an Exit: unlike a Shot, an Exit has
 * no Scene above it to answer *as it says*, so both are read with `nullable`
 * false. There is no `cutAfter` here — an Exit is taken rather than held, so it
 * has nothing to stand for.
 *
 * A body naming none of the three is refused as the text being asked for: the
 * words are what an Exit is written with, so that is what an empty change is
 * missing.
 */
export async function readExitChanges(event: H3Event) {
  const body = await readBody<{
    text?: unknown
    stepsBack?: unknown
    cutOver?: unknown
    cutThrough?: unknown
  }>(event)
  const changes: {
    text?: string
    stepsBack?: boolean | null
    cutOver?: number
    cutThrough?: CutThrough
  } = {}

  if (body?.text !== undefined) changes.text = await readExitText(event)
  if (body?.stepsBack !== undefined) changes.stepsBack = await readExitStepsBack(event)
  if (body?.cutOver !== undefined) {
    changes.cutOver = await readCutOver(event, { nullable: false })
  }
  if (body?.cutThrough !== undefined) {
    changes.cutThrough = await readCutThrough(event, { nullable: false })
  }
  if (!Object.keys(changes).length) await readExitText(event)

  return changes
}

/** Reads which Scene an Exit arrives at. */
export async function readTargetSceneId(event: H3Event) {
  const body = await readBody<{ toSceneId?: unknown }>(event)
  const toSceneId = typeof body?.toSceneId === 'string' ? body.toSceneId : ''

  if (!UUID_PATTERN.test(toSceneId)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.exitTarget') })
  }

  return toSceneId
}

/**
 * Refuses a way on that would let a Reading come back, which is
 * `docs/adr/0048-a-scene-is-entered-once.md` held where a way on is given a
 * destination: from A to B is refused exactly when B already reaches A, and a
 * way on to the Scene it leaves is that same test asked of one Scene, since a
 * Scene reaches itself.
 *
 * Both places a destination is written ask it — as an Exit is drawn, and as one
 * is re-led — so the Scene being left is named either by itself or by the Exit
 * standing in it, and the answer is the same walk either way.
 *
 * Read and then written rather than settled inside the statement that writes:
 * the walk is `reaches`, the one the bench withholds a landing with, so the rule
 * is read once in the product instead of once here and again in SQL. The read is
 * scoped to the Author's own Stories, so a Scene that is not theirs is refused
 * nothing and falls through to the not-found the write already answers. Nothing
 * holds the two together — the neon-http driver has no transactions — which is
 * the same seam every act of two statements here accepts, and there is one
 * Author writing.
 */
export async function refuseAWayBack(
  event: H3Event,
  authorId: string,
  leaving: { scene: string } | { exit: string },
  toSceneId: string,
) {
  const departure = 'scene' in leaving
    ? sql`select id from scenes where id = ${leaving.scene}::uuid`
    : sql`select from_scene_id as id from exits where id = ${leaving.exit}::uuid`

  // Left joined, because the Story may hold no Exit at all and the Scene being
  // left still has to come back: a way on from a Scene to itself is refused in a
  // Story of one Scene and nothing written.
  const { rows } = await useDb().execute<Exit & { from: string }>(sql`
    with departure as (
      select scenes.id, scenes.story_id
      from scenes
      where scenes.id in (${departure}) and scenes.story_id in (${storiesOf(authorId)})
    )
    select
      departure.id as "from",
      exits.from_scene_id as "fromSceneId",
      exits.to_scene_id as "toSceneId"
    from departure
    left join scenes on scenes.story_id = departure.story_id
    left join exits on exits.from_scene_id = scenes.id`)

  const from = rows[0]?.from
  if (!from || !reaches(rows, toSceneId, from)) return

  throw createError({ statusCode: 400, message: saying(event)('refusals.wayBack') })
}
