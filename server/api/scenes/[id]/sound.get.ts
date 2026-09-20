import { eq } from 'drizzle-orm'
import { scenes, stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * The bytes of the Sound one Scene is heard under. As reachable as the Story it
 * belongs to and no more: its Author always, anyone once the Story is published,
 * nobody otherwise — the same one condition on the row that was read as a Shot's
 * image, so a Preview and a Reading are heard through the door the Story came
 * through.
 *
 * It answers for the bytes this Scene carries and never for the Scene it names:
 * a Scene heard under another asks that Scene's own address, which is what the
 * Story handed over.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Scene')

  const [carried] = await useDb()
    .select({
      sound: scenes.sound,
      authorId: stories.authorId,
      publishedAt: stories.publishedAt,
    })
    .from(scenes)
    .innerJoin(stories, eq(scenes.storyId, stories.id))
    .where(eq(scenes.id, id))

  return serveSound(event, carried, 'Scene')
})
