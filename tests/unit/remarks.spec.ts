import { describe, expect, it } from 'vitest'
import { remarks } from '../../app/utils/remarks.ts'
import type { Condition, Scene, Shot, StoryInEditor } from '../../shared/utils/scenes.ts'
import type { Phrase } from '../../shared/utils/phrases.ts'
import { DEFAULT_LOCALE, phrase } from '../../server/utils/phrases.ts'
import en from '../../i18n/locales/en.json'

/**
 * What the bench finds when it reads a Story back. A pure reading of the Story
 * the editor already holds, so the whole feature answers to a literal: no
 * database, no browser, no engine.
 */

/**
 * The words themselves, read out of the message file the interface reads: a
 * Remark names a Scene the way every control of the bench does, and where two
 * Scenes share a name that is a phrase rather than the name — so what a Remark
 * says is asserted against the real messages and not against a stub.
 */
const says: Phrase = (key, values) => phrase(DEFAULT_LOCALE, key, values)

type Written = {
  name: string
  /** Its id, which is its name except where two Scenes of the Story carry one name. */
  id?: string
  shots?: Partial<Shot>[]
  sets?: Scene['sets']
}

/**
 * A Story in the shape the editor loads it. Only what a Remark reads is filled
 * in, and a Scene's id is its name so that what a Remark points at is legible in
 * the assertion.
 */
function onTheBench(
  scenes: Written[],
  { exits = [], opens = idOf(scenes[0]) }: {
    exits?: [from: string, to: string, ...conditions: Condition[]][]
    opens?: string | null
  } = {},
): StoryInEditor {
  return {
    id: 'a-story',
    title: 'A Story',
    language: 'en',
    openingSceneId: opens,
    publishedAt: null,
    scenes: scenes.map((scene, place) => ({
      id: idOf(scene),
      name: scene.name,
      x: 0,
      y: place * 200,
      sets: scene.sets ?? {},
      shots: (scene.shots ?? [{ text: 'A door opens.' }]).map((shot, at) => ({
        id: `${idOf(scene)}-${at}`,
        text: '',
        image: null,
        description: '',
        conditions: [],
        ...shot,
      })),
    })) as StoryInEditor['scenes'],
    exits: exits.map(([from, to, ...conditions], place) => ({
      id: `${from}-${to}-${place}`,
      fromSceneId: from,
      toSceneId: to,
      text: 'On',
      position: place,
      conditions,
    })),
  }
}

function idOf(scene?: Written) {
  return scene ? scene.id ?? scene.name : null
}

/** The Remarks by name alone, which is what every assertion here is about. */
function named(story: StoryInEditor) {
  return remarks(story, says).map(remark => remark.name)
}

describe('what the bench finds in a Story', () => {
  it('says nothing about a Story whose Scenes all hold together', () => {
    const story = onTheBench(
      [{ name: 'The street' }, { name: 'The bar' }],
      { exits: [['The street', 'The bar']] },
    )

    expect(remarks(story, says)).toEqual([])
  })

  it('says nothing about a Story nobody has started', () => {
    expect(remarks(onTheBench([]), says)).toEqual([])
  })

  it('names a Story with Scenes and no opening Scene', () => {
    const story = onTheBench([{ name: 'The street' }], { opens: null })

    expect(named(story)).toContain('noOpening')
  })

  it('names a Scene no Exit arrives at, and never the opening Scene', () => {
    const story = onTheBench([{ name: 'The street' }, { name: 'The bar' }])
    const found = remarks(story, says)

    expect(found.map(remark => remark.name)).toEqual(['sceneUnreached'])
    expect(found[0]!.sceneId).toBe('The bar')
  })

  it('names a Scene holding no Shot at all', () => {
    const story = onTheBench([{ name: 'The street', shots: [] }])

    expect(named(story)).toContain('sceneUnplayed')
  })

  it('names a Shot carrying neither text nor Image, by the Place it holds', () => {
    const story = onTheBench([{ name: 'The street', shots: [{ text: 'A door.' }, { text: ' ' }] }])
    const [found] = remarks(story, says)

    expect(found!.name).toBe('shotUnwritten')
    expect(found!.said).toEqual({ scene: 'The street', place: 2 })
  })

  it('leaves a Shot that carries an Image and no text alone', () => {
    const story = onTheBench([{ name: 'The street', shots: [{ image: '/i', description: 'A door' }] }])

    expect(remarks(story, says)).toEqual([])
  })

  it('names an Image nobody described', () => {
    const story = onTheBench([{ name: 'The street', shots: [{ text: 'A door.', image: '/i' }] }])

    expect(named(story)).toEqual(['imageUndescribed'])
  })

  /**
   * Nothing stops an Author calling two Scenes *The bar*, so a Remark naming one
   * of them reads the name the bench gives it rather than the name itself — the
   * number is drawn by `namesOnTheBench` and read here, which makes the Remarks
   * agree with the document and the Contact Sheet about which *The bar* a sentence
   * is about. Numbered in the order the Story is written in and not in the order
   * the API hands the Scenes back, which is why the second one written is *(1)*
   * here: it is the one the Story opens on.
   */
  it('numbers two Scenes an Author called the same, as the Story is written', () => {
    const story = onTheBench([
      { id: 'later', name: 'The bar', shots: [{}] },
      { id: 'opening', name: 'The bar', shots: [{}] },
    ], { exits: [['opening', 'later']], opens: 'opening' })

    expect(remarks(story, says).map(remark => says(`remark.${remark.name}`, remark.said)))
      .toEqual([
        'Shot 1 of The bar (2) carries neither text nor Image.',
        'Shot 1 of The bar (1) carries neither text nor Image.',
      ])
  })
})

