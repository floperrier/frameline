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
 * Reads the Shot a Scene is split before. Only its shape is read here: whether it
 * is a Shot of this Scene, and not its first, is what the split's own statement
 * settles, because both are facts about the Scene as it stands at that moment.
 */
export async function readSplitShot(event: H3Event) {
  const body = await readBody<{ shotId?: unknown }>(event)
  const shotId = body?.shotId

  if (typeof shotId !== 'string' || !UUID_PATTERN.test(shotId)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.split') })
  }

  return shotId
}

/**
 * Reads the Flags a Scene sets on entry, as a flat object of names to values —
 * or, where the Author named several for one Flag, to the list one value is drawn
 * from on each entry. A Flag is a name *and* a value, so neither half may be
 * blank: a Flag set to nothing is one the engine cannot tell from a Flag never
 * set. A name holds no newline and neither separator, and a value holds no
 * newline and not the one that tells a draw's values apart — which is what lets
 * the editor show them back as one line apiece.
 */
export async function readSceneFlags(event: H3Event): Promise<Sets> {
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

  const flags: Sets = {}
  for (const [name, value] of entries) {
    const flag = name.trim()
    if (!flag || flag.length > FLAG_NAME_MAX_LENGTH) throw badFlags(event)
    if (flag.includes(FLAG_SEPARATOR) || flag.includes('\n')) throw badFlags(event)

    flags[flag] = Array.isArray(value) ? drawnFrom(event, value) : oneValue(event, value)
  }

  return flags
}

/**
 * One value a Flag may hold, whether it stands alone or is one of a list: short
 * enough to be a Flag's value on its own, and holding no newline and not the
 * separator a draw's values are told apart by, so the line the editor writes it
 * back on can be read as the line it was typed on. It may hold the separator
 * between a name and a value, which a line is only split on once.
 */
function oneValue(event: H3Event, value: unknown) {
  const held = typeof value === 'string' ? value.trim() : ''

  if (!held || held.length > FLAG_VALUE_MAX_LENGTH) throw badFlags(event)
  if (held.includes('\n')) throw badFlags(event)
  if (held.includes(FLAG_VALUES_SEPARATOR)) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.flagValueSeparator', { separator: FLAG_VALUES_SEPARATOR }),
    })
  }

  return held
}

/**
 * The values a Flag is drawn from. At least two, because a list of one is a plain
 * value and reaches here as one, and at most `FLAG_VALUES_MAX` — a draw is a beat
 * coming back differently, not a table to roll on.
 */
function drawnFrom(event: H3Event, values: unknown[]) {
  if (values.length < 2) throw badFlags(event)
  if (values.length > FLAG_VALUES_MAX) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.tooManyFlagValues', { max: FLAG_VALUES_MAX }),
    })
  }

  return values.map(value => oneValue(event, value))
}

/**
 * The refusal every half-written Flag comes back as. It names no punctuation:
 * nothing an Author types carries any, since the Flags a Scene sets are written
 * as rows — and the separators the two checks above still hold are the format
 * this server reads and writes, not one anybody is asked to type.
 */
function badFlags(event: H3Event) {
  return createError({ statusCode: 400, message: saying(event)('refusals.badFlag') })
}
