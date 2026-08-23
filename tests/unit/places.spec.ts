import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import { UUID_PATTERN } from '../../server/utils/ids'

/**
 * The sequence of Places a request writes, read at the request boundary. One
 * reader serves the Shots of a Scene and the ways on leaving it, so these read
 * it as a Shot's and the last test alone checks that the refusal names whichever
 * is being renumbered.
 *
 * What the reader settles is the shape of the sequence: a list, of ids, each
 * named once. Whether it names every id the Scene really holds is settled by the
 * statement that writes it, where the Scene is in reach — the end-to-end suite is
 * where that half is proved, as it is the half that needs a database.
 *
 * The reader is a server module, so what it reaches for is nitro's own, stood up
 * here the way `conditions.spec.ts` stands up its own.
 */
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (refusal: { statusCode: number, message: string }) =>
  Object.assign(new Error(refusal.message), refusal))
vi.stubGlobal('saying', () => (key: string, values?: Record<string, string | number>) =>
  phrase(DEFAULT_LOCALE, key, values))
vi.stubGlobal('UUID_PATTERN', UUID_PATTERN)

const { readPlaces } = await import('../../server/utils/places')

const asking = (body: unknown) => readPlaces({ body } as unknown as H3Event, 'Shot')

/** Three ids of the shape the reader takes, standing in for a Scene's own. */
const [FIRST, SECOND, THIRD] = [
  '0f5c2f8e-3a1e-4a4f-9d2f-1c6d5b0a7e11',
  '2b7d1a03-6c4e-4f19-8a55-9e0b3d2c4a76',
  '7c1f9e44-0b2d-4a8c-91e3-5d6a8f0c2b39',
]

describe('the sequence of Places a request writes', () => {
  it('takes the ids in the order the Author put them in', async () => {
    await expect(asking({ places: [THIRD, FIRST, SECOND] }))
      .resolves.toEqual([THIRD, FIRST, SECOND])
  })

  it('refuses a sequence that is not a list of ids', async () => {
    for (const places of [undefined, null, 'a list', { 0: FIRST }, [FIRST, 'Shot 2'], [FIRST, 2]]) {
      await expect(asking({ places })).rejects.toThrow(/renumbered all at once/)
    }
  })

  it('refuses a sequence that renumbers nothing', async () => {
    await expect(asking({ places: [] })).rejects.toThrow(/renumbered all at once/)
  })

  it('refuses an id named twice, which would leave two things at one Place', async () => {
    await expect(asking({ places: [FIRST, SECOND, FIRST] }))
      .rejects.toThrow(/renumbered all at once/)
  })

  it('refuses one id spelled two ways, which Postgres would read as one', async () => {
    await expect(asking({ places: [FIRST, SECOND, FIRST.toUpperCase()] }))
      .rejects.toThrow(/renumbered all at once/)
  })

  it('hands the ids on as Postgres reads them, whichever case they arrived in', async () => {
    await expect(asking({ places: [SECOND.toUpperCase(), FIRST] }))
      .resolves.toEqual([SECOND, FIRST])
  })

  it('names what is being renumbered in the refusal', async () => {
    const asCuts = (body: unknown) => readPlaces({ body } as unknown as H3Event, 'Cut')

    await expect(asking({ places: [] })).rejects.toThrow(
      'The Shots of a Scene are renumbered all at once, each one named exactly once.')
    await expect(asCuts({ places: [] })).rejects.toThrow(
      'The ways on leaving a Scene are renumbered all at once, each one named exactly once.')
  })
})
