import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { scenes, stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Stories and the Scenes this Author wrote. Every Scene and Shot statement
 * is scoped by one of these, which is what makes another Author's work
 * unreachable — there is no separate ownership check to forget.
 */
export function storiesOf(authorId: string) {
  return useDb().select({ id: stories.id }).from(stories).where(eq(stories.authorId, authorId))
}

export function scenesOf(authorId: string) {
  return useDb()
    .select({ id: scenes.id })
    .from(scenes)
    .innerJoin(stories, eq(scenes.storyId, stories.id))
    .where(eq(stories.authorId, authorId))
}

/** Reads a Scene name from the request body, capped as it crosses into the database. */
export async function readSceneName(event: H3Event) {
  const body = await readBody<{ name?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'A Scene needs a name.' })
  }
  if (name.length > SCENE_NAME_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `A name cannot be longer than ${SCENE_NAME_MAX_LENGTH} characters.`,
    })
  }

  return name
}

/**
 * Reads a Shot's text. A Shot is added empty and written afterwards, so empty
 * is a Shot the Author has not got to yet rather than a bad request.
 */
export async function readShotText(event: H3Event) {
  const body = await readBody<{ text?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text : ''

  if (text.length > SHOT_TEXT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `A Shot cannot hold more than ${SHOT_TEXT_MAX_LENGTH} characters.`,
    })
  }

  return text
}

/** Reads which way a Shot is being moved, as the step to add to its position. */
export async function readMoveStep(event: H3Event) {
  const body = await readBody<{ direction?: unknown }>(event)

  if (body?.direction === 'earlier') return -1
  if (body?.direction === 'later') return 1

  throw createError({
    statusCode: 400,
    statusMessage: 'A Shot moves either earlier or later.',
  })
}
