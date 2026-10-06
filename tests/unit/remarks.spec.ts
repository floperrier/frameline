import { describe, expect, it } from 'vitest'
import { FLAG_NAME_MAX_LENGTH } from '../../shared/utils/scenes.ts'
import { remarks } from '../../app/utils/remarks.ts'
import type { Condition, Scene, Shot, StoryInEditor } from '../../shared/utils/scenes.ts'
import { bar, formatted, formattedOf, line, textOf } from '../../shared/utils/formatted.ts'
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
  sound?: string | null
  soundOfSceneId?: string | null
  transcript?: string
  cutAfter?: Scene['cutAfter']
  cutOver?: Scene['cutOver']
  cutThrough?: Scene['cutThrough']
  exitsAfter?: Scene['exitsAfter']
  textAfter?: Scene['textAfter']
  textBy?: Scene['textBy']
  textPace?: Scene['textPace']
  textOver?: Scene['textOver']
  textStays?: Scene['textStays']
  question?: string
  questionFlag?: string
}

/**
 * A Story in the shape the editor loads it. Only what a Remark reads is filled
 * in, and a Scene's id is its name so that what a Remark points at is legible in
 * the assertion.
 */
function onTheBench(
  scenes: Written[],
  { exits = [], opens = idOf(scenes[0]), exitTexts = [] }: {
    exits?: [from: string, to: string, ...conditions: Condition[]][]
    /** What each Exit says, by its place in `exits`, where it is not the default. */
    exitTexts?: string[]
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
      sound: scene.sound ?? null,
      soundOfSceneId: scene.soundOfSceneId ?? null,
      transcript: scene.transcript ?? '',
      soundLoops: true,
      cutAfter: scene.cutAfter ?? null,
      cutOver: scene.cutOver ?? 0,
      cutThrough: scene.cutThrough ?? 'image',
      exitsAfter: scene.exitsAfter ?? null,
      layout: 'inset',
      movementBy: 0,
      movementDirection: 'closer',
      movementOver: 0,
      textAfter: scene.textAfter ?? 0,
      textBy: scene.textBy ?? 'whole',
      textPace: scene.textPace ?? 15,
      textOver: scene.textOver ?? 0,
      textStays: scene.textStays ?? null,
      question: scene.question ?? '',
      questionFlag: scene.questionFlag ?? '',
      shots: (scene.shots ?? [{ text: 'A door opens.' }]).map((shot, at) => ({
        id: `${idOf(scene)}-${at}`,
        text: '',
        formatted: formattedOf(''),
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
        ...shot,
      })),
    })) as StoryInEditor['scenes'],
    exits: exits.map(([from, to, ...conditions], place) => ({
      id: `${from}-${to}-${place}`,
      fromSceneId: from,
      toSceneId: to,
      text: exitTexts[place] ?? 'On',
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
   * A bar stands for words a Reader who sees it cannot read, and one who cannot
   * see it is told what it hides or nothing at all. Said of the Shot once,
   * however many bars it holds: the Author mends it in one place.
   */
  it('names a Shot hiding words behind a bar it says nothing of, once however many bars', () => {
    const barred = formatted(
      line('A reel from ', bar(8, ''), '.'),
      line(bar(3, ' '), ' and ', bar(2, '')),
    )
    const story = onTheBench([{ name: 'The booth', shots: [{ text: textOf(barred), formatted: barred }] }])
    const found = remarks(story, says)

    expect(found.map(remark => remark.name)).toEqual(['redactionUnsaid'])
    expect(says(`remark.${found[0]!.name}`, found[0]!.said)).toBe(
      'Shot 1 of The booth hides words behind a bar and says nothing of them to a Reader who cannot see it.')
  })

  it('says nothing of a bar whose words are written', () => {
    const barred = formatted(line('A reel from ', bar(8, 'a name, inked out'), '.'))
    const story = onTheBench([{ name: 'The booth', shots: [{ text: textOf(barred), formatted: barred }] }])

    expect(remarks(story, says)).toEqual([])
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

  it('names a Sound nobody transcribed, on the Scene carrying it and on the Shot', () => {
    const story = onTheBench([
      { name: 'The street', sound: '/api/scenes/the-street/sound' },
      { name: 'The bar', shots: [{ text: 'A door.', sound: '/api/shots/one/sound' }] },
    ], { exits: [['The street', 'The bar']] })

    expect(named(story)).toEqual(['soundUntranscribed', 'soundUntranscribed'])
    expect(remarks(story, says)[0]!.said).toEqual({ carrier: says('remark.theSceneSound', { scene: 'The street' }) })
    expect(remarks(story, says)[1]!.said).toEqual({
      carrier: says('remark.theShotSound', { place: 1, scene: 'The bar' }),
    })
  })

  it('says nothing about a Sound that is transcribed, nor about a silent Scene', () => {
    const story = onTheBench([
      { name: 'The street', sound: '/api/scenes/the-street/sound', transcript: 'Rain.' },
      { name: 'The bar' },
    ], { exits: [['The street', 'The bar']] })

    expect(remarks(story, says)).toEqual([])
  })

  it('says nothing of a Scene that takes its Sound from another: the Transcript is the carrier’s', () => {
    const story = onTheBench([
      { name: 'The street', sound: '/api/scenes/the-street/sound', transcript: 'Rain.' },
      { name: 'The bar', soundOfSceneId: 'The street' },
    ], { exits: [['The street', 'The bar']] })

    expect(remarks(story, says)).toEqual([])
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

  it('counts a Condition asking what a Flag does not hold as a test of it', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky' } },
      { name: 'The quay', shots: [{ text: 'Water.', conditions: [{ flag: 'drink', isNot: 'whisky' }] }] },
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

  it('reads the values a Scene sets the way a Condition holds, case, accents and spaces aside', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { colour: 'red', drink: ['Café crème', 'beer'] } },
      { name: 'The quay' },
    ], {
      exits: [
        ['The bar', 'The quay', { flag: 'colour', is: 'Red' }],
        ['The bar', 'The quay', { flag: 'drink', is: ' cafe  CRÈME ' }],
        ['The bar', 'The quay', { flag: 'colour', is: '  ' }],
      ],
    })

    expect(named(story)).not.toContain('exitUnofferable')
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

  it('leaves a value a Flag is asked not to hold alone, since a Flag nobody set does not hold it', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky' } },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', isNot: 'whisky' }]] })

    expect(remarks(story, says)).toEqual([])
  })

  /**
   * Not holding nothing is holding something, which a Flag nothing sets and no
   * Question holds an answer under never does: the row is dead, and the Flag is
   * unset as well — the two are said of different things.
   */
  it('names a row asking a Flag nothing sets to hold something', () => {
    const story = onTheBench([
      { name: 'The bar', shots: [{ text: 'A.', conditions: [{ flag: 'answer', isNot: ' ' }] }] },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'answer', isNot: '' }]] })
    const said = remarks(story, says)
      .filter(remark => remark.name.endsWith('ConditionNeverHolds'))
      .map(remark => says(`remark.${remark.name}`, remark.said))

    expect(named(story)).toContain('flagUnset')
    expect(said).toEqual([
      'Shot 1 of The bar plays only when answer holds something, and that is never so for a Reading that gets there.',
      'The Exit 1 out of The bar is offered only when answer holds something, and that is never so for a Reading that gets there.',
    ])
  })

  it('leaves a row asking a Flag to hold something alone where a Scene sets it or a Question holds it', () => {
    const asking = [{ text: 'A.', conditions: [{ flag: 'answer', isNot: '' }] }]

    for (const story of [
      onTheBench([{ name: 'The bar', sets: { answer: 'yes' } }, { name: 'The quay', shots: asking }],
        { exits: [['The bar', 'The quay']] }),
      onTheBench([{ name: 'The bar', question: 'Who?', questionFlag: 'answer' }, { name: 'The quay', shots: asking }],
        { exits: [['The bar', 'The quay']] }),
    ]) {
      expect(remarks(story, says)).toEqual([])
    }
  })

  it('says only that the Flag is unset where nothing sets it at all', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { flag: 'drink', is: 'wine' }]] })

    expect(named(story)).toEqual(['flagUnset'])
  })
})

