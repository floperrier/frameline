import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes a Scene again. The copy carries the Shots of the one it was made from —
 * their text, their Image, its Description, the Sound each strikes with and its
 * Transcript, their Conditions and their order — the Sound the Scene itself is
 * heard under, whether that is bytes of its own or the Scene it takes them from,
 * with the Transcript and the loop that belong to those bytes — and the Flags
 * that Scene sets on entry, under the same name and with none of its ways on.
 * From the moment it exists it is an ordinary Scene: renameable, rewritable, and
 * a place new ways on are written from.
 *
 * Copying `sound_of_scene_id` verbatim keeps the one hop of
 * `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`: the copy names whatever
 * the original named, and what the original named carries bytes by construction.
 *
 * It is what an Author writes where they wanted the Reader to meet a Scene a
 * second time, now that a Reading stands in a Scene at most once and the way on
 * that led back is refused — see `docs/adr/0048-a-scene-is-entered-once.md`. The
 * refusal without this act would leave the Author with nowhere to go.
 *
 * The Flags come with it because a copy is the Scene met again and not a
 * likeness of it: a Shot of the copy may play under a Condition testing a Flag
 * the Scene itself sets, and a copy that set none would be a Scene whose own
 * beats had stopped working. The record names the Shots and the Exits and is
 * silent here; this is the reading that leaves the copy an ordinary Scene.
 *
 * Nothing says it is a copy. There is no origin on the row, and the name is the
 * original's verbatim — what tells two Scenes of one name apart is the number
 * the bench draws, `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`,
 * which is drawn off the Story and never written back.
 *
 * One statement, because the neon-http driver has no transactions: the Scene is
 * inserted and its Shots are copied from that insert's own row, so a Scene can
 * never be left standing without the run it was made to carry. Selecting from the
 * Author's own Scenes is what proves it is theirs — a Scene they do not own
 * selects nothing, and nothing written reads as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')

  const { rows } = await useDb().execute<Scene>(sql`
    with made as (
      insert into scenes (story_id, name, sets, sound, sound_of_scene_id, transcript, sound_loops)
      select story_id, name, sets, sound, sound_of_scene_id, transcript, sound_loops from scenes
      where id = ${id}::uuid and id in (${scenesOf(author.id)})
      returning id, name, sets
    ),
    copied as (
      insert into shots
        (scene_id, text, position, image, description, sound, transcript, conditions)
      select made.id, shots.text, shots.position, shots.image, shots.description,
             shots.sound, shots.transcript, shots.conditions
      from made, shots
      where shots.scene_id = ${id}::uuid
      returning id
    )
    select id, name, sets from made
  `)

  if (!rows[0]) throw notFound(event, 'Scene')

  setResponseStatus(event, 201)
  return rows[0]
})
