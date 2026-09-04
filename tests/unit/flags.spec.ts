import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import {
  FLAGS_PER_SCENE,
  FLAG_NAME_MAX_LENGTH,
  FLAG_SEPARATOR,
  FLAG_VALUES_MAX,
  FLAG_VALUES_SEPARATOR,
  FLAG_VALUE_MAX_LENGTH,
  flagRows,
  flagsSet,
} from '../../shared/utils/scenes'

/**
 * The Flags a Scene sets, read at the request boundary and written back out as
 * the rows an Author writes them in. Two seams in one file because they are two
 * halves of one thing: what the reader refuses is what the rows may never
 * produce.
 *
 * The reader is a server module, so what it reaches for is nitro's own: the body
 * of the request, the caps it measures against, and the error it refuses with.
 * Standing those up is the whole of what it takes to read the reader without a
 * server around it — the same way `conditions.spec.ts` reads its own.
 */
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (refusal: { statusCode: number, message: string }) =>
  Object.assign(new Error(refusal.message), refusal))
// The refusal comes out of the message file the interface reads, in the language
// the request asked for; here that is English, which is what these assertions
// are written in.
vi.stubGlobal('saying', () => (key: string, values?: Record<string, string | number>) =>
  phrase(DEFAULT_LOCALE, key, values))
vi.stubGlobal('FLAG_NAME_MAX_LENGTH', FLAG_NAME_MAX_LENGTH)
vi.stubGlobal('FLAG_VALUE_MAX_LENGTH', FLAG_VALUE_MAX_LENGTH)
vi.stubGlobal('FLAG_VALUES_MAX', FLAG_VALUES_MAX)
vi.stubGlobal('FLAG_SEPARATOR', FLAG_SEPARATOR)
vi.stubGlobal('FLAG_VALUES_SEPARATOR', FLAG_VALUES_SEPARATOR)
vi.stubGlobal('FLAGS_PER_SCENE', FLAGS_PER_SCENE)

const { readSceneFlags } = await import('../../server/utils/scenes')

const asking = (body: unknown) => readSceneFlags({ body } as unknown as H3Event)

