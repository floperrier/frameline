/**
 * How a Story is labelled on a shelf: the day it was published, the Language it
 * is written in and the Genres it is filed under. Written once because the Catalogue and a Profile hand over
 * the same entries in two orders, and a date formatted one way on one shelf and
 * another way on the next would be two answers to one question.
 */
export function useEntries() {
  const { locale, t, te } = useI18n()

  /**
   * The day a Story was published, written the way a date is written in the
   * Locale: the entry around the Story is the interface talking, so it is in the
   * language of whoever is reading rather than the Language of the work.
   *
   * Read in UTC rather than in the reader's own zone, so the server and the
   * browser agree on which day it was. A Story published at midnight would
   * otherwise be dated one day on the page delivered and another the moment it
   * is hydrated.
   */
  const published = computed(() => new Intl.DateTimeFormat(
    locale.value, { dateStyle: 'long', timeZone: 'UTC' }))

  /**
   * The Language a Story is written in, named. The column holds any BCP-47 code
   * while the interface has a name for the few the form offers, so a Story
   * written in something else is shown the code it carries rather than a blank.
   */
  function languageNamed(code: string) {
    return te(`languages.${code}`) ? t(`languages.${code}`) : code
  }

  /**
   * A Genre a Story is filed under, named in the Locale. The set is closed, so
   * a code with no name is one written by a later version of the set, and is
   * shown as the code rather than as a blank.
   */
  function genreNamed(code: string) {
    return te(`genres.${code}`) ? t(`genres.${code}`) : code
  }

  return { published, languageNamed, genreNamed }
}
