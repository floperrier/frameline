<script setup lang="ts">
/**
 * The writing: the whole Story as one document, from the Opening Scene to the
 * last, in the order `inDocumentOrder` reads it — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which is also where the
 * name comes from. It is not *script*, which that record refuses in as many words,
 * and not *text*, which is what a Shot carries beside its Image.
 *
 * A Scene is a heading, the Flags it sets on entry, the run of its Shots, and the
 * ways out of it named by where they lead. The next Scene is under it. Nothing has
 * to be opened and nothing closes, and **every Scene is written where it stands**:
 * there is no one Scene the Author has to put on a bench first, because the bench
 * is the document. That is the whole of issue #252, and it is what took the gate
 * of `docs/adr/0042-the-scene-is-written-where-it-stands.md` — one Scene behind a
 * frame, one beat at a time behind a strip — out of the product: a gate per Scene
 * would be forty frames, and a gate for one Scene would leave thirty-nine Scenes
 * readable and unwritable.
 *
 * Typing is `docs/adr/0033-a-scene-is-written-as-one-document.md` unchanged, over
 * a longer document. One field per Shot, nothing parsed, no beat losing the id its
 * Image and its Conditions hang off: `Enter` at the end of a beat opens the next,
 * `Backspace` at the head of an empty one joins it to the beat before, and `Alt`
 * with the arrows walks the run. All three stay inside a Scene — `Enter` on the
 * last beat of a Scene opens a beat and never a Scene, because a Scene is written
 * by naming where an Exit leads and by nothing else,
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md` — and `Ctrl`/`Cmd` with
 * the arrows is what walks Scene to Scene.
 *
 * A Shot's text is set in the reading face at the reading measure — the shared
 * `.shot` of `app/assets/css/frameline.css`, which is the one place in the product
 * that face appears. `0043` moved the judgement into the writing rather than
 * standing a reading next to it: the line is read where it is typed.
 *
 * **What is marked for the bar of Commands and for the guided path is carried by
 * the Scene the caret is in and by no other.** A Story of forty Scenes would
 * otherwise hand the bar forty *Delete Scene*s and point every Step at the first
 * Scene's field — see `0043`'s own Consequences, and
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
 * Drawn everywhere, named where the Author is.
 */
const {
  story, sceneWritten, change, write, ask, announce, imageOf,
} = defineProps<{
  /** The Story being written, whole. */
  story: StoryInEditor
  /** The Scene the caret is in, which carries the marks the bar and the path read. */
  sceneWritten?: string
  /** The one holder every write on this page goes through. */
  change: Change
  /** The same holder, for what the Author typed rather than what they clicked. */
  write: Write
  /** The question asked before an act that takes something with it. */
  ask: (question: string, verb: string) => Promise<boolean>
  /** What the bench has just done, said once and gone. */
  announce: (said: string) => void
  /** Where a Shot's image is asked for, under the time it was last attached. */
  imageOf: (shot: Shot) => string
  /** Why the last change was refused, shown against the Scene it concerns. */
  problem?: Problem
}>()

/**
 * What the document asks of the page: `attached` the moment an image landed,
 * which the page holds because the address an image is served at is the Shot's own
 * and replacing one would otherwise leave the browser drawing the image it had;
 * `open` the Scene it wants the caret in next — where a way on leads, the half a
 * split has just made, the Scene the arrows walked to — and whether its name is to
 * be selected for typing over.
 */
const emit = defineEmits<{ attached: [string], open: [string, boolean?] }>()

const { t } = useI18n()

/**
 * The Scene the last refusal is about. The page keeps one refusal because there is
 * one Author writing, but the document now holds every Scene, and a sentence about
 * a Shot shown against a Scene forty sections away is a sentence about nothing. So
 * every act here says which Scene it is acting on as it starts, and the refusal is
 * drawn there — which is what the Scene the caret is in cannot answer for, since a
 * write leaves on `change`, which is to say on blur, by which time the caret may
 * be somewhere else entirely.
 *
 * Said back to the page, because the page has refusals of its own: what the Story's
 * own edge is refused is about no Scene, and is drawn under that edge only while
 * nothing here has claimed the sentence.
 */
const refusedIn = defineModel<string>('refusedIn')

/**
 * One act of one Scene, which is where a refusal of it is said. The Scene is
 * claimed as the act leaves rather than as it is asked for: a typed write waits
 * behind the one before it, so an act queued in the Scene the Author has just left
 * would otherwise draw its refusal in the Scene they moved to. And it is let go of
 * again the moment the act lands, so a Scene written in once is not left holding
 * the next sentence the page has to say.
 */
function inScene(scene: Scene, act: () => Promise<unknown>) {
  return async () => {
    refusedIn.value = scene.id
    await act()
    refusedIn.value = undefined
  }
}

function changing(scene: Scene, act: () => Promise<unknown>) {
  return change(inScene(scene, act))
}

function writing(scene: Scene, act: () => Promise<unknown>) {
  return write(inScene(scene, act))
}

/**
 * One Scene as the document reads it: the Scene itself, and what its section says
 * about it that is read off the whole Story rather than off the Scene. Named and
 * computed once for the run, because the alternative is four filters over every
 * Exit of the Story re-run per Scene per render, which on a Story of forty Scenes
 * is the document redrawing itself in quadratic time.
 */
type SceneInDocument = {
  scene: Scene
  /** Whether the Story opens on it. */
  opens: boolean
  /** Whether the caret is in it, which is what carries a mark's name. */
  here: boolean
  /** How many Exits arrive at it, as the sentence the slate says. */
  arrivals: string
  /** Whether no Reader ever gets there: nothing arrives, and the Story opens elsewhere. */
  unreached: boolean
  /** The Exits leaving it, in the Places it offers them at. */
  ways: Exit[]
  /** How much of a work the Scene is, said beside each of its headings. */
  counted: { flags: number, shots: number }
}

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

const sections = computed<SceneInDocument[]>(() => {
  const arriving = new Map<string, number>()
  for (const exit of story.exits) {
    arriving.set(exit.toSceneId, (arriving.get(exit.toSceneId) ?? 0) + 1)
  }

  return inDocumentOrder(story.scenes, story.exits, story.openingSceneId).map((scene) => {
    const arrivals = arriving.get(scene.id) ?? 0

    return {
      scene,
      opens: scene.id === story.openingSceneId,
      here: scene.id === sceneWritten,
      arrivals: countedArrivals(arrivals, t),
      unreached: !arrivals && scene.id !== story.openingSceneId,
      ways: exitsFrom(story.exits, scene.id),
      counted: {
        flags: Object.keys(scene.sets).length,
        shots: scene.shots.length,
      },
    }
  })
})

