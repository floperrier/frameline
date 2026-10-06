import { and, eq } from 'drizzle-orm'
import { stories } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')
  const changes = await readStoryChanges(event, id)

  // Scoping by Author is what makes another Author's Story unreachable, here and
  // in the delete beside it — there is no separate ownership check to forget.
  const [story] = await useDb()
    .update(stories)
    .set(changes)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
    .returning({ id: stories.id, title: stories.title })

  if (!story) throw notFound(event, 'Story')
  return story
})
