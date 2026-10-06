import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SOUND_LIBRARY, libraryUrl } from '../../shared/utils/library.ts'
import { RECIPES, soundPath } from '../../demonstration/sounds.ts'
import { SOUND_MAX_BYTES, soundTypeOf } from '../../shared/utils/sound.ts'

/**
 * The library held against the folder it is a manifest of. A sound an Author
 * picks is fetched from that folder and deposited through the same PUT an upload
 * goes through, so a row naming a file that is not there is a picker that refuses
 * itself, and a file nobody listed is bytes committed for nothing.
 */
const committed = readdirSync(new URL('../../public/sounds/', import.meta.url))
  .filter(file => !file.startsWith('.'))

describe('the library of Sounds', () => {
  it('lists every file that is there, and nothing that is not', () => {
    expect(SOUND_LIBRARY.map(sound => sound.file).sort()).toEqual([...committed].sort())
  })

  it('names each one in both Locales, and says how long it runs', () => {
    for (const sound of SOUND_LIBRARY) {
      expect([sound.file, sound.label.en.trim(), sound.label.fr.trim()])
        .not.toContain('')
      expect(sound.seconds).toBeGreaterThan(0)
    }
  })

  it('says where each one came from, and carries no licence but CC0', () => {
    for (const sound of SOUND_LIBRARY) {
      expect(sound.provenance.trim()).not.toBe('')
      // Never CC-BY: an attribution redistributed inside every published Story of
      // every Author is an obligation the product cannot keep on their behalf.
      expect(sound.licence).toBe('CC0')
    }
  })

  it('holds each one under what a Scene may carry', () => {
    for (const sound of SOUND_LIBRARY) {
      expect(statSync(soundPath(sound.file)).size).toBeLessThanOrEqual(SOUND_MAX_BYTES)
    }
  })

  // The one thing every file here has to be: a Sound the product actually
  // accepts. Read from disk rather than trusted from generation time, because a
  // recipe that stops writing AAC in an MPEG-4 container is a picker offering an
  // Author a press that the server's own PUT would refuse.
  it('is a Sound the server accepts, read from its own first bytes', () => {
    for (const sound of SOUND_LIBRARY) {
      expect(soundTypeOf(readFileSync(soundPath(sound.file)))).toBe('audio/mp4')
    }
  })

  it('has a recipe for every file, so the folder can always be developed again', () => {
    expect(Object.keys(RECIPES).sort()).toEqual(SOUND_LIBRARY.map(sound => sound.file).sort())
  })

  it('is served from the folder the browser reaches by name', () => {
    expect(libraryUrl('rain.m4a')).toBe('/sounds/rain.m4a')
    expect(existsSync(soundPath('rain.m4a'))).toBe(true)
  })
})
