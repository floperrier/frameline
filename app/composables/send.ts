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

/**
 * What the Author typed about one Shot, as its typed write sends it: its text as
 * formatted, its image's Description and its Sound's Transcript. Never its plain
 * words, which the server derives from the formatted text — sent alone they would
 * take the formatting away.
 */
export function typedAbout(shot: Shot) {
  return { formatted: shot.formatted, description: shot.description, transcript: shot.transcript }
}

/**
 * What the file dialog of a Sound offers. The media types alone are not enough:
 * several platforms map `.m4a` to `audio/x-m4a`, which greys an Author's own AAC
 * files out of their own dialog — in a product that ships thirty of them. Naming
 * the extensions beside the types loosens nothing, because what a Sound is is
 * read off its first bytes by the server and never off this list.
 */
export const SOUND_ACCEPT = [...SOUND_TYPES, '.m4a', '.mp3', '.aac'].join(',')

/**
 * The file an input's `change` carried, taken off it the way an image's own
 * deposit does — and the picker cleared, so choosing the very file already
 * there fires a second `change`. Read before `changing` is asked for one, so
 * a dialog closed with nothing chosen claims no Scene and reaches no server.
 */
export function depositedFile(event: Event) {
  const picker = event.target as HTMLInputElement
  const file = picker.files?.[0]
  if (file) picker.value = ''
  return file
}

/**
 * The two gestures every carrier of a Sound shares, addressed by the URL its
 * own endpoint answers to: a file sent as the whole request body the way an
 * image's is, or a file of the library fetched and replayed through the
 * same PUT — the same validation, the same sniffing, the same cap, and no
 * server path of its own. A Scene and a Shot differ in everything around
 * this (naming, confirmation, a loop), never in the PUT itself, so it is
 * written once here rather than copied per carrier.
 */
export function depositSoundAt(url: string, file: File) {
  return send(url, { method: 'PUT', body: file })
}

export async function takeLibrarySoundAt(url: string, file: string) {
  const blob = await (await fetch(libraryUrl(file))).blob()
  await send(url, { method: 'PUT', body: blob })
}
