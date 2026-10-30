import { and, eq, isNotNull } from 'drizzle-orm'
import { editionMedia, stories } from '../../../../db/schema'
import { useDb } from '../../../../db'

/**
 * One Image or Sound an edition plays, by its digest — see
 * `docs/adr/0069-a-published-story-is-read-as-it-was-published.md`. Reachable
 * while the Story is published and only under the Story that holds them: another
 * Story's digest, a malformed one and an unpublished Story are all the Story's
 * not-found, so nothing can be told apart from absent.
 *
 * The bytes are in the bucket, and the door sends the browser on to them as a
 * Shot's and a Scene's own doors do — see
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')
  const digest = getRouterParam(event, 'digest') ?? ''
  if (!/^[0-9a-f]{64}$/.test(digest)) throw notFound(event, 'Story')

  const [held] = await useDb()
    .select({ digest: editionMedia.digest })
    .from(editionMedia)
    .innerJoin(stories, eq(editionMedia.storyId, stories.id))
    .where(and(
      eq(editionMedia.storyId, id),
      eq(editionMedia.digest, digest),
      isNotNull(stories.publishedAt),
    ))

  if (!held) throw notFound(event, 'Story')

  return await sendToBucket(event, held.digest)
})
