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
