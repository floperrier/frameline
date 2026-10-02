import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDb } from '../../../db'

/**
 * Moves a Shot to another Scene of its Story, at the Place it is given there.
 * The Places after it in the Scene it leaves close up, and in the Scene it
 * arrives in the Shots from that Place on move one Place later. Given none, or
 * one past the end, it takes the Place after the last Shot, which renumbers
 * nothing there: that is the move made by naming a Scene, and the Author places it
 * from there with ↑. A Place is given where a frame is let go of in another band
 * of the Contact Sheet, because two requests — a move, then a renumbering — would
 * leave the Story between them in an order nobody asked for, and in it if the
 * second failed.
 *
 * The row itself moves, so no column of `shots` is named and everything the Shot
 * holds travels unchanged — its Image and the point it is cropped around, its
 * words and their formatting, its Sound and Transcript, its own Cut, Layout,
 * Movement, Effects and text arrival, its Conditions — and the Story's Cover,
 * which names the Shot by id, still names it. What it left to its Scene it now
 * takes from the one it arrives in, because that is what *as its Scene says* is.
 *
 * One statement, because the neon-http driver has no transactions. The target is
 * joined on the Story of the Scene the Shot leaves, so a Scene of another Story,
 * or of another Author, selects nothing and is the not-found a Shot that is not
 * the Author's is. The three updates touch different rows — the Scene left after
 * the Shot, the Scene arrived in from its Place on, the Shot itself — and the Place
 * it lands at is counted off the statement's own snapshot, in which the Shot is not
 * yet in the Scene it arrives in.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const { toSceneId, place } = await readWhereToMove(event)

  // `least` passes a null over, so no Place given is the end exactly as one past it is.
  const { rows } = await useDb().execute<{ id: string, sceneId: string, position: number | null }>(sql`
    with taken as (
      select shots.id, shots.scene_id, shots.position, arrival.id as arrival_id,
        least(
          ${place ?? null}::bigint,
          (select count(*) from shots as run where run.scene_id = arrival.id)
        ) as landing
      from shots
      join scenes as departure on departure.id = shots.scene_id
      join scenes as arrival on arrival.story_id = departure.story_id
      where shots.id = ${id}::uuid
        and arrival.id = ${toSceneId}::uuid
        and departure.id in (${scenesOf(author.id)})
    ),
    closed as (
      update shots set position = shots.position - 1
      from taken
      where taken.arrival_id <> taken.scene_id
        and shots.scene_id = taken.scene_id and shots.position > taken.position
    ),
    opened as (
      update shots set position = shots.position + 1
      from taken
      where taken.arrival_id <> taken.scene_id
        and shots.scene_id = taken.arrival_id and shots.position >= taken.landing
    ),
    moved as (
      update shots set scene_id = taken.arrival_id, position = taken.landing
      from taken
      where taken.arrival_id <> taken.scene_id and shots.id = taken.id
      returning shots.id, shots.position
    )
    select taken.id, taken.arrival_id as "sceneId", moved.position
    from taken left join moved on moved.id = taken.id`)

  if (!rows[0]) throw notFound(event, 'Shot')
  if (rows[0].position === null) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.moveShot') })
  }

  return rows[0]
})

/**
 * The Scene a Shot is moved to, refused as no id where it is not one rather than
 * left to fail the uuid cast, and the Place it takes there, counted from nought as
 * `position` is. A Place is a whole number within what the database counts in, or
 * nothing at all; a Place past the end is the statement's to cap.
 */
async function readWhereToMove(event: H3Event) {
  const body = await readBody<{ toSceneId?: unknown, place?: unknown }>(event)
  const toSceneId = body?.toSceneId
  const place = body?.place

  if (typeof toSceneId !== 'string' || !UUID_PATTERN.test(toSceneId)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.notAnId.scene') })
  }
  if (place !== undefined && !(Number.isSafeInteger(place) && (place as number) >= 0)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.movePlace') })
  }

  return { toSceneId, place: place as number | undefined }
}
