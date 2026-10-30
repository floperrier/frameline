// Makes the bucket the bytes of every Image and every Sound live in, and sets
// the CORS rule a Reading needs to bring them in — see
// `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. Run once the
// migrations are applied, by `pnpm test:db` and `pnpm db:dev` against their own
// Versity Gateway, and by hand against R2 once, which takes the same call:
//
//   node scripts/bucket.ts http://localhost:4447
//
// The endpoint is the one argument. The bucket's name and the keys come from
// `NUXT_MEDIA_BUCKET`, `NUXT_MEDIA_ACCESS_KEY_ID` and
// `NUXT_MEDIA_SECRET_ACCESS_KEY`, the names the app reads them under, and stand
// for the local gateway's own where they are not set. Run twice, it changes
// nothing: a bucket already there is kept, with its objects, and the rule is
// written over with itself.
import { createHash } from 'node:crypto'
import { AwsClient } from 'aws4fetch'

const endpoint = process.argv[2]
if (!endpoint) {
  console.error('usage: node scripts/bucket.ts <endpoint>')
  process.exit(2)
}

const bucket = process.env.NUXT_MEDIA_BUCKET || 'media'
const client = new AwsClient({
  accessKeyId: process.env.NUXT_MEDIA_ACCESS_KEY_ID || 'frameline',
  secretAccessKey: process.env.NUXT_MEDIA_SECRET_ACCESS_KEY || 'frameline-secret',
  service: 's3',
  region: 'auto',
})
const at = `${endpoint.replace(/\/$/, '')}/${bucket}`

// A bucket already made answers this with a conflict, which is the state asked for.
const made = await client.fetch(at, { method: 'PUT' })
if (!made.ok && made.status !== 409) {
  throw new Error(`Making the bucket ${bucket} answered ${made.status}: ${await made.text()}`)
}

// `GET` and `HEAD` from any origin: the signed address is the permission, so
// naming origins would restrict nothing, and one rule serves production, the
// suite and development whatever origin each runs on. A Sound is brought in by
// `fetch`, which needs it; an Image is brought in by `new Image()`, which does not.
const rule = '<CORSConfiguration><CORSRule>'
  + '<AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>'
  + '<MaxAgeSeconds>3600</MaxAgeSeconds>'
  + '</CORSRule></CORSConfiguration>'
const ruled = await client.fetch(`${at}?cors`, {
  method: 'PUT',
  body: rule,
  // S3 refuses a `PutBucketCors` that does not say what its body hashes to.
  headers: { 'content-md5': createHash('md5').update(rule).digest('base64') },
})
if (!ruled.ok) {
  throw new Error(`Setting the CORS rule of ${bucket} answered ${ruled.status}: ${await ruled.text()}`)
}

console.log(`The bucket ${bucket} at ${endpoint} is ready.`)
