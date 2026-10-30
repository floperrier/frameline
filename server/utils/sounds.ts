import type { H3Event } from 'h3'

/**
 * Reads the Sound being deposited on a Scene or on a Shot: the whole request
 * body is the file, because one file is the whole of the request and a multipart
 * form would only wrap it in a boundary for us to unwrap.
 *
 * A trust boundary, and the only one these bytes cross: what gets past here is
 * held in the bucket and later served back under the type its own first bytes
 * claim, so all three refusals name their reason rather than leaving the Author
 * with a Scene that plays nothing.
 *
 * ponytail: the body is buffered to be weighed, the way a Shot's image is. At two
 * megabytes that costs nothing; stream it the day a Scene may carry a reel.
 */
export async function readSound(event: H3Event) {
  const bytes = await readRawBody(event, false)

  if (!bytes?.length) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.soundMissing') })
  }
  if (bytes.length > SOUND_MAX_BYTES) {
    throw createError({
      statusCode: 400,
      message: saying(event)('refusals.soundHeavy', { mb: SOUND_MAX_BYTES / 1024 / 1024 }),
    })
  }
  if (!soundTypeOf(bytes)) {
    throw createError({ statusCode: 400, message: saying(event)('refusals.soundType') })
  }

  return bytes
}

/**
 * Answers for a Sound already read off a Scene's or a Shot's row: the tail both
 * `GET`s share once their own query is done, since a Scene's row and a Shot's —
 * joined one table further — hand it the same three fields.
 *
 * As reachable as the Story the row belongs to and no more: the Author always,
 * anyone once the Story is published, nobody otherwise. The bytes are not sent
 * from here: the door sends the browser on to the bucket, as an Image's does —
 * see `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md` — and once
 * the Story is taken down nothing signs an address to them again. The object
 * was written under the type its own first bytes say, which is what the bucket
 * serves it as.
 */
export async function serveSound(
  event: H3Event,
  carried: { digest: string | null, authorId: string, publishedAt: Date | null } | undefined,
  kind: 'Scene' | 'Shot',
) {
  const { user: author } = await getUserSession(event)

  if (!carried?.digest || !(carried.authorId === author?.id || carried.publishedAt)) {
    throw notFound(event, kind)
  }

  return await sendToBucket(event, carried.digest)
}
