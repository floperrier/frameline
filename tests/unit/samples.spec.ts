import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SAMPLES,
  SAMPLE_LANGUAGES,
  SAMPLE_IMAGES,
  imagePath,
  type SampleLanguage,
} from '../../demonstration/samples.ts'
import type { Work } from '../../demonstration/work.ts'
import {
  CONDITIONS_MAX,
  EXIT_TEXT_MAX_LENGTH,
  FLAGS_PER_SCENE,
  SCENE_NAME_MAX_LENGTH,
  SHOT_DESCRIPTION_MAX_LENGTH,
  SHOT_IMAGE_MAX_BYTES,
  SHOT_TEXT_MAX_LENGTH,
  imageTypeOf,
} from '../../shared/utils/scenes.ts'
import type { Condition } from '../../shared/utils/scenes.ts'
import { STORY_LANGUAGES, STORY_TITLE_MAX_LENGTH } from '../../shared/utils/stories.ts'
import { SOUND_LIBRARY } from '../../shared/utils/library.ts'

/**
 * The Samples as data. A Sample is written to be taken apart by an Author who
 * has never seen the product, so what is checked here is that it holds together
 * as a work — every Condition tests something a Scene actually sets, no Scene
 * ends a Reading by accident, a Reading has somewhere to start — and that the
 * two of them are the same lesson in two languages.
 *
 * Nothing here asks what a Sample says. The English one and the French one are
 * separate works and neither is a translation of the other, so the only thing
 * held against the other Sample is the shape.
 *
 * What the Cut's own times are — within their caps, and long enough for the text
 * of the beat they hold — is asked of both works this repository carries at once,
 * in `tests/unit/works.spec.ts`, because it is the same question of *Reel
 * Change*. What is asked here is only that the two Samples answer it alike.
 */

/** The Conditions a work carries, wherever they are carried. */
function conditionsOf(work: Work) {
  return [
    ...work.exits.flatMap(exit => exit.when ?? []),
    ...work.scenes.flatMap(scene => scene.shots.flatMap(shot => shot.when ?? [])),
  ]
}

/** Where a Scene comes in the work, which is how a Scene is named without its name. */
function placeOf(work: Work, name: string) {
  return work.scenes.findIndex(scene => scene.name === name)
}

/**
 * A Condition as the two Samples can be compared by: the Scene it asks about, or
 * the Scene whose Flag it tests, each by its Place in the work rather than by its
 * name, and whether the test asks for a value or for the absence of one.
 */
function shapeOfCondition(work: Work, condition: Condition) {
  if ('scene' in condition) {
    return {
      entered: 'entered' in condition && condition.entered,
      of: placeOf(work, condition.scene),
    }
  }

  return {
    setBy: work.scenes.findIndex(scene => condition.flag in (scene.sets ?? {})),
    asks: condition.is === '' ? 'nothing' : 'a value',
  }
}

/**
 * A whole Sample with every word taken out of it: how many Scenes, how many
 * Shots in each, which image each Shot shows, what each carries by way of
 * Conditions, how each is cut, and which Scene leads to which. Two Samples that
 * agree here are the same work in two languages.
 *
 * The Cut is read as the value itself rather than as whether there is one,
 * because the three states of a time each mean something different and nought
 * is one of them — a Sample held until the press in one language and cut after
 * nine seconds in the other is not the same work twice.
 */
function shapeOf(work: Work) {
  return {
    language: Boolean(work.language),
    opening: placeOf(work, work.opening ?? ''),
    scenes: work.scenes.map(scene => ({
      sets: Object.keys(scene.sets ?? {}).length,
      sound: scene.sound,
      transcribed: Boolean(scene.transcript),
      cutAfter: scene.cutAfter,
      cutOver: scene.cutOver,
      cutThrough: scene.cutThrough,
      exitsAfter: scene.exitsAfter,
      shots: scene.shots.map(shot => ({
        image: shot.image,
        described: Boolean(shot.description),
        sound: shot.sound,
        transcribed: Boolean(shot.transcript),
        cutAfter: shot.cutAfter,
        cutOver: shot.cutOver,
        cutThrough: shot.cutThrough,
        when: (shot.when ?? []).map(condition => shapeOfCondition(work, condition)),
      })),
    })),
    exits: work.exits.map(exit => ({
      from: placeOf(work, exit.from),
      to: placeOf(work, exit.to),
      cutOver: exit.cutOver,
      cutThrough: exit.cutThrough,
      when: (exit.when ?? []).map(condition => shapeOfCondition(work, condition)),
    })),
  }
}

