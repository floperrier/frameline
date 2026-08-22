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
})
