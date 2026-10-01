import { describe, expect, it } from 'vitest'
import { REEL_CHANGE } from '../../demonstration/reel-change.ts'
import { SAMPLES } from '../../demonstration/samples.ts'
import { wordsOf } from '../../demonstration/work.ts'
import type { Work } from '../../demonstration/work.ts'
import { linesOf } from '../../shared/utils/formatted.ts'
import type { Formatted, Inline } from '../../shared/utils/formatted.ts'
import { textOnScreen } from '../../app/utils/remarks.ts'
import {
  CUT_AFTER_MAX,
  CUT_AFTER_MIN,
  CUT_OVER_MAX,
  CHARACTERS_A_SECOND,
  EXITS_AFTER_MAX,
  EXITS_AFTER_MIN,
  isArrival,
  isLasting,
  MOVEMENT_BY_MAX,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_OVER_MAX,
  TEXT_AFTER_MAX,
  TEXT_BYS,
  TEXT_OVER_MAX,
  TEXT_STAYS_MAX,
  isPace,
  isTime,
} from '../../shared/utils/scenes.ts'
import { LAYOUTS } from '../../shared/utils/scenes.ts'
import type { Scene, Shot } from '../../shared/utils/scenes.ts'
import { layout, movement } from '../../shared/utils/reading.ts'

/**
 * The Cut the two works this repository carries are written with — *Reel Change*
 * and the Samples — held to the two things a Cut written by hand can get wrong.
 *
 * Both works are written as literals and put into an instance by a script, so
 * nothing between the writing and the reading ever looks at them: a time past
 * its cap is a refused PATCH halfway through writing the work, and a beat cut
 * before it can be read is a Reader who never finds out. Neither is noticed by
 * the suites that hold the rest of these two works together, because both are
 * questions about a number rather than about a shape.
 *
 * The rate is the bench's own — `app/utils/remarks.ts` — so what a work is asked
 * for and what the bench complains about cannot drift apart. The margin is not:
 * the Remark fires at half the reading time, because a Remark an Author learns
 * to ignore is worse than no Remark, and what a work shipped in this repository
 * holds itself to is the whole of it. Half is the threshold for complaining
 * about somebody else's Story; it is not a standard to write one to.
 *
 * Said of both works together because the question is the same one. *Reel
 * Change* had no spec of its own until it had numbers in it.
 */
const WORKS: [string, Work][] = [
  ['Reel Change', REEL_CHANGE],
  ['the Sample written in en', SAMPLES.en],
  ['the Sample written in fr', SAMPLES.fr],
]

/**
 * Whether one of a Cut's times is one the door it is written through will take:
 * a whole number of milliseconds between the floor and the cap, the nought each
 * of them takes as a sentence, or nothing said at all.
 */
function within(held: number | undefined, max: number, min = 0) {
  return held === undefined || held === 0 || isTime(held, max, min)
}

/**
 * One Shot's text as the bench reckons it. A work leaves out what it has nothing
 * to say about, so the columns' own defaults are put back before `textOnScreen()`
 * is asked — the same function the bench reads a Shot with, rather than a second
 * statement of the same rule that could come to disagree with it.
 */
function heldFor(scene: Work['scenes'][number], shot: Work['scenes'][number]['shots'][number]) {
  return textOnScreen(
    {
      cutAfter: scene.cutAfter ?? null,
      cutOver: scene.cutOver ?? 0,
      cutThrough: scene.cutThrough ?? 'image',
      textAfter: scene.textAfter ?? 0,
      textBy: scene.textBy ?? 'whole',
      textPace: scene.textPace ?? CHARACTERS_A_SECOND,
      textOver: scene.textOver ?? 0,
      textStays: scene.textStays ?? null,
    } as Scene,
    {
      text: wordsOf(shot),
      cutAfter: shot.cutAfter ?? null,
      cutOver: shot.cutOver ?? null,
      cutThrough: shot.cutThrough ?? null,
      textAfter: shot.textAfter ?? null,
      textBy: shot.textBy ?? null,
      textPace: shot.textPace ?? null,
      textOver: shot.textOver ?? null,
      textStays: shot.textStays ?? null,
    } as Shot,
  )
}