/** Every line of prose a Sample carries, in no particular order. */
function textOf(work: Work) {
  return [
    work.title,
    ...work.exits.map(exit => exit.text),
    ...work.scenes.flatMap(scene => [
      scene.name,
      scene.transcript ?? '',
      ...scene.shots.flatMap(shot => [shot.text, shot.description ?? '', shot.transcript ?? '']),
    ]),
  ].filter(Boolean)
}

/**
 * The Scenes a Reading can reach without ever entering one of them, taking only
 * the ways on that are offered to everybody. Under-counting on purpose: an Exit
 * carrying Conditions might be offered too, and a route that needs none is the
 * one an Author is certain to find.
 */
function reachedWithout(work: Work, avoiding: string) {
  const reached = new Set<string>()
  const walking = [work.opening ?? work.scenes[0]!.name]

  while (walking.length) {
    const scene = walking.pop()!
    if (scene === avoiding || reached.has(scene)) continue

    reached.add(scene)
    walking.push(...work.exits
      .filter(exit => exit.from === scene && !exit.when?.length)
      .map(exit => exit.to))
  }

  return reached
}

describe.each(SAMPLE_LANGUAGES)('the Sample written in %s', (language: SampleLanguage) => {
  const sample = SAMPLES[language]

  it('says what Language it is written in, and it is that one', () => {
    expect(sample.language).toBe(language)
    expect(STORY_LANGUAGES).toContain(sample.language)
  })

  it('names the Scene a Reading starts on', () => {
    expect(sample.opening).toBeTruthy()
    expect(sample.scenes.map(scene => scene.name)).toContain(sample.opening)
  })

  it('is three Scenes, each a run of written Shots', () => {
    expect(sample.scenes).toHaveLength(3)

    for (const scene of sample.scenes) {
      expect(scene.shots.length).toBeGreaterThan(0)
      // A Shot with neither text nor an image is one nobody has written yet.
      for (const shot of scene.shots) expect(shot.text || shot.image).toBeTruthy()
    }
  })

  it('sets a Flag on entry to a Scene, and tests it on a Shot', () => {
    const set = sample.scenes.flatMap(scene => Object.keys(scene.sets ?? {}))
    const tested = sample.scenes
      .flatMap(scene => scene.shots.flatMap(shot => shot.when ?? []))
      .filter(condition => 'flag' in condition)

    expect(set.length).toBeGreaterThan(0)
    expect(tested.length).toBeGreaterThan(0)
  })

  it('asks about a Scene somewhere, so a Condition needing no Flag is met', () => {
    const asking = conditionsOf(sample).filter(condition => 'scene' in condition)

    expect(asking.length).toBeGreaterThan(0)
    for (const condition of asking) {
      expect(sample.scenes.map(scene => scene.name)).toContain(condition.scene)
      // In the shape that replaced the one that counted, and never in the old one:
      // the Samples are written here rather than migrated, so #306 has nothing of
      // theirs to rewrite.
      expect(condition).toHaveProperty('entered')
    }
  })

  it('names, in every Condition testing a Flag, a Flag some Scene sets', () => {
    const set = new Set(sample.scenes.flatMap(scene => Object.keys(scene.sets ?? {})))

    for (const condition of conditionsOf(sample)) {
      if ('flag' in condition) expect(set).toContain(condition.flag)
    }
  })

  it('tests a Flag on a Shot a Reading can arrive without', () => {
    // A Condition every Reading meets teaches nothing: the Author previews the
    // Story, sees the Shot play, and never learns what the test was for. So for
    // each Flag a Shot tests, there has to be a way to the Scene it is in that
    // misses the Scene setting that Flag.
    for (const scene of sample.scenes) {
      for (const shot of scene.shots) {
        for (const condition of shot.when ?? []) {
          if (!('flag' in condition)) continue

          const setter = sample.scenes.find(other => condition.flag in (other.sets ?? {}))!
          expect(reachedWithout(sample, setter.name)).toContain(scene.name)
        }
      }
    }
  })

  it('ends once, and never by a Condition that did not hold', () => {
    const endings = sample.scenes.filter(scene => !sample.exits.some(exit => exit.from === scene.name))

    // A Story read forwards has to stop somewhere — see
    // `docs/adr/0048-a-scene-is-entered-once.md` — and the Sample stops once, on
    // purpose. Every other Scene keeps a way on that no Condition can take away,
    // because a Scene whose ways on are all conditional is one an unmet Condition
    // turns into an ending nobody wrote.
    expect(endings).toHaveLength(1)

    for (const scene of sample.scenes) {
      const leaving = sample.exits.filter(exit => exit.from === scene.name)

      if (!leaving.length) continue

      expect(leaving.some(exit => !exit.when?.length)).toBe(true)
    }
  })

  it('joins Scenes it has, and nothing else', () => {
    const names = sample.scenes.map(scene => scene.name)

    for (const exit of sample.exits) {
      expect(names).toContain(exit.from)
      expect(names).toContain(exit.to)
    }
  })

  it('shows an image the recipes hold, wherever a Shot shows one', () => {
    const shown = sample.scenes.flatMap(scene => scene.shots).map(shot => shot.image)

    expect(shown.filter(Boolean).length).toBeGreaterThan(0)
    for (const image of shown) {
      if (image) expect(Object.keys(SAMPLE_IMAGES)).toContain(image)
    }
  })

  it('carries nothing longer than the API it is written through will take', () => {
    expect(sample.title.length).toBeLessThanOrEqual(STORY_TITLE_MAX_LENGTH)

    for (const exit of sample.exits) {
      expect(exit.text.length).toBeLessThanOrEqual(EXIT_TEXT_MAX_LENGTH)
      expect(exit.when?.length ?? 0).toBeLessThanOrEqual(CONDITIONS_MAX)
    }

    for (const scene of sample.scenes) {
      expect(scene.name.length).toBeLessThanOrEqual(SCENE_NAME_MAX_LENGTH)
      expect(Object.keys(scene.sets ?? {}).length).toBeLessThanOrEqual(FLAGS_PER_SCENE)

      for (const shot of scene.shots) {
        expect(shot.text.length).toBeLessThanOrEqual(SHOT_TEXT_MAX_LENGTH)
        expect((shot.description ?? '').length).toBeLessThanOrEqual(SHOT_DESCRIPTION_MAX_LENGTH)
        expect(shot.when?.length ?? 0).toBeLessThanOrEqual(CONDITIONS_MAX)
      }
    }
  })
})

