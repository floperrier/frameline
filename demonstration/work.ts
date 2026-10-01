/**
 * What a work written here is, and how an image of one is developed. Two works
 * live in this directory — *Reel Change*, the demonstration, and the Samples, the
 * short Story an Author is given — and `write.ts` puts either of them into a
 * Frameline instance through the same API the editor uses. One type for both,
 * because a writer that walked two shapes would be two writers.
 *
 * An image is a recipe rather than a photograph, because the work is shot on what
 * this repository can hold and a dark room with one lit thing in it is an image
 * either way. `develop` is where a recipe becomes bytes: for *Reel Change* at the
 * moment it is written, and for a Sample once, into the WebP files beside this —
 * see `images.ts`, and
 * `docs/adr/0018-a-leader-exists-once-per-language.md` for why they are committed.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { SHOT_IMAGE_MAX_BYTES } from '../shared/utils/scenes.ts'
import type {
  Arrival, Condition, CutThrough, Flags, Lasting, Layout, MovementDirection, TextBy,
} from '../shared/utils/scenes.ts'
import { textOf } from '../shared/utils/formatted.ts'
import type { Formatted } from '../shared/utils/formatted.ts'
import type { StoryLanguage } from '../shared/utils/stories.ts'

const run = promisify(execFile)

/** The size every image is shot at: sixteen by nine, the shape of a gate. */
const FRAME = '1600x900'

/**
 * A shape the light does something to: the colour it comes out, the ImageMagick
 * primitive that draws it, how far the light spreads past its edge, and how much
 * of the image's brightness it is allowed.
 */
export type Lit = { colour: string, draw: string, blur?: number, opacity?: number }

/**
 * One image, as the four things that make it: the ground it is graded from top
 * to bottom, the shapes lit from behind it, the shapes the light lands on, and
 * how much grain the stock carries.
 */
export type Image = {
  ground: [string, string]
  glow?: Lit[]
  form?: Lit[]
  grain?: number
}

/** A Shot's words with the formatting set aside, whichever way it is written. */
export const wordsOf = (shot: Shot) => shot.formatted ? textOf(shot.formatted) : shot.text

/** A Condition as a work writes it: a Scene by its name, an Exit by the Scene it leaves and its Place there. */
export type WorkCondition =
  | Exclude<Condition, { exit: string }>
  | { exit: { from: string, place: number }, taken: boolean }

/**
 * One Shot of a work: the beat, what the image of it shows for a Reader who
 * cannot see it, the image itself, and the Conditions it plays under. The
 * Description is written here beside the image rather than left to the text,
 * because the text carries the beat and the Description carries the frame.
 *
 * An image is either a recipe, developed as the work is written, or the name of
 * one of the WebP files in `images/`, developed once and committed. A Shot with
 * neither is a Shot that is text alone, which is a thing a Shot is allowed to be.
 */
export type Shot = ({ text: string, formatted?: never } | { formatted: Formatted, text?: never }) & {
  description?: string
  image?: Image | string
  when?: WorkCondition[]
  /**
   * The Sound the beat strikes with, named as one of the library's own files —
   * `shared/utils/library.ts`. A work carries no bytes of its own: the library is
   * committed once, and `write.ts` deposits the file through the API like any
   * other upload.
   */
  sound?: string
  /** What that Sound makes heard, in the language the work is written in. */
  transcript?: string
  /**
   * This Shot's own answer about how it leaves the screen, where it answers at
   * all: saying nothing is *as the Scene says*, a `cutAfter` of nought is *held
   * until the press*, and a `cutOver` of nought is a hard cut, under which
   * `cutThrough` says nothing. See
   * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
   */
  cutAfter?: number
  cutOver?: number
  cutThrough?: CutThrough
  /**
   * How this Shot is laid out where it answers for itself, and the point its
   * Image is cropped around, in whole percent across and down. Saying nothing is
   * *as the Scene says* and the centre, which is what the columns default to. See
   * `docs/adr/0055-a-shot-is-laid-out-as-its-scene-says.md`.
   */
  layout?: Layout
  cropX?: number
  cropY?: number
  /**
   * This Shot's own answer about how its Image moves, where it answers at all:
   * saying nothing is *as the Scene says*, a `movementBy` of nought is this Image
   * held still, and a `movementOver` of nought is as long as the Shot is on
   * screen. See `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
   */
  movementBy?: number
  movementDirection?: MovementDirection
  movementOver?: number
  /**
   * What the Image and the text play as the beat arrives and while it stands;
   * saying nothing is none. See the `Effect` of `CONTEXT.md`.
   */
  imageArrives?: Arrival
  imageLasts?: Lasting
  textArrives?: Arrival
  textLasts?: Lasting
  /**
   * This Shot's own answer about how its text arrives, where it answers at all:
   * saying nothing is *as the Scene says*, and a `textStays` of nought is *until
   * the Cut*. See `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
   */
  textAfter?: number
  textBy?: TextBy
  textPace?: number
  textOver?: number
  textStays?: number
}

