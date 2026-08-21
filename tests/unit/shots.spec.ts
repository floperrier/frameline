import { describe, expect, it } from 'vitest'
import { imageTypeOf } from '../../shared/utils/shots'

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
