// Written with their extensions, because Node loads this file as it stands through
// the script in `demonstration/`, and Node resolves no import it has to guess at.
import { SHOT_TEXT_MAX_LENGTH, REDACTION_HIDES_MAX_LENGTH, LETTERS_SPLIT_MAX, isArrival, isLasting } from './scenes.ts'
import type { Arrival, Lasting } from './scenes.ts'
import { STORY_LANGUAGES } from './stories.ts'
import type { StoryLanguage } from './stories.ts'
import { same } from './changes.ts'

/**
 * How a Shot's text is formatted, and what it is read as with the formatting
 * set aside — issue #359. The shape is ProseMirror's JSON, so the bench's editor
 * holds it without translation, and it is kept in a `jsonb` column whose
 * boundary is `parseFormatted`: the closed answer
 * `docs/adr/0004-conditions-stay-flat.md` gives for jsonb, a shape the server
 * reads key by key rather than one it trusts.
 */

export const SIZES = ['small', 'large', 'larger', 'largest'] as const
export const FACES = ['prose', 'display', 'typewriter', 'hand'] as const
export const INKS = ['rose', 'amber', 'green', 'blue', 'violet'] as const
export const SPACINGS = ['wide', 'wider'] as const
export const ALIGNS = ['start', 'centre', 'end'] as const
export const LEADINGS = ['tight', 'loose'] as const
export const STANDS = ['top', 'middle', 'foot'] as const

export type Size = typeof SIZES[number]
export type Face = typeof FACES[number]
export type Ink = typeof INKS[number]
export type Spacing = typeof SPACINGS[number]
export type Align = typeof ALIGNS[number]
export type Leading = typeof LEADINGS[number]
export type Stands = typeof STANDS[number]

export type Formatted = { type: 'doc', attrs?: { stands: Stands | null }, content: Block[] }
export type Block = Line | Quote | Speech | Verse | Separator
export type Line = {
  type: 'line'
  attrs?: { align: Align | null, leading: Leading | null }
  content?: Inline[]
}
/** Lines quoted, then at most one source. */
export type Quote = { type: 'quote', content: (Line | Source)[] }
export type Source = { type: 'source', content?: Inline[] }
export type Speech = { type: 'speech', content: [Speaker, Line, ...Line[]] }
export type Speaker = { type: 'speaker', content?: Inline[] }
export type Verse = { type: 'verse', content: [Line, ...Line[]] }
export type Separator = { type: 'separator' }
export type Inline = Run | Redaction
export type Run = { type: 'text', text: string, marks?: Style[] }
export type Redaction = { type: 'redaction', attrs: { length: number, hides: string } }
export type Style =
  | { type: 'emphasis' } | { type: 'strong' } | { type: 'underline' } | { type: 'strike' }
  | { type: 'smallCaps' }
  | { type: 'script', attrs: { place: 'super' | 'sub' } }
  | { type: 'size', attrs: { step: Size } }
  | { type: 'face', attrs: { face: Face } }
  | { type: 'colour', attrs: { ink: Ink, band: boolean } }
  | { type: 'spacing', attrs: { step: Spacing } }
  | { type: 'language', attrs: { lang: StoryLanguage } }
  // Two types rather than one with two attributes, so that a scramble over three
  // words and a tremor over the last two of them can overlap.
  | { type: 'arrives', attrs: Arrival }
  | { type: 'lasts', attrs: Lasting }

/** Every line of a formatted text in reading order, as the leaves `textOf` joins. */
export function linesOf(formatted: Formatted): Inline[][] {
  const lines: Inline[][] = []
  for (const block of formatted.content) {
    if (block.type === 'separator') lines.push([])
    else if (block.type === 'line') lines.push(block.content ?? [])
    else for (const child of block.content) lines.push(child.content ?? [])
  }
  return lines
}

