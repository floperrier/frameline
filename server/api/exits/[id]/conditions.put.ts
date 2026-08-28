import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes the Conditions an Exit is offered under, all of which must hold. A PUT
 * rather than a PATCH: the Author is replacing the whole list every time, and
 * the way to say "always offered" is to send none.
 *
 * A Condition counting visits names a Scene, and every such Scene is looked up
 * in the one statement that writes the list — joined on the Story the Exit
 * leaves, the way an Exit's own two ends are, by the guard a Shot's endpoint
 * writes behind too. The Scene can still be deleted afterwards, which leaves a
 * Condition counting visits to nowhere — see `schema.ts` — but never one
 * pointing outside the Story it belongs to.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Exit')
  const conditions = await readConditions(event, 'Exit')

  const { rows } = await useDb().execute<{ id: string, conditions: Condition[] }>(sql`
    update exits set conditions = ${JSON.stringify(conditions)}::jsonb
    from scenes as owner
    join stories on stories.id = owner.story_id
    where exits.id = ${id}::uuid
      and owner.id = exits.from_scene_id
      and stories.author_id = ${author.id}::uuid
      and ${countedWithinTheStory(conditions)}
    returning exits.id, exits.conditions`)

  if (!rows[0]) throw notFound(event, 'Exit')
  return rows[0]
})
