/**
 * Develops the library of Sounds into `public/sounds/`, which is what the picker
 * on the bench offers and what a Sample is heard under.
 *
 *   node demonstration/sounds.ts
 *
 * ffmpeg has to be on the path — `brew install ffmpeg` — and Node has to be 22.18
 * or newer, which is the version that strips the types itself. Running it again
 * develops the same files over the same names: nothing here depends on what was
 * there before.
 *
 * A sound is a recipe rather than a recording, for the reason an image of a
 * Sample is: the product ships what this repository can hold, and a library
 * developed here is CC0 by construction rather than by a licence somebody has to
 * be trusted about — see `shared/utils/library.ts`. A curated CC0 recording drops
 * into the folder and the manifest the day one is wanted; nothing else changes.
 *
 * AAC in an MPEG-4 container, mono, because that is what the product accepts and
 * what an Author is told to bring: Opus is refused for Safari's sake, and MP3 is
 * taken but not shipped.
 */
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { SOUND_LIBRARY } from '../shared/utils/library.ts'

const run = promisify(execFile)

/** Where a library file lives, which the unit test and `write.ts` ask for too. */
export function soundPath(file: string) {
  return new URL(`../public/sounds/${file}`, import.meta.url)
}

/**
 * One sound as the three things that make it: the lavfi source it comes out of,
 * the chain of filters over it, and how loud it is against full scale. A bed runs
 * long and steady, so it carries no fade — a fade is a seam a loop would play
 * every twenty seconds. A strike is an impulse with a decay on it.
 */
type Recipe = { source: string, filters: string[], volume: number, rate: string, loops: boolean }

/**
 * A bed runs on a loop until its Scene is left, so any `tremolo` it carries has
 * to complete a whole number of cycles over the Sound's own `seconds` — anything
 * else ends the file mid-swing, and the loop plays a jump in level every time it
 * restarts. `f × seconds` is checked below as each file is developed, against
 * `loops` rather than every recipe, because a strike never repeats and owes no
 * such arithmetic. A bed that gets it wrong is caught before the bytes are
 * committed rather than found later by ear.
 */
const bed = (source: string, ...filters: string[]): Recipe =>
  ({ source, filters, volume: 0.5, rate: '64k', loops: true })

const strike = (source: string, seconds: number, ...filters: string[]): Recipe =>
  ({
    source,
    filters: [...filters, `afade=t=out:st=0:d=${seconds}:curve=exp`],
    volume: 0.9,
    rate: '96k',
    loops: false,
  })

// A fixed seed, because `anoisesrc` draws a fresh one on every run otherwise —
// the docstring above promises the same bytes over the same names, and a bed
// that redevelops into different noise each time would make that promise false.
const noise = (colour: 'pink' | 'brown' | 'white') =>
  `anoisesrc=color=${colour}:amplitude=0.6:seed=0`
const tone = (hertz: number) => `sine=frequency=${hertz}`

/**
 * A struck bell, as three partials rather than one: a single sine decays into a
 * ding, because a bell's ring is inharmonic — its overtones sit off the pitches a
 * clean harmonic series would put them at. Two more sines above the fundamental,
 * detuned to non-integer ratios and quieter each time, are what a `sine` alone
 * cannot give it.
 */
const chime = (hertz: number) => {
  const partials = [[hertz, 0.55], [hertz * 1.68, 0.25], [hertz * 2.51, 0.12]]
  const expr = partials.map(([f, gain]) => `${gain}*sin(2*PI*${f}*t)`).join('+')
  return `aevalsrc=exprs=${expr}`
}

