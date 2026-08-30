import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Leads an Exit to another Scene. Only where it arrives changes, so the Exit
 * keeps its text, its Conditions and the Place it is offered at — which are
 * exactly what an Author threw away when the way to correct a way on was to
 * delete it and draw it again. The Scene it leaves is untouched, so nothing is
 * renumbered at either end.
 *
 * A PUT on the arrival rather than a field of the Exit's own PATCH, the way the
 * Conditions have a PUT of their own: what is being replaced is one whole thing
 * about the Exit, and the statement that writes it has a join the text has no
 * use for.
 *
 * That join is the guard. The arrival is looked up in the one statement that
 * writes it, on the Story of the Scene the Exit leaves — the same shape the
 * statement that draws an Exit uses: an Exit cannot be led out of its own Story,
 * and neither end can belong to another Author, because a Scene that fails
 * either test selects nothing and nothing is written.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Exit')
  const toSceneId = await readTargetSceneId(event)

  const { rows } = await useDb().execute<Exit>(sql`
    update exits set to_scene_id = arrival.id
    from scenes as departure
    join stories on stories.id = departure.story_id
    join scenes as arrival on arrival.story_id = departure.story_id
    where exits.id = ${id}::uuid
      and departure.id = exits.from_scene_id
      and arrival.id = ${toSceneId}::uuid
      and stories.author_id = ${author.id}::uuid
    returning
      exits.id,
      exits.from_scene_id as "fromSceneId",
      exits.to_scene_id as "toSceneId",
      exits.text,
      exits.position,
      exits.conditions`)

  if (!rows[0]) throw notFound(event, 'Exit')
  return rows[0]
})
