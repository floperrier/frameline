import { eq } from 'drizzle-orm'
import { stories } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)

  return useDb()
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(eq(stories.authorId, author.id))
    .orderBy(stories.createdAt)
})
