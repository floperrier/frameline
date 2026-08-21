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