/** What one run or bar is read as among the plain words: its letters, or a `█` per character. */
export function leafOf(inline: Inline): string {
  return inline.type === 'text' ? inline.text : '█'.repeat(inline.attrs.length)
}

/**
 * The plain words: every line, speaker and source a line, a separator an empty
 * line, a bar a `█` per character it stands for, lines joined by a line break.
 */
export function textOf(formatted: Formatted): string {
  return linesOf(formatted).map(inlines => inlines.map(leafOf).join('')).join('\n')
}

/**
 * The same text with the words of every run put through `say`, its blocks, its
 * marks and its bars untouched: what the Reading draws once a Flag is said in it.
 * Said run by run, so a name split across two runs of different formatting is
 * two runs and reads as typed.
 */
export function runsSaid(formatted: Formatted, say: (text: string) => string): Formatted {
  type Node = { type: string, text?: string, content?: Node[] }
  const through = (node: Node): Node => node.type === 'text'
    ? { ...node, text: say(node.text!) }
    : node.content ? { ...node, content: node.content.map(through) } : node

  return through(formatted) as Formatted
}

/** A plain text read as formatted, a line per line. */
export function formattedOf(text: string): Formatted {
  return formatted(...text.split('\n').map(piece => line(...(piece === '' ? [] : [piece]))))
}

// The builders a work and a test write with.

export function formatted(...blocks: Block[]): Formatted {
  return { type: 'doc', content: blocks }
}

const inlinesOf = (content: (string | Inline)[]): Inline[] =>
  content.filter(c => c !== '').map(c => typeof c === 'string' ? run(c) : c)

export function line(...content: (string | Inline)[]): Line {
  const inlines = inlinesOf(content)
  return inlines.length === 0 ? { type: 'line' } : { type: 'line', content: inlines }
}

export function aligned(align: Align | null, leading: Leading | null, ...content: (string | Inline)[]): Line {
  return { ...line(...content), attrs: { align, leading } }
}

export function run(text: string, ...marks: Style[]): Run {
  return marks.length === 0 ? { type: 'text', text } : { type: 'text', text, marks }
}

export function bar(length: number, hides: string): Redaction {
  return { type: 'redaction', attrs: { length, hides } }
}

/** The Effects that take a run apart letter by letter, which the bound below counts. */
export const BY_LETTER: readonly string[] = ['scramble', 'wave', 'tremor']

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** A text's letters as a reader sees them: graphemes, so an accent is never parted from its letter. */
export function graphemes(text: string) {
  return [...segmenter.segment(text)].map(({ segment }) => segment)
}

/** How many letters a text holds, white space being none. */
export function lettersIn(text: string) {
  return graphemes(text).filter(letter => !/^\s+$/u.test(letter)).length
}

const effectsOf = (inline: Inline) => inline.type === 'text' ? (inline.marks ?? []) : []

/**
 * How many letters a text's runs take apart, which `LETTERS_SPLIT_MAX` bounds: every
 * letter under a scramble, a wave or a tremor, and once however many of them it is under.
 */
export function lettersSplit(formatted: Formatted) {
  return linesOf(formatted).flat().reduce((count, inline) => effectsOf(inline).some(mark =>
    (mark.type === 'arrives' || mark.type === 'lasts') && BY_LETTER.includes(mark.attrs.effect))
    ? count + lettersIn((inline as Run).text)
    : count, 0)
}

/** What the runs of a text play while they stand, which the Pause and the flash rule read. */
export function runLastings(formatted: Formatted): Lasting[] {
  return linesOf(formatted).flat().flatMap(inline =>
    effectsOf(inline).flatMap(mark => mark.type === 'lasts' ? [mark.attrs] : []))
}

const wordsOf = (words: string | Inline[]): Inline[] => typeof words === 'string' ? inlinesOf([words]) : words

export function quote(lines: Line[], source?: string | Inline[]): Quote {
  const content: (Line | Source)[] = [...lines]
  if (source !== undefined) content.push({ type: 'source', content: wordsOf(source) })
  return { type: 'quote', content }
}

