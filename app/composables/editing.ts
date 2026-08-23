/**
 * Runs a change against the server, surfacing why it was refused.
 *
 * Two ways in, because the page has two kinds of write and they want opposite
 * things from a refetch. A click that alters the shape of the Story — a Shot
 * added, a Scene's Shots renumbered, a Cut drawn — learns its result from the
 * server and nowhere else, so it reads the Story back afterwards. What the
 * Author typed is already on screen in the field they typed it into, and reading
 * the Story back would replace that field along with everything else: the next
 * thing they type lands in a form the refetch has just emptied under their
 * hands. So a typed
 * write reads back only when it was refused, which is the one moment where what
 * persisted beats what was typed. See
 * `docs/adr/0008-refetch-is-for-a-refusal.md`.
 */
export function useEditing(reload: () => Promise<unknown>) {
  const { t } = useI18n()
  const problem = ref('')

  async function attempt(act: () => Promise<unknown>) {
    problem.value = ''
    try {
      await act()
      return true
    }
    catch (error) {
      // The refusal travels in the body rather than on the status line, where
      // `error.statusMessage` reads it as a reason phrase and h3 sanitizes it
      // down to ASCII. See `docs/adr/0009-a-refusal-travels-in-the-body.md`.
      // The refusal itself arrives already in the Author's language, negotiated
      // by the server from the same request that carried the change.
      problem.value = (error as { data?: { message?: string } }).data?.message
        ?? t('error.refused')
      return false
    }
  }

  /**
   * A click that alters the shape of the Story. The Story is read back either
   * way: the click's own result is in it, and a refused one would otherwise sit
   * on screen as though it had persisted.
   */
  async function change(act: () => Promise<unknown>) {
    const succeeded = await attempt(act)
    await reload()
    return succeeded
  }

  /**
   * What the Author typed, which the form has already written into the fetched
   * Story in place. Read back only on a refusal, so nothing the Author is still
   * typing is taken off the screen by a change that worked.
   */
  async function write(act: () => Promise<unknown>) {
    if (!await attempt(act)) await reload()
  }

  return { problem, change, write }
}
