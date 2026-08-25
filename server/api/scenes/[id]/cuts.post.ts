import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Draws a Cut from one Scene to another. Both ends are looked up in the one
 * statement that writes the Cut, joined on their Story: a Cut cannot leave the
 * Story it belongs to, and neither end can belong to another Author, because a
 * Scene that fails either test selects nothing and nothing is written.
 *
 * The Cut takes the last Place among the ways on leaving its Scene, read and
 * written in that same statement for the reason a Shot's is — the neon-http
 * driver has no transactions to hold a read and a write together.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const toSceneId = await readTargetSceneId(event)

  const { rows } = await useDb().execute<Cut>(sql`
    insert into cuts (from_scene_id, to_scene_id, position)
    select
      departure.id,
      arrival.id,
      coalesce((select max(position) + 1 from cuts where from_scene_id = departure.id), 0)
    from scenes as departure
    join scenes as arrival on arrival.story_id = departure.story_id
    where departure.id = ${id}::uuid
      and arrival.id = ${toSceneId}::uuid
      and departure.story_id in (${storiesOf(author.id)})
    returning
      id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text, position, conditions`)

  if (!rows[0]) throw notFound(event, 'Scene')

  setResponseStatus(event, 201)
  return rows[0]
})
