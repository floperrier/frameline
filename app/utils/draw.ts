/**
 * The renderer a Shot's formatted text is read with — issue #359. It builds
 * VNodes and never a string of markup: every word an Author wrote is a text node,
 * and every attribute it writes is a class from an enumeration, a `lang` from
 * `STORY_LANGUAGES` or a bar's length as a number, so nothing an Author typed is
 * ever read as markup. It is pure, so the server draws it and the browser
 * hydrates the same tree, and it carries no editor: the Reader's page bundles
 * none of the bench's.
 *
 * `STYLES` and `BLOCKS` say how each type is drawn, and the bench's editor builds
 * its schema from the same two tables, so a Shot drawn here and the editor that
 * replaces it on the bench cannot differ.
 */
import { h } from 'vue'
import type { VNode, VNodeArrayChildren } from 'vue'
// Through the alias and not a relative path: the server build leaves `shared/`
// for Nitro to bundle, and writes a module nothing else in the chunk imports at
// the relative path it was imported by, which from the build's own directory is
// a path that does not exist.
import { BY_LETTER, graphemes, leafOf, lettersIn, linesOf } from '#shared/utils/formatted'
import type { Align, Face, Formatted, Inline, Line, Redaction, Style } from '#shared/utils/formatted'
import { pieces } from '#shared/utils/reading'
import type { Arrival, Lasting, Strength, TextBy } from '#shared/utils/scenes'

/** An element, and the attributes a value becomes on it. */
type Drawn = [tag: string, attrs: Record<string, string>]

type AttrsOf<K extends Style['type']> = Extract<Style, { type: K }> extends { attrs: infer A } ? A : undefined

/**
 * How each style is drawn: the element, and the class or attribute its value
 * becomes. Read by the renderer and by the editor's schema, so the two cannot
 * differ.
 */
export const STYLES: { [K in Style['type']]: (attrs: AttrsOf<K>) => Drawn } = {
  emphasis: () => ['em', {}],
  strong: () => ['strong', {}],
  underline: () => ['u', {}],
  strike: () => ['s', {}],
  smallCaps: () => ['span', { class: 'small-caps' }],
  script: ({ place }) => [place === 'super' ? 'sup' : 'sub', {}],
  size: ({ step }) => ['span', { class: `size-${step}` }],
  face: ({ face }) => ['span', { class: `face-${face}` }],
  colour: ({ ink, band }) => ['span', { class: band ? `ink-${ink} band` : `ink-${ink}` }],
  spacing: ({ step }) => ['span', { class: `spacing-${step}` }],
  language: ({ lang }) => ['span', { lang }],
  // A run carrying an Effect is drawn under a dotted line wherever it is written,
  // and moves only in the Reading, which draws it through `moving` below.
  arrives: () => ['span', { class: 'run' }],
  lasts: () => ['span', { class: 'run' }],
}

/**
 * How each block is drawn in the editor and the reading alike. The renderer's
 * quote also wraps its lines in a `blockquote`, which the editor cannot hold
 * beside the source it edits in the same node, and which the stylesheet lays out
 * as if it were not there.
 *
 * A line that says where it stands says so even where it says `start`: null is
 * *as the Story is set*, and a Story set centred, or a card, centres every line
 * that says nothing.
 */
export const BLOCKS = {
  line: (attrs?: Line['attrs']): Drawn => {
    const set = [
      attrs?.align ? `align-${attrs.align}` : '',
      attrs?.leading ? `leading-${attrs.leading}` : '',
    ].filter(Boolean).join(' ')
    return ['p', set ? { class: set } : {}]
  },
  quote: (): Drawn => ['figure', { class: 'quote' }],
  source: (): Drawn => ['figcaption', { class: 'source' }],
  speech: (): Drawn => ['div', { class: 'speech' }],
  speaker: (): Drawn => ['p', { class: 'speaker' }],
  verse: (): Drawn => ['div', { class: 'verse' }],
  separator: (): Drawn => ['hr', {}],
  redaction: ({ length }: Redaction['attrs']): Drawn =>
    ['span', { class: 'bar', 'data-length': String(length) }],
}

const draw = ([tag, attrs]: Drawn, children?: VNodeArrayChildren) => h(tag, attrs, children)

const styledOf = (style: Style) =>
  (STYLES[style.type] as (attrs: unknown) => Drawn)('attrs' in style ? style.attrs : undefined)