describe('the two halves of a Flag nobody joined up', () => {
  it('names a Flag a Scene sets that no Condition reads', () => {
    const story = onTheBench([{ name: 'The bar', sets: { drink: 'whisky' } }])
    const found = remarks(story, says).find(remark => remark.name === 'flagUntested')

    expect(found?.said).toEqual({ flag: 'drink', scene: 'The bar' })
  })

  it('names a Flag a Condition reads that no Scene sets', () => {
    const story = onTheBench([
      { name: 'The bar', shots: [{ text: 'Smoke.', conditions: [{ flag: 'coat', is: 'on' }] }] },
    ])

    expect(named(story)).toEqual(['flagUnset'])
  })

  it('says each of them once, however many places the Flag appears in', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky' } },
      { name: 'The quay', sets: { drink: 'beer' } },
    ], { exits: [['The bar', 'The quay']] })

    expect(named(story)).toEqual(['flagUntested'])
  })

  it('leaves a Flag alone once something tests it', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky' } },
      { name: 'The quay', shots: [{ text: 'Water.', conditions: [{ flag: 'drink', is: 'whisky' }] }] },
    ], { exits: [['The bar', 'The quay']] })

    expect(remarks(story, says)).toEqual([])
  })

  it('passes over the empty name a row half typed leaves behind', () => {
    const story = onTheBench([{ name: 'The bar', sets: { '': 'whisky' } }])

    expect(remarks(story, says)).toEqual([])
  })
})

describe('what can never hold', () => {
  it('names a way on testing a value no Scene ever sets', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: ['whisky', 'beer'] } },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', is: 'wine' }]] })
    const found = remarks(story, says).find(remark => remark.name === 'exitUnofferable')

    expect(found?.sceneId).toBe('The bar')
    expect(found?.said).toEqual({ scene: 'The bar', place: 1, flag: 'drink', is: 'wine' })
  })

  it('names a Shot the same way', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky' } },
      {
        name: 'The quay',
        shots: [{ text: 'Water.', conditions: [{ flag: 'drink', is: 'wine' }] }],
      },
    ], { exits: [['The bar', 'The quay']] })

    expect(named(story)).toContain('shotUnplayable')
  })

  /**
   * The Scene is not enough to tell two of these apart, which is the whole of
   * issue #276: two beats of one Scene waiting on the same pair are two findings
   * an Author goes to separately, and a sentence naming only the Scene would be
   * the same sentence twice — and the Remark is a control, so the same control
   * named twice with it.
   */
  it('names the row a dead Condition is written on, and not the Scene alone', () => {
    const dead: Condition[] = [{ flag: 'ticket', is: 'lost' }]
    const story = onTheBench([
      {
        name: 'The yard',
        sets: { ticket: 'found' },
        shots: [
          { text: 'A.', conditions: dead },
          { text: 'B.', conditions: dead },
        ],
      },
      { name: 'The quay' },
    ], { exits: [['The yard', 'The quay', ...dead], ['The yard', 'The quay', ...dead]] })

    const said = remarks(story, says)
      .filter(remark => remark.name === 'shotUnplayable' || remark.name === 'exitUnofferable')
      .map(remark => says(`remark.${remark.name}`, remark.said))

    expect(said).toEqual([
      'Shot 1 of The yard plays only when ticket holds “lost”, which no Scene ever sets it to.',
      'Shot 2 of The yard plays only when ticket holds “lost”, which no Scene ever sets it to.',
      'The Exit 1 out of The yard is offered only when ticket holds “lost”, which no Scene ever sets it to.',
      'The Exit 2 out of The yard is offered only when ticket holds “lost”, which no Scene ever sets it to.',
    ])
    expect(new Set(said).size).toBe(said.length)
  })

  it('leaves one of the values a Scene draws from alone', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: ['whisky', 'beer'] } },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', is: 'beer' }]] })

    expect(remarks(story, says)).toEqual([])
  })

  it('leaves the absence of a Flag alone, which is what the empty value asks for', () => {
    // A Flag never set reads as empty, so a Condition on the empty value holds at
    // the top of every Reading — and no Scene can be found setting it, because a
    // Flag set to nothing is a row half typed. It is the way *Reel Change* offers
    // one Exit exactly once.
    const story = onTheBench([
      { name: 'The booth', sets: { reel: 'threaded' } },
      { name: 'The gate' },
    ], { exits: [['The booth', 'The gate', { flag: 'reel', is: '' }]] })

    expect(remarks(story, says)).toEqual([])
  })

  it('leaves a visit count alone, however few visits the graph allows', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { scene: 'The bar', visits: 'at least', times: 9 }]] })

    expect(remarks(story, says)).toEqual([])
  })

  it('says only that the Flag is unset where nothing sets it at all', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', is: 'wine' }]] })

    expect(named(story)).toEqual(['flagUnset'])
  })
})

describe('every Remark has a sentence in both languages', () => {
  it('is written under its own name in the message files', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky', coat: 'on' }, shots: [{}] },
      { name: 'The quay', shots: [{ text: 'A.', image: '/i', conditions: [{ flag: 'coat', is: 'x' }] }] },
      { name: 'The yard', shots: [] },
    ], { exits: [['The bar', 'The quay', { flag: 'hat', is: 'on' }]], opens: null })

    const found = new Set(named(story))
    expect(found.size).toBeGreaterThan(5)
    for (const name of found) expect(en.remark).toHaveProperty(name)
  })
})
