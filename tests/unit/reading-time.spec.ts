import { describe, expect, test } from 'vitest'
import type { Edition } from '../../shared/utils/reading'
import type { Exit } from '../../shared/utils/scenes'
import { readingMinutes, readingTime } from '../../shared/utils/reading-time'

type SceneOf = Edition['scenes'][number]
type ShotOf = SceneOf['shots'][number]

/** So many words, each one a word and nothing else. */
const words = (many: number) => Array.from({ length: many }, () => 'word').join(' ')

/** A Shot that says nothing for itself, carrying the text it is given. */
function shot(text: string, own: Partial<ShotOf> = {}): ShotOf {
  return {
    id: `shot-${text.length}-${Math.random()}`, text, formatted: [], position: 0,
    image: null, description: '', conditions: [], sound: null, transcript: '',
    cutAfter: null, cutOver: null, cutThrough: null, layout: null, cropX: 50, cropY: 50,
    movementBy: null, movementDirection: null, movementOver: null,
    imageArrives: null, imageLasts: null, textArrives: null, textLasts: null,
    textAfter: null, textBy: null, textPace: null, textOver: null, textStays: null,
    ...own,
  } as ShotOf
}

/** A Scene cut by the hand, whose texts land whole, asking nothing. */
function scene(id: string, shots: ShotOf[], own: Partial<SceneOf> = {}): SceneOf {
  return {
    id, name: id, sets: {}, shots, sound: null, soundOfSceneId: null, transcript: '',
    soundLoops: true, cutAfter: null, cutOver: 0, cutThrough: 'image', exitsAfter: null,
    layout: 'inset', movementBy: 0, movementDirection: 'closer', movementOver: 0,
    textAfter: 0, textBy: 'whole', textPace: 15, textOver: 0, textStays: null,
    question: '', questionFlag: '',
    ...own,
  }
}

/** A way on from one Scene to another, made by a hard cut. */
function exit(from: string, to: string, own: Partial<Exit> = {}): Exit {
  return {
    id: `${from}>${to}`, fromSceneId: from, toSceneId: to, text: '', position: 0,
    conditions: [], stepsBack: null, cutOver: 0, cutThrough: 'image', ...own,
  }
}

/** An Edition opening on the first Scene it is given. */
function edition(scenes: SceneOf[], exits: Exit[] = [], openingSceneId = scenes[0]?.id ?? null) {
  return { openingSceneId, scenes, exits }
}

