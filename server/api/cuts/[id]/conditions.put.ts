import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes the Conditions a Cut is offered under, all of which must hold. A PUT
 * rather than a PATCH: the Author is replacing the whole list every time, and
 * the way to say "always offered" is to send none.
 *
 * A Condition counting visits names a Scene, and every such Scene is looked up
 * in the one statement that writes the list — joined on the Story the Cut
 * leaves, the way a Cut's own two ends are, by the guard a Shot's endpoint
 * writes behind too. The Scene can still be deleted afterwards, which leaves a
 * Condition counting visits to nowhere — see `schema.ts` — but never one
 * pointing outside the Story it belongs to.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Cut')
  const conditions = await readConditions(event, 'Cut')

  const { rows } = await useDb().execute<{ id: string, conditions: Condition[] }>(sql`
    update cuts set conditions = ${JSON.stringify(conditions)}::jsonb
    from scenes as owner
    join stories on stories.id = owner.story_id
    where cuts.id = ${id}::uuid
      and owner.id = cuts.from_scene_id
      and stories.author_id = ${author.id}::uuid
      and ${countedWithinTheStory(conditions)}
    returning cuts.id, cuts.conditions`)

  if (!rows[0]) throw notFound(event, 'Cut')
  return rows[0]
})
