/**
 * Develops the Samples' images into the WebP files beside this, which are what a
 * Sample actually carries — see `samples.ts` for why the bytes are committed
 * rather than developed as the work is written.
 *
 *   node demonstration/images.ts
 *
 * ImageMagick has to be on the path, and Node has to be 22.18 or newer, which is
 * the version that strips the types itself. Running it again develops the same
 * images over the same files: nothing here depends on what was there before.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { SAMPLE_IMAGES, imagePath } from './samples.ts'
import { develop } from './work.ts'

await mkdir(new URL('images/', import.meta.url), { recursive: true })

for (const [name, image] of Object.entries(SAMPLE_IMAGES)) {
  const bytes = await develop(image, 'webp')
  await writeFile(imagePath(name), bytes)
  console.log(`${name}.webp — ${bytes.length} bytes`)
}
