import { and, eq } from 'drizzle-orm'
import { stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * The whole Story as the Author edits it: its Scenes, each a run of Shots in
 * order and a node of the graph, the Exits that join them, and what differs from
 * Readers' Edition — null where there is none, on a Story never published or on
 * one published before Editions and not read since.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')

  const [row] = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      synopsis: stories.synopsis,
      openingSceneId: stories.openingSceneId,
      coverShotId: stories.coverShotId,
      publishedAt: stories.publishedAt,
      editionAt: stories.editionAt,
      edition: stories.edition,
      listed: stories.listed,
      stepsBack: stories.stepsBack,
      textFace: stories.textFace,
      textAlign: stories.textAlign,
    })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!row) throw notFound(event, 'Story')

  // Readers' Edition is compared here and goes no further: the bench is told
  // what differs from it, and never handed what Readers read.
  const { edition, ...story } = row
  const graph = await readStoryGraph(id)

  return { ...story, ...graph, changes: edition && await changesOf(id, story, graph, edition) }
})
