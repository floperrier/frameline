import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { scenes, stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Stories and the Scenes this Author wrote. Every statement that writes a
 * Scene or a Shot is scoped by one of these, which is what makes another
 * Author's work unreachable — there is no ownership check beside the write to
 * forget. The one read of a whole Story proves it is the Author's first, and
 * then reads its Scenes by Story alone.
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
 * Reads where a Scene's node has been put. Both coordinates are bounded, so a
 * Scene cannot be written to a place the graph cannot show; whole pixels, so the
 * integer column takes them as they are.
 */
export async function readNodePosition(event: H3Event) {
  const body = await readBody<{ x?: unknown, y?: unknown }>(event)
  const [x, y] = [body?.x, body?.y].map(value =>
    typeof value === 'number' && value >= 0 && value <= GRAPH_REACH ? Math.round(value) : undefined)

  if (x === undefined || y === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: `A Scene sits between 0 and ${GRAPH_REACH} pixels from the graph's corner.`,
    })
  }

  return { x, y }
}
