import { and, eq, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { lists } from '../db/schema'
import { useDb } from '../db'

/**
 * The Author's Favourites, written here the first time anybody asks for it.
 *
 * Every account has Favourites from the start, and this is what makes that true
 * of an account created before Lists existed as well as one created after: the
 * row is written by the read that needs it rather than by a sign-in that already
 * happened. The unique index on an Author with no title keeps it one row however
 * many requests arrive at once — the second insert conflicts and does nothing.
 *
 * It has no title, which is the whole of what makes it Favourites: there is
 * nothing for an Author to write and nothing for the interface to draw, so the
 * word it is shown under is the interface's own. See
 * `docs/adr/0028-favourites-is-a-list-without-a-title.md`.
 */
export async function favouritesOf(authorId: string) {
  await useDb().insert(lists).values({ authorId, title: null }).onConflictDoNothing()

  const [favourites] = await useDb()
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.authorId, authorId), isNull(lists.title)))

  return favourites!.id
}

/**
 * Reads a List's title from the request body. A trust boundary like a Story's
 * title: it is capped here rather than left to Postgres.
 *
 * Blank is a refusal rather than an untitled List, because an untitled List is
 * Favourites: an Author who could empty a title would have written a second
 * Favourites, which the unique index would refuse in words nobody wants to read.
 */
export async function readListTitle(event: H3Event) {
  const body = await readBody<{ title?: unknown }>(event)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''

  if (!title) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.listTitle') })
  }
  if (title.length > LIST_TITLE_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.listTitleLong', { max: LIST_TITLE_MAX_LENGTH }),
    })
  }

  return title
}

/**
 * What a write that changed no List was, said in the terms the Author can act
 * on. Two things it can have been: their own Favourites, which has no title to
 * write and no way to be deleted — a refusal worth saying out loud — or a List
 * that is not theirs, which is absent like everything else they never wrote.
 *
 * Written once because renaming and deleting refuse on the same two grounds and
 * differ only in the sentence Favourites is refused with.
 */
export async function refuseUnchangedList(
  event: H3Event,
  authorId: string,
  id: string,
  refusal: string,
) {
  const [own] = await useDb()
    .select({ title: lists.title })
    .from(lists)
    .where(and(eq(lists.id, id), eq(lists.authorId, authorId)))

  if (own && own.title === null) {
    throw createError({ statusCode: 400, message: saying(event)(refusal) })
  }

  throw notFound(event, 'List')
}
