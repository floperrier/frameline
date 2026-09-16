import { eq } from 'drizzle-orm'
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
 * Reading crosses it backwards, or both. Each is read only where the body names
 * it, so writing the one the Author changed leaves the other where it was — and
 * null is a value here rather than an absence, which is why the field is looked
 * for against `undefined` and not against nothing.
 *
 * A body naming neither is refused as the text being asked for: the words are
 * what an Exit is written with, so that is what an empty change is missing.
 */
export async function readExitChanges(event: H3Event) {
  const body = await readBody<{ text?: unknown, stepsBack?: unknown }>(event)
  const changes: { text?: string, stepsBack?: boolean | null } = {}

  if (body?.text !== undefined) changes.text = await readExitText(event)
  if (body?.stepsBack !== undefined) changes.stepsBack = await readExitStepsBack(event)
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
