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
    throw createError({ statusCode: 400, message: saying(event)('refusals.cutText') })
  }

  const text = body.text

  if (text.length > CUT_TEXT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.cutTextLong', { max: CUT_TEXT_MAX_LENGTH }),
    })
  }

  return text
}

/** Reads which Scene a Cut arrives at. */
export async function readTargetSceneId(event: H3Event) {
  const body = await readBody<{ toSceneId?: unknown }>(event)
  const toSceneId = typeof body?.toSceneId === 'string' ? body.toSceneId : ''

  if (!UUID_PATTERN.test(toSceneId)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.cutTarget') })
  }

  return toSceneId
}
