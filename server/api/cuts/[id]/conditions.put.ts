import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes the Conditions a Cut is offered under, all of which must hold. A PUT
 * rather than a PATCH: the Author is replacing the whole list every time, and
 * the way to say "always offered" is to send none.
 *
 * A Condition counting visits names a Scene, and every such Scene is looked up
 * in the one statement that writes the list — joined on the Story the Cut
 * leaves, the way a Cut's own two ends are. A Condition therefore cannot be
 * written counting a Scene of another Story, or of another Author's: either
 * names nothing here, so nothing is written, whichever Place it holds in the
 * list. The Scene can still be deleted afterwards, which leaves a Condition
 * counting visits to nowhere — see `schema.ts` — but never one pointing outside
 * the Story it belongs to.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Cut')
  const conditions = await readCutConditions(event)
  const counts = conditions.flatMap(
    condition => 'scene' in condition ? [condition.scene] : [])

  const { rows } = await useDb().execute<{ id: string, conditions: Condition[] }>(sql`
    update cuts set conditions = ${JSON.stringify(conditions)}::jsonb
    from scenes as departure
    join stories on stories.id = departure.story_id
    where cuts.id = ${id}::uuid
      and departure.id = cuts.from_scene_id
      and stories.author_id = ${author.id}::uuid
      and not exists (
        select 1 from jsonb_array_elements_text(${JSON.stringify(counts)}::jsonb) as counted(id)
        where not exists (
          select 1 from scenes as counted_scene
          where counted_scene.id = counted.id::uuid
            and counted_scene.story_id = departure.story_id))
    returning cuts.id, cuts.conditions`)

  if (!rows[0]) throw notFound('Cut')
  return rows[0]
})
