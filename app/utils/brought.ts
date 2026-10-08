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
 *
 * A Sound has no such list, so a `no-store` address set again on an `<audio>` is
 * asked for again. It is fetched into a `Blob` instead and played from an object
 * URL, which keeps `no-store` as it is and dies with the page, and the Reading's
 * two elements stay the only ones its Story is heard on.
 */
import type { Ref } from 'vue'

const imagesIn = new Map<string, { image: HTMLImageElement, ready: Promise<void>, settled: boolean }>()
const soundsIn = new Map<string, { url?: string, ready: Promise<void>, settled: boolean }>()

/** How long a move waits on its Image and its Sounds before it lands anyway, and how long before it says so. */
export const LANDS_WITHIN = 8000
const SLOW_AFTER = 500

/**
 * Brings one Image in, once: the same address is answered the same promise. A
 * load that fails settles it rather than rejecting, so a missing Image is a beat
 * landed without one and never a Reading stuck.
 */
export function bringIn(src: string) {
  const known = imagesIn.get(src)
  if (known) return known.ready

  const image = new Image()
  image.src = src
  const held = { image, ready: Promise.resolve(), settled: false }
  held.ready = image.decode().catch(() => {}).then(() => {
    held.settled = true
  })
  imagesIn.set(src, held)
  return held.ready
}

/**
 * Brings one Sound in, once, by the rule `bringIn` keeps: the same promise for
 * the same address, and a fetch that fails or is refused settled rather than
 * rejected, so the Sound plays late from its address instead. What brought no
 * bytes is forgotten as it settles, so the next call for that address asks for
 * it again rather than playing it late for the rest of the Reading. Bytes
 * arriving after the Reading let go of them make nothing.
 */
export function bringSoundIn(src: string) {
  const known = soundsIn.get(src)
  if (known) return known.ready

  const held: { url?: string, ready: Promise<void>, settled: boolean } = { ready: Promise.resolve(), settled: false }
  held.ready = fetch(src)
    .then(response => (response.ok ? response.blob() : undefined))
    .then((bytes) => {
      if (bytes && soundsIn.get(src) === held) held.url = URL.createObjectURL(bytes)
    })
    .catch(() => {})
    .then(() => {
      held.settled = true
      if (!held.url && soundsIn.get(src) === held) soundsIn.delete(src)
    })
  soundsIn.set(src, held)
  return held.ready
}

/** What an `<audio>` plays a Sound from: its bytes where they are in, its own address where not. */
export function playable(src: string) {
  return soundsIn.get(src)?.url ?? src
}

/**
 * What a move into a beat holding this Image and playing these Sounds waits on:
 * nothing where all of them are in, or where there are none, so a beat that is
 * ready lands in the very task it was asked for in, as it always did. Otherwise
 * the bringing in of the rest, or the ceiling, whichever comes first, with `slow`
 * true for whatever of the wait runs past half a second.
 */
export function untilShown(src: string | null, slow: Ref<boolean>, sounds: string[] = []) {
  if (src) bringIn(src)
  for (const sound of sounds) bringSoundIn(sound)
  const waiting = [...(src ? [imagesIn.get(src)!] : []), ...sounds.map(sound => soundsIn.get(sound)!)]
    .filter(held => !held.settled)
  if (!waiting.length) return

  const saying = setTimeout(() => {
    slow.value = true
  }, SLOW_AFTER)

  return Promise.race([
    Promise.all(waiting.map(held => held.ready)),
    new Promise<void>(done => setTimeout(done, LANDS_WITHIN)),
  ])
    .then(() => {
      clearTimeout(saying)
      slow.value = false
    })
}

/** Lets go of everything brought in, as the Reading it was brought in for ends. */
export function letGo() {
  imagesIn.clear()
  for (const { url } of soundsIn.values()) {
    if (url) URL.revokeObjectURL(url)
  }
  soundsIn.clear()
}
