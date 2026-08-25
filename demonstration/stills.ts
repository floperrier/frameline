/**
 * Develops the Leaders' stills into the WebP files beside this, which are what a
 * Leader actually carries — see `leaders.ts` for why the bytes are committed
 * rather than developed as the work is written.
 *
 *   node demonstration/stills.ts
 *
 * ImageMagick has to be on the path, and Node has to be 22.18 or newer, which is
 * the version that strips the types itself. Running it again develops the same
 * stills over the same files: nothing here depends on what was there before.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { LEADER_STILLS, stillPath } from './leaders.ts'
import { develop } from './work.ts'

await mkdir(new URL('stills/', import.meta.url), { recursive: true })

for (const [name, still] of Object.entries(LEADER_STILLS)) {
  const bytes = await develop(still, 'webp')
  await writeFile(stillPath(name), bytes)
  console.log(`${name}.webp — ${bytes.length} bytes`)
}
