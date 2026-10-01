/**
 * The bench's editor of a Shot's text — issue #359. Its schema is the shape
 * `shared/utils/formatted.ts` closes, node for node and style for style, so the
 * JSON it writes is the JSON the boundary reads, and every node and style is
 * drawn from the renderer's own `STYLES` and `BLOCKS`, so a Shot in the editor
 * and the same Shot in the Reading cannot differ.
 *
 * What a paste keeps is what a parse rule names: italic, bold, underline,
 * strikethrough, quotations, separators and lines. A colour, a face, a size, a
 * link's address, a script and an image name nothing here and are left out.
 *
 * The acts the toolbar offers that are more than a style are ProseMirror
 * commands written here rather than in the component, so they are read on a
 * state without a page.
 */
import { Extension, Mark, Node, getSchema, mergeAttributes } from '@tiptap/core'
import type { AnyExtension, Editor, Extensions } from '@tiptap/core'
import { UndoRedo } from '@tiptap/extensions'
import { baseKeymap } from '@tiptap/pm/commands'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { Node as Held, ResolvedPos, Schema, TagParseRule, StyleParseRule } from '@tiptap/pm/model'
import { NodeSelection, Plugin, TextSelection } from '@tiptap/pm/state'
import type { Command, EditorState } from '@tiptap/pm/state'
// Through the alias, as `draw.ts` explains.
import { formattedOf, textOf } from '#shared/utils/formatted'
import type { Formatted, Style } from '#shared/utils/formatted'
import { SHOT_TEXT_MAX_LENGTH } from '#shared/utils/scenes'
import { BLOCKS, STYLES } from './draw'

type Drawn = [tag: string, attrs: Record<string, string>]
type Keys = (editor: Editor) => Record<string, () => boolean>

/** A drawn element with a hole for its content, carrying whatever the editor adds. */
const holding = ([tag, attrs]: Drawn, added: Record<string, unknown>) => [tag, mergeAttributes(attrs, added), 0] as const

/**
 * An attribute the editor holds but never writes on the page, where the drawing
 * says it by class: null where the shape lets it be, and otherwise required, as
 * the boundary requires it.
 */
const attr = (value?: null) => value === null
  ? { default: null, rendered: false }
  : { default: undefined, isRequired: true, rendered: false }

function style(name: Style['type'], attrs: string[], parse: (TagParseRule | StyleParseRule)[] = [], keys?: Keys) {
  return Mark.create({
    name,
    addAttributes: () => Object.fromEntries(attrs.map(name => [name, attr()])),
    parseHTML: () => parse,
    renderHTML: ({ mark, HTMLAttributes }) =>
      holding((STYLES[name] as (attrs: unknown) => Drawn)(mark.attrs), HTMLAttributes),
    addKeyboardShortcuts() {
      return keys?.(this.editor) ?? {}
    },
  })
}

const toggles = (key: string, name: string, attrs?: Record<string, string>): Keys =>
  editor => ({ [key]: () => editor.commands.toggleMark(name, attrs) })

// What a word processor writes a style as: Google Docs wraps the whole of a
// paste in a `<b style="font-weight:normal">`, which is not bold.
const decorated = (line: string): StyleParseRule =>
  ({ style: 'text-decoration', consuming: false, getAttrs: value => value.includes(line) ? null : false })

const MARKS = [
  style('emphasis', [], [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }], toggles('Mod-i', 'emphasis')),
  style('strong', [], [
    { tag: 'strong' },
    { tag: 'b', getAttrs: node => node.style.fontWeight !== 'normal' && null },
    { style: 'font-weight', getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
  ], toggles('Mod-b', 'strong')),
  style('underline', [], [{ tag: 'u' }, decorated('underline')], toggles('Mod-u', 'underline')),
  style('strike', [], [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }, decorated('line-through')],
    toggles('Mod-Shift-s', 'strike')),
  style('smallCaps', []),
  style('script', ['place'], [], editor => ({
    ...toggles('Mod-.', 'script', { place: 'super' })(editor),
    ...toggles('Mod-,', 'script', { place: 'sub' })(editor),
  })),
  style('size', ['step']),
  style('face', ['face']),
  style('colour', ['ink', 'band']),
  style('spacing', ['step']),
  style('language', ['lang']),
]

function block(name: string, content: string, drawn: () => Drawn, parse: TagParseRule[] = [], group?: string) {
  return Node.create({
    name,
    group,
    content,
    parseHTML: () => parse,
    renderHTML: ({ HTMLAttributes }) => holding(drawn(), HTMLAttributes),
  })
}