describe('a Condition the ways round rule out', () => {
  const NEVER = ['shotConditionNeverHolds', 'exitConditionNeverHolds']
  const never = (story: StoryInEditor) =>
    remarks(story, says).filter(remark => NEVER.includes(remark.name))
  const asking = (...conditions: Condition[]) => [{ text: 'A.', conditions }]
  const GONE = '00000000-0000-4000-8000-000000000000'

  it('reports a Scene asked entered that no way leads on from to the Scene asking', () => {
    const story = onTheBench([
      { name: 'The street' },
      { name: 'The quay' },
      { name: 'The bar', shots: asking({ scene: 'The quay', entered: true }) },
    ], { exits: [['The street', 'The quay'], ['The street', 'The bar']] })

    const found = never(story)
    const said = { scene: 'The bar', place: 1, test: 'The quay has been entered' }
    expect(found).toEqual([{ name: 'shotConditionNeverHolds', sceneId: 'The bar', said }])
    expect(says('remark.shotConditionNeverHolds', said)).toBe(
      'Shot 1 of The bar plays only when The quay has been entered, and that is never so for a Reading that gets there.',
    )
  })

  it('reports the opening Scene asked not entered, and a Scene asked not entered in itself', () => {
    const opening = onTheBench([
      { name: 'The street' },
      { name: 'The bar', shots: asking({ scene: 'The street', entered: false }) },
    ], { exits: [['The street', 'The bar']] })
    expect(never(opening).map(remark => remark.said.test))
      .toEqual(['The street has not been entered'])

    const itself = onTheBench([
      { name: 'The street' },
      { name: 'The bar', shots: asking({ scene: 'The bar', entered: false }) },
    ], { exits: [['The street', 'The bar']] })
    expect(never(itself).map(remark => remark.said.test)).toEqual(['The bar has not been entered'])
  })

  it('reports an Exit asked taken on a way on that leaves a Scene it can only be taken before', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { exit: 'The bar-The quay-0', taken: true }]] })

    expect(never(story)).toEqual([{
      name: 'exitConditionNeverHolds',
      sceneId: 'The bar',
      said: { scene: 'The bar', place: 1, test: 'the Exit 1 out of The bar has been taken' },
    }])

    story.exits[0]!.conditions = [{ exit: 'The bar-The quay-0', taken: false }]
    expect(never(story)).toEqual([])
  })

  it('reports an Exit asked taken that leaves a Scene the Shot comes before', () => {
    const story = onTheBench([
      { name: 'The bar', shots: asking({ exit: 'The quay-The yard-1', taken: true }) },
      { name: 'The quay' },
      { name: 'The yard' },
    ], { exits: [['The bar', 'The quay'], ['The quay', 'The yard']] })

    expect(never(story).map(remark => remark.said.test))
      .toEqual(['the Exit 1 out of The quay has been taken'])
  })

  it('reports an Exit asked not taken that is the only way in, and not one asked taken', () => {
    const only = (taken: boolean) => onTheBench([
      { name: 'The street' },
      { name: 'The bar', shots: asking({ exit: 'The street-The bar-0', taken }) },
    ], { exits: [['The street', 'The bar']] })

    expect(never(only(false)).map(remark => remark.said.test))
      .toEqual(['the Exit 1 out of The street has not been taken'])
    expect(never(only(true))).toEqual([])
  })

  it('leaves an Exit alone where the Scene has another way in', () => {
    for (const exit of ['The street-The bar-1', 'The yard-The bar-2']) {
      for (const taken of [true, false]) {
        const story = onTheBench([
          { name: 'The street' },
          { name: 'The yard' },
          { name: 'The bar', shots: asking({ exit, taken }) },
        ], { exits: [['The street', 'The yard'], ['The street', 'The bar'], ['The yard', 'The bar']] })

        expect(never(story)).toEqual([])
      }
    }
  })

  it('reports a Condition on something that is gone, unless it asks for the absence', () => {
    const exit = (taken: boolean) => onTheBench([{ name: 'The bar', shots: asking({ exit: GONE, taken }) }])
    expect(never(exit(true)).map(remark => remark.said.test))
      .toEqual(['an Exit that is gone has been taken'])
    expect(never(exit(false))).toEqual([])

    const scene = onTheBench([{ name: 'The bar', shots: asking({ scene: GONE, entered: true }) }])
    expect(never(scene).map(remark => remark.said.test))
      .toEqual(['a Scene that is gone has been entered'])
  })

  it('says nothing of a Scene no Reading reaches but that it is not reached', () => {
    const story = onTheBench([
      { name: 'The street' },
      { name: 'The bar' },
      { name: 'The island', shots: asking({ scene: 'The bar', entered: true }) },
    ], { exits: [['The street', 'The bar']] })

    expect(never(story)).toEqual([])
    expect(named(story)).toContain('sceneUnreached')
  })

  it('leaves a Scene asked not entered alone where a way in avoids it', () => {
    const story = onTheBench([
      { name: 'The street' },
      { name: 'The yard' },
      { name: 'The bar', shots: asking({ scene: 'The yard', entered: false }) },
    ], { exits: [['The street', 'The yard'], ['The yard', 'The bar'], ['The street', 'The bar']] })

    expect(never(story)).toEqual([])
  })

  it('leaves a Scene asked entered alone on a way on out of that Scene', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay', { scene: 'The bar', entered: true }]] })

    expect(never(story)).toEqual([])
  })

  it('leaves a Scene asked entered alone where a way leads to the Scene asking', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay', shots: asking({ scene: 'The bar', entered: true }) },
    ], { exits: [['The bar', 'The quay']] })

    expect(never(story)).toEqual([])
  })
})

