import { SHOT_TEXT_MAX_LENGTH, exitsFrom, inDocumentOrder } from './scenes'
import type { Exit, Scene, Shot, StoryInEditor } from './scenes'
import { linesOf } from './formatted'
import type { Block, Formatted, Inline, Run } from './formatted'
import { bracedAt, declaredIn } from './reading'
import { same } from './changes'
import type { Phrase } from './phrases'

/**
 * Where a word is found in a Story, and what writing another in its place
 * changes — issue #447. Pure functions over the Story the bench already holds,
 * so the bench that lights the places and the route that replaces them count
 * the same ones. What counts as the Story's words, and why a place never leaves
 * the run it starts in, is
 * `docs/adr/0075-the-storys-words-are-found-where-a-reader-is-given-them.md`.
 */

/** The longest thing to find or to put in its place: nothing longer is held by any field. */
export const FIND_MAX_LENGTH = SHOT_TEXT_MAX_LENGTH

/** The fields a place is written in, each being the key of its row and of its PATCH. */
export type Field = 'formatted' | 'description' | 'transcript' | 'question' | 'text'

/** One match: the field it is in, and the stretch of that field's text it covers. */
export type Place = {
  sceneId: string
  of: 'shot' | 'scene' | 'exit'
  /** The Shot's id, the Scene's own, or the Exit's. */
  id: string
  field: Field
  /** The how-manyth field of the walk, every field counted, so stable across a replacement. */
  order: number
  /** The how-manyth text run of a Shot's words; nought in a plain field. */
  run: number
  /** Offsets in that run's own characters. */
  from: number
  to: number
  /** `from` counted over the field's runs read end to end, which in a plain field is `from`. */
  at: number
}

/** What a Story must hold to be looked through. */
export type Found = Pick<StoryInEditor, 'scenes' | 'exits' | 'openingSceneId' | 'language'>

/** The new value of one field, and the first place of that field, which names its row. */
export type Replacement = { place: Place, value: string | Formatted }

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** A text as it is compared, letter by letter, with where each letter starts and ends in the text as written. */
function lettered(text: string, matchCase: boolean, language: string) {
  const fold = (letter: string) => matchCase
    ? letter.normalize('NFC')
    : letter.normalize('NFC').toLocaleLowerCase(language).normalize('NFC')
  let read = ''
  const starts = new Map<number, number>()
  const ends = new Map<number, number>()
  for (const { segment, index } of segmenter.segment(text)) {
    starts.set(read.length, index)
    read += fold(segment)
    ends.set(read.length, index + segment.length)
  }
  return { read, starts, ends }
}

/**
 * Where a text holds what is sought, as stretches of the text as it is written.
 * Both are read grapheme by grapheme in NFC, and in lower case unless the case
 * is matched, so a composed and a decomposed é are found alike, an e is never
 * found inside an é and an accent is never folded away. A match begins and ends
 * between letters, never overlaps another, and is not one where it touches a
 * run between braces that names a declared Flag.
 */
export function foundIn(
  text: string,
  looking: { find: string, matchCase: boolean, language: string },
  declared: ReadonlySet<string>,
): { from: number, to: number }[] {
  const sought = lettered(looking.find, looking.matchCase, looking.language).read
  if (!sought) return []
  const { read, starts, ends } = lettered(text, looking.matchCase, looking.language)
  const kept = bracedAt(text).filter(({ name }) => declared.has(name))
  const found: { from: number, to: number }[] = []
  for (let at = read.indexOf(sought); at !== -1; at = read.indexOf(sought, at + 1)) {
    const from = starts.get(at)
    const to = ends.get(at + sought.length)
    if (from === undefined || to === undefined) continue
    if (kept.some(brace => from < brace.to && brace.from < to)) continue
    found.push({ from, to })
    at += sought.length - 1
  }
  return found
}

/** The runs of words in a formatted text, in reading order: the only parts of it that are looked through. */
export function textRuns(formatted: Formatted): Run[] {
  return linesOf(formatted).flat().filter((inline): inline is Run => inline.type === 'text')
}

type Walked = Omit<Place, 'order' | 'run' | 'from' | 'to' | 'at'> & { texts: string[] }

/** Every field the writing draws, in the order it draws them: the row, its key, and its texts (a Shot's words as its runs). */
function fieldsOf(story: Found): Walked[] {
  return inDocumentOrder(story.scenes, story.exits, story.openingSceneId).flatMap((scene: Scene): Walked[] => [
    ...scene.sound
      ? [{ sceneId: scene.id, of: 'scene' as const, id: scene.id, field: 'transcript' as const, texts: [scene.transcript] }]
      : [],
    ...scene.shots.flatMap((shot: Shot): Walked[] => {
      const at = { sceneId: scene.id, of: 'shot' as const, id: shot.id }
      return [
        { ...at, field: 'formatted', texts: textRuns(shot.formatted).map(held => held.text) },
        ...shot.image ? [{ ...at, field: 'description' as const, texts: [shot.description] }] : [],
        ...shot.sound ? [{ ...at, field: 'transcript' as const, texts: [shot.transcript] }] : [],
      ]
    }),
    { sceneId: scene.id, of: 'scene', id: scene.id, field: 'question', texts: [scene.question] },
    ...exitsFrom(story.exits, scene.id).map((exit: Exit): Walked =>
      ({ sceneId: scene.id, of: 'exit', id: exit.id, field: 'text', texts: [exit.text] })),
  ])
}

