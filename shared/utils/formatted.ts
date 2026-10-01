import { SHOT_TEXT_MAX_LENGTH, REDACTION_HIDES_MAX_LENGTH } from './scenes'
import { STORY_LANGUAGES } from './stories'
import type { StoryLanguage } from './stories'

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

// The boundary.

export type FormattedRefusal = 'formatted' | 'redactionHides' | 'shotTextLong'

class Refusal extends Error {
  constructor(readonly refusal: FormattedRefusal) {
    super(refusal)
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
