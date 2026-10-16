import type { H3Event } from 'h3'
import { sql } from 'drizzle-orm'
import { useDb } from '../db'
import { parseFormatted, textOf } from '../../shared/utils/formatted'
import type { Formatted } from '../../shared/utils/formatted'
import { formattedRefused } from './shots'

/** Reads what to find, what replaces it and whether case counts: a trust boundary. */
export async function readReplacing(event: H3Event) {
  const body = await readBody<{ find?: unknown, replace?: unknown, matchCase?: unknown }>(event)
  const say = saying(event)
  const refused = (key: string, values?: Record<string, number>) =>
    createError({ statusCode: 400, message: say(key, values) })
  const { find, replace, matchCase } = body ?? {}
  if (typeof find !== 'string' || !find) throw refused('refusals.findEmpty')
  if (typeof replace !== 'string') throw refused('refusals.replaceMissing')
  if (/[\r\n]/.test(find + replace)) throw refused('refusals.findLine')
  if (find.length > FIND_MAX_LENGTH) throw refused('refusals.findLong', { max: FIND_MAX_LENGTH })
  if (replace.length > FIND_MAX_LENGTH) throw refused('refusals.replaceLong', { max: FIND_MAX_LENGTH })
  if (typeof matchCase !== 'boolean') throw refused('refusals.matchCase')
  return { find, replace, matchCase }
}

/**
 * The refusal of the first field, in document order, that a replacement would
 * take past what it may hold — or nothing. A Shot's words are read through the
 * boundary itself, so every rule it holds them to holds here.
 */
export function overflowing(event: H3Event, story: Found, replaced: Replacement[]) {
  const say = saying(event)
  const caps = {
    description: SHOT_DESCRIPTION_MAX_LENGTH,
    transcript: SOUND_TRANSCRIPT_MAX_LENGTH,
    question: QUESTION_MAX_LENGTH,
    text: EXIT_TEXT_MAX_LENGTH,
  }
  const where = (place: Place) => placeNamed(story, place, namesOnTheBench(story, say), say)
  for (const { place, value } of replaced) {
    if (place.field === 'formatted') {
      const read = parseFormatted(value, 'refuse')
      if ('formatted' in read) continue
      return read.refused === 'shotTextLong'
        ? say('refusals.replacedLong', { where: where(place), max: SHOT_TEXT_MAX_LENGTH })
        : formattedRefused(say, read.refused)
    }
    const max = caps[place.field]
    if ((value as string).length > max) return say('refusals.replacedLong', { where: where(place), max })
  }
}

/**
 * Writes every row a replacement changed, in one statement: the neon-http driver
 * has no transactions, and a Story half replaced is the one outcome worse than a
 * refusal. Each table's rows arrive as one jsonb array; a field the replacement
 * left alone arrives as null and is kept.
 *
 * The ids are the server's own, read from the Author's own Story by
 * `readStoryGraph`, so they need no second ownership test.
 */
export async function writeReplaced(replaced: Replacement[]) {
  const shots = new Map<string, Record<string, unknown>>()
  const scenes = new Map<string, Record<string, unknown>>()
  const exits = new Map<string, Record<string, unknown>>()
  for (const { place, value } of replaced) {
    const rows = place.of === 'shot' ? shots : place.of === 'scene' ? scenes : exits
    const row = rows.get(place.id) ?? { id: place.id }
    if (place.field === 'formatted') {
      row.text = textOf(value as Formatted)
      row.formatted = (parseFormatted(value, 'refuse') as { formatted: Formatted }).formatted
    }
    else row[place.field] = value
    rows.set(place.id, row)
  }
  await useDb().execute(sql`
    with
    shot_rows as (
      select * from jsonb_to_recordset(${JSON.stringify([...shots.values()])}::jsonb)
        as given(id uuid, text text, formatted jsonb, description text, transcript text)
    ),
    shots_written as (
      update shots set
        text = coalesce(given.text, shots.text),
        formatted = case when given.text is null then shots.formatted else given.formatted end,
        description = coalesce(given.description, shots.description),
        transcript = coalesce(given.transcript, shots.transcript)
      from shot_rows as given
      where shots.id = given.id
      returning shots.id
    ),
    scene_rows as (
      select * from jsonb_to_recordset(${JSON.stringify([...scenes.values()])}::jsonb)
        as given(id uuid, transcript text, question text)
    ),
    scenes_written as (
      update scenes set
        transcript = coalesce(given.transcript, scenes.transcript),
        question = coalesce(given.question, scenes.question)
      from scene_rows as given
      where scenes.id = given.id
      returning scenes.id
    ),
    exit_rows as (
      select * from jsonb_to_recordset(${JSON.stringify([...exits.values()])}::jsonb) as given(id uuid, text text)
    ),
    exits_written as (
      update exits set text = given.text from exit_rows as given
      where exits.id = given.id
      returning exits.id
    )
    select (select count(*) from shots_written)::int as shots,
      (select count(*) from scenes_written)::int as scenes,
      (select count(*) from exits_written)::int as exits`)
}
