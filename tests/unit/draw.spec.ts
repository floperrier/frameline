import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { drawFormatted, standInsOf, takesApart } from '../../app/utils/draw.ts'
import type { Moving, TextCut } from '../../app/utils/draw.ts'
import {
  ALIGNS,
  FACES,
  INKS,
  LEADINGS,
  SIZES,
  SPACINGS,
  aligned,
  bar,
  formatted,
  line,
  quote,
  run,
  separator,
  speech,
  verse,
} from '../../shared/utils/formatted.ts'
import type { Formatted, Style } from '../../shared/utils/formatted.ts'

/**
 * What the renderer draws, read as the markup the server sends: a pure function
 * of the formatted text, so the whole of it answers to a string.
 */
const drawn = (value: Formatted, cut?: TextCut, moving?: Moving) =>
  renderToString(h('div', drawFormatted(value, cut, moving)))

const emphasis: Style = { type: 'emphasis' }

describe('a formatted text drawn', () => {
  it('sets a run in the element its style is', async () => {
    expect(await drawn(formatted(line('a ', run('soft', emphasis), ' word'))))
      .toBe('<div><p>a <em>soft</em> word</p></div>')
  })

  it('quotes in a blockquote and gives the source outside it', async () => {
    expect(await drawn(formatted(quote([line('Call me Ishmael.')], 'Melville'))))
      .toBe('<div><figure class="quote"><blockquote><p>Call me Ishmael.</p></blockquote>'
        + '<figcaption class="source">Melville</figcaption></figure></div>')
  })

  it('says a phrase in its own language', async () => {
    expect(await drawn(formatted(line(run('merci', { type: 'language', attrs: { lang: 'fr' } })))))
      .toBe('<div><p><span lang="fr">merci</span></p></div>')
  })

  it('draws a bar a block a character, says what it hides, and holds no other words', async () => {
    expect(await drawn(formatted(line(bar(4, 'a name')))))
      .toBe('<div><p><span class="bar" data-length="4"><span aria-hidden="true">████</span>'
        + '<span class="visually-hidden">a name</span></span></p></div>')
    expect(await drawn(formatted(line(bar(2, '')))))
      .toBe('<div><p><span class="bar" data-length="2"><span aria-hidden="true">██</span></span></p></div>')
  })

  it('never reads an Author\'s words as markup', async () => {
    const markup = await drawn(formatted(line(run('<img src=x onerror=alert(1)>'))))
    expect(markup).toContain('&lt;img')
    expect(markup).not.toContain('<img')
  })

  it('writes no class and no attribute outside its enumerations', async () => {
    const styles: Style[] = [
      { type: 'emphasis' }, { type: 'strong' }, { type: 'underline' }, { type: 'strike' },
      { type: 'smallCaps' },
      ...(['super', 'sub'] as const).map(place => ({ type: 'script', attrs: { place } }) as Style),
      ...SIZES.map(step => ({ type: 'size', attrs: { step } }) as Style),
      ...FACES.map(face => ({ type: 'face', attrs: { face } }) as Style),
      ...INKS.flatMap(ink => [true, false].map(band => ({ type: 'colour', attrs: { ink, band } }) as Style)),
      ...SPACINGS.map(step => ({ type: 'spacing', attrs: { step } }) as Style),
      { type: 'language', attrs: { lang: 'de' } },
    ]
    const markup = await drawn(formatted(
      line(...styles.map(style => run('word ', style)), bar(3, 'hidden')),
      ...ALIGNS.flatMap(align => LEADINGS.map(leading => aligned(align, leading, 'set'))),
      quote([line('quoted')], 'source'),
      speech('Someone', line('says')),
      verse(line('one'), line('two')),
      separator,
    ))

    const known = new Set([
      'small-caps', 'band', 'bar', 'visually-hidden', 'quote', 'source', 'speech', 'speaker', 'verse',
      ...SIZES.map(s => `size-${s}`), ...FACES.map(f => `face-${f}`), ...INKS.map(i => `ink-${i}`),
      ...SPACINGS.map(s => `spacing-${s}`), ...ALIGNS.map(a => `align-${a}`),
      ...LEADINGS.map(l => `leading-${l}`),
    ])
    const classes = [...markup.matchAll(/ class="([^"]*)"/g)].flatMap(([, value]) => value!.split(' '))
    expect(classes.filter(token => !known.has(token))).toEqual([])
    expect(classes).toEqual(expect.arrayContaining(['size-largest', 'ink-violet', 'band', 'align-centre']))

    const attributes = new Set([...markup.matchAll(/ ([a-z-]+)="/g)].map(([, name]) => name))
    expect([...attributes].sort()).toEqual(['aria-hidden', 'class', 'data-length', 'lang'])
    expect([...markup.matchAll(/ lang="([^"]*)"/g)].map(([, lang]) => lang)).toEqual(['de'])
    expect(markup).toContain('<hr>')
  })
})

describe('a formatted text cut into what it arrives by', () => {
  const unit = (from: number) => ({ 'data-from': String(from) })

  it('draws each unit after the first in a piece of its own, inside the style of its run', async () => {
    expect(await drawn(formatted(line(run('one '), run('two', emphasis))), { by: 'word', unit }))
      .toBe('<div><p>one <em><span data-from="4">two</span></em></p></div>')
  })

  it('cuts at the edges the plain words are cut at, a line break between two lines', async () => {
    expect(await drawn(formatted(line('one'), line('two three')), { by: 'word', unit }))
      .toBe('<div><p>one</p><p><span data-from="4">two</span> <span data-from="8">three</span></p></div>')
  })

  it('draws a bar as one piece, arriving when its last character would', async () => {
    expect(await drawn(formatted(line('a ', bar(3, ''))), { by: 'letter', unit }))
      .toBe('<div><p>a <span data-from="4"><span class="bar" data-length="3">'
        + '<span aria-hidden="true">███</span></span></span></p></div>')
  })
})

describe('a run carrying an Effect', () => {
  const moving: Moving = effect => ({ 'data-effect': effect.effect, 'data-strength': effect.strength })
  const scramble: Style = { type: 'arrives', attrs: { effect: 'scramble', over: 1200, strength: 'marked' } }
  const wave: Style = { type: 'lasts', attrs: { effect: 'wave', every: 1600, strength: 'slight' } }
  const flicker: Style = { type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } }
  const shake: Style = { type: 'arrives', attrs: { effect: 'shake', over: 500, strength: 'slight' } }

  it('is drawn as a run, and moves nowhere but the Reading', async () => {
    expect(await drawn(formatted(line('the ', run('lamp', flicker))))).toBe('<div><p>the <span class="run">lamp</span></p></div>')
  })

  it('flickers on its own inline element', async () => {
    expect(await drawn(formatted(line('the ', run('lamp', flicker))), undefined, moving))
      .toBe('<div><p>the <span class="effect" data-effect="flicker" data-strength="slight">lamp</span></p></div>')
  })

  it('shakes by the word, its spaces left to break the line', async () => {
    const html = await drawn(formatted(line(run('break it', shake))), undefined, moving)
    expect(html.match(/class="word"/g)).toHaveLength(2)
    expect(html).toContain('<span class="gap"> </span>')
  })

  it('waves by the letter, each letter an element of its own a little behind the last', async () => {
    const html = await drawn(formatted(line(run('sea', wave))), undefined, moving)
    expect(html.match(/class="letter" data-effect="wave"/g)).toHaveLength(3)
    expect(html).toContain('--phase:0;')
    expect(html).toContain('--phase:0.0833')
  })

  it('reads a run across two leaves as one, for its stagger', async () => {
    const html = await drawn(formatted(line(run('ab', scramble), run('cd', scramble, { type: 'emphasis' }))), undefined, moving)
    // Four letters, so the last resolves at the whole of `over`.
    expect(html).toContain('--step:0.25')
    expect(html).toContain('--step:1')
  })

  it('scrambles a letter under its stand-ins and leaves punctuation be', async () => {
    const html = await drawn(formatted(line(run('a,', scramble))), undefined, moving)
    expect(html.match(/class="stand-in"/g)).toHaveLength(2)
    expect(html).toContain('<span class="glyph" data-effect="scramble"')
    expect(html).toContain(',')
  })

  it('draws a scramble and a wave over the same letters, the scramble inside the wave', async () => {
    const html = await drawn(formatted(line(run('a', scramble, wave))), undefined, moving)
    expect(html).toMatch(/class="letter" data-effect="wave"[^>]*><span class="glyph" data-effect="scramble"/)
  })

  it('cuts its letters inside the units a text arrives by', async () => {
    const html = await drawn(formatted(line(run('ab cd', wave))), {
      by: 'word', unit: from => ({ class: 'unit', 'data-from': String(from) }),
    }, moving)
    expect(html).toMatch(/<span class="unit" data-from="3"><span class="letter"/)
  })

  it('draws a scramble over three words and a tremor over the last two, both', async () => {
    const tremor: Style = { type: 'lasts', attrs: { effect: 'tremor', every: 300, strength: 'slight' } }
    const html = await drawn(formatted(line(run('one ', scramble), run('two three', scramble, tremor))), undefined, moving)
    expect(html.match(/class="glyph" data-effect="scramble"/g)).toHaveLength(11)
    expect(html.match(/class="letter" data-effect="tremor"/g)).toHaveLength(8)
    // The scramble is one run over both leaves: its fourth letter of eleven, the tremor's first.
    expect(html).toContain('<span class="letter" data-effect="tremor" data-strength="slight" style="--phase:0;">'
      + '<span class="glyph" data-effect="scramble" data-strength="marked" style="--step:0.36363636363636365;">t</span>')
  })

  it('draws a space inside a run taken apart into letters as a gap, never a letter', async () => {
    const html = await drawn(formatted(line(run('a b', wave))), undefined, moving)
    expect(html.match(/class="letter"/g)).toHaveLength(2)
    expect(html).toContain('<span class="gap"> </span>')
    expect(html).not.toMatch(/class="letter"[^>]*>\s/)
  })

  it('draws a run once around all its leaves, a word in it in italic and all', async () => {
    const html = await drawn(formatted(line(run('so un', wave), run('do', wave, emphasis), run('ne it', wave))), undefined, moving)
    expect(html).toMatch(/^<div><p><span class="apart" style="">.*<em><span class="letter".*<\/em>.*<\/span><\/p><\/div>$/)
    expect(html.match(/class="apart"/g)).toHaveLength(1)
    expect(html).not.toContain('\u2060')
  })

  it('joins a run to the rest of a word it starts or ends inside, and never across a space', async () => {
    // Inside the root where the run starts, under its `white-space`; outside it
    // where the word goes on past the run's end.
    expect(await drawn(formatted(line('un', run('done', wave), '!')), undefined, moving))
      .toMatch(/^<div><p>un<span class="apart" style="">\u2060<span class="letter".*<\/span>\u2060!<\/p><\/div>$/)
    // Two runs meeting inside a word: the joiner is inside the second one's root.
    expect(await drawn(formatted(line(run('un', scramble), run('done', wave))), undefined, moving))
      .toMatch(/<\/span><span class="apart" style="">\u2060<span class="letter"[^>]*>d</)
    expect(await drawn(formatted(line('so ', run('done', wave), ' it')), undefined, moving)).not.toContain('\u2060')
    expect(await drawn(formatted(line('so', run(' done ', wave), 'it')), undefined, moving)).not.toContain('\u2060')
    // Nothing joins a run that is not taken apart, nor the copy drawn still.
    expect(await drawn(formatted(line('un', run('done', flicker))), undefined, moving)).not.toContain('\u2060')
    expect(await drawn(formatted(line('un', run('done', wave))))).not.toContain('\u2060')
  })

  it('stands in for a letter with others of its case, the same ones every time, never itself', () => {
    expect(standInsOf('a', 0, 'strong')).toHaveLength(3)
    expect(standInsOf('a', 0, 'slight')).toEqual(standInsOf('a', 0, 'slight'))
    expect(standInsOf('A', 4, 'marked').every(s => /^[A-Z]$/.test(s) && s !== 'A')).toBe(true)
    expect(standInsOf('é', 2, 'marked').every(s => /^[a-z]$/.test(s))).toBe(true)
    expect(standInsOf('7', 1, 'slight').every(s => /^\d$/.test(s) && s !== '7')).toBe(true)
    expect(standInsOf('—', 0, 'strong')).toEqual([])
  })

  it('says whether a text has a run taken apart', () => {
    expect(takesApart(formatted(line(run('lamp', flicker))))).toBe(false)
    expect(takesApart(formatted(line(run('sea', wave))))).toBe(true)
  })
})
