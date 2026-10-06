import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Cuts a Shot's words in two where the caret stood — issue #432,
 * `docs/adr/0071-a-shots-words-are-cut-where-the-caret-stands.md`. What is about
 * the words goes with the words, and what is about the Image or the Sound stays:
 * the Shot keeps `before`, its id, its Image and everything about it, its Sound
 * and Transcript, its Cut and Layout, and the Cover if it is one; the new Shot
 * right under it holds `after`, and carries how the text arrives, the text's
 * Effects and the Conditions the Shot plays under, so words that played only for
 * some Readers still play only for them. Every other column takes its default:
 * no Image and no Sound, and a Cut, a Layout and a Movement played as the Scene
 * says. `image` is never written, so its digest is its trigger's alone (ADR 0070).
 *
 * One statement, because the neon-http driver has no transactions: the Shot is
 * written, the run opened after it and the new Shot inserted at the Place after
 * the Shot's, as in `duplicate.post.ts`. Taking it from the Author's own Scenes is
 * what proves it is theirs: a Shot they do not own selects nothing, and nothing
 * written reads as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')
  const before = await readShotFormatted(event, 'before')
  const after = await readShotFormatted(event, 'after')

  const { rows } = await useDb().execute<Omit<Shot, 'image'>>(sql`
    with original as (
      select * from shots
      where shots.id = ${id}::uuid and shots.scene_id in (${scenesOf(author.id)})
    ),
    kept as (
      update shots set text = ${textOf(before)}, formatted = ${JSON.stringify(before)}::jsonb
      from original
      where shots.id = original.id
    ),
    opened as (
      update shots set position = shots.position + 1
      from original
      where shots.scene_id = original.scene_id and shots.position > original.position
    ),
    cut as (
      insert into shots (scene_id, position, text, formatted, conditions,
        text_arrives, text_lasts, text_after, text_by, text_pace, text_over, text_stays)
      select scene_id, position + 1, ${textOf(after)}, ${JSON.stringify(after)}::jsonb, conditions,
        text_arrives, text_lasts, text_after, text_by, text_pace, text_over, text_stays
      from original
      returning id, text, position, description, conditions
    )
    select * from cut`)

  if (!rows[0]) throw notFound(event, 'Shot')

  setResponseStatus(event, 201)
  return rows[0]
})