export function speech(speaker: string | Inline[], ...lines: [Line, ...Line[]]): Speech {
  return { type: 'speech', content: [{ type: 'speaker', content: wordsOf(speaker) }, ...lines] }
}

export function verse(...lines: [Line, ...Line[]]): Verse {
  return { type: 'verse', content: lines }
}

export const separator: Separator = { type: 'separator' }

export function standing(stands: Stands | null, value: Formatted): Formatted {
  return { ...value, attrs: { stands } }
}

// A Shot's words cut in two where the caret stands, and joined back — issue #432,
// `docs/adr/0071-a-shots-words-are-cut-where-the-caret-stands.md`.

type Piece = Block | Line | Source | Speaker | Inline

/**
 * How many places a node takes as ProseMirror counts them, which is what the
 * caret's position is counted in: a letter one, a bar or a separator one, and a
 * block one where it opens and one where it closes.
 */
function sizeOf(node: Piece): number {
  if (node.type === 'text') return node.text.length
  if (node.type === 'redaction' || node.type === 'separator') return 1
  return 2 + (node.content ?? []).reduce((sum: number, child: Piece) => sum + sizeOf(child), 0)
}

/** Nodes before a place and nodes after it, the one the place falls inside cut by `through` at the place inside it. */
function parted<T extends Piece>(nodes: T[], at: number, through: (node: T, at: number) => [T[], T[]]): [T[], T[]] {
  const before: T[] = []
  const after: T[] = []
  let place = 0
  for (const node of nodes) {
    const size = sizeOf(node)
    if (place + size <= at) before.push(node)
    else if (place >= at) after.push(node)
    else {
      const [first, second] = through(node, at - place)
      before.push(...first)
      after.push(...second)
    }
    place += size
  }
  return [before, after]
}

const runAt = (inline: Inline, at: number): [Inline[], Inline[]] => {
  const cut = inline as Run
  return [[{ ...cut, text: cut.text.slice(0, at) }], [{ ...cut, text: cut.text.slice(at) }]]
}

/** A line, a Speaker or a Source holding other words, or none, which leaves out `content`. */
function holding<T extends Line | Source | Speaker>(node: T, inlines: Inline[]): T {
  const { content: _content, ...rest } = node
  return (inlines.length ? { ...rest, content: inlines } : rest) as T
}

/** A line cut where the caret is, each piece left out where it holds nothing: no empty line is left behind. */
function lineAt(cut: Line, at: number): [Line[], Line[]] {
  const [before, after] = parted(cut.content ?? [], at - 1, runAt)
  return [before.length ? [holding(cut, before)] : [], after.length ? [holding(cut, after)] : []]
}

const lineOrPart = <T extends Line | Source | Speaker>(cut: T, at: number): [T[], T[]] =>
  cut.type === 'line' ? lineAt(cut, at) as [T[], T[]]
  // The caret in a Speaker takes the whole Speech on; in a Source, the whole Quote stays.
  : cut.type === 'speaker' ? [[], [cut]] : [[cut], []]

/**
 * A block cut where the caret is. A block whose one line is empty and holds the
 * caret stays whole in the first half, rather than leave a Speaker or a Source
 * with no line to stand over.
 */
