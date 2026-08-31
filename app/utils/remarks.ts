/**
 * What the bench finds when it reads the Story back: the Scenes nothing arrives
 * at, the Shots nobody has written, the Flags set and never tested, the ways on
 * that can never be offered.
 *
 * A Remark is a reading and never a refusal. Nothing here blocks a write, marks a
 * Story invalid or corrects anything: every one of these is a Story an Author is
 * entitled to be in the middle of, and a Story finished on purpose may carry them
 * still — a Scene reached by no Exit is how a Scene begins its life, and a Flag
 * set today is tested tomorrow. What the bench owes is to have noticed, which is
 * what nothing in the field does: the survey in
 * `docs/research/2026-08-27-paysage-concurrentiel.md` finds one tool of nineteen
 * that reports structure at all, and that one says outright that it cannot find a
 * variable nobody uses.
 *
 * It is cheap here because of two decisions taken for other reasons. A Condition
 * is flat — `docs/adr/0004-conditions-stay-flat.md` — so what a Story tests is a
 * list to be read rather than an expression to be walked; and the Flags a Scene
 * sets are declared on the Scene, so what a Story sets is a list too. Holding the
 * two against each other is an intersection, not an analysis of flow.
 *
 * Every Remark is computed from the Story the bench already holds, like a Step
 * (`app/utils/steps.ts`) and for the same reasons: it cannot disagree with the
 * screen, it survives a reload, and nothing stores it.
 */
import type { Condition, Exit, Scene, StoryInEditor } from '../../shared/utils/scenes'

export type Remark = {
  /**
   * What the Remark is called, which is also the message key its sentence is
   * written under in both languages: `remark.sceneUnreached`.
   */
  name: string
  /**
   * The Scene it is said of, which pressing it opens on the writing surface, and
   * nothing for the one Remark said of the Story itself.
   */
  sceneId?: string
  /** What the sentence names: a Scene, a Flag, the Place a Shot holds. */
  said: Record<string, string | number>
}

/**
 * Everything the bench has to say about this Story, the Story's own Remark first
 * and then the Scenes in the order the Author wrote them. One line per finding
 * rather than one per Scene: an Author correcting a Story wants the list to
 * shorten as they work, and a Scene carrying three undescribed Images has three
 * things to attend to.
 */
export function remarks(story: StoryInEditor): Remark[] {
  const found: Remark[] = []
  const arrivedAt = new Set(story.exits.map(exit => exit.toSceneId))

  // A Story with no Scene at all is a Story nobody has started, not one with
  // something wrong: the bench says so itself, and the guided path asks for the
  // first Scene.
  if (story.scenes.length && !story.openingSceneId) found.push({ name: 'noOpening', said: {} })

  for (const scene of story.scenes) {
    const said = { scene: scene.name }

    if (scene.id !== story.openingSceneId && !arrivedAt.has(scene.id)) {
      found.push({ name: 'sceneUnreached', sceneId: scene.id, said })
    }
    if (!scene.shots.length) found.push({ name: 'sceneUnplayed', sceneId: scene.id, said })

    scene.shots.forEach((shot, place) => {
      const of = { ...said, place: place + 1 }
      // Neither text nor Image is the glossary's own definition of a Shot the
      // Author has not written yet, so it is read back to them as exactly that.
      if (!shot.text.trim() && !shot.image) {
        found.push({ name: 'shotUnwritten', sceneId: scene.id, said: of })
      }
      if (shot.image && !shot.description.trim()) {
        found.push({ name: 'imageUndescribed', sceneId: scene.id, said: of })
      }
    })
  }

  return [...found, ...flagRemarks(story), ...deadRemarks(story)]
}

/**
 * The two halves of a Flag nobody joined up: a Flag a Scene sets that no
 * Condition ever reads, and a Flag a Condition reads that no Scene ever sets.
 *
 * Both are said once for the Flag rather than once per Scene or per Condition:
 * what is wrong is the name, and naming every place it appears would report one
 * mistake as five.
 */
function flagRemarks(story: StoryInEditor): Remark[] {
  const set = new Map<string, Scene>()
  for (const scene of story.scenes) {
    for (const flag of Object.keys(scene.sets)) if (!set.has(flag)) set.set(flag, scene)
  }

  const tested = new Map<string, Scene | undefined>()
  for (const [condition, scene] of conditionsOf(story)) {
    if ('flag' in condition && !tested.has(condition.flag)) tested.set(condition.flag, scene)
  }

  const never = (of: Map<string, Scene | undefined>, other: Map<string, unknown>, name: string) =>
    [...of].filter(([flag]) => flag.trim() && !other.has(flag))
      .map(([flag, scene]) => ({ name, sceneId: scene?.id, said: { flag, scene: scene?.name ?? '' } }))

  return [
    ...never(set, tested, 'flagUntested'),
    ...never(tested, set, 'flagUnset'),
  ]
}

/**
 * The ways on and the Shots whose Conditions can never hold: a Flag some Scene
 * does set, tested against a value no Scene ever sets it to. A Condition on a
 * Flag nothing sets at all is left to `flagRemarks`, which says the more useful
 * thing about it — the two never fire on the same Condition.
 *
 * A visit count is not read here. Whether a Scene can be entered often enough is
 * a question about the ways round the graph rather than about a list of values,
 * and answering it wrongly would be worse than not answering it: an Author who
 * meant a Scene to be unreachable a third time would be told their Story is
 * broken.
 */
function deadRemarks(story: StoryInEditor): Remark[] {
  const values = new Map<string, Set<string>>()
  for (const scene of story.scenes) {
    for (const [flag, held] of Object.entries(scene.sets)) {
      const known = values.get(flag) ?? new Set<string>()
      for (const value of [held].flat()) known.add(value)
      values.set(flag, known)
    }
  }

  const dead = ([condition]: Carried) =>
    'flag' in condition
    && values.has(condition.flag)
    && !values.get(condition.flag)!.has(condition.is)

  return conditionsOf(story).filter(dead).map(([condition, scene, name]) => ({
    name,
    sceneId: scene?.id,
    said: {
      scene: scene?.name ?? '',
      flag: 'flag' in condition ? condition.flag : '',
      is: 'flag' in condition ? condition.is : '',
    },
  }))
}

/** One Condition, the Scene it is read against, and what a dead one is called. */
type Carried = [Condition, Scene | undefined, string]

/**
 * Every Condition the Story carries, with the Scene it is read against and the
 * Remark a dead one is named by. A Shot's Conditions belong to the Scene holding
 * it; an Exit's belong to the Scene it leaves, which is where they are written
 * and where the Flags they test are set.
 */
function conditionsOf(story: StoryInEditor): Carried[] {
  const scenes = new Map(story.scenes.map(scene => [scene.id, scene]))
  const from = (carried: Condition[], scene: Scene | undefined, name: string) =>
    carried.map(condition => [condition, scene, name] as Carried)

  return [
    ...story.scenes.flatMap(scene =>
      scene.shots.flatMap(shot => from(shot.conditions, scene, 'shotUnplayable'))),
    ...story.exits.flatMap((exit: Exit) =>
      from(exit.conditions, scenes.get(exit.fromSceneId), 'exitUnofferable')),
  ]
}
