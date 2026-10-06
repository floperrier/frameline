import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDb } from '../../../db'

/**
 * Puts a deleted Shot back where it stood, under its own id and carrying
 * everything it carried, from the row its delete held — see
 * `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`.
 *
 * Where it stood is `placeBack` in `shared/utils/scenes.ts`, which the bench drew
 * the row it left by: right after the Shot `after` while that Shot is still in
 * the Scene, at the head of the run where `after` is null, and otherwise at the
 * Place it had, capped at the run's length.
 *
 * A row held for more than a day is not held, whether or not a delete has come by
 * since to let go of it.
 *
 * One statement, because the neon-http driver has no transactions: the held row
 * is taken, the run opened from that Place on, the Shot inserted through
 * `jsonb_populate_record` with that Place written over its own — no column of
 * `shots` is named, so one added later comes back with no change here — and the
 * Story's Cover named again where it named this Shot and names nothing now.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const after = await readAfter(event)

  const { rows } = await useDb().execute<Omit<Shot, 'image'>>(sql`
    with held as (
      delete from deleted_shots
      where shot_id = ${id}::uuid and scene_id in (${scenesOf(author.id)})
        and taken_at > now() - interval '1 day'
      returning scene_id, "row", was_cover
    ),
    placed as (
      select held.scene_id, held."row", held.was_cover, case
        when ${after}::uuid is null then 0
        when before.position is not null then before.position + 1
        else least(
          (held."row"->>'position')::integer,
          (select count(*) from shots where shots.scene_id = held.scene_id)
        )
      end as position
      from held
      left join shots as before
        on before.id = ${after}::uuid and before.scene_id = held.scene_id
    ),
    opened as (
      update shots set position = shots.position + 1
      from placed
      where shots.scene_id = placed.scene_id and shots.position >= placed.position
    ),
    back as (
      insert into shots
      select restored.*
      from placed,
        jsonb_populate_record(
          null::shots, placed."row" || jsonb_build_object('position', placed.position)
        ) as restored
      returning id, text, position, description, conditions
    ),
    covered as (
      update stories set cover_shot_id = back.id
      from back, placed, scenes
      where placed.was_cover and stories.cover_shot_id is null
        and scenes.id = placed.scene_id and stories.id = scenes.story_id
    )
    select * from back`)

  if (!rows[0]) {
    throw createError({ statusCode: 404, message: saying(event)('refusals.putBack') })
  }

  setResponseStatus(event, 201)
  return rows[0]
})

/**
 * The Shot a deleted one stood after when it was deleted, or null where it stood
 * at the head of the run. An id that is not one is refused as one, rather than
 * left to fail the uuid cast as a server fault.
 */
async function readAfter(event: H3Event) {
  const body = await readBody<{ after?: unknown }>(event)
  const after = body?.after

  if (after === null) return null
  if (typeof after !== 'string' || !UUID_PATTERN.test(after)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.notAnId.shot') })
  }

  return after
}
