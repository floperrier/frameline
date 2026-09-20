import { and, eq, isNotNull } from 'drizzle-orm'
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

/**
 * Reads what a Transcript says: what a Sound makes heard, for a Reader who
 * cannot hear it. The same rule as a Description, for the same reason — empty is
 * a Sound nobody has transcribed yet, which a Sound is entitled to be, and
 * missing altogether is a request that would erase it by saying nothing.
 */
export async function readTranscript(event: H3Event) {
  const body = await readBody<{ transcript?: unknown }>(event)
  const written = body?.transcript

  if (typeof written !== 'string' || written.length > SOUND_TRANSCRIPT_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.transcript', { max: SOUND_TRANSCRIPT_MAX_LENGTH }),
    })
  }

  return written
}

/** Whether the Scene's Sound is held in a loop until the Scene is left, or played once. */
export async function readSoundLoops(event: H3Event) {
  const body = await readBody<{ soundLoops?: unknown }>(event)

  if (typeof body?.soundLoops !== 'boolean') {
    throw createError({ statusCode: 400, message: saying(event)('refusals.soundLoops') })
  }

  return body.soundLoops
}

/**
 * Reads the Scene this one takes its Sound from: a Scene of the same Story that
 * carries bytes of its own, or null to take the naming away. A trust boundary
 * twice over, like the Cover's — the id is checked for shape here and for
 * belonging below, because a Scene of somebody else's Story would otherwise be
 * heard through this one.
 *
 * Carrying bytes of its own is what makes the naming one hop and no further: a
 * Scene that is itself naming is refused here, so a chain cannot be written and
 * the reading never has to walk one. The other half of the same rule is a Scene
 * already named by another: letting it take on a naming of its own would leave
 * whoever names it two hops from the bytes, so that is refused too, before the
 * target is even looked at.
 */
export async function readNamedSound(event: H3Event, sceneId: string) {
  const body = await readBody<{ soundOfSceneId?: unknown }>(event)
  const named = body?.soundOfSceneId
  if (named === null) return null

  const refused = () =>
    createError({ statusCode: 400, message: saying(event)('refusals.namedSound') })
  if (typeof named !== 'string' || !UUID_PATTERN.test(named)) throw refused()

  // Lowercased before they are compared: an id is a uuid, which Postgres reads
  // the same in either case, so two spellings of one id would pass a comparison
  // of strings and then be the same Scene naming itself where it counts.
  const lowered = named.toLowerCase()
  if (lowered === sceneId.toLowerCase()) throw refused()

  // Three statements rather than joins to the same table twice over: this is a
  // gesture an Author makes once a Scene, and the query nobody could read at a
  // glance would cost more than it saved.
  const [naming] = await useDb()
    .select({ storyId: scenes.storyId })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
  if (!naming) throw refused()

  const [namedByAnother] = await useDb()
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.soundOfSceneId, sceneId))
  if (namedByAnother) throw refused()

  const [carrier] = await useDb()
    .select({ id: scenes.id })
    .from(scenes)
    .where(and(
      eq(scenes.id, named),
      eq(scenes.storyId, naming.storyId),
      isNotNull(scenes.sound),
    ))
  if (!carrier) throw refused()

  return carrier.id
}

/**
 * What a PATCH may change about a Scene: its name, the three things that are
 * said about the Sound it is heard under, and its Cut — how its run is cut and
 * how long its ways on stand. Each is read only where the body names it, so the
 * bench can write the one field the Author touched without carrying the others
 * along — the shape `readStoryChanges` already has.
 *
 * A body naming none is refused as a name being asked for: the name is the one
 * thing a Scene cannot be without, so that is what an empty change is missing.
 */
export async function readSceneChanges(event: H3Event, sceneId: string) {
  const body = await readBody<{
    name?: unknown
    transcript?: unknown
    soundLoops?: unknown
    soundOfSceneId?: unknown
    cutAfter?: unknown
    cutOver?: unknown
    cutThrough?: unknown
    exitsAfter?: unknown
  }>(event)
  const changes: {
    name?: string
    transcript?: string
    soundLoops?: boolean
    soundOfSceneId?: string | null
    sound?: null
    cutAfter?: number | null
    cutOver?: number
    cutThrough?: CutThrough
    exitsAfter?: number | null
  } = {}

  if (body?.name !== undefined) changes.name = await readSceneName(event)
  if (body?.transcript !== undefined) changes.transcript = await readTranscript(event)
  if (body?.soundLoops !== undefined) changes.soundLoops = await readSoundLoops(event)
  if (body?.soundOfSceneId !== undefined) {
    changes.soundOfSceneId = await readNamedSound(event, sceneId)
    // A Scene carries its own Sound or names one, never both: naming lets go of
    // whatever was deposited here, so nothing can disagree about what is heard.
    if (changes.soundOfSceneId) changes.sound = null
  }
  // A Scene's run waits for the press in null and in nothing else. Nought is a
  // Shot's word for the same thing — a beat that stands for no time is a beat
  // nobody sees, so it is free to mean *held until the press* — and a Scene's
  // column holding both would be one fact in two shapes, which is what
  // `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md` and
  // `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` refuse. So the
  // Scene is refused the nought a Shot keeps.
  if (body?.cutAfter !== undefined) {
    changes.cutAfter = await readCutAfter(event)
    if (changes.cutAfter === 0) {
      throw createError({ statusCode: 400, message: saying(event)('refusals.cutAfter') })
    }
  }
  // A Scene's own cut takes no null: only a Shot answering *as its Scene says*
  // may leave one, so a Scene naming null here is refused the way an out-of-
  // bounds value is.
  if (body?.cutOver !== undefined) {
    changes.cutOver = await readCutOver(event, { nullable: false })
  }
  if (body?.cutThrough !== undefined) {
    changes.cutThrough = await readCutThrough(event, { nullable: false })
  }
  if (body?.exitsAfter !== undefined) changes.exitsAfter = await readExitsAfter(event)
  // Which is a name asked for, by the reader that phrases the refusal.
  if (!Object.keys(changes).length) await readSceneName(event)

  return changes
}