const NODES = [
  Node.create({
    name: 'doc',
    topNode: true,
    content: 'block+',
    addAttributes: () => ({ stands: attr(null) }),
  }),
  Node.create({ name: 'text', group: 'inline' }),
  // First of the blocks, so it is the one ProseMirror makes where it needs one.
  Node.create({
    name: 'line',
    group: 'block',
    content: 'inline*',
    addAttributes: () => ({ align: attr(null), leading: attr(null) }),
    parseHTML: () => ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(tag => ({ tag })),
    renderHTML: ({ node, HTMLAttributes }) => holding(BLOCKS.line(node.attrs as Parameters<typeof BLOCKS.line>[0]), HTMLAttributes),
    addKeyboardShortcuts() {
      const align = (to: string) => () => this.editor.commands.updateAttributes('line', { align: to })
      return { 'Mod-Shift-l': align('start'), 'Mod-Shift-e': align('centre'), 'Mod-Shift-r': align('end') }
    },
  }),
  block('quote', 'line+ source?', BLOCKS.quote, [{ tag: 'blockquote' }], 'block'),
  block('source', 'inline*', BLOCKS.source),
  block('speech', 'speaker line+', BLOCKS.speech, [], 'block'),
  block('speaker', 'inline*', BLOCKS.speaker),
  block('verse', 'line+', BLOCKS.verse, [], 'block'),
  Node.create({
    name: 'separator',
    group: 'block',
    atom: true,
    parseHTML: () => [{ tag: 'hr' }],
    renderHTML: ({ HTMLAttributes }) => {
      const [tag, attrs] = BLOCKS.separator()
      return [tag, mergeAttributes(attrs, HTMLAttributes)]
    },
  }),
  // A bar is drawn as what `textOf` says it is, a block per character it stands
  // for, and heard as the box says it: what it hides, or nothing. Said as the
  // bar's name rather than as words beside it, as the box writes them, because
  // this drawing is also what a copy puts on the clipboard, and a bar pasted back
  // is read by its words — a name is not one of them.
  Node.create({
    name: 'redaction',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes: () => ({ length: attr(), hides: attr() }),
    renderHTML: ({ node, HTMLAttributes }) => {
      const { length, hides } = node.attrs as Parameters<typeof BLOCKS.redaction>[0]
      const [tag, attrs] = BLOCKS.redaction({ length, hides })
      const heard = hides ? { role: 'img', 'aria-label': hides } : { 'aria-hidden': 'true' }
      return [tag, mergeAttributes(attrs, heard, HTMLAttributes), '█'.repeat(length)]
    },
  }),
]

/** Plain text pasted, read a line per line as `formattedOf` reads it, a blank line kept. */
export function pastedText(text: string, schema: Schema): Slice {
  return new Slice(schema.nodeFromJSON(formattedOf(text.replace(/\r\n?/g, '\n'))).content, 1, 1)
}

/** A fragment whose runs hold no line break — which a pasted `<br>` arrives as — a space for each. */
function unbroken(fragment: Fragment): Fragment {
  const nodes: Held[] = []
  fragment.forEach(node => nodes.push(node.isText
    ? node.type.schema.text(node.text!.replace(/\r\n?|\n/g, ' '), node.marks)
    : node.copy(unbroken(node.content))))
  return Fragment.from(nodes)
}

/**
 * What keeps the editor inside what the boundary takes, where the schema
 * cannot: a change taking the plain words past `SHOT_TEXT_MAX_LENGTH` is
 * refused, as a textarea's `maxlength` refused it; a bar carries no style, which
 * ProseMirror would lay on it with the words around it; and a paste reaches the
 * text with its blank lines kept and no line break inside a run.
 */
export function bounds(): Plugin {
  return new Plugin({
    filterTransaction: tr => !tr.docChanged || textOf(tr.doc.toJSON() as Formatted).length <= SHOT_TEXT_MAX_LENGTH,
    appendTransaction(transactions, _, state) {
      if (!transactions.some(tr => tr.docChanged)) return null
      const tr = state.tr
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'redaction' && node.marks.length) tr.setNodeMarkup(pos, undefined, node.attrs, [])
      })
      return tr.docChanged ? tr : null
    },
    props: {
      clipboardTextParser: (text, $context) => pastedText(text, $context.doc.type.schema),
      transformPasted: slice => new Slice(unbroken(slice.content), slice.openStart, slice.openEnd),
    },
  })
}

/**
 * What the editor is made of: the schema, undo within this Shot, and `Shift+Enter`
 * as ProseMirror's own `Enter` — a new line of the same kind, stepping out of an
 * empty quoted, spoken or verse line — because `Enter` is the bench's.
 * Taken whether or not it found anything to do, so the browser never writes a
 * `<br>` of its own.
 */
export function extensions(): Extensions {
  const bench = Extension.create({
    name: 'bench',
    addKeyboardShortcuts: () => ({
      'Shift-Enter': ({ editor }) => {
        baseKeymap.Enter!(editor.state, editor.view.dispatch, editor.view)
        return true
      },
    }),
    addProseMirrorPlugins: () => [bounds()],
  })
  return [...NODES, ...MARKS, UndoRedo, bench] as AnyExtension[]
}