/**
 * How a text arriving in its own time is cut: by the unit, and the attributes of
 * a piece whose unit starts after the first character, which arrives with the
 * caption and is not faded twice.
 */
export type TextCut = {
  by: Exclude<TextBy, 'whole'>
  unit: (from: number) => Record<string, unknown>
}

/** What the Reading draws an Effect's element with: `Reading.vue`'s `drawnAs`. */
export type Moving = (effect: Arrival | Lasting) => Record<string, unknown>

const BY_WORD: readonly string[] = ['shake', 'pulse']

/**
 * How far a run is taken apart for its Effect: an opacity or a filter reaches its
 * inline element, a transform reaches only an atomic box, so a jolt or a pulse
 * takes it apart into words, and what moves letter by letter into letters.
 */
export function apartBy(effect: string): 'run' | 'word' | 'letter' {
  return BY_LETTER.includes(effect) ? 'letter' : BY_WORD.includes(effect) ? 'word' : 'run'
}

const isRunEffect = (style: Style) => style.type === 'arrives' || style.type === 'lasts'

/** The word joiner, which holds a run taken apart to the rest of a word it starts or ends inside. */
const JOINER = '\u2060'

/** The Effect a run's mark of one type carries, where it carries one. */
const effectOf = <K extends 'arrives' | 'lasts'>(inline: Inline, type: K) => inline.type === 'text'
  ? (inline.marks?.find(mark => mark.type === type) as { attrs: AttrsOf<K> } | undefined)?.attrs
  : undefined

/** Whether a leaf is under an Effect that takes it apart into words or letters. */
const apartAt = (inline: Inline) => [effectOf(inline, 'arrives'), effectOf(inline, 'lasts')]
  .some(effect => effect && apartBy(effect.effect) !== 'run')

/** Whether any run of a text is taken apart, which the Reading draws twice, as it draws a text cut into units. */
export function takesApart(formatted: Formatted) {
  return linesOf(formatted).flat().some(apartAt)
}

/** The two Effects a leaf is under, as one value two leaves can be compared by. */
const effectsOf = (inline: Inline) =>
  JSON.stringify([effectOf(inline, 'arrives') ?? null, effectOf(inline, 'lasts') ?? null])

const POOLS = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789']
const STAND_INS: Record<Strength, number> = { slight: 1, marked: 2, strong: 3 }

/**
 * The letters a scramble lays over one of its own before showing it: one, two or
 * three, of its case, chosen by the letter and its Place in the run rather than at
 * random, so the server and the browser draw the same ones. Punctuation has none.
 */
export function standInsOf(letter: string, place: number, strength: Strength) {
  if (!/[\p{L}\p{N}]/u.test(letter)) return []
  const pool = /\p{N}/u.test(letter) ? POOLS[2]! : letter !== letter.toLowerCase() ? POOLS[1]! : POOLS[0]!
  const seed = letter.codePointAt(0)! + place * 7
  return Array.from({ length: STAND_INS[strength] }, (_, k) => {
    const at = (seed + k * 11) % pool.length
    return pool[at] === letter ? pool[(at + 1) % pool.length]! : pool[at]!
  })
}

/** Where one leaf stands in the run its mark of one type belongs to: the letters before it, and the run's own count. */
type InRun = { before: number, run: { letters: number } }

/** Every leaf's place in its run, in the order `drawFormatted` draws them. A run never crosses a line. */
function runsOf(formatted: Formatted, type: 'arrives' | 'lasts') {
  const placed: (InRun | undefined)[] = []
  for (const inlines of linesOf(formatted)) {
    let run: InRun['run'] | undefined
    let said = ''
    for (const inline of inlines) {
      const effect = effectOf(inline, type)
      if (!effect) {
        run = undefined
        placed.push(undefined)
        continue
      }
      const now = JSON.stringify(effect)
      if (!run || now !== said) [run, said] = [{ letters: 0 }, now]
      placed.push({ before: run.letters, run })
      run.letters += lettersIn(leafOf(inline))
    }
  }
  return placed
}

/** A run's own element: the Effect itself where it reaches an inline box, a root its pieces read their time off where it does not. */
function runOf(effect: Arrival | Lasting, inner: VNodeArrayChildren, moving: Moving) {
  if (apartBy(effect.effect) === 'run') return h('span', { class: 'effect', ...moving(effect) }, inner)
  return h('span', { class: 'over' in effect ? 'apart apart-arrives' : 'apart', style: moving(effect).style }, inner)
}

