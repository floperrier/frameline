import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Adds a Scene to a Story. Two things happen in the one statement, because the
 * neon-http driver has no transactions to hold them together: the Scene is
 * written, and it becomes the opening Scene if the Story has none — which makes
 * the first Scene an Author writes the one a Reading starts on, without their
 * having to say so.
 *
 * Nothing is placed. Where a Scene is drawn on the map is read off the Story —
 * how far it stands from the opening, and in what order it is offered — so a
 * Scene arrives with no coordinates to write and none to refuse: see
 * `docs/adr/0041-the-graph-is-drawn-from-the-story.md`.
 *
 * The Scene arrives with no Shot in it, and deliberately: a Shot with neither
 * text nor Image is one the Author has not written yet, so a Scene that carried
 * one would arrive holding something unwritten for the node to count and Delete
 * to ask about. `Add Shot` is the one way a Shot is written, and no sentence in
 * the product may promise otherwise — see #113.
 *
 * Inserting from a select over the Author's own Stories also proves the Story is
 * theirs: a Story they do not own selects nothing, and nothing written on a
 * Story reads as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')
  const name = await readSceneName(event)

  const { rows } = await useDb().execute<Scene>(sql`
    with written as (
      insert into scenes (story_id, name)
      select stories.id, ${name}
      from stories
      where stories.id = ${id}::uuid and stories.author_id = ${author.id}::uuid
      returning id, story_id, name
    ),
    opened as (
      update stories set opening_scene_id = written.id
      from written
      where stories.id = written.story_id and stories.opening_scene_id is null
    )
    select id, name from written
  `)

  if (!rows[0]) throw notFound(event, 'Story')

  setResponseStatus(event, 201)
  return { ...rows[0], sets: {}, shots: [] }
})
