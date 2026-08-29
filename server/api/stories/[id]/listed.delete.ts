import { and, eq } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Takes a Story out of the Catalogue. It stays published, so every link already
 * sent goes on working — unlisting is not unpublishing, which is the only
 * behaviour consistent with the link being the Story's own id. An Author who
 * wants it dark unpublishes.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .update(stories)
    .set({ listed: false })
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
    .returning({ id: stories.id, listed: stories.listed })

  if (!story) throw notFound(event, 'Story')
  return story
})
