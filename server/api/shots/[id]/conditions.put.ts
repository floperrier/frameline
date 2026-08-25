import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes the Conditions a Shot plays under, all of which must hold. A PUT for
 * the same reason a Cut's is: the Author is replacing the whole list every time,
 * and the way to say "every Reading sees this" is to send none.
 *
 * A Condition counting visits names a Scene, and every such Scene is looked up
 * in the one statement that writes the list, joined on the Story the Shot
 * belongs to, behind the same guard a Cut's endpoint writes behind.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const conditions = await readConditions(event, 'Shot')

  const { rows } = await useDb().execute<{ id: string, conditions: Condition[] }>(sql`
    update shots set conditions = ${JSON.stringify(conditions)}::jsonb
    from scenes as owner
    join stories on stories.id = owner.story_id
    where shots.id = ${id}::uuid
      and owner.id = shots.scene_id
      and stories.author_id = ${author.id}::uuid
      and ${countedWithinTheStory(conditions)}
    returning shots.id, shots.conditions`)

  if (!rows[0]) throw notFound(event, 'Shot')
  return rows[0]
})
