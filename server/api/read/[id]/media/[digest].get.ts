import { and, eq, isNotNull } from 'drizzle-orm'
import { editionMedia, stories } from '../../../../db/schema'
import { useDb } from '../../../../db'

/**
 * The bytes of one Image or Sound an edition plays, by its digest — see
 * `docs/adr/0069-a-published-story-is-read-as-it-was-published.md`. Reachable
 * while the Story is published and only under the Story that holds them: another
 * Story's digest, a malformed one and an unpublished Story are all the Story's
 * not-found, so nothing can be told apart from absent.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')
  const digest = getRouterParam(event, 'digest') ?? ''
  if (!/^[0-9a-f]{64}$/.test(digest)) throw notFound(event, 'Story')

  const [held] = await useDb()
    .select({ bytes: editionMedia.bytes })
    .from(editionMedia)
    .innerJoin(stories, eq(editionMedia.storyId, stories.id))
    .where(and(
      eq(editionMedia.storyId, id),
      eq(editionMedia.digest, digest),
      isNotNull(stories.publishedAt),
    ))

  if (!held) throw notFound(event, 'Story')

  setResponseHeaders(event, {
    // Sniffed from the bytes, as the live doors do: they were sniffed on the way in.
    'content-type':
      imageTypeOf(held.bytes) ?? soundTypeOf(held.bytes) ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    // A public link can be taken away, so nothing it served may outlive the Publish.
    'cache-control': 'no-store',
  })

  return held.bytes
})
