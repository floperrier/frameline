import { and, eq } from 'drizzle-orm'
import { stories } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')

  // Scoped by Author for the same reason as the rename beside it: a Story this
  // Author does not own matches nothing, and so reads as absent.
  const [story] = await useDb()
    .delete(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
    .returning({ id: stories.id })

  if (!story) throw notFound('Story')
  return story
})
