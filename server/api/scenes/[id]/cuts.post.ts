import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Draws a Cut from one Scene to another. Both ends are looked up in the one
 * statement that writes the Cut, joined on their Story: a Cut cannot leave the
 * Story it belongs to, and neither end can belong to another Author, because a
 * Scene that fails either test selects nothing and nothing is written.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Scene')
  const toSceneId = await readTargetSceneId(event)

  const { rows } = await useDb().execute<Cut>(sql`
    insert into cuts (from_scene_id, to_scene_id)
    select departure.id, arrival.id
    from scenes as departure
    join scenes as arrival on arrival.story_id = departure.story_id
    where departure.id = ${id}::uuid
      and arrival.id = ${toSceneId}::uuid
      and departure.story_id in (${storiesOf(author.id)})
    returning id, from_scene_id as "fromSceneId", to_scene_id as "toSceneId", text, condition`)

  if (!rows[0]) throw notFound('Scene')

  setResponseStatus(event, 201)
  return rows[0]
})