export function schemaOf(): Schema {
  return getSchema(extensions())
}

export type LineKind = 'paragraph' | 'quote' | 'source' | 'speech' | 'verse'

/** What the line holding the caret is, or nothing where a separator is selected. */
export function lineKindOf(state: EditorState): LineKind | undefined {
  const { $from } = state.selection
  const held = $from.parent.type.name
  if (held === 'source') return 'source'
  if (held === 'speaker') return 'speech'
  if (held !== 'line') return undefined
  const around = $from.node(-1).type.name
  return around === 'doc' ? 'paragraph' : around as LineKind
}

/**
 * Makes the lines the selection is in a kind of line. A source is the one kind
 * said of a line alone — a quotation's last, after a line it attributes. Every
 * other kind is said of the blocks the selection touches: their lines, a
 * speaker's and a source's among them, become paragraphs, or one quotation, one
 * verse, or one speech under a speaker not yet named. A separator stays where it
 * stands and parts what is on either side of it. The caret stays on the words it
 * was on.
 */
export function lineAs(kind: LineKind): Command {
  return (state, dispatch) => {
    const { schema, selection } = state
    const { $from, $to } = selection

    if (kind === 'source') {
      const quote = $from.depth > 1 ? $from.node(-1) : undefined
      if ($from.parent.type.name !== 'line' || quote?.type.name !== 'quote'
        || quote.childCount < 2 || $from.index(-1) !== quote.childCount - 1) return false
      dispatch?.(state.tr.setNodeMarkup($from.before(), schema.nodes.source))
      return true
    }

    if (!dispatch) return true

    const from = $from.depth ? $from.before(1) : $from.pos
    const to = $to.depth ? $to.after(1) : $to.pos
    const line = schema.nodes.line!
    const kept = new Map<Held, Held>()
    const lineOf = (node: Held) => {
      const made = node.type === line ? node : line.create(null, node.content)
      kept.set(node, made)
      return made
    }

    const written: Held[] = []
    let lines: Held[] = []
    const close = () => {
      if (!lines.length) return
      if (kind === 'paragraph') written.push(...lines)
      else written.push(schema.nodes[kind]!.create(null, kind === 'speech' ? [schema.nodes.speaker!.create(), ...lines] : lines))
      lines = []
    }
    state.doc.slice(from, to).content.forEach((block) => {
      if (block.isLeaf) {
        close()
        written.push(block)
      }
      else if (block.type === line) lines.push(lineOf(block))
      else block.forEach(child => lines.push(lineOf(child)))
    })
    close()

    const tr = state.tr.replaceWith(from, to, written)
    const placed = new Map<Held, number>()
    tr.doc.nodesBetween(from, from + Fragment.from(written).size, (node, pos) => {
      placed.set(node, pos)
    })
    const at = ($: ResolvedPos) => {
      const pos = placed.get(kept.get($.parent)!)
      return pos === undefined ? undefined : pos + 1 + $.parentOffset
    }
    const anchor = at(selection.$anchor), head = at(selection.$head)
    if (anchor !== undefined && head !== undefined) tr.setSelection(TextSelection.create(tr.doc, anchor, head))
    dispatch(tr.scrollIntoView())
    return true
  }
}

/**
 * Takes the selected words out behind a bar as long as their plain words — a
 * line break among them a character, as `textOf` counts it — so the plain words
 * keep their length, and selects the bar, so what it hides is asked next. A
 * selection that takes no character away — all of an empty text, the seam
 * between a speaker and its line — has nothing to hide, and a bar of nought is
 * one the boundary refuses.
 */
export const redact: Command = (state, dispatch) => {
  if (state.selection.empty || state.selection instanceof NodeSelection) return false

  const tr = state.tr.deleteSelection()
  const length = textOf(state.doc.toJSON() as Formatted).length - textOf(tr.doc.toJSON() as Formatted).length
  if (length < 1) return false
  if (!dispatch) return true

  tr.replaceSelectionWith(state.schema.nodes.redaction!.create({ length, hides: '' }), false)
  const { $from } = tr.selection
  if ($from.nodeBefore?.type.name === 'redaction') tr.setSelection(NodeSelection.create(tr.doc, $from.pos - 1))
  dispatch(tr.scrollIntoView())
  return true
}

/** A separator after the line the selection ends in, out of whatever holds that line. */
export const addSeparator: Command = (state, dispatch) => {
  const { $to } = state.selection
  dispatch?.(state.tr.insert($to.depth ? $to.after(1) : $to.pos, state.schema.nodes.separator!.create()).scrollIntoView())
  return true
}
