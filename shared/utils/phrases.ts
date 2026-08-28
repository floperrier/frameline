/**
 * Whatever turns a key and the values it names into the words a person reads:
 * `t` from the interface's own i18n in the browser, and the server's negotiated
 * phrasing behind the API.
 *
 * The pure functions that phrase something for a screen — a Scene nobody named,
 * an Exit nobody phrased, why a way on is missing — take one of these rather than
 * holding words of their own. They know which Scene; they do not know which
 * language, and nothing that has to run in a test with no browser should have
 * to.
 */
export type Phrase = (key: string, values?: Record<string, string | number>) => string
