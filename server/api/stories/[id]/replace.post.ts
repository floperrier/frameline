import { and, eq } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Replaces a word everywhere a Story says it — issue #447, and
 * `docs/adr/0078-the-storys-words-are-found-where-a-reader-is-given-them.md` for
 * what counts as the Story's words. The places are counted by the same
 * `placesIn` the bench lights them with, taken from the Author's own Story, and
 * a replacement that would take any field past what it may hold writes nothing
 * and names the place. Answers how many places were replaced.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)
  const id = readId(event, 'Story')
  const { find, replace, matchCase } = await readReplacing(event)

  const [held] = await useDb()
    .select({ openingSceneId: stories.openingSceneId, language: stories.language })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))
  if (!held) throw notFound(event, 'Story')

  const story = { ...held, ...await readStoryGraph(id) }
  const places = placesIn(story, find, matchCase)
  const replaced = replacements(story, places, replace)
  const refused = overflowing(event, story, replaced)
  if (refused) throw createError({ statusCode: 400, message: refused })

  if (replaced.length) await writeReplaced(replaced)
  return { replaced: places.length }
})
