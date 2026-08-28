import { and, eq } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Takes a Story back: the public link stops answering at once, and the Story is
 * its Author's alone again. Nothing about the Story itself changes, so what a
 * Reader was halfway through simply has nowhere to go.
 *
 * It leaves the Catalogue in the same act, because a Listed Story that is not
 * published would be an entry leading to a link that answers with a not-found.
 * Publishing again does not put it back: listing is the Author's to say, and
 * saying it once is not saying it for ever.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')

  const [story] = await useDb()
    .update(stories)
    .set({ publishedAt: null, listed: false })
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
    .returning({ id: stories.id, publishedAt: stories.publishedAt, listed: stories.listed })

  if (!story) throw notFound(event, 'Story')
  return story
})
