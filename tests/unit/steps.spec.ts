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
 * What the bench is asking for of this Story — and of one with nothing in it,
 * which is where the bench starts.
 */
function asking(story: StoryInEditor) {
  return stepShowing(story)?.name
}

describe('the Step the bench is showing', () => {
  it('asks for a Scene of a Story that has none', () => {
    expect(asking(onTheBench())).toBe('nameScene')
  })

  /**
   * The gesture that makes a Scene opens it for writing as well, so a Story with
   * a Scene in it is a Story whose writing surface the Author has already been
   * shown: what is asked for next is what goes in it.
   */
  it('asks for a Shot once there is a Scene on the bench', () => {
    expect(asking(onTheBench([['The arrival']]))).toBe('writeShot')
  })

  it('reads a Shot of blank space as one nobody has written', () => {
    const story = onTheBench([['The arrival', '   ']])

    expect(asking(story)).toBe('writeShot')
  })

  /**
   * The second Scene and the Exit to it are one gesture and so one Step: an
   * Author with one written Scene is asked to draw a way on out of it, and the
   * Scene it lands on is made by the same movement.
   */
  it('asks for an Exit once the first Shot is written', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.']])

    expect(asking(story)).toBe('wayOn')
  })

  it('asks for an Exit once there are two Scenes to join', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.'], ['The platform']])

    expect(asking(story)).toBe('wayOn')
  })

  it('asks for a Flag once the two Scenes are joined', () => {
    expect(asking(joined())).toBe('setFlag')
  })

  it('asks for a Condition once a Flag is set', () => {
    const story = joined()
    sets(story, 0, { courage: 'high' })

    expect(asking(story)).toBe('putCondition')
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
   * Nothing blocks and nothing is confirmed, so an Author who joined two Scenes
   * before writing a word in either is asked for the word: the Steps ahead of the
   * one they jumped are met, and the one they left behind is the one they are
   * asked for.
   */
  it('asks for what is still missing when the Author works out of order', () => {
    const story = onTheBench([['The arrival'], ['The platform']])
    story.exits = [{ id: 'a-exit' }] as StoryInEditor['exits']

    expect(asking(story)).toBe('writeShot')
  })
})

/**
 * The bench with a Scene open for writing: the page, the header over it, the
 * document the Scene is written in and the Preview beside it. Every Step but the
 * first is read in that state, so this is where its target has to be.
 */
const WRITING = [
  'app/pages/stories/[id]/index.vue',
  'app/components/StoryHeader.vue',
  'app/components/Panel.vue',
  'app/components/Preview.vue',
]

/** Every file the bench is drawn from, the canvas the first Step points at included. */
const EDITOR = ['app/components/Graph.vue', ...WRITING]

/** Every file named, read as the one source the editor is drawn from. */
function drawnFrom(files: string[]) {
  return files.map(file => readFileSync(file, 'utf8')).join('\n')
}

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
    // Every file the bench is drawn from, because the editor is the page and the
    // three pieces it is laid out from: a target that moved from one of them to
    // another has moved within the same editor.
    const drawn = [...drawnFrom(EDITOR).matchAll(/data-step="([^"]+)"/g)]
      .map(([, target]) => target)

    // Held as sets on both sides: the editor draws each target once, and two
    // Steps may ask for two things in the same place.
    expect(drawn.sort()).toEqual([...new Set(STEPS.map(step => step.target))].sort())
  })

  /**
   * Not merely that the target is drawn somewhere, but that it is drawn where the
   * bench answers a press at the moment the Step is shown. Every Step but the
   * first is read with a Scene open for writing — every act that makes a Scene
   * opens it — and there the canvas is folded into a rail: a press on a card in
   * the rail writes that Scene, the aiming refuses outright, and the drawing has
   * no bare bench left to let go on. A target on the canvas is therefore a Step
   * asking for a gesture that does nothing, which is what the Exit step did until
   * the way on it teaches moved into the Scene's own document.
   *
   * The first Step is the exception and the one target the canvas keeps: it is
   * asked of a Story with no Scene in it, where the graph is not drawn at all and
   * the control that writes the first Scene stands in its place.
   *
   * Which surface the target is drawn in is as far as source read as text can go.
   * That the control then answers the press the sentence asks for is walked in
   * `tests/e2e/steps-signed-in.spec.ts`, Step by Step, in the state each one is
   * shown in and with nothing closed or switched to first.
   */
  it('points at something the bench answers where the Step is read', () => {
    const written = drawnFrom(WRITING)

    expect(STEPS
      .filter(step => step.name !== 'nameScene')
      .filter(step => !written.includes(`data-step="${step.target}"`))
      .map(step => step.name)).toEqual([])
  })
})
