import { desc, eq, sql } from 'drizzle-orm'
import { comments, stories } from '../../db/schema'
import { useDb } from '../../db'

/**
 * The Author's own shelf: every Story they wrote, newest first, each with what
 * any shelf presents a Story by — its title, Language, Synopsis and Cover — and
 * with where it stands, which only its Author is told: whether it is published,
 * whether it is Listed, and how many Comments stand under it.
 *
 * One statement, the Cover resolved and the Comments counted inside it, so a
 * shelf of fifty Stories is not fifty-one requests. The count is the Author's
 * and nobody else's: the Catalogue counts nothing an Author can influence, and
 * this is the one endpoint that answers with one.
 */
export default defineEventHandler(async (event) => {
  const author = await requireAuthor(event)

  const rows = await useDb()
    .select({
      id: stories.id,
      title: stories.title,
      language: stories.language,
      synopsis: stories.synopsis,
      publishedAt: stories.publishedAt,
      listed: stories.listed,
      comments: sql<number>`(select count(*)::int from ${comments}
        where ${comments.storyId} = ${stories.id})`,
      coverShotId: coverShotOf,
      cropX: coverShot.cropX,
      cropY: coverShot.cropY,
    })
    .from(stories)
    .leftJoin(coverShot, sql`${coverShot.id} = ${coverShotOf}`)
    .where(eq(stories.authorId, author.id))
    .orderBy(desc(stories.createdAt))

  return rows.map(({ coverShotId, cropX, cropY, ...row }) => ({
    ...row,
    cover: coverFor({ coverShotId, cropX, cropY }),
  }))
})
