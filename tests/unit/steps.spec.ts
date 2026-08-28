import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STEPS, stepShowing } from '../../app/utils/steps.ts'
import type { Condition, StoryInEditor } from '../../shared/utils/scenes.ts'
import en from '../../i18n/locales/en.json'

/**
 * The guided path, as a pure function of the Story on the bench. No database and
 * no browser: a Step asks a question of the Story the editor already holds, so the
 * whole of the feature's logic answers to a literal.
 */

/**
 * A Story in the shape the editor loads it, with the Scenes it is given: each a
 * name, and the text of the one Shot in it where there is anything written.
 */
function onTheBench(scenes: [name: string, shot?: string][] = []): StoryInEditor {
  return {
    id: 'a-story',
    title: 'A Story',
    language: 'en',
    openingSceneId: scenes[0]?.[0] ?? null,
    publishedAt: null,
    // Only what a Step reads is filled in; a Scene here is a name and an id, the
    // fact that it exists, and what is written in it.
    scenes: scenes.map(([name, shot], place) => ({
      id: name,
      name,
      x: 0,
      y: place * 100,
      sets: {},
      shots: shot === undefined ? [] : [{ id: `${name}-1`, text: shot }],
    })) as StoryInEditor['scenes'],
    exits: [],
  }
}

/**
 * The Story the path has got to by the time State is what is being taught: two
 * Scenes, the first written, and an Exit joining them.
 */
function joined() {
  const story = onTheBench([['The arrival', 'She steps off the train.'], ['The platform']])
  story.exits = [{ id: 'a-exit' }] as StoryInEditor['exits']

  return story
}

/** The Flags one Scene of this Story sets on entry. */
function sets(story: StoryInEditor, scene: number, flags: Record<string, string>) {
  story.scenes[scene]!.sets = flags
}

/** One Shot of this Scene, carrying the Conditions it plays under. */
function playedWhen(story: StoryInEditor, scene: number, ...conditions: Condition[]) {
  story.scenes[scene]!.shots = [
    { id: 'a-shot', text: 'The train is gone.', conditions },
  ] as StoryInEditor['scenes'][number]['shots']
}

/**
 * What the bench is asking for, of a Story with the Scene it is given in the
 * panel — and of one with nothing in it, which is where the bench starts.
 */
function asking(story: StoryInEditor, writing?: string) {
  return stepShowing(story, writing)?.name
}

