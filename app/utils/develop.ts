import { SHOT_IMAGE_MAX_BYTES, imageTaken } from '#shared/utils/scenes'

/**
 * A file as the Image a Shot is sent with. What a Reading needs is a picture at
 * the size it shows, and `SHOT_IMAGE_MAX_BYTES` is that size's weight; what an
 * Author has to hand is a phone's photograph, a camera's, a screenshot saved as
 * PNG. So the bench meets the rule itself rather than refusing them: what
 * `imageTaken` says is developed is decoded, its orientation applied so a phone
 * photograph is not turned on its side, and encoded again at the size a Reading
 * shows. Anything else is handed back as it is — a light file byte for byte, and
 * one of a type a Shot does not carry too, so the server says what an image is.
 *
 * The ladder, each rung tried only where the one before is still too heavy: a
 * long side of 2560 px at quality 0.85, which is full screen on a 1440p display
 * and puts a photograph well inside the weight; then quality 0.7; then 1920 px.
 * Never enlarged. What is past the last rung is `refusals.imageHeavy`, and what
 * the browser cannot draw — a HEIC in a browser that does not read one — is
 * `editor.imageUnreadable`, both said by the bench in the Author's language.
 */
export async function developImage(file: File): Promise<File | 'editor.imageUnreadable' | 'refusals.imageHeavy'> {
  if (imageTaken(file) !== 'developed') return file

  const drawn = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => undefined)
  if (!drawn) return 'editor.imageUnreadable'

  try {
    for (const [side, quality] of LADDER) {
      const encoded = await encode(drawn, side, quality)
      if (encoded.size > SHOT_IMAGE_MAX_BYTES) continue

      const extension = encoded.type === 'image/webp' ? '.webp' : '.jpg'
      return new File([encoded], file.name.replace(/(\.[^.]*)?$/, extension), { type: encoded.type })
    }
    return 'refusals.imageHeavy'
  }
  finally {
    drawn.close()
  }
}

/** The long side and the quality of each rung, in the order they are tried. */
const LADDER = [[2560, 0.85], [2560, 0.7], [1920, 0.7]] as const

/**
 * One rung: the picture scaled down to the long side and encoded as WebP. A
 * browser that cannot write WebP hands back a PNG instead, which is read off the
 * blob it gives rather than off which browser it is; there the same pixels are
 * encoded as JPEG, laid on black first — JPEG has no transparency, and black is
 * the colour a frame is drawn on.
 */
async function encode(drawn: ImageBitmap, side: number, quality: number) {
  const scale = Math.min(1, side / Math.max(drawn.width, drawn.height))
  const canvas = new OffscreenCanvas(Math.round(drawn.width * scale), Math.round(drawn.height * scale))
  const context = canvas.getContext('2d')!
  context.drawImage(drawn, 0, 0, canvas.width, canvas.height)

  const webp = await canvas.convertToBlob({ type: 'image/webp', quality })
  if (webp.type === 'image/webp') return webp

  context.globalCompositeOperation = 'destination-over'
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
}
