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
    throw createError({ statusCode: 400, message: saying(event)('refusals.sceneName') })
  }
  if (name.length > SCENE_NAME_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.sceneNameLong', { max: SCENE_NAME_MAX_LENGTH }),
    })
  }

  return name
}

/**
 * Reads the name a Scene is being renamed to, where the request may not be
 * carrying one: a node dragged sends its placement alone, and a rename sends the
 * two together. A name that is there is held to what a Scene may be called in
 * the first place — a blank one is refused rather than written over the name the
 * Scene already answers to.
 */
export async function readSceneRename(event: H3Event) {
  const body = await readBody<{ name?: unknown }>(event)

  return body?.name === undefined ? undefined : await readSceneName(event)
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
      message: saying(event)('refusals.scenePlacement', { reach: GRAPH_REACH }),
    })
  }

  return { x, y }
}

/**
 * Reads where a Scene is being placed, where the request may be carrying no
 * placement at all: a Scene written by dropping a Cut on the bare bench says
 * where it landed, and one written from the form at the top of the page leaves
 * the endpoint to choose a spot itself. A placement that is there is held to the
 * same bound as one on a Scene already written — a Story cannot be seeded with a
 * node beyond the graph's reach any more than it can be dragged to one.
 */
export async function readScenePlacementOffered(event: H3Event) {
  const body = await readBody<{ x?: unknown, y?: unknown }>(event)

  return body?.x === undefined && body?.y === undefined
    ? undefined
    : await readScenePlacement(event)
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

  if (typeof sets !== 'object' || sets === null || Array.isArray(sets)) throw badFlags(event)

  const entries = Object.entries(sets)
  if (entries.length > FLAGS_PER_SCENE) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.tooManyFlags', { max: FLAGS_PER_SCENE }),
    })
  }

  const flags: Flags = {}
  for (const [name, value] of entries) {
    const flag = name.trim()
    const held = typeof value === 'string' ? value.trim() : ''

    if (!flag || !held) throw badFlags(event)
    if (flag.length > FLAG_NAME_MAX_LENGTH || held.length > FLAG_VALUE_MAX_LENGTH) {
      throw badFlags(event)
    }
    if (flag.includes(FLAG_SEPARATOR) || `${flag}${held}`.includes('\n')) throw badFlags(event)

    flags[flag] = held
  }

  return flags
}

function badFlags(event: H3Event) {
  return createError({
    statusCode: 400,
    message: saying(event)('refusals.badFlag', { separator: FLAG_SEPARATOR }),
  })
}
