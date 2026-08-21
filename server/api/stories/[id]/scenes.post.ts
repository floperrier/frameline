import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Adds a Scene to a Story, as a node of its graph. Three things happen in the
 * one statement, because the neon-http driver has no transactions to hold them
 * together: the Scene is written, it is placed below the lowest node so it does
 * not land underneath one, and it becomes the opening Scene if the Story has
 * none — which makes the first Scene an Author writes the one a Reading starts
 * on, without their having to say so.
 *
 * Inserting from a select over the Author's own Stories also proves the Story is
 * theirs: a Story they do not own selects nothing, so nothing is written and the
 * Story reads as absent.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')
  const name = await readSceneName(event)

  const { rows } = await useDb().execute<Scene>(sql`
    with written as (
      insert into scenes (story_id, name, y)
      select id, ${name}, coalesce(
        (select max(y) + ${NODE_SPACING} from scenes where story_id = stories.id), 0)
      from stories
      where id = ${id}::uuid and author_id = ${author.id}::uuid
      returning id, story_id, name, x, y
    ),
    opened as (
      update stories set opening_scene_id = written.id
      from written
      where stories.id = written.story_id and stories.opening_scene_id is null
    )
    select id, name, x, y from written`)

  if (!rows[0]) throw notFound('Story')

  setResponseStatus(event, 201)
  return { ...rows[0], shots: [] }
})
