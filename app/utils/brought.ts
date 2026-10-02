/**
 * What a Reading has brought in ahead of needing it, by address, and how long a
 * move waits on it. See `docs/adr/0073-a-beat-lands-when-its-image-can-be-shown.md`.
 *
 * An Image is brought in by an element of its own, its `src` the very address the
 * frame's `<img>` will carry, and decoded. The document then holds it in its *list
 * of available images*, which hands a later `<img>` with that address its bytes at
 * once, *even when they don't allow caching per HTTP*: the media doors stay
 * `no-store`, as `docs/adr/0005-a-shots-image-lives-in-its-row.md` set them, and
 * nothing outlives the page. The elements are kept referenced for as long as the
 * Reading is, because one nothing references is the browser's to let go, and a
 * step back would ask for its Image again.
 */
import type { Ref } from 'vue'

const brought = new Map<string, { image: HTMLImageElement, ready: Promise<void>, settled: boolean }>()

/** How long a move waits on its Image before it lands anyway, and how long before it says so. */
export const LANDS_WITHIN = 8000
const SLOW_AFTER = 500

/**
 * Brings one Image in, once: the same address is answered the same promise. A
 * load that fails settles it rather than rejecting, so a missing Image is a beat
 * landed without one and never a Reading stuck.
 */
export function bringIn(src: string) {
  const known = brought.get(src)
  if (known) return known.ready

  const image = new Image()
  image.src = src
  const held = { image, ready: Promise.resolve(), settled: false }
  held.ready = image.decode().catch(() => {}).then(() => {
    held.settled = true
  })
  brought.set(src, held)
  return held.ready
}

/**
 * What a move into a beat holding this Image waits on: nothing where it can be
 * shown now, or where the beat holds none, so a beat that is ready lands in the
 * very task it was asked for in, as it always did. Otherwise the bringing in, or
 * the ceiling, whichever comes first, with `slow` true for whatever of the wait
 * runs past half a second.
 */
export function untilShown(src: string | null, slow: Ref<boolean>) {
  if (!src) return
  const ready = bringIn(src)
  if (brought.get(src)!.settled) return

  const saying = setTimeout(() => {
    slow.value = true
  }, SLOW_AFTER)

  return Promise.race([ready, new Promise<void>(done => setTimeout(done, LANDS_WITHIN))])
    .then(() => {
      clearTimeout(saying)
      slow.value = false
    })
}

/** Lets go of everything brought in, as the Reading it was brought in for ends. */
export function letGo() {
  brought.clear()
}
