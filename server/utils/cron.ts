import { timingSafeEqual } from 'node:crypto'

/**
 * Whether a request is the cron's own: Vercel calls a cron's path with
 * `Authorization: Bearer` and the value of `CRON_SECRET`, which the runtime
 * configuration reads as `cronSecret`, and nothing else knows that value. While no secret is set every call is refused, so an instance left
 * without one never takes an empty header for it. Compared in constant time,
 * since the header is the whole of the permission.
 */
export function fromTheCron(authorization: string | undefined, secret: string | undefined) {
  if (!secret || !authorization) return false

  const sent = Buffer.from(authorization)
  const expected = Buffer.from(`Bearer ${secret}`)
  return sent.length === expected.length && timingSafeEqual(sent, expected)
}
