/**
 * Runs a change against the server, surfacing why it was refused. What the page
 * shows is refetched either way: a form edits the fetched Story in place, so a
 * refused change would otherwise sit on screen as though it had persisted.
 */
export function useEditing(reload: () => Promise<unknown>) {
  const problem = ref('')

  async function change(act: () => Promise<unknown>) {
    problem.value = ''
    try {
      await act()
    }
    catch (error) {
      problem.value = (error as { statusMessage?: string }).statusMessage
        ?? 'That did not work. Please try again.'
    }
    finally {
      await reload()
    }
  }

  return { problem, change }
}

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
