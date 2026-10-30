import { sql } from 'drizzle-orm'
import { useDb } from '../db'

/**
 * The daily sweep, which Vercel's cron calls once a day — declared in
 * `nuxt.config.ts` — and nobody else may: it erases from the bucket the Images
 * and Sounds nothing names any more, those of deleted Stories, replaced Images,
 * removed Sounds and Shots deleted over a day ago. See
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`.
 *
 * In this order, each step safe to run again, since Hobby runs a cron within
 * the hour, with no retry, and does not promise to run it once:
 *
 * 1. The Shots held for more than a day are let go of, which no put-back can
 *    reach any more (`docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`). A
 *    statement of its own, before the next, so that what only they named is
 *    swept today rather than tomorrow.
 * 2. In one statement, every `media` row that no Shot, Scene, Edition or held
 *    Shot names, and that nothing has used for a day, is deleted. A held Shot
 *    names its digests in the row it keeps as jsonb, which no foreign key
 *    reaches, so it is read here; the others are held by their foreign keys,
 *    which refuse to let a row still named go.
 * 3. Only then is each deleted row's object erased, so no row is ever left
 *    naming an object the bucket no longer holds.
 *
 * One window is accepted. An upload writes its object and only then refreshes
 * the row's `used_at` (`hold` in `server/utils/media.ts`). The same bytes
 * uploaded between a row's deletion in step 2 and its object's erasure in step 3
 * write a new row, and step 3 then erases the object under it: that Shot or
 * Scene names bytes that are gone until they are uploaded again. It takes bytes
 * nothing had named for a day coming back in the second the sweep runs.
 *
 * A second run finds nothing past the first: the rows are gone, and an object
 * already erased is not erased again. The other side of that: an erasure the
 * bucket refuses leaves its object with no row to find it by, which costs room
 * in the bucket and never a medium anybody reads.
 */
export default defineEventHandler(async (event) => {
  if (!fromTheCron(getRequestHeader(event, 'authorization'), process.env.CRON_SECRET)) {
    throw createError({ statusCode: 401, message: saying(event)('refusals.notTheCron') })
  }

  const db = useDb()
  const pruned = await db.execute(sql`
    delete from deleted_shots where taken_at < now() - interval '1 day'`)

  const { rows } = await db.execute<{ digest: string }>(sql`
    delete from media
    where used_at < now() - interval '1 day'
      and not exists (select 1 from shots
        where shots.image_digest = media.digest or shots.sound_digest = media.digest)
      and not exists (select 1 from scenes where scenes.sound_digest = media.digest)
      and not exists (select 1 from edition_media where edition_media.digest = media.digest)
      and not exists (select 1 from deleted_shots
        where deleted_shots."row"->>'image_digest' = media.digest
          or deleted_shots."row"->>'sound_digest' = media.digest)
    returning digest`)

  const erased = rows.map(({ digest }) => digest)
  for (const digest of erased) await useMedia().erase(digest)

  setResponseHeader(event, 'cache-control', 'no-store')
  return { pruned: pruned.rowCount ?? 0, erased }
})
