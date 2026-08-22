import { sql } from 'drizzle-orm'
import { useDb } from '../../db'

/**
 * Takes a Cut away and closes the gap it leaves, so the Scene goes on numbering
 * the ways on leaving it 0, 1, 2 with nothing missing. Both happen in one
 * statement, for the reason deleting a Shot does: without transactions on
 * neon-http a second statement could be the one that fails.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Cut')

  const { rows } = await useDb().execute<{ id: string }>(sql`
    with gone as (
      delete from cuts
      where id = ${id}::uuid and id in (${cutsOf(author.id)})
      returning id, from_scene_id, position
    ),
    closed as (
      update cuts set position = cuts.position - 1
      from gone
      where cuts.from_scene_id = gone.from_scene_id and cuts.position > gone.position
    )
    select id from gone`)

  if (!rows[0]) throw notFound('Cut')
  return rows[0]
})
