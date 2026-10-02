import { describe, expect, it } from 'vitest'
import { playsAs, scenePlaysAs } from '../../app/utils/plays.ts'
import type { Scene, Shot } from '../../shared/utils/scenes.ts'
import type { Phrase } from '../../shared/utils/phrases.ts'
import { phrase } from '../../server/utils/phrases.ts'

/**
 * The one line a Shot's row folds what it plays as under: what the Shot says for
 * itself, and nothing its Scene says for it. Read against the real message files,
 * because the line is words and two answers that read alike are the bug.
 */
const says: Phrase = (key, values) => phrase('en', key, values)

/** A Shot that says nothing for itself, with words and no Image. */
const SILENT: Shot = {
  id: 'shot', text: 'Tonight it does.', formatted: [], position: 0, image: null,
  description: '', conditions: [], sound: null, transcript: '',
  cutAfter: null, cutOver: null, cutThrough: null, layout: null, cropX: 50, cropY: 50,
  movementBy: null, movementDirection: null, movementOver: null,
  imageArrives: null, imageLasts: null, textArrives: null, textLasts: null,
  textAfter: null, textBy: null, textPace: null, textOver: null, textStays: null,
}

const SCENE = { movementBy: 0, textPace: 15 }

const plays = (said: Partial<Shot>, scene: Partial<typeof SCENE> = {}) =>
  playsAs({ ...SILENT, ...said }, { ...SCENE, ...scene }, says)

describe('what a Shot plays as', () => {
  it('says its Scene plays it where it says nothing, in either language', () => {
    expect(plays({})).toBe('As its Scene plays')
    expect(playsAs(SILENT, SCENE, (key, values) => phrase('fr', key, values)))
      .toBe('Comme sa Scène se joue')
  })

  it('says nothing for a Sound, which is on the row or not on the Shot at all', () => {
    expect(plays({ sound: '/api/shots/shot/sound', transcript: 'A door closes.' }))
      .toBe('As its Scene plays')
  })

  it('says when it is cut and how', () => {
    expect(plays({ cutAfter: 0 })).toBe('Cut at the press')
    expect(plays({ cutAfter: 3000 })).toBe('Cut after 3 s')
    expect(plays({ cutOver: 0 })).toBe('A hard Cut')
    expect(plays({ cutOver: 1000, cutThrough: 'image' })).toBe('Dissolve, 1 s')
    expect(plays({ cutOver: 1200, cutThrough: 'black' })).toBe('Fade to black, 1.2 s')
  })

  it('says its Layout', () => {
    expect(plays({ layout: 'full' })).toBe('Full screen')
    expect(plays({ layout: 'inset' })).toBe('Image above the text')
  })

  it('says how its Image moves, and only where it has an Image to move', () => {
    const image = '/api/shots/shot/image'

    expect(plays({ image, movementBy: 0 })).toBe('Image held still')
    expect(plays({ image, movementDirection: 'closer', movementBy: 12 })).toBe('Closer by 12 %')
    expect(plays({ image, movementDirection: 'left', movementBy: 20 })).toBe('To the left by 20 %')
    expect(plays({ image, movementDirection: 'up' }, { movementBy: 15 })).toBe('Up by 15 %')
    expect(plays({ image, movementDirection: 'closer', movementBy: 12, movementOver: 0 }))
      .toBe('Closer by 12 % · Moves while on screen')
    expect(plays({ image, movementOver: 3000 }, { movementBy: 10 })).toBe('Moves over 3 s')
    // How long a Movement takes is not asked of an Image that does not move.
    expect(plays({ image, movementOver: 3000 })).toBe('As its Scene plays')
    expect(plays({ image, movementBy: 0, movementOver: 3000 }, { movementBy: 10 }))
      .toBe('Image held still')
    expect(plays({ movementDirection: 'closer', movementBy: 12 })).toBe('As its Scene plays')
  })

  it('says each Effect with its time and its strength, the Image\'s only with an Image', () => {
    const image = '/api/shots/shot/image'

    expect(plays({ image, imageArrives: { effect: 'from-blur', over: 1500, strength: 'marked' } }))
      .toBe('From a blur as the Image arrives, 1.5 s, marked')
    expect(plays({ image, imageLasts: { effect: 'grain', strength: 'strong' } }))
      .toBe('Film grain while the Image is on screen, strong')
    expect(plays({ imageLasts: { effect: 'grain', strength: 'strong' } })).toBe('As its Scene plays')
    expect(plays({ textArrives: { effect: 'from-blur', over: 1500, strength: 'slight' } }))
      .toBe('From a blur as the text arrives, 1.5 s, slight')
    expect(plays({ textLasts: { effect: 'pulse', every: 900, strength: 'marked' } }))
      .toBe('A pulse while the text is on screen, 0.9 s, marked')
  })

  it('says how its text arrives, and only where it has text to arrive', () => {
    expect(plays({ textAfter: 0 })).toBe('Text with the Image')
    expect(plays({ textAfter: 1000 })).toBe('Text after 1 s')
    expect(plays({ textBy: 'whole' })).toBe('Text all at once')
    expect(plays({ textBy: 'letter', textPace: 20 })).toBe('Text letter by letter, 20 characters a second')
    expect(plays({ textBy: 'word' })).toBe('Text word by word, 15 characters a second')
    expect(plays({ textBy: 'line' })).toBe('Text line by line, 15 characters a second')
    expect(plays({ textOver: 0 })).toBe('Text appears at once')
    expect(plays({ textOver: 200 })).toBe('Text appears over 0.2 s')
    expect(plays({ textStays: 0 })).toBe('Text until the Cut')
    expect(plays({ textStays: 3000 })).toBe('Text stays 3 s')
    expect(plays({ text: ' ', textAfter: 1000 })).toBe('As its Scene plays')
  })

  it('says its parts in the order its row draws the fields', () => {
    expect(plays({
      image: '/api/shots/shot/image',
      textStays: 0,
      textArrives: { effect: 'shake', over: 500, strength: 'slight' },
      imageArrives: { effect: 'from-blur', over: 1500, strength: 'marked' },
      movementDirection: 'closer',
      movementBy: 12,
      layout: 'full',
      cutOver: 1000,
      cutThrough: 'image',
      cutAfter: 3000,
    })).toBe([
      'Cut after 3 s',
      'Dissolve, 1 s',
      'Full screen',
      'Closer by 12 %',
      'From a blur as the Image arrives, 1.5 s, marked',
      'A shake as the text arrives, 0.5 s, slight',
      'Text until the Cut',
    ].join(' · '))
  })
})