/**
 * The scroller the document stands in, which is the page's and not this
 * component's: `app/pages/stories/[id]/index.vue` puts the writing straight into
 * it, so it is this element's own parent and nothing has to be told a class name.
 */
const written = useTemplateRef<HTMLElement>('written')

/**
 * Runs an act that reorders the document above the Scene it was run from, and
 * leaves that Scene where it was on screen. Without this the caret stays in its
 * field and the words under it walk up or down the window, which is the one thing
 * a document must never do while somebody is typing in it.
 *
 * Which acts those are is read off `columnsOf`, the walk the order is, and there
 * is exactly one: marking the Opening Scene re-roots it, so a Scene thirty
 * sections down becomes the first and everything that stood above it goes below.
 * Nothing else can raise a line above the caret. A column is a Scene's distance
 * from the opening in Exits taken, so renumbering the ways on out of a Scene
 * reorders only the columns beyond its own, and taking one away can only ever
 * lengthen a Scene's distance or leave it unreached — and a Scene nothing reaches
 * is walked after every column the opening does, which is below. Writing an Exit
 * or leading one elsewhere is the same argument in reverse: the Scene at the far
 * end is reached from this one, so the order can only put it further from the
 * opening than the Scene the Author is standing in.
 *
 * Measured against the section rather than against the scroller's own height: the
 * document may have grown below the caret as well, and only the section says what
 * happened above it. The correction is instant whatever the page's
 * `scroll-behavior` is, because a smooth one would animate a jump that is meant
 * never to be seen.
 */
async function withoutJumping(scene: Scene, act: () => Promise<unknown>) {
  const section = () => document.getElementById(`scene-${scene.id}`)
  const before = section()?.getBoundingClientRect().top

  await act()
  await nextTick()

  const after = section()?.getBoundingClientRect().top
  if (before === undefined || after === undefined) return
  written.value?.parentElement?.scrollBy({ top: after - before, behavior: 'instant' })
}

function exitsInto(sceneId: string) {
  return story.exits.filter(exit => exit.toSceneId === sceneId)
}

/**
 * A Scene goes with its Shots and the Exits at both ends of it, and the Author
 * named none of them, so it is asked about with all three counted. See
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`.
 */
async function deleteScene(scene: Scene) {
  const named = {
    name: scene.name,
    shots: countedShots(scene.shots.length, t),
    waysOn: countedExits(exitsFrom(story.exits, scene.id).length, t),
    waysIn: countedExits(exitsInto(scene.id).length, t),
  }
  if (!await ask(t('editor.confirmDeleteScene', named), t('editor.deleteScene'))) return

  return changing(scene, () => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

function renameScene(scene: Scene) {
  return writing(scene, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { name: scene.name },
  }))
}

/** The Story opens here now, which re-roots the order every Scene is read in. */
function openOn(scene: Scene) {
  return withoutJumping(scene, () => changing(
    scene, () => send(`/api/scenes/${scene.id}/opening`, { method: 'POST' })))
}

/**
 * Adds a beat at the end of the Scene, where the hand adds one: the control under
 * the run. The key adds one where the caret is — see `openBeat`.
 */
async function addShot(scene: Scene) {
  let writtenId: string | undefined
  await changing(scene, async () => {
    writtenId = (await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot).id
  })

  if (writtenId) return typeInShot(writtenId)
}

/**
 * The run of beats is typed as one document although it stays one field per Shot:
 * `Enter` at the end of a beat opens the next, `Backspace` at the head of an empty
 * one joins it to the one before, and `Alt+↑`/`Alt+↓` walk the caret along the
 * run. All three are `docs/adr/0033-a-scene-is-written-as-one-document.md`
 * unchanged, and all three are a control on the surface too — a key nobody can see
 * is not the only way in. The walk between Scenes is `walkScenes`, which the
 * Scene's own section hears rather than a beat's field.
 */
function typeOn(held: SceneInDocument, shot: Shot, place: number, event: KeyboardEvent) {
  const field = event.target as HTMLTextAreaElement

  // Shift+Enter is how every field in every editor writes a second line.
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault()
    return openBeat(held.scene, shot, place)
  }

  if (event.key === 'Backspace' && emptied(shot) && field.selectionStart === 0
    && field.selectionEnd === 0 && place > 0) {
    event.preventDefault()
    return joinBeat(held.scene, shot, place)
  }

  const stepped = { ArrowUp: -1, ArrowDown: 1 }[event.key]
  if (!stepped) return

  if (event.metaKey || event.ctrlKey || !event.altKey) return

  const walked = held.scene.shots[place + stepped]
  if (!walked) return
  event.preventDefault()
  typeInShot(walked.id, true)
}

/**
 * `Ctrl`/`Cmd` with the arrows, which walks Scene to Scene. Heard by the Scene's
 * own section rather than by a beat's field: the caret lands in a name, in a beat,
 * in what a way on says and in the field a way on is named into, and the walk is
 * one act from all of them — including from a Scene holding no beat at all, which
 * has no field for a handler to be hung on. The caret arrives at the head of the
 * neighbour, in its name, with the address following it.
 *
 * Its control is the rail beside the document and the bar of Commands' own *Go
 * to*, which is the one key on this surface that is not also a control on it.
 */
function walkScenes(held: SceneInDocument, event: KeyboardEvent) {
  if (!event.metaKey && !event.ctrlKey) return

  const stepped = { ArrowUp: -1, ArrowDown: 1 }[event.key]
  if (!stepped) return

  // Found by the Scene's own id rather than by the row handed to the handler:
  // `sections` is recomputed on every write, so the row the template rendered
  // with is not the row the list holds by the time a key arrives.
  const at = sections.value.findIndex(other => other.scene.id === held.scene.id)
  const walked = at === -1 ? undefined : sections.value[at + stepped]
  if (!walked) return

  event.preventDefault()
  emit('open', walked.scene.id)
}

/**
 * Whether a beat holds nothing the Author would miss. Backspace takes it away
 * without asking, which is what the key does to an empty paragraph everywhere, so
 * only where nothing but the caret is on it: an Image or a Condition took thought,
 * and a beat carrying either is deleted by the mark at the end of its row instead.
 */
function emptied(shot: Shot) {
  return !shot.text && !shot.image && !shot.conditions.length
}

/**
 * Enter: the next beat, written where the caret is rather than at the end. Two
 * requests inside one change — the seam
 * `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` accepted,
 * for the same reason: a third endpoint that inserted would copy rules both
 * already enforce. At the end of the run — where an Author writing forwards spends
 * all their time — nothing is renumbered.
 */
