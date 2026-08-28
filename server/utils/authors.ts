import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { authors } from '../db/schema'
import { useDb } from '../db'

/**
 * Signs in the Author behind an OAuth identity. Authors are keyed on email, so
 * signing in with GitHub and with Google lands on the same Author — which is
 * only safe for an email the provider vouches for. Google always reports
 * `email_verified`; GitHub reports it for the primary email it hands back, and
 * only ever makes a verified email public, so an absent flag is not a rejection.
 *
 * Two statements rather than the one upsert this used to be, because an account
 * being created is a fact this has to know rather than infer: the insert does
 * nothing where the email is already an Author's, so a row coming back means the
 * account is new and the Sample is planted in it. Nothing else in the product
 * can tell a first sign-in from the hundredth.
 */
export async function signInAuthor(
  event: H3Event,
  provider: string,
  identity: { email?: string | null, name?: string | null, email_verified?: boolean },
) {
  if (!identity.email || identity.email_verified === false) {
    return failSignIn(event, provider, 'no email the provider vouches for')
  }

  const [created] = await useDb()
    .insert(authors)
    .values({ email: identity.email, name: identity.name ?? null })
    .onConflictDoNothing({ target: authors.email })
    .returning()

  const [author] = created
    ? [created]
    : await useDb()
      .update(authors)
      // The name the provider hands back, and the one already held where it
      // hands back none: an Author who signed in with the other provider keeps
      // the name they arrived with.
      .set({ name: sql`coalesce(${identity.name ?? null}::text, ${authors.name})` })
      .where(eq(authors.email, identity.email))
      .returning()

  // A Sample in the Language the Locale of this very request asks for, planted
  // before the session is sealed so the account's first `Stories` page has it.
  // It never refuses: see `plantSample`.
  if (created) {
    await plantSample(created.id, localeOf(
      getRequestHeader(event, 'accept-language'),
      getCookie(event, LOCALE_COOKIE),
    ))
  }

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

/**
 * The Author behind a request, or a refusal they can read. `requireUserSession`
 * refuses with `Unauthorized`, hardcoded English, which nitro passes through in
 * the body and the page shows as it stands — so the one refusal not written here
 * went out in a language nobody chose. It is phrased through `saying` like every
 * other, from the request that carried the write. The status stays `401`, which
 * is what the page reads to offer the door beside the bench. See
 * `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`.
 *
 * Whose Story it is remains the call site's question: every one of them scopes
 * its query by the Author, and that refusal is a `404`.
 */
export async function requireAuthor(event: H3Event) {
  // Refused here rather than by handing `requireUserSession` a message, which
  // would have every authorized request negotiate a language and look up a
  // phrase it is never going to say.
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({ statusCode: 401, message: saying(event)('refusals.signedOut') })
  }

  return user
}
