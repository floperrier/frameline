import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LEADERS,
  LEADER_LANGUAGES,
  LEADER_STILLS,
  stillPath,
  type LeaderLanguage,
} from '../../demonstration/leaders.ts'
import type { Work } from '../../demonstration/work.ts'
import {
  CONDITIONS_MAX,
  CUT_TEXT_MAX_LENGTH,
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
 * The Leaders as data. A Leader is written to be taken apart by an Author who
 * has never seen the product, so what is checked here is that it holds together
 * as a work — every Condition tests something a Scene actually sets, no Scene
 * ends a Reading by accident, a Reading has somewhere to start — and that the
 * two of them are the same lesson in two languages.
 *
 * Nothing here asks what a Leader says. The English one and the French one are
 * separate works and neither is a translation of the other, so the only thing
 * held against the other Leader is the shape.
 */

/** The Conditions a work carries, wherever they are carried. */
function conditionsOf(work: Work) {
  return [
    ...work.cuts.flatMap(cut => cut.when ?? []),
    ...work.scenes.flatMap(scene => scene.shots.flatMap(shot => shot.when ?? [])),
  ]
}

/** Where a Scene comes in the work, which is how a Scene is named without its name. */
function placeOf(work: Work, name: string) {
  return work.scenes.findIndex(scene => scene.name === name)
}

/**
 * A Condition as the two Leaders can be compared by: the Scene it counts, or the
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
 * A whole Leader with every word taken out of it: how many Scenes, how many
 * Shots in each, which still each Shot shows, what each carries by way of
 * Conditions, and which Scene leads to which. Two Leaders that agree here are
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
        still: shot.still,
        described: Boolean(shot.description),
        when: (shot.when ?? []).map(condition => shapeOfCondition(work, condition)),
      })),
    })),
    cuts: work.cuts.map(cut => ({
      from: placeOf(work, cut.from),
      to: placeOf(work, cut.to),
      when: (cut.when ?? []).map(condition => shapeOfCondition(work, condition)),
    })),
  }
}

/** Every line of prose a Leader carries, in no particular order. */
function textOf(work: Work) {
  return [
    work.title,
    ...work.cuts.map(cut => cut.text),
    ...work.scenes.flatMap(scene => [
      scene.name,
      ...scene.shots.flatMap(shot => [shot.text, shot.description ?? '']),
    ]),
  ].filter(Boolean)
}

describe.each(LEADER_LANGUAGES)('the Leader written in %s', (language: LeaderLanguage) => {
  const leader = LEADERS[language]

  it('says what Language it is written in, and it is that one', () => {
    expect(leader.language).toBe(language)
    expect(STORY_LANGUAGES).toContain(leader.language)
  })

  it('names the Scene a Reading starts on', () => {
    expect(leader.opening).toBeTruthy()
    expect(leader.scenes.map(scene => scene.name)).toContain(leader.opening)
  })

  it('is three Scenes, each a run of written Shots', () => {
    expect(leader.scenes).toHaveLength(3)

    for (const scene of leader.scenes) {
      expect(scene.shots.length).toBeGreaterThan(0)
      // A Shot with neither text nor a still is one nobody has written yet.
      for (const shot of scene.shots) expect(shot.text || shot.still).toBeTruthy()
    }
  })

  it('sets a Flag on entry to a Scene, and tests it on a Shot', () => {
    const set = leader.scenes.flatMap(scene => Object.keys(scene.sets ?? {}))
    const tested = leader.scenes
      .flatMap(scene => scene.shots.flatMap(shot => shot.when ?? []))
      .filter(condition => 'flag' in condition)

    expect(set.length).toBeGreaterThan(0)
    expect(tested.length).toBeGreaterThan(0)
  })

  it('counts visits somewhere, so a Condition needing no Flag is met', () => {
    const counting = conditionsOf(leader).filter(condition => 'scene' in condition)

    expect(counting.length).toBeGreaterThan(0)
    for (const condition of counting) {
      expect(leader.scenes.map(scene => scene.name)).toContain(condition.scene)
      expect(condition.times).toBeLessThanOrEqual(VISITS_MAX)
    }
  })

  it('names, in every Condition testing a Flag, a Flag some Scene sets', () => {
    const set = new Set(leader.scenes.flatMap(scene => Object.keys(scene.sets ?? {})))

    for (const condition of conditionsOf(leader)) {
      if ('flag' in condition) expect(set).toContain(condition.flag)
    }
  })

  it('leaves no Scene whose only way on carries Conditions', () => {
    for (const scene of leader.scenes) {
      const leaving = leader.cuts.filter(cut => cut.from === scene.name)

      // A Scene with no way on at all is an ending, which a Leader does not have;
      // a Scene whose ways on are all conditional is one an unmet Condition turns
      // into an ending nobody wrote.
      expect(leaving.length).toBeGreaterThan(0)
      expect(leaving.some(cut => !cut.when?.length)).toBe(true)
    }
  })

  it('joins Scenes it has, and nothing else', () => {
    const names = leader.scenes.map(scene => scene.name)

    for (const cut of leader.cuts) {
      expect(names).toContain(cut.from)
      expect(names).toContain(cut.to)
    }
  })

  it('shows a still the recipes hold, wherever a Shot shows one', () => {
    const shown = leader.scenes.flatMap(scene => scene.shots).map(shot => shot.still)

    expect(shown.filter(Boolean).length).toBeGreaterThan(0)
    for (const still of shown) {
      if (still) expect(Object.keys(LEADER_STILLS)).toContain(still)
    }
  })

  it('carries nothing longer than the API it is written through will take', () => {
    expect(leader.title.length).toBeLessThanOrEqual(STORY_TITLE_MAX_LENGTH)

    for (const cut of leader.cuts) {
      expect(cut.text.length).toBeLessThanOrEqual(CUT_TEXT_MAX_LENGTH)
      expect(cut.when?.length ?? 0).toBeLessThanOrEqual(CONDITIONS_MAX)
    }

    for (const scene of leader.scenes) {
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

describe('the stills a Leader shows', () => {
  it.each(Object.keys(LEADER_STILLS))('is committed as a WebP a Shot will carry: %s', (name) => {
    const bytes = readFileSync(stillPath(name))

    // Read from the file's own first bytes, the way the server reads an upload:
    // a still committed as something else would be refused as it was attached.
    expect(imageTypeOf(bytes)).toBe('image/webp')
    expect(bytes.length).toBeLessThanOrEqual(SHOT_IMAGE_MAX_BYTES)
  })
})

describe('the two Leaders', () => {
  it('are the same work in two languages', () => {
    expect(shapeOf(LEADERS.en)).toEqual(shapeOf(LEADERS.fr))
  })

  it('share not one line of what they say', () => {
    const french = new Set(textOf(LEADERS.fr))

    for (const line of textOf(LEADERS.en)) expect(french).not.toContain(line)
  })
})
