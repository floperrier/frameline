import { describe, expect, it } from 'vitest'
import { remarks } from '../../app/utils/remarks.ts'
import type { Condition, Scene, Shot, StoryInEditor } from '../../shared/utils/scenes.ts'
import en from '../../i18n/locales/en.json'

/**
 * What the bench finds when it reads a Story back. A pure reading of the Story
 * the editor already holds, so the whole feature answers to a literal: no
 * database, no browser, no engine.
 */

type Written = {
  name: string
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
  { exits = [], opens = scenes[0]?.name ?? null }: {
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
      id: scene.name,
      name: scene.name,
      x: 0,
      y: place * 200,
      sets: scene.sets ?? {},
      shots: (scene.shots ?? [{ text: 'A door opens.' }]).map((shot, at) => ({
        id: `${scene.name}-${at}`,
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

/** The Remarks by name alone, which is what every assertion here is about. */
function named(story: StoryInEditor) {
  return remarks(story).map(remark => remark.name)
}

describe('what the bench finds in a Story', () => {
  it('says nothing about a Story whose Scenes all hold together', () => {
    const story = onTheBench(
      [{ name: 'The street' }, { name: 'The bar' }],
      { exits: [['The street', 'The bar']] },
    )

    expect(remarks(story)).toEqual([])
  })

  it('says nothing about a Story nobody has started', () => {
    expect(remarks(onTheBench([]))).toEqual([])
  })

  it('names a Story with Scenes and no opening Scene', () => {
    const story = onTheBench([{ name: 'The street' }], { opens: null })

    expect(named(story)).toContain('noOpening')
  })

  it('names a Scene no Exit arrives at, and never the opening Scene', () => {
    const story = onTheBench([{ name: 'The street' }, { name: 'The bar' }])
    const found = remarks(story)

    expect(found.map(remark => remark.name)).toEqual(['sceneUnreached'])
    expect(found[0]!.sceneId).toBe('The bar')
  })

  it('names a Scene holding no Shot at all', () => {
    const story = onTheBench([{ name: 'The street', shots: [] }])

    expect(named(story)).toContain('sceneUnplayed')
  })

  it('names a Shot carrying neither text nor Image, by the Place it holds', () => {
    const story = onTheBench([{ name: 'The street', shots: [{ text: 'A door.' }, { text: ' ' }] }])
    const [found] = remarks(story)

    expect(found!.name).toBe('shotUnwritten')
    expect(found!.said).toEqual({ scene: 'The street', place: 2 })
  })

  it('leaves a Shot that carries an Image and no text alone', () => {
    const story = onTheBench([{ name: 'The street', shots: [{ image: '/i', description: 'A door' }] }])

    expect(remarks(story)).toEqual([])
  })

  it('names an Image nobody described', () => {
    const story = onTheBench([{ name: 'The street', shots: [{ text: 'A door.', image: '/i' }] }])

    expect(named(story)).toEqual(['imageUndescribed'])
  })
})

describe('the two halves of a Flag nobody joined up', () => {
  it('names a Flag a Scene sets that no Condition reads', () => {
    const story = onTheBench([{ name: 'The bar', sets: { drink: 'whisky' } }])
    const found = remarks(story).find(remark => remark.name === 'flagUntested')

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

    expect(remarks(story)).toEqual([])
  })

  it('passes over the empty name a row half typed leaves behind', () => {
    const story = onTheBench([{ name: 'The bar', sets: { '': 'whisky' } }])

    expect(remarks(story)).toEqual([])
  })
})

describe('what can never hold', () => {
  it('names a way on testing a value no Scene ever sets', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: ['whisky', 'beer'] } },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', is: 'wine' }]] })
    const found = remarks(story).find(remark => remark.name === 'exitUnofferable')

    expect(found?.sceneId).toBe('The bar')
    expect(found?.said).toEqual({ scene: 'The bar', flag: 'drink', is: 'wine' })
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

  it('leaves one of the values a Scene draws from alone', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: ['whisky', 'beer'] } },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', is: 'beer' }]] })

    expect(remarks(story)).toEqual([])
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

    expect(remarks(story)).toEqual([])
  })

  it('leaves a visit count alone, however few visits the graph allows', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { scene: 'The bar', visits: 'at least', times: 9 }]] })

    expect(remarks(story)).toEqual([])
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