describe('the Reading Time of an Edition', () => {
  test('is the words of a Scene cut by hand, read at two hundred a minute', () => {
    // A hundred words is half a minute, and fifty a quarter.
    expect(readingTime(edition([scene('a', [shot(words(100)), shot(words(50))])]))).toBe(45)
  })

  test('is what the clock holds a Shot for, where that is longer than its words', () => {
    const clocked = scene('a', [shot(words(10))], { cutAfter: 20_000 })
    expect(readingTime(edition([clocked]))).toBe(20)

    // And the clock holds it from the text having arrived, never from the Image.
    const waiting = scene('a', [shot(words(10), { textAfter: 2_000 })], { cutAfter: 20_000 })
    expect(readingTime(edition([waiting]))).toBe(22)
  })

  test('counts a text arriving letter by letter at its pace, where that is longer', () => {
    // Thirty-one letters at three a second: the last arrives ten seconds in.
    const lettered = shot('a'.repeat(31), { textBy: 'letter', textPace: 3 })
    expect(readingTime(edition([scene('a', [lettered])]))).toBe(10)
  })

  test('holds a Shot with no words at the floor', () => {
    expect(readingTime(edition([scene('a', [shot(''), shot('  ')])]))).toBe(6)
  })

  test('reads a Shot that says nothing as its Scene says', () => {
    // The Scene's texts arrive a word a second: *four* starts at the fourteenth
    // character, so it lands fourteen seconds in.
    const byWord = scene('a', [shot('one two three four')], { textBy: 'word', textPace: 1 })
    expect(readingTime(edition([byWord]))).toBe(14)

    // And the Scene's clock, where the Shot does not answer for itself.
    const clocked = scene('a', [shot(''), shot('', { cutAfter: 0 })], { cutAfter: 5_000 })
    expect(readingTime(edition([clocked]))).toBe(8)
  })

  test('adds the Cut that takes each Shot off and the Exit that leads on', () => {
    const cut = scene('a', [shot(words(10), { cutOver: 1_000 })])
    expect(readingTime(edition([cut]))).toBe(4)

    const led = edition(
      [scene('a', [shot(words(10))]), scene('b', [shot(words(10))])],
      [exit('a', 'b', { cutOver: 2_000 })])
    // Three seconds a Scene, three to choose, two crossing.
    expect(readingTime(led)).toBe(11)
  })

  test('weighs the heavier of two branches', () => {
    const branching = edition(
      [scene('a', [shot(words(10))]), scene('b', [shot(words(100))]), scene('c', [shot(words(200))])],
      [exit('a', 'b'), exit('a', 'c')])
    expect(readingTime(branching)).toBe(3 + 3 + 60)
  })

  test('takes the longest route to any of several endings', () => {
    const endings = edition(
      [
        scene('a', [shot(words(10))]),
        scene('short', [shot(words(100))]),
        scene('b', [shot(words(10))]),
        scene('long', [shot(words(100))]),
      ],
      [exit('a', 'short'), exit('a', 'b'), exit('b', 'long')])
    // a, choosing, b, choosing, the long ending: past the short ending's 36.
    expect(readingTime(endings)).toBe(3 + 3 + 3 + 3 + 30)
  })

  test('adds the countdown a Scene offers its Exits for, and the time a Question takes', () => {
    const counted = edition(
      [scene('a', [shot(words(10))], { exitsAfter: 8_000 }), scene('b', [shot(words(10))])],
      [exit('a', 'b')])
    expect(readingTime(counted)).toBe(3 + 8 + 3)

    // Nought is ways on never offered: the Scene flows into the next.
    const flowing = edition(
      [scene('a', [shot(words(10))], { exitsAfter: 0 }), scene('b', [shot(words(10))])],
      [exit('a', 'b')])
    expect(readingTime(flowing)).toBe(6)

    const asking = edition([scene('a', [shot(words(10))], { question: 'Who?', questionFlag: 'who' })])
    expect(readingTime(asking)).toBe(13)
  })

  test('counts a Shot and an Exit under a Condition, being an upper bound', () => {
    const conditioned = edition(
      [
        scene('a', [shot(words(10)), shot(words(100), { conditions: [{ flag: 'x', is: 'y' }] })]),
        scene('b', [shot(words(10))]),
      ],
      [exit('a', 'b', { conditions: [{ flag: 'x', is: 'y' }] })])
    expect(readingTime(conditioned)).toBe(3 + 30 + 3 + 3)
  })

  test('ends on a cycle written before a Scene was entered once', () => {
    const looping = edition(
      [scene('a', [shot(words(10))]), scene('b', [shot(words(10))])],
      [exit('a', 'b'), exit('b', 'a')])
    // a, choosing, b, and b's choosing: the way back to a is never walked.
    expect(readingTime(looping)).toBe(12)
  })

  test('is nothing for a Story with no Opening Scene', () => {
    expect(readingTime(edition([scene('a', [shot(words(10))])], [], null))).toBeNull()
    expect(readingTime(edition([], [], null))).toBeNull()
  })

  test('reads a field an older Edition lacks as the Scene\'s default', () => {
    const older = {
      id: 'a', name: 'a', sets: {}, shots: [{ id: 's', text: words(100), conditions: [] }],
    } as unknown as SceneOf
    expect(readingTime(edition([older]))).toBe(30)
  })
})

describe('the minutes a Reading Time is shown as', () => {
  test('are to the minute under ten, and never under one', () => {
    expect(readingMinutes(0)).toBe(1)
    expect(readingMinutes(20)).toBe(1)
    expect(readingMinutes(150)).toBe(3)
    expect(readingMinutes(9 * 60 + 20)).toBe(9)
  })

  test('are to five minutes from ten on', () => {
    expect(readingMinutes(10 * 60)).toBe(10)
    expect(readingMinutes(12 * 60 + 20)).toBe(10)
    expect(readingMinutes(18 * 60)).toBe(20)
    expect(readingMinutes(62 * 60)).toBe(60)
  })
})
