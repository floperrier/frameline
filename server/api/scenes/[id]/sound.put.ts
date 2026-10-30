import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Deposits the Sound a Scene is heard under, replacing whatever it carried. The
 * bytes are held in the bucket under their digest and the Scene names that
 * digest — see `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md` —
 * so one library Sound picked for every Scene is one object. Scoped by the
 * Author's own Stories like every other write, so a Scene of somebody else's
 * Story is not refused so much as absent; bytes held for it are named by
 * nothing, and the daily sweep lets them go.
 *
 * Depositing a Sound lets go of any Scene this one was named after: a Scene carries
 * its own Sound or names one, never both, so there is no state where the two could
 * disagree about what is heard.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const soundDigest = await useMedia().hold(await readSound(event))

  const [scene] = await useDb()
    .update(scenes)
    .set({ soundDigest, soundOfSceneId: null })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id })

  if (!scene) throw notFound(event, 'Scene')

  return { id: scene.id, sound: sceneSoundUrl(scene.id) }
})
