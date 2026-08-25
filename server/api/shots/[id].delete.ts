import { sql } from 'drizzle-orm'
import { useDb } from '../../db'

/**
 * Deletes a Shot and closes the gap it leaves, so the Scene keeps numbering its
 * Shots 0, 1, 2 with nothing missing. Both happen in one statement: the delete
 * runs whether or not the primary query reads its output, and without
 * transactions on neon-http a second statement could be the one that fails.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')

  const { rows } = await useDb().execute<{ id: string }>(sql`
    with gone as (
      delete from shots
      where id = ${id}::uuid and scene_id in (${scenesOf(author.id)})
      returning id, scene_id, position
    ),
    closed as (
      update shots set position = shots.position - 1
      from gone
      where shots.scene_id = gone.scene_id and shots.position > gone.position
    )
    select id from gone`)

  if (!rows[0]) throw notFound(event, 'Shot')
  return rows[0]
})
