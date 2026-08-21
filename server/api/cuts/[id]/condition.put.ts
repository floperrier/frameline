import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes the Condition a Cut is offered under, or takes it away. A PUT rather
 * than a PATCH: a Cut has one Condition or none, so the Author is replacing the
 * whole of it every time, and the way to say "always offered" is to send none.
 *
 * A Condition counting visits names a Scene, and that Scene is looked up in the
 * one statement that writes the Condition — joined on the Story the Cut leaves,
 * the way a Cut's own two ends are. A Condition therefore cannot be written
 * counting a Scene of another Story, or of another Author's: either names
 * nothing here, so nothing is written. The Scene can still be deleted
 * afterwards, which leaves a Condition counting visits to nowhere — see
 * `schema.ts` — but never one pointing outside the Story it belongs to.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Cut')
  const condition = await readCutCondition(event)
  const counts = condition && 'scene' in condition ? condition.scene : null

  const { rows } = await useDb().execute<{ id: string, condition: Condition | null }>(sql`
    update cuts set condition = ${condition && JSON.stringify(condition)}::jsonb
    from scenes as departure
    join stories on stories.id = departure.story_id
    where cuts.id = ${id}::uuid
      and departure.id = cuts.from_scene_id
      and stories.author_id = ${author.id}::uuid
      and (${counts}::uuid is null or exists (
        select 1 from scenes as counted
        where counted.id = ${counts}::uuid and counted.story_id = departure.story_id))
    returning cuts.id, cuts.condition`)

  if (!rows[0]) throw notFound('Cut')
  return rows[0]
})