describe('a way on no Reading is ever handed', () => {
  /**
   * An Exit leading back to a Scene that already reaches the one it leaves. The
   * bench refuses to write one now, so this can only ever be a Story written
   * before `docs/adr/0048-a-scene-is-entered-once.md` — and since that record
   * decided nothing an Author wrote would be edited, what the bench owes them
   * instead is to have noticed.
   */
  it('says so of the Exit that leads back, by the Scene it leaves and its Place', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'The quay' },
    ], { exits: [['The bar', 'The quay'], ['The quay', 'The bar']] })

    expect(remarks(story, says).filter(remark => remark.name === 'exitNeverTaken'))
      .toEqual([{ name: 'exitNeverTaken', sceneId: 'The quay', said: { scene: 'The quay', place: 1 } }])
  })

  /** A way on to the Scene it leaves is the same thing said of one Scene. */
  it('says so of an Exit that leads to the Scene it leaves', () => {
    const story = onTheBench([{ name: 'The bar' }], { exits: [['The bar', 'The bar']] })

    expect(named(story)).toContain('exitNeverTaken')
  })

  /**
   * The case *some way* would get wrong: the quay is reached through the bar and
   * around it, so a Reader can be standing there without having been in the bar —
   * and the way on back to it is one they are handed.
   */
  it('says nothing of a way back to a Scene there is also a way round', () => {
    const story = onTheBench([
      { name: 'The foyer' },
      { name: 'The bar' },
      { name: 'The quay' },
    ], {
      exits: [
        ['The foyer', 'The bar'],
        ['The foyer', 'The quay'],
        ['The bar', 'The quay'],
        ['The quay', 'The bar'],
      ],
    })

    expect(named(story)).not.toContain('exitNeverTaken')
  })

  /** A Story read forwards holds none, however many ways round to one Scene it has. */
  it('says nothing of a Story that only ever leads onwards', () => {
    const story = onTheBench([
      { name: 'The bar' },
      { name: 'La gare' },
      { name: 'The quay' },
    ], {
      exits: [
        ['The bar', 'La gare'],
        ['The bar', 'The quay'],
        ['La gare', 'The quay'],
      ],
    })

    expect(named(story)).not.toContain('exitNeverTaken')
  })
})