describe.each(WORKS)('the Cut %s is written with', (_name: string, work: Work) => {
  it('writes no time the door it is written through would refuse', () => {
    for (const exit of work.exits) expect(within(exit.cutOver, CUT_OVER_MAX)).toBe(true)

    for (const scene of work.scenes) {
      expect(within(scene.cutAfter, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(true)
      // Nought is a sentinel where a Shot writes it and where the ways on do,
      // and a refusal on a Scene's own run: there is no *as the Scene says*
      // above a Scene for it to mean.
      expect(scene.cutAfter).not.toBe(0)
      expect(within(scene.cutOver, CUT_OVER_MAX)).toBe(true)
      expect(within(scene.exitsAfter, EXITS_AFTER_MAX, EXITS_AFTER_MIN)).toBe(true)

      for (const shot of scene.shots) {
        expect(within(shot.cutAfter, CUT_AFTER_MAX, CUT_AFTER_MIN)).toBe(true)
        expect(within(shot.cutOver, CUT_OVER_MAX)).toBe(true)
      }
    }
  })

  it('writes no arrival the door it is written through would refuse', () => {
    for (const scene of work.scenes) {
      expect(within(scene.textAfter, TEXT_AFTER_MAX)).toBe(true)
      expect(within(scene.textOver, TEXT_OVER_MAX)).toBe(true)
      expect(within(scene.textStays, TEXT_STAYS_MAX)).toBe(true)
      // A Scene's stay is refused nought, as its `cutAfter` is.
      expect(scene.textStays).not.toBe(0)

      for (const held of [scene, ...scene.shots]) {
        expect(within(held.textAfter, TEXT_AFTER_MAX)).toBe(true)
        expect(within(held.textOver, TEXT_OVER_MAX)).toBe(true)
        expect(within(held.textStays, TEXT_STAYS_MAX)).toBe(true)
        expect(held.textPace === undefined || isPace(held.textPace)).toBe(true)
        expect(held.textBy === undefined || TEXT_BYS.includes(held.textBy)).toBe(true)
      }
    }
  })

  it('keeps every text on screen for at least as long as it takes to read', () => {
    for (const scene of work.scenes) {
      for (const shot of scene.shots) {
        const { shown, needed } = heldFor(scene, shot)
        // A text only the Reader takes off stands for as long as they want,
        // which is the one answer this can have nothing to say about.
        if (shown === null) continue

        expect(shown).toBeGreaterThanOrEqual(needed)
      }
    }
  })
})

/** Every Effect a work writes, with the carrier it is offered to. */
function effectsOf(work: Work) {
  const shots = work.scenes.flatMap(scene => scene.shots)

  return {
    arrivals: shots.flatMap(shot => [
      ...(shot.imageArrives ? [{ held: shot.imageArrives, carrier: 'image' as const }] : []),
      ...(shot.textArrives ? [{ held: shot.textArrives, carrier: 'text' as const }] : []),
    ]),
    lastings: shots.flatMap(shot => [
      ...(shot.imageLasts ? [{ held: shot.imageLasts, carrier: 'image' as const }] : []),
      ...(shot.textLasts ? [{ held: shot.textLasts, carrier: 'text' as const }] : []),
    ]),
    image: shots.filter(shot => shot.imageArrives || shot.imageLasts).length,
    text: shots.filter(shot => shot.textArrives || shot.textLasts).length,
  }
}

describe.each(WORKS)('the Effects %s is written with', (_name: string, work: Work) => {
  it('writes no Effect the door it is written through would refuse', () => {
    const { arrivals, lastings } = effectsOf(work)

    for (const { held, carrier } of arrivals) expect(isArrival(held, carrier)).toBe(true)
    for (const { held, carrier } of lastings) expect(isLasting(held, carrier)).toBe(true)
  })
})

describe('the Effects the works carry', () => {
  it('flickers the green of the sign over the door in Reel Change, in the words', () => {
    const runs = REEL_CHANGE.scenes.flatMap(scene => scene.shots)
      .flatMap(shot => shot.formatted ? inlinesOf(shot.formatted) : [])
    expect(runs).toContainEqual(expect.objectContaining({
      text: 'the green of the sign over the door',
      marks: [{ type: 'lasts', attrs: { effect: 'flicker', strength: 'slight' } }],
    }))
  })

  it.each([['en', SAMPLES.en, 'break it'], ['fr', SAMPLES.fr, 'cassez']] as const)(
    'says the Sample in %s’s invitation to take it apart a little unsteadily',
    (_language, work, words) => {
      const runs = work.scenes.flatMap(scene => scene.shots).flatMap(shot => shot.formatted ? inlinesOf(shot.formatted) : [])
      expect(runs).toContainEqual(expect.objectContaining({
        text: words,
        marks: expect.arrayContaining([{ type: 'lasts', attrs: { effect: 'tremor', every: 300, strength: 'slight' } }]),
      }))
    },
  )

  it('gives Reel Change exactly one flicker on an Image or a whole text', () => {
    const { lastings } = effectsOf(REEL_CHANGE)

    expect(lastings.filter(({ held }) => held.effect === 'flicker')).toHaveLength(1)
  })

  it.each([['en', SAMPLES.en], ['fr', SAMPLES.fr]] as const)(
    'gives the Sample in %s one Image Effect and one text Effect',
    (_language, work) => {
      const { image, text } = effectsOf(work)

      expect(image).toBe(1)
      expect(text).toBe(1)
    },
  )
})

/** The Shot of the work, in whichever Scene, whose text begins as given. */
function shotStarting(work: Work, start: string) {
  return work.scenes
    .flatMap(scene => scene.shots)
    .find(shot => wordsOf(shot).startsWith(start))
}

describe('the arrivals the works are written with', () => {
  it('lets Reel Change’s three texts arrive where the film asks', () => {
    const booth = REEL_CHANGE.scenes.find(scene => scene.name === 'The booth')

    expect(booth).toMatchObject({ textAfter: 1500, textOver: 1200 })
    expect(shotStarting(REEL_CHANGE, 'The coat is still warm.'))
      .toMatchObject({ textStays: 2500, textOver: 800 })
    expect(shotStarting(REEL_CHANGE, 'Somewhere below it'))
      .toMatchObject({ textBy: 'word', textPace: 10, textOver: 400 })
  })

  it.each([
    ['en', 'What an Exit offers'],
    ['fr', 'Ce qu’offre une Sortie'],
  ] as const)('lets the words of the %s Sample arrive a second late, one at a time', (
    language,
    name,
  ) => {
    const scene = SAMPLES[language].scenes.find(scene => scene.name === name)

    expect(scene).toMatchObject({ textAfter: 1000, textBy: 'word', textOver: 200 })
  })
})

/**
 * The Layout and the point the works are written with, held to what each of them
 * is for: a work that is the demonstration of the Layout shows a Shot laid out
 * `full` around a point that is not the centre, an Image with nothing under it
 * and a card with no Image, and says nothing a door would refuse.
 */
describe.each(WORKS)('the Layout %s is written with', (_name: string, work: Work) => {
  const shots = work.scenes.flatMap(scene => scene.shots.map(shot => ({ scene, shot })))

  it('writes no Layout and no point the door it is written through would refuse', () => {
    for (const scene of work.scenes) {
      expect(scene.layout === undefined || LAYOUTS.includes(scene.layout)).toBe(true)

      for (const { cropX, cropY, layout } of scene.shots) {
        expect(layout === undefined || LAYOUTS.includes(layout)).toBe(true)
        for (const point of [cropX, cropY]) {
          expect(point === undefined || (Number.isInteger(point) && point >= 0 && point <= 100))
            .toBe(true)
        }
      }
    }
  })

  it('lays a Shot out full around a point that is not the centre', () => {
    expect(shots.some(({ scene, shot }) =>
      layout({ layout: scene.layout ?? 'inset' } as Scene, { layout: shot.layout ?? null } as Shot)
        === 'full'
      && shot.image !== undefined
      && ((shot.cropX ?? 50) !== 50 || (shot.cropY ?? 50) !== 50))).toBe(true)
  })

  it('carries an Image with no text and a text with no Image', () => {
    expect(shots.some(({ shot }) => shot.image !== undefined && wordsOf(shot).trim() === '')).toBe(true)
    expect(shots.some(({ shot }) => shot.image === undefined && wordsOf(shot).trim() !== '')).toBe(true)
  })
})

/**
 * The Movements the works are written with: each of them moves an Image, which is
 * what a work that demonstrates the Movement owes, and says nothing a door would
 * refuse. Resolved by `movement()` itself, the columns' defaults put back where
 * the work says nothing, as the Cut's are above.
 */
describe.each(WORKS)('the Movements %s is written with', (_name: string, work: Work) => {
  it('writes no Movement the door it is written through would refuse', () => {
    for (const held of work.scenes.flatMap(scene => [scene, ...scene.shots])) {
      expect(held.movementBy === undefined || isTime(held.movementBy, MOVEMENT_BY_MAX)).toBe(true)
      expect(held.movementOver === undefined
        || isTime(held.movementOver, MOVEMENT_OVER_MAX)).toBe(true)
      expect(held.movementDirection === undefined
        || MOVEMENT_DIRECTIONS.includes(held.movementDirection)).toBe(true)
    }
  })

  it('moves an Image', () => {
    expect(work.scenes.some(scene => scene.shots.some(shot => movement(
      {
        cutAfter: scene.cutAfter ?? null,
        movementBy: scene.movementBy ?? 0,
        movementDirection: scene.movementDirection ?? 'closer',
        movementOver: scene.movementOver ?? 0,
      } as Scene,
      {
        image: shot.image === undefined ? null : 'developed',
        cutAfter: shot.cutAfter ?? null,
        movementBy: shot.movementBy ?? null,
        movementDirection: shot.movementDirection ?? null,
        movementOver: shot.movementOver ?? null,
      } as Shot,
    ) !== null))).toBe(true)
  })
})

/** Every run and bar of a formatted text, paired with the line it stands in. */
const inlinesOf = (value: Formatted): Inline[] => linesOf(value).flat()

/** The Shot, in whichever Scene, whose words begin as given, formatted or not. */
const formattedStarting = (work: Work, start: string) =>
  shotStarting(work, start)?.formatted

/**
 * The formatting the works are written with: where a film or a lesson asks for
 * it, and nowhere it would bend the work — nothing spoken, quoted or coloured in
 * *Reel Change*, and a Story's face and alignment left at their defaults.
 */
describe('the formatting the works are written with', () => {
  it('writes each Shot with words or with a formatted text, never both', () => {
    for (const work of WORKS.map(([, work]) => work)) {
      for (const shot of work.scenes.flatMap(scene => scene.shots)) {
        expect(shot.formatted !== undefined && shot.text !== undefined).toBe(false)
      }
    }
  })

  it('gives the booth’s second Shot its reel’s label, with the name inked out', () => {
    const formatted = formattedStarting(REEL_CHANGE, '200 FT')!
    const [label, ...rest] = inlinesOf(formatted)

    expect(label).toMatchObject({ text: '200 FT · NO TITLE · FROM ' })
    expect(label).toMatchObject({
      marks: [
        { type: 'size', attrs: { step: 'small' } },
        { type: 'face', attrs: { face: 'typewriter' } },
      ],
    })
    expect(rest[0]).toEqual({ type: 'redaction', attrs: { length: 8, hides: 'a name, inked out' } })
    expect(wordsOf(shotStarting(REEL_CHANGE, '200 FT')!)).toContain('████████')
  })

  it('italicises the word the run turns on', () => {
    const formatted = formattedStarting(REEL_CHANGE, 'It is this house')!

    expect(inlinesOf(formatted)).toContainEqual({
      type: 'text',
      text: 'this',
      marks: [{ type: 'emphasis' }],
    })
  })

  it('sets the card that opens Daybreak in the title face, largest, wide and centred', () => {
    const formatted = formattedStarting(REEL_CHANGE, 'Six in the morning.')!
    const [first] = formatted.content

    expect(first).toMatchObject({ type: 'line', attrs: { align: 'centre' } })
    expect(inlinesOf(formatted)).toEqual([
      expect.objectContaining({
        text: 'Six in the morning.',
        marks: expect.arrayContaining([
          { type: 'face', attrs: { face: 'display' } },
          { type: 'size', attrs: { step: 'largest' } },
          { type: 'spacing', attrs: { step: 'wide' } },
        ]),
      }),
    ])
  })

  it('sets a Flag in the typewriter and the Sample’s aside by hand in each Sample', () => {
    for (const [flag, aside] of [['exit = taken', 'Nothing here is precious'], ['sortie = prise', 'Rien ici']] as const) {
      const work = flag.startsWith('exit') ? SAMPLES.en : SAMPLES.fr
      const runs = work.scenes.flatMap(scene => scene.shots)
        .flatMap(shot => shot.formatted ? inlinesOf(shot.formatted) : [])

      expect(runs).toContainEqual(expect.objectContaining({
        text: flag,
        marks: [{ type: 'face', attrs: { face: 'typewriter' } }],
      }))
      expect(runs.find(r => r.type === 'text' && r.text.startsWith(aside))).toMatchObject({
        marks: [{ type: 'face', attrs: { face: 'hand' } }],
      })
    }
  })

  it('holds a Sample’s twelve-second card to what is read in its hold', () => {
    for (const [language, length] of [['en', 128], ['fr', 161]] as const) {
      const card = SAMPLES[language].scenes.flatMap(scene => scene.shots)
        .find(shot => shot.formatted?.content[0]?.type === 'speech')!

      expect(card.formatted!.content.map(block => block.type)).toEqual(['speech', 'speech'])
      expect(wordsOf(card).length).toBe(length)
    }
  })
})
