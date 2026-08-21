/**
 * The still formats a Shot may carry, and the most one image may weigh. Shared
 * so the file picker offers exactly what the server will take. An animated GIF
 * is left out on purpose: a Shot is one still image and its text, so a moving
 * one would be a beat that plays itself.
 *
 * Two megabytes is a photograph, not a master: it is enough for a frame at
 * screen size and small enough that the bytes can sit in the Shot's own row.
 */
export const SHOT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const SHOT_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const SHOT_IMAGE_MAX_MB = SHOT_IMAGE_MAX_BYTES / 1024 / 1024

/**
 * What an image really is, read from its first bytes rather than from what the
 * upload said it was. The content type of an upload is the client's to write,
 * and the bytes are served back under whatever type we believe, so trusting it
 * would let a Shot serve one thing under the name of another. A head none of the
 * three formats owns is what "rejects anything else" refuses.
 */
export function imageTypeOf(bytes: Uint8Array) {
  const has = (offset: number, ...head: number[]) =>
    head.every((byte, at) => bytes[offset + at] === byte)

  if (has(0, 0xFF, 0xD8, 0xFF)) return 'image/jpeg'
  if (has(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return 'image/png'
  // A WebP is a RIFF container, and the form name that makes it one sits four
  // bytes past the length that follows the tag.
  if (has(0, 0x52, 0x49, 0x46, 0x46) && has(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'

  return undefined
}

/**
 * Where a Shot's image is served. The bytes never travel with the Story — a
 * Story of fifty Shots would be fifty images in one response — so what the
 * Story carries is this address, and null for a Shot that has no image.
 */
export function shotImageUrl(shotId: string) {
  return `/api/shots/${shotId}/image`
}
