/**
 * The clock one Reading is carried by, and every watch it keeps. A Reading keeps
 * more than one — the hold on the beat on screen, the time the ways on stand —
 * and what they had in common was the whole of what each of them was written
 * with: the same head, the same guard, the same foot. They were written twice
 * and brought back into line by review twice, so they are written here once and
 * the Reading sets them rather than keeping them. See issue #334 and
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 *
 * What that buys is not the lines. Two watches cannot disagree about the pause
 * or about a tab nobody is looking at, because neither of them holds an answer:
 * there is one `stopped` here and every watch set through this reads it.
 */
export function useClock() {
  /**
   * Whether the clock is stopped by the hand. Beside the Path and never inside
   * it, the way muting is — a Path is a reading of the Story and stopping is a
   * property of the person. Unlike muting it is not kept between visits: a mute
   * is a preference, a pause is a moment, and a Reader who comes back to a Story
   * they stopped wants it running again.
   */
  const paused = ref(false)

  /** Whether the page is out of sight, which stops the clock as surely as the control does. */
  const hidden = ref(false)

  onMounted(() => {
    const watching = () => { hidden.value = document.visibilityState === 'hidden' }
    // Read as the Reading mounts rather than waited for. A silent Story opens with
    // no press at all, so a link opened into a background tab — a middle click, a
    // session restored — would start its clock in a room nobody is looking at, and
    // the Reader would arrive at a Story that had played on without them. The event
    // says when it changed; only this says what it is.
    watching()
    document.addEventListener('visibilitychange', watching)
    onBeforeUnmount(() => document.removeEventListener('visibilitychange', watching))
  })

  /**
   * Whether nothing is running, which is the one answer both reasons for it come
   * out as. Handed back because the screen reads it too — a bar draining the time
   * the ways on stand is stopped by a hidden tab exactly as it is by the control.
   */
  const stopped = computed(() => paused.value || hidden.value)

  /**
   * One watch. `beat` says what is being timed — how long it stands, and the
   * press the clock makes when it has stood that long — or nothing where nothing
   * is: a beat held until the press, a Scene whose ways on wait to be taken, a
   * Reading that has ended.
   *
   * Read as an effect rather than watched over a list of sources, so a clock
   * cannot go on running against something the list forgot to name: whatever the
   * getter reads is what restarts it, and an Author turning a Scene from *at the
   * press* to *after a time* has changed the beat in front of them without
   * anything here being told about the field they changed.
   *
   * Set as the beat appears and cleared as it leaves, so no timer outlives the
   * beat it was started for; restarted rather than resumed after a pause or a
   * hidden tab, because nothing recorded how far it had got. A Cut is not a
   * position, which is the rule
   * `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` settled about a Sound,
   * read again.
   */
  function clock(beat: () => { after: number, press: () => void } | undefined) {
    let waiting: ReturnType<typeof setTimeout>

    watchEffect(() => {
      clearTimeout(waiting)
      // The server draws the beat too, and a timer started from that render would
      // be started into a request already answered, with no `onBeforeUnmount` left
      // to clear it.
      if (!import.meta.client) return
      if (stopped.value) return

      const now = beat()
      if (!now) return

      // Always through the clock, nought included: a `setTimeout` of nought is
      // still a macrotask, landing after the mount by construction, so a Reading
      // that flows on from its opening beat draws its seed before anything moves
      // the Path off it.
      waiting = setTimeout(now.press, now.after)
    })

    onBeforeUnmount(() => clearTimeout(waiting))
  }

  return { paused, stopped, clock }
}
