/**
 * The reads an act asks for once it has been sent, each answered to the act that
 * asked it — issue #479 and `docs/adr/0032-the-bench-reads-the-story-back.md`.
 *
 * Reads that cross on the way back land newest first: one answering after a newer
 * one has landed is older than what is on the bench, and dropped. One that fails
 * drops nothing, so where the newer read fails the older that came back is the one
 * the bench shows. A read restoring after a refusal stays owed until a read asked
 * as late as it has landed, so whichever lands first is put in place whole —
 * `land` is told so — rather than laid over what the bench holds.
 *
 * Whoever asked a read is answered on their own number. Their promise is kept as
 * soon as a read asked as late as theirs or later has landed, since the Story on
 * the bench holds their act from then on; and it fails, with the error of the last
 * of those reads to fail, once every one of them has failed. A read older than
 * theirs coming back keeps it on the bench but answers nothing for them: the act
 * that cut a Scene and then reaches for it would otherwise reach into a Story that
 * does not hold it yet, and nothing would say why. Nobody waits for a read slower
 * than the first one that answers them either.
 *
 * A `land` that throws is a read that failed: what it was given is not on the
 * bench.
 */
export function readsBack<T>(
  fetch: () => Promise<T>,
  land: (read: T, whole: boolean) => void,
) {
  let asked = 0
  let onBench = 0
  let restoreAsked = 0
  const unsettled = new Set<number>()
  const waiting = new Set<Waiting>()

  function settled(read: number, error?: unknown) {
    unsettled.delete(read)

    for (const one of waiting) {
      if (onBench >= one.asking) {
        waiting.delete(one)
        one.landed()
      }
      else if (![...unsettled].some(other => other >= one.asking)) {
        waiting.delete(one)
        one.failed(error)
      }
    }
  }

  return function readBack(whole = false) {
    const asking = ++asked
    if (whole) restoreAsked = asking
    unsettled.add(asking)

    const done = new Promise<void>((landed, failed) => waiting.add({ asking, landed, failed }))

    new Promise<T>(read => read(fetch()))
      .then((read) => {
        if (asking < onBench) return
        land(read, restoreAsked > onBench)
        onBench = asking
      })
      .then(() => settled(asking), (error: unknown) => settled(asking, error))

    return done
  }
}

type Waiting = { asking: number, landed: () => void, failed: (error: unknown) => void }