/**
 * Every place the Story holds what is sought, in document order and, inside a
 * Scene, top to bottom: its Transcript where it carries a Sound of its own, each
 * Shot's words, its Description where it carries an Image and its Transcript
 * where it carries a Sound, then the Scene's Question and the words of its
 * Exits. Scene names, Flags, the title and the Synopsis are not looked at.
 */
export function placesIn(story: Found, find: string, matchCase: boolean): Place[] {
  const looking = { find, matchCase, language: story.language }
  const declared = declaredIn(story)
  return fieldsOf(story).flatMap(({ texts, ...field }, order) => {
    let before = 0
    return texts.flatMap((text, run) => {
      const at = before
      before += text.length
      return foundIn(text, looking, declared).map(({ from, to }) => ({ ...field, order, run, from, to, at: at + from }))
    })
  })
}

/** The row a place is written in. */
export function rowOf(story: Found, place: Place): Shot | Scene | Exit {
  if (place.of === 'exit') return story.exits.find(exit => exit.id === place.id)!
  const scene = story.scenes.find(held => held.id === place.sceneId)!
  return place.of === 'scene' ? scene : scene.shots.find(shot => shot.id === place.id)!
}

/** A plain text with each stretch, given in order, written over by `replace`. */
export function replacedText(text: string, stretches: { from: number, to: number }[], replace: string): string {
  return stretches.reduceRight((held, { from, to }) => held.slice(0, from) + replace + held.slice(to), text)
}

/**
 * A formatted text with its places written over in the runs they stand in, so
 * the new words take the styles of the old. A run left empty is dropped, as the
 * boundary refuses an empty one; a line, Speaker or Source left with no run
 * loses its `content`; and two runs of one style left side by side become one.
 */
export function replacedFormatted(
  formatted: Formatted,
  places: Pick<Place, 'run' | 'from' | 'to'>[],
  replace: string,
): Formatted {
  let run = -1
  const words = (inlines: Inline[] = []) => {
    const kept: Inline[] = []
    for (const inline of inlines) {
      let now = inline
      if (inline.type === 'text') {
        const at = ++run
        const text = replacedText(inline.text, places.filter(place => place.run === at), replace)
        if (!text) continue
        now = { ...inline, text }
      }
      const last = kept.at(-1)
      if (now.type === 'text' && last?.type === 'text' && same(last.marks ?? [], now.marks ?? [])) {
        kept[kept.length - 1] = { ...last, text: last.text + now.text }
      }
      else kept.push(now)
    }
    return kept
  }
  const holding = <T extends { content?: Inline[] }>(node: T): T => {
    const { content, ...rest } = node
    const held = words(content)
    return (held.length ? { ...rest, content: held } : rest) as T
  }
  const block = (held: Block): Block => held.type === 'separator' ? held
    : held.type === 'line' ? holding(held)
      : { ...held, content: held.content.map(holding) } as Block
  return { ...formatted, content: formatted.content.map(block) }
}

/**
 * What writing `replace` over every given place changes: one value for each
 * field that holds any, keyed by the first of its places. The places are those
 * `placesIn` returned, in its order. A Question is trimmed, as its own PATCH
 * trims it.
 */
export function replacements(story: Found, places: Place[], replace: string): Replacement[] {
  const fields: Place[][] = []
  for (const place of places) {
    const last = fields.at(-1)
    if (last?.[0]!.order === place.order) last.push(place)
    else fields.push([place])
  }
  return fields.map((held) => {
    const place = held[0]!
    const row = rowOf(story, place) as unknown as Record<Field, unknown>
    if (place.field === 'formatted') return { place, value: replacedFormatted(row.formatted as Formatted, held, replace) }
    const value = replacedText(row[place.field] as string, held, replace)
    return { place, value: place.field === 'question' ? value.trim() : value }
  })
}

/**
 * Where a place is, said to somebody: the phrase for its field, with the name
 * the bench gives its Scene and its Place there (the how-manyth Shot, or Exit).
 */
export function placeNamed(story: Found, place: Place, names: Map<string, string>, say: Phrase): string {
  const scene = names.get(place.sceneId) ?? ''
  if (place.of === 'exit') {
    return say('find.inExit', { scene, place: exitsFrom(story.exits, place.sceneId).findIndex(exit => exit.id === place.id) + 1 })
  }
  if (place.of === 'scene') return say(place.field === 'question' ? 'find.inQuestion' : 'find.inTranscript', { scene })
  const shots = story.scenes.find(held => held.id === place.sceneId)?.shots ?? []
  const shot = shots.findIndex(held => held.id === place.id) + 1
  const key = { formatted: 'find.inWords', description: 'find.inDescription', transcript: 'find.inShotTranscript' }[place.field as 'formatted' | 'description' | 'transcript']
  return say(key, { scene, place: shot })
}
