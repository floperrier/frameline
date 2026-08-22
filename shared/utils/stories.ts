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
