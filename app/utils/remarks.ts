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
import { exitsFrom, namesOnTheBench } from '../../shared/utils/scenes'
import type { Condition, Scene, StoryInEditor } from '../../shared/utils/scenes'
import type { Phrase } from '../../shared/utils/phrases'

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
  /**
   * What the sentence names: a Scene, by the name the bench calls it, a Flag, and
   * the Place a Shot or an Exit holds.
   */
  said: Record<string, string | number>
}

/**
 * Everything the bench has to say about this Story, the Story's own Remark first
 * and then the Scenes in the order the Author wrote them. One line per finding
 * rather than one per Scene: an Author correcting a Story wants the list to
 * shorten as they work, and a Scene carrying three undescribed Images has three
 * things to attend to.
 *
 * A Remark is a control — pressing one opens the Scene it is about — so it is
 * named by the same rule every other control of the bench is: by the Scene the
 * bench calls that Scene, and by the Place of the row it is said of. Which is why
 * it phrases rather than only names: `namesOnTheBench` numbers two Scenes an
 * Author called the same, and a Remark that read the name straight would say one
 * sentence twice — see issue #284.
 */
export function remarks(story: StoryInEditor, say: Phrase): Remark[] {
  const found: Remark[] = []
  const arrivedAt = new Set(story.exits.map(exit => exit.toSceneId))
  const names = namesOnTheBench(story, say)

  // A Story with no Scene at all is a Story nobody has started, not one with
  // something wrong: the bench says so itself, and the guided path asks for the
  // first Scene.
  if (story.scenes.length && !story.openingSceneId) found.push({ name: 'noOpening', said: {} })

  for (const scene of story.scenes) {
    const said = { scene: names.get(scene.id)! }

    if (scene.id !== story.openingSceneId && !arrivedAt.has(scene.id)) {
      found.push({ name: 'sceneUnreached', sceneId: scene.id, said })
    }
    if (!scene.shots.length) found.push({ name: 'sceneUnplayed', sceneId: scene.id, said })

    scene.shots.forEach((shot, place) => {
      const atPlace = { ...said, place: place + 1 }
      // Neither text nor Image is the glossary's own definition of a Shot the
      // Author has not written yet, so it is read back to them as exactly that.
      if (!shot.text.trim() && !shot.image) {
        found.push({ name: 'shotUnwritten', sceneId: scene.id, said: atPlace })
      }
      if (shot.image && !shot.description.trim()) {
        found.push({ name: 'imageUndescribed', sceneId: scene.id, said: atPlace })
      }
    })
  }

  return [...found, ...flagRemarks(story, names), ...deadRemarks(story, names)]
}

/**
 * The two halves of a Flag nobody joined up: a Flag a Scene sets that no
 * Condition ever reads, and a Flag a Condition reads that no Scene ever sets.
 *
 * Both are said once for the Flag rather than once per Scene or per Condition:
 * what is wrong is the name, and naming every place it appears would report one
 * mistake as five.
 */
function flagRemarks(story: StoryInEditor, names: Map<string, string>): Remark[] {
  const set = new Map<string, Scene>()
  for (const scene of story.scenes) {
    for (const flag of Object.keys(scene.sets)) if (!set.has(flag)) set.set(flag, scene)
  }

  const tested = new Map<string, Scene>()
  for (const [condition, scene] of conditionsOf(story)) {
    if ('flag' in condition && !tested.has(condition.flag)) tested.set(condition.flag, scene)
  }

  const never = (half: Map<string, Scene>, other: Map<string, unknown>, name: string) =>
    [...half].filter(([flag]) => flag.trim() && !other.has(flag))
      .map(([flag, scene]) => ({
        name,
        sceneId: scene.id,
        said: { flag, scene: names.get(scene.id)! },
      }))

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
 *
 * Nor is the empty value, which is not a value at all. A Flag never set reads as
 * empty — `shared/utils/reading.ts`, and the glossary says so of a Flag — so a
 * Condition asking for the empty value is a Condition asking for the absence of a
 * Flag, and it holds at the top of every Reading. No Scene can ever be found
 * setting it, because `flagsSet` drops an empty value as a row half typed; read
 * without this it is exactly the wrong answer this record refuses, and the
 * Exit *Reel Change* offers once is what it would be said of.
 *
 * Said of the row and not of the Scene alone. Two Shots of one Scene conditioned
 * on the same pair — two beats waiting on `ticket = "lost"` — are two findings an
 * Author has to go to separately, and a sentence naming only the Scene is the same
 * sentence twice and the same control named twice with it — which is the property
 * issue #268 settled for a row, told of the Remarks.
 */
function deadRemarks(story: StoryInEditor, names: Map<string, string>): Remark[] {
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
    && condition.is !== ''
    && values.has(condition.flag)
    && !values.get(condition.flag)!.has(condition.is)

  return conditionsOf(story).filter(dead).map(([condition, scene, name, place]) => ({
    name,
    sceneId: scene.id,
    said: {
      scene: names.get(scene.id)!,
      place,
      flag: 'flag' in condition ? condition.flag : '',
      is: 'flag' in condition ? condition.is : '',
    },
  }))
}

/**
 * One Condition, the Scene it is read against, what a dead one is called, and the
 * Place of the row carrying it — the Shot's in its Scene's run, or the Exit's in
 * the ways on that Scene offers.
 */
type Carried = [Condition, Scene, string, number]

/**
 * Every Condition the Story carries, with the Scene it is read against, the
 * Remark a dead one is named by and the Place of the row it is written on. A
 * Shot's Conditions belong to the Scene holding it; an Exit's belong to the Scene
 * it leaves, which is where they are written and where the Flags they test are
 * set — so the ways on are walked Scene by Scene here, which is also the walk
 * that numbers them the way the document does. The same walk settles which Scene
 * a Flag's first tester is read in: the first Scene, in the Story's order, that
 * tests it on a Shot or on a way on, rather than any Shot of the Story before any
 * Exit of it.
 */
function conditionsOf(story: StoryInEditor): Carried[] {
  const from = (carried: Condition[], scene: Scene, name: string, place: number) =>
    carried.map(condition => [condition, scene, name, place] as Carried)

  return story.scenes.flatMap(scene => [
    ...scene.shots.flatMap((shot, place) =>
      from(shot.conditions, scene, 'shotUnplayable', place + 1)),
    ...exitsFrom(story.exits, scene.id).flatMap((exit, place) =>
      from(exit.conditions, scene, 'exitUnofferable', place + 1)),
  ])
}
