import { and, eq, inArray } from 'drizzle-orm'
import { exits } from '../../db/schema'
import { useDb } from '../../db'

/** Writes what the Reader will be offered at the end of the Scene the Exit leaves. */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Exit')
  const text = await readExitText(event)

  const [exit] = await useDb()
    .update(exits)
    .set({ text })
    .where(and(eq(exits.id, id), inArray(exits.id, exitsOf(author.id))))
    .returning({
      id: exits.id,
      fromSceneId: exits.fromSceneId,
      toSceneId: exits.toSceneId,
      text: exits.text,
    })

  if (!exit) throw notFound(event, 'Exit')
  return exit
})
