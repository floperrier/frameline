import { stories } from '../../db/schema'
import { useDb } from '../../db'

export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const title = await readStoryTitle(event)

  const [story] = await useDb()
    .insert(stories)
    .values({ authorId: author.id, title })
    .returning({ id: stories.id, title: stories.title })

  setResponseStatus(event, 201)
  return story
})
