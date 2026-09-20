/**
 * The Sound a Scene is heard under and the one a Shot strikes with: what a file
 * of each kind starts with, how heavy one may be, where it is served, and which
 * Sound one Scene of a Story is actually heard under.
 *
 * Shared, because the server refuses what the picker offers and the reading
 * plays what the bench deposited: one statement of each rule rather than three
 * that can drift. See `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`.
 */

/**
 * The most one Sound may weigh, and the same cap an Image carries for the same
 * reason — `docs/adr/0005-a-shots-image-lives-in-its-row.md`: past two megabytes
 * Postgres TOASTs the value out of the row, and no query that does not select it
 * ever touches it. A one-minute bed is ~720 KB in AAC at 96 kbps.
 */
export const SOUND_MAX_BYTES = 2 * 1024 * 1024

/**
 * The longest Transcript a Sound may carry. Twice a Description, because a Sound
 * may carry speech where an Image carries a frame; far below a Shot's text,
 * because what is written here says what is heard rather than being the beat.
 */
export const SOUND_TRANSCRIPT_MAX_LENGTH = 500

/**
 * The brands an MPEG-4 file announces itself with when what is in it is AAC.
 * `M4A ` is what a file carrying Sound and nothing else is written with, and
 * the two beside it are what a general-purpose muxer writes instead.
 */
const MPEG4_BRANDS = ['M4A ', 'mp42', 'isom']

/**
 * The kinds a Sound may be. It is the file dialog's `accept` and nothing else:
 * no boundary is held by it, because what a Sound is is read off its own first
 * bytes by `soundTypeOf` on the way in — a file dialog is a courtesy to the hand
 * and never a check.
 *
 * `audio/mp4` and `audio/mpeg` are not Frameline's words for a Sound — they are
 * the registered media types a `Content-Type` header and an
 * `<audio><source type>` must carry, and neither has a synonym to carry it under
 * instead. `CONTEXT.md` already settles this on the same kind of list:
 * `alt` sits on the Description entry's `_Avoid_` line and is written eight
 * times in `app/` regardless, because HTML owns that attribute's name the
 * way the platform owns this string.
 *
 * Kept by hand rather than read off `soundTypeOf`'s own readings the way
 * `SHOT_IMAGE_TYPES` is read off `SHOT_IMAGE_SIGNATURES`: an MP3 opens on a
 * bit mask, not a run of bytes at a fixed offset, so there is no table here
 * for either list to be derived from. A kind added to one must be added to
 * the other by hand, and nothing but this comment says so.
 */
export const SOUND_TYPES = ['audio/mp4', 'audio/mpeg']

/**
 * What a Sound really is, read from its own first bytes rather than from what
 * the upload said it was — `0005`'s rule verbatim, because the bytes are served
 * back under whatever type we believe.
 *
 * Opus is not here, and it is the best ratio of the three. Opus in an Ogg
 * container does not play in Safari at all, and a Sound is one deposit served
 * exactly as it was given, so there is no second `<source>` to fall back to:
 * taking one would be a trap laid at the Author's expense.
 *
 * Written as two readings rather than as a table of signatures, because neither
 * kind is a run of fixed bytes: an MPEG-4 file names its brand past a length,
 * and an MP3 frame opens on eleven bits set rather than on a byte.
 */
export function soundTypeOf(bytes: Uint8Array) {
  if (holds(bytes, 4, 'ftyp') && MPEG4_BRANDS.some(brand => holds(bytes, 8, brand))) {
    return 'audio/mp4'
  }
  // An MP3 is a run of frames, with or without a tag in front of them: the tag
  // names itself, and a frame opens on the sync word.
  if (holds(bytes, 0, 'ID3')) return 'audio/mpeg'
  if (bytes[0] === 0xFF && ((bytes[1] ?? 0) & 0xE0) === 0xE0) return 'audio/mpeg'
}

/** Whether these letters sit at this offset. A file too short to say holds nothing. */
function holds(bytes: Uint8Array, offset: number, written: string) {
  return [...written].every((letter, at) => bytes[offset + at] === letter.charCodeAt(0))
}

/**
 * Where a Sound is served. The bytes never travel with the Story — a Story of
 * forty Scenes would be forty beds in one response — so what the Story carries
 * is this address, and null for whatever carries none.
 */
export function sceneSoundUrl(sceneId: string) {
  return `/api/scenes/${sceneId}/sound`
}

export function shotSoundUrl(shotId: string) {
  return `/api/shots/${shotId}/sound`
}

/**
 * A Scene as this file reads it: the address of its own bytes, or the Scene it
 * takes them from, and the two things that belong to the bytes. Structural, so
 * that the bench's Story, the Reader's and a test's three-line one are all read
 * by the same rule.
 */
export type Carrying = {
  id: string
  sound: string | null
  soundOfSceneId: string | null
  transcript: string
  soundLoops: boolean
}

/** What one Scene is heard under, and which Scene's row it was read off. */
export type Heard = {
  carrier: string
  sound: string
  transcript: string
  loops: boolean
}

/**
 * The Sound one Scene is heard under: its own bytes, or the bytes of the Scene
 * it names, or nothing. A Sound is the carrier's entire, so the Transcript and
 * the loop come off the same row as the bytes — the same rain is transcribed
 * once, and two Scenes heard under one Sound cannot disagree about whether it
 * repeats.
 *
 * One hop and no further: a Scene naming a Scene that is itself naming is heard
 * under nothing. A chain is not walked here because it cannot be written — the
 * `<select>` offers carriers alone and the API refuses the rest — and reading
 * one anyway would make the rule two rules.
 */
export function heardUnder(scenes: Carrying[], sceneId: string | null | undefined) {
  const scene = scenes.find(other => other.id === sceneId)
  if (!scene) return
  if (scene.sound) return read(scene)

  const named = scenes.find(other => other.id === scene.soundOfSceneId)

  return named?.sound ? read(named) : undefined
}

function read(scene: Carrying): Heard {
  return {
    carrier: scene.id,
    sound: scene.sound!,
    transcript: scene.transcript,
    loops: scene.soundLoops,
  }
}

/**
 * Whether the Sound held under one Scene goes on under the next. The carrier is
 * the whole of the question: B naming A, A naming B and both naming C are one
 * Sound and never restart, and two Scenes each carrying their own are two.
 *
 * It is also what says when the bed starts again. Nothing records where a Sound
 * had got to and a Path carries no seconds, so a crossing that changes the
 * carrier starts the new one from the beginning — forwards or backwards, which
 * is why a step back across an Exit is not a case of its own.
 */
export function heldAcross(before: Heard | undefined, after: Heard | undefined) {
  return Boolean(before && after && before.carrier === after.carrier)
}

/**
 * The Scenes a Sound may be named from: the ones carrying bytes of their own.
 * What the `<select>` offers and what the API accepts are this one list, so a
 * naming the bench withholds is a naming the server refuses.
 */
export function soundCarriers(scenes: Carrying[]) {
  return scenes.filter(scene => scene.sound)
}

/**
 * Whether this Story carries a Sound anywhere, which is what decides whether the
 * title card of the reading page is a control. Read off the addresses the Story
 * already carries, so it costs no query and never touches the bytes.
 */
export function carriesSound(
  story: { scenes: (Carrying & { shots: { sound: string | null }[] })[] },
) {
  return story.scenes.some(scene =>
    heardUnder(story.scenes, scene.id) || scene.shots.some(shot => shot.sound))
}