describe('the images a Sample shows', () => {
  it.each(Object.keys(SAMPLE_IMAGES))('is committed as a WebP a Shot will carry: %s', (name) => {
    const bytes = readFileSync(imagePath(name))

    // Read from the file's own first bytes, the way the server reads an upload:
    // an image committed as something else would be refused as it was attached.
    expect(imageTypeOf(bytes)).toBe('image/webp')
    expect(bytes.length).toBeLessThanOrEqual(SHOT_IMAGE_MAX_BYTES)
  })
})

describe('the Sound a Sample is heard under', () => {
  const library = new Set(SOUND_LIBRARY.map(sound => sound.file))

  it('is a file the library actually ships, in either language', () => {
    for (const language of SAMPLE_LANGUAGES) {
      for (const scene of SAMPLES[language].scenes) {
        if (scene.sound) expect(library).toContain(scene.sound)
        for (const shot of scene.shots) {
          if (shot.sound) expect(library).toContain(shot.sound)
        }
      }
    }
  })

  it('is transcribed wherever it is carried, in the language the Sample is written in', () => {
    for (const language of SAMPLE_LANGUAGES) {
      const carried = SAMPLES[language].scenes.flatMap(scene => [
        ...(scene.sound ? [scene.transcript] : []),
        ...scene.shots.filter(shot => shot.sound).map(shot => shot.transcript),
      ])

      expect(carried.length).toBeGreaterThan(0)
      expect(carried.filter(said => !said?.trim())).toEqual([])
    }
  })
})

describe('the two Samples', () => {
  it('are the same work in two languages', () => {
    expect(shapeOf(SAMPLES.en)).toEqual(shapeOf(SAMPLES.fr))
  })

  it('share not one line of what they say', () => {
    const french = new Set(textOf(SAMPLES.fr))

    for (const line of textOf(SAMPLES.en)) expect(french).not.toContain(line)
  })
})
