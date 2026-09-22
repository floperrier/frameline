import { and, eq, inArray } from 'drizzle-orm'
import { scenes } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Writes what an Author says about one Scene: its name, the three things said
 * about the Sound it is heard under — what it makes heard, whether it is held
 * in a loop, and the Scene it is taken from — and its Cut. They come through
 * one door because they are one Scene's row, and each lands on its own: a body
 * naming one of them leaves the rest where they were.
 *
 * The bytes are not here. A Sound is a file, and a file is deposited at an
 * address of its own — `server/api/scenes/[id]/sound.put.ts`.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Scene')
  const changes = await readSceneChanges(event, id)

  const [scene] = await useDb()
    .update(scenes)
    .set(changes)
    .where(and(eq(scenes.id, id), inArray(scenes.storyId, storiesOf(author.id))))
    .returning({
      id: scenes.id,
      name: scenes.name,
      transcript: scenes.transcript,
      soundLoops: scenes.soundLoops,
      soundOfSceneId: scenes.soundOfSceneId,
      cutAfter: scenes.cutAfter,
      cutOver: scenes.cutOver,
      cutThrough: scenes.cutThrough,
      exitsAfter: scenes.exitsAfter,
    })

  if (!scene) throw notFound(event, 'Scene')
  return scene
})
