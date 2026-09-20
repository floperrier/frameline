import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Deposits the Sound a Scene is heard under, replacing whatever it carried.
 * Scoped by the Author's own Stories like every other write, so a Scene of
 * somebody else's Story is not refused so much as absent.
 *
 * Depositing bytes lets go of any Scene this one was named after: a Scene carries
 * its own Sound or names one, never both, so there is no state where the two could
 * disagree about what is heard.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const sound = await readSound(event)

  const [scene] = await useDb()
    .update(scenes)
    .set({ sound, soundOfSceneId: null })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id })

  if (!scene) throw notFound(event, 'Scene')

  return { id: scene.id, sound: sceneSoundUrl(scene.id) }
})
