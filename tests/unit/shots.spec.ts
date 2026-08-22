import { describe, expect, it, vi } from 'vitest'
import { SHOT_DESCRIPTION_MAX_LENGTH, imageTypeOf } from '../../shared/utils/scenes'
import type { H3Event } from 'h3'

/** The first bytes of one file of each format a Shot may carry, and of some it may not. */
const heads = {
  jpeg: [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46],
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00],
  webp: [0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00],
  // A RIFF container that is a sound rather than a still: the tag matches, the
  // form name four bytes on does not.
  wave: [0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45],
  svg: [...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')],
  html: [...Buffer.from('<!doctype html><script>alert(1)</script>')],
}

const bytes = (of: keyof typeof heads) => Uint8Array.from(heads[of])

describe('what an image really is', () => {
  it('reads the three still formats a Shot may carry', () => {
    expect(imageTypeOf(bytes('jpeg'))).toBe('image/jpeg')
    expect(imageTypeOf(bytes('png'))).toBe('image/png')
    expect(imageTypeOf(bytes('webp'))).toBe('image/webp')
  })

  it('recognises nothing else, whatever the upload called it', () => {
    for (const other of ['gif', 'wave', 'svg', 'html'] as const) {
      expect(imageTypeOf(bytes(other))).toBeUndefined()
    }
  })

  it('recognises nothing in a file too short to say what it is', () => {
    expect(imageTypeOf(new Uint8Array())).toBeUndefined()
    expect(imageTypeOf(bytes('png').slice(0, 4))).toBeUndefined()
    expect(imageTypeOf(bytes('webp').slice(0, 6))).toBeUndefined()
  })
})

/**
 * The Description a Shot's still carries, read at the request boundary. The
 * reader is a server module, so what it reaches for is nitro's own: the body of
 * the request, the cap it measures against, and the error it refuses with.
 * Standing those three up is the whole of what it takes to read the reader
 * without a server around it.
 */
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('createError', (refusal: { statusCode: number, statusMessage: string }) =>
  Object.assign(new Error(refusal.statusMessage), refusal))
vi.stubGlobal('SHOT_DESCRIPTION_MAX_LENGTH', SHOT_DESCRIPTION_MAX_LENGTH)

const { readShotDescription } = await import('../../server/utils/shots')

const asking = (body: unknown) => readShotDescription({ body } as unknown as H3Event)

describe('the Description a request writes', () => {
  it('takes what the Author wrote about the frame, as they wrote it', async () => {
    await expect(asking({ description: 'A door onto a wet street, opening.' }))
      .resolves.toBe('A door onto a wet street, opening.')
    await expect(asking({ description: 'w'.repeat(SHOT_DESCRIPTION_MAX_LENGTH) }))
      .resolves.toHaveLength(SHOT_DESCRIPTION_MAX_LENGTH)
  })

  it('takes an empty one, which is a Still nobody has described', async () => {
    await expect(asking({ description: '' })).resolves.toBe('')
  })

  it('refuses a request that says nothing about the Description', async () => {
    // The same rule as the Shot's text: taken as empty, a request with no
    // Description in it would erase the one the Author wrote.
    await expect(asking({ text: 'A door opens.' })).rejects.toThrow('A Description says what')
    await expect(asking({ description: null })).rejects.toThrow('A Description says what')
    await expect(asking({ description: 12 })).rejects.toThrow('A Description says what')
  })

  it('refuses one longer than a Description is, and names the limit', async () => {
    await expect(asking({ description: 'w'.repeat(SHOT_DESCRIPTION_MAX_LENGTH + 1) }))
      .rejects.toThrow(`${SHOT_DESCRIPTION_MAX_LENGTH} characters`)
  })
})
