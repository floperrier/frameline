import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, localeOf, phrase } from '../../server/utils/phrases'
import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'

/**
 * Which language the server answers one request in, and what it then says. A
 * pure function of the two things a request carries about language — the cookie
 * the interface writes when a Locale is chosen, and the header the browser sends
 * — so it is read here rather than through a server.
 */
describe('the Locale a request is answered in', () => {
  it('takes the language the browser asks for', () => {
    expect(localeOf('fr', undefined)).toBe('fr')
    expect(localeOf('en-GB,en;q=0.9', undefined)).toBe('en')
  })

  it('reads a region as its language, so fr-CA is French', () => {
    expect(localeOf('fr-CA,fr;q=0.9', undefined)).toBe('fr')
  })

  it('answers in English when the browser asks for a language we do not have', () => {
    expect(localeOf('is-IS,is;q=0.9', undefined)).toBe('en')
    expect(localeOf(undefined, undefined)).toBe(DEFAULT_LOCALE)
  })

  it('takes the language the browser prefers, not the one it names first', () => {
    expect(localeOf('de;q=1.0,en;q=0.5,fr;q=0.9', undefined)).toBe('fr')
  })

  it('passes over a language the browser says it will not take', () => {
    expect(localeOf('fr;q=0, en;q=0.4', undefined)).toBe('en')
    expect(localeOf('fr; q=0, en; q=0.4', undefined)).toBe('en')
  })

  it('lets an explicit choice beat what the browser announces', () => {
    expect(localeOf('en-US,en;q=0.9', 'fr')).toBe('fr')
    expect(localeOf('fr-FR,fr;q=0.9', 'en')).toBe('en')
  })

  it('ignores a cookie holding a Locale we do not have', () => {
    expect(localeOf('fr-FR,fr;q=0.9', 'is')).toBe('fr')
  })

  it('does not throw on a header nobody could parse', () => {
    // A malformed header says nothing about a language; it must not turn a
    // request that was merely bad into a server fault.
    expect(localeOf(';;;q=', undefined)).toBe('en')
    expect(localeOf('fr;q=what', undefined)).toBe('fr')
    // A weight that parses to nothing is a header saying nothing about weight,
    // which is not the same as a browser refusing the language.
    expect(localeOf('fr;q=', undefined)).toBe('fr')
    expect(localeOf('*', undefined)).toBe('en')
  })
})

describe('the phrase a refusal carries', () => {
  it('says it in the Locale it was asked for', () => {
    expect(phrase('en', 'refusals.storyTitle')).toBe(en.refusals.storyTitle)
    expect(phrase('fr', 'refusals.storyTitle')).toBe(fr.refusals.storyTitle)
  })

  it('writes the values the message names into it', () => {
    expect(phrase('en', 'refusals.storyTitleLong', { max: 200 }))
      .toBe('A title cannot be longer than 200 characters.')
    expect(phrase('fr', 'refusals.storyTitleLong', { max: 200 }))
      .toBe('Un titre ne peut pas dépasser 200 caractères.')
  })

  it('hands back the key rather than throwing when no message answers to it', () => {
    // A missing message is a defect the parity test catches. It must not be the
    // reason a request that was merely bad comes back as a server fault.
    expect(phrase('fr', 'nothing.of.the.kind')).toBe('nothing.of.the.kind')
    expect(phrase('fr', 'refusals')).toBe('refusals')
  })
})
