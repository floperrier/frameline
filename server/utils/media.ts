import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { AwsClient } from 'aws4fetch'
import type { H3Event } from 'h3'
import { media } from '../db/schema'
import { useDb } from '../db'
import { imageTypeOf } from '../../shared/utils/scenes'
import { soundTypeOf } from '../../shared/utils/sound'

/**
 * How long an address the store signs answers, in seconds: long enough for a
 * Reading to bring a medium in ahead of the beat that needs it, short enough
 * that a Story taken down stops answering within five minutes of it — see
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`.
 */
export const SIGNED_FOR = 300

/**
 * The most the objects of the bucket may weigh together, in bytes: nine
 * gigabytes, a tenth short of the ten R2 keeps free, so storage never leaves its
 * free tier and the bucket never sends a bill — see
 * `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`.
 */
export const MEDIA_CEILING = 9_000_000_000

/**
 * What `hold` throws when new bytes would take the instance past
 * `MEDIA_CEILING`. A door turns it into a refusal in the Author's Locale
 * (`holdUpload`); anywhere else it is a failure like any other.
 */
export class NoRoomForMedia extends Error {
  constructor(digest: string) {
    super(`No room left to hold ${digest}`)
  }
}

/**
 * Where the bucket is and the keys it is written with: R2 in production, the
 * suite's and development's own Versity Gateway everywhere else, named by the
 * runtime configuration in both.
 */
export type MediaSettings = {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

/**
 * The one module that knows the bucket exists. Every door, the Samples' planting
 * and the sweep reach the bytes of a medium through these three operations and
 * through nothing else:
 *
 * - `hold` refuses bytes the instance does not hold yet once they would take
 *   the sum of the `media` sizes past `MEDIA_CEILING`, before anything is
 *   written; bytes whose digest is already held cost nothing and are always
 *   taken. Then it writes the bytes as the object their SHA-256 names, with the
 *   type their own first bytes say, records it in `media` and answers the digest
 *   the row names it by. The object is written every time, even under a digest
 *   already held, and the row's `used_at` refreshed after it, so bytes held
 *   again are never left with a row and no object.
 * - `sign` answers an address the bucket serves that object at for
 *   `SIGNED_FOR` seconds, and to nobody once they are past.
 * - `erase` takes the object away, once nothing names its row any more.
 *
 * Written with `aws4fetch`, which signs S3 requests in a few kilobytes, in the
 * region `auto`, which is R2's and the one the local gateway is started under.
 */
export function mediaStore(settings: MediaSettings, db: Pick<ReturnType<typeof useDb>, 'insert' | 'select'>) {
  const client = new AwsClient({
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  const objectAt = (digest: string) => `${settings.endpoint.replace(/\/$/, '')}/${settings.bucket}/${digest}`

  return {
    async hold(bytes: Uint8Array) {
      const digest = createHash('sha256').update(bytes).digest('hex')

      // Read in one statement, so the digest and the total are one moment's.
      // Two uploads at once may both fit and together pass the ceiling by a few
      // megabytes, which the tenth of R2's free tier left above it absorbs.
      const [counted] = await db
        .select({
          held: sql<boolean | null>`bool_or(${media.digest} = ${digest})`,
          total: sql<string>`coalesce(sum(${media.size}), 0)::text`,
        })
        .from(media)
      if (!counted?.held && Number(counted?.total ?? 0) + bytes.length > MEDIA_CEILING) {
        throw new NoRoomForMedia(digest)
      }

      const written = await client.fetch(objectAt(digest), {
        method: 'PUT',
        // A Buffer is a view on an ArrayBuffer here, never a shared one.
        body: bytes as Uint8Array<ArrayBuffer>,
        // Read out of the bytes for the reason the doors refused anything else:
        // whatever serves the object later serves it under this type. The doors
        // let nothing else in, so the fallback is never written.
        headers: { 'content-type': imageTypeOf(bytes) ?? soundTypeOf(bytes) ?? 'application/octet-stream' },
      })
      if (!written.ok) {
        throw new Error(`Holding ${digest} answered ${written.status}: ${await written.text()}`)
      }

      await db.insert(media)
        .values({ digest, size: bytes.length })
        .onConflictDoUpdate({ target: media.digest, set: { usedAt: sql`now()` } })

      return digest
    },

    async sign(digest: string) {
      const address = new URL(objectAt(digest))
      address.searchParams.set('X-Amz-Expires', String(SIGNED_FOR))
      const signed = await client.sign(address.href, { method: 'GET', aws: { signQuery: true } })

      return signed.url
    },

    async erase(digest: string) {
      const erased = await client.fetch(objectAt(digest), { method: 'DELETE' })
      if (!erased.ok && erased.status !== 404) {
        throw new Error(`Erasing ${digest} answered ${erased.status}: ${await erased.text()}`)
      }
    },
  }
}

export type MediaStore = ReturnType<typeof mediaStore>

/**
 * The answer every reading door gives once its own access rule has held: a 302
 * to an address the store signs for the object, sent `no-store`, since the
 * address stops answering and a redirect kept by a cache would send the browser
 * to it after it had.
 */
export async function sendToBucket(event: H3Event, digest: string) {
  setResponseHeader(event, 'cache-control', 'no-store')
  return sendRedirect(event, await useMedia().sign(digest), 302)
}

/**
 * Holds the bytes an upload door has read, through the one store every door
 * goes through, and answers their digest. Past the ceiling it refuses with a
 * phrase in the Author's Locale, carried in the body as every refusal is — see
 * `docs/adr/0009-a-refusal-travels-in-the-body.md` — under 507, the status that
 * says the server has no room to store what it was sent. Nothing is written
 * then, and nothing named: the Author's words are untouched by it.
 */
export async function holdUpload(event: H3Event, bytes: Uint8Array) {
  try {
    return await useMedia().hold(bytes)
  }
  catch (failure) {
    if (!(failure instanceof NoRoomForMedia)) throw failure
    throw createError({ statusCode: 507, message: saying(event)('refusals.noRoom') })
  }
}

let store: MediaStore | undefined

/** The media store of this instance, over the bucket its runtime configuration names. */
export function useMedia() {
  if (!store) {
    const settings = useRuntimeConfig().media as MediaSettings
    if (!settings.endpoint) throw new Error('NUXT_MEDIA_ENDPOINT is not set — copy .env.example to .env')
    store = mediaStore(settings, useDb())
  }
  return store
}
