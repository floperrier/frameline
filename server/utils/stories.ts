import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { cuts, scenes, shots } from '../db/schema'
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
    throw createError({ statusCode: 400, statusMessage: 'A Story needs a title.' })
  }
  if (title.length > STORY_TITLE_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `A title cannot be longer than ${STORY_TITLE_MAX_LENGTH} characters.`,
    })
  }

  return title
}

/**
 * The Scenes of a Story, each a run of Shots in order and a node of the graph,
 * and the Cuts that join them. Shared because an Author's Story and a Reader's
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
      // Whether the Shot carries an image, never the image: the bytes are served
      // one request apiece, so a Story is the same size however many stills it has.
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
      })
    }
  }

  // The Cuts of the Story come on their own: joined to the Scenes above they
  // would multiply every Shot by every Cut leaving its Scene. They arrive in the
  // Place their Scene numbers them at, which is the order the Reader is offered
  // them in — the drawing has no say in it, see
  // `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`.
  const cutsOfStory = await useDb()
    .select({
      id: cuts.id,
      fromSceneId: cuts.fromSceneId,
      toSceneId: cuts.toSceneId,
      text: cuts.text,
      position: cuts.position,
      conditions: cuts.conditions,
    })
    .from(cuts)
    .innerJoin(scenes, eq(cuts.fromSceneId, scenes.id))
    .where(eq(scenes.storyId, storyId))
    .orderBy(scenes.createdAt, scenes.id, cuts.position)

  return { scenes: scenesOfStory, cuts: cutsOfStory }
}
