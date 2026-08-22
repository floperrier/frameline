import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Moves a Cut one Place earlier or later among the ways on leaving its Scene, by
 * swapping Places with its neighbour. One statement, as a Shot's move is: the
 * neon-http driver has no transactions, and two updates could leave two Cuts
 * sharing a Place. A Cut at either end has no neighbour, so the left join yields
 * nothing to swap with and the Cut is written back to where it already was.
 *
 * The neighbour is the nearest Cut on that side rather than the one a Place away,
 * because the numbering can have a hole in it: deleting a Scene takes the Cuts
 * arriving at it by cascade, which is the one way a Cut leaves without closing
 * the gap behind it. Nothing reads a Cut's Place but this order, so a hole is
 * invisible — unless a move looks across it and finds nothing there.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Cut')
  const step = await readMoveStep(event, 'Cut')

  const { rows } = await useDb().execute<{ id: string, position: number }>(sql`
    with moving as (
      select id, from_scene_id, position from cuts
      where id = ${id}::uuid and id in (${cutsOf(author.id)})
    ),
    neighbour as (
      select other.id, other.position
      from moving left join cuts as other
        on other.from_scene_id = moving.from_scene_id
          -- Signed by the step, so one comparison reads both ways: the nearest
          -- Cut above the one moving, or the nearest below it.
          and other.position * ${step} > moving.position * ${step}
      order by other.position * ${step}
      limit 1
    )
    update cuts set position = case
        when cuts.id = moving.id then coalesce(neighbour.position, moving.position)
        else moving.position
      end
    from moving, neighbour
    where cuts.id = moving.id or cuts.id = neighbour.id
    returning cuts.id, cuts.position`)

  const moved = rows.find(row => row.id === id)
  if (!moved) throw notFound('Cut')
  return moved
})
