import type { H3Event } from 'h3'
import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'

/**
 * The words the server says, in the language the person it is refusing reads.
 *
 * A refusal travels as a phrase and not as a key — see
 * `docs/adr/0009-a-refusal-travels-in-the-body.md` — so the language has to be
 * settled here, before the response is written. It is settled from the request
 * alone: the cookie the interface writes when a Locale is chosen, and failing
 * that whatever the browser announces it accepts.
 *
 * The messages are the very files the interface reads, so there is one place to
 * add a language and one place a translation can be wrong.
 */
const MESSAGES = { en, fr }

export type Locale = keyof typeof MESSAGES

export const DEFAULT_LOCALE: Locale = 'en'

/** The cookie `@nuxtjs/i18n` writes the chosen Locale into. */
export const LOCALE_COOKIE = 'i18n_redirected'

function isLocale(code: string | undefined): code is Locale {
  return code !== undefined && code in MESSAGES
}

/**
 * Which Locale one request is answered in. An explicit choice beats the browser,
 * because a person who has said what they read has said it — and a header that
 * makes no sense is a header that says nothing rather than one that fails: a
 * malformed `Accept-Language` must not turn a refusal into a fault.
 *
 * Only the primary subtag is read, so `fr-CA` is French. `q=0` is what a browser
 * writes to say it will *not* take a language, so it is dropped rather than
 * ranked last.
 */
export function localeOf(accepted: string | undefined, chosen: string | undefined): Locale {
  if (isLocale(chosen)) return chosen

  const ranked = (accepted ?? '')
    .split(',')
    .map((range) => {
      const [tag, ...parameters] = range.trim().toLowerCase().split(';')
      // `q=0` is a browser saying it will not take a language, and is dropped
      // below. A `q` that parses to nothing is not that: it is a header saying
      // nothing about weight, so the language keeps the default weight of one
      // rather than being read as refused.
      const quality = parameters.map(part => part.trim()).find(part => part.startsWith('q='))
      const written = quality ? Number.parseFloat(quality.slice(2)) : 1

      return { tag: tag?.split('-')[0], quality: Number.isFinite(written) ? written : 1 }
    })
    .filter(({ tag, quality }) => quality > 0 && isLocale(tag))
    .sort((first, second) => second.quality - first.quality)

  const preferred = ranked[0]?.tag

  return isLocale(preferred) ? preferred : DEFAULT_LOCALE
}

/**
 * One message, with the values it names written into it. A key the chosen Locale
 * has no message for falls back to English rather than throwing: a missing
 * translation is a defect the parity test catches, and it must not be the reason
 * a request that was merely bad comes back as a server fault.
 */
export function phrase(
  locale: Locale,
  key: string,
  values: Record<string, string | number> = {},
): string {
  const found = messageAt(MESSAGES[locale], key) ?? messageAt(MESSAGES[DEFAULT_LOCALE], key) ?? key

  return found.replace(/{(\w+)}/g, (whole, named: string) => String(values[named] ?? whole))
}

function messageAt(messages: object, key: string) {
  const found = key.split('.').reduce<unknown>(
    (held, step) => (held as Record<string, unknown> | undefined)?.[step], messages)

  return typeof found === 'string' ? found : undefined
}

/**
 * The phrasing bound to one request, which is what every refusal in `server/`
 * reaches for. Settled from the request and from nothing else, so a handler that
 * says two things says both of them in one language however many times it asks.
 */
export function saying(event: H3Event): Phrase {
  const locale = localeOf(
    getRequestHeader(event, 'accept-language'),
    getCookie(event, LOCALE_COOKIE),
  )

  return (key, values) => phrase(locale, key, values)
}
