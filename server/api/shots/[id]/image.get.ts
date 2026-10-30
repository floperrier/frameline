import { eq } from 'drizzle-orm'
import { scenes, shots, stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * One Shot's image. As reachable as the Story it belongs to and no more: its
 * Author always, anyone once the Story is published, nobody otherwise. The whole
 * rule is one condition on the row that was read, so a Preview and a Reading get
 * their images through the same door the Story came through.
 *
 * The bytes are not sent from here: the door sends the browser on to the bucket —
 * see `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md` — so they
 * never cross Neon or a function on their way, and once the Story is taken down
 * nothing signs an address to them again.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Shot')
  const { user: author } = await getUserSession(event)

  const [carried] = await useDb()
    .select({
      digest: shots.imageDigest,
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
  if (!carried?.digest || !(carried.authorId === author?.id || carried.publishedAt)) {
    throw notFound(event, 'Shot')
  }

  return await sendToBucket(event, carried.digest)
})
