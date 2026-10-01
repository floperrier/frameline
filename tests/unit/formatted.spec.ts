import { getSchema } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { AllSelection, EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { Command } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { REEL_CHANGE } from '../../demonstration/reel-change.ts'
import { SAMPLES } from '../../demonstration/samples.ts'
import { wordsOf } from '../../demonstration/work.ts'
import { addSeparator, bounds, extensions, lineAs, lineKindOf, pastedText, redact } from '../../app/utils/formatting.ts'
import {
  aligned,
  bar,
  formatted,
  formattedIn,
  formattedOf,
  line,
  linesOf,
  parseFormatted,
  quote,
  run,
  separator,
  speech,
  standing,
  textOf,
  verse,
} from '../../shared/utils/formatted.ts'
import type { Formatted } from '../../shared/utils/formatted.ts'
import { REDACTION_HIDES_MAX_LENGTH, SHOT_TEXT_MAX_LENGTH } from '../../shared/utils/scenes.ts'

const works = [REEL_CHANGE, SAMPLES.en, SAMPLES.fr]
const workFormatted = works.flatMap(w => w.scenes.flatMap(s => s.shots.flatMap(shot => shot.formatted ?? [])))
const workTexts = works.flatMap(w => w.scenes.flatMap(s => s.shots.map(shot => wordsOf(shot))))

const refused = (json: unknown, mode: 'refuse' | 'drop' = 'refuse') => {
  const read = parseFormatted(json, mode)
  return 'refused' in read ? read.refused : undefined
}
const para = (...content: unknown[]) => ({ type: 'line', content })
const doc = (...content: unknown[]) => ({ type: 'doc', content })
const word = (text: string, marks?: unknown[]) => ({ type: 'text', text, ...marks && { marks } })

describe('the works’ formatted texts', () => {
  it('are taken by the boundary, with their words', () => {
    expect(workFormatted.length).toBeGreaterThan(0)
    for (const value of workFormatted) {
      const read = parseFormatted(value, 'refuse')
      expect('formatted' in read && textOf(read.formatted)).toBe(textOf(value))
    }
  })
})

describe('a plain text read as formatted', () => {
  it('gives its words back, line for line', () => {
    for (const t of ['', 'a', 'a\n', '\n\nb', '  space-led', 'one\n\nthree', ...workTexts]) {
      expect(textOf(formattedOf(t))).toBe(t)
    }
  })

  it('is read back by the boundary as the same words', () => {
    for (const t of ['', 'a\n', '\n\nb', ...workTexts]) {
      const read = parseFormatted(formattedOf(t), 'refuse')
      expect('formatted' in read && textOf(read.formatted)).toBe(t)
    }
  })
})

describe('the plain words of a formatted text', () => {
  const value = formatted(
    speech('Someone', line('Where?'), line('Here.')),
    quote([line('“Line”')], 'Source'),
    separator,
    line('A ', bar(4, 'a name'), run(' B', { type: 'strong' })),
  )

  it('say every line, speaker and source, a separator empty and a bar per character', () => {
    expect(textOf(value)).toBe('Someone\nWhere?\nHere.\n“Line”\nSource\n\nA ████ B')
  })

  it('are the lines the renderer cuts, joined', () => {
    expect(linesOf(value)).toHaveLength(7)
    expect(linesOf(value)[5]).toEqual([])
    expect(textOf(value)).toBe(linesOf(value).map(l => l.map(i => i.type === 'text' ? i.text : '█'.repeat(i.attrs.length)).join('')).join('\n'))
  })

  it('are accepted by the boundary, normalised and fresh', () => {
    const read = parseFormatted(standing('foot', formatted(verse(aligned('centre', null, 'a'), line('b')), value.content[0]!)), 'refuse')
    expect(read).toMatchObject({ formatted: { attrs: { stands: 'foot' } } })
    const again = parseFormatted(value, 'refuse')
    expect(again).toEqual(parseFormatted((again as { formatted: unknown }).formatted, 'refuse'))
    expect((again as { formatted: unknown }).formatted).not.toBe(value)
    expect((again as { formatted: { content: { attrs: unknown }[] } }).formatted.content[3]!.attrs).toEqual({ align: null, leading: null })
  })

  it('accepts attrs with every value null, and none at all', () => {
    expect(refused({ type: 'doc', attrs: { stands: null }, content: [{ type: 'line', attrs: { align: null, leading: null } }] })).toBeUndefined()
    expect(refused(doc(para()))).toBeUndefined()
  })
})

describe('the boundary', () => {
  const cases: [string, unknown][] = [
    ['not an object', 'text'],
    ['an array', []],
    ['not a doc', { type: 'line' }],
    ['no content', { type: 'doc' }],
    ['empty content', doc()],
    ['an extra key on the doc', { ...doc(para()), extra: 1 }],
    ['an extra key on a line', doc({ ...para(), extra: 1 })],
    ['an extra key on a mark', doc(para(word('a', [{ type: 'strong', extra: 1 }])))],
    ['an extra key on attrs', doc({ type: 'line', attrs: { align: null, leading: null, x: 1 } })],
    ['an unknown node', doc({ type: 'heading' })],
    ['an unknown style', doc(para(word('a', [{ type: 'glow' }])))],
    ['an attribute outside its enumeration', doc(para(word('a', [{ type: 'colour', attrs: { ink: 'teal', band: false } }])))],
    ['a language outside the Story languages', doc(para(word('a', [{ type: 'language', attrs: { lang: 'xx' } }])))],
    ['a band that is no boolean', doc(para(word('a', [{ type: 'colour', attrs: { ink: 'rose', band: 1 } }])))],
    ['a missing attribute', doc(para(word('a', [{ type: 'size', attrs: {} }])))],
    ['an align outside its enumeration', doc({ type: 'line', attrs: { align: 'left', leading: null } })],
    ['stands outside its enumeration', { type: 'doc', attrs: { stands: 'side' }, content: [para()] }],
    ['an empty text node', doc(para(word('')))],
    ['a text node holding a line break', doc(para(word('a\nb')))],
    ['two styles of one type', doc(para(word('a', [{ type: 'strong' }, { type: 'strong' }])))],
    ['a speech without its speaker', doc({ type: 'speech', content: [para(word('a'))] })],
    ['a speech with no line', doc({ type: 'speech', content: [{ type: 'speaker' }] })],
    ['a quote with no line', doc({ type: 'quote', content: [] })],
    ['a quote of a source alone', doc({ type: 'quote', content: [{ type: 'source' }] })],
    ['a source that is not last', doc({ type: 'quote', content: [para(), { type: 'source' }, para()] })],
    ['two sources', doc({ type: 'quote', content: [para(), { type: 'source' }, { type: 'source' }] })],
    ['a verse with no line', doc({ type: 'verse', content: [] })],
    ['a bar of nought', doc(para({ type: 'redaction', attrs: { length: 0, hides: 'x' } }))],
    ['a bar of half a character', doc(para({ type: 'redaction', attrs: { length: 1.5, hides: 'x' } }))],
    ['a bar hiding no string', doc(para({ type: 'redaction', attrs: { length: 1, hides: 4 } }))],
  ]

  for (const [name, json] of cases) {
    it(`refuses ${name}`, () => {
      expect(refused(json)).toBe('formatted')
    })
  }

  it('refuses what a bar hides past its cap, with its own refusal', () => {
    const hides = (n: number) => doc(para({ type: 'redaction', attrs: { length: 1, hides: 'x'.repeat(n) } }))
    expect(refused(hides(REDACTION_HIDES_MAX_LENGTH))).toBeUndefined()
    expect(refused(hides(REDACTION_HIDES_MAX_LENGTH + 1))).toBe('redactionHides')
    expect(refused(hides(REDACTION_HIDES_MAX_LENGTH + 1), 'drop')).toBe('redactionHides')
  })

  it('refuses words past the cap, bars and separators counted', () => {
    expect(refused(formattedOf('x'.repeat(SHOT_TEXT_MAX_LENGTH)))).toBeUndefined()
    expect(refused(formattedOf('x'.repeat(SHOT_TEXT_MAX_LENGTH + 1)))).toBe('shotTextLong')
    expect(refused(formatted(line(bar(SHOT_TEXT_MAX_LENGTH, 'a'), 'b')))).toBe('shotTextLong')
    expect(refused(formatted(...Array.from({ length: SHOT_TEXT_MAX_LENGTH + 2 }, () => separator)))).toBe('shotTextLong')
    expect(refused(formattedOf('x'.repeat(SHOT_TEXT_MAX_LENGTH + 1)), 'drop')).toBe('shotTextLong')
  })

  it('refuses a bar too long to draw, without drawing it', () => {
    for (const length of [SHOT_TEXT_MAX_LENGTH + 1, 1e9, 1e21]) {
      const json = doc(para({ type: 'redaction', attrs: { length, hides: 'x' } }))
      expect(refused(json)).toBe('shotTextLong')
      expect(refused(json, 'drop')).toBe('shotTextLong')
    }
  })

  it('builds an empty line from an empty string', () => {
    expect(line('')).toEqual({ type: 'line' })
    expect(refused(formatted(line(''), line('', 'a'), speech('', line(''))))).toBeUndefined()
  })

  it('in drop mode, leaves out what it does not know and keeps the words', () => {
    const read = parseFormatted(doc(
      { type: 'heading', content: [word('gone')] },
      { ...para(word('words', [{ type: 'glow' }, { type: 'colour', attrs: { ink: 'teal', band: false } }, { type: 'strong' }]), { type: 'emoji' }), extra: 1 },
    ), 'drop')
    expect(read).toEqual({
      formatted: {
        type: 'doc',
        attrs: { stands: null },
        content: [{
          type: 'line',
          attrs: { align: null, leading: null },
          content: [{ type: 'text', text: 'words', marks: [{ type: 'strong' }] }],
        }],
      },
    })
    const plain = parseFormatted(doc(para(word('words', [{ type: 'glow' }, { type: 'colour', attrs: { ink: 'teal', band: false } }]))), 'drop')
    expect(plain).toMatchObject({ formatted: { content: [{ content: [{ type: 'text', text: 'words' }] }] } })
    expect(JSON.stringify(plain)).not.toContain('marks')
  })

  it('in drop mode, still refuses what is structurally invalid', () => {
    expect(refused(doc({ type: 'speech', content: [para(word('a'))] }), 'drop')).toBe('formatted')
    expect(refused(doc({ type: 'heading' }), 'drop')).toBe('formatted')
    expect(refused(doc(para(word(''))), 'drop')).toBe('formatted')
  })

  /**
   * The editor's schema is the boundary's shape as ProseMirror holds it, so the
   * two are held against each other: every text the boundary takes the editor
   * holds and writes back exactly as the boundary reads it, and the structure the
   * boundary refuses the editor cannot hold. ProseMirror checks structure and
   * not values — an extra key, a value outside its enumeration, a run holding a
   * line break and a bar of nought are the boundary's alone, so only the cases
   * the two agree on are asked of it.
   */
  describe('and the editor’s schema', () => {
    const schema = getSchema(extensions())
    const accepted = [
      ...workTexts.map(formattedOf),
      ...workFormatted,
      formattedOf(''),
      formattedOf('\n\nb'),
      formatted(
        speech('Someone', line('Where?'), line('Here.')),
        quote([line('“Line”')], 'Source'),
        quote([line('a'), line('b')]),
        separator,
        line('A ', bar(4, 'a name'), run(' B', { type: 'strong' })),
      ),
      standing('foot', formatted(verse(aligned('centre', 'tight', 'a'), line('b')), speech('', line('')))),
      formatted(line(
        run('every', { type: 'emphasis' }, { type: 'strong' }, { type: 'underline' }, { type: 'strike' }, { type: 'smallCaps' }),
        run('style', { type: 'script', attrs: { place: 'super' } }, { type: 'size', attrs: { step: 'largest' } }),
        run('at once', { type: 'face', attrs: { face: 'typewriter' } }, { type: 'colour', attrs: { ink: 'rose', band: true } },
          { type: 'spacing', attrs: { step: 'wide' } }, { type: 'language', attrs: { lang: 'fr' } }),
      )),
    ]

    it('holds every text the boundary takes, and writes it back as the boundary reads it', () => {
      for (const json of accepted) {
        const read = parseFormatted(json, 'refuse') as { formatted: Formatted }
        const held = schema.nodeFromJSON(json)
        held.check()
        expect(held.toJSON()).toEqual(read.formatted)
      }
    })

    const structural = [
      'not an object', 'an array', 'no content', 'empty content', 'an unknown node', 'an unknown style',
      'a missing attribute', 'an empty text node', 'two styles of one type', 'a speech without its speaker',
      'a speech with no line', 'a quote with no line', 'a quote of a source alone', 'a source that is not last',
      'two sources', 'a verse with no line',
    ]

    for (const [name, json] of cases.filter(([name]) => structural.includes(name))) {
      it(`cannot hold ${name}`, () => {
        expect(() => schema.nodeFromJSON(json).check()).toThrow()
      })
    }
  })
})

/** The editor's acts, read on a state the way the toolbar and the keys drive them. */
describe('the editor', () => {
  const schema = getSchema(extensions())
  const stateOf = (value: Formatted, from = 1, to = from) => {
    const held = schema.nodeFromJSON(value)
    return EditorState.create({ doc: held, plugins: [bounds()], selection: TextSelection.create(held, from, to) })
  }
  const act = (state: EditorState, command: Command) => {
    let after = state
    const ran = command(state, tr => {
      after = state.apply(tr)
    })
    return { ran, after, written: after.doc.toJSON() as Formatted }
  }
  const takes = (value: Formatted) => 'formatted' in parseFormatted(value, 'refuse')

  it('reads pasted plain text a line per line, blank lines kept', () => {
    const slice = pastedText('one\n\n  three\r\nfour', schema)
    expect(slice.openStart).toBe(1)
    expect(textOf({ type: 'doc', content: slice.content.toJSON() })).toBe('one\n\n  three\nfour')
  })

  it('reads a pasted line break inside a run as a space', () => {
    const plugin = bounds()
    const pasted = new Slice(Fragment.from(schema.nodes.line!.create(null, schema.text('a\nb'))), 1, 1)
    const read = plugin.props.transformPasted!.call(plugin, pasted, undefined as never, false)
    expect(read.content.firstChild!.textContent).toBe('a b')
  })

  it('refuses a change past the cap, and takes one up to it', () => {
    const full = stateOf(formattedOf('x'.repeat(SHOT_TEXT_MAX_LENGTH - 1)))
    const one = full.apply(full.tr.insertText('y', 1))
    expect(textOf(one.doc.toJSON())).toHaveLength(SHOT_TEXT_MAX_LENGTH)
    expect(one.apply(one.tr.insertText('z', 1)).doc).toBe(one.doc)
  })

  it('leaves a bar bare of any style laid over it', () => {
    const state = stateOf(formatted(line('a ', bar(2, ''), ' b')))
    const after = state.apply(state.tr.addMark(1, state.doc.content.size - 1, schema.marks.strong!.create()))
    const written = after.doc.toJSON() as Formatted
    expect(takes(written)).toBe(true)
    expect(JSON.stringify(written)).toContain('"marks":[{"type":"strong"}]')
  })

  it('draws a bar to the ear as the box does, its words in its name and never beside it', () => {
    const drawn = (hides: string) => schema.nodes.redaction!.spec.toDOM!(schema.nodes.redaction!.create({ length: 3, hides }))
    expect(drawn('a name')).toEqual(['span', { class: 'bar', 'data-length': '3', role: 'img', 'aria-label': 'a name' }, '███'])
    expect(drawn('')).toEqual(['span', { class: 'bar', 'data-length': '3', 'aria-hidden': 'true' }, '███'])
  })

  it('redacts a selection behind a bar as long as its plain words, and selects the bar', () => {
    const state = stateOf(formatted(line('a secret name'), line('kept')), 3, 9)
    const { ran, after, written } = act(state, redact)
    expect(ran).toBe(true)
    expect(textOf(written)).toBe('a ██████ name\nkept')
    expect(after.selection).toBeInstanceOf(NodeSelection)
    expect((after.selection as NodeSelection).node.attrs).toEqual({ length: 6, hides: '' })
    expect(takes(written)).toBe(true)

    const across = act(stateOf(formatted(line('ab'), line('cd')), 2, 6), redact)
    expect(textOf(across.written)).toBe('a███d')
    expect(redact(stateOf(formatted(line('ab'))))).toBe(false)
  })

  it('offers no bar where the selection holds no character of the plain words', () => {
    const empty = stateOf(formatted(line()))
    const all = empty.apply(empty.tr.setSelection(new AllSelection(empty.doc)))
    expect(all.selection.empty).toBe(false)
    expect(redact(all)).toBe(false)
    expect(act(all, redact).ran).toBe(false)

    // From the end of the speaker to the head of its line: joining them takes no
    // character away, so a bar there would stand for nothing.
    const seam = stateOf(formatted(speech('A', line('B'))), 3, 5)
    expect(redact(seam)).toBe(false)
    expect(act(seam, redact).written).toEqual(seam.doc.toJSON())
  })

  it('adds a separator after the caret’s line, out of whatever holds it', () => {
    const { written } = act(stateOf(formatted(quote([line('a')]), line('b')), 2), addSeparator)
    expect(written.content.map(block => block.type)).toEqual(['quote', 'separator', 'line'])
  })

  it('makes the lines the caret is in someone speaking, a quotation, verse or paragraphs, caret kept', () => {
    const two = stateOf(formatted(line('Someone'), line('Where?')), 2, 10)
    expect(lineKindOf(two)).toBe('paragraph')

    const spoken = act(two, lineAs('speech'))
    expect(spoken.written.content).toEqual([{ type: 'speech', content: [{ type: 'speaker' }, ...formatted(aligned(null, null, 'Someone'), aligned(null, null, 'Where?')).content] }])
    expect(lineKindOf(spoken.after)).toBe('speech')
    expect(spoken.after.selection.$from.parent.textContent).toBe('Someone')
    expect(spoken.after.selection.$from.parentOffset).toBe(1)

    const quoted = act(spoken.after, lineAs('quote'))
    expect(textOf(quoted.written)).toBe('\nSomeone\nWhere?')
    expect(quoted.written.content.map(block => block.type)).toEqual(['quote'])

    const verses = act(quoted.after, lineAs('verse'))
    expect(verses.written.content.map(block => block.type)).toEqual(['verse'])
    expect(lineKindOf(verses.after)).toBe('verse')

    const plain = act(verses.after, lineAs('paragraph'))
    expect(plain.written.content.map(block => block.type)).toEqual(['line', 'line', 'line'])
    for (const { written } of [spoken, quoted, verses, plain]) expect(takes(written)).toBe(true)
  })

  it('makes a quotation’s last line its source, and no other line', () => {
    const state = (at: number) => stateOf(formatted(quote([line('a'), line('b')])), at)
    expect(lineAs('source')(state(2))).toBe(false)
    const { written, after } = act(state(5), lineAs('source'))
    expect(written.content).toEqual([quote([aligned(null, null, 'a')], 'b')])
    expect(lineKindOf(after)).toBe('source')
    expect(lineAs('source')(stateOf(formatted(quote([line('a')])), 2))).toBe(false)
  })
})

describe('the formatted text of a row', () => {
  const held = formatted(line('a ', run('b', { type: 'emphasis' })))

  it('is the plain words read as formatted where none is stored', () => {
    expect(formattedIn({ formatted: null, text: 'a\nb' })).toEqual(formattedOf('a\nb'))
  })

  it('is the stored text where it agrees with the plain words', () => {
    const json = JSON.parse(JSON.stringify(parseFormatted(held, 'refuse')))
    expect(formattedIn({ formatted: json.formatted, text: 'a b' })).toEqual(json.formatted)
  })

  it('is the plain words where a rollback wrote them alone', () => {
    expect(formattedIn({ formatted: held, text: 'changed' })).toEqual(formattedOf('changed'))
  })

  it('leaves out a style it does not know where the words agree', () => {
    const stored = doc(para(word('a b', [{ type: 'emphasis' }, { type: 'glow' }])))
    const read = formattedIn({ formatted: stored, text: 'a b' })
    expect(read.content).toEqual([{ type: 'line', attrs: { align: null, leading: null }, content: [run('a b', { type: 'emphasis' })] }])
  })
})
