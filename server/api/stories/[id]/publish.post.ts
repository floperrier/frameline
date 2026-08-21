import { and, eq } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Publishes a Story: from here on anyone can read it at `/read/<id>`, with no
 * account. The link is the Story's own id, so publishing again after an
 * unpublish hands back the same link rather than a new one.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Story')

  // Scoped by Author like every other write here, so another Author's Story is
  // absent rather than forbidden — and cannot be published by anyone but its own.
  const [story] = await useDb()
    .update(stories)
    .set({ publishedAt: new Date() })
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
    .returning({ id: stories.id, publishedAt: stories.publishedAt })

  if (!story) throw notFound('Story')
  return story
})