describe('the Cut', () => {
  it('remarks on a Scene that flows on and leads nowhere', () => {
    const story = onTheBench([{ name: 'One', exitsAfter: 0, shots: [] }])

    expect(named(story)).toContain('sceneFlowsNowhere')
  })

  it('says nothing of a Scene that flows on and leads somewhere', () => {
    const story = onTheBench(
      [{ name: 'One', exitsAfter: 0 }, { name: 'Two' }],
      { exits: [['One', 'Two']] },
    )

    expect(named(story)).not.toContain('sceneFlowsNowhere')
  })

  /**
   * A Scene whose only Exit leads back to a Scene a Reading standing there has
   * always already entered flows on and strands the Reader just the same as one
   * with no Exit at all — the Exit exists on the row but is never once handed
   * to anybody, which is the same fact `exitNeverTaken` says of it.
   */
  it('remarks on a Scene that flows on whose only Exit is never offered', () => {
    const story = onTheBench([
      { name: 'One' },
      { name: 'Two', exitsAfter: 0 },
    ], { exits: [['One', 'Two'], ['Two', 'One']] })

    expect(named(story)).toContain('sceneFlowsNowhere')
  })

  // 200 words a minute is about 15 characters a second, so 400 characters need
  // some 27 seconds and a Shot standing for one is plainly unreadable.
  it('remarks on a Shot that stands for less time than its text takes to read', () => {
    const text = 'x'.repeat(400)
    const story = onTheBench([{ name: 'One', cutAfter: 1000, shots: [{ text }] }])

    expect(named(story)).toContain('textShownTooBriefly')
  })

  it('says nothing of a Shot given the time its text takes', () => {
    const text = 'x'.repeat(400)
    const story = onTheBench([{ name: 'One', cutAfter: 40_000, shots: [{ text }] }])

    expect(named(story)).not.toContain('textShownTooBriefly')
  })

  it('says nothing of a Shot nothing is timing', () => {
    const text = 'x'.repeat(400)
    const story = onTheBench([{ name: 'One', cutAfter: null, shots: [{ text }] }])

    expect(named(story)).not.toContain('textShownTooBriefly')
  })

  it('remarks on a text that leaves before it can be read, even under the press', () => {
    const text = 'x'.repeat(100)
    const story = onTheBench([
      { name: 'One', cutAfter: null, textStays: 1000, shots: [{ text }] },
    ])

    expect(named(story)).toContain('textShownTooBriefly')
  })

  // Twenty words at five characters a second take nineteen seconds to arrive, and
  // the Reader has read all but the last of them by then: two seconds of hold is
  // plenty, though the text as a whole takes six and a half to read.
  it('says nothing of a text read while it arrives, word by word', () => {
    const text = Array(20).fill('word').join(' ')
    const story = onTheBench([{
      name: 'One', cutAfter: 2000, textBy: 'word', textPace: 5, shots: [{ text }],
    }])

    expect(named(story)).not.toContain('textShownTooBriefly')
  })
})

