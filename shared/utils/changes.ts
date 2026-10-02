import type { Edition } from './reading'

/**
 * What differs between Readers' Edition of a Story and the Story as it is
 * written, counted by Scene — the unit an Author thinks of their Story in. See
 * `docs/adr/0070-the-bench-says-what-changed-since-the-edition.md`.
 */
export type Changes = {
  /** Whether how the whole Story is read differs: where it opens, whether it steps back, its text's face and alignment. */
  story: boolean
  /** The Scenes the Edition does not have. */
  added: string[]
  /** The Scenes it has in another form: the Scene itself, its Shots, or the Exits leaving it. */
  changed: string[]
  /** How many Scenes of the Edition the Story no longer has. */
  gone: number
}

/** The four answers a Story is read by as a whole, a change to any of which is a change to the whole Story. */
const READ_BY = ['openingSceneId', 'stepsBack', 'textFace', 'textAlign'] as const

/**
 * What differs between two projections of a Story through the function that
 * takes an Edition: the one Readers read, and the one a Publish would take now.
 * An Exit belongs to the Scene it leaves, as it does everywhere on the bench, so
 * an Exit drawn, rephrased or taken away marks that Scene and not the one it
 * lands on. A change undone is no change, because the two are compared as values.
 */
export function changesSince(edition: Edition, live: Edition): Changes {
  const published = new Map(edition.scenes.map(scene => [scene.id, scene]))
  const written = new Set(live.scenes.map(scene => scene.id))
  const leaving = (story: Edition, sceneId: string) =>
    story.exits.filter(exit => exit.fromSceneId === sceneId)

  return {
    story: READ_BY.some(field => edition[field] !== live[field]),
    added: live.scenes.filter(scene => !published.has(scene.id)).map(scene => scene.id),
    changed: live.scenes
      .filter(scene => published.has(scene.id) && !(same(scene, published.get(scene.id))
        && same(leaving(live, scene.id), leaving(edition, scene.id))))
      .map(scene => scene.id),
    gone: edition.scenes.filter(scene => !written.has(scene.id)).length,
  }
}

/**
 * Whether two values read out of JSON are one value, whatever order their keys
 * stand in: `jsonb` keeps an object's keys in an order of its own, so an Edition
 * read back from the column does not have them where `takeEdition` wrote them.
 */
function same(one: unknown, other: unknown): boolean {
  if (one === other) return true
  if (!one || !other || typeof one !== 'object' || typeof other !== 'object') return false
  if (Array.isArray(one) !== Array.isArray(other)) return false

  const keys = said(one)
  return keys.length === said(other).length && keys.every(key => Object.hasOwn(other, key)
    && same((one as Record<string, unknown>)[key], (other as Record<string, unknown>)[key]))
}

/**
 * The keys of a value that say something. A formatted text's `attrs` holding
 * nothing but nulls says what no `attrs` says — the text as the Story sets it —
 * and the editor writes every attribute it holds where the builders a Sample is
 * planted with leave them out, so a Shot whose words are typed back would
 * otherwise differ from the Edition in a key no Reading reads.
 */
function said(value: object) {
  return Object.keys(value).filter(key => key !== 'attrs' || Object.values(
    (value as Record<string, unknown>)[key] ?? {}).some(held => held !== null))
}