/**
 * A work as a whole. Nothing here says where a Scene is drawn: the Graph is laid
 * out from the Story and from nothing else — see
 * `docs/adr/0041-the-graph-is-drawn-from-the-story.md` — so a coordinate written
 * here would have nowhere to go. An Exit names the Scenes it joins rather than
 * identifying them, and so does the Condition it is offered under. An Exit has no
 * name, so a Condition names one by the Scene it leaves and its Place there,
 * counted from 1 in the order the work writes that Scene's Exits: the work is
 * written before any id exists, and nothing renumbers it. The writers put the
 * ids in once the Scenes and the Exits exist.
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
  scenes: {
    name: string
    sets?: Flags
    shots: Shot[]
    /** The Sound the Scene is heard under, named as one of the library's files. */
    sound?: string
    transcript?: string
    /** How the Shots of this Scene's run are laid out; saying nothing is `inset`. */
    layout?: Layout
    /**
     * How the Images of this Scene's run move. Saying nothing is every work
     * before this one, each Image held still, which is a `movementBy` of nought;
     * a `movementOver` of nought is as long as each Shot is on screen.
     */
    movementBy?: number
    movementDirection?: MovementDirection
    movementOver?: number
    /**
     * How the Shots of this Scene's run are cut, and how long its ways on
     * stand. Saying nothing is the run every work here was written as before
     * the Cut existed: each beat held until the press, cut hard, with the ways
     * on standing until one is taken. `exitsAfter` of nought is the Scene
     * flowing into the next without asking; a Scene's `cutAfter` is refused it,
     * because a Scene has no *as the Scene says* to fall back to.
     *
     * Three states each, and three spellings: a number, nought, or the field
     * left out. Null is not a fourth — it is what the column already holds
     * where the work says nothing, so a work that wrote it would be saying the
     * same thing twice.
     */
    cutAfter?: number
    cutOver?: number
    cutThrough?: CutThrough
    exitsAfter?: number
    /**
     * How the texts of this Scene's run arrive. Saying nothing is every work
     * before this one: each text landing with its Image, whole and at once, and
     * staying until the Cut. A Scene's `textStays` is refused nought, because a
     * Scene has no *as the Scene says* to fall back to.
     */
    textAfter?: number
    textBy?: TextBy
    textPace?: number
    textOver?: number
    textStays?: number
  }[]
  /**
   * An Exit's own Cut is how the passage it makes is made, never when: an Exit
   * is taken rather than held, and there is no Scene above it to say otherwise.
   */
  exits: {
    from: string
    to: string
    text: string
    when?: WorkCondition[]
    cutOver?: number
    cutThrough?: CutThrough
  }[]
}

/**
 * The image the recipe describes, as the bytes of a JPEG or of a WebP. Three
 * passes over one ImageMagick invocation, in the order light reaches film: what
 * glows is screened onto the ground, because light adds; what the light falls on
 * is laid over it, because a dark shape in front of a lamp has to be able to
 * block it; and the grain and the falloff at the corners go over everything, so
 * one image is graded like the next.
 */
export async function develop(image: Image, format: 'jpg' | 'webp' = 'jpg') {
  const [top, bottom] = image.ground

  const { stdout } = await run('magick', [
    '-size', FRAME, `gradient:${top}-${bottom}`,
    ...(image.glow ?? []).flatMap(lit => layer(lit, 'black', 'screen')),
    ...(image.form ?? []).flatMap(lit => layer(lit, 'none', 'over')),
    '-attenuate', String(image.grain ?? 1), '+noise', 'Gaussian',
    // The corners fall away, the way they do through any real lens, and the whole
    // image comes back a little off full colour: nothing here was ever graded.
    '(', '-size', FRAME, 'radial-gradient:#ffffff-#333333', ')', '-compose', 'multiply', '-composite',
    '-modulate', '100,88',
    '-depth', '8', '-strip', '-quality', '84', `${format}:-`,
  ], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })

  // Grain is the worst thing that can be done to a JPEG, so the one thing an image
  // can get wrong by itself is coming out too heavy for the Shot's own row. Said
  // here rather than found out by a refused PUT halfway through writing the work.
  if (stdout.length > SHOT_IMAGE_MAX_BYTES) {
    throw new Error(`An image developed to ${stdout.length} bytes, past what a Shot may carry`)
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
