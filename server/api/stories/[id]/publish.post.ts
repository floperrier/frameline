import { and, eq, isNotNull } from 'drizzle-orm'
import { stories } from '../../../db/schema'
import { useDb } from '../../../db'

/**
 * Publishes a Story: from here on anyone can read it at `/read/<id>`, with no
 * account. The link is the Story's own id, so publishing again after an
 * unpublish hands back the same link rather than a new one.
 *
 * A Story with no opening Scene has nothing for a Reading to start on, so
 * publishing it would hand out a link that answers with an ending. The opening
 * Scene is part of the statement that publishes, scoped by Author beside it, so
 * neither someone else's Story nor an unreadable one can be published by
 * checking first and writing after.
 */
export default defineEventHandler(async (event) => {
  const id = readId(event, 'Story')
  const { user: author } = await requireUserSession(event)

  const [published] = await useDb()
    .update(stories)
    .set({ publishedAt: new Date() })
    .where(and(
      eq(stories.id, id),
      eq(stories.authorId, author.id),
      isNotNull(stories.openingSceneId),
    ))
    .returning({ id: stories.id, publishedAt: stories.publishedAt })

  if (published) return published

  // Nothing was published, so the Story is either not this Author's — absent,
  // like everywhere else — or it is theirs and has no opening Scene, which is a
  // refusal they can act on and so is worth saying out loud.
  const [own] = await useDb()
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.authorId, author.id)))

  if (!own) throw notFound(event, 'Story')

  throw createError({ statusCode: 400, message: saying(event)('refusals.openingScene') })
})
