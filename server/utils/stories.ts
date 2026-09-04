import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { exits, scenes, shots } from '../db/schema'
import { useDb } from '../db'

/**
 * Reads a Story title from the request body. A trust boundary: the title
 * reaches the database and every Reader, so length is capped here rather than
 * left to Postgres.
 */
export async function readStoryTitle(event: H3Event) {
  const body = await readBody<{ title?: unknown }>(event)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''

  if (!title) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.storyTitle') })
  }
  if (title.length > STORY_TITLE_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.storyTitleLong', { max: STORY_TITLE_MAX_LENGTH }),
    })
  }

  return title
}

/**
 * Reads a Synopsis from the request body. A trust boundary like the title: it
 * reaches the database and every shelf the Story is presented on, so the length
 * is capped here rather than left to Postgres.
 *
 * Empty is allowed, and is how a Synopsis is taken back off a Story — the few
 * lines are the Author's to write and theirs to withdraw, and a Story with none
 * is presented the way it was presented before anybody wrote one.
 */
export async function readStorySynopsis(event: H3Event) {
  const body = await readBody<{ synopsis?: unknown }>(event)
  const synopsis = typeof body?.synopsis === 'string' ? body.synopsis.trim() : ''

  if (synopsis.length > STORY_SYNOPSIS_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.storySynopsisLong', { max: STORY_SYNOPSIS_MAX_LENGTH }),
    })
  }

  return synopsis
}

/**
 * What a PATCH may change about a Story: its title, its Synopsis, or both. Each
 * is read only where the body names it, so the bench can write the one field the
 * Author typed in without carrying the other along — two fields in one header,
 * each landing on its own.
 *
 * A body naming neither is a request that changes nothing, and is refused as a
 * title being asked for: the title is the one thing a Story cannot be without,
 * so that is what an empty change is missing.
 */
export async function readStoryChanges(event: H3Event) {
  const body = await readBody<{ title?: unknown, synopsis?: unknown }>(event)
  const changes: { title?: string, synopsis?: string } = {}

  if (body?.title !== undefined) changes.title = await readStoryTitle(event)
  if (body?.synopsis !== undefined) changes.synopsis = await readStorySynopsis(event)
  // Which is a title asked for, by the reader that phrases the refusal.
  if (!changes.title && changes.synopsis === undefined) await readStoryTitle(event)

  return changes
}

/**
 * Reads the Language a Story is being written in. A trust boundary like the
 * title, and narrower than the column: the column holds any BCP-47 code, and
 * what an Author may pick from here is the short list the form offers. Saying
 * nothing is English, which is what the column already defaults to for every
 * Story written before there was anything to say.
 */
export async function readStoryLanguage(event: H3Event): Promise<StoryLanguage> {
  const body = await readBody<{ language?: unknown }>(event)
  const language = body?.language

  if (language === undefined || language === null) return STORY_LANGUAGE_DEFAULT
  if (!STORY_LANGUAGES.includes(language as StoryLanguage)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.storyLanguage') })
  }

  return language as StoryLanguage
}

/**
 * The Scenes of a Story, each a run of Shots in order and a node of the graph,
 * and the Exits that join them. Shared because an Author's Story and a Reader's
 * are the same graph read by two different doors — a Preview and a Reading play
 * the same Story, so they cannot be assembled by two queries that could drift.
 */
export async function readStoryGraph(storyId: string) {
  // One pass over the join, so a Scene with no Shots still arrives (the Shot
  // columns come back null) and the Shots arrive in the order the Scene numbers.
  const rows = await useDb()
    .select({
      sceneId: scenes.id,
      name: scenes.name,
      x: scenes.x,
      y: scenes.y,
      sets: scenes.sets,
      shotId: shots.id,
      text: shots.text,
      position: shots.position,
      description: shots.description,
      conditions: shots.conditions,
      // Whether the Shot carries an image, never the image: the bytes are served
      // one request apiece, so a Story is the same size however many images it has.
      hasImage: sql<boolean>`${shots.image} is not null`,
    })
    .from(scenes)
    .leftJoin(shots, eq(shots.sceneId, scenes.id))
    .where(eq(scenes.storyId, storyId))
    // Grouped below by watching the Scene change, so Scenes written in the same
    // instant have to be broken apart by something: their ids do it.
    .orderBy(scenes.createdAt, scenes.id, shots.position)

  const scenesOfStory: Scene[] = []
  for (const row of rows) {
    let scene = scenesOfStory.at(-1)
    if (scene?.id !== row.sceneId) {
      scene = {
        id: row.sceneId,
        name: row.name,
        x: row.x,
        y: row.y,
        sets: row.sets,
        shots: [],
      }
      scenesOfStory.push(scene)
    }
    if (row.shotId !== null) {
      scene.shots.push({
        id: row.shotId,
        text: row.text!,
        position: row.position!,
        image: row.hasImage ? shotImageUrl(row.shotId) : null,
        description: row.description!,
        conditions: row.conditions!,
      })
    }
  }

  // The Exits of the Story come on their own: joined to the Scenes above they
  // would multiply every Shot by every Exit leaving its Scene. They arrive in the
  // Place their Scene numbers them at, which is the order the Reader is offered
  // them in — the drawing has no say in it, see
  // `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`.
  const exitsOfStory = await useDb()
    .select({
      id: exits.id,
      fromSceneId: exits.fromSceneId,
      toSceneId: exits.toSceneId,
      text: exits.text,
      position: exits.position,
      conditions: exits.conditions,
    })
    .from(exits)
    .innerJoin(scenes, eq(exits.fromSceneId, scenes.id))
    .where(eq(scenes.storyId, storyId))
    .orderBy(scenes.createdAt, scenes.id, exits.position)

  return { scenes: scenesOfStory, exits: exitsOfStory }
}
