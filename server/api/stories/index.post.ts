import { stories } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const title = await readStoryTitle(event)
  // A Story says what it is written in as it is named, because nothing
  // translates a Story and there is no later moment at which the answer changes.
  const language = await readStoryLanguage(event)

  const [story] = await useDb()
    .insert(stories)
    .values({ authorId: author.id, title, language })
    .returning({ id: stories.id, title: stories.title, language: stories.language })

  setResponseStatus(event, 201)
  return story
})
