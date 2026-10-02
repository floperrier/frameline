import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Splits a Scene in two before one of its Shots. The Shots from that one on
 * become the run of a new Scene, written under the name the request carries and
 * renumbered from its first; every way on out of the Scene moves to the new one,
 * because the end of the run is what led out; and one Exit, with no words on it
 * yet, joins the two — so a Reading that played the Scene through plays exactly
 * what it played, with one press between the two halves. The Flags stay where
 * they were set, on the Scene a Reading enters first.
 *
 * Both halves go on being heard under the Sound the Scene was heard under: a
 * split says where a cut falls and does not take a bed away. The new Scene names
 * whatever the original named, or names the original itself where the original
 * carries the bytes — one hop either way, which is what
 * `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` holds to. The Shots move
 * as rows, so the Sound each strikes with and its Transcript move with them.
 *
 * The second half arrives its texts as the first did: the new Scene takes the
 * original's five, and the Shots that moved keep theirs as rows. It is laid out
 * as the first half is, moves its Images as the first did, and the Shots that
 * moved keep their own Layout and the point their Image is cropped around, which
 * are columns of the rows.
 *
 * It is cut as the first half is too. The new Scene takes the original's Cut, so
 * a Shot that moved and said nothing of its own is cut as it was, and it takes
 * how long the ways on stand, because the ways on go with it. The first half is
 * left with ways on that wait to be taken, which is the press between the two
 * halves. The Exit that joins them passes through what the Shot before the split
 * was cut through, that Shot's own or the Scene's, the way `cut()` reads it,
 * because the Reading cuts at an Exit by the Exit's passage. Without it a
 * dissolve between the two Shots would become a hard cut at the press — issue
 * #344.
 *
 * The Question is asked before the Exits, so it goes with the Exits to the second
 * half: the new Scene takes the sentence and the Flag its answer is held under,
 * and the first half is left asking nothing, in the same statement.
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
 * moves and is renumbered in one update, every Exit in another, the first
 * half's stand is cleared in a third, and the new Scene and the Exit that joins
 * the two are inserted beside them, all off one reading of where the split falls.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const name = await readSceneName(event)
  const shotId = await readSplitShot(event)

  const { rows } = await useDb().execute<Scene>(sql`
    with parted as (
      select shots.position, scenes.id as scene_id, scenes.story_id,
        scenes.sound_of_scene_id, scenes.sound is not null as has_sound,
        scenes.cut_after, scenes.cut_over, scenes.cut_through, scenes.exits_after,
        coalesce(leaving.cut_over, scenes.cut_over) as passage_over,
        coalesce(leaving.cut_through, scenes.cut_through) as passage_through,
        scenes.layout, scenes.movement_by, scenes.movement_direction,
        scenes.movement_over, scenes.text_after, scenes.text_by, scenes.text_pace,
        scenes.text_over, scenes.text_stays, scenes.question, scenes.question_flag
      from shots
      join scenes on scenes.id = shots.scene_id
      left join shots as leaving
        on leaving.scene_id = scenes.id and leaving.position = shots.position - 1
      where shots.id = ${shotId}::uuid
        and scenes.id = ${id}::uuid
        and scenes.id in (${scenesOf(author.id)})
        and shots.position > 0
    ),
    made as (
      insert into scenes (
        story_id, name, sound_of_scene_id,
        cut_after, cut_over, cut_through, exits_after,
        layout, movement_by, movement_direction, movement_over,
        text_after, text_by, text_pace, text_over, text_stays, question, question_flag
      )
      select parted.story_id, ${name},
        coalesce(parted.sound_of_scene_id, case when parted.has_sound then parted.scene_id end),
        parted.cut_after, parted.cut_over, parted.cut_through, parted.exits_after,
        parted.layout, parted.movement_by, parted.movement_direction,
        parted.movement_over, parted.text_after, parted.text_by, parted.text_pace,
        parted.text_over, parted.text_stays, parted.question, parted.question_flag
      from parted
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
    halved as (
      update scenes set exits_after = null, question = '', question_flag = ''
      from made, parted
      where scenes.id = parted.scene_id
      returning scenes.id
    ),
    joined as (
      insert into exits (from_scene_id, to_scene_id, text, position, cut_over, cut_through)
      select parted.scene_id, made.id, '', 0, parted.passage_over, parted.passage_through
      from made, parted
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
