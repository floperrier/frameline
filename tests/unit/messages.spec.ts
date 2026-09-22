import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'

/**
 * The two message files, held against each other.
 *
 * The one test here that asserts a property of the source rather than something
 * a person can observe, and deliberately: a key written in one language and
 * forgotten in the other is the likeliest defect this feature has, it needs no
 * browser and no database to catch, and the alternative is finding out about it
 * because an English sentence turned up on a French screen.
 */
function keysOf(messages: object, under = ''): string[] {
  return Object.entries(messages).flatMap(([key, held]) =>
    typeof held === 'object' && held !== null
      ? keysOf(held, `${under}${key}.`)
      : [`${under}${key}`])
}

describe('the message files', () => {
  it('carry the same keys, all the way down', () => {
    expect(keysOf(fr).sort()).toEqual(keysOf(en).sort())
  })

  it('leave no message empty, in either language', () => {
    for (const messages of [en, fr]) {
      const said = (key: string) => key.split('.').reduce<never>(
        (held, step) => held[step], messages as never) as unknown

      expect(keysOf(messages).filter(key => !String(said(key)).trim())).toEqual([])
    }
  })

  it('name the same values in a message as the message it translates', () => {
    const named = (message: string) => [...message.matchAll(/{(\w+)}/g)].map(([, name]) => name)

    for (const key of keysOf(en)) {
      const at = (messages: object) => key.split('.').reduce<never>(
        (held, step) => held[step], messages as never) as unknown as string

      expect([key, named(at(fr)).sort()]).toEqual([key, named(at(en)).sort()])
    }
  })

  /**
   * `waysOnStandFor` is the first message written in vue-i18n's plural form, where
   * `|` cuts the branch spoken of one from the branch spoken of the rest and the
   * count picks between them. The three tests above see none of it: a file that
   * dropped a branch still carries the key, still says something, and still names
   * the same values, so a message pluralised in English and flat in French would
   * reach a French screen reading *pendant 2 secondes* for every count and *une
   * seconde* for none. Held here so the second pluralised key does not have to
   * find it out again.
   */
  it('cut a pluralised message into the same branches in both languages', () => {
    for (const key of keysOf(en)) {
      const at = (messages: object) => (key.split('.').reduce<never>(
        (held, step) => held[step], messages as never) as unknown as string)
        .split('|').map(branch => branch.trim())

      expect([key, at(fr).length]).toEqual([key, at(en).length])
      expect([key, [...at(en), ...at(fr)].filter(branch => !branch)]).toEqual([key, []])
    }
  })

  /**
   * A Cut's three times are read by one rule — `isTime` takes a whole number of
   * milliseconds — so the three refusals it comes back as name one unit. Two of them
   * said seconds, which let `2500` through a sentence saying it should not pass and
   * refused `1500.5` with one that does not explain why. Held here rather than only
   * in the end-to-end suite, which reads the English alone and asks for a database.
   */
  it('name milliseconds in each refusal a Cut’s times come back as', () => {
    const files = [['en', en.refusals], ['fr', fr.refusals]] as const

    for (const [language, refusals] of files) {
      for (const key of ['cutAfter', 'cutOver', 'exitsAfter'] as const) {
        expect([language, key, refusals[key]]).toEqual(
          [language, key, expect.stringContaining('millisecond')])
      }
    }
  })
})
