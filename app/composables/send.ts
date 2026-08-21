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
