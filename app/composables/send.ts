/**
 * ponytail: Nuxt types `$fetch` per route, and matching a URL that is not a
 * literal against a route carrying a path parameter overflows TypeScript
 * (TS2321). Everything addressed by id therefore goes through `$fetch` untyped,
 * with the shapes it answers with named in `shared/utils`. Drop this the day
 * Nitro's route matcher stops recursing.
 */
export const send = $fetch as unknown as
  (url: string, options?: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  }) => Promise<unknown>

/**
 * The two gestures every carrier of a Sound shares, addressed by the URL its
 * own endpoint answers to: a file sent as the whole request body the way an
 * image's is, or a file of the library fetched and replayed through the
 * same PUT — the same validation, the same sniffing, the same cap, and no
 * server path of its own. A Scene and a Shot differ in everything around
 * this (naming, confirmation, a loop), never in the PUT itself, so it is
 * written once here rather than copied per carrier.
 */
export function depositSoundAt(url: string, file: File) {
  return send(url, { method: 'PUT', body: file })
}

export async function takeLibrarySoundAt(url: string, file: string) {
  const blob = await (await fetch(libraryUrl(file))).blob()
  await send(url, { method: 'PUT', body: blob })
}
