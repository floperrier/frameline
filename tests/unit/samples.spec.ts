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
  VISITS_MAX,
  imageTypeOf,
} from '../../shared/utils/scenes.ts'
import type { Condition } from '../../shared/utils/scenes.ts'
import { STORY_LANGUAGES, STORY_TITLE_MAX_LENGTH } from '../../shared/utils/stories.ts'

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
 * A Condition as the two Samples can be compared by: the Scene it counts, or the
 * Scene whose Flag it tests, each by its Place in the work rather than by its
 * name, and whether the test asks for a value or for the absence of one.
 */
function shapeOfCondition(work: Work, condition: Condition) {
  if ('scene' in condition) {
    return { visits: condition.visits, times: condition.times, of: placeOf(work, condition.scene) }
  }

  return {
    setBy: work.scenes.findIndex(scene => condition.flag in (scene.sets ?? {})),
    asks: condition.is === '' ? 'nothing' : 'a value',
  }
}

/**
 * A whole Sample with every word taken out of it: how many Scenes, how many
 * Shots in each, which image each Shot shows, what each carries by way of
 * Conditions, and which Scene leads to which. Two Samples that agree here are
 * the same work in two languages.
 */
function shapeOf(work: Work) {
  return {
    language: Boolean(work.language),
    opening: placeOf(work, work.opening ?? ''),
    scenes: work.scenes.map(scene => ({
      at: scene.at,
      sets: Object.keys(scene.sets ?? {}).length,
      shots: scene.shots.map(shot => ({
        image: shot.image,
        described: Boolean(shot.description),
        when: (shot.when ?? []).map(condition => shapeOfCondition(work, condition)),
      })),
    })),
    exits: work.exits.map(exit => ({
      from: placeOf(work, exit.from),
      to: placeOf(work, exit.to),
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
      ...scene.shots.flatMap(shot => [shot.text, shot.description ?? '']),
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

  it('counts visits somewhere, so a Condition needing no Flag is met', () => {
    const counting = conditionsOf(sample).filter(condition => 'scene' in condition)

    expect(counting.length).toBeGreaterThan(0)
    for (const condition of counting) {
      expect(sample.scenes.map(scene => scene.name)).toContain(condition.scene)
      expect(condition.times).toBeLessThanOrEqual(VISITS_MAX)
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

  it('leaves no Scene whose only way on carries Conditions', () => {
    for (const scene of sample.scenes) {
      const leaving = sample.exits.filter(exit => exit.from === scene.name)

      // A Scene with no way on at all is an ending, which a Sample does not have;
      // a Scene whose ways on are all conditional is one an unmet Condition turns
      // into an ending nobody wrote.
      expect(leaving.length).toBeGreaterThan(0)
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

describe('the two Samples', () => {
  it('are the same work in two languages', () => {
    expect(shapeOf(SAMPLES.en)).toEqual(shapeOf(SAMPLES.fr))
  })

  it('share not one line of what they say', () => {
    const french = new Set(textOf(SAMPLES.fr))

    for (const line of textOf(SAMPLES.en)) expect(french).not.toContain(line)
  })
})
