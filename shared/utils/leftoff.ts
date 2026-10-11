import type { Edition } from './reading'

/**
 * What the figure is worked out from: the Edition's Exits — each the Scene it
 * leaves and the Scene it leads to — and its Opening Scene, and the counts kept
 * for the Story, raw, before they are narrowed to what the written Story holds.
 */
export type LeftOffFrom = Pick<Edition, 'openingSceneId'> & {
  exits: Pick<Edition['exits'][number], 'id' | 'fromSceneId' | 'toSceneId'>[]
  begun: number
  taken: Record<string, number>
  endedIn: Record<string, number>
}

/**
 * How many Readings left off in each Scene: those that arrived in it, by an Exit
 * of the Edition leading there or by beginning where it is the Opening Scene,
 * less those that left it by an Exit of the Edition and those that ended in it.
 * A Scene is answered only where the figure is above nought: a distortion the
 * counts knowingly carry, a step back above all, can leave one below it, and
 * that means nothing to say. Takes under an Exit the Edition does not hold have
 * no Scene to be put down to and are left out. See *Where Readings leave off*
 * in `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 */
export function readingsLeftOff({ exits, openingSceneId, begun, taken, endedIn }: LeftOffFrom) {
  const left = new Map<string, number>()
  const add = (sceneId: string, count: number) => left.set(sceneId, (left.get(sceneId) ?? 0) + count)

  if (openingSceneId) add(openingSceneId, begun)
  for (const { id, fromSceneId, toSceneId } of exits) {
    add(toSceneId, taken[id] ?? 0)
    add(fromSceneId, -(taken[id] ?? 0))
  }
  for (const [sceneId, count] of left) left.set(sceneId, count - (endedIn[sceneId] ?? 0))

  return Object.fromEntries([...left].filter(([, count]) => count > 0))
}
