import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDb } from '../../../db'

/**
 * Moves a Shot to another Scene of its Story, to the end of that Scene's run.
 * The Places after it in the Scene it leaves close up, and it takes the Place
 * after the last Shot of the Scene it arrives in, which is the one Place that
 * renumbers nothing there: the Author places it from there with ↑.
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
 * the Author's is. The two updates touch different rows, and the Place it lands at
 * is counted off the statement's own snapshot, in which the Shot is not yet in the
 * Scene it arrives in.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const toSceneId = await readSceneToMoveTo(event)

  const { rows } = await useDb().execute<{ id: string, sceneId: string, position: number | null }>(sql`
    with taken as (
      select shots.id, shots.scene_id, shots.position, arrival.id as arrival_id
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
    moved as (
      update shots set
        scene_id = taken.arrival_id,
        position = (select count(*) from shots as run where run.scene_id = taken.arrival_id)
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

/** The Scene a Shot is moved to, refused as no id where it is not one rather than left to fail the uuid cast. */
async function readSceneToMoveTo(event: H3Event) {
  const body = await readBody<{ toSceneId?: unknown }>(event)
  const toSceneId = body?.toSceneId

  if (typeof toSceneId !== 'string' || !UUID_PATTERN.test(toSceneId)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.notAnId.scene') })
  }

  return toSceneId
}
