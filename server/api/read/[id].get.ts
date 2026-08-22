import { and, eq, isNotNull } from 'drizzle-orm'
import { stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * A published Story as a Reader receives it, with no account and no session.
 * Whether it is published is part of the lookup rather than a check after it, so
 * an unpublished Story cannot be answered by mistake: it gets the same not-found
 * as an id nobody ever wrote.
 *
 * A Reading is not stored anywhere. The Reader is handed the Story and keeps
 * their own Position in it, which is why two Readers of one Story can never
 * share what they have accumulated — there is nothing here to share.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      openingSceneId: stories.openingSceneId,
    })
    .from(stories)
    .where(and(eq(stories.id, id), isNotNull(stories.publishedAt)))

  if (!story) throw notFound(event, 'Story')

  const { scenes, cuts } = await readStoryGraph(id)

  // Where the Author put a Scene's node in the graph is none of a Reading's
  // business, so it does not leave the editor.
  return {
    ...story,
    scenes: scenes.map(({ id, name, sets, shots }) => ({ id, name, sets, shots })),
    cuts,
  }
})
