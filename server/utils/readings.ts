import { and, eq, ne, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { readingCounts, stories } from '../db/schema'
import { useDb } from '../db'

type Counted = 'begun' | 'ended' | 'taken'

/**
 * What a count of each kind is counted under, read out of the body where it is
 * not the Story itself, and where in the Edition it has to stand to be counted.
 */
const UNDER = {
  ended: { field: 'scene', held: 'scenes' },
  taken: { field: 'exit', held: 'exits' },
} as const

/**
 * Adds one to how many Readings of a Story began, ended in one of its Scenes, or
 * took one of its Exits, which its Author is told and nobody else — see
 * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 *
 * One statement, an upsert taking its row from the Story, so it counts only for
 * a published Story, only an ending in a Scene or a take of an Exit its Edition
 * holds — the rows stay as many as the Story's own Scenes and Exits — and never
 * for the Story's own Author. Any other request counts nothing, and is answered
 * the same 204 as one that counted: whether a Story exists is not something a
 * count says. Nothing about whoever sent it is written.
 *
 * The session is asked for only where the request carries one. Asked of a request
 * with none, h3 starts one and sets its cookie, and a Reader needs no cookie by
 * design.
 */
export async function countReading(event: H3Event, kind: Counted) {
  const id = getRouterParam(event, 'id')
  const under = kind === 'begun' ? undefined : UNDER[kind]
  const subject = under ? await subjectOf(event, under.field) : id

  if (!id || !UUID_PATTERN.test(id) || !subject) return null

  const reader = getCookie(event, 'nuxt-session')
    ? (await getUserSession(event)).user?.id ?? null
    : null

  await useDb().execute(sql`
    insert into ${readingCounts} (story_id, kind, subject_id, count)
    select ${stories.id}, ${kind}, ${subject}::uuid, 1
    from ${stories}
    where ${stories.id} = ${id}::uuid
      and ${stories.publishedAt} is not null
      and ${stories.authorId} is distinct from ${reader}::uuid
      ${under
        ? sql`and ${stories.edition} -> ${under.held}::text @> ${JSON.stringify([{ id: subject }])}::jsonb`
        : sql``}
    on conflict (story_id, kind, subject_id)
    do update set count = ${readingCounts.count} + 1`)

  return null
}

/** The Scene or the Exit a Reading names in its body, or nothing where it names none. */
async function subjectOf(event: H3Event, field: 'scene' | 'exit') {
  const body = await readBody<Record<string, unknown>>(event).catch(() => undefined)
  const subject = body?.[field]

  return typeof subject === 'string' && UUID_PATTERN.test(subject) ? subject : undefined
}

/** How many Readings of the Story in the row were counted as this kind, every Scene's summed. */
export function readingsCounted(kind: Counted) {
  return sql<number>`(select coalesce(sum(${readingCounts.count}), 0)::int from ${readingCounts}
    where ${readingCounts.storyId} = ${stories.id} and ${readingCounts.kind} = ${kind})`
}

/**
 * How often each Exit of a Story was taken and how many Readings ended in each of
 * its Scenes, for the Exits and the Scenes it still holds: a count under one
 * deleted since stays in the table, and in the sum of endings, and is not
 * answered on its own.
 */
export async function readingsUnder(storyId: string, held: { scenes: { id: string }[], exits: { id: string }[] }) {
  const rows = await useDb()
    .select({ kind: readingCounts.kind, subjectId: readingCounts.subjectId, count: readingCounts.count })
    .from(readingCounts)
    .where(and(eq(readingCounts.storyId, storyId), ne(readingCounts.kind, 'begun')))

  const holds = (among: { id: string }[], id: string) => among.some(each => each.id === id)
  const taken: Record<string, number> = {}
  const endedIn: Record<string, number> = {}
  for (const { kind, subjectId, count } of rows) {
    if (kind === 'taken' && holds(held.exits, subjectId)) taken[subjectId] = count
    if (kind === 'ended' && holds(held.scenes, subjectId)) endedIn[subjectId] = count
  }

  return { taken, endedIn }
}
