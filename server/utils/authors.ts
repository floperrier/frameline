import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { authors } from '../db/schema'
import { useDb } from '../db'

/**
 * Signs in the Author behind an OAuth identity. Authors are keyed on email, so
 * signing in with GitHub and with Google lands on the same Author — which is
 * only safe for an email the provider vouches for. Google always reports
 * `email_verified`; GitHub reports it for the primary email it hands back, and
 * only ever makes a verified email public, so an absent flag is not a rejection.
 */
export async function signInAuthor(
  event: H3Event,
  provider: string,
  identity: { email?: string | null, name?: string | null, email_verified?: boolean },
) {
  if (!identity.email || identity.email_verified === false) {
    return failSignIn(event, provider, 'no email the provider vouches for')
  }

  const [author] = await useDb()
    .insert(authors)
    .values({ email: identity.email, name: identity.name ?? null })
    .onConflictDoUpdate({
      target: authors.email,
      set: { name: sql`coalesce(excluded.name, ${authors.name})` },
    })
    .returning()

  await setUserSession(event, {
    user: { id: author!.id, email: author!.email, name: author!.name },
  })

  return sendRedirect(event, '/stories')
}

/** Sends the Author back to the landing page, leaving the reason in the log. */
export function failSignIn(event: H3Event, provider: string, reason: unknown) {
  console.error(`Signing in with ${provider} failed:`, reason)
  return sendRedirect(event, '/?error=' + provider)
}
