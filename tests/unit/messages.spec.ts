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
})
