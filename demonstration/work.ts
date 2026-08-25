/**
 * What a work written here is, and how a still of one is developed. Two works
 * live in this directory — *Reel Change*, the demonstration, and the Leaders, the
 * short Story an Author is given — and `write.ts` puts either of them into a
 * Frameline instance through the same API the editor uses. One type for both,
 * because a writer that walked two shapes would be two writers.
 *
 * A still is a recipe rather than a photograph, because the work is shot on what
 * this repository can hold and a dark room with one lit thing in it is a still
 * either way. `develop` is where a recipe becomes bytes: for *Reel Change* at the
 * moment it is written, and for a Leader once, into the WebP files beside this —
 * see `stills.ts`, and
 * `docs/adr/0018-a-leader-exists-once-per-language.md` for why they are committed.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { SHOT_IMAGE_MAX_BYTES } from '../shared/utils/scenes.ts'
import type { Condition, Flags } from '../shared/utils/scenes.ts'
import type { StoryLanguage } from '../shared/utils/stories.ts'

const run = promisify(execFile)

/** The size every still is shot at: sixteen by nine, the shape of a gate. */
const FRAME = '1600x900'

/**
 * A shape the light does something to: the colour it comes out, the ImageMagick
 * primitive that draws it, how far the light spreads past its edge, and how much
 * of the still's brightness it is allowed.
 */
export type Lit = { colour: string, draw: string, blur?: number, opacity?: number }

/**
 * One still, as the four things that make it: the ground it is graded from top
 * to bottom, the shapes lit from behind it, the shapes the light lands on, and
 * how much grain the stock carries.
 */
export type Still = {
  ground: [string, string]
  glow?: Lit[]
  form?: Lit[]
  grain?: number
}

/**
 * One Shot of a work: the beat, what the still of it shows for a Reader who
 * cannot see it, the still itself, and the Conditions it plays under. The
 * Description is written here beside the still rather than left to the text,
 * because the text carries the beat and the Description carries the frame.
 *
 * A still is either a recipe, developed as the work is written, or the name of
 * one of the WebP files in `stills/`, developed once and committed. A Shot with
 * neither is a Shot that is text alone, which is a thing a Shot is allowed to be.
 */
export type Shot = {
  text: string
  description?: string
  still?: Still | string
  when?: Condition[]
}

/**
 * A work as a whole. A Scene is placed in the graph by hand, because where a
 * Scene sits is part of reading the Story at a glance; a Cut names the Scenes it
 * joins rather than identifying them, and so does the Condition it is offered
 * under — `write.ts` puts the ids in once the Scenes exist.
 *
 * `language` is the Language the work is written in, English where it says
 * nothing, and never the Locale of whoever reads it. `opening` names the Scene a
 * Reading starts on; saying nothing leaves it the first Scene written, which is
 * what the editor does for an Author.
 */
export type Work = {
  title: string
  language?: StoryLanguage
  opening?: string
  scenes: { name: string, at: [number, number], sets?: Flags, shots: Shot[] }[]
  cuts: { from: string, to: string, text: string, when?: Condition[] }[]
}

/**
 * The still the recipe describes, as the bytes of a JPEG or of a WebP. Three
 * passes over one ImageMagick invocation, in the order light reaches film: what
 * glows is screened onto the ground, because light adds; what the light falls on
 * is laid over it, because a dark shape in front of a lamp has to be able to
 * block it; and the grain and the falloff at the corners go over everything, so
 * one still is graded like the next.
 */
export async function develop(still: Still, format: 'jpg' | 'webp' = 'jpg') {
  const [top, bottom] = still.ground

  const { stdout } = await run('magick', [
    '-size', FRAME, `gradient:${top}-${bottom}`,
    ...(still.glow ?? []).flatMap(lit => layer(lit, 'black', 'screen')),
    ...(still.form ?? []).flatMap(lit => layer(lit, 'none', 'over')),
    '-attenuate', String(still.grain ?? 1), '+noise', 'Gaussian',
    // The corners fall away, the way they do through any real lens, and the whole
    // still comes back a little off full colour: nothing here was ever graded.
    '(', '-size', FRAME, 'radial-gradient:#ffffff-#333333', ')', '-compose', 'multiply', '-composite',
    '-modulate', '100,88',
    '-depth', '8', '-strip', '-quality', '84', `${format}:-`,
  ], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })

  // Grain is the worst thing that can be done to a JPEG, so the one thing a still
  // can get wrong by itself is coming out too heavy for the Shot's own row. Said
  // here rather than found out by a refused PUT halfway through writing the work.
  if (stdout.length > SHOT_IMAGE_MAX_BYTES) {
    throw new Error(`A still developed to ${stdout.length} bytes, past what a Shot may carry`)
  }

  return stdout
}

/** One shape on its own transparent or black sheet, blurred and dimmed, then composited. */
function layer(lit: Lit, over: string, compose: string) {
  return [
    '(', '-size', FRAME, `xc:${over}`,
    '-fill', lit.colour, '-draw', lit.draw,
    '-blur', `0x${lit.blur ?? 4}`,
    ...(lit.opacity === undefined
      ? []
      : ['-alpha', 'set', '-channel', 'A', '-evaluate', 'multiply', String(lit.opacity), '+channel']),
    ')', '-compose', compose, '-composite',
  ]
}
