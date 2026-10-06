import { and, eq, inArray } from 'drizzle-orm'
import { exits } from '../../db/schema'
import { useDb } from '../../db'

/**
 * Writes what the Reader will be offered at the end of the Scene the Exit leaves,
 * whether a Reading crosses this Exit backwards, and how it cuts the passage it
 * makes.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Exit')
  const changes = await readExitChanges(event)

  const [exit] = await useDb()
    .update(exits)
    .set(changes)
    .where(and(eq(exits.id, id), inArray(exits.id, exitsOf(author.id))))
    .returning({
      id: exits.id,
      fromSceneId: exits.fromSceneId,
      toSceneId: exits.toSceneId,
      text: exits.text,
      stepsBack: exits.stepsBack,
      cutOver: exits.cutOver,
      cutThrough: exits.cutThrough,
    })

  if (!exit) throw notFound(event, 'Exit')
  return exit
})
