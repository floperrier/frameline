import { describe, expect, it } from 'vitest'
import {
  carriesSound,
  heardUnder,
  heldAcross,
  soundCarriers,
  soundTypeOf,
} from '../../shared/utils/sound.ts'
import type { Carrying } from '../../shared/utils/sound.ts'

/**
 * What a Sound is, and which one a Scene is actually heard under. Both are read
 * by the server, by the bench and by the reading, so both are stated here once
 * against literals: no database, no browser, no engine.
 */

/** The first bytes of one file of each kind a Sound may be, and of some it may not. */
const heads = {
  // `ftyp` four bytes in, then the brand: the three an AAC file is written with.
  m4a: [0, 0, 0, 0x20, ...text('ftypM4A '), 0, 0, 2, 0],
  mp42: [0, 0, 0, 0x18, ...text('ftypmp42')],
  isom: [0, 0, 0, 0x18, ...text('ftypisom')],
  id3: [...text('ID3'), 3, 0, 0, 0, 0, 0, 0x23],
  frame: [0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00],
  // Opus in an Ogg container, which Safari cannot play and this refuses.
  ogg: [...text('OggS'), 0, 2, 0, 0, 0, 0],
  wave: [...text('RIFF'), 0x1A, 0, 0, 0, ...text('WAVE')],
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
}

function text(written: string) {
  return [...written].map(letter => letter.charCodeAt(0))
}

const bytes = (of: keyof typeof heads) => Uint8Array.from(heads[of])

/** A Scene as the rule reads it: its own bytes, or the Scene it takes them from. */
function scene(id: string, held: Partial<Carrying> = {}): Carrying {
  return { id, sound: null, soundOfSceneId: null, transcript: '', soundLoops: true, ...held }
}

describe('what a Sound really is', () => {
  it('reads AAC in an MPEG-4 container, whichever brand it was written with', () => {
    expect(soundTypeOf(bytes('m4a'))).toBe('audio/mp4')
    expect(soundTypeOf(bytes('mp42'))).toBe('audio/mp4')
    expect(soundTypeOf(bytes('isom'))).toBe('audio/mp4')
  })

  it('reads an MP3 with a tag in front of it and one without', () => {
    expect(soundTypeOf(bytes('id3'))).toBe('audio/mpeg')
    expect(soundTypeOf(bytes('frame'))).toBe('audio/mpeg')
  })

  it('refuses Opus, and everything else, whatever the upload called it', () => {
    for (const other of ['ogg', 'wave', 'png'] as const) {
      expect(soundTypeOf(bytes(other))).toBeUndefined()
    }
  })

  it('recognises nothing in a file too short to say what it is', () => {
    expect(soundTypeOf(new Uint8Array())).toBeUndefined()
    expect(soundTypeOf(bytes('m4a').slice(0, 9))).toBeUndefined()
    expect(soundTypeOf(bytes('id3').slice(0, 2))).toBeUndefined()
    expect(soundTypeOf(Uint8Array.from([0xFF]))).toBeUndefined()
  })
})

describe('the Sound a Scene is heard under', () => {
  const carrier = scene('rain', { sound: '/api/scenes/rain/sound', transcript: 'Rain', soundLoops: false })
  const namer = scene('bar', { soundOfSceneId: 'rain' })
  const silent = scene('street')

  it('is the Scene’s own, with the Transcript and the loop of the row carrying it', () => {
    expect(heardUnder([carrier], 'rain')).toEqual({
      carrier: 'rain',
      sound: '/api/scenes/rain/sound',
      transcript: 'Rain',
      loops: false,
    })
  })

  it('is the named Scene’s, entire, where the Scene carries none of its own', () => {
    expect(heardUnder([carrier, namer], 'bar')).toEqual({
      carrier: 'rain',
      sound: '/api/scenes/rain/sound',
      transcript: 'Rain',
      loops: false,
    })
  })

  it('is nothing where the Scene carries none and names none', () => {
    expect(heardUnder([carrier, silent], 'street')).toBeUndefined()
    expect(heardUnder([carrier], null)).toBeUndefined()
    expect(heardUnder([carrier], 'nowhere')).toBeUndefined()
  })

  it('is nothing where the Scene named is itself naming: one hop and no further', () => {
    const second = scene('alley', { soundOfSceneId: 'bar' })

    expect(heardUnder([carrier, namer, second], 'alley')).toBeUndefined()
  })

  it('is nothing where the Scene named has gone from under it', () => {
    expect(heardUnder([namer], 'bar')).toBeUndefined()
  })
})

describe('whether the Sound goes on across the cut', () => {
  const carrier = scene('rain', { sound: '/api/scenes/rain/sound' })
  const other = scene('sea', { sound: '/api/scenes/sea/sound' })
  const namer = scene('bar', { soundOfSceneId: 'rain' })
  const second = scene('alley', { soundOfSceneId: 'rain' })
  const silent = scene('street')
  const scenes = [carrier, other, namer, second, silent]
  const across = (from: string, to: string) =>
    heldAcross(heardUnder(scenes, from), heardUnder(scenes, to))

  it('goes on where both name the same Scene', () => {
    expect(across('bar', 'alley')).toBe(true)
  })

  it('goes on where one carries it and the other names it, either way round', () => {
    expect(across('rain', 'bar')).toBe(true)
    expect(across('bar', 'rain')).toBe(true)
  })

  it('stops where each carries its own', () => {
    expect(across('rain', 'sea')).toBe(false)
  })

  it('stops where the Scene arrived at is silent, and where the one left was', () => {
    expect(across('rain', 'street')).toBe(false)
    expect(across('street', 'rain')).toBe(false)
  })
})

describe('what the Story carries', () => {
  const shots = (sound: string | null = null) => [{ sound }]

  it('offers the Scenes carrying bytes, and never the ones naming them', () => {
    const scenes = [
      scene('rain', { sound: '/api/scenes/rain/sound' }),
      scene('bar', { soundOfSceneId: 'rain' }),
    ]

    expect(soundCarriers(scenes).map(scene => scene.id)).toEqual(['rain'])
  })

  it('says a Story carries a Sound where one Scene is heard under something', () => {
    expect(carriesSound({
      scenes: [{ ...scene('rain', { sound: '/s' }), shots: shots() }],
    })).toBe(true)
  })

  it('says so where one Shot strikes, and the Scenes are all silent', () => {
    expect(carriesSound({
      scenes: [{ ...scene('street'), shots: shots('/api/shots/one/sound') }],
    })).toBe(true)
  })

  it('says a Story naming a Scene that carries nothing is silent', () => {
    expect(carriesSound({
      scenes: [
        { ...scene('street'), shots: shots() },
        { ...scene('bar', { soundOfSceneId: 'street' }), shots: shots() },
      ],
    })).toBe(false)
  })
})