function blockAt(cut: Block, at: number): [Block[], Block[]] {
  switch (cut.type) {
    case 'line': return lineAt(cut, at)
    case 'verse': {
      const [before, after] = parted(cut.content, at - 1, lineOrPart)
      if (!before.length && !after.length) return [[cut], []]
      return [before.length ? [{ ...cut, content: before } as Verse] : [], after.length ? [{ ...cut, content: after } as Verse] : []]
    }
    case 'quote': {
      const [before, after] = parted<Line | Source>(cut.content, at - 1, lineOrPart)
      // A Source goes with the lines it follows, and the Quote stays whole where none follow the caret.
      if (!after.some(part => part.type === 'line')) return [[cut], []]
      return [before.length ? [{ ...cut, content: before }] : [], [{ ...cut, content: after }]]
    }
    case 'speech': {
      const [before, after] = parted<Speaker | Line>(cut.content, at - 1, lineOrPart)
      const speaker = cut.content[0]
      // Both beats say who speaks: the second takes the Speaker with it.
      const said = (parts: (Speaker | Line)[]) => parts.some(part => part.type === 'line')
        ? [{ ...cut, content: parts[0]!.type === 'speaker' ? parts : [speaker, ...parts] } as Speech]
        : []
      const [first, second] = [said(before), said(after)]
      return first.length || second.length ? [first, second] : [[cut], []]
    }
    default: return [[cut], []]
  }
}

/**
 * A Shot's words cut in two at a place counted as ProseMirror counts the caret:
 * the words before it and the words after, each a text the boundary takes. The
 * block the caret is in is cut in two and each half keeps its attrs; a piece left
 * empty is left out, so a cut at the edge of a line leaves no empty line behind; a
 * half left with nothing is one empty line. The text's own `attrs` stay with both.
 */
export function splitFormatted(value: Formatted, at: number): [Formatted, Formatted] {
  const halves = parted(value.content, at, blockAt)
  return halves.map(content => ({ ...value, content: content.length ? content : [line()] })) as [Formatted, Formatted]
}

/** Whether a text holds nothing at all: one empty line. */
export function blank(value: Formatted) {
  const [only, ...rest] = value.content
  return !rest.length && only?.type === 'line' && !only.content?.length
}

/** Two runs of words meeting, a run either side of the seam that carries the same Styles made one. */
function meetingWords(first: Inline[] = [], second: Inline[] = []): Inline[] {
  const last = first.at(-1)
  const next = second[0]
  if (last?.type === 'text' && next?.type === 'text' && same(last.marks ?? [], next.marks ?? [])) {
    return [...first.slice(0, -1), { ...last, text: last.text + next.text }, ...second.slice(1)]
  }
  return [...first, ...second]
}

const meetingLines = (first: Line, second: Line) => holding(first, meetingWords(first.content, second.content))

/** Two blocks meeting as two paragraphs do, the first one's line taking the second's; nothing where they are not of a kind to. */
function meeting(first: Block, second: Block): Block | undefined {
  if (first.type === 'line' && second.type === 'line') return meetingLines(first, second)

  type Lines = { content: (Line | Source | Speaker)[] }
  const into = (held: Lines, from: Lines, start: number) => ({
    ...held,
    content: [...held.content.slice(0, -1), meetingLines(held.content.at(-1) as Line, from.content[start] as Line), ...from.content.slice(start + 1)],
  })
  if (first.type === 'verse' && second.type === 'verse') return into(first, second, 0) as Verse
  if (first.type === 'quote' && second.type === 'quote' && first.content.at(-1)!.type === 'line') return into(first, second, 0) as Quote
  if (first.type === 'speech' && second.type === 'speech' && same(first.content[0], second.content[0])) {
    return into(first, second, 1) as Speech
  }
  return undefined
}

/**
 * The words of one Shot joined onto the end of the Shot before's, the last block
 * of the one meeting the first of the other as two paragraphs meet, and laid end
 * to end where they are not of a kind to. `seam` is the place where the first
 * text's words ended, where the caret lands. A join gives back what a cut inside
 * a line's words parted; a cut at the edge of a line spent the break between two
 * lines, and the join meets them as `Backspace` meets two paragraphs.
 */
