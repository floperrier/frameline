import { and, eq, isNotNull, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { authors, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * A published Story as a Reader receives it, with no account and no session.
 * Whether it is published is part of the lookup rather than a check after it, so
 * an unpublished Story cannot be answered by mistake: it gets the same not-found
 * as an id nobody ever wrote.
 *
 * What is read is the edition its Author last published, and not the rows the
 * bench is writing: a Reader never meets a Shot half typed — see
 * `docs/adr/0069-a-published-story-is-read-as-it-was-published.md`. What presents
 * it — the title, the Synopsis, the Language, the Cover and the Author's Name — is
 * read live beside it, as every shelf reads it.
 *
 * A Reading is not stored anywhere. The Reader is handed the Story and keeps
 * their own Path in it, which is why two Readers of one Story can never
 * share what they have accumulated — there is nothing here to share.
 *
 * It is signed, as an entry on a shelf is: the Author's id and Name, so the page
 * a Reader finishes on can lead to whoever wrote what they have just read. The
 * join is an inner one because a Story is owned by one Author and the column
 * says so; the Name is what may be absent, and the page draws no byline where
 * there is none. The email is not selected.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      // Not drawn on the page: it is what the link is presented by where it is
      // pasted, which is where the Story meets somebody who has not read it.
      synopsis: stories.synopsis,
      language: stories.language,
      edition: stories.edition,
      // The title card wears the same Image the shelf did, so a Reader arrives
      // where the entry they pressed said they would.
      coverShotId: coverShotOf,
      cropX: coverShot.cropX,
      cropY: coverShot.cropY,
      authorId: authors.id,
      authorName: authors.name,
    })
    .from(stories)
    .innerJoin(authors, eq(stories.authorId, authors.id))
    .leftJoin(coverShot, sql`${coverShot.id} = ${coverShotOf}`)
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  // The Cover leaves as one object, the Image and its point together, so the
  // columns it was read from are not sent beside it.
  const { coverShotId, cropX, cropY, edition: kept, ...rest } = story
  const edition = kept ?? await editionOnFirstRead(event, id)

  // Whether the Story carries a Sound anywhere, which is what makes the title
  // card a control: a Reader who presses it consents to being played something,
  // and a browser will not play into a page nobody has touched. Read off the
  // addresses the edition already carries, so no query touches the bytes.
  return {
    ...rest,
    ...edition,
    cover: coverFor({ coverShotId, cropX, cropY }),
    carriesSound: carriesSound(edition),
  }
})

/**
 * A Story published before editions existed has none until somebody reads it, and
 * is given one then, so its Readers see no change. Two first reads at once both
 * try; whichever writes second finds the other's. A Story that moved under the
 * attempt is asked for again.
 */
async function editionOnFirstRead(event: H3Event, id: string) {
  const taken = await takeEdition(
    id, sql`${stories.publishedAt} is not null and ${stories.edition} is null`)
  if (taken) return taken.edition

  const [story] = await useDb().select({ edition: stories.edition }).from(stories)
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))
  if (!story) throw notFound(event, 'Story')
  if (story.edition) return story.edition

  throw createError({ statusCode: 409, message: saying(event)('refusals.editionMoved') })
}
