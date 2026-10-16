import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Adds an empty Shot at the end of a Scene, or, where the body carries
 * `{ formatted: [...] }`, a Shot for each of those texts, in that order — the
 * Shots a pasted text makes, issue #438. The Places they take are read and
 * written in the one statement, because the neon-http driver has no
 * transactions to hold a read and a write together: every row reads the end of
 * the run as it stood before the statement, and adds its own ordinal to it.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const texts = await readShotsFormatted(event)
  const made = JSON.stringify((texts ?? [undefined]).map(formatted => formatted
    ? { text: textOf(formatted), formatted }
    : { text: '', formatted: null }))

  const { rows } = await useDb().execute<Omit<Shot, 'image'>>(sql`
    with made as (
      insert into shots (scene_id, position, text, formatted)
      select scenes.id,
        coalesce((select max(position) + 1 from shots where scene_id = scenes.id), 0) + texts.at - 1,
        texts.shot->>'text', nullif(texts.shot->'formatted', 'null'::jsonb)
      from scenes, jsonb_array_elements(${made}::jsonb) with ordinality as texts(shot, at)
      where scenes.id = ${id}::uuid and scenes.id in (${scenesOf(author.id)})
      returning id, text, position, description, conditions
    )
    select * from made order by position`)

  if (!rows[0]) throw notFound(event, 'Scene')

  setResponseStatus(event, 201)
  return texts ? rows : rows[0]
})
