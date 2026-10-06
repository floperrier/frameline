import { sql } from 'drizzle-orm'
import { useDb } from '../../db'

/**
 * Deletes a Shot and closes the gap it leaves, so the Scene keeps numbering its
 * Shots 0, 1, 2 with nothing missing. Both happen in one statement: the delete
 * runs whether or not the primary query reads its output, and without
 * transactions on neon-http a second statement could be the one that fails.
 *
 * The same statement holds what it took for a day, so the Author can put it back
 * where it stood: the row whole as `to_jsonb` writes it, which names no column,
 * and whether the Story's Cover named it. The Cover is read off the statement's
 * own snapshot, which the `set null` on `cover_shot_id` has not reached yet,
 * because a foreign key acts once the statement has run. Whatever was held more
 * than a day ago is let go of on the way past. See
 * `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')

  const { rows } = await useDb().execute<{ id: string }>(sql`
    with gone as (
      delete from shots
      where id = ${id}::uuid and scene_id in (${scenesOf(author.id)})
      returning *
    ),
    closed as (
      update shots set position = shots.position - 1
      from gone
      where shots.scene_id = gone.scene_id and shots.position > gone.position
    ),
    held as (
      insert into deleted_shots (shot_id, scene_id, "row", was_cover)
      select gone.id, gone.scene_id, to_jsonb(gone),
        exists (select 1 from stories where stories.cover_shot_id = gone.id)
      from gone
    ),
    pruned as (
      delete from deleted_shots where taken_at < now() - interval '1 day'
    )
    select id from gone`)

  if (!rows[0]) throw notFound(event, 'Shot')
  return rows[0]
})