export const RECIPES: Record<string, Recipe> = {
  'rain.m4a': bed(noise('pink'), 'highpass=f=300', 'lowpass=f=6000'),
  'heavy-rain.m4a': bed(noise('pink'), 'highpass=f=180', 'lowpass=f=9000'),
  'wind.m4a': bed(noise('brown'), 'lowpass=f=1200', 'tremolo=f=0.2:d=0.7'),
  'sea.m4a': bed(noise('brown'), 'lowpass=f=900', 'tremolo=f=0.1:d=0.8'),
  'room-tone.m4a': bed(noise('brown'), 'lowpass=f=400', 'volume=0.4'),
  'traffic.m4a': bed(noise('brown'), 'lowpass=f=700', 'tremolo=f=0.4:d=0.3'),
  'crowd.m4a': bed(noise('pink'), 'bandpass=f=1400:width_type=h:w=1200', 'tremolo=f=4:d=0.4'),
  'fire.m4a': bed(noise('pink'), 'highpass=f=500', 'tremolo=f=9:d=0.6'),
  'forest-night.m4a': bed(noise('pink'), 'highpass=f=3000', 'tremolo=f=7:d=0.8'),
  'machine-hum.m4a': bed(tone(50), 'aecho=0.8:0.6:40:0.5', 'lowpass=f=300'),
  'rails.m4a': bed(noise('brown'), 'lowpass=f=500', 'tremolo=f=2.4:d=0.6'),
  'water.m4a': bed(noise('white'), 'highpass=f=1200', 'lowpass=f=7000'),
  'wires.m4a': bed(tone(220), 'tremolo=f=0.8:d=0.9', 'highpass=f=180'),
  'projector.m4a': bed(noise('brown'), 'lowpass=f=900', 'tremolo=f=24:d=0.7'),
  'door-close.m4a': strike(noise('brown'), 1, 'lowpass=f=800'),
  'door-slam.m4a': strike(noise('brown'), 1, 'lowpass=f=600', 'aecho=0.8:0.5:60:0.3'),
  'latch.m4a': strike(noise('white'), 1, 'highpass=f=2000'),
  'switch.m4a': strike(noise('white'), 1, 'highpass=f=3000'),
  'glass.m4a': strike(tone(1400), 1),
  'bottle.m4a': strike(tone(300), 1, 'lowpass=f=1200'),
  'footstep.m4a': strike(noise('brown'), 1, 'lowpass=f=600'),
  'knock.m4a': strike(noise('brown'), 1, 'lowpass=f=1200'),
  'phone.m4a': strike(tone(1000), 2, 'tremolo=f=20:d=0.9'),
  'clapper.m4a': strike(noise('white'), 1, 'highpass=f=1500', 'aecho=0.8:0.5:30:0.2'),
  'shutter.m4a': strike(noise('white'), 1, 'bandpass=f=4000:width_type=h:w=3000'),
  'thunder.m4a': strike(noise('brown'), 3, 'lowpass=f=300'),
  'paper.m4a': strike(noise('white'), 1, 'highpass=f=4000', 'tremolo=f=30:d=0.5'),
  'coin.m4a': strike(tone(2600), 1),
  'engine.m4a': strike(noise('brown'), 2, 'lowpass=f=400', 'tremolo=f=8:d=0.7'),
  'bell.m4a': strike(chime(880), 3, 'aecho=0.8:0.7:120:0.5'),
}

// The recipes are read by the suite that holds the manifest against the folder,
// so developing the library happens only when this file is what was run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mkdir(new URL('../public/sounds/', import.meta.url), { recursive: true })

  for (const sound of SOUND_LIBRARY) {
    const recipe = RECIPES[sound.file]
    if (!recipe) throw new Error(`No recipe develops ${sound.file}`)

    const tremolo = recipe.loops && recipe.filters.find(filter => filter.startsWith('tremolo=f='))
    if (tremolo) {
      const hertz = Number(tremolo.slice('tremolo=f='.length).split(':')[0])
      const cycles = hertz * sound.seconds
      if (Math.abs(cycles - Math.round(cycles)) > 1e-6) {
        throw new Error(
          `${sound.file}: tremolo at ${hertz} Hz does not complete a whole cycle `
          + `over ${sound.seconds}s (${cycles} cycles) — the loop would show a seam`,
        )
      }
    }

    await run('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `${recipe.source}:duration=${sound.seconds}:sample_rate=44100`,
      '-af', [...recipe.filters, `volume=${recipe.volume}`].join(','),
      '-ac', '1',
      '-c:a', 'aac',
      '-b:a', recipe.rate,
      // The header goes at the front, so a browser knows the length before the
      // last byte arrives — the endpoint serves no `Range` request.
      '-movflags', '+faststart',
      soundPath(sound.file).pathname,
    ])

    process.stdout.write('.')
  }

  console.log(`\n${SOUND_LIBRARY.length} Sounds developed into public/sounds/`)
}
