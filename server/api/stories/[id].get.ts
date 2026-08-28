import { and, eq } from 'drizzle-orm'
import { stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * The whole Story as the Author edits it: its Scenes, each a run of Shots in
 * order and a node of the graph, and the Exits that join them.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      openingSceneId: stories.openingSceneId,
      publishedAt: stories.publishedAt,
    })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!story) throw notFound(event, 'Story')

  return { ...story, ...await readStoryGraph(id) }
})