describe('the Step the bench is showing', () => {
  it('asks for a Scene of a Story that has none', () => {
    expect(asking(onTheBench())).toBe('nameScene')
  })

  it('asks for the Scene to be written once there is one on the bench', () => {
    expect(asking(onTheBench([['The arrival']]))).toBe('writeScene')
  })

  it('asks for a Shot to be written once a Scene is in the panel', () => {
    const story = onTheBench([['The arrival']])

    expect(asking(story, 'The arrival')).toBe('writeShot')
  })

  it('reads a Shot of blank space as one nobody has written', () => {
    const story = onTheBench([['The arrival', '   ']])

    expect(asking(story, 'The arrival')).toBe('writeShot')
  })

  it('asks for a second Scene once the first Shot is written', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.']])

    expect(asking(story, 'The arrival')).toBe('secondScene')
  })

  it('asks for an Exit once there are two Scenes to join', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.'], ['The platform']])

    expect(asking(story, 'The arrival')).toBe('drawExit')
  })

  it('asks for a Flag once the two Scenes are joined', () => {
    expect(asking(joined(), 'The arrival')).toBe('setFlag')
  })

  it('asks for a Condition once a Flag is set', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })

    expect(asking(story, 'The arrival')).toBe('putCondition')
  })

  /**
   * The Flag is asked for on the first Scene, because that is where a Reading
   * starts, but any Flag anywhere is a Flag set: an Author who put one on the
   * second Scene has met the step and is not told they did it wrong.
   */
  it('takes a Flag set on any Scene as the Flag it asked for', () => {
    const story = joined()
    sets(story, 1, { courage: 'high' })

    expect(asking(story)).toBe('putCondition')
  })

  /** The one step that is skipped by every Story that never lost its opening. */
  it('asks for an opening Scene once the Story has lost the one it had', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 1, { flag: 'courage', is: 'low' })
    story.openingSceneId = null

    expect(asking(story)).toBe('openingScene')
  })

  it('asks for the Preview once a Shot of the second Scene tests that Flag', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 1, { flag: 'courage', is: 'low' })

    expect(asking(story)).toBe('previewCondition')
  })

  /**
   * Written broken on purpose is what the Condition step asks for, and the step
   * after it is met by the value being right however the Author got there: the
   * one who guessed it right the first time, or never opened the Preview at all,
   * is past both and asked to publish.
   */
  it('asks for the Publish once the Condition names a value the Flag holds', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 1, { flag: 'courage', is: 'high' })

    expect(asking(story)).toBe('publish')
  })

  /**
   * The Flag is set on one Scene and tested on another, so what has to match is
   * the value some Scene of this Story actually sets it to. A Condition against a
   * value nothing sets is the broken one the Preview has to explain.
   */
  it('goes on asking for the Preview while the value is one no Scene sets', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    sets(story, 1, { coat: 'on' })
    playedWhen(story, 1, { flag: 'courage', is: 'mislaid' })

    expect(asking(story)).toBe('previewCondition')
  })

  /**
   * Any Scene setting the Flag to that value counts, including one no Reading has
   * been through by the time the second Scene plays. The strict reading is the
   * Reading engine run from the opening Scene, which is what the Preview is for
   * and far more than a predicate over the Story on the bench. Pinned here rather
   * than left to be found, because it is the one case where the Step is met and a
   * Reader still never plays that Shot.
   */
  it('takes the value from any Scene, downstream of the one testing it or not', () => {
    const story = onTheBench([
      ['The arrival', 'She steps off the train.'],
      ['The platform'],
      ['The bar'],
      ['The last train'],
    ])
    story.exits = [{ id: 'a-exit' }] as StoryInEditor['exits']
    sets(story, 0, { courage: 'high' })
    sets(story, 3, { courage: 'low' })
    playedWhen(story, 1, { flag: 'courage', is: 'low' })

    expect(asking(story)).toBe('publish')
  })

  it('asks nothing once that Story is published', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 1, { flag: 'courage', is: 'high' })
    story.publishedAt = '2026-01-01T00:00:00.000Z'

    expect(asking(story)).toBeUndefined()
  })

  it('goes on asking while the Condition on the second Scene names no Flag that is set', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 1, { flag: 'coat', is: 'on' })

    expect(asking(story)).toBe('putCondition')
  })

  /**
   * A visit count is a Condition, and it is not this lesson: the Sample teaches
   * it, already working, and what is taught here is where State comes from.
   */
  it('does not take a visit count as the Condition it asked for', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 1, { scene: 'The platform', visits: 'at least', times: 2 })

    expect(asking(story)).toBe('putCondition')
  })

  /**
   * The Condition is asked for on the second Scene, where a Flag the first sets
   * is already in State. One on the first Scene's own Shot is a Condition the
   * Author wrote somewhere else, and the step is still waiting.
   */
  it('does not take a Condition on the first Scene as the one it asked for', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })
    playedWhen(story, 0, { flag: 'courage', is: 'low' })

    expect(asking(story)).toBe('putCondition')
  })

  /**
   * Nothing blocks and nothing is confirmed, so an Author who improvises past
   * three steps meets three Steps and is asked for the fourth, whatever the panel
   * is holding.
   */
  it('asks for what is still missing when the Author works out of order', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.'], ['The platform']])

    expect(asking(story)).toBe('drawExit')
  })

  /**
   * The panel is opened for the sake of what is written in it, so a Story that
   * arrives written — a Sample — is never asked to open it, and a Sample, which is
   * past every step, is asked nothing at all.
   */
  it('asks a Story whose Shots are already written to open no panel', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.']])

    expect(asking(story)).toBe('secondScene')
  })
})

describe('every Step', () => {
  it('carries a sentence in the message files', () => {
    const said = en.step as Record<string, string>

    expect(STEPS.filter(step => !said[step.name]).map(step => step.name)).toEqual([])
  })

  /**
   * The one assertion here about the source rather than about something a person
   * can observe, and for the same reason the two message files are held against
   * each other: a target renamed on one side and forgotten on the other is the
   * likeliest defect this feature has, it needs neither browser nor database to
   * catch, and the alternative is finding out because a bubble pointed at
   * nothing. See `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.
   */
  it('points at an element the editor actually draws, exactly once', () => {
    const editor = readFileSync('app/pages/stories/[id]/index.vue', 'utf8')
    const drawn = [...editor.matchAll(/data-step="([^"]+)"/g)].map(([, target]) => target)

    // Held as sets on both sides: the editor draws each target once, and two
    // Steps may ask for two things in the same place.
    expect(drawn.sort()).toEqual([...new Set(STEPS.map(step => step.target))].sort())
  })
})
