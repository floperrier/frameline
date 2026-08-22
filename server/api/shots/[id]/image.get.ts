import { eq } from 'drizzle-orm'
import { scenes, shots, stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * The bytes of one Shot's still. As reachable as the Story it belongs to and no
 * more: its Author always, anyone once the Story is published, nobody otherwise.
 * The whole rule is one condition on the row that was read, so a Preview and a
 * Reading get their images through the same door the Story came through.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Shot')
  const { user: author } = await getUserSession(event)

  const [carried] = await useDb()
    .select({
      image: shots.image,
      authorId: stories.authorId,
      publishedAt: stories.publishedAt,
    })
    .from(shots)
    .innerJoin(scenes, eq(shots.sceneId, scenes.id))
    .innerJoin(stories, eq(scenes.storyId, stories.id))
    .where(eq(shots.id, id))

  // A Shot with no image, one of an unpublished Story and one nobody ever wrote
  // all answer the same way: whatever this request cannot reach, it cannot tell
  // apart from absent.
  if (!carried?.image || !(carried.authorId === author?.id || carried.publishedAt)) {
    throw notFound(event, 'Shot')
  }

  setResponseHeaders(event, {
    // Sniffed from the bytes for the same reason they were sniffed on the way in:
    // the stored type is the one the bytes themselves say. Anything the three
    // formats do not own was never stored, so the fallback is unreachable — and
    // it downloads rather than renders if it ever is.
    'content-type': imageTypeOf(carried.image) ?? 'application/octet-stream',
    // Never sniffed by the browser into something it could run.
    'x-content-type-options': 'nosniff',
    // A public link can be taken away, so the still may not sit in a cache that
    // outlives the Publish — the same reason `/read/**` is `no-store`.
    'cache-control': 'no-store',
  })

  return carried.image
})
