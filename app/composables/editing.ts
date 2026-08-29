/**
 * Runs a change against the server, surfacing why it was refused.
 *
 * Two ways in, because the page has two kinds of write and they want opposite
 * things from a refetch. A click that alters the shape of the Story — a Shot
 * added, a Scene's Shots renumbered, an Exit drawn — learns its result from the
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
/**
 * Why the last change was refused, and — at most — the one gesture that refusal
 * offers. A door beside a refusal is not a kind of refusal, so this is one
 * optional flag rather than a taxonomy: the words come from the server and
 * whether a door belongs beside them is read off the status. The surface is
 * `Refusal.vue`, the way `useConfirming`'s is `Confirmation.vue`. See
 * `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`.
 */
export type Problem = { said: string, door?: boolean }

/**
 * The two ways a change is sent, named so that the pieces of the bench can be
 * handed the very ones the page holds. There is one `useEditing` on the page and
 * the graph, the panel and the header all write through it: a piece that made
 * its own would be a second refusal on the same screen.
 */
export type Change = (act: () => Promise<unknown>) => Promise<boolean>
export type Write = (act: () => Promise<unknown>) => Promise<void>

export function useEditing(reload: () => Promise<unknown>) {
  const { t } = useI18n()
  const problem = ref<Problem>()
  /**
   * When a typed change last reached the Story, and nothing until one has: a time
   * on the bench before the first write would be a claim about a page that has
   * only been read, and it would have to be rendered on the server to be there.
   */
  const keptAt = ref<Date>()

  /**
   * The field a typed change is coming from, caught on the way down to it. A
   * typed write starts in a `change` handler, so the event that started it is
   * still being dispatched when the request goes out and the element under it is
   * the one to flash — which beats handing the same element to each of the eleven
   * handlers by hand, and reaches the fields inside a component that only emits.
   *
   * Listened for on the document rather than asked of each page, so that a page
   * using `write` cannot half-wire the mark: what flashes is decided here, and a
   * page that writes nothing never sees the listener fire. The server has no
   * document and nothing to flash on it.
   */
  let writtenIn: HTMLElement | undefined

  function writingFrom(event: Event) {
    writtenIn = event.target instanceof HTMLElement ? event.target : undefined
  }

  if (import.meta.client) {
    document.addEventListener('change', writingFrom, { capture: true })
    onScopeDispose(
      () => document.removeEventListener('change', writingFrom, { capture: true }))
  }

  /**
   * Lights the field for a moment. The class is taken off again when the
   * animation ends, so a field written in twice is lit twice — a second write
   * landing while the first is still lit adds nothing, but the field is already
   * saying what that write would have said. Under a reduced-motion preference the
   * stylesheet cuts the animation to a single tick, which ends it at once and
   * leaves the class inert.
   */
  function flash(field: HTMLElement | undefined) {
    if (!field) return
    field.classList.add('kept')
    field.addEventListener('animationend', () => field.classList.remove('kept'), { once: true })
  }

  async function attempt(act: () => Promise<unknown>) {
    problem.value = undefined
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
      const refused = error as { statusCode?: number, data?: { message?: string } }

      problem.value = {
        said: refused.data?.message ?? t('error.refused'),
        // A shut door is recognised by the status and never by the phrase: the
        // words are the server's, and a sentence cannot say whether a door
        // belongs beside it. A `401` carrying no body — a proxy's, not ours —
        // therefore offers the door beside the general refusal, which is the
        // right gesture under a sentence that says less than it could.
        door: refused.statusCode === 401,
      }
      return false
    }
  }

  /**
   * A click that alters the shape of the Story. The Story is read back either
   * way: the click's own result is in it, and a refused one would otherwise sit
   * on screen as though it had persisted — the one exception being the shut door
   * `readBack` names.
   */
  async function change(act: () => Promise<unknown>) {
    const succeeded = await attempt(act)
    await readBack()
    return succeeded
  }

  /**
   * The read that follows a refusal, except behind a shut door — where the read
   * would be refused as well, and a refused read is what empties the page:
   * `useAsyncData` puts its default back when a fetch fails, so the Story would
   * go to nothing and take the field being typed in with it. That is the work
   * this refusal exists to keep. See
   * `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`.
   */
  async function readBack() {
    if (problem.value?.door) return
    await reload()
  }

  /**
   * The typed write the next one waits for. Every endpoint a typed write reaches
   * takes the whole list rather than a change to it — the Conditions an Exit
   * carries, the Flags a Scene sets — so two of them in flight at once are not
   * merged by the server: the one that arrives last wins, whichever was typed
   * last. One of these rather than one per field, because the two writes that
   * undo each other are usually not the same field: a Flag's value and a
   * Condition typed in the same breath both land on the Story.
   */
  let previous: Promise<unknown> = Promise.resolve()

  /**
   * What the Author typed, which the form has already written into the fetched
   * Story in place. Read back only on a refusal, so nothing the Author is still
   * typing is taken off the screen by a change that worked.
   *
   * Sent behind the typed write before it, so the order they are typed in is the
   * order the Story receives them in. The Author waits for nothing: the field
   * they are typing in is theirs already, and only the request queues — but the
   * marks a landed write leaves, `keptAt` and the flash, are inside the queue
   * with it, so neither says a write is kept before it is.
   */
  function write(act: () => Promise<unknown>) {
    // Taken now and taken away, because what flashes has to be the field this
    // very write came out of. A write can also start from a click — a Condition
    // taken off its row — and that one has no field to light, so it lights
    // nothing rather than whatever was last typed in somewhere else. Read here
    // and not in the queue, where the field the Author is typing in by then is
    // somebody else's.
    const field = writtenIn
    writtenIn = undefined

    const turn = previous.then(async () => {
      if (!await attempt(act)) {
        await readBack()
        return
      }

      keptAt.value = new Date()
      flash(field)
    })

    // What the next write waits on cannot be a promise that rejects: a refetch
    // that failed would otherwise end the queue and take every write typed after
    // it down with itself. The caller still gets the rejection.
    previous = turn.catch(() => {})
    return turn
  }

  return { problem, keptAt, change, write }
}
