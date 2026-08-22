import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  CONDITIONS_MAX,
  FLAG_NAME_MAX_LENGTH,
  FLAG_VALUE_MAX_LENGTH,
  VISITS_MAX,
} from '../../shared/utils/scenes'
import { UUID_PATTERN } from '../../server/utils/ids'

/**
 * The Conditions a Cut is offered under, or a Shot played under, read at the
 * request boundary. One reader serves both, so these read it as a Cut's and the
 * last test alone checks that the refusal names whichever is being written.
 *
 * The reader is a server module, so what it reaches for is nitro's own: the body
 * of the request, the caps it measures against, and the error it refuses with.
 * Standing those up is the whole of what it takes to read the reader without a
 * server around it — the same way `shots.spec.ts` reads its own.
 */
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (refusal: { statusCode: number, message: string }) =>
  Object.assign(new Error(refusal.message), refusal))
vi.stubGlobal('CONDITIONS_MAX', CONDITIONS_MAX)
vi.stubGlobal('FLAG_NAME_MAX_LENGTH', FLAG_NAME_MAX_LENGTH)
vi.stubGlobal('FLAG_VALUE_MAX_LENGTH', FLAG_VALUE_MAX_LENGTH)
vi.stubGlobal('VISITS_MAX', VISITS_MAX)
vi.stubGlobal('UUID_PATTERN', UUID_PATTERN)

const { readConditions } = await import('../../server/utils/conditions')

const asking = (body: unknown) => readConditions({ body } as unknown as H3Event, 'Cut')

/** A Scene named by a Condition counting visits, which the reader takes as a uuid. */
const SCENE = '0f5c2f8e-3a1e-4a4f-9d2f-1c6d5b0a7e11'

/** As many Flag tests as asked for, each one whole and each one different. */
const tests = (many: number) =>
  Array.from({ length: many }, (_, place) => ({ flag: `flag ${place}`, is: 'set' }))

describe('the Conditions a request writes', () => {
  it('takes a list of flat tests, and both shapes of one', async () => {
    await expect(asking({
      conditions: [
        { flag: 'coat', is: 'on' },
        { scene: SCENE, visits: 'at least', times: 2 },
      ],
    })).resolves.toEqual([
      { flag: 'coat', is: 'on' },
      { scene: SCENE, visits: 'at least', times: 2 },
    ])
  })

  it('reads no Conditions as a Cut offered to everyone, and a Shot every Reading sees', async () => {
    await expect(asking({ conditions: [] })).resolves.toEqual([])
    await expect(asking({ conditions: null })).resolves.toEqual([])
    await expect(asking({})).resolves.toEqual([])
  })

  it('takes a list at the cap and refuses the one test past it', async () => {
    await expect(asking({ conditions: tests(CONDITIONS_MAX) }))
      .resolves.toHaveLength(CONDITIONS_MAX)
    await expect(asking({ conditions: tests(CONDITIONS_MAX + 1) }))
      .rejects.toThrow(`${CONDITIONS_MAX} Conditions`)
  })

  it('refuses the whole list for one bad member, wherever it sits', async () => {
    for (const bad of [
      { of: 'nothing' },
      { flag: '', is: 'on' },
      // A key too many is a Condition trying to carry a second one.
      { flag: 'coat', is: 'on', and: { flag: 'key', is: 'found' } },
      { scene: 'The arrival', visits: 'at least', times: 2 },
      { scene: SCENE, visits: 'as often as', times: 2 },
      { scene: SCENE, visits: 'at least', times: VISITS_MAX + 1 },
      { scene: SCENE, visits: 'at least', times: 1.5 },
      [{ flag: 'coat', is: 'on' }],
      'coat is on',
      null,
    ]) {
      await expect(asking({ conditions: [bad] })).rejects.toThrow(/A Condition tests/)
      await expect(asking({ conditions: [{ flag: 'coat', is: 'on' }, bad] }))
        .rejects.toThrow(/A Condition tests/)
    }
  })

  it('refuses a Condition sent where a list of them belongs', async () => {
    await expect(asking({ conditions: { flag: 'coat', is: 'on' } }))
      .rejects.toThrow(/A Condition tests/)
  })

  it('trims a Flag on both sides of the comparison the engine will make', async () => {
    await expect(asking({ conditions: [{ flag: ' coat ', is: ' on ' }] }))
      .resolves.toEqual([{ flag: 'coat', is: 'on' }])
    await expect(asking({ conditions: [{ flag: 'c'.repeat(FLAG_NAME_MAX_LENGTH + 1), is: 'on' }] }))
      .rejects.toThrow(/A Condition tests/)
    const long = 'o'.repeat(FLAG_VALUE_MAX_LENGTH + 1)
    await expect(asking({ conditions: [{ flag: 'coat', is: long }] }))
      .rejects.toThrow(/A Condition tests/)
  })

  it('names what carries the list where the cap refuses it', async () => {
    const asShot = (body: unknown) =>
      readConditions({ body } as unknown as H3Event, 'Shot')

    await expect(asShot({ conditions: tests(CONDITIONS_MAX + 1) }))
      .rejects.toThrow(`A Shot cannot carry more than ${CONDITIONS_MAX} Conditions.`)
    await expect(asking({ conditions: tests(CONDITIONS_MAX + 1) }))
      .rejects.toThrow(`A Cut cannot carry more than ${CONDITIONS_MAX} Conditions.`)
  })
})
