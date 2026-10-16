import { describe, expect, it } from 'vitest'
import {
  FIND_MAX_LENGTH, foundIn, placeNamed, placesIn, replacedFormatted, replacedText, replacements, rowOf, textRuns,
} from '../../shared/utils/found.ts'
import type { Found } from '../../shared/utils/found.ts'
import { SHOT_TEXT_MAX_LENGTH } from '../../shared/utils/scenes.ts'
import type { Exit, Scene, Shot } from '../../shared/utils/scenes.ts'
import { bar, formatted, formattedOf, line, parseFormatted, quote, run, speech } from '../../shared/utils/formatted.ts'
import type { Formatted } from '../../shared/utils/formatted.ts'

/**
 * Where a word is found in a Story, and what writing another in its place
 * changes. Pure functions over the Story the bench holds, so a literal answers
 * for each: no database, no browser.
 */

function shot(id: string, words: Formatted | string, extra: Partial<Shot> = {}): Shot {
  return {
    id,
    text: '',
    formatted: typeof words === 'string' ? formattedOf(words) : words,
    position: 0,
    image: null,
    description: '',
    conditions: [],
    sound: null,
    transcript: '',
    cutAfter: null,
    cutOver: null,
    cutThrough: null,
    layout: null,
    cropX: 50,
    cropY: 50,
    imageArrives: null,
    imageLasts: null,
    textArrives: null,
    textLasts: null,
    textAfter: null,
    textBy: null,
    textPace: null,
    textOver: null,
    textStays: null,
    movementBy: null,
    movementDirection: null,
    movementOver: null,
    ...extra,
  } as Shot
}

function scene(id: string, shots: Shot[], extra: Partial<Scene> = {}): Scene {
  return {
    id,
    name: id,
    sets: {},
    shots,
    sound: null,
    soundOfSceneId: null,
    transcript: '',
    soundLoops: true,
    cutAfter: null,
    cutOver: 0,
    cutThrough: 'image',
    exitsAfter: null,
    layout: 'inset',
    movementBy: 0,
    movementDirection: 'closer',
    movementOver: 0,
    textAfter: 0,
    textBy: 'whole',
    textPace: 15,
    textOver: 0,
    textStays: null,
    question: '',
    questionFlag: '',
    x: 0,
    y: 0,
    ...extra,
  } as unknown as Scene
}

function exit(id: string, from: string, to: string, text: string): Exit {
  return {
    id, fromSceneId: from, toSceneId: to, text, position: 0, conditions: [], stepsBack: null, cutOver: 0, cutThrough: 'image',
  }
}

function story(scenes: Scene[], exits: Exit[] = [], language = 'en'): Found {
  return { scenes, exits, openingSceneId: scenes[0]?.id ?? null, language }
}

const lone = (words: Formatted | string, extra: Partial<Shot> = {}, scenes: Partial<Scene> = {}) =>
  story([scene('s', [shot('a', words, extra)], scenes)])

const spans = (text: string, find: string, matchCase = false, declared: string[] = [], language = 'en') =>
  foundIn(text, { find, matchCase, language }, new Set(declared))