describe('a flash from white the Reading withholds', () => {
  const white = { text: 'A.', image: '/i', imageArrives: { effect: 'from-white', over: 1200, strength: 'marked' } }
  const flicker = { image: '/i', imageLasts: { effect: 'flicker', strength: 'slight' } }

  it('is said of a Shot arriving after a Shot that flickers', () => {
    const story = onTheBench([{ name: 'One', shots: [flicker, white] as never }])

    expect(named(story)).toContain('flashWithheld')
  })

  // The Reading draws no flicker on an Image the Shot does not have, so it
  // withholds nothing after one, and neither does the Remark.
  it('is not said after a flicker on an Image the Shot before does not have', () => {
    const story = onTheBench([{ name: 'One', shots: [{ ...flicker, image: null }, white] as never }])

    expect(named(story)).not.toContain('flashWithheld')
  })

  it('is said of a Shot arriving after a Shot cut after half a second', () => {
    const story = onTheBench([{ name: 'One', shots: [{ cutAfter: 500 }, white] as never }])

    expect(named(story)).toContain('flashWithheld')
  })

  it('is not said after a Shot held until the press', () => {
    const scene = { name: 'One', shots: [{}, white] as never }

    expect(named(onTheBench([scene]))).not.toContain('flashWithheld')
    expect(named(onTheBench([{ ...scene, cutAfter: 0 }]))).not.toContain('flashWithheld')
    expect(named(onTheBench([{ ...scene, shots: [{ cutAfter: 0 }, white] as never }])))
      .not.toContain('flashWithheld')
  })

  it('is not said of a Scene’s first Shot', () => {
    const story = onTheBench([{ name: 'One', shots: [white] as never }])

    expect(named(story)).not.toContain('flashWithheld')
  })

  it('is not said of a Shot arriving from white with no Image', () => {
    const bare = { ...white, image: null }
    const story = onTheBench([{ name: 'One', shots: [flicker, bare] as never }])

    expect(named(story)).not.toContain('flashWithheld')
  })
})

