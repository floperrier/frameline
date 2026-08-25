import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CUES, cueShowing } from '../../app/utils/cues.ts'
import type { StoryInEditor } from '../../shared/utils/scenes.ts'
import en from '../../i18n/locales/en.json'

/**
 * The guided path, as a pure function of the Story on the bench. No database and
 * no browser: a Cue asks a question of the Story the editor already holds, so the
 * whole of the feature's logic answers to a literal.
 */

/** A Story in the shape the editor loads it, with the Scenes it is given. */
function onTheBench(scenes: string[] = []): StoryInEditor {
  return {
    id: 'a-story',
    title: 'A Story',
    language: 'en',
    openingSceneId: scenes[0] ?? null,
    publishedAt: null,
    // Only what a Cue reads is filled in; a Scene here is a name and an id and
    // the fact that it exists.
    scenes: scenes.map((name, place) => ({
      id: name, name, x: 0, y: place * 100, sets: {}, shots: [],
    })) as StoryInEditor['scenes'],
    cuts: [],
  }
}

describe('the Cue the bench is showing', () => {
  it('asks for a Scene of a Story that has none', () => {
    expect(cueShowing(onTheBench())?.name).toBe('nameScene')
  })

  it('asks nothing of a Story that already has a Scene', () => {
    expect(cueShowing(onTheBench(['The arrival']))).toBeUndefined()
  })

  it('asks nothing of a Story that arrives finished', () => {
    expect(cueShowing(onTheBench(['The arrival', 'The platform']))).toBeUndefined()
  })
})

describe('every Cue', () => {
  it('carries a sentence in the message files', () => {
    const said = en.cue as Record<string, string>

    expect(CUES.filter(cue => !said[cue.name]).map(cue => cue.name)).toEqual([])
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
    const drawn = [...editor.matchAll(/data-cue="([^"]+)"/g)].map(([, target]) => target)

    expect(drawn.sort()).toEqual(CUES.map(cue => cue.target).sort())
  })
})
