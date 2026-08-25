import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Writes the Flags a Scene sets the moment a Reading enters it. All of them at
 * once, because they are one flat object on the Scene rather than rows: an
 * Author who sends none has taken the last one away.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const sets = await readSceneFlags(event)

  const [scene] = await useDb()
    .update(scenes)
    .set({ sets })
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({ id: scenes.id, sets: scenes.sets })

  if (!scene) throw notFound(event, 'Scene')
  return scene
})
