import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')
  const name = await readSceneName(event)

  // Inserting from a select over the Author's own Stories writes the Scene and
  // proves the Story is theirs in one statement: a Story they do not own selects
  // nothing, so nothing is written and the Story reads as absent.
  const { rows } = await useDb().execute<{ id: string, name: string }>(sql`
    insert into scenes (story_id, name)
    select id, ${name} from stories
    where id = ${id}::uuid and author_id = ${author.id}::uuid
    returning id, name`)

  if (!rows[0]) throw notFound('Story')

  setResponseStatus(event, 201)
  return rows[0]
})
