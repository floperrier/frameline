import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Writes a Shot again right under itself, carrying everything it carries — the
 * bytes of its Image and the point it is cropped around, its Description, its
 * words and their formatting, its Sound and Transcript, its Cut, Layout,
 * Movement, text arrival and Effects, its Conditions — so the same frame takes
 * the next line. It is the Shot's own *Duplicate Scene*, and like that copy it
 * holds bytes of its own, because an Image's bytes are kept in its Shot's row —
 * `docs/adr/0005-a-shots-image-lives-in-its-row.md`.
 *
 * The copy is never the Story's Cover: the Story names the original by id, and
 * nothing here names the copy anywhere.
 *
 * One statement, because the neon-http driver has no transactions: the Shot is
 * taken whole as `to_jsonb` writes it, the run opened after it, and the copy
 * inserted through `jsonb_populate_record` with an id of its own and the Place
 * after the original's written over the row's — no column of `shots` is named,
 * as in `back.post.ts`, so one added later is copied with no change here. Taking
 * it from the Author's own Scenes is what proves it is theirs: a Shot they do not
 * own selects nothing, and nothing written reads as absent.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Shot')

  const { rows } = await useDb().execute<Omit<Shot, 'image'>>(sql`
    with original as (
      select shots.scene_id, shots.position, to_jsonb(shots) as "row"
      from shots
      where shots.id = ${id}::uuid and shots.scene_id in (${scenesOf(author.id)})
    ),
    opened as (
      update shots set position = shots.position + 1
      from original
      where shots.scene_id = original.scene_id and shots.position > original.position
    ),
    copied as (
      insert into shots
      select copy.*
      from original,
        jsonb_populate_record(
          null::shots,
          original."row" || jsonb_build_object('id', gen_random_uuid(), 'position', original.position + 1)
        ) as copy
      returning id, text, position, description, conditions
    )
    select * from copied`)

  if (!rows[0]) throw notFound(event, 'Shot')

  setResponseStatus(event, 201)
  return rows[0]
})
