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
    // Only what a Cue reads is filled in; a Scene here is a name and an id, the
    // fact that it exists, and what is written in it.
    scenes: scenes.map(([name, shot], place) => ({
      id: name,
      name,
      x: 0,
      y: place * 100,
      sets: {},
      shots: shot === undefined ? [] : [{ id: `${name}-1`, text: shot }],
    })) as StoryInEditor['scenes'],
    cuts: [],
  }
}

/** No node open, which is how every node starts. */
const FOLDED: ReadonlySet<string> = new Set()

/** What the bench is asking for, of a Story with the nodes it is given open. */
function asking(story: StoryInEditor, opened: ReadonlySet<string> = FOLDED) {
  return cueShowing(story, opened)?.name
}

describe('the Cue the bench is showing', () => {
  it('asks for a Scene of a Story that has none', () => {
    expect(asking(onTheBench())).toBe('nameScene')
  })

  it('asks for the node to be opened once there is a Scene in it', () => {
    expect(asking(onTheBench([['The arrival']]))).toBe('openScene')
  })

  it('asks for a Shot to be written once a node is open', () => {
    const story = onTheBench([['The arrival']])

    expect(asking(story, new Set(['The arrival']))).toBe('writeShot')
  })

  it('reads a Shot of blank space as one nobody has written', () => {
    const story = onTheBench([['The arrival', '   ']])

    expect(asking(story, new Set(['The arrival']))).toBe('writeShot')
  })

  it('asks for a second Scene once the first Shot is written', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.']])

    expect(asking(story, new Set(['The arrival']))).toBe('secondScene')
  })

  it('asks for a Cut once there are two Scenes to join', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.'], ['The platform']])

    expect(asking(story, new Set(['The arrival']))).toBe('drawCut')
  })

  it('asks nothing once the two Scenes are joined', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.'], ['The platform']])
    story.cuts = [{ id: 'a-cut' }] as StoryInEditor['cuts']

    expect(asking(story, new Set(['The arrival']))).toBeUndefined()
  })

  /**
   * Nothing blocks and nothing is confirmed, so an Author who improvises past
   * three steps meets three Cues and is asked for the fourth, whatever their
   * nodes are folded to.
   */
  it('asks for what is still missing when the Author works out of order', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.'], ['The platform']])

    expect(asking(story)).toBe('drawCut')
  })

  /**
   * A node is opened for the sake of what is written in it, so a Story that
   * arrives written — a Leader — is never asked to open one, and a Leader, which
   * is past every step, is asked nothing at all.
   */
  it('asks a Story whose Shots are already written to open nothing', () => {
    const story = onTheBench([['The arrival', 'The train pulls in.']])

    expect(asking(story)).toBe('secondScene')
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

    // Held as sets on both sides: the editor draws each target once, and two
    // Cues may ask for two things in the same place.
    expect(drawn.sort()).toEqual([...new Set(CUES.map(cue => cue.target))].sort())
  })
})