export function joinFormatted(first: Formatted, second: Formatted): { formatted: Formatted, seam: number } {
  if (blank(first)) return { formatted: { ...first, content: second.content }, seam: 0 }

  const size = first.content.reduce((sum, block) => sum + sizeOf(block), 0)
  const last = first.content.at(-1)!
  const seam = size - (last.type === 'separator' ? 0 : last.type === 'line' ? 1 : 2)
  if (blank(second)) return { formatted: first, seam }

  const met = meeting(last, second.content[0]!)
  const content = met
    ? [...first.content.slice(0, -1), met, ...second.content.slice(1)]
    : [...first.content, ...second.content]
  return { formatted: { ...first, content }, seam }
}

// A text pasted under a Scene, read as the Shots it makes — issue #438,
// `docs/adr/0081-pasted-text-is-cut-at-its-empty-lines.md`.

/**
 * Whether a block's first line says who speaks: a line starting with `@`, or one
 * written in capitals — a capital and no small letter, so a script with no case
 * never reads as a Speaker. The name the Speaker is given, or undefined.
 */
function speakerOf(first: string): string | undefined {
  const name = first.trim()
  if (name.startsWith('@')) return name.slice(1)
  return /\p{Lu}/u.test(name) && !/\p{Ll}/u.test(name) ? name : undefined
}

/**
 * The Shots a text makes, in order. It is cut at every run of empty lines (a line
 * of white space is empty), and where it holds none, every line is a Shot.
 * Empty lines at its head and foot are set aside first, so a trailing line break
 * does not count as a cut. A block of two lines or more whose first line is a
 * Speaker is a speech, and nothing else in the text is read. Each line keeps the
 * spaces at its start and loses those at its end.
 */
export function shotsOf(text: string): Formatted[] {
  const lines = text.split(/\r\n?|\n/).map(held => held.trimEnd())
  const from = lines.findIndex(Boolean)
  if (from === -1) return []
  const kept = lines.slice(from, lines.findLastIndex(Boolean) + 1)

  const blocks = kept.includes('')
    ? kept.join('\n').split(/\n{2,}/).map(block => block.split('\n'))
    : kept.map(held => [held])

  return blocks.map(([first, ...rest]) => {
    const speaker = rest.length ? speakerOf(first!) : undefined
    return speaker === undefined
      ? formatted(...[first!, ...rest].map(held => line(held)))
      : formatted(speech(speaker, ...rest.map(held => line(held)) as [Line, ...Line[]]))
  })
}

// The boundary.

export type FormattedRefusal = 'formatted' | 'redactionHides' | 'shotTextLong'
  | 'effectArrives' | 'effectLasts' | 'lettersSplit'

class Refusal extends Error {
  readonly refusal: FormattedRefusal

  constructor(refusal: FormattedRefusal) {
    super(refusal)
    this.refusal = refusal
  }
}

const refuse = (which: FormattedRefusal = 'formatted'): never => {
  throw new Refusal(which)
}

type Obj = Record<string, unknown>
const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const NODES = ['doc', 'line', 'quote', 'source', 'speech', 'speaker', 'verse', 'separator', 'text', 'redaction']

/**
 * What the boundary reads a text as. `refuse` is for a request, which says
 * exactly the shape or is refused; `drop` is for a row read back, which may carry
 * what a later version knew and this one does not, and which is left out rather
 * than fail the Story.
 */