/** A Scene just written: every column at what a new Scene is written with. */
const WRITTEN: Scene = {
  id: 'scene', name: 'The street', sets: {}, shots: [], sound: null, soundOfSceneId: null,
  transcript: '', soundLoops: true,
  cutAfter: null, cutOver: 0, cutThrough: 'image', exitsAfter: null, layout: 'inset',
  movementBy: 0, movementDirection: 'closer', movementOver: 0,
  textAfter: 0, textBy: 'whole', textPace: 15, textOver: 0, textStays: null,
  question: '', questionFlag: '',
}

const scenePlays = (said: Partial<Scene>) => scenePlaysAs({ ...WRITTEN, ...said }, says)

/**
 * The one line a Scene's head folds how it plays under — issue #400. A Scene has
 * no *as the Scene says* to fall back on, so the four answers that change every
 * Shot's look and pace are always said; the two the ordinary Scene says nothing
 * remarkable about are said only where they depart from it.
 */
describe('how a Scene plays', () => {
  it('says the four answers of a Scene just written, in either language', () => {
    expect(scenePlays({}))
      .toBe('Cut at the press · A hard Cut · Image above the text · Image held still')
    expect(scenePlaysAs(WRITTEN, (key, values) => phrase('fr', key, values)))
      .toBe('Coupé quand le Lecteur presse · Une Coupe franche · L’Image au-dessus du texte · L’Image immobile')
  })

  it('says when its Shots are cut and how', () => {
    expect(scenePlays({ cutAfter: 12000 })).toMatch(/^Cut after 12 s · A hard Cut · /)
    expect(scenePlays({ cutOver: 1000 })).toMatch(/^Cut at the press · Dissolve, 1 s · /)
    expect(scenePlays({ cutOver: 1200, cutThrough: 'black' })).toMatch(/^Cut at the press · Fade to black, 1.2 s · /)
  })

  it('says its Layout and its Movement', () => {
    expect(scenePlays({ layout: 'full' })).toBe('Cut at the press · A hard Cut · Full screen · Image held still')
    expect(scenePlays({ movementBy: 12 })).toMatch(/ · Closer by 12 %$/)
    expect(scenePlays({ movementBy: 20, movementDirection: 'left' })).toMatch(/ · To the left by 20 %$/)
    expect(scenePlays({ movementBy: 12, movementOver: 3000 })).toMatch(/ · Closer by 12 % · Moves over 3 s$/)
    // How long a Movement takes is not asked of Images that do not move.
    expect(scenePlays({ movementOver: 3000 })).toMatch(/ · Image held still$/)
  })

  it('says how its Exits are offered only where they are not offered until one is taken', () => {
    expect(scenePlays({ exitsAfter: 8000 }))
      .toBe('Cut at the press · A hard Cut · Exits for 8 s · Image above the text · Image held still')
    expect(scenePlays({ exitsAfter: 0 })).toContain(' · Exits not offered · ')
    expect(scenePlays({ exitsAfter: null })).not.toContain('Exits')
  })

  it('says how its texts arrive only where they depart from with the Image, whole, at once and until the Cut', () => {
    expect(scenePlays({ textAfter: 1000 })).toContain(' · Text after 1 s · ')
    expect(scenePlays({ textBy: 'word' })).toContain(' · Text word by word, 15 characters a second · ')
    expect(scenePlays({ textBy: 'letter', textPace: 20 })).toContain(' · Text letter by letter, 20 characters a second · ')
    expect(scenePlays({ textOver: 200 })).toContain(' · Text appears over 0.2 s · ')
    expect(scenePlays({ textStays: 3000 })).toContain(' · Text stays 3 s · ')
    expect(scenePlays({ textPace: 30 })).not.toContain('Text')
  })

  it('never says its Sound, and says its parts in the order its fold draws the fields', () => {
    expect(scenePlays({ sound: '/api/scenes/scene/sound', transcript: 'Rain.' })).toBe(scenePlays({}))
    expect(scenePlays({
      movementBy: 12, layout: 'full', textStays: 3000, textAfter: 1000, exitsAfter: 8000,
      cutOver: 1000, cutAfter: 5000,
    })).toBe([
      'Cut after 5 s',
      'Dissolve, 1 s',
      'Exits for 8 s',
      'Text after 1 s',
      'Text stays 3 s',
      'Full screen',
      'Closer by 12 %',
    ].join(' · '))
  })
})