describe('an Exit nobody has phrased', () => {
  /**
   * An Exit with no words is offered by the Scene it leads to, which is the one
   * place a Reader is shown a Scene's name — and the bench's own name at that,
   * since a split draws the Exit joining its two halves with nothing on it.
   */
  it('says so of the Exit with no words, by the Scene it leaves and its Place', () => {
    const story = onTheBench(
      [{ name: 'The street' }, { name: 'The bar' }],
      { exits: [['The street', 'The bar'], ['The street', 'The bar']] },
    )
    expect(named(story)).not.toContain('exitUnphrased')

    story.exits[1]!.text = ' '
    expect(remarks(story, says)).toEqual([
      { name: 'exitUnphrased', sceneId: 'The street', said: { scene: 'The street', place: 2 } },
    ])
  })
})

describe('every Remark has a sentence in both languages', () => {
  it('is written under its own name in the message files', () => {
    const story = onTheBench([
      { name: 'The bar', sets: { drink: 'whisky', coat: 'on' }, shots: [{}, { text: '█', formatted: formatted(line(bar(1, ''))) }] },
      { name: 'The quay', shots: [{ text: 'A.', image: '/i', conditions: [{ flag: 'coat', is: 'x' }] }] },
      { name: 'The yard', shots: [] },
    ], { exits: [['The bar', 'The quay', { flag: 'hat', is: 'on' }]], opens: null })

    const found = new Set(named(story))
    expect(found.size).toBeGreaterThan(5)
    for (const name of found) expect(en.remark).toHaveProperty(name)
  })
})

describe('the Flags the texts say', () => {
  const said = (scene: string, braced: string) => ({ scene, braced })
  const only = (story: StoryInEditor, name: string) =>
    remarks(story, says).filter(remark => remark.name === name)

  it('says a run that names no Flag, of the Scene carrying the text, wherever it is written', () => {
    const nobody = '{nobody}'
    const sound = '/api/scenes/the-bar/sound'
    const story = onTheBench([
      { name: 'The bar', shots: [{ text: nobody, formatted: formattedOf(nobody) }] },
      { name: 'The quay', shots: [{ description: nobody }] },
      { name: 'The pier', shots: [{ sound, transcript: nobody }] },
      { name: 'The dock', sound, transcript: nobody },
      { name: 'The yard' },
    ], { exits: [['The yard', 'The bar']], exitTexts: [nobody] })

    expect(only(story, 'saysNoFlag').map(({ sceneId, said: what }) => [sceneId, what])).toEqual([
      ['The bar', said('The bar', nobody)],
      ['The quay', said('The quay', nobody)],
      ['The pier', said('The pier', nobody)],
      ['The dock', said('The dock', nobody)],
      ['The yard', said('The yard', nobody)],
    ])
  })

  it('reads a Scene’s Transcript only where the Scene carries the Sound', () => {
    const story = onTheBench([{ name: 'The bar', transcript: '{nobody}' }])

    expect(named(story)).not.toContain('saysNoFlag')
  })

  it('names the Flag a run only nearly is', () => {
    for (const [run, flag] of [['Coat', 'coat'], [' coat ', 'coat'], ['cafe', 'café']]) {
      const text = `{${run}}`
      const story = onTheBench([
        { name: 'The bar', sets: { [flag!]: 'on' }, shots: [{ text, formatted: formattedOf(text) }] },
      ])

      expect(only(story, 'saysFlagNearly').map(remark => [remark.sceneId, remark.said]))
        .toEqual([['The bar', { ...said('The bar', text), flag }]])
      expect(named(story)).not.toContain('saysNoFlag')
    }
  })

  it('says a run once however many Shots of a Scene write it, and once a Scene', () => {
    const shot = { text: '{nobody}', formatted: formattedOf('{nobody}') }
    const one = onTheBench([{ name: 'The bar', shots: Array(5).fill(shot) }])
    const two = onTheBench([{ name: 'The bar', shots: [shot] }, { name: 'The quay', shots: [shot] }])

    expect(only(one, 'saysNoFlag')).toHaveLength(1)
    expect(only(two, 'saysNoFlag')).toHaveLength(2)
  })

  it('says nothing of a Flag a Scene sets, nor of prose too long to be a name', () => {
    const long = `{${'a'.repeat(FLAG_NAME_MAX_LENGTH + 1)}}`
    const story = onTheBench([{
      name: 'The bar',
      sets: { coat: 'red' },
      shots: [
        { text: '{coat}', formatted: formattedOf('{coat}') },
        { text: long, formatted: formattedOf(long) },
      ],
    }])

    expect(named(story).filter(name => name.startsWith('says'))).toEqual([])
  })

  it('counts a Flag only said as used, and still names one neither tested nor said', () => {
    const text = 'A {coat} coat.'
    const story = onTheBench([{
      name: 'The bar',
      sets: { coat: 'red', hat: 'on' },
      shots: [{ text, formatted: formattedOf(text) }],
    }])

    expect(only(story, 'flagUntested').map(remark => remark.said.flag)).toEqual(['hat'])
  })
})

