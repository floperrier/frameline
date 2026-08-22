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
    throw createError({ statusCode: 400, message: 'A Scene needs a name.' })
  }
  if (name.length > SCENE_NAME_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: `A name cannot be longer than ${SCENE_NAME_MAX_LENGTH} characters.`,
    })
  }

  return name
}

/**
 * Reads where in the graph a Scene has been put. Both coordinates are bounded, so a
 * Scene cannot be written to a place the graph cannot show; whole pixels, so the
 * integer column takes them as they are.
 */
export async function readScenePlacement(event: H3Event) {
  const body = await readBody<{ x?: unknown, y?: unknown }>(event)
  const [x, y] = [body?.x, body?.y].map(value =>
    typeof value === 'number' && value >= 0 && value <= GRAPH_REACH ? Math.round(value) : undefined)

  if (x === undefined || y === undefined) {
    throw createError({
      statusCode: 400,
      message: `A Scene sits between 0 and ${GRAPH_REACH} pixels from the graph's corner.`,
    })
  }

  return { x, y }
}

/**
 * Reads the Flags a Scene sets on entry, as a flat object of names to values. A
 * Flag is a name *and* a value, so neither half may be blank: a Flag set to
 * nothing is one the engine cannot tell from a Flag never set. Names and values
 * hold no newline and no separator, which is what lets the editor show them back
 * as one `name = value` line apiece.
 */
export async function readSceneFlags(event: H3Event): Promise<Flags> {
  const body = await readBody<{ sets?: unknown }>(event)
  const sets = body?.sets

  if (typeof sets !== 'object' || sets === null || Array.isArray(sets)) throw badFlags()

  const entries = Object.entries(sets)
  if (entries.length > FLAGS_PER_SCENE) {
    throw createError({
      statusCode: 400,
      message: `A Scene cannot set more than ${FLAGS_PER_SCENE} Flags.`,
    })
  }

  const flags: Flags = {}
  for (const [name, value] of entries) {
    const flag = name.trim()
    const held = typeof value === 'string' ? value.trim() : ''

    if (!flag || !held) throw badFlags()
    if (flag.length > FLAG_NAME_MAX_LENGTH || held.length > FLAG_VALUE_MAX_LENGTH) throw badFlags()
    if (flag.includes(FLAG_SEPARATOR) || `${flag}${held}`.includes('\n')) throw badFlags()

    flags[flag] = held
  }

  return flags
}

function badFlags() {
  return createError({
    statusCode: 400,
    message: `A Flag is a name and a value, written “courage ${FLAG_SEPARATOR} high”.`,
  })
}
