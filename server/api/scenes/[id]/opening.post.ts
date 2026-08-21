import { sql } from 'drizzle-orm'
import { useDb } from '../../../db'

/**
 * Marks a Scene as the one its Story opens on. The Story names its opening
 * Scene in a single column, so marking one unmarks whichever was marked before
 * without anything having to say so.
 */
export default defineEventHandler(async (event) => {
  const { user: author } = await requireUserSession(event)
  const id = readId(event, 'Scene')

  const { rows } = await useDb().execute<{ id: string, openingSceneId: string }>(sql`
    update stories set opening_scene_id = scenes.id
    from scenes
    where scenes.id = ${id}::uuid
      and scenes.story_id = stories.id
      and stories.author_id = ${author.id}::uuid
    returning stories.id, stories.opening_scene_id as "openingSceneId"`)

  if (!rows[0]) throw notFound('Scene')
  return rows[0]
})