export function parseFormatted(
  json: unknown,
  unknown: 'refuse' | 'drop',
): { formatted: Formatted } | { refused: FormattedRefusal } {
  const strict = unknown === 'refuse'

  /** A node or mark's own object, with no key outside `allowed` where strict. */
  function own(value: unknown, allowed: string[]): Obj {
    if (!isObject(value)) return refuse()
    if (strict && Object.keys(value).some(k => !allowed.includes(k))) refuse()
    return value
  }

  /** An attrs object holding exactly `names`, each read by its own reader. */
  function attrs(node: Obj, readers: Record<string, (v: unknown) => unknown>): Obj {
    const held = own(node.attrs, Object.keys(readers))
    const read: Obj = {}
    for (const [name, reader] of Object.entries(readers)) {
      if (!(name in held)) refuse()
      read[name] = reader(held[name])
    }
    return read
  }

  const oneOf = <T extends string>(options: readonly T[], nullable = false) => (v: unknown): T | null =>
    nullable && v === null ? null : options.includes(v as T) ? v as T : refuse()
  const flag = (v: unknown) => typeof v === 'boolean' ? v : refuse()
  const placed = oneOf(['super', 'sub'] as const)

  function style(value: unknown): Style {
    const m = own(value, ['type', 'attrs'])
    const plain = (type: string) => {
      own(m, ['type'])
      return { type } as Style
    }
    switch (m.type) {
      case 'emphasis': case 'strong': case 'underline': case 'strike': case 'smallCaps':
        return plain(m.type)
      case 'script': return { type: 'script', attrs: attrs(m, { place: placed }) } as Style
      case 'size': return { type: 'size', attrs: attrs(m, { step: oneOf(SIZES) }) } as Style
      case 'face': return { type: 'face', attrs: attrs(m, { face: oneOf(FACES) }) } as Style
      case 'colour': return { type: 'colour', attrs: attrs(m, { ink: oneOf(INKS), band: flag }) } as Style
      case 'spacing': return { type: 'spacing', attrs: attrs(m, { step: oneOf(SPACINGS) }) } as Style
      case 'language': return { type: 'language', attrs: attrs(m, { lang: oneOf(STORY_LANGUAGES) }) } as Style
      // A run's Effect is #360's, read by #360's own two calls. The editor declares
      // a round on every lasting, so one with none is written with it null.
      case 'arrives': {
        own(m, ['type', 'attrs'])
        return isArrival(m.attrs, 'run')
          ? { type: 'arrives', attrs: { ...m.attrs } } as Style
          : refuse('effectArrives')
      }
      case 'lasts': {
        own(m, ['type', 'attrs'])
        const held = isObject(m.attrs) && m.attrs.every === null
          ? Object.fromEntries(Object.entries(m.attrs).filter(([key]) => key !== 'every'))
          : m.attrs
        return isLasting(held, 'run') ? { type: 'lasts', attrs: { ...held } } as Style : refuse('effectLasts')
      }
      default: return refuse()
    }
  }

  function marks(value: unknown): Style[] {
    if (value === undefined) return []
    if (!Array.isArray(value)) return refuse()
    const kept: Style[] = []
    for (const m of value) {
      try {
        kept.push(style(m))
      }
      catch (e) {
        if (strict || !(e instanceof Refusal)) throw e
      }
    }
    if (new Set(kept.map(s => s.type)).size !== kept.length) refuse()
    return kept
  }

  /** The type of a node, or undefined where it is one this version does not know and drops. */
  function kind(value: unknown, allowed: string[]): string | undefined {
    if (!isObject(value) || typeof value.type !== 'string') return refuse()
    if (allowed.includes(value.type)) return value.type
    if (!strict && !NODES.includes(value.type)) return undefined
    return refuse()
  }

  /** The children of a node, those this version does not know left out where it may. */
  function children<T>(node: Obj, allowed: string[], read: (child: Obj, type: string) => T, min = 0): T[] {
    const content = node.content
    if (content !== undefined && !Array.isArray(content)) refuse()
    const kept: T[] = []
    for (const child of (content as unknown[] | undefined) ?? []) {
      const type = kind(child, allowed)
      if (type !== undefined) kept.push(read(child as Obj, type))
    }
    if (kept.length < min) refuse()
    return kept
  }

  function inlines(node: Obj): Inline[] | undefined {
    const read = children<Inline>(node, ['text', 'redaction'], (child, type) => {
      if (type === 'text') {
        const m = own(child, ['type', 'text', 'marks'])
        if (typeof m.text !== 'string' || m.text === '' || m.text.includes('\n')) refuse()
        const styles = marks(m.marks)
        return run(m.text as string, ...styles)
      }
      own(child, ['type', 'attrs'])
      const held = attrs(child, {
        length: v => !Number.isInteger(v) || (v as number) < 1
          ? refuse()
          // A bar longer than any text may be is refused before `textOf` draws it.
          : (v as number) > SHOT_TEXT_MAX_LENGTH ? refuse('shotTextLong') : v,
        hides: v => typeof v !== 'string' ? refuse() : v.length > REDACTION_HIDES_MAX_LENGTH ? refuse('redactionHides') : v,
      })
      return { type: 'redaction', attrs: held } as Redaction
    })
    return read.length === 0 ? undefined : read
  }

  const withWords = <T extends 'speaker' | 'source'>(type: T, node: Obj) => {
    own(node, ['type', 'content'])
    const content = inlines(node)
    return content === undefined ? { type } : { type, content }
  }

  function lineOf(node: Obj): Line {
    own(node, ['type', 'attrs', 'content'])
    const held = node.attrs === undefined
      ? { align: null, leading: null }
      : attrs(node, { align: oneOf(ALIGNS, true), leading: oneOf(LEADINGS, true) })
    const content = inlines(node)
    return { type: 'line', attrs: held, ...content && { content } } as Line
  }

  const lineIn = (child: Obj) => lineOf(child)

  function block(node: Obj, type: string): Block {
    switch (type) {
      case 'line': return lineOf(node)
      case 'separator': return own(node, ['type']) && separator
      case 'verse':
        own(node, ['type', 'content'])
        return { type: 'verse', content: children(node, ['line'], lineIn, 1) } as Verse
      case 'quote': {
        own(node, ['type', 'content'])
        const content = children<Line | Source>(node, ['line', 'source'],
          (child, t) => t === 'line' ? lineOf(child) : withWords('source', child) as Source, 1)
        const sources = content.filter(c => c.type === 'source').length
        if (sources > 1 || (sources === 1 && content.at(-1)!.type !== 'source')) refuse()
        if (content[0]!.type !== 'line') refuse()
        return { type: 'quote', content }
      }
      default: {
        own(node, ['type', 'content'])
        const parts = children<Speaker | Line>(node, ['speaker', 'line'],
          (child, t) => t === 'line' ? lineOf(child) : withWords('speaker', child) as Speaker)
        if (parts.length < 2 || parts[0]!.type !== 'speaker' || parts.slice(1).some(p => p.type !== 'line')) refuse()
        return { type: 'speech', content: parts } as Speech
      }
    }
  }

  try {
    const doc = own(json, ['type', 'attrs', 'content'])
    if (doc.type !== 'doc' || !Array.isArray(doc.content) || doc.content.length === 0) refuse()
    const held = doc.attrs === undefined ? null : attrs(doc, { stands: oneOf(STANDS, true) }).stands
    const content = children(doc, ['line', 'quote', 'speech', 'verse', 'separator'], block, 1)
    const result = { type: 'doc', attrs: { stands: held }, content } as Formatted
    if (textOf(result).length > SHOT_TEXT_MAX_LENGTH) refuse('shotTextLong')
    if (lettersSplit(result) > LETTERS_SPLIT_MAX) refuse('lettersSplit')
    return { formatted: result }
  }
  catch (e) {
    if (e instanceof Refusal) return { refused: e.refusal }
    throw e
  }
}

/**
 * What a stored row's text is read as. The stored formatted text is believed
 * only while its words agree with the row's plain `text`: a rollback that wrote
 * `text` alone leaves them apart, and the plain words are then the truth.
 */
export function formattedIn(row: { formatted: unknown, text: string }): Formatted {
  const read = row.formatted === null ? undefined : parseFormatted(row.formatted, 'drop')
  const held = read && 'formatted' in read ? read.formatted : undefined
  return held && textOf(held) === row.text ? held : formattedOf(row.text)
}