describe('how a place matches', () => {
  it('folds case unless told to match it', () => {
    const held = story([scene('s', [shot('a', 'coat Coat COAT')])])
    expect(placesIn(held, 'coat', false).map(p => p.from)).toEqual([0, 5, 10])
    expect(placesIn(held, 'coat', true).map(p => p.from)).toEqual([0])
  })

  it('folds case in the Language of the Story', () => {
    expect(spans('İ', 'i', false, [], 'tr')).toEqual([{ from: 0, to: 1 }])
  })

  it('finds a composed and a decomposed letter alike, and never folds an accent', () => {
    const composed = 'café'
    const decomposed = 'café'
    expect(spans(composed, composed)).toHaveLength(1)
    expect(spans(composed, decomposed)).toHaveLength(1)
    expect(spans(decomposed, composed)).toEqual([{ from: 0, to: 5 }])
    expect(spans(decomposed, decomposed)).toHaveLength(1)
    expect(spans(composed, 'cafe')).toEqual([])
    expect(spans(decomposed, 'cafe')).toEqual([])
    expect(spans(decomposed, 'e')).toEqual([])
  })

  it('leaves a word named between braces by a declared Flag alone', () => {
    const held = lone('Her {coat} and her coat', {}, { sets: { coat: 'red' } })
    const places = placesIn(held, 'coat', false)
    expect(places).toHaveLength(1)
    expect(places[0]!.from).toBe(19)
    const [{ value }] = replacements(held, places, 'cloak')
    expect(textRuns(value as Formatted).map(r => r.text)).toEqual(['Her {coat} and her cloak'])
    expect(placesIn(lone('a {hat}'), 'hat', false)).toHaveLength(1)
  })

  it('does not find a word split across two runs', () => {
    expect(placesIn(lone(formatted(line(run('ca'), run('fé', { type: 'emphasis' })))), 'café', false)).toEqual([])
  })

  it('never overlaps two matches', () => {
    expect(spans('aaaa', 'aa')).toEqual([{ from: 0, to: 2 }, { from: 2, to: 4 }])
  })

  it('finds nothing for nothing', () => {
    expect(spans('anything', '')).toEqual([])
    expect(FIND_MAX_LENGTH).toBe(SHOT_TEXT_MAX_LENGTH)
  })
})

describe('what replacing writes', () => {
  const written = (words: Formatted, find: string, replace: string) => {
    const held = lone(words)
    return replacements(held, placesIn(held, find, false), replace).map(r => r.value as Formatted)
  }

  it('takes the style of the run it stands in', () => {
    const [value] = written(formatted(line('a ', run('dark coat', { type: 'emphasis' }))), 'coat', 'cloak')
    expect(value).toEqual(formatted(line('a ', run('dark cloak', { type: 'emphasis' }))))
  })

  it('finds and replaces in a speaker and in a source', () => {
    const words = formatted(speech('Coat', line('x')), quote([line('y')], 'the coat'))
    const held = lone(words)
    const places = placesIn(held, 'coat', false)
    expect(places.map(p => p.run)).toEqual([0, 3])
    const [{ value }] = replacements(held, places, 'hat')
    expect(value).toEqual(formatted(speech('hat', line('x')), quote([line('y')], 'the hat')))
  })

  it('writes an empty replacement, dropping a run it empties and joining its neighbours', () => {
    expect(replacedText('the coat', [{ from: 4, to: 8 }], '')).toBe('the ')
    const [value] = written(formatted(line('a ', run('coat', { type: 'emphasis' }), ' b')), 'coat', '')
    expect(value).toEqual(formatted(line('a  b')))
    expect(parseFormatted(value, 'refuse')).toHaveProperty('formatted')
    expect(written(formatted(line('coat')), 'coat', '')[0]).toEqual(formatted({ type: 'line' }))
  })

  it('leaves a bar untouched', () => {
    const [value] = written(formatted(line('coat ', bar(4, 'coat'))), 'coat', 'hat')
    expect(value).toEqual(formatted(line('hat ', bar(4, 'coat'))))
    expect(placesIn(lone(formatted(line(bar(4, 'coat')))), 'coat', false)).toEqual([])
  })

  it('rewrites by the run and offset alone', () => {
    const words = formatted(line('x coat', run(' coat', { type: 'strong' })))
    expect(replacedFormatted(words, [{ run: 1, from: 1, to: 5 }], 'hat'))
      .toEqual(formatted(line('x coat', run(' hat', { type: 'strong' }))))
  })

  it('trims a Question, as its own write does', () => {
    const held = lone('x', {}, { question: 'coat now' })
    const [one] = replacements(held, placesIn(held, 'coat', false), '')
    expect(one!.value).toBe('now')
  })
})

