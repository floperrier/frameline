/**
 * What the bench finds when it reads the Story back: the Scenes nothing arrives
 * at, the Shots nobody has written, a Sound nobody transcribed, the Flags set
 * and never tested, the ways on that can never be offered, and the ways on no
 * Reading is ever handed.
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
import { exitsFrom, namesOnTheBench, reaches } from '../../shared/utils/scenes'
import type { Condition, Scene, StoryInEditor } from '../../shared/utils/scenes'
import type { Phrase } from '../../shared/utils/phrases'
import { cut } from '../../shared/utils/reading'

/**
 * How fast a Reader reads, at about 200 words a minute — a measured rate rather
 * than an invented one, and the only number in this file that comes from outside
 * the Story. It is used to notice a Shot nobody could read in the time it stands
 * and for nothing else, and the margin below is wide on purpose: a Remark that
 * fires on a Shot an Author has merely made brisk is a Remark an Author learns to
 * ignore.
 */
const CHARACTERS_A_SECOND = 15
const BRIEF_ENOUGH_TO_SAY_SO = 0.5

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
 *
 * `soundUntranscribed` says the same sentence of a Scene's Sound and a Shot's,
 * so what it names is not the Scene but a phrase — `theSceneSound` or
 * `theShotSound` — and that phrase is a full noun phrase and never a bare
 * fragment: French does not compose a sentence from one, so the noun carries
 * its own article rather than waiting on the sentence around it for one.
 */
export function remarks(story: StoryInEditor, say: Phrase): Remark[] {
  const found: Remark[] = []
  const arrivedAt = new Set(story.exits.map(exit => exit.toSceneId))
  const names = namesOnTheBench(story, say)
  const opening = story.openingSceneId

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

    // A Scene whose ways on stand for no time flows into the next without
    // asking — docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md —
    // and strands a Reading there only where none of its Exits could ever be
    // handed to one: the same question `reachedWithout` asks for
    // `exitNeverTaken`, asked here of every Exit a Scene offers at once rather
    // than of one at a time. A Scene not itself reached from the opening is
    // left alone — `sceneUnreached` already says the truer thing about it.
    if (
      scene.exitsAfter === 0
      && opening
      && reaches(story.exits, opening, scene.id)
      && exitsFrom(story.exits, scene.id)
        .every(exit => !reachedWithout(story, opening, scene.id, exit.toSceneId))
    ) {
      found.push({ name: 'sceneFlowsNowhere', sceneId: scene.id, said })
    }

    // Said of the carrier alone: a Scene heard under another has no Transcript to
    // write, because the Transcript belongs to the row the bytes are on. A silent
    // Scene is said nothing about at all — silence is not a defect, and a Remark
    // on every text-only Story is noise.
    if (scene.sound && !scene.transcript.trim()) {
      found.push({
        name: 'soundUntranscribed',
        sceneId: scene.id,
        said: { carrier: say('remark.theSceneSound', { scene: names.get(scene.id)! }) },
      })
    }

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
      if (shot.sound && !shot.transcript.trim()) {
        found.push({
          name: 'soundUntranscribed',
          sceneId: scene.id,
          said: {
            carrier: say('remark.theShotSound', {
              scene: names.get(scene.id)!,
              place: place + 1,
            }),
          },
        })
      }

      // Resolved against the Scene by `cut()` rather than read off the Shot: a
      // Shot saying nothing under a Scene cut after a second is exactly the
      // case worth noticing. A Shot with no text has nothing to read, and is
      // left to `shotUnwritten` instead.
      if (shot.text.trim()) {
        const { after } = cut(scene, shot)
        const takesToRead = (shot.text.length / CHARACTERS_A_SECOND) * 1000
        if (after !== null && after < takesToRead * BRIEF_ENOUGH_TO_SAY_SO) {
          found.push({ name: 'shotStandsTooBriefly', sceneId: scene.id, said: atPlace })
        }
      }
    })
  }

  return [
    ...found,
    ...flagRemarks(story, names),
    ...deadRemarks(story, names),
    ...neverTakenRemarks(story, names),
  ]
}

/**
 * The ways on no Reading is ever handed: an Exit whose Scene stands on every way
 * to the Scene it leaves, so a Reading standing there has already been through it
 * and is never offered it. It is not sometimes unavailable — it is never
 * available, because the only way to be where it is written is to have come
 * through the Scene it leads to.
 *
 * This is the cost `docs/adr/0048-a-scene-is-entered-once.md` accepted when it
 * decided that a Reading refuses a way back the writing never saw: nothing an
 * Author already wrote is edited, so what the bench owes them instead is to have
 * noticed. It can only ever fire on a Story written before that rule — the bench
 * refuses to write such a way on now — which is exactly the Story an Author has no
 * other way of being told about.
 *
 * *Every* way and not merely *some* way: a Scene reached both through the one the
 * Exit leads to and around it is a Scene the Reader can stand in without having
 * been there, and that Exit is one they are handed. So what is asked is whether
 * the departure is still reached with the arrival taken out of the Story
 * altogether, which is the same question a Reading asks of itself, put to the
 * whole Story at once.
 *
 * Conditions are not read here, and that is safe in the one direction that
 * matters: they only ever take ways round away, so a Scene every drawn path
 * passes through is a Scene every Reading passes through. A way on out of a Scene
 * no Reading reaches at all is left alone — that Scene has a Remark of its own,
 * and its ways on are not what is wrong with it.
 */
function neverTakenRemarks(story: StoryInEditor, names: Map<string, string>): Remark[] {
  const opening = story.openingSceneId
  if (!opening) return []

  return story.scenes.flatMap((scene) => {
    if (!reaches(story.exits, opening, scene.id)) return []

    return exitsFrom(story.exits, scene.id).flatMap((exit, place) =>
      reachedWithout(story, opening, scene.id, exit.toSceneId)
        ? []
        : [{
            name: 'exitNeverTaken',
            sceneId: scene.id,
            said: { scene: names.get(scene.id)!, place: place + 1 },
          }])
  })
}

/**
 * Whether a Reading still reaches one Scene with another taken out of the Story —
 * every way on that touches the absent Scene going with it. A Story whose opening
 * is the Scene taken out reaches nothing at all, which is what makes a way on to
 * the Scene it leaves answer the same way as a way back.
 */
function reachedWithout(
  story: StoryInEditor,
  opening: string,
  sceneId: string,
  without: string,
) {
  if (opening === without) return false

  return reaches(
    story.exits.filter(exit => exit.fromSceneId !== without && exit.toSceneId !== without),
    opening,
    sceneId,
  )
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
