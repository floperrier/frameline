import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Moves a Shot one place earlier or later by swapping positions with its
 * neighbour. Both rows change in a single statement — the neon-http driver has
 * no transactions, and two updates could leave two Shots sharing a position.
 * A Shot at either end of the Scene has no neighbour, so the left join yields
 * nothing to swap with and the Shot is written back to where it already was.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Shot')
  const step = await readMoveStep(event, 'Shot')

  const { rows } = await useDb().execute<{ id: string, position: number }>(sql`
    with moving as (
      select id, scene_id, position from shots
      where id = ${id}::uuid and scene_id in (${scenesOf(author.id)})
    ),
    neighbour as (
      select other.id, other.position
      from moving left join shots as other
        on other.scene_id = moving.scene_id and other.position = moving.position + ${step}
    )
    update shots set position = case
        when shots.id = moving.id then coalesce(neighbour.position, moving.position)
        else moving.position
      end
    from moving, neighbour
    where shots.id = moving.id or shots.id = neighbour.id
    returning shots.id, shots.position`)

  const moved = rows.find(row => row.id === id)
  if (!moved) throw notFound(event, 'Shot')
  return moved
})