async function openBeat(scene: Scene, shot: Shot, place: number) {
  let writtenId: string | undefined

  await changing(scene, async () => {
    // What is in the field goes first, or the beat the Author just finished is
    // written after the one that follows it and the run reads back stale.
    await send(`/api/shots/${shot.id}`, {
      method: 'PATCH',
      body: { text: shot.text, description: shot.description },
    })

    const opened = await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot
    if (place !== scene.shots.length - 1) {
      const places = scene.shots.map(held => held.id)
      places.splice(place + 1, 0, opened.id)
      await send(`/api/scenes/${scene.id}/shots/places`, { method: 'PUT', body: { places } })
    }

    writtenId = opened.id
  })

  if (writtenId) return typeInShot(writtenId)
}

/** Backspace at the head of an empty beat: it goes, and the caret lands at the end of the one before. */
async function joinBeat(scene: Scene, shot: Shot, place: number) {
  const before = scene.shots[place - 1]

  await changing(scene, () => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
  if (before) return typeInShot(before.id, true)
}

/**
 * Puts the caret in a Shot's field, once the read the change asks for has rendered
 * it. There is a field per beat of every Scene now, so the field is simply there
 * to be found: the gate that had to be moved to the beat first went with
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md`.
 */
async function typeInShot(shotId: string, atTheEnd = false) {
  await nextTick()
  const field = document.getElementById(`shot-${shotId}`) as HTMLTextAreaElement | null
  if (!field) return

  field.focus()
  if (atTheEnd) field.setSelectionRange(field.value.length, field.value.length)
}

/** Writes what the Author typed about one Shot — its text and its image's Description — in one request. */
function writeShot(scene: Scene, shot: Shot) {
  return writing(scene, () => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description },
  }))
}

/** Writes a whole sequence of Places, which is the only way one is written. */
function renumber(scene: Scene, what: 'shots' | 'exits', places: string[]) {
  return changing(
    scene,
    () => send(`/api/scenes/${scene.id}/${what}/places`, { method: 'PUT', body: { places } }),
  )
}

function moveShot(scene: Scene, shot: Shot, step: -1 | 1) {
  return renumber(scene, 'shots', movedBy(scene.shots.map(held => held.id), shot.id, step))
}

/**
 * Splits the Scene in two before one of its Shots: the beats from that one on
 * become a Scene of their own, every way on out of here moves to it, and one Exit
 * joins the two halves — so a Reading plays exactly what it played, with one press
 * between. It is the act `docs/adr/0001-branching-only-between-scenes.md` owed: an
 * Author who wants the Story to branch in the middle of a Scene splits it here and
 * writes the second way on out of the first half.
 *
 * The new half arrives under a provisional name made of this one's, and is opened
 * with that name selected, so the first thing typed replaces it. It lands directly
 * under the half it came out of, which is where the order puts a Scene one Exit
 * further on, so nothing above the caret moves and the document stays where it is.
 */
async function splitBefore(scene: Scene, shot: Shot) {
  const name = t('editor.splitSceneName', { name: scene.name }).slice(0, SCENE_NAME_MAX_LENGTH)
  let writtenId: string | undefined

  await changing(scene, async () => {
    const split = await send(`/api/scenes/${scene.id}/split`, {
      method: 'POST',
      body: { shotId: shot.id, name },
    }) as Pick<Scene, 'id' | 'name'>

    writtenId = split.id
    announce(t('editor.sceneSplit', { name: scene.name, to: name }))
  })

  if (writtenId) emit('open', writtenId, true)
}

/** Attaches an image, sent as the whole request body: picked or dropped, it is the same file to the same endpoint. */
function attach(scene: Scene, shot: Shot, file: File) {
  return changing(scene, async () => {
    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: file })
    emit('attached', shot.id)
  })
}

/** The picker is cleared afterwards, so picking the same file twice is a change twice. */
function attachImage(scene: Scene, shot: Shot, event: Event) {
  const picker = event.target as HTMLInputElement
  const picked = picker.files?.[0]
  if (!picked) return
  picker.value = ''

  return attach(scene, shot, picked)
}

/** The Shot whose thumbnail a file is over, held by id: the read that lands mid-drag replaces every Scene in the Story. */
const fileOver = ref<string>()

function overImage(shot: Shot, event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  fileOver.value = shot.id
}

/** Asked of the thumbnail and not what is inside it, or the mark flickers off under a hand that has not gone anywhere. */
function leaveImage(shot: Shot, event: DragEvent) {
  const thumbnail = event.currentTarget as HTMLElement
  if (fileOver.value !== shot.id) return

  if (!thumbnail.contains(event.relatedTarget as Node | null)) fileOver.value = undefined
}

/** The first image among what was dropped is the one taken; a drop with no image at all is still sent, and the endpoint says what an image is. */
function dropImage(scene: Scene, shot: Shot, event: DragEvent) {
  fileOver.value = undefined
  const dropped = [...event.dataTransfer?.files ?? []]
  const image = dropped.find(file => SHOT_IMAGE_TYPES.includes(file.type)) ?? dropped[0]
  if (!image) return

  return attach(scene, shot, image)
}

