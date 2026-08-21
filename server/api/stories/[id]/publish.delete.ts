import { and, eq } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Takes a Story back: the public link stops answering at once, and the Story is
 * its Author's alone again. Nothing about the Story itself changes, so what a
 * Reader was halfway through simply has nowhere to go.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .update(stories)
    .set({ publishedAt: null })
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
    .returning({ id: stories.id, publishedAt: stories.publishedAt })

  if (!story) throw notFound('Story')
  return story
})