describe('what a Question changes', () => {
  const asking = { question: 'Your name?', questionFlag: 'name' }
  const only = (story: StoryInEditor, name: string) =>
    remarks(story, says).filter(remark => remark.name === name)

  it('counts a Flag a Question holds as set, said later in a Shot', () => {
    const story = onTheBench([
      { name: 'Ask', ...asking },
      { name: 'Greet', shots: [{ text: 'Hello {name}.', formatted: formattedOf('Hello {name}.') }] },
    ], { exits: [['Ask', 'Greet']] })

    expect(named(story).filter(name => name.startsWith('flag'))).toEqual([])
  })

  it('counts a Flag a Question holds as set, tested by an Exit, and never dead', () => {
    const story = onTheBench([{ name: 'Ask', ...asking }, { name: 'Greet' }], {
      exits: [['Ask', 'Greet', { flag: 'name', is: 'Ada' }]],
    })

    expect(named(story).filter(name => name.startsWith('flag') || name === 'exitUnofferable'))
      .toEqual([])
  })

  it('still names a Flag only a Question holds that nothing tests or says', () => {
    const story = onTheBench([{ name: 'Ask', ...asking }, { name: 'Greet' }], {
      exits: [['Ask', 'Greet']],
    })

    expect(only(story, 'flagUntested').map(remark => [remark.said.flag, remark.sceneId]))
      .toEqual([['name', 'Ask']])
  })

  it('reads a misspelt brace in a Question', () => {
    const story = onTheBench([
      { name: 'Ask', question: 'Is it {Name}?', questionFlag: 'name' },
      { name: 'Next' },
    ], { exits: [['Ask', 'Next']] })

    expect(only(story, 'saysFlagNearly').map(remark => remark.said.flag)).toEqual(['name'])
  })

  it('says of a Scene that asks with no Exit that its Question is never put', () => {
    const found = only(onTheBench([{ name: 'Ask', ...asking }]), 'questionNeverPut')

    expect(found).toEqual([{ name: 'questionNeverPut', sceneId: 'Ask', said: { scene: 'Ask' } }])
  })

  it('says nothing of a Scene that asks and has an Exit, or has a sentence and no Flag', () => {
    const asked = onTheBench([{ name: 'Ask', ...asking }, { name: 'Next' }], {
      exits: [['Ask', 'Next']],
    })
    const half = onTheBench([{ name: 'Ask', question: 'Your name?' }])

    expect(named(asked)).not.toContain('questionNeverPut')
    expect(named(half)).not.toContain('questionNeverPut')
  })
})