function deleteShot(scene: Scene, shot: Shot) {
  return changing(scene, () => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
}

/** Where a way on leads, changed in the field that says where it leads: the Exit keeps its text, its Conditions and its Place. */
function leadExit(scene: Scene, exit: Exit, toSceneId: string) {
  if (!toSceneId || toSceneId === exit.toSceneId) return

  return changing(scene, () => send(`/api/exits/${exit.id}/scene`, {
    method: 'PUT',
    body: { toSceneId },
  }))
}

/**
 * Writes a second way on to the same Scene, carrying the Conditions of the first:
 * two ways on to one Scene under opposite Conditions is what Conditions on an Exit
 * are for, so it is written on purpose here. The text is not copied — the second
 * is offered under opposite tests and phrased from scratch.
 */
function duplicateExit(scene: Scene, exit: Exit) {
  const conditions = wholeConditions(exit.conditions)

  return changing(scene, async () => {
    const written = await send(`/api/scenes/${scene.id}/exits`, {
      method: 'POST',
      body: { toSceneId: exit.toSceneId },
    }) as Exit

    if (conditions.length) {
      await send(`/api/exits/${written.id}/conditions`, { method: 'PUT', body: { conditions } })
    }

    announce(t('editor.exitDuplicated', {
      from: scene.name,
      to: sceneNamed(sceneNames.value, exit.toSceneId, t),
    }))
  })
}

/** No confirmation: the control is named for what it takes, which is not the slip of a hand. */
function deleteExit(scene: Scene, exit: Exit) {
  return changing(scene, () => send(`/api/exits/${exit.id}`, { method: 'DELETE' }))
}

/**
 * What the field at the foot of a Scene's ways on holds while a name is being
 * typed into it, a Scene at a time: the document holds forty of these fields now,
 * and one string between them would put what is typed at the foot of one Scene
 * into the foot of all of them. The field acts and then forgets, so none of them
 * ever stands holding the last thing it did.
 *
 * And a Scene that goes takes its entry with it. The string belongs to the Scene
 * rather than to the page, so a Story read back without that Scene is where it
 * stops being anything — otherwise a bench left open for an afternoon keeps a
 * half-typed name for every Scene ever deleted, which is not a field that forgets.
 */
const adding = reactive<Record<string, string>>({})

watch(() => story.scenes, (scenes) => {
  const standing = new Set(scenes.map(scene => scene.id))
  for (const id of Object.keys(adding)) {
    if (!standing.has(id)) delete adding[id]
  }
})

/**
 * A way on written by naming where it leads. A name that answers to a Scene of the
 * Story — compared the way the bar of Commands compares names, so *cafe* finds *Le
 * café* — joins the two; a name nothing answers to writes a Scene under it and
 * joins that, which is how every Scene after the first is born. Either way the
 * hand is put on the new way on's text, which is the next thing to write: the
 * Author has just said where it leads, and what the Reader presses is the other
 * half of it.
 *
 * The two writes of a new Scene are one change and not one transaction, the seam
 * `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` accepted.
 * Reached by `change` and by `submit` both, because a name picked from the list
 * fires the one and a name typed and entered fires the other — and sometimes both,
 * which is why the field is emptied before anything waits.
 *
 * The Scene it writes is reached from this one, so the order can only put it
 * further from the opening than the Scene it was named in: it lands below the
 * Author's hands and never above them, which is why nothing here holds the
 * document still — see `withoutJumping` for the acts that do.
 */
async function addExit(scene: Scene) {
  const name = (adding[scene.id] ?? '').trim()
  adding[scene.id] = ''
  if (!name) return

  const found = story.scenes.find(other => plainly(other.name) === plainly(name))
  let writtenId: string | undefined

  await changing(scene, async () => {
    const toSceneId = found?.id ?? (await send(`/api/stories/${story.id}/scenes`, {
      method: 'POST',
      body: { name },
    }) as Scene).id

    const written = await send(`/api/scenes/${scene.id}/exits`, {
      method: 'POST',
      body: { toSceneId },
    }) as Exit

    writtenId = written.id
    announce(t(found ? 'editor.exitDrawn' : 'editor.exitDrawnToNew', {
      from: scene.name,
      to: found?.name ?? name,
    }))
  })

  if (!writtenId) return
  await nextTick()
  document.getElementById(`exit-${writtenId}`)?.focus()
}

/** The words the Reader reads on the button that takes the way on. A typed write, like a Shot's text. */
function writeExitText(scene: Scene, exit: Exit) {
  return writing(scene, () => send(`/api/exits/${exit.id}`, {
    method: 'PATCH',
    body: { text: exit.text },
  }))
}

function moveExit(held: SceneInDocument, exit: Exit, step: -1 | 1) {
  return renumber(held.scene, 'exits', movedBy(held.ways.map(way => way.id), exit.id, step))
}

/**
 * The Flags the Scene sets on entry, as the rows the Author wrote them in amount
 * to. Written onto the fetched Scene as well, because the guided path reads the
 * Flags off the Story the page holds.
 */
function writeFlags(scene: Scene, sets: Sets) {
  scene.sets = sets

  return writing(scene, () => send(`/api/scenes/${scene.id}/flags`, {
    method: 'PUT',
    body: { sets },
  }))
}

/** Writes the whole list an Exit or a Shot carries, which is what the endpoint takes. */
function writeConditions(
  scene: Scene, where: 'exits' | 'shots', carrierId: string, carried: Condition[],
) {
  return writing(scene, () => send(`/api/${where}/${carrierId}/conditions`, {
    method: 'PUT',
    body: { conditions: wholeConditions(carried) },
  }))
}
</script>

<template>
  <article ref="written" class="writing">
    <!-- A section per Scene, in the order the Story is written in, each addressed
         by the Scene's own id: `?scene=` names one and the document is scrolled to
         it — see `docs/adr/0043-a-story-is-written-as-one-document.md`. A group,
         because it holds together everything about one Scene, and named by the
         Scene so that the run of fields inside it is heard as that Scene's own. -->
    <section
      v-for="held in sections"
      :id="`scene-${held.scene.id}`"
      :key="held.scene.id"
      class="scene"
      role="group"
      :data-scene="held.scene.id"
      :aria-label="$t('editor.writingScene', { name: held.scene.name })"
      @keydown="walkScenes(held, $event)"
    >
      <!-- The name is the heading and the heading is written in: a bare field, the
           same idiom as a Shot's text, with no mode to enter first. -->
      <label class="visually-hidden" :for="`scene-name-${held.scene.id}`">
        {{ $t('editor.sceneName', { name: held.scene.name }) }}
      </label>
      <!-- The slate: the name, whether the Story opens here, what arrives at it,
           and the one act that takes it away. What arrives is said in words rather
           than left to the rail's marks, because the rail is `aria-hidden` and this
           is where the document says it. -->
      <div class="slate" :class="{ unreached: held.unreached }">
        <h2 class="named">
          <input
            :id="`scene-name-${held.scene.id}`"
            v-model="held.scene.name"
            :maxlength="SCENE_NAME_MAX_LENGTH"
            @change="renameScene(held.scene)"
          >
        </h2>

        <!-- Where the Story opens: a word on the Scene that carries it, and on
             every other the act that moves it. A button and not a radio, although
             one group across the document is the truer reading of a Story that
             opens on exactly one Scene. A group's arrows move the focus and check
             what they land on in the same press, and every commit here is a write
             to the server — so `ArrowDown` in a document an Author walks with the
             arrows would re-root their Story under their hands. And only the
             checked member of a group is a tab stop, which would leave the mark of
             thirty-nine Scenes out of the tab order `0043` says a control keeps its
             place in wherever it stands. Behind the gate `0042` drew, the group
             had one member and neither cost existed. A button is a tab stop on
             every Scene, writes nothing an arrow can reach, and is what the bench
             already calls this act in the bar of Commands.

             It is also why nothing here has a checked state to fall out of step
             with: what the Author sees is drawn from the Story the page read back,
             so a refused write leaves the mark where it was. -->
        <p class="opening" :data-step="held.here ? 'opening-scene' : undefined">
          <span v-if="held.opens" class="eyebrow">
            {{ $t('editor.openingScene') }}
            <span class="visually-hidden">{{ held.scene.name }}</span>
          </span>
          <button
            v-else
            type="button"
            :data-command="held.here ? $t('editor.markOpeningScene') : undefined"
            @click="openOn(held.scene)"
          >
            {{ $t('editor.markOpeningScene') }}
            <span class="visually-hidden">{{ held.scene.name }}</span>
          </button>
        </p>

        <p class="arrivals">{{ held.arrivals }}</p>

        <button
          type="button"
          class="danger going"
          :data-command="held.here ? $t('editor.deleteScene') : undefined"
          @click="deleteScene(held.scene)"
        >
          {{ $t('editor.deleteScene') }}
          <span class="visually-hidden">{{ held.scene.name }}</span>
        </button>
      </div>

      <!-- Why the last change in this Scene was refused, said at the foot of the
           slate of the Scene it is about: beside the name, which is what the
           commonest refusal on a Scene — *A Scene needs a name.* — is about, and
           under it rather than over it, so the field the Author goes back to
           correct is neither covered nor taken away from the pointer. It holds its
           own room and is laid over nothing. What that costs is a push on what
           stands below it, which the browser's scroll anchoring absorbs wherever
           there is scroller above to absorb it; `tests/e2e/scenes-signed-in.spec.ts`
           drives both halves — what the sentence covers, and what it moves. -->
      <Refusal v-if="refusedIn === held.scene.id" :problem="problem" />

      <!-- The Flags the Scene sets, at the head of its section where they happen:
           set on entry, before the first Shot plays. On one line with its heading
           while the Scene sets none, which is most Scenes.

           A heading and no landmark, here and in the two sections under it. A
           named `<section>` is a region, and a Story of forty Scenes written where
           they stand would put a hundred and twenty of them in a screen reader's
           rotor — *Flags*, *Shots*, *Exits*, forty times over. Naming each one for
           its Scene, the way every control of a row is named, would make them
           distinct without making them fewer, and a list of a hundred and twenty
           is not a way to get anywhere: what an Author moves by is the Scene, and
           the rail, the address and the bar of Commands each reach one. The
           headings stay, so the outline still reads the Scene and then its Flags,
           Shots and Exits under it, which is what the document is walked by. -->
      <section class="held set">
        <h3>
          {{ $t('editor.flagsHeld') }}
          <span class="counted">{{ held.counted.flags }}</span>
        </h3>

        <Flags
          :data-step="held.here ? 'scene-flags' : undefined"
          :sets="held.scene.sets"
          :scene="held.scene.name"
          :id="held.scene.id"
          :named="held.here"
          @write="writeFlags(held.scene, $event)"
        />
      </section>

      <!-- The run: one row a beat, its Place in the margin, the thumbnail and the
           words side by side, the Description under them where there is an Image to
           describe, and what the beat plays under sharing its last line with the
           marks that move and take it away — `0033`'s row, over the whole Story.
           Counted twice: in Shots, which is the count the bench gives of the whole
           Story beside the document, and in words, which is what a writer asks. -->
      <section class="held run">
        <h3>
          {{ $t('editor.shotsHeld') }}
          <span class="counted">{{ held.counted.shots }}</span>
          <!-- Its own component so that the one number here that changes on every
               keystroke does not make every keystroke the document's business —
               see `app/components/Words.vue`. -->
          <Words class="counted words" :shots="held.scene.shots" />
        </h3>

        <p v-if="!held.scene.shots.length" class="none">{{ $t('editor.noShotYet') }}</p>

        <ol v-else class="shots">
          <li v-for="(shot, place) in held.scene.shots" :key="shot.id" :data-shot="shot.id">
            <span class="numbered">{{ place + 1 }}</span>

            <div class="beat">
              <!-- The frame is pressed to attach an image or replace one: the box
                   is a label and the input is clipped away inside it. Drawn whether
                   or not there is an image in it, so an unfinished beat reads as
                   unfinished — at the size of a thumbnail here, because the size a
                   Reader meets it at is what the Preview and the contact sheet are
                   for. -->
              <label
                class="image"
                :class="{ over: fileOver === shot.id }"
                @dragenter.prevent.stop="overImage(shot, $event)"
                @dragover.prevent.stop="overImage(shot, $event)"
                @dragleave="leaveImage(shot, $event)"
                @drop.prevent.stop="dropImage(held.scene, shot, $event)"
              >
                <img
                  v-if="shot.image"
                  :src="imageOf(shot)"
                  :alt="$t('editor.imageOfShot', {
                    place: place + 1,
                    scene: held.scene.name,
                  })"
                >
                <input
                  type="file"
                  class="visually-hidden"
                  :accept="SHOT_IMAGE_TYPES.join(',')"
                  :aria-label="$t('editor.pickImageOfShot', {
                    place: place + 1,
                    scene: held.scene.name,
                  })"
                  @change="attachImage(held.scene, shot, $event)"
                >
              </label>

              <label class="visually-hidden" :for="`shot-${shot.id}`">
                {{ $t('editor.shotOfScene', { place: place + 1, scene: held.scene.name }) }}
              </label>
              <textarea
                :id="`shot-${shot.id}`"
                v-model="shot.text"
                :data-step="held.here && !place ? 'shot-text' : undefined"
                class="shot"
                rows="2"
                :lang="story.language"
                :maxlength="SHOT_TEXT_MAX_LENGTH"
                @change="writeShot(held.scene, shot)"
                @keydown="typeOn(held, shot, place, $event)"
              />

              <!-- What the image shows, for a Reader who cannot see it: nothing to
                   describe until one is attached. -->
              <p v-if="shot.image" class="described">
                <label class="eyebrow" :for="`description-${shot.id}`">
                  {{ $t('editor.description') }}
                  <span class="visually-hidden">
                    {{ $t('editor.descriptionOfShot', {
                      place: place + 1,
                      scene: held.scene.name,
                    }) }}
                  </span>
                </label>
                <input
                  :id="`description-${shot.id}`"
                  v-model="shot.description"
                  type="text"
                  :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
                  :placeholder="$t('editor.whatTheImageShows')"
                  @change="writeShot(held.scene, shot)"
                >
              </p>

              <div class="beneath">
                <Conditions
                  :data-step="held.here && !place ? 'shot-condition' : undefined"
                  :lead="$t('editor.playedWhen')"
                  :carrier="$t('editor.shotOfScene', {
                    place: place + 1,
                    scene: held.scene.name,
                  })"
                  :conditions="shot.conditions"
                  :scenes="story.scenes"
                  :counting="held.scene.id"
                  :id="shot.id"
                  :named="held.here"
                  @write="writeConditions(held.scene, 'shots', shot.id, shot.conditions)"
                />

                <!-- The marks act on the row they are drawn on: the scissors split
                     the Scene before this beat, which the first beat has nothing
                     before it to be split from. -->
                <div class="row">
                  <button
                    v-if="place > 0"
                    type="button"
                    class="mark"
                    @click="splitBefore(held.scene, shot)"
                  >
                    <span aria-hidden="true">✂</span>
                    <span class="visually-hidden">
                      {{ $t('editor.splitBefore', {
                        place: place + 1,
                        scene: held.scene.name,
                      }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="mark"
                    :disabled="place === 0"
                    @click="moveShot(held.scene, shot, -1)"
                  >
                    <span aria-hidden="true">↑</span>
                    <span class="visually-hidden">
                      {{ $t('common.moveEarlier') }}
                      {{ $t('editor.shotOfScene', {
                        place: place + 1,
                        scene: held.scene.name,
                      }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="mark"
                    :disabled="place === held.scene.shots.length - 1"
                    @click="moveShot(held.scene, shot, 1)"
                  >
                    <span aria-hidden="true">↓</span>
                    <span class="visually-hidden">
                      {{ $t('common.moveLater') }}
                      {{ $t('editor.shotOfScene', {
                        place: place + 1,
                        scene: held.scene.name,
                      }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="danger mark"
                    @click="deleteShot(held.scene, shot)"
                  >
                    <span aria-hidden="true">×</span>
                    <span class="visually-hidden">
                      {{ $t('common.delete') }}
                      {{ $t('editor.shotOfScene', {
                        place: place + 1,
                        scene: held.scene.name,
                      }) }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </li>
        </ol>

        <!-- A beat added by hand rather than by key: what an Author who has just
             written a Scene with nothing in it gets, since there is no beat to
             press Enter at the end of. -->
        <p class="adds">
          <button
            type="button"
            :data-command="held.here ? $t('editor.addShot') : undefined"
            @click="addShot(held.scene)"
          >
            {{ $t('editor.addShot') }}
            <span class="visually-hidden">
              {{ $t('editor.toScene', { name: held.scene.name }) }}
            </span>
          </button>
        </p>
      </section>

      <!-- The foot of the Scene: the ways out, in the Places it offers them at,
           each with the Conditions it is offered under. Last because that is where
           the Reader meets them. -->
      <section class="held ways">
        <h3>
          {{ $t('editor.waysHeld') }}
          <span class="counted">{{ held.ways.length }}</span>
        </h3>

        <p v-if="!held.ways.length" class="none">{{ $t('editor.noWayOnYet') }}</p>
        <ol v-else>
          <li v-for="(exit, place) in held.ways" :key="exit.id" :data-way="exit.id">
            <span class="numbered">{{ place + 1 }}</span>

            <div class="written">
              <!-- Where the way on leads, in a field that says so, and beside it
                   the mark that goes there: the Scene at the far end is one press
                   away from the section that names it. -->
              <p class="arrival">
                <label class="visually-hidden" :for="`leads-${exit.id}`">
                  {{ $t('editor.wayOnLeadsTo', { place: place + 1, name: held.scene.name }) }}
                </label>
                <select
                  :id="`leads-${exit.id}`"
                  :value="exit.toSceneId"
                  @change="leadExit(
                    held.scene, exit, ($event.target as HTMLSelectElement).value)"
                >
                  <Landing
                    :scenes="story.scenes"
                    :exits="story.exits"
                    :from="held.scene.id"
                    :led="exit.toSceneId"
                  />
                </select>
                <button
                  type="button"
                  class="mark"
                  @click="emit('open', exit.toSceneId)"
                >
                  <span aria-hidden="true">→</span>
                  <span class="visually-hidden">
                    {{ $t('editor.goToSceneByExit', {
                      name: sceneNames.get(exit.toSceneId),
                      place: place + 1,
                      scene: held.scene.name,
                    }) }}
                  </span>
                </button>
              </p>

              <!-- The words the Reader reads on the button. -->
              <p class="said">
                <label class="visually-hidden" :for="`exit-${exit.id}`">
                  {{ $t('editor.wayOnSays', { place: place + 1, name: held.scene.name }) }}
                </label>
                <input
                  :id="`exit-${exit.id}`"
                  v-model="exit.text"
                  :maxlength="EXIT_TEXT_MAX_LENGTH"
                  :placeholder="$t('editor.whatTheReaderPresses')"
                  @change="writeExitText(held.scene, exit)"
                >
              </p>

              <div class="beneath">
                <Conditions
                  :lead="$t('editor.offeredWhen')"
                  :carrier="$t('editor.theWayOnTo', {
                    place: place + 1,
                    scene: sceneNames.get(exit.toSceneId),
                    from: held.scene.name,
                  })"
                  :conditions="exit.conditions"
                  :scenes="story.scenes"
                  :counting="held.scene.id"
                  :id="exit.id"
                  :named="held.here"
                  @write="writeConditions(held.scene, 'exits', exit.id, exit.conditions)"
                />

                <div class="row">
                  <button
                    type="button"
                    class="mark"
                    :disabled="place === 0"
                    @click="moveExit(held, exit, -1)"
                  >
                    <span aria-hidden="true">↑</span>
                    <span class="visually-hidden">
                      {{ $t('common.moveEarlier') }}
                      {{ $t('editor.theWayOnTo', {
                        place: place + 1,
                        scene: sceneNames.get(exit.toSceneId),
                        from: held.scene.name,
                      }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="mark"
                    :disabled="place === held.ways.length - 1"
                    @click="moveExit(held, exit, 1)"
                  >
                    <span aria-hidden="true">↓</span>
                    <span class="visually-hidden">
                      {{ $t('common.moveLater') }}
                      {{ $t('editor.theWayOnTo', {
                        place: place + 1,
                        scene: sceneNames.get(exit.toSceneId),
                        from: held.scene.name,
                      }) }}
                    </span>
                  </button>
                  <button type="button" class="mark" @click="duplicateExit(held.scene, exit)">
                    <span aria-hidden="true">⧉</span>
                    <span class="visually-hidden">
                      {{ $t('editor.duplicateExitTo', {
                        scene: sceneNames.get(exit.toSceneId),
                        from: held.scene.name,
                      }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="danger mark"
                    @click="deleteExit(held.scene, exit)"
                  >
                    <span aria-hidden="true">×</span>
                    <span class="visually-hidden">
                      {{ $t('common.delete') }}
                      {{ $t('editor.theWayOnTo', {
                        place: place + 1,
                        scene: sceneNames.get(exit.toSceneId),
                        from: held.scene.name,
                      }) }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </li>
        </ol>

        <!-- A way on written by naming where it leads: one field, offering the
             Scenes it may land on and taking any name at all. A name the Story
             answers to joins; one it does not writes the Scene. `data-step` is on
             the whole line, because what the guided path asks for is the whole of
             it. A field cannot be pressed, so the bar of Commands puts the hand on
             it instead. -->
        <form
          class="adding"
          :data-step="held.here ? 'way-on' : undefined"
          @submit.prevent="addExit(held.scene)"
        >
          <label class="eyebrow" :for="`add-way-${held.scene.id}`">
            {{ $t('editor.addWayOn') }}
            <span class="visually-hidden">{{ held.scene.name }}</span>
          </label>
          <input
            :id="`add-way-${held.scene.id}`"
            v-model="adding[held.scene.id]"
            :list="`landing-${held.scene.id}`"
            autocomplete="off"
            :maxlength="SCENE_NAME_MAX_LENGTH"
            :placeholder="$t('editor.nameWhereItLeads')"
            :data-command="held.here ? $t('editor.addWayOnCommand') : undefined"
            @change="addExit(held.scene)"
          >
          <datalist :id="`landing-${held.scene.id}`">
            <Landing by-name :scenes="story.scenes" :exits="story.exits" :from="held.scene.id" />
          </datalist>
        </form>
      </section>
    </section>
  </article>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The document, as a column of Scenes read from the top down. The page owns the
   scroller this stands in, so nothing here scrolls and nothing here is sized to a
   window: a long Story is a long document, which is the shape of the thing. */
.writing {
  display: grid;
  gap: var(--s5);
  padding: var(--s4);
  /* A Scene's name and an Author's own prose are the Author's words, and a word
     longer than the column is broken rather than sent off the edge of it: at the
     width of a phone this is what keeps the page from scrolling sideways. */
  overflow-wrap: break-word;
}

/* One Scene, written where it stands. It takes the room its own content needs and
   the document is what scrolls, so a Scene of twenty beats and six ways on is a
   long section of a long document rather than a box with a scrollbar inside
   another one.

   It is the containing block for what is inside it, so a visually hidden label at
   the foot of a long Scene is positioned against its own Scene rather than against
   the whole page. */
.scene {
  position: relative;
  display: grid;
  gap: var(--s3);
  align-content: start;
  min-inline-size: 0;
  /* The address names a Scene and the document is scrolled to it, so a Scene
     arrives under the head of the scroller rather than jammed against it. */
  scroll-margin-block-start: var(--s4);
}

/* The slate: the Scene's name, whether the Story opens on it, what arrives at it
   and the one act that takes it away — one line, and the only place on the bench
   where the condensed face a title card is set in appears at the size it is meant
   to be read at. The name is typed where it is read, so the field draws no box
   until the pointer is on it. */
.slate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
  padding-block-end: var(--s2);
  border-block-end: 1px solid var(--edge);
}

.named {
  flex: 1 1 12rem;
  min-inline-size: 0;
}

.named input {
  padding: 0 var(--s1);
  border-color: transparent;
  background: none;
  font-family: var(--display);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.1;
}

.named input:hover {
  border-color: var(--edge);
  background: var(--steel);
}

.opening {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

/* Moving where the Story opens, worn as quietly as taking the Scene away: the
   Story already opens somewhere, and this is the offer on every Scene it does not
   open on rather than a thing to do. Full strength once the hand or the keyboard
   is on it, which is the rule `0043` sets for every act drawn on a row. */
.opening button {
  border-color: transparent;
  background: none;
  color: var(--muted);
}

.opening button:hover:not(:disabled),
.opening button:focus-visible {
  color: var(--paper);
}

/* What arrives here, said by the bench about the Story rather than written in it,
   so it is stencilled in the machine's own data face. */
.arrivals {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

/* A Scene nothing arrives at, read as the loose end it is: the dashed edge the
   node wore and the rail's mark still wears. No colour of its own — a Scene no
   Reader reaches is a Story an Author may be in the middle of, and the alarm is
   the colour of something having gone wrong. What says it in words is the
   `countedArrivals` sentence on the same line, which has one for the zero. */
.slate.unreached {
  border-block-end-style: dashed;
}

/* Taking the Scene away is named in full — it is what the bar of Commands reads
   and what a screen reader hears — and worn as the quiet mark it should be: the
   act at the far end of the slate, in the alarm's colour only once the hand is on
   it. */
.going {
  border-color: transparent;
  background: none;
  color: var(--muted);
}

/* The three parts of a Scene, each headed and counted where it starts, in the same
   order a Reader meets them: what is set on entry, the run, the ways out. The
   heading is the only stencilled line in the column, so an Author scrolling a long
   Story always knows which part of which Scene they are in. */
.held {
  display: grid;
  gap: var(--s3);
}

/* What the Scene sets on entering, read along one line with its own heading: a
   Scene that sets nothing spends a line on saying so and not a paragraph, and one
   that sets three Flags wraps them under it. */
.held.set {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
}

.held > h3 {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  color: var(--paper);
}

.held > h3 .counted {
  color: var(--grease);
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 500;
}

/* The words, at the far end of the heading: a reading and not a heading. */
.held > h3 .words {
  margin-inline-start: auto;
  color: var(--muted);
  font-size: 0.75rem;
  font-family: var(--data);
}

/* A beat, and a way on: the Place in a margin of its own and what it holds beside
   it, which is the shape every list of Places on the bench is drawn in. */
.shots > li,
.ways > ol > li {
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr);
  gap: var(--s1) var(--s3);
  align-items: start;
}

.shots > li + li,
.ways > ol > li + li {
  margin-block-start: var(--s3);
}

.numbered {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  text-align: end;
  /* On the first line of the row whatever the field's own face makes of it. */
  line-height: 2;
}

/* A beat: the thumbnail and the words side by side, the Description under them,
   and what it plays under across the width of both — `0033`'s row, which the gate
   replaced with a frame and a strip and which comes back here because the document
   now holds every Scene and a frame apiece would be forty frames. */
.beat {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  gap: var(--s2) var(--s3);
  align-items: start;
}

.beat > .image {
  grid-row: span 2;
}

.beat > .beneath {
  grid-column: 1 / -1;
}

/* The thumbnail, drawn whether or not there is an image in it: an empty one is the
   outline of the image nobody attached, which is how an unfinished beat reads as
   unfinished. Pressed to attach one or replace one — the box is the label and the
   input is clipped away inside it. */
.image {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  inline-size: 100%;
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  color: var(--muted);
  cursor: pointer;
}

.image:not(:has(img))::before {
  content: '+';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--data);
  font-size: 1.25rem;
  line-height: 1;
}

.image:hover {
  border-color: color-mix(in oklab, var(--light) 55%, var(--edge));
  color: var(--paper);
}

/* An image landed: the outline it stood for is gone and the picture is the box. */
.image:has(img) {
  border-style: solid;
  border-color: transparent;
}

/* The focus the input takes cannot be seen where the input is, so the ring is
   drawn round the box that is pressed. */
.image:has(:focus-visible) {
  outline: 2px solid var(--light);
  outline-offset: 2px;
}

/* A file over the thumbnail wears the grease pencil: letting go would do something. */
.image.over {
  border-color: var(--grease);
  background: color-mix(in oklab, var(--grease) 12%, var(--bench));
}

.image img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* The one field on the bench an Author spends hours in, and the only place in the
   product where the interface is set in the reading face: `.shot` is that face, at
   the measure a Shot is read on, and it is shared with the room so that what is
   typed here is what is read there. It carries no box at all — the beat is written
   straight into the document — and grows as it is typed rather than opening a
   scrollbar two lines deep. `rows` is still on the element for a browser without
   `field-sizing`, which simply keeps the two lines it was given. */
textarea.shot {
  field-sizing: content;
  block-size: auto;
  min-block-size: 2lh;
  max-block-size: 16lh;
  inline-size: 100%;
  padding: 0;
  border: none;
  background: none;
}

textarea.shot:hover {
  border: none;
}

/* Where the field sizes itself there is nothing left for a grip to do, and the
   hatched corner it draws is the one piece of browser chrome on a surface that is
   otherwise all writing. Where the browser has no `field-sizing`, the grip is how
   a long beat is read, so it stays. */
@supports (field-sizing: content) {
  textarea.shot {
    resize: none;
  }
}

/* What the image shows, for a Reader who cannot see it: a label over a field, at
   the size of the note it is rather than of the beat it belongs to. */
.described {
  display: grid;
  gap: var(--s1);
}

.described input {
  padding: var(--s1) var(--s2);
  border-color: transparent;
  background: none;
  font-size: 0.8125rem;
}

.described input:hover,
.described input:focus-visible {
  border-color: var(--edge);
}

/* The Conditions and the marks on one line, the marks at the trailing edge. A row
   carrying Conditions grows a column of them and the marks drop under it, which is
   what wrap is for. */
.beneath {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--s1) var(--s3);
  min-block-size: 1.5rem;
}

.beneath .conditions {
  flex: 1 1 auto;
  min-inline-size: 0;
}

/* The marks that act on one row, set closer than a row of controls anywhere else:
   three or four are one strip. */
.beneath .row,
.written .row {
  gap: var(--s1);
}

/* What is done to a way on rather than written in it — move it, take it away,
   write a second one to the same Scene, put it under a Condition — waits for the
   hand or the keyboard to arrive at the row. It is drawn and laid out at every
   moment, so nothing moves when it appears and nothing is taken out of the tab
   order or off a screen reader: it is simply not lit until the row is the one
   being worked on. What the Author has already written — a Condition that exists —
   is never dimmed; only the offer to add one is.

   A beat's own marks are not quieted here, and deliberately: carrying this to
   every row of the whole Story is #253, which is where the rule `0043` writes —
   full strength under the caret or the pointer — is applied at the scale of the
   document rather than of one Scene. */
.ways .written .row,
.ways .beneath .conditions.quiet {
  opacity: 0;
  transition: opacity 120ms ease-out;
}

.ways li:hover .row,
.ways li:focus-within .row,
.ways li:hover .conditions.quiet,
.ways li:focus-within .conditions.quiet {
  opacity: 1;
}

/* A screen with no pointer has no hover to reveal anything with, so there the row
   is simply always lit. */
@media (hover: none) {
  .ways .written .row,
  .ways .beneath .conditions.quiet {
    opacity: 1;
  }
}

/* The beat added by hand, under the run it is added to the end of. */
.adds {
  display: flex;
}

.adds button {
  font-size: 0.8125rem;
}

/* A way on is a row and not a card: where it leads and what the Reader presses
   side by side, and what it is offered under under both. */
.written {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr);
  align-items: center;
  gap: var(--s2);
}

.written > .beneath {
  grid-column: 1 / -1;
}

.ways ol {
  display: grid;
  gap: var(--s2);
}

/* A way out is the Author's own cut, so the Place it is numbered at wears the
   grease pencil where a beat's wears the machined one. */
.ways .numbered {
  color: var(--grease);
}

.arrival {
  display: flex;
  align-items: center;
  gap: var(--s1);
  min-inline-size: 0;
}

/* Where the way on leads: a Scene's name worn as one, in a field that draws its
   frame only under the pointer — the same idiom as the Scene's own name at the
   head of the section — and as wide as the name in it rather than as wide as the
   column, so the row reads "1 → The bar" and not as a slot with a name lying at one
   end of it. */
.arrival select {
  field-sizing: content;
  flex: 0 1 auto;
  inline-size: auto;
  min-inline-size: 4rem;
  max-inline-size: 100%;
  padding: var(--s1) var(--s2);
  border-color: transparent;
  background: none;
  font-size: 0.9375rem;
}

.arrival select:hover,
.arrival select:focus-visible {
  border-color: var(--edge);
}

/* The way on's own way through: the mark that goes to the Scene at the far end,
   quiet until the row is under the hand, like everything else that acts on a row. */
.arrival .mark {
  border-color: transparent;
  background: none;
  color: var(--muted);
}

li:hover .arrival .mark,
li:focus-within .arrival .mark {
  color: var(--paper);
}

.said {
  min-inline-size: 0;
}

/* What the Reader presses, typed where it is read: the line the Author wrote on
   the Exit, in a field that draws its frame under the pointer like the name of the
   Scene it leads to. */
.said input {
  padding: var(--s1) var(--s2);
  border-color: transparent;
  background: none;
  font-size: 0.9375rem;
}

.said input:hover,
.said input:focus-visible {
  border-color: var(--edge);
}

/* The way on written here, at the foot of the ways on: a label and one field, as
   wide as a Scene's name and no wider. */
.adding {
  display: grid;
  justify-items: start;
  gap: var(--s1);
  padding-block-start: var(--s1);
}

.adding input {
  inline-size: min(100%, 24rem);
  padding: var(--s2) var(--s3);
  font-size: 0.875rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.none {
  color: var(--muted);
  font-size: 0.875rem;
  max-inline-size: 60ch;
}

/* On a phone the words take the whole column and the thumbnail goes over them: a
   beat is read down rather than across, which is the one shape that leaves the
   reading measure alone at that width. */
@media (--phone) {
  .beat {
    grid-template-columns: minmax(0, 1fr);
  }

  .beat > .image {
    grid-row: auto;
    inline-size: 8rem;
  }

  .written {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
