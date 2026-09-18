import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Splits a Scene in two before one of its Shots. The Shots from that one on
 * become the run of a new Scene, written under the name the request carries and
 * renumbered from its first; every way on out of the Scene moves to the new one,
 * because the end of the run is what led out; and one Exit, with nothing on it
 * yet, joins the two — so a Reading that played the Scene through plays exactly
 * what it played, with one press between the two halves. The Flags stay where
 * they were set, on the Scene a Reading enters first.
 *
 * This is the act `docs/adr/0001-branching-only-between-scenes.md` said the
 * decision owed: an Author who wants a Story to branch in the middle of a Scene
 * splits it there and writes the second way on out of the first half.
 *
 * Never before the first Shot: the Scene would be left with none, which is a
 * Scene renamed rather than split. The Shot is asked for by id rather than by
 * Place so that a run renumbered under the Author's hands splits before the beat
 * they pointed at.
 *
 * One statement, because the neon-http driver has no transactions: every Shot
 * moves and is renumbered in one update, every Exit in another, and the new
 * Scene and the Exit that joins the two are inserted beside them, all off one
 * reading of where the split falls.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const name = await readSceneName(event)
  const shotId = await readSplitShot(event)

  const { rows } = await useDb().execute<Scene>(sql`
    with parted as (
      select shots.position, scenes.id as scene_id, scenes.story_id
      from shots
      join scenes on scenes.id = shots.scene_id
      where shots.id = ${shotId}::uuid
        and scenes.id = ${id}::uuid
        and scenes.id in (${scenesOf(author.id)})
        and shots.position > 0
    ),
    made as (
      insert into scenes (story_id, name)
      select story_id, ${name} from parted
      returning id, name
    ),
    moved as (
      update shots set scene_id = made.id, position = shots.position - parted.position
      from made, parted
      where shots.scene_id = parted.scene_id and shots.position >= parted.position
      returning shots.id
    ),
    led as (
      update exits set from_scene_id = made.id
      from made, parted
      where exits.from_scene_id = parted.scene_id
      returning exits.id
    ),
    joined as (
      insert into exits (from_scene_id, to_scene_id, text, position)
      select parted.scene_id, made.id, '', 0 from made, parted
      returning id
    )
    select id, name from made
  `)

  if (!rows[0]) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.split') })
  }

  setResponseStatus(event, 201)
  return rows[0]
})
