/**
 * The longest title a Story may carry. Shared so the server's rejection and the
 * form's own limit cannot drift apart.
 */
export const STORY_TITLE_MAX_LENGTH = 200

/**
 * The languages a Story is offered at creation, and the one it is created in if
 * the Author says nothing. A convenience and not a constraint: the column holds
 * a BCP-47 code, and the list is deliberately not the Locales the interface has
 * — someone writing in Spanish inside a French editor is an ordinary case. See
 * `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`.
 */
export const STORY_LANGUAGES = ['en', 'fr', 'es', 'de', 'it'] as const

export type StoryLanguage = typeof STORY_LANGUAGES[number]

export const STORY_LANGUAGE_DEFAULT: StoryLanguage = 'en'

/**
 * The longest Synopsis a Story may carry. Shared so the server's rejection and
 * the form's own limit cannot drift apart, the way a title's is.
 *
 * Long enough for the few lines the glossary asks for and no longer: a Synopsis
 * is read on a shelf beside other people's, next to a title and a date, and one
 * that runs past a paragraph or two has stopped presenting the work and started
 * being it.
 */
export const STORY_SYNOPSIS_MAX_LENGTH = 600

/**
 * The Shot whose Image presents a Story wherever it is met before it is opened:
 * the one the Author named as its Cover, where they named one and it still
 * carries an Image, and otherwise the first Shot of the Opening Scene that
 * carries one. Null is a Story with nothing to show, presented by its words
 * alone. The server resolves the same rule in SQL for every shelf; this is the
 * bench's copy, so the picker marks the frame a Reader will actually see. See
 * `docs/adr/0040-a-story-is-presented-by-one-of-its-own-frames.md`.
 */
export function coverOf(story: {
  coverShotId: string | null
  openingSceneId: string | null
  scenes: { id: string, shots: { id: string, image: string | null }[] }[]
}) {
  const shots = story.scenes.flatMap(scene => scene.shots)
  const named = shots.find(shot => shot.id === story.coverShotId && shot.image)
  if (named) return named.id

  const opening = story.scenes.find(scene => scene.id === story.openingSceneId)
  return opening?.shots.find(shot => shot.image)?.id ?? null
}
