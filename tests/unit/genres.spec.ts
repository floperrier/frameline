import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases'
import { STORY_GENRES, STORY_GENRES_MAX } from '../../shared/utils/stories'

/**
 * The Genres a request files a Story under, read at the request boundary. The
 * reader is a server module, so what it reaches for is nitro's own — the body of
 * the request, the set it holds to and the error it refuses with — and standing
 * those up is the whole of what it takes to read it without a server around it,
 * the way `conditions.spec.ts` reads its own.
 */
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (refusal: { statusCode: number, message: string }) =>
  Object.assign(new Error(refusal.message), refusal))
vi.stubGlobal('saying', () => (key: string, values?: Record<string, string | number>) =>
  phrase(DEFAULT_LOCALE, key, values))
vi.stubGlobal('STORY_GENRES', STORY_GENRES)
vi.stubGlobal('STORY_GENRES_MAX', STORY_GENRES_MAX)

const { readStoryGenres } = await import('../../server/utils/stories')

const filing = (body: unknown) => readStoryGenres({ body } as unknown as H3Event)

const REFUSED =
  'A Story is filed under one Genre or two, each from the list Frameline offers, and none twice.'

describe('the Genres a request files a Story under', () => {
  it('takes one Genre, or two, from the set', async () => {
    await expect(filing({ genres: ['drama'] })).resolves.toEqual(['drama'])
    await expect(filing({ genres: ['science-fiction', 'slice-of-life'] }))
      .resolves.toEqual(['science-fiction', 'slice-of-life'])
  })

  it('refuses none, and more than two', async () => {
    await expect(filing({ genres: [] })).rejects.toThrow(REFUSED)
    await expect(filing({ genres: ['drama', 'comedy', 'crime'] })).rejects.toThrow(REFUSED)
  })

  it('refuses the same Genre twice', async () => {
    await expect(filing({ genres: ['drama', 'drama'] })).rejects.toThrow(REFUSED)
  })

  it('refuses a Genre the set does not hold, its name, or anything but a list', async () => {
    await expect(filing({ genres: ['erotica'] })).rejects.toThrow(REFUSED)
    await expect(filing({ genres: ['Drama'] })).rejects.toThrow(REFUSED)
    await expect(filing({ genres: 'drama' })).rejects.toThrow(REFUSED)
    await expect(filing({})).rejects.toMatchObject({ statusCode: 400 })
  })
})
