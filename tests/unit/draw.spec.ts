import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { drawFormatted } from '../../app/utils/draw.ts'
import type { TextCut } from '../../app/utils/draw.ts'
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
const drawn = (value: Formatted, cut?: TextCut) => renderToString(h('div', drawFormatted(value, cut)))

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