/**
 * How a leaf's words are taken apart for its run's Effects: unchanged where neither
 * takes it apart; otherwise every space a gap the line may break at, every word a
 * box where a jolt or a pulse moves words, and every letter a box where a scramble,
 * a wave or a tremor moves letters. Called once per piece of the leaf, in order, so
 * the letters are counted through the whole leaf.
 */
function apartOf(arrival: Arrival | undefined, lasting: Lasting | undefined,
  arrivalAt: InRun | undefined, lastingAt: InRun | undefined, moving: Moving | undefined) {
  const levels = [arrival, lasting].map(effect => effect && apartBy(effect.effect))
  if (!moving || !levels.some(level => level === 'word' || level === 'letter')) {
    return (text: string): VNodeArrayChildren => [text]
  }
  const byLetter = levels.includes('letter')
  let letters = 0

  const letterOf = (letter: string) => {
    const own = letters++
    let inner: VNodeArrayChildren = [letter]
    if (arrival?.effect === 'scramble' && arrivalAt) {
      const place = arrivalAt.before + own
      const stands = standInsOf(letter, place, arrival.strength)
      if (stands.length) {
        const step = (place + 1) / arrivalAt.run.letters
        const drawn = moving(arrival)
        inner = [
          h('span', { class: 'glyph', ...drawn, style: { '--step': step } }, letter),
          ...stands.map((stand, k) => h('span', {
            class: 'stand-in', ...drawn, style: { '--step': step, '--k': k, '--of': stands.length },
          }, stand)),
        ]
      }
    }
    if (lasting && apartBy(lasting.effect) === 'letter' && lastingAt) {
      const place = lastingAt.before + own
      const phase = (lasting.effect === 'wave' ? place % 12 : (place * 5) % 12) / 12
      return h('span', { class: 'letter', ...moving(lasting), style: { '--phase': phase } }, inner)
    }
    return h('span', { class: 'letter' }, inner)
  }

  // A word taken apart into letters and moved by no Effect of its own is its
  // letters, which the run's `white-space` keeps on one line.
  return (text: string): VNodeArrayChildren => text.split(/(\s+)/u).filter(Boolean).flatMap((chunk) => {
    if (/^\s+$/u.test(chunk)) return [h('span', { class: 'gap' }, chunk)]
    let inner: VNodeArrayChildren = byLetter ? graphemes(chunk).map(letterOf) : [chunk]
    for (const effect of [lasting, arrival]) {
      if (effect && apartBy(effect.effect) === 'word') inner = [h('span', { class: 'word', ...moving(effect) }, inner)]
    }
    return inner
  })
}

/**
 * Every word a text node, every attribute from an enumeration. Where `cut` is
 * given, each run's words are cut into units over the leaves `textOf` joins, a
 * line break a leaf of its own between two lines, so the edges are those the
 * bench reckons on the plain words, and a unit never crosses a line. A bar is one
 * piece, arriving whole when the last character it stands for would have, which
 * is when a text ending on one has arrived.
 *
 * `moving` is what the Reading draws a run's Effect with, and only the Reading
 * passes it. Given, each run carrying an Effect is drawn on its own element, its
 * words or its letters, as its Effect needs, once around however many leaves it
 * spans, outside their styles and with #358's units inside them; without it, a
 * run is drawn by `STYLES`, and never moves.
 */
