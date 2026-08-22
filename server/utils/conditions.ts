import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

/**
 * Reads the Conditions a Cut is offered under, or a Shot played under: an absent
 * or empty list is a Cut offered to everyone, and a Shot every Reading sees. One
 * reader for both, because the two carry the same language and a Condition
 * refused on a Cut has to be refused on a Shot for the same reason.
 *
 * A trust boundary that matters more than most: what is written here lands in a
 * jsonb column, which would take any shape at all, and the engine then reads it
 * back as Conditions — so only the two flat shapes get through, member by member,
 * and neither of them can hold another. `carrier` names what is being written in
 * the refusal, so an Author is told which thing they overloaded.
 */
export async function readConditions(
  event: H3Event,
  carrier: 'Cut' | 'Shot',
): Promise<Condition[]> {
  const body = await readBody<{ conditions?: unknown }>(event)
  const conditions = body?.conditions

  if (conditions === null || conditions === undefined) return []
  if (!Array.isArray(conditions)) throw badCondition(event)

  if (conditions.length > CONDITIONS_MAX) {
    throw createError({
      statusCode: 400,
      message: saying(event)(
        `refusals.tooManyConditions.${carrier.toLowerCase()}`,
        { max: CONDITIONS_MAX },
      ),
    })
  }

  return conditions.map(condition => readCondition(event, condition))
}

/** One member of the list: a single flat test, or nothing that gets written. */
function readCondition(event: H3Event, condition: unknown): Condition {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    throw badCondition(event)
  }

  // A Condition holds its own two or three keys and nothing besides: anything
  // else is a Condition trying to carry a second one, and flatness is the whole
  // point of the language.
  const parts = Object.keys(condition).length

  if ('flag' in condition) {
    if (parts !== 2) throw badCondition(event)

    const { flag, is } = condition as { flag: unknown, is: unknown }
    const name = typeof flag === 'string' ? flag.trim() : ''

    if (!name || name.length > FLAG_NAME_MAX_LENGTH) throw badCondition(event)
    if (typeof is !== 'string' || is.length > FLAG_VALUE_MAX_LENGTH) throw badCondition(event)

    // Trimmed on both sides of the comparison the engine will make: a Flag is
    // stored trimmed, so a Condition asking for `on ` could never match one.
    return { flag: name, is: is.trim() }
  }

  const { scene, visits, times } = condition as { scene: unknown, visits: unknown, times: unknown }

  if (parts !== 3) throw badCondition(event)
  if (typeof scene !== 'string' || !UUID_PATTERN.test(scene)) throw badCondition(event)
  if (visits !== 'at least' && visits !== 'fewer than') throw badCondition(event)
  if (!Number.isInteger(times) || (times as number) < 1 || (times as number) > VISITS_MAX) {
    throw badCondition(event)
  }

  return { scene, visits, times: times as number }
}

function badCondition(event: H3Event) {
  return createError({
    statusCode: 400,
    message: saying(event)('refusals.badCondition', { max: VISITS_MAX }),
  })
}

/**
 * The guard both Conditions endpoints write their list behind: every Scene a
 * visit count names has to be a Scene of the Story the Cut or the Shot belongs
 * to. A Condition naming anything else matches nothing here, so nothing is
 * written, whichever Place it holds in the list — and a Condition can never be
 * made to count a Scene of another Story, or of another Author's.
 *
 * One fragment rather than one apiece, because it is the scoping and not merely
 * a lookup: two copies that had to stay in step by hand is one copy away from a
 * Condition reaching outside its Story. Both statements name the Story's Scene
 * `owner`, which is what lets the fragment be the same text in both.
 */
export function countedWithinTheStory(conditions: Condition[]) {
  const counts = conditions.flatMap(condition => 'scene' in condition ? [condition.scene] : [])

  return sql`not exists (
    select 1 from jsonb_array_elements_text(${JSON.stringify(counts)}::jsonb) as counted(id)
    where not exists (
      select 1 from scenes as counted_scene
      where counted_scene.id = counted.id::uuid
        and counted_scene.story_id = owner.story_id))`
}