describe('where the words are walked', () => {
  const sound = '/s.mp3'
  const walked = () => ({ ...story([
    scene('late', [shot('l', 'nothing')]),
    scene('first', [
      shot('a', 'coat in words', { image: '/a.webp', description: 'a coat described', sound, transcript: 'a coat heard' }),
      shot('b', 'quiet', { description: 'coat undrawn', transcript: 'coat unheard' }),
    ], { sound, transcript: 'coat of the scene', question: 'a coat?', name: 'Coat' }),
    scene('no-sound', [], { transcript: 'coat unheard', sets: { coat: 'red' } }),
  ], [exit('x', 'first', 'late', 'take the coat')]), openingSceneId: 'first' })

  it('walks in document order and counts every field', () => {
    const held = walked()
    const places = placesIn(held, 'coat', false)
    expect(places.map(p => [p.sceneId, p.of, p.id, p.field])).toEqual([
      ['first', 'scene', 'first', 'transcript'],
      ['first', 'shot', 'a', 'formatted'],
      ['first', 'shot', 'a', 'description'],
      ['first', 'shot', 'a', 'transcript'],
      ['first', 'scene', 'first', 'question'],
      ['first', 'exit', 'x', 'text'],
    ])
    expect(places.map(p => p.order)).toEqual([0, 1, 2, 3, 5, 6])
  })

  it('counts what it finds as what it changes', () => {
    const held = walked()
    const places = placesIn(held, 'coat', false)
    const changes = replacements(held, places, 'hat')
    const coats = (value: unknown) => ((typeof value === 'string' ? value : textRuns(value as Formatted).map(r => r.text).join(' '))
      .match(/coat/gi) ?? []).length
    const removed = changes.reduce((sum, { place, value }) =>
      sum + coats((rowOf(held, place) as unknown as Record<string, unknown>)[place.field]) - coats(value), 0)
    expect(removed).toBe(places.length)
    for (const { place, value } of changes) Object.assign(rowOf(held, place), { [place.field]: value })
    expect(placesIn(held, 'coat', false)).toEqual([])
  })

  it('counts the stretches in a field with `at`', () => {
    const held = lone(formatted(line('ab coat'), line(run('x coat', { type: 'strong' }))))
    expect(placesIn(held, 'coat', false).map(p => [p.run, p.from, p.at])).toEqual([[0, 3, 3], [1, 2, 9]])
  })
})

describe('how a place is named', () => {
  const say = (key: string, values?: Record<string, string | number>) => `${key} ${JSON.stringify(values)}`
  const held = story([
    scene('s', [shot('a', 'x'), shot('b', 'y'), shot('c', 'z')]),
    scene('t', []),
  ], [exit('e1', 's', 't', 'one'), exit('e2', 's', 't', 'two')])
  const names = new Map([['s', 'The bar']])
  const at = (of: 'shot' | 'scene' | 'exit', id: string, field: 'formatted' | 'description' | 'transcript' | 'question' | 'text') =>
    placeNamed(held, { sceneId: 's', of, id, field, order: 0, run: 0, from: 0, to: 0, at: 0 }, names, say)

  it('names a Shot, a Scene and an Exit by where they stand', () => {
    expect(at('shot', 'b', 'formatted')).toBe('find.inWords {"scene":"The bar","place":2}')
    expect(at('shot', 'b', 'description')).toBe('find.inDescription {"scene":"The bar","place":2}')
    expect(at('shot', 'c', 'transcript')).toBe('find.inShotTranscript {"scene":"The bar","place":3}')
    expect(at('scene', 's', 'transcript')).toBe('find.inTranscript {"scene":"The bar"}')
    expect(at('scene', 's', 'question')).toBe('find.inQuestion {"scene":"The bar"}')
    expect(at('exit', 'e2', 'text')).toBe('find.inExit {"scene":"The bar","place":2}')
  })
})
