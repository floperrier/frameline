import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { readingCounts, stories } from '../db/schema'
import { useDb } from '../db'

type Counted = 'begun' | 'ended'

/**
 * Adds one to how many Readings of a Story began, or ended in one of its Scenes,
 * which its Author is told and nobody else — see
 * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 *
 * One statement, an upsert taking its row from the Story, so it counts only for
 * a published Story, only an ending in a Scene its Edition holds — the rows stay
 * as many as the Story's own Scenes — and never for the Story's own Author. Any
 * other request counts nothing, and is answered the same 204 as one that counted:
 * whether a Story exists is not something a count says. Nothing about whoever
 * sent it is written.
 *
 * The session is asked for only where the request carries one. Asked of a request
 * with none, h3 starts one and sets its cookie, and a Reader needs no cookie by
 * design.
 */
export async function countReading(event: H3Event, kind: Counted) {
  const id = getRouterParam(event, 'id')
  const scene = kind === 'ended' ? await sceneOf(event) : id

  if (!id || !UUID_PATTERN.test(id) || !scene) return null

  const reader = getCookie(event, 'nuxt-session')
    ? (await getUserSession(event)).user?.id ?? null
    : null

  await useDb().execute(sql`
    insert into ${readingCounts} (story_id, kind, subject_id, count)
    select ${stories.id}, ${kind}, ${scene}::uuid, 1
    from ${stories}
    where ${stories.id} = ${id}::uuid
      and ${stories.publishedAt} is not null
      and ${stories.authorId} is distinct from ${reader}::uuid
      ${kind === 'ended'
        ? sql`and ${stories.edition} -> 'scenes' @> ${JSON.stringify([{ id: scene }])}::jsonb`
        : sql``}
    on conflict (story_id, kind, subject_id)
    do update set count = ${readingCounts.count} + 1`)

  return null
}

/** The Scene a Reading says it ended in, or nothing where the body names none. */
async function sceneOf(event: H3Event) {
  const body = await readBody<{ scene?: unknown }>(event).catch(() => undefined)
  const scene = body?.scene

  return typeof scene === 'string' && UUID_PATTERN.test(scene) ? scene : undefined
}

/** How many Readings of the Story in the row were counted as this kind, every Scene's summed. */
export function readingsCounted(kind: Counted) {
  return sql<number>`(select coalesce(sum(${readingCounts.count}), 0)::int from ${readingCounts}
    where ${readingCounts.storyId} = ${stories.id} and ${readingCounts.kind} = ${kind})`
}
