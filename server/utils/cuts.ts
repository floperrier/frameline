import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { cuts, scenes, stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Cuts this Author drew, reached through the Scene a Cut leaves. Every
 * statement that writes a Cut is scoped by this, the way Scenes and Shots are
 * scoped by `scenesOf` — the scoping *is* the ownership check.
 */
export function cutsOf(authorId: string) {
  return useDb()
    .select({ id: cuts.id })
    .from(cuts)
    .innerJoin(scenes, eq(cuts.fromSceneId, scenes.id))
    .innerJoin(stories, eq(scenes.storyId, stories.id))
    .where(eq(stories.authorId, authorId))
}

/**
 * Reads the text a Cut carries. Empty text is a Cut the Author has not phrased
 * yet rather than a bad request, but text that is missing altogether is: writing
 * it as empty would erase what the Cut already said.
 */
export async function readCutText(event: H3Event) {
  const body = await readBody<{ text?: unknown }>(event)

  if (typeof body?.text !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'A Cut carries text.' })
  }

  const text = body.text

  if (text.length > CUT_TEXT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `A Cut cannot carry more than ${CUT_TEXT_MAX_LENGTH} characters.`,
    })
  }

  return text
}

/** Reads which Scene a Cut arrives at. */
export async function readTargetSceneId(event: H3Event) {
  const body = await readBody<{ toSceneId?: unknown }>(event)
  const toSceneId = typeof body?.toSceneId === 'string' ? body.toSceneId : ''

  if (!UUID_PATTERN.test(toSceneId)) {
    throw createError({ statusCode: 400, statusMessage: 'A Cut arrives at a Scene.' })
  }

  return toSceneId
}

/**
 * Reads the Conditions a Cut is offered under, an absent or empty list being a
 * Cut offered to everyone. A trust boundary that matters more than most: what is
 * written here lands in a jsonb column, which would take any shape at all, and
 * the engine then reads it back as Conditions — so only the two flat shapes get
 * through, member by member, and neither of them can hold another.
 */
export async function readCutConditions(event: H3Event): Promise<Condition[]> {
  const body = await readBody<{ conditions?: unknown }>(event)
  const conditions = body?.conditions

  if (conditions === null || conditions === undefined) return []
  if (!Array.isArray(conditions)) throw badCondition()

  if (conditions.length > CUT_CONDITIONS_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `A Cut cannot carry more than ${CUT_CONDITIONS_MAX} Conditions.`,
    })
  }

  return conditions.map(readCondition)
}

/** One member of the list: a single flat test, or nothing that gets written. */
function readCondition(condition: unknown): Condition {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    throw badCondition()
  }

  // A Condition holds its own two or three keys and nothing besides: anything
  // else is a Condition trying to carry a second one, and flatness is the whole
  // point of the language.
  const parts = Object.keys(condition).length

  if ('flag' in condition) {
    if (parts !== 2) throw badCondition()

    const { flag, is } = condition as { flag: unknown, is: unknown }
    const name = typeof flag === 'string' ? flag.trim() : ''

    if (!name || name.length > FLAG_NAME_MAX_LENGTH) throw badCondition()
    if (typeof is !== 'string' || is.length > FLAG_VALUE_MAX_LENGTH) throw badCondition()

    // Trimmed on both sides of the comparison the engine will make: a Flag is
    // stored trimmed, so a Condition asking for `on ` could never match one.
    return { flag: name, is: is.trim() }
  }

  const { scene, visits, times } = condition as { scene: unknown, visits: unknown, times: unknown }

  if (parts !== 3) throw badCondition()
  if (typeof scene !== 'string' || !UUID_PATTERN.test(scene)) throw badCondition()
  if (visits !== 'at least' && visits !== 'fewer than') throw badCondition()
  if (!Number.isInteger(times) || (times as number) < 1 || (times as number) > VISITS_MAX) {
    throw badCondition()
  }

  return { scene, visits, times: times as number }
}

function badCondition() {
  return createError({
    statusCode: 400,
    statusMessage: 'A Condition tests what one Flag holds, '
      + `or how often one Scene has been entered, up to ${VISITS_MAX} times.`,
  })
}
