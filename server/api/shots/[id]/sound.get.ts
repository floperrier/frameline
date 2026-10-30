import { eq } from 'drizzle-orm'
import { scenes, shots, stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * The Sound one Shot strikes with, under the access rule of the
 * Story it belongs to — the Shot's image's own rule, read for the other matter a
 * beat carries.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Shot')

  const [carried] = await useDb()
    .select({
      digest: shots.soundDigest,
      authorId: stories.authorId,
      publishedAt: stories.publishedAt,
    })
    .from(shots)
    .innerJoin(scenes, eq(shots.sceneId, scenes.id))
    .innerJoin(stories, eq(scenes.storyId, stories.id))
    .where(eq(shots.id, id))

  return serveSound(event, carried, 'Shot')
})
