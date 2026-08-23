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
 *
 * Saying nothing at all, though, leaves an Author who typed a Shot and walked
 * away with no way to know the Story holds it, so a write that landed leaves two
 * quiet marks instead: `keptAt`, the time the page puts on its bench, and a flash
 * in the field the writing came from. Both are marks rather than messages —
 * nothing is announced, because a live region firing every time a field is left
 * would interrupt the next thing typed.
 */
export function useEditing(reload: () => Promise<unknown>) {
  const { t } = useI18n()
  const problem = ref('')
  /**
   * When a typed change last reached the Story, and nothing until one has: a time
   * on the bench before the first write would be a claim about a page that has
   * only been read, and it would have to be rendered on the server to be there.
   */
  const keptAt = ref<Date>()

  /**
   * The field a typed change is coming from, caught on the way down to it. Every
   * `write` below is called from a `change` handler, so the event that started it
   * is still being dispatched when the request goes out and the element under it
   * is the one to flash — which beats handing the same element to each of the
   * eleven handlers by hand, and reaches the fields inside a component that only
   * emits.
   */
  let typedIn: HTMLElement | undefined

  function typing(event: Event) {
    typedIn = event.target instanceof HTMLElement ? event.target : undefined
  }

  /**
   * Lights the field for a moment. The class is taken off again when the
   * animation ends, so the next write in the same field flashes it a second time;
   * under a reduced-motion preference the stylesheet collapses that animation to
   * nothing, which ends it at once and leaves the class inert.
   */
  function flash(field: HTMLElement | undefined) {
    if (!field) return
    field.classList.add('kept')
    field.addEventListener('animationend', () => field.classList.remove('kept'), { once: true })
  }

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
    if (!await attempt(act)) return reload()
    keptAt.value = new Date()
    flash(typedIn)
  }

  return { problem, keptAt, typing, change, write }
}
