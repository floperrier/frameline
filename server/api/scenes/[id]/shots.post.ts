import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Adds an empty Shot at the end of a Scene. The position it takes is read and
 * written in the one statement, because the neon-http driver has no
 * transactions to hold a read and a write together.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Scene')

  const { rows } = await useDb().execute<Omit<Shot, 'image'>>(sql`
    insert into shots (scene_id, position)
    select scenes.id, coalesce((select max(position) + 1 from shots where scene_id = scenes.id), 0)
    from scenes
    where scenes.id = ${id}::uuid and scenes.id in (${scenesOf(author.id)})
    returning id, text, position, description, conditions`)

  if (!rows[0]) throw notFound(event, 'Scene')

  setResponseStatus(event, 201)
  return rows[0]
})
