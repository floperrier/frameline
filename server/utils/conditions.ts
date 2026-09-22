import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

/** The refusal each carrier of a list is given, one message apiece. */
const TOO_MANY = {
  Exit: 'refusals.tooManyConditions.exit',
  Shot: 'refusals.tooManyConditions.shot',
} as const

/**
 * Reads the Conditions an Exit is offered under, or a Shot played under: an absent
 * or empty list is an Exit offered to everyone, and a Shot every Reading sees. One
 * reader for both, because the two carry the same language and a Condition
 * refused on an Exit has to be refused on a Shot for the same reason.
 *
 * A trust boundary that matters more than most: what is written here lands in a
 * jsonb column, which would take any shape at all, and the engine then reads it
 * back as Conditions — so only the flat shapes get through, member by member, and
 * none of them can hold another. `carrier` names what is being written in the
 * refusal, so an Author is told which thing they overloaded.
 *
 * Two shapes and no more: what a Flag holds, or whether a Scene has been entered.
 * A third was taken for one deploy — the shape that counted entries — so that a
 * browser holding the previous code could still send its list back while the
 * migration was on its way; #306 rewrote every row and this no longer reads it.
 * That is the contract half of
 * `docs/adr/0002-the-schema-moves-with-the-deploy.md`'s expand–contract, and the
 * end of `docs/adr/0048-a-scene-is-entered-once.md`'s work on the language.
 */
export async function readConditions(
  event: H3Event,
  carrier: 'Exit' | 'Shot',
): Promise<Condition[]> {
  const body = await readBody<{ conditions?: unknown }>(event)
  const conditions = body?.conditions

  if (conditions === null || conditions === undefined) return []
  if (!Array.isArray(conditions)) throw badCondition(event)

  if (conditions.length > CONDITIONS_MAX) {
    throw createError({
      statusCode: 400,
      message: saying(event)(TOO_MANY[carrier], { max: CONDITIONS_MAX }),
    })
  }

  return conditions.map(condition => readCondition(event, condition))
}

/** One member of the list: a single flat test, or nothing that gets written. */
function readCondition(event: H3Event, condition: unknown): Condition {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    throw badCondition(event)
  }

  // A Condition holds its own two keys and nothing besides: anything else is a
  // Condition trying to carry a second one, and flatness is the whole point of the
  // language.
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

  if (parts !== 2) throw badCondition(event)

  const { scene, entered } = condition as { scene: unknown, entered: unknown }

  if (typeof scene !== 'string' || !UUID_PATTERN.test(scene)) throw badCondition(event)
  if (typeof entered !== 'boolean') throw badCondition(event)

  return { scene, entered }
}

function badCondition(event: H3Event) {
  return createError({ statusCode: 400, message: saying(event)('refusals.badCondition') })
}

/**
 * The guard both Conditions endpoints write their list behind: every Scene a
 * Condition names has to be a Scene of the Story the Exit or the Shot belongs to.
 * A Condition naming anything else matches nothing here, so nothing is written,
 * whichever Place it holds in the list — and a Condition can never be made to ask
 * about a Scene of another Story, or of another Author's.
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
