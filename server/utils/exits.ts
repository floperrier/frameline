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

/** Reads which Scene an Exit arrives at. */
export async function readTargetSceneId(event: H3Event) {
  const body = await readBody<{ toSceneId?: unknown }>(event)
  const toSceneId = typeof body?.toSceneId === 'string' ? body.toSceneId : ''

  if (!UUID_PATTERN.test(toSceneId)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.exitTarget') })
  }

  return toSceneId
}
