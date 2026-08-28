import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDb } from '../db'

/**
 * What each of the two numbered things is, in one entry apiece: the refusal it
 * is given, the table its rows sit in, and the column naming the Scene it is
 * numbered within. One record rather than three keyed the same way, so a thing
 * that gained a Place could not be half described.
 */
const NUMBERED = {
  Shot: { refusal: 'refusals.places.shot', table: sql.raw('shots'), within: sql.raw('scene_id') },
  Exit: { refusal: 'refusals.places.exit', table: sql.raw('exits'), within: sql.raw('from_scene_id') },
} as const

/**
 * Reads a new sequence of Places: the ids of everything a Scene numbers, in the
 * order the Author has just put them in. One reader for both, because the Shots
 * of a Scene and the ways on leaving it are numbered the same way.
 *
 * What can be settled without asking the database is settled here — a list, of
 * ids, each named once — and the rest of the permutation is settled by the
 * statement that writes it, where the ids the Scene really holds are in reach at
 * the moment they are written rather than a round trip earlier.
 */
export async function readPlaces(event: H3Event, what: 'Shot' | 'Exit') {
  const body = await readBody<{ places?: unknown }>(event)
  const places = body?.places

  if (!Array.isArray(places) || !places.length) throw badPlaces(event, what)
  if (places.some(id => typeof id !== 'string' || !UUID_PATTERN.test(id))) {
    throw badPlaces(event, what)
  }

  // Lowercased before they are counted, and kept that way: an id is a uuid,
  // which Postgres reads the same in either case, so two spellings of one id
  // would pass a comparison of strings and then be one id where it counts.
  const ids = places.map(id => (id as string).toLowerCase())

  // An id named twice would leave the Scene shorter than the Author sent, and
  // Postgres free to write either of the two Places it was given.
  if (new Set(ids).size !== ids.length) throw badPlaces(event, what)

  return ids
}

function badPlaces(event: H3Event, what: 'Shot' | 'Exit') {
  return createError({ statusCode: 400, message: saying(event)(NUMBERED[what].refusal) })
}

/**
 * Writes a whole sequence of Places at once: each id is written the Place it
 * holds in the list it arrived in. The one way a Place is written, whether the
 * Author dragged a thing four Places or pressed the control that moves it one.
 *
 * A trust boundary, and the invariant it guards is the glossary's own: a Place is
 * counted from the first with nothing missing. So the sequence is written only
 * where it names every id the Scene really holds and nothing else — the counts
 * agree and no id sent is a stranger, which with none of them sent twice is an
 * exact permutation. The comparison sits inside the statement that writes, so
 * there is no window between proving it and acting on it: the neon-http driver
 * has no transactions, and a Scene half renumbered is a Scene with two things at
 * one Place.
 */
export async function writePlaces(
  event: H3Event,
  what: 'Shot' | 'Exit',
  sceneId: string,
  authorId: string,
  places: string[],
) {
  const { table, within } = NUMBERED[what]

  const { rows } = await useDb().execute<{ mine: number, written: number }>(sql`
    with mine as (
      select id from scenes where id = ${sceneId}::uuid and id in (${scenesOf(authorId)})
    ),
    sent as (
      select given.id::uuid as id, given.place - 1 as position
      from jsonb_array_elements_text(${JSON.stringify(places)}::jsonb)
        with ordinality as given(id, place)
    ),
    held as (select numbered.id from ${table} as numbered, mine where numbered.${within} = mine.id),
    written as (
      update ${table} set position = sent.position
      from sent
      where ${table}.id = sent.id
        and ${table}.${within} in (select id from mine)
        and (select count(*) from held) = (select count(*) from sent)
        and not exists (select 1 from sent where sent.id not in (select id from held))
      returning ${table}.id
    )
    select
      (select count(*) from mine)::int as mine,
      (select count(*) from written)::int as written`)

  if (!rows[0]?.mine) throw notFound(event, 'Scene')
  if (rows[0].written !== places.length) throw badPlaces(event, what)

  return { id: sceneId, places }
}
