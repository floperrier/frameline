import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Adds a Scene to a Story, as a node of its graph. Three things happen in the
 * one statement, because the neon-http driver has no transactions to hold them
 * together: the Scene is written, it is placed at the next free spot in the
 * graph, and it becomes the opening Scene if the Story has none — which makes
 * the first Scene an Author writes the one a Reading starts on, without their
 * having to say so.
 *
 * The Author may say where the Scene goes — an Exit dropped on the bare bench
 * writes the Scene it lands on at the point of the drop — and where they say
 * nothing the endpoint places it itself, at the next free spot. That spot is read
 * off how many Scenes the Story already has rather than off where they sit, so a
 * Scene the Author has dragged elsewhere does not push the next one out of the
 * graph's reach.
 *
 * The Scene arrives with no Shot in it, and deliberately: a Shot with neither
 * text nor Image is one the Author has not written yet, so a Scene that carried
 * one would arrive holding something unwritten for its card to count and for a
 * Delete to ask about. Add Shot is the one way a Shot is written, and no
 * sentence in the product may promise otherwise — see #113.
 *
 * Inserting from a select over the Author's own Stories also proves the Story is
 * theirs: a Story they do not own selects nothing, so nothing is written and the
 * Story reads as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')
  const name = await readSceneName(event)
  const placed = await readScenePlacementOffered(event)

  // Where the Author placed the Scene themselves, and the next free spot in the
  // graph where they left it to us. Cast, because a parameter standing where a
  // column's value goes carries no type for Postgres to read the integer column
  // against.
  const at = placed
    ? { x: sql`${placed.x}::int`, y: sql`${placed.y}::int` }
    : {
        x: sql`(written_before / ${NODES_PER_COLUMN}) * ${NODE_WIDTH + NODE_GAP}`,
        y: sql`(written_before % ${NODES_PER_COLUMN}) * ${NODE_SPACING}`,
      }

  const { rows } = await useDb().execute<Scene>(sql`
    with written as (
      insert into scenes (story_id, name, x, y)
      select
        stories.id,
        ${name},
        ${at.x},
        ${at.y}
      from stories
      cross join lateral (
        select count(*) from scenes where story_id = stories.id
      ) as counted (written_before)
      where stories.id = ${id}::uuid and stories.author_id = ${author.id}::uuid
      returning id, story_id, name, x, y
    ),
    opened as (
      update stories set opening_scene_id = written.id
      from written
      where stories.id = written.story_id and stories.opening_scene_id is null
    )
    select id, name, x, y from written`)

  if (!rows[0]) throw notFound(event, 'Story')

  setResponseStatus(event, 201)
  return { ...rows[0], shots: [] }
})
