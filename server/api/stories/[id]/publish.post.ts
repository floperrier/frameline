import { and, eq, sql } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Publishes a Story: from here on anyone can read it at `/read/<id>`, with no
 * account. The link is the Story's own id, so publishing again after an
 * unpublish hands back the same link rather than a new one.
 *
 * Every Publish takes an edition, which is what Readers read until the next one —
 * see `docs/adr/0069-a-published-story-is-read-as-it-was-published.md`. On a
 * Story already published it publishes the changes and leaves `published_at`
 * alone, because the Catalogue is ordered by first publication and publishing the
 * changes is not publishing anew.
 *
 * A Story with no opening Scene has nothing for a Reading to start on, so
 * publishing it would hand out a link that answers with an ending. The opening
 * Scene is part of the condition the edition is written under, scoped by Author
 * beside it, so neither someone else's Story nor an unreadable one can be
 * published by checking first and writing after.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')
  const author = await requireAuthor(event)

  const taken = await takeEdition(
    id, sql`${stories.authorId} = ${author.id} and ${stories.openingSceneId} is not null`)

  if (taken) return { id: taken.id, publishedAt: taken.publishedAt, editionAt: taken.editionAt }

  // Nothing was published, so the Story is either not this Author's — absent,
  // like everywhere else — or it is theirs and has no opening Scene, which is a
  // refusal they can act on and so is worth saying out loud. Otherwise it moved
  // while the edition was being taken, and pressing again takes it as it stands.
  const [own] = await useDb()
    .select({ openingSceneId: stories.openingSceneId })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!own) throw notFound(event, 'Story')
  if (!own.openingSceneId) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.openingScene') })
  }

  throw createError({ statusCode: 409, message: saying(event)('refusals.editionMoved') })
})
