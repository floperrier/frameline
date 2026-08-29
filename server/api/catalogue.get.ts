import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { stories } from '../db/schema'
import { useDb } from '../db'

/**
 * The Catalogue: every Listed Story, most recently published first, answered to
 * anyone with or without an account. The one place a Story is found rather than
 * sent — see
 * `docs/adr/0023-being-published-and-being-found-are-two-acts.md`.
 *
 * Being published is asked for beside being Listed, though unpublishing unlists
 * in the same statement and the two cannot drift apart: an entry here leads
 * straight to `/read/<id>`, so a row that got out of step would be an entry
 * pointing at a not-found rather than a row nobody notices.
 *
 * Nothing is counted, rated or ordered by anything an Author can influence. The
 * date a Story was published is the whole of the ranking, and it is the one
 * ranking nobody can play.
 */
export default defineEventHandler(async () => {
  return useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      publishedAt: stories.publishedAt,
    })
    .from(stories)
    .where(and(eq(stories.listed, true), isNotNull(stories.publishedAt)))
    .orderBy(desc(stories.publishedAt))
})