describe('the Flags a request writes', () => {
  it('takes a name and a value, trimmed as the Author left them', async () => {
    await expect(asking({ sets: { coat: 'on', ' drink ': ' whisky ' } }))
      .resolves.toEqual({ coat: 'on', drink: 'whisky' })
  })

  it('takes the several values a Flag is drawn from', async () => {
    await expect(asking({ sets: { weather: ['rain', 'sun', 'haze'], coat: 'on' } }))
      .resolves.toEqual({ weather: ['rain', 'sun', 'haze'], coat: 'on' })
  })

  it('refuses a list of one, which is a plain value and arrives as one', async () => {
    await expect(asking({ sets: { weather: ['rain'] } })).rejects.toThrow('A Flag is a name')
    await expect(asking({ sets: { weather: [] } })).rejects.toThrow('A Flag is a name')
  })

  it('refuses a list past the cap, and names it', async () => {
    const many = (values: number) =>
      asking({ sets: { weather: Array.from({ length: values }, (_, at) => `value ${at}`) } })

    await expect(many(FLAG_VALUES_MAX)).resolves.toHaveProperty('weather')
    await expect(many(FLAG_VALUES_MAX + 1)).rejects.toThrow(`${FLAG_VALUES_MAX} values`)
  })

  it('refuses a value holding the separator a draw’s values are told apart by', async () => {
    await expect(asking({ sets: { weather: `rain ${FLAG_VALUES_SEPARATOR} sun` } }))
      .rejects.toThrow(FLAG_VALUES_SEPARATOR)
    await expect(asking({ sets: { weather: ['rain', `sun ${FLAG_VALUES_SEPARATOR} haze`] } }))
      .rejects.toThrow(FLAG_VALUES_SEPARATOR)
  })

  it('holds the caps on a name and a value per value, not per line', async () => {
    const long = 'w'.repeat(FLAG_VALUE_MAX_LENGTH)
    await expect(asking({ sets: { weather: [long, long] } })).resolves.toEqual({
      weather: [long, long],
    })
    await expect(asking({ sets: { weather: [long, `${long}w`] } }))
      .rejects.toThrow('A Flag is a name')
    await expect(asking({ sets: { ['w'.repeat(FLAG_NAME_MAX_LENGTH + 1)]: ['rain', 'sun'] } }))
      .rejects.toThrow('A Flag is a name')
  })

  it('refuses a Flag given nothing, one value or several', async () => {
    await expect(asking({ sets: { coat: '' } })).rejects.toThrow('A Flag is a name')
    await expect(asking({ sets: { weather: ['rain', ' '] } })).rejects.toThrow('A Flag is a name')
    await expect(asking({ sets: { weather: ['rain', 12] } })).rejects.toThrow('A Flag is a name')
  })

  it('refuses a name holding the separator between a name and a value', async () => {
    await expect(asking({ sets: { [`coat ${FLAG_SEPARATOR} on`]: 'on' } }))
      .rejects.toThrow('A Flag is a name')
  })

  it('takes a value holding it, which a line is only ever split on once', async () => {
    await expect(asking({ sets: { weather: ['rain', `sun ${FLAG_SEPARATOR} shine`] } }))
      .resolves.toEqual({ weather: ['rain', `sun ${FLAG_SEPARATOR} shine`] })
  })

  it('refuses more Flags than a Scene may set, drawn or plain', async () => {
    const sets = Object.fromEntries(Array.from(
      { length: FLAGS_PER_SCENE + 1 },
      (_, at) => [`flag ${at}`, ['rain', 'sun']],
    ))

    await expect(asking({ sets })).rejects.toThrow(`${FLAGS_PER_SCENE} Flags`)
  })

  it('refuses a body that carries no Flags at all', async () => {
    await expect(asking({})).rejects.toThrow('A Flag is a name')
    await expect(asking({ sets: ['coat'] })).rejects.toThrow('A Flag is a name')
  })
})

describe('the Flags a Scene sets, as rows and back', () => {
  /** What one Scene's Flags come back as, having been drawn as rows and read again. */
  const roundTrip = (sets: Parameters<typeof flagRows>[0]) => flagsSet(flagRows(sets))

  it('brings a plain Flag back as the value it was', () => {
    expect(roundTrip({ coat: 'on', drink: 'whisky' })).toEqual({ coat: 'on', drink: 'whisky' })
  })

  it('brings a drawn Flag back as the list it was, in the Author’s order', () => {
    expect(roundTrip({ weather: ['rain', 'sun', 'haze'], coat: 'on' }))
      .toEqual({ weather: ['rain', 'sun', 'haze'], coat: 'on' })
  })

  it('gives a Flag of one value one field to type it in', () => {
    expect(flagRows({ coat: 'on', weather: ['rain', 'sun'] })).toEqual([
      { name: 'coat', values: ['on'] },
      { name: 'weather', values: ['rain', 'sun'] },
    ])
  })

  it('keeps a row of one value a plain value rather than a list of one', () => {
    expect(flagsSet([{ name: 'coat', values: ['on'] }])).toEqual({ coat: 'on' })
  })

  it('trims what the Author typed, name and values alike', () => {
    expect(flagsSet([{ name: ' coat ', values: [' on '] }])).toEqual({ coat: 'on' })
  })

  it('leaves out the row that is half a Flag rather than sending it to be refused', () => {
    // A row with no name yet, a row given no value, and a value the Author has
    // emptied on their way to typing another: none of them is a Flag the Scene
    // sets, and none of them may take the rest of the list down with it.
    expect(flagsSet([{ name: '', values: ['on'] }])).toEqual({})
    expect(flagsSet([{ name: 'coat', values: [' '] }])).toEqual({})
    expect(flagsSet([
      { name: 'weather', values: ['rain', '', 'haze'] },
      { name: 'coat', values: ['on'] },
    ])).toEqual({ weather: ['rain', 'haze'], coat: 'on' })
  })
})