export function drawFormatted(formatted: Formatted, cut?: TextCut, moving?: Moving): VNode[] {
  const leaves = linesOf(formatted).flatMap((inlines, at) => [...at ? ['\n'] : [], ...inlines.map(leafOf)])
  // A run never holds a line break — the boundary refuses one — so the leaves
  // that are one are the breaks between lines, which draw nothing.
  const cutUp = cut && pieces(leaves, cut.by).filter((_, at) => leaves[at] !== '\n')
  const arrivalsAt = moving && runsOf(formatted, 'arrives')
  const lastingsAt = moving && runsOf(formatted, 'lasts')
  let next = 0

  const piece = (children: VNodeArrayChildren, from: number | null): VNodeArrayChildren =>
    from ? [h('span', cut!.unit(from), children)] : children

  function inline(leaf: Inline): VNodeArrayChildren {
    const at = next++
    const cuts = cutUp?.[at]
    if (leaf.type === 'redaction') {
      const { length, hides } = leaf.attrs
      const drawn = draw(BLOCKS.redaction(leaf.attrs), [
        h('span', { 'aria-hidden': 'true' }, '█'.repeat(length)),
        ...hides ? [h('span', { class: 'visually-hidden' }, hides)] : [],
      ])
      return cuts ? piece([drawn], Math.max(...cuts.map(({ from }) => from ?? 0))) : [drawn]
    }

    const take = apartOf(moving && effectOf(leaf, 'arrives'), moving && effectOf(leaf, 'lasts'),
      arrivalsAt?.[at], lastingsAt?.[at], moving)
    const words = cuts ? cuts.flatMap(({ text, from }) => piece(take(text), from)) : take(leaf.text)
    return (leaf.marks ?? []).filter(style => !moving || !isRunEffect(style))
      .reduceRight<VNodeArrayChildren>((inner, style) => [draw(styledOf(style), inner)], words)
  }

  /**
   * A line's leaves. With `moving`, they are drawn in stretches under the same two
   * Effects, and each stretch inside its run's own elements once, the arrival
   * wrapping what lasts, so a word one of whose letters is in italic is still one
   * word to the line: every box in it is under the one root's `white-space`. Where
   * a run taken apart meets the rest of a word outside it, a word joiner holds the
   * two together, since the boxes alone would let the line break between them.
   * Where the stretch that goes on with the word is itself taken apart, the joiner
   * is the first thing inside its innermost root, under the root's `white-space`,
   * because a joiner set before the root still lets the line break between it and
   * the root's first box; that holds a run starting inside a word, and two runs
   * meeting inside one — a scramble over *un* and a wave over *done*. Before words
   * not taken apart that go on from a root, it stands outside, where the root's
   * last box already holds to it. Only the copy that moves has one; the copy read
   * aloud is drawn without `moving`.
   */
  function words(content: Inline[] = []): VNodeArrayChildren {
    if (!moving) return content.flatMap(inline)
    const stretches: Inline[][] = []
    for (const leaf of content) {
      const last = stretches.at(-1)
      if (last && effectsOf(last[0]!) === effectsOf(leaf)) last.push(leaf)
      else stretches.push([leaf])
    }
    const plainOf = (stretch: Inline[]) => stretch.map(leafOf).join('')
    return stretches.flatMap((stretch, at) => {
      const before = stretches[at - 1]
      const joined = !!before && (apartAt(before[0]!) || apartAt(stretch[0]!))
        && /\S$/u.test(plainOf(before)) && /^\S/u.test(plainOf(stretch))
      const effects = [effectOf(stretch[0]!, 'arrives'), effectOf(stretch[0]!, 'lasts')]
      const inside = joined && apartAt(stretch[0]!)
      const drawn = effects.reduceRight<VNodeArrayChildren>(
        (inner, effect) => effect ? [runOf(effect, inner, moving)] : inner,
        [...inside ? [JOINER] : [], ...stretch.flatMap(inline)])
      return joined && !inside ? [JOINER, ...drawn] : drawn
    })
  }
  const lineOf = (line: Line) => draw(BLOCKS.line(line.attrs), words(line.content))

  return formatted.content.map((block) => {
    switch (block.type) {
      case 'line': return lineOf(block)
      case 'separator': return draw(BLOCKS.separator())
      case 'verse': return draw(BLOCKS.verse(), block.content.map(lineOf))
      case 'speech': {
        const [speaker, ...lines] = block.content
        return draw(BLOCKS.speech(), [draw(BLOCKS.speaker(), words(speaker.content)), ...lines.map(lineOf)])
      }
      case 'quote': {
        const drawn = block.content.map(child =>
          child.type === 'line' ? lineOf(child) : draw(BLOCKS.source(), words(child.content)))
        // The source is last where there is one, and stands outside what it attributes.
        const source = block.content.at(-1)!.type === 'source' ? [drawn.pop()!] : []
        return draw(BLOCKS.quote(), [h('blockquote', drawn), ...source])
      }
    }
  })
}

/**
 * The attributes that set a Shot's text in the face and the alignment its Story
 * is set in, put on the `.shot` wherever one is drawn — the Reading, the Contact
 * Sheet, the bench. The face is a custom property `.shot` reads, so a run in a
 * face of its own departs from it by class; the alignment is the class a line
 * says it by, so a line saying otherwise wins over it, and a Story set at the
 * start says nothing, which leaves a card centred as it always was.
 */
export function setIn(story: { textFace: Face, textAlign: Align }) {
  return {
    class: story.textAlign === 'start' ? undefined : `align-${story.textAlign}`,
    style: { '--shot-face': `var(--${story.textFace})` },
  }
}
