import { getSchema } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { AllSelection, EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { Command } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { REEL_CHANGE } from '../../demonstration/reel-change.ts'
import { SAMPLES } from '../../demonstration/samples.ts'
import { wordsOf } from '../../demonstration/work.ts'
import {
  addSeparator,
  bounds,
  effectHeld,
  extensions,
  lineAs,
  lineKindOf,
  pastedText,
  redact,
  runEffect,
  takeEffectOff,
  wordsSaid,
} from '../../app/utils/formatting.ts'
import {
  aligned,
  bar,
  formatted,
  formattedIn,
  formattedOf,
  line,
  linesOf,
  lettersSplit,
  parseFormatted,
  quote,
  run,
  runsSaid,
  separator,
  speech,
  standing,
  textOf,
  verse,
} from '../../shared/utils/formatted.ts'
import type { Formatted } from '../../shared/utils/formatted.ts'
import { LETTERS_SPLIT_MAX, REDACTION_HIDES_MAX_LENGTH, SHOT_TEXT_MAX_LENGTH } from '../../shared/utils/scenes.ts'

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
        // The editor holds a lasting's absent `every` as null, which the boundary reads as none.
        expect((parseFormatted(held.toJSON(), 'refuse') as { formatted: Formatted }).formatted).toEqual(read.formatted)
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

  describe('an Effect on the words', () => {
    const tremor = { effect: 'tremor', every: 300, strength: 'slight' } as const
    const scramble = { type: 'arrives', attrs: { effect: 'scramble', over: 1200, strength: 'slight' } } as const

    it('marks the selection, and the boundary takes what the editor writes', () => {
      // "break it" is positions 1–9 in a one-line doc.
      const { written } = act(stateOf(formatted(line('break it now')), 1, 9), runEffect('lasts', tremor))
      const read = parseFormatted(written, 'refuse')
      expect('formatted' in read && linesOf(read.formatted)[0]).toEqual([
        { type: 'text', text: 'break it', marks: [{ type: 'lasts', attrs: tremor }] },
        { type: 'text', text: ' now' },
      ])
    })

    it('writes a flicker the boundary reads without a round', () => {
      const { written } = act(stateOf(formatted(line('lamp')), 1, 5), runEffect('lasts', { effect: 'flicker', strength: 'slight' }))
      const read = parseFormatted(written, 'refuse')
      expect('formatted' in read && linesOf(read.formatted)[0]![0]).toEqual(
        { type: 'text', text: 'lamp', marks: [{ type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } }] })
    })

    it('changes the whole run the caret is in where nothing is selected, its end among it', () => {
      const marked = formatted(line('a ', run('break it', { type: 'lasts', attrs: tremor }), ' now'))
      for (const at of [5, 11]) {
        const { written } = act(stateOf(marked, at), runEffect('lasts', { ...tremor, strength: 'strong' }))
        expect(linesOf(written)[0]![1]).toMatchObject({ text: 'break it', marks: [{ type: 'lasts', attrs: { strength: 'strong' } }] })
      }
    })

    it('takes both Effects off the run the caret is in, each over its own extent', () => {
      const marked = formatted(line(run('ab ', scramble), run('cd', scramble, { type: 'lasts', attrs: tremor })))
      const { written } = act(stateOf(marked, 5), takeEffectOff)
      expect(textOf(written)).toBe('ab cd')
      expect(linesOf(written)[0]).toEqual([{ type: 'text', text: 'ab cd' }])
    })

    it('offers neither where the caret is in no run and nothing is selected', () => {
      expect(wordsSaid(stateOf(formatted(line('plain')), 2))).toBeUndefined()
      expect(takeEffectOff(stateOf(formatted(line('plain')), 2))).toBe(false)
    })

    it('reads the run at its head where it writes, so a strength changed keeps its round', () => {
      // The caret at 3 stands between "a " and "break it".
      const state = stateOf(formatted(line('a ', run('break it', { type: 'lasts', attrs: tremor }), ' now')), 3)
      const held = effectHeld(state, 'lasts')
      expect(held).toEqual(tremor)
      expect(effectHeld(state, 'arrives')).toBeUndefined()
      const { written } = act(state, runEffect('lasts', { ...held!, strength: 'strong' }))
      expect(linesOf(written)[0]![1]).toEqual(
        { type: 'text', text: 'break it', marks: [{ type: 'lasts', attrs: { ...tremor, strength: 'strong' } }] })
    })

    it('writes where two runs meet on the run it read, and leaves the other be', () => {
      const pulse = { effect: 'pulse', every: 900, strength: 'marked' } as const
      const state = stateOf(formatted(line(run('ab', { type: 'lasts', attrs: tremor }), run('cd', { type: 'lasts', attrs: pulse }))), 3)
      const held = effectHeld(state, 'lasts')
      expect(held).toEqual(pulse)
      const { written } = act(state, runEffect('lasts', { ...held!, strength: 'strong' }))
      expect(linesOf(written)[0]).toEqual([
        { type: 'text', text: 'ab', marks: [{ type: 'lasts', attrs: tremor }] },
        { type: 'text', text: 'cd', marks: [{ type: 'lasts', attrs: { ...pulse, strength: 'strong' } }] },
      ])
    })

    // A scramble over "break it now", positions 1–13, and a tremor over "it", 7–9.
    const nested = formatted(line(run('break ', scramble), run('it', scramble, { type: 'lasts', attrs: tremor }), run(' now', scramble)))

    it('changes one Effect over its own run, not over the other’s', () => {
      const { written } = act(stateOf(nested, 8), runEffect('lasts', { ...tremor, strength: 'strong' }))
      expect(linesOf(written)[0]).toEqual([
        { type: 'text', text: 'break ', marks: [scramble] },
        { type: 'text', text: 'it', marks: [scramble, { type: 'lasts', attrs: { ...tremor, strength: 'strong' } }] },
        { type: 'text', text: ' now', marks: [scramble] },
      ])
    })

    it('takes one Effect off and keeps the other', () => {
      expect(linesOf(act(stateOf(nested, 8), runEffect('lasts', null)).written)[0]).toEqual(
        [{ type: 'text', text: 'break it now', marks: [scramble] }])
      expect(linesOf(act(stateOf(nested, 8), runEffect('arrives', null)).written)[0]).toEqual([
        { type: 'text', text: 'break ' },
        { type: 'text', text: 'it', marks: [{ type: 'lasts', attrs: tremor }] },
        { type: 'text', text: ' now' },
      ])
    })

    it('takes nothing off a run a selection only starts at the end of', () => {
      expect(takeEffectOff(stateOf(formatted(line(run('ab', { type: 'lasts', attrs: tremor }), 'cd')), 3, 5))).toBe(false)
    })
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

describe('a run carrying an Effect', () => {
  const arrives = (effect: string, over = 1200, strength = 'slight') => ({ type: 'arrives', attrs: { effect, over, strength } })
  const lasts = (attrs: object) => ({ type: 'lasts', attrs })
  const letters = (count: number) => 'a'.repeat(count)

  it('takes an arrival and a lasting on the same words, and reads them back as written', () => {
    const json = doc(para(word('break it', [arrives('scramble'), lasts({ effect: 'tremor', every: 300, strength: 'slight' })])))
    const read = parseFormatted(json, 'refuse')
    expect('formatted' in read && read.formatted.content[0]).toMatchObject(json.content[0] as object)
  })

  it('reads a lasting the editor wrote with an empty round as one without a round', () => {
    const read = parseFormatted(doc(para(word('lamp', [lasts({ effect: 'flicker', every: null, strength: 'slight' })]))), 'refuse')
    expect('formatted' in read && linesOf(read.formatted)[0]![0]).toEqual(
      { type: 'text', text: 'lamp', marks: [{ type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } }] })
  })

  it('refuses a wave as an arrival, and a scramble that lasts, in #360’s own phrases', () => {
    expect(refused(doc(para(word('sea', [arrives('wave')]))))).toBe('effectArrives')
    expect(refused(doc(para(word('sea', [lasts({ effect: 'scramble', strength: 'slight' })]))))).toBe('effectLasts')
    expect(refused(doc(para(word('sea', [lasts({ effect: 'pulse', strength: 'slight' })]))))).toBe('effectLasts')
  })

  it('drops an Effect it does not know from a row read back, and keeps the words', () => {
    const read = parseFormatted(doc(para(word('sea', [arrives('wave')]))), 'drop')
    expect('formatted' in read && textOf(read.formatted)).toBe('sea')
  })

  it('takes 300 letters taken apart, and refuses 301', () => {
    expect(refused(doc(para(word(letters(LETTERS_SPLIT_MAX), [lasts({ effect: 'wave', every: 1600, strength: 'slight' })]))))).toBeUndefined()
    expect(refused(doc(para(word(letters(LETTERS_SPLIT_MAX + 1), [lasts({ effect: 'wave', every: 1600, strength: 'slight' })]))))).toBe('lettersSplit')
  })

  it('counts letters only, a letter under two letter Effects once, and none under a flicker', () => {
    const value = formatted(line(
      run('ab cd', { type: 'arrives', attrs: { effect: 'scramble', over: 1200, strength: 'slight' } },
        { type: 'lasts', attrs: { effect: 'tremor', every: 300, strength: 'slight' } }),
      run(' lamp', { type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } }),
    ))
    expect(lettersSplit(value)).toBe(4)
    // 200 letters under two overlapping letter marks are 200.
    const twice = doc(para(word(letters(200), [arrives('scramble'), lasts({ effect: 'wave', every: 1600, strength: 'slight' })])))
    expect(refused(twice)).toBeUndefined()
    expect(lettersSplit((parseFormatted(twice, 'refuse') as { formatted: Formatted }).formatted)).toBe(200)
  })

  it('refuses two arrivals on one word, as it refuses any style twice', () => {
    expect(refused(doc(para(word('a', [arrives('shake'), arrives('scramble')]))))).toBe('formatted')
  })
})

describe('a formatted text said run by run', () => {
  const written = formatted(
    line('A ', run('{coat}', { type: 'emphasis' })),
    speech('{who}', line('x')),
    line('a ', bar(4, 'wolf')),
  )
  const said = runsSaid(written, text => text.toUpperCase())

  it('puts every text leaf through the function and keeps the marks and the blocks', () => {
    expect(said.content.map(block => block.type)).toEqual(written.content.map(block => block.type))
    expect(linesOf(said)[0]).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'text', text: '{COAT}', marks: [{ type: 'emphasis' }] },
    ])
  })

  it('leaves a bar as it was, and reads as the said plain words', () => {
    expect(linesOf(said)[2]![1]).toEqual(linesOf(written)[2]![1])
    expect(textOf(said)).toBe('A {COAT}\n{WHO}\nX\nA ████')
  })
})
