import { eq } from 'drizzle-orm'
import { schema, useDb } from '../db'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  return useDb()
    .select({ id: schema.stories.id, title: schema.stories.title })
    .from(schema.stories)
    .where(eq(schema.stories.authorId, user.id))
    .orderBy(schema.stories.createdAt)
})
