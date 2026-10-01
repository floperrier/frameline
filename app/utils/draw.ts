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
import { leafOf, linesOf } from '#shared/utils/formatted'
import type { Align, Face, Formatted, Inline, Line, Redaction, Style } from '#shared/utils/formatted'
import { pieces } from '#shared/utils/reading'
import type { TextBy } from '#shared/utils/scenes'

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

const styled = (style: Style) =>
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

/**
 * Every word a text node, every attribute from an enumeration. Where `cut` is
 * given, each run's words are cut into units over the leaves `textOf` joins, a
 * line break a leaf of its own between two lines, so the edges are those the
 * bench reckons on the plain words, and a unit never crosses a line. A bar is one
 * piece, arriving whole when the last character it stands for would have, which
 * is when a text ending on one has arrived.
 */
export function drawFormatted(formatted: Formatted, cut?: TextCut): VNode[] {
  const leaves = linesOf(formatted).flatMap((inlines, at) => [...at ? ['\n'] : [], ...inlines.map(leafOf)])
  // A run never holds a line break — the boundary refuses one — so the leaves
  // that are one are the breaks between lines, which draw nothing.
  const cutUp = cut && pieces(leaves, cut.by).filter((_, at) => leaves[at] !== '\n')
  let next = 0

  const piece = (child: string | VNode, from: number | null) => from ? h('span', cut!.unit(from), [child]) : child

  function inline(leaf: Inline): VNodeArrayChildren {
    const cuts = cutUp?.[next++]
    if (leaf.type === 'redaction') {
      const { length, hides } = leaf.attrs
      const drawn = draw(BLOCKS.redaction(leaf.attrs), [
        h('span', { 'aria-hidden': 'true' }, '█'.repeat(length)),
        ...hides ? [h('span', { class: 'visually-hidden' }, hides)] : [],
      ])
      return [cuts ? piece(drawn, Math.max(...cuts.map(({ from }) => from ?? 0))) : drawn]
    }

    const words = cuts ? cuts.map(({ text, from }) => piece(text, from)) : [leaf.text]
    return (leaf.marks ?? []).reduceRight<VNodeArrayChildren>((inner, style) => [draw(styled(style), inner)], words)
  }

  const words = (content?: Inline[]) => (content ?? []).flatMap(inline)
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
