/**
 * What a Shot plays as, said on the one line its row folds the choosing under —
 * issue #401 and `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`.
 * A part for each answer on the row that is not *As the Scene says* or *No
 * Effect*, in the order the row draws the fields, each carrying what its fields
 * add: seconds, a percent, a pace, a strength. A Shot that says nothing does as
 * its Scene says, which the Scene says once at its head, so the line says that and
 * repeats none of it.
 *
 * The Scene is read for the two things the row itself reads off it: whether *The
 * Movement takes* is drawn at all, and the pace a unit falls back on. A Sound is
 * never a part: one deposited is on the row in plain view, and one picked from the
 * library and not taken is not on the Shot yet.
 */
import type { Scene, Shot } from '#shared/utils/scenes'
import type { Phrase } from '#shared/utils/phrases'
import { EFFECT_LABELS, effectTime } from './effects'

const SLOTS = ['imageArrives', 'imageLasts', 'textArrives', 'textLasts'] as const

const capital = (word: string) => word[0]!.toUpperCase() + word.slice(1)

export function playsAs(shot: Shot, scene: Pick<Scene, 'movementBy' | 'textPace'>, say: Phrase) {
  const parts: string[] = []
  const said = (key: string, values?: Record<string, number>) => parts.push(say(`editor.${key}`, values))

  if (shot.cutAfter !== null) {
    said(shot.cutAfter ? 'playsCutAfter' : 'playsCutAtThePress', { seconds: shot.cutAfter / 1000 })
  }
  if (shot.cutOver === 0) said('playsCutHard')
  else if (shot.cutOver !== null) {
    said(shot.cutThrough === 'black' ? 'playsFadeToBlack' : 'playsDissolve', { seconds: shot.cutOver / 1000 })
  }

  if (shot.layout) said(shot.layout === 'full' ? 'playsFull' : 'playsInset')

  if (shot.image) {
    const by = shot.movementBy ?? scene.movementBy
    if (shot.movementBy === 0) said('playsStill')
    else if (shot.movementDirection) said(`plays${capital(shot.movementDirection)}`, { percent: by })

    if (by > 0 && shot.movementOver !== null) {
      said(shot.movementOver ? 'playsMovesOver' : 'playsMovesWhole', { seconds: shot.movementOver / 1000 })
    }
  }

  for (const slot of SLOTS) {
    const effect = shot[slot]
    if (!effect || (slot.startsWith('image') && !shot.image)) continue

    const time = effectTime(effect)
    parts.push([
      say(`editor.plays${capital(slot)}`, { effect: say(`editor.${EFFECT_LABELS[effect.effect]}`) }),
      ...time === undefined ? [] : [say('editor.playsSeconds', { seconds: time / 1000 })],
      say(`editor.plays${capital(effect.strength)}`),
    ].join(', '))
  }

  // How the text arrives is drawn only on a beat with words to arrive.
  if (shot.text.trim()) {
    if (shot.textAfter !== null) {
      said(shot.textAfter ? 'playsTextAfter' : 'playsTextWithImage', { seconds: shot.textAfter / 1000 })
    }
    if (shot.textBy) {
      said(shot.textBy === 'whole' ? 'playsTextWhole' : `playsTextBy${capital(shot.textBy)}`, {
        pace: shot.textPace ?? scene.textPace,
      })
    }
    if (shot.textOver !== null) {
      said(shot.textOver ? 'playsTextOver' : 'playsTextAtOnce', { seconds: shot.textOver / 1000 })
    }
    if (shot.textStays !== null) {
      said(shot.textStays ? 'playsTextStays' : 'playsTextUntilTheCut', { seconds: shot.textStays / 1000 })
    }
  }

  return parts.join(' · ') || say('editor.playsAsScene')
}

/**
 * How a Scene plays, said on the one line its head folds the choosing under —
 * issue #400, by `0061`'s rule. A Scene has no *As the Scene says* to fall back on:
 * its answers are what every Shot of its run does, so the four that change every
 * Shot's look and pace are always said, in #401's words. How its Exits are offered
 * and how its texts arrive are said only where they depart from what a new Scene
 * is written with, so a Scene that says nothing about them spends no words on
 * them. The parts follow the fold's order. Its Sound is never a part: one it is
 * heard under stands open above the fold, and silence needs no word.
 */
export function scenePlaysAs(scene: Scene, say: Phrase) {
  const parts: string[] = []
  const said = (key: string, values?: Record<string, number>) => parts.push(say(`editor.${key}`, values))

  if (scene.cutAfter === null) said('playsCutAtThePress')
  else said('playsCutAfter', { seconds: scene.cutAfter / 1000 })
  if (!scene.cutOver) said('playsCutHard')
  else said(scene.cutThrough === 'black' ? 'playsFadeToBlack' : 'playsDissolve', { seconds: scene.cutOver / 1000 })
  if (scene.exitsAfter !== null) {
    said(scene.exitsAfter ? 'playsExitsFor' : 'playsExitsNone', { seconds: scene.exitsAfter / 1000 })
  }

  if (scene.textAfter) said('playsTextAfter', { seconds: scene.textAfter / 1000 })
  if (scene.textBy !== 'whole') said(`playsTextBy${capital(scene.textBy)}`, { pace: scene.textPace })
  if (scene.textOver) said('playsTextOver', { seconds: scene.textOver / 1000 })
  if (scene.textStays !== null) said('playsTextStays', { seconds: scene.textStays / 1000 })

  said(scene.layout === 'full' ? 'playsFull' : 'playsInset')

  if (!scene.movementBy) said('playsStill')
  else {
    said(`plays${capital(scene.movementDirection)}`, { percent: scene.movementBy })
    if (scene.movementOver) said('playsMovesOver', { seconds: scene.movementOver / 1000 })
  }

  return parts.join(' · ')
}
