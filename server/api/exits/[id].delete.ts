import { sql } from 'drizzle-orm'
import { useDb } from '../../db'

/**
 * Takes an Exit away and closes the gap it leaves, so the Scene goes on numbering
 * the ways on leaving it 0, 1, 2 with nothing missing. Both happen in one
 * statement, for the reason deleting a Shot does: without transactions on
 * neon-http a second statement could be the one that fails.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Exit')

  const { rows } = await useDb().execute<{ id: string }>(sql`
    with gone as (
      delete from exits
      where id = ${id}::uuid and id in (${exitsOf(author.id)})
      returning id, from_scene_id, position
    ),
    closed as (
      update exits set position = exits.position - 1
      from gone
      where exits.from_scene_id = gone.from_scene_id and exits.position > gone.position
    )
    select id from gone`)

  if (!rows[0]) throw notFound(event, 'Exit')
  return rows[0]
})
