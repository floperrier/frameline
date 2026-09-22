<script setup lang="ts">
/**
 * The writing: the whole Story as one document, from the Opening Scene to the
 * last, in the order `inDocumentOrder` reads it — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which is also where the
 * name comes from. It is not *script*, which that record refuses in as many words,
 * and not *text*, which is what a Shot carries beside its Image.
 *
 * A Scene is a heading, the Flags it sets on entry, the Sound it is heard
 * under, the run of its Shots, and the ways out of it named by where they
 * lead. The next Scene is under it. Nothing has to be opened and nothing
 * closes, and **every Scene is written where it stands**:
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
 * Said back to the page, which is where every refusal is drawn. A band inside the
 * document stands on the writing wherever it is put — in the flow it is wound off
 * the screen, and stuck to the head of the scroller it is over the row the Author
 * came back to correct — so the sentence stands above the scroller, in the document
 * column's own furniture, and carries the Scene's name rather than its position.
 * What the Story's own edge is refused is about no Scene and names none. See
 * `.refused` in `app/pages/stories/[id]/index.vue`.
 */
const refusedIn = defineModel<string>('refusedIn')

/**
 * One act of one Scene, which is where a refusal of it is said. The Scene is
 * claimed as the act leaves rather than as it is asked for: a typed write waits
 * behind the one before it, so an act queued in the Scene the Author has just left
 * would otherwise draw its refusal in the Scene they moved to. And it is let go of
 * again the moment the act lands, so a Scene written in once is not left holding
 * the next sentence the page has to say.
 *
 * Let go of only while the claim is still this act's, because the claim belongs to
 * an act and not to the page. A clicked write goes out at once and a typed one
 * waits its turn in the queue, so two acts in two Scenes are commonly in flight
 * together now that the document holds every Scene; the one that lands first would
 * otherwise clear the other's Scene out from under it, and the refusal that
 * followed would have nowhere to be said but under the Story's edge.
 */
function inScene(scene: Scene, act: () => Promise<unknown>) {
  return async () => {
    refusedIn.value = scene.id
    await act()
    if (refusedIn.value === scene.id) refusedIn.value = undefined
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
  /**
   * What the bench calls it, which every control of the section is named by — the
   * Author's own name, numbered where they gave it to more than one Scene. Never
   * what the field holds or what a rename sends, which are the name itself.
   */
  name: string
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
  /** What this Scene is heard under: its own Sound, the one it names, or nothing. */
  heard: Heard | undefined
  /** How many Scenes take their Sound from this one, which is what a delete costs them. */
  namedBy: number
}

/**
 * What the bench calls each Scene, which is what every control naming one is named
 * by here. Two Scenes an Author called the same are numbered by `namesOnTheBench`
 * and by nothing in this file, so no reading of the document, and neither the rail
 * nor the Remarks beside them, can disagree about which *The bar* a control acts
 * on — see `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`. What
 * the Author typed is what the field below holds and what a write sends; the
 * number is drawn and never written.
 */
const named = computed(() => namesOnTheBench(story, t))

/** The name the bench gives one Scene, which is the map above read for it. */
function nameOf(sceneId: string) {
  return sceneNamed(named.value, sceneId, t)
}

const sections = computed<SceneInDocument[]>(() => {
  const arriving = new Map<string, number>()
  for (const exit of story.exits) {
    arriving.set(exit.toSceneId, (arriving.get(exit.toSceneId) ?? 0) + 1)
  }

  return inDocumentOrder(story.scenes, story.exits, story.openingSceneId).map((scene) => {
    const arrivals = arriving.get(scene.id) ?? 0

    return {
      scene,
      name: nameOf(scene.id),
      opens: scene.id === story.openingSceneId,
      here: scene.id === sceneWritten,
      arrivals: countedArrivals(arrivals, t),
      unreached: !arrivals && scene.id !== story.openingSceneId,
      ways: exitsFrom(story.exits, scene.id),
      counted: {
        flags: Object.keys(scene.sets).length,
        shots: scene.shots.length,
      },
      heard: heardUnder(story.scenes, scene.id),
      namedBy: story.scenes.filter(other => other.soundOfSceneId === scene.id).length,
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
 * gives the scroller back what opened up there. Without this the caret stays in
 * its field and the words under it walk up or down the window, which is the one
 * thing a document must never do while somebody is typing in it.
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
 * What it can give back is the room the scroller holds above the caret, and not a
 * pixel more — so the claim is a bound and not a promise. The act that reorders
 * most is the one that reorders everything: when the marked Scene becomes the
 * first of the document there is nothing left standing above it, and a correction
 * of a few thousand pixels stops at the top of the scroller with the words that
 * much higher than the hand left them. Measured on eight chained Scenes with the
 * last of them marked: 3384 pixels asked back, 171 of them not there to give.
 * Where the room is there the Scene does not move at all; where it is not, the
 * scroller is at its top and the Scene the caret is in is at the head of the
 * document, which is the nearest to where it stood that the page can be.
 * `tests/e2e/scenes-signed-in.spec.ts` holds both ends.
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
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`. Scenes heard under
 * it fall silent too, and nothing else records that afterwards — see
 * `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` — so the question
 * says how many.
 */
async function deleteScene(held: SceneInDocument) {
  const scene = held.scene
  const asked = {
    name: nameOf(scene.id),
    shots: countedShots(scene.shots.length, t),
    waysOn: countedExits(exitsFrom(story.exits, scene.id).length, t),
    waysIn: countedExits(exitsInto(scene.id).length, t),
  }
  const silenced = held.namedBy
    ? ` ${t(
      held.namedBy === 1 ? 'editor.confirmSceneSoundLostOne' : 'editor.confirmSceneSoundLostMany',
      { count: held.namedBy },
    )}`
    : ''
  if (!await ask(t('editor.confirmDeleteScene', asked) + silenced, t('editor.deleteScene'))) return

  return changing(scene, () => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

/**
 * Writes the Scene again: a copy carrying its Shots and the Flags it sets, under
 * its own name, with none of its ways on. It is what an Author reaches for where
 * they wanted the Reader to meet a Scene a second time, now that a Reading stands
 * in a Scene at most once and the way on that led back is refused — see
 * `docs/adr/0048-a-scene-is-entered-once.md`.
 *
 * The copy is opened, and its name is not selected for typing over: the name is
 * the original's on purpose, and the bench numbers the two apart. What a split
 * writes is half a Scene under a provisional name; what this writes is a Scene
 * the Author already named.
 *
 * Nothing arrives at it yet, so the order puts it past every Scene the opening
 * reaches — it lands below the Author's hands and never above them, the way a
 * Scene born from a way on does.
 */
async function duplicateScene(scene: Scene) {
  let writtenId: string | undefined

  await changing(scene, async () => {
    const copy = await send(`/api/scenes/${scene.id}/duplicate`, { method: 'POST' }) as Scene
    writtenId = copy.id
  })

  // Past the read-back, as in `splitBefore`: both Scenes now answer to one name,
  // so neither is named as the bench names it until the Story holding both has
  // landed.
  if (!writtenId) return
  announce(t('editor.sceneDuplicated', { name: nameOf(scene.id), to: nameOf(writtenId) }))
  emit('open', writtenId)
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
      body: { text: shot.text, description: shot.description, transcript: shot.transcript },
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

/** Writes what the Author typed about one Shot — its text, its image's Description and its Sound's Transcript — in one request. */
function writeShot(scene: Scene, shot: Shot) {
  return writing(scene, () => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description, transcript: shot.transcript },
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
  })

  // Said once the read the change asks for has landed, because the sentence names
  // the new half as the bench does and the bench numbers a name two Scenes carry
  // off the Story it holds — which does not hold the new half until then.
  if (!writtenId) return
  announce(t('editor.sceneSplit', { name: nameOf(scene.id), to: nameOf(writtenId) }))
  emit('open', writtenId, true)
}

/** Attaches an image, sent as the whole request body: picked or dropped, it is the same file to the same endpoint. */
function attach(scene: Scene, shot: Shot, file: File) {
  return changing(scene, async () => {
    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: file })
    emit('attached', shot.id)
  })
}

/** Picked from the dialog rather than dropped on the thumbnail — see `depositedFile`. */
function attachImage(scene: Scene, shot: Shot, event: Event) {
  const file = depositedFile(event)
  if (!file) return

  return attach(scene, shot, file)
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

/**
 * The Sounds a Scene may be heard under: the ones this Story already carries, and
 * the library. One list rather than two, because naming a Sound the Story carries
 * and taking one off the shelf are the same gesture for the Author — and the list
 * offers carriers alone, which is the rule the API refuses the rest by.
 */
const carriers = computed(() => soundCarriers(story.scenes))

/**
 * What the file dialog offers. The media types alone are not enough: several
 * platforms map `.m4a` to `audio/x-m4a`, which greys an Author's own AAC files
 * out of their own dialog — in a product that ships thirty of them. Naming the
 * extensions beside the types loosens nothing, because what a Sound is is read
 * off its first bytes by the server and never off this list.
 */
const SOUND_ACCEPT = [...SOUND_TYPES, '.m4a', '.mp3', '.aac'].join(',')

/**
 * What each Scene's picker is standing on, a Scene at a time: the document holds
 * forty of these and one string between them would put what was chosen at the
 * foot of one Scene into all of them. A Scene that goes takes its entry with it,
 * the way the field a way on is named into does.
 */
const picked = reactive<Record<string, string>>({})

watch(() => story.scenes, (scenes) => {
  const standing = new Set([
    ...scenes.map(scene => scene.id),
    ...scenes.flatMap(scene => scene.shots.map(shot => shot.id)),
  ])
  for (const id of Object.keys(picked)) {
    if (!standing.has(id)) delete picked[id]
  }
  // Seeded as well as pruned. `v-model` on a `<select>` whose value matches no
  // option leaves `selectedIndex` at -1, which draws the field blank and puts
  // the placeholder out of reach; the empty string is the placeholder's own
  // value, so standing on it is standing on *No Sound*.
  for (const id of standing) picked[id] ??= ''
}, { immediate: true })

/** Where what has been chosen is served: a Scene of this Story, or a file of the library. */
function chosenSound(chosen: string | undefined) {
  if (!chosen) return
  const [where, named] = [chosen.slice(0, chosen.indexOf(':')), chosen.slice(chosen.indexOf(':') + 1)]

  return where === 'scene' ? sceneSoundUrl(named) : libraryUrl(named)
}

/**
 * Hears what has been chosen before it is taken. One element for the whole
 * document: an Author listens to one thing at a time, and a second press stops
 * the first — which is what the hand means by it.
 */
const listening = useTemplateRef<HTMLAudioElement>('listening')

function listen(chosen: string | undefined) {
  const sound = chosenSound(chosen)
  if (!sound || !listening.value) return

  listening.value.src = sound
  return listening.value.play()
}

/**
 * The file an input's `change` carried, taken off it the way an image's own
 * deposit does — and the picker cleared, so choosing the very file already
 * there fires a second `change`. Read before `changing` is asked for one, so
 * a dialog closed with nothing chosen claims no Scene and reaches no server.
 */
function depositedFile(event: Event) {
  const picker = event.target as HTMLInputElement
  const file = picker.files?.[0]
  if (file) picker.value = ''
  return file
}

/**
 * The two gestures every carrier of a Sound shares, addressed by the URL its
 * own endpoint answers to: a file sent as the whole request body the way an
 * image's is, or a file of the library fetched and replayed through the
 * same PUT — the same validation, the same sniffing, the same cap, and no
 * server path of its own. A Scene and a Shot differ in everything around
 * this (naming, confirmation, a loop), never in the PUT itself, so it is
 * written once here rather than copied per carrier.
 */
function depositSoundAt(url: string, file: File) {
  return send(url, { method: 'PUT', body: file })
}

async function takeLibrarySoundAt(url: string, file: string) {
  const blob = await (await fetch(libraryUrl(file))).blob()
  await send(url, { method: 'PUT', body: blob })
}

/**
 * Takes the Sound chosen: a Scene of the Story is named, or a file of the
 * library is taken (see `takeLibrarySoundAt`). The bytes are copied into the
 * row at the moment of the pick, so a published Story depends on no file the
 * product might later withdraw.
 */
function takeSound(scene: Scene, chosen: string | undefined) {
  if (!chosen) return
  const named = chosen.startsWith('scene:') && chosen.slice('scene:'.length)

  return changing(scene, async () => {
    if (named) {
      await send(`/api/scenes/${scene.id}`, {
        method: 'PATCH',
        body: { soundOfSceneId: named },
      })
      return
    }

    await takeLibrarySoundAt(`/api/scenes/${scene.id}/sound`, chosen.slice('library:'.length))
  })
}

/** A Sound uploaded onto a Scene: see `depositedFile` and `depositSoundAt`. */
function depositSound(scene: Scene, event: Event) {
  const file = depositedFile(event)
  if (!file) return

  return changing(scene, () => depositSoundAt(`/api/scenes/${scene.id}/sound`, file))
}

/**
 * Takes the Scene's Sound away. It asks first where other Scenes are heard under
 * it, because it costs them exactly what deleting this Scene would — see
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`, and
 * `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` for why no Remark can
 * say it afterwards.
 *
 * This is also the only way to change a Scene's bed: the controls that deposit
 * one are behind the Sound being absent, so replacing means removing first, and
 * on a carrier twelve Scenes name that is a question about twelve Scenes falling
 * silent. They fall silent for exactly as long as the row carries no bytes: the
 * DELETE clears this Scene's own columns and never the `sound_of_scene_id` of
 * the Scenes naming it — only deleting the row itself does that, which is the
 * `on delete set null` — so all twelve are heard again the moment the new bytes
 * land. The confirmation says the cost and not the return.
 */
async function removeSound(held: SceneInDocument) {
  if (held.namedBy) {
    // A count rather than a suffix on a noun, because a plural is not a letter
    // added in every language the interface is read in — the rule `countedShots`
    // is written under.
    const asked = { name: nameOf(held.scene.id), count: held.namedBy }
    const question = t(
      held.namedBy === 1 ? 'editor.confirmRemoveSoundOne' : 'editor.confirmRemoveSoundMany',
      asked,
    )
    if (!await ask(question, t('editor.removeSound'))) return
  }

  return changing(held.scene, () =>
    send(`/api/scenes/${held.scene.id}/sound`, { method: 'DELETE' }))
}

/** What the Sound makes heard, and whether it is held in a loop: a typed write apiece. */
function writeTranscript(scene: Scene) {
  return writing(scene, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { transcript: scene.transcript },
  }))
}

function writeSoundLoops(scene: Scene, answer: string) {
  scene.soundLoops = answer === 'loop'

  return writing(scene, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { soundLoops: scene.soundLoops },
  }))
}

/**
 * The same three gestures on a beat: a file of the Author's own or one off
 * the library (see `depositedFile`, `depositSoundAt` and
 * `takeLibrarySoundAt`), and taking it away. There is no naming here and no
 * loop — a Shot's Sound strikes with the beat and is gone, and a struck
 * sound weighs 20 KB, which is not worth a column and a `<select>` to save.
 * See `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`.
 */
function depositShotSound(scene: Scene, shot: Shot, event: Event) {
  const file = depositedFile(event)
  if (!file) return

  return changing(scene, () => depositSoundAt(`/api/shots/${shot.id}/sound`, file))
}

function takeShotSound(scene: Scene, shot: Shot, chosen: string | undefined) {
  if (!chosen?.startsWith('library:')) return

  return changing(scene, () =>
    takeLibrarySoundAt(`/api/shots/${shot.id}/sound`, chosen.slice('library:'.length)))
}

/** No confirmation: a beat's Sound is a beat's, and nothing else is heard under it. */
function removeShotSound(scene: Scene, shot: Shot) {
  return changing(scene, () => send(`/api/shots/${shot.id}/sound`, { method: 'DELETE' }))
}

/**
 * How a cut is made, read off the two columns that say it. Nought over is a hard
 * cut and there is no third value to read: under a duration of nought there is
 * nothing for `cutThrough` to be true of, so the panel offers one answer of three
 * where the columns hold two facts, and neither can disagree with the other. A
 * Shot alone may say nothing at all, which is the null both of its columns hold
 * and which reads here as *as the Scene says*. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 */
function cutKind(carrier: { cutOver: number | null, cutThrough: CutThrough | null }) {
  if (carrier.cutOver === null) return 'scene'

  return carrier.cutOver === 0 ? 'hard' : carrier.cutThrough ?? 'image'
}

/**
 * When a Shot leaves the screen, in the three answers its one column holds: as
 * its Scene says, at the press, or after a time of its own. A Scene has two of
 * them — it is what a Shot falls back on, so it has nothing to fall back on
 * itself — and its null is the press rather than a deferral.
 */
function cutWhen(shot: Shot) {
  if (shot.cutAfter === null) return 'scene'

  return shot.cutAfter === 0 ? 'press' : 'clock'
}

/** How long the ways on stand: until one is taken, for a time, or not at all. */
function exitsOffered(scene: Scene) {
  if (scene.exitsAfter === null) return 'taken'

  return scene.exitsAfter === 0 ? 'none' : 'clock'
}

/**
 * What each answer about how a cut is made writes. *Hard* names no `cutThrough`
 * at all rather than naming a third value: the column is left where it was,
 * because under a duration of nought nothing is passed through — and a Scene's
 * and an Exit's own column would refuse the null a Shot is allowed to leave.
 *
 * The two durations are where the clock starts and not what it is: an Author
 * writes over either in the field beside the answer.
 */
type CutMade = 'hard' | 'image' | 'black'

const CUT_MADE: Record<CutMade, Partial<Pick<Exit, 'cutOver' | 'cutThrough'>>> = {
  hard: { cutOver: 0 },
  image: { cutOver: 800, cutThrough: 'image' },
  black: { cutOver: 1200, cutThrough: 'black' },
}

function cutMade(answer: string) {
  return CUT_MADE[answer as CutMade]
}

/**
 * Where a clock starts on the answer that asks for one: four seconds for a beat,
 * which is a Shot read rather than glanced at, and ten for the ways on, which are
 * read and then chosen between.
 */
const A_TIME_HELD = 4000
const A_TIME_OFFERED = 10_000

/**
 * A field of seconds read back as the milliseconds the column holds, and nothing
 * at all where it says no duration. Two things say none. A box left empty is an
 * Author in the middle of typing, and it is left as they left it. A nought is not
 * a duration either — a Shot standing for no time is a Shot nobody sees — and it
 * is the answer above the field rather than a value in it: *at the press*, *not at
 * all*, *hard*. Each of those is a sentence a `<select>` writes, and
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` says the sentinel
 * behind it is picked and never typed, so the field hands a typed nought straight
 * back and puts the time the row is still holding in its place. What is judged is
 * the millisecond the column would hold rather than the number in the box, so a
 * tenth of one is the nought it rounds to.
 *
 * A time past its cap is written and refused by its own phrase, because a refusal
 * says more than a field that silently kept what it had. A nought has no refusal
 * to be given, because the doors take it: it is what a Shot's `cutAfter` and a
 * Scene's `exitsAfter` and `cutOver` hold when the answer above says so, and no
 * door can tell one typed here from one picked there. A Scene's `cutAfter` is the
 * one nought closed at both ends, because its column cannot hold one at all: the
 * door at `readSceneChanges` refuses it with a phrase of its own.
 */
function secondsWritten(event: Event, stood: number | null) {
  const field = event.target as HTMLInputElement
  const written = Math.round(field.valueAsNumber * 1000)

  if (written) return written
  if (stood && !Number.isNaN(field.valueAsNumber)) field.value = String(stood / 1000)

  return undefined
}

/** A body one of those empty fields is in is a body with no change in it. */
function wholeCut(body: object) {
  return Object.values(body).every(held => held !== undefined)
}

/**
 * What a Scene, a Shot or an Exit says about its Cut. One function per carrier
 * rather than one clever one, because the three rows are three endpoints and the
 * panel reads better where each says which it writes. The value is put on the row
 * before the request leaves, the way every other typed write here does it, so the
 * document does not flicker back to the answer that was chosen against.
 */
function writeSceneCut(
  scene: Scene,
  body: Partial<Pick<Scene, 'cutAfter' | 'cutOver' | 'cutThrough' | 'exitsAfter'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(scene, body)

  return writing(scene, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

function writeShotCut(
  scene: Scene,
  shot: Shot,
  body: Partial<Pick<Shot, 'cutAfter' | 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

function writeExitCut(
  scene: Scene, exit: Exit, body: Partial<Pick<Exit, 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(exit, body)

  return writing(scene, () => send(`/api/exits/${exit.id}`, { method: 'PATCH', body }))
}

/** The three answers a Shot's own row gives, each written as the column holds it. */
function writeShotCutAfter(scene: Scene, shot: Shot, answer: string) {
  return writeShotCut(scene, shot, {
    cutAfter: answer === 'scene' ? null : answer === 'press' ? 0 : A_TIME_HELD,
  })
}

function writeShotCutMade(scene: Scene, shot: Shot, answer: string) {
  const said = answer === 'scene' ? { cutOver: null, cutThrough: null } : cutMade(answer)

  return writeShotCut(scene, shot, said)
}

/** And the three the Scene gives about how long it leaves its ways on standing. */
function writeExitsAfter(scene: Scene, answer: string) {
  return writeSceneCut(scene, {
    exitsAfter: answer === 'taken' ? null : answer === 'none' ? 0 : A_TIME_OFFERED,
  })
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
      from: nameOf(scene.id),
      to: nameOf(exit.toSceneId),
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
  let toSceneId = found?.id

  await changing(scene, async () => {
    toSceneId ??= (await send(`/api/stories/${story.id}/scenes`, {
      method: 'POST',
      body: { name },
    }) as Scene).id

    const written = await send(`/api/scenes/${scene.id}/exits`, {
      method: 'POST',
      body: { toSceneId },
    }) as Exit

    writtenId = written.id
  })

  if (!writtenId || !toSceneId) return
  // Past the read-back, as in `splitBefore`: a Scene written here under the words
  // the bench numbers another by — *The bar (2)* typed beside two called *The bar*
  // — renumbers the Scene it was named in, so both halves are read off the Story
  // that holds it.
  announce(t(found ? 'editor.exitDrawn' : 'editor.exitDrawnToNew', {
    from: nameOf(scene.id),
    to: nameOf(toSceneId),
  }))
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

/**
 * Whether a Reading crosses this Exit backwards. Three answers in one field —
 * the Exit's own yes, its own no, and the Story's, which is what an Exit answers
 * until the Author says otherwise — so the select reads and writes the null the
 * column holds rather than a pair of switches that could disagree. See
 * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
 */
function crossedBack(exit: Exit) {
  return exit.stepsBack === null ? 'story' : exit.stepsBack ? 'yes' : 'no'
}

function writeCrossedBack(scene: Scene, exit: Exit, answer: string) {
  exit.stepsBack = answer === 'story' ? null : answer === 'yes'

  return writing(scene, () => send(`/api/exits/${exit.id}`, {
    method: 'PATCH',
    body: { stepsBack: exit.stepsBack },
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
      :aria-label="$t('editor.writingScene', { name: held.name })"
      @keydown="walkScenes(held, $event)"
    >
      <!-- The name is the heading and the heading is written in: a bare field, the
           same idiom as a Shot's text, with no mode to enter first. -->
      <label class="visually-hidden" :for="`scene-name-${held.scene.id}`">
        {{ $t('editor.sceneName', { name: held.name }) }}
      </label>
      <!-- The slate: the name, whether the Story opens here, what arrives at it,
           and the two acts that write the Scene again or take it away. What arrives
           is said in words rather than left to the rail's marks, because the rail
           is `aria-hidden` and this is where the document says it. -->
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
            <span class="visually-hidden">{{ held.name }}</span>
          </span>
          <button
            v-else
            type="button"
            :data-command="held.here ? $t('editor.markOpeningScene') : undefined"
            @click="openOn(held.scene)"
          >
            {{ $t('editor.markOpeningScene') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </button>
        </p>

        <p class="arrivals">{{ held.arrivals }}</p>

        <button
          type="button"
          class="going"
          :data-command="held.here ? $t('editor.duplicateScene') : undefined"
          @click="duplicateScene(held.scene)"
        >
          {{ $t('editor.duplicateScene') }}
          <span class="visually-hidden">{{ held.name }}</span>
        </button>

        <button
          type="button"
          class="danger going"
          :data-command="held.here ? $t('editor.deleteScene') : undefined"
          @click="deleteScene(held)"
        >
          {{ $t('editor.deleteScene') }}
          <span class="visually-hidden">{{ held.name }}</span>
        </button>
      </div>

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
          :scene="held.name"
          :id="held.scene.id"
          :named="held.here"
          @write="writeFlags(held.scene, $event)"
        />
      </section>

      <!-- The Sound the Scene is heard under, at the head of its section beside
           the Flags, because both are what happens on entry: the bed is under the
           run before the first beat plays. A Scene heard under nothing spends a
           line on saying so, which is most Scenes. -->
      <section class="held heard">
        <h3>{{ $t('editor.soundHeld') }}</h3>

        <template v-if="held.heard">
          <!-- The browser's own transport: a Sound is listened to rather than
               looked at, and nothing the bench could draw beats the control every
               Author already knows. -->
          <audio
            class="transport"
            controls
            preload="none"
            :src="held.heard.sound"
            :aria-label="$t('editor.soundOfScene', { name: held.name })"
          />

          <!-- Where the Sound is the Scene's own, the two things said about it are
               written here; where it is another Scene's, they belong to that
               Scene's row and this says whose it is. -->
          <template v-if="held.heard.carrier === held.scene.id">
            <p class="transcribed">
              <label class="eyebrow" :for="`transcript-${held.scene.id}`">
                {{ $t('editor.transcript') }}
                <span class="visually-hidden">{{ held.name }}</span>
              </label>
              <input
                :id="`transcript-${held.scene.id}`"
                v-model="held.scene.transcript"
                type="text"
                :maxlength="SOUND_TRANSCRIPT_MAX_LENGTH"
                :placeholder="$t('editor.whatTheSoundMakesHeard')"
                @change="writeTranscript(held.scene)"
              >
            </p>

            <p class="holding">
              <label class="eyebrow" :for="`loop-${held.scene.id}`">
                {{ $t('editor.soundHolds') }}
                <span class="visually-hidden">{{ held.name }}</span>
              </label>
              <select
                :id="`loop-${held.scene.id}`"
                :value="held.scene.soundLoops ? 'loop' : 'once'"
                @change="writeSoundLoops(
                  held.scene, ($event.target as HTMLSelectElement).value)"
              >
                <option value="loop">{{ $t('editor.soundLooped') }}</option>
                <option value="once">{{ $t('editor.soundOnce') }}</option>
              </select>
            </p>
          </template>

          <p v-else class="eyebrow taken">
            {{ $t('editor.soundTakenFrom', { name: nameOf(held.heard.carrier) }) }}
          </p>

          <button
            type="button"
            class="danger going"
            :data-command="held.here ? $t('editor.removeSound') : undefined"
            @click="removeSound(held)"
          >
            {{ $t('editor.removeSound') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </button>
        </template>

        <template v-else>
          <p class="none">{{ $t('editor.noSoundYet') }}</p>

          <!-- Two ways in, and they are the same gesture twice: a file of the
               Author's own, or one this Story already carries or the library
               ships. One list rather than two, so naming and picking read alike. -->
          <label class="depositing">
            <span class="visually-hidden">
              {{ $t('editor.pickSoundOfScene', { name: held.name }) }}
            </span>
            <input
              type="file"
              :accept="SOUND_ACCEPT"
              @change="depositSound(held.scene, $event)"
            >
          </label>

          <p class="picking">
            <label class="visually-hidden" :for="`sound-${held.scene.id}`">
              {{ $t('editor.soundOfScene', { name: held.name }) }}
            </label>
            <select :id="`sound-${held.scene.id}`" v-model="picked[held.scene.id]">
              <option value="">{{ $t('editor.noSoundPicked') }}</option>
              <!-- Not on a Scene others are heard under: naming one from here
                   would be a second hop, which the API refuses — so the picker
                   withholds exactly what the server would not take. -->
              <optgroup
                v-if="!held.namedBy && carriers.some(carrier => carrier.id !== held.scene.id)"
                :label="$t('editor.soundsOfStory')"
              >
                <option
                  v-for="carrier in carriers.filter(carrier => carrier.id !== held.scene.id)"
                  :key="carrier.id"
                  :value="`scene:${carrier.id}`"
                >
                  {{ nameOf(carrier.id) }}
                </option>
              </optgroup>
              <optgroup :label="$t('editor.soundLibrary')">
                <option v-for="sound in SOUND_LIBRARY" :key="sound.file" :value="`library:${sound.file}`">
                  {{ sound.label[$i18n.locale as 'en' | 'fr'] ?? sound.label.en }}
                  · {{ $t('editor.soundSeconds', { count: sound.seconds }) }}
                </option>
              </optgroup>
            </select>

            <!-- Both act on what the `<select>` is standing on, so on nothing
                 they do nothing: disabled rather than pressable and inert, which
                 also keeps two dead stops per Scene out of the keyboard walk. -->
            <button
              type="button"
              class="mark"
              :disabled="!picked[held.scene.id]"
              @click="listen(picked[held.scene.id])"
            >
              {{ $t('editor.listenToSound') }}
              <span class="visually-hidden">{{ held.name }}</span>
            </button>
            <button
              type="button"
              :disabled="!picked[held.scene.id]"
              @click="takeSound(held.scene, picked[held.scene.id])"
            >
              {{ $t('editor.takeSound') }}
              <span class="visually-hidden">{{ held.name }}</span>
            </button>
          </p>
        </template>
      </section>

      <!-- How the Scene's run is cut: when a Shot leaves the screen, how it leaves
           it, and how long the ways on stand at the end. Under the Sound and above
           the run, because it is the last thing said about the whole Scene before
           its own beats begin — and a Shot may answer otherwise on its own row.

           Every answer is a `<select>` and never a number, so the noughts the
           columns hold — a Shot held until the press, ways on offered for no time
           at all — are sentences the Author reads rather than sentinels they have
           to know to type. That is also why none of these is marked for the bar of
           Commands: no press opens a `<select>`, which is the exemption `CONTEXT.md`
           writes into the Command entry. See
           `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`. -->
      <section class="held cut">
        <h3>{{ $t('editor.cutHeld') }}</h3>

        <p class="cutting">
          <label class="eyebrow" :for="`cut-after-${held.scene.id}`">
            {{ $t('editor.shotsAreCut') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </label>
          <select
            :id="`cut-after-${held.scene.id}`"
            :value="held.scene.cutAfter === null ? 'press' : 'clock'"
            @change="writeSceneCut(held.scene, {
              cutAfter: ($event.target as HTMLSelectElement).value === 'press'
                ? null
                : A_TIME_HELD,
            })"
          >
            <option value="press">{{ $t('editor.cutAtThePress') }}</option>
            <option value="clock">{{ $t('editor.cutAfterATime') }}</option>
          </select>
          <!-- The number is drawn only under the answer that asks for one: a field
               of seconds beside *at the press* would be a duration nobody wrote. -->
          <template v-if="held.scene.cutAfter !== null">
            <input
              type="number"
              inputmode="decimal"
              min="0.5"
              :max="CUT_AFTER_MAX / 1000"
              step="0.5"
              :value="held.scene.cutAfter / 1000"
              :aria-label="$t('editor.secondsAShotStands', { name: held.name })"
              @change="writeSceneCut(
                held.scene, { cutAfter: secondsWritten($event, held.scene.cutAfter) })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>

        <p class="cutting">
          <label class="eyebrow" :for="`cut-over-${held.scene.id}`">
            {{ $t('editor.cutIsMade') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </label>
          <select
            :id="`cut-over-${held.scene.id}`"
            :value="cutKind(held.scene)"
            @change="writeSceneCut(
              held.scene, cutMade(($event.target as HTMLSelectElement).value))"
          >
            <option value="hard">{{ $t('editor.cutHard') }}</option>
            <option value="image">{{ $t('editor.cutThroughImage') }}</option>
            <option value="black">{{ $t('editor.cutThroughBlack') }}</option>
          </select>
          <template v-if="held.scene.cutOver > 0">
            <input
              type="number"
              inputmode="decimal"
              min="0.1"
              :max="CUT_OVER_MAX / 1000"
              step="0.1"
              :value="held.scene.cutOver / 1000"
              :aria-label="$t('editor.secondsTheCutTakes', { name: held.name })"
              @change="writeSceneCut(
                held.scene, { cutOver: secondsWritten($event, held.scene.cutOver) })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>

        <p class="cutting">
          <label class="eyebrow" :for="`exits-after-${held.scene.id}`">
            {{ $t('editor.exitsAreOffered') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </label>
          <select
            :id="`exits-after-${held.scene.id}`"
            :value="exitsOffered(held.scene)"
            @change="writeExitsAfter(
              held.scene, ($event.target as HTMLSelectElement).value)"
          >
            <option value="taken">{{ $t('editor.exitsUntilTaken') }}</option>
            <option value="clock">{{ $t('editor.exitsForATime') }}</option>
            <option value="none">{{ $t('editor.exitsNotAtAll') }}</option>
          </select>
          <template v-if="held.scene.exitsAfter">
            <input
              type="number"
              inputmode="decimal"
              min="0.5"
              :max="EXITS_AFTER_MAX / 1000"
              step="0.5"
              :value="held.scene.exitsAfter / 1000"
              :aria-label="$t('editor.secondsTheExitsStand', { name: held.name })"
              @change="writeSceneCut(
                held.scene, { exitsAfter: secondsWritten($event, held.scene.exitsAfter) })"
            >
            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
          </template>
        </p>
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
          <!-- `handed`: every mark this beat is acted on by — its own four, the
               offer of a Condition, and the mark that strikes a Condition already
               written — is drawn at the weight of the words around it until the
               pointer arrives at the row or the caret lands in it. That last one
               is a change of its own: `#246` kept a written Condition's mark at
               full strength and dimmed only the offer to add one, on the reasoning
               that what an Author has already written is never faded. The rule
               `0043` writes is about rows rather than about what is written, and a
               Condition is a row, so it arrives with the hand like every other.
               `.handed` in `app/assets/css/frameline.css` is the rule, and it is
               declared there because a beat, a way on and a Flag's row all carry
               it. -->
          <li
            v-for="(shot, place) in held.scene.shots"
            :key="shot.id"
            class="handed"
            :data-shot="shot.id"
          >
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
                    scene: held.name,
                  })"
                >
                <input
                  type="file"
                  class="visually-hidden"
                  :accept="SHOT_IMAGE_TYPES.join(',')"
                  :aria-label="$t('editor.pickImageOfShot', {
                    place: place + 1,
                    scene: held.name,
                  })"
                  @change="attachImage(held.scene, shot, $event)"
                >
              </label>

              <label class="visually-hidden" :for="`shot-${shot.id}`">
                {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
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
                      scene: held.name,
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

              <!-- The other matter a beat carries: an Image on one side and a
                   Sound on the other, with the Transcript under the Sound as the
                   Description is under the Image. No loop and no naming — a
                   Shot's Sound strikes with the beat and is gone. -->
              <p class="struck">
                <template v-if="shot.sound">
                  <audio
                    class="transport"
                    controls
                    preload="none"
                    :src="shot.sound"
                    :aria-label="$t('editor.soundOfShot', { place: place + 1, scene: held.name })"
                  />
                  <button type="button" class="danger mark" @click="removeShotSound(held.scene, shot)">
                    <span aria-hidden="true">×</span>
                    <span class="visually-hidden">
                      {{ $t('editor.removeSound') }}
                      {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                    </span>
                  </button>
                </template>

                <template v-else>
                  <label class="visually-hidden" :for="`shot-sound-${shot.id}`">
                    {{ $t('editor.soundOfShot', { place: place + 1, scene: held.name }) }}
                  </label>
                  <select :id="`shot-sound-${shot.id}`" v-model="picked[shot.id]">
                    <option value="">{{ $t('editor.noSoundPicked') }}</option>
                    <option v-for="sound in SOUND_LIBRARY" :key="sound.file" :value="`library:${sound.file}`">
                      {{ sound.label[$i18n.locale as 'en' | 'fr'] ?? sound.label.en }}
                      · {{ $t('editor.soundSeconds', { count: sound.seconds }) }}
                    </option>
                  </select>
                  <!-- Inert on nothing, so disabled on nothing: see the Scene's
                       own pair above. -->
                  <button
                    type="button"
                    class="mark"
                    :disabled="!picked[shot.id]"
                    @click="listen(picked[shot.id])"
                  >
                    {{ $t('editor.listenToSound') }}
                    <span class="visually-hidden">
                      {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    :disabled="!picked[shot.id]"
                    @click="takeShotSound(held.scene, shot, picked[shot.id])"
                  >
                    {{ $t('editor.takeSound') }}
                    <span class="visually-hidden">
                      {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                    </span>
                  </button>
                  <label class="depositing">
                    <span class="visually-hidden">
                      {{ $t('editor.pickSoundOfShot', { place: place + 1, scene: held.name }) }}
                    </span>
                    <input
                      type="file"
                      :accept="SOUND_ACCEPT"
                      @change="depositShotSound(held.scene, shot, $event)"
                    >
                  </label>
                </template>
              </p>

              <p v-if="shot.sound" class="transcribed">
                <label class="eyebrow" :for="`shot-transcript-${shot.id}`">
                  {{ $t('editor.transcript') }}
                  <span class="visually-hidden">
                    {{ $t('editor.transcriptOfShot', { place: place + 1, scene: held.name }) }}
                  </span>
                </label>
                <input
                  :id="`shot-transcript-${shot.id}`"
                  v-model="shot.transcript"
                  type="text"
                  :maxlength="SOUND_TRANSCRIPT_MAX_LENGTH"
                  :placeholder="$t('editor.whatTheSoundMakesHeard')"
                  @change="writeShot(held.scene, shot)"
                >
              </p>

              <!-- What this beat says about its own Cut, where the Scene has said
                   it for the run: both answer *as the Scene says* until the Author
                   says otherwise, which is the null the columns hold. Drawn on
                   every beat rather than behind a gesture, because a run where one
                   Shot is held longer than the others is read by seeing the row
                   that differs. -->
              <div class="cut">
                <p class="cutting">
                  <label class="eyebrow" :for="`shot-cut-after-${shot.id}`">
                    {{ $t('editor.shotIsCut') }}
                    <span class="visually-hidden">
                      {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                    </span>
                  </label>
                  <select
                    :id="`shot-cut-after-${shot.id}`"
                    :value="cutWhen(shot)"
                    @change="writeShotCutAfter(
                      held.scene, shot, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="scene">{{ $t('editor.cutAsTheSceneSays') }}</option>
                    <option value="press">{{ $t('editor.cutAtThePress') }}</option>
                    <option value="clock">{{ $t('editor.cutAfterATime') }}</option>
                  </select>
                  <template v-if="shot.cutAfter">
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0.5"
                      :max="CUT_AFTER_MAX / 1000"
                      step="0.5"
                      :value="shot.cutAfter / 1000"
                      :aria-label="$t('editor.secondsThisShotStands', {
                        place: place + 1,
                        scene: held.name,
                      })"
                      @change="writeShotCut(held.scene, shot, {
                        cutAfter: secondsWritten($event, shot.cutAfter),
                      })"
                    >
                    <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                  </template>
                </p>

                <p class="cutting">
                  <label class="eyebrow" :for="`shot-cut-over-${shot.id}`">
                    {{ $t('editor.cutIsMade') }}
                    <span class="visually-hidden">
                      {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                    </span>
                  </label>
                  <select
                    :id="`shot-cut-over-${shot.id}`"
                    :value="cutKind(shot)"
                    @change="writeShotCutMade(
                      held.scene, shot, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="scene">{{ $t('editor.cutAsTheSceneSays') }}</option>
                    <option value="hard">{{ $t('editor.cutHard') }}</option>
                    <option value="image">{{ $t('editor.cutThroughImage') }}</option>
                    <option value="black">{{ $t('editor.cutThroughBlack') }}</option>
                  </select>
                  <template v-if="shot.cutOver">
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0.1"
                      :max="CUT_OVER_MAX / 1000"
                      step="0.1"
                      :value="shot.cutOver / 1000"
                      :aria-label="$t('editor.secondsTheShotsCutTakes', {
                        place: place + 1,
                        scene: held.name,
                      })"
                      @change="writeShotCut(held.scene, shot, {
                        cutOver: secondsWritten($event, shot.cutOver),
                      })"
                    >
                    <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                  </template>
                </p>
              </div>

              <div class="beneath">
                <Conditions
                  :data-step="held.here && !place ? 'shot-condition' : undefined"
                  :lead="$t('editor.playedWhen')"
                  :carrier="$t('editor.shotOfScene', {
                    place: place + 1,
                    scene: held.name,
                  })"
                  :conditions="shot.conditions"
                  :names="named"
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
                        scene: held.name,
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
                        scene: held.name,
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
                        scene: held.name,
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
                        scene: held.name,
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
             press Enter at the end of.

             `data-step` while the Scene has no beat, because that is exactly when
             the two Steps that ask for one have no row of their own to point at: a
             Scene arrives with no Shot in it. Drawn here or on the beat's own
             field, never both, so the Step that names the two of them in order
             finds one — see `app/utils/steps.ts` and
             `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. -->
        <p class="adds">
          <button
            type="button"
            :data-step="held.here && !held.scene.shots.length ? 'add-shot' : undefined"
            :data-command="held.here ? $t('editor.addShot') : undefined"
            @click="addShot(held.scene)"
          >
            {{ $t('editor.addShot') }}
            <span class="visually-hidden">
              {{ $t('editor.toScene', { name: held.name }) }}
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
          <!-- `handed` again, and it is the row it changes most: an Exit's marks
               used to take only their colour from a hover, where now the whole
               box arrives with the hand. -->
          <li v-for="(exit, place) in held.ways" :key="exit.id" class="handed" :data-way="exit.id">
            <span class="numbered">{{ place + 1 }}</span>

            <div class="written">
              <!-- Where the way on leads, in a field that says so, and beside it
                   the mark that goes there: the Scene at the far end is one press
                   away from the section that names it. -->
              <p class="arrival">
                <label class="visually-hidden" :for="`leads-${exit.id}`">
                  {{ $t('editor.wayOnLeadsTo', { place: place + 1, name: held.name }) }}
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
                    :names="named"
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
                      name: nameOf(exit.toSceneId),
                      place: place + 1,
                      scene: held.name,
                    }) }}
                  </span>
                </button>
              </p>

              <!-- The words the Reader reads on the button. -->
              <p class="said">
                <label class="visually-hidden" :for="`exit-${exit.id}`">
                  {{ $t('editor.wayOnSays', { place: place + 1, name: held.name }) }}
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
                    scene: nameOf(exit.toSceneId),
                    from: held.name,
                  })"
                  :conditions="exit.conditions"
                  :names="named"
                  :counting="held.scene.id"
                  :id="exit.id"
                  :named="held.here"
                  @write="writeConditions(held.scene, 'exits', exit.id, exit.conditions)"
                />

                <!-- Whether the Reader may come back through this Exit, beside
                     the tests it is offered under: both are what the Author says
                     about this way on and neither is what it says. Named for the
                     Exit it belongs to, because two Exits of one Scene leading to
                     one Scene would otherwise answer to the same words — see
                     issue #276. -->
                <p class="crossing">
                  <label class="eyebrow" :for="`back-${exit.id}`">
                    {{ $t('editor.steppingBack') }}
                    <span class="visually-hidden">
                      {{ $t('editor.theWayOnTo', {
                        place: place + 1,
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
                      }) }}
                    </span>
                  </label>
                  <select
                    :id="`back-${exit.id}`"
                    :value="crossedBack(exit)"
                    @change="writeCrossedBack(
                      held.scene,
                      exit,
                      ($event.target as HTMLSelectElement).value,
                    )"
                  >
                    <option value="story">{{ $t('editor.steppingBackAsStory') }}</option>
                    <option value="yes">{{ $t('editor.steppingBackOffered') }}</option>
                    <option value="no">{{ $t('editor.steppingBackRefused') }}</option>
                  </select>
                </p>

                <!-- How the passage out of the Scene is made, and never when: an
                     Exit is taken rather than held, so there is nothing here to
                     say how long it stands — the Scene says that of all of them
                     at once. It answers for itself with no Scene behind it, which
                     is why there is no *as the Scene says* among the three: see
                     `0050`. -->
                <p class="cutting">
                  <label class="eyebrow" :for="`exit-cut-over-${exit.id}`">
                    {{ $t('editor.cutIsMade') }}
                    <span class="visually-hidden">
                      {{ $t('editor.theWayOnTo', {
                        place: place + 1,
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
                      }) }}
                    </span>
                  </label>
                  <select
                    :id="`exit-cut-over-${exit.id}`"
                    :value="cutKind(exit)"
                    @change="writeExitCut(
                      held.scene, exit, cutMade(($event.target as HTMLSelectElement).value))"
                  >
                    <option value="hard">{{ $t('editor.cutHard') }}</option>
                    <option value="image">{{ $t('editor.cutThroughImage') }}</option>
                    <option value="black">{{ $t('editor.cutThroughBlack') }}</option>
                  </select>
                  <template v-if="exit.cutOver > 0">
                    <input
                      type="number"
                      inputmode="decimal"
                      min="0.1"
                      :max="CUT_OVER_MAX / 1000"
                      step="0.1"
                      :value="exit.cutOver / 1000"
                      :aria-label="$t('editor.secondsTheExitsCutTakes', {
                        place: place + 1,
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
                      })"
                      @change="writeExitCut(held.scene, exit, {
                        cutOver: secondsWritten($event, exit.cutOver),
                      })"
                    >
                    <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                  </template>
                </p>

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
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
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
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
                      }) }}
                    </span>
                  </button>
                  <!-- Named the way the three marks beside it are — the act, and
                       then the way on it is done to — rather than by a key of its
                       own that left the Place out. Two Exits of one Scene leading
                       to one Scene made two of these answer to the same words, and
                       the Place is the only thing that tells the rows apart: see
                       issue #276. -->
                  <button type="button" class="mark" @click="duplicateExit(held.scene, exit)">
                    <span aria-hidden="true">⧉</span>
                    <span class="visually-hidden">
                      {{ $t('common.duplicate') }}
                      {{ $t('editor.theWayOnTo', {
                        place: place + 1,
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
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
                        scene: nameOf(exit.toSceneId),
                        from: held.name,
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
            <span class="visually-hidden">{{ held.name }}</span>
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
            <Landing :scenes="story.scenes" :exits="story.exits" :from="held.scene.id" />
          </datalist>
        </form>
      </section>
    </section>

    <!-- What a chosen Sound is heard on before it is taken. One for the document:
         an Author listens to one thing at a time, and the second press stops the
         first. -->
    <audio ref="listening" class="visually-hidden" preload="none" />
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

/* The slate: the Scene's name, whether the Story opens on it, what arrives at it,
   and the acts that write it again or take it away — one line, and the only place
   on the bench where the condensed face a title card is set in appears at the size
   it is meant to be read at. The name is typed where it is read, so the field
   draws no box until the pointer is on it. */
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

/* Writing the Scene again and taking it away are both named in full — it is what
   the bar of Commands reads and what a screen reader hears — and worn as the quiet
   marks they should be: the acts at the far end of the slate, and only the one
   that takes something away wears the alarm's colour once the hand is on it. */
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

/* What the Scene is heard under, read along one line with its own heading the way
   the Flags are: a Scene heard under nothing spends a line on saying so. */
.held.heard {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
}

/* The browser's own transport, held to the width of a control rather than of the
   column: a Sound is listened to, and the row it sits on carries what is said
   about it as well. */
.transport {
  block-size: 2rem;
  inline-size: min(100%, 18rem);
}

.transcribed,
.holding,
.picking {
  display: flex;
  align-items: center;
  gap: var(--s2);
  min-inline-size: 0;
}

/* One thing said about a Cut, read as a sentence: the label, the answer, and the
   seconds where the answer asks for a number. It wraps rather than shrinks,
   because at the width of a phone a label of four words beside two fields is
   wider than the column and the alternative is a page that scrolls sideways. */
.cutting {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s2);
}

/* As wide as the longest answer it holds and no wider, so three of them under one
   heading are three sentences rather than three slots — and so the box does not
   change width as the answer in it changes. */
.cutting select {
  inline-size: auto;
  max-inline-size: 100%;
}

/* A field for a number of seconds, which is two digits and a decimal: sized to
   what is typed in it rather than to the row it stands on, and figured so that a
   column of them is read down as well as across. */
.cutting input {
  inline-size: 5rem;
  font-variant-numeric: tabular-nums;
}

/* The unit beside it, in the machine's own face. Not an `.eyebrow`, which would
   uppercase the symbol into an initial. */
.cutting .unit {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
}

/* On a beat and on a way on, the Cut is read at the size of the row it is
   written on: the Scene's own section is the only place it is read at the size of
   a section. */
.beat .cutting,
.written .cutting {
  font-size: 0.8125rem;
}

.transcribed input {
  flex: 1 1 14rem;
  min-inline-size: 0;
  padding: var(--s1) var(--s2);
  border-color: transparent;
  background: none;
  font-size: 0.8125rem;
}

.transcribed input:hover,
.transcribed input:focus-visible {
  border-color: var(--edge);
}

.picking select {
  max-inline-size: min(100%, 22rem);
}

.depositing input {
  font-size: 0.8125rem;
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

/* Struck across the row's full width rather than into the 8rem column the Image
   leaves behind once its span ends: without this, the grid's own sparse
   placement would carry both of these into the narrow column instead of under
   the words, the way `.beneath` already claims the row below them. */
.beat > .struck,
.beat > .transcribed,
.beat > .cut {
  grid-column: 1 / -1;
}

/* What the beat says about its own Cut: the two answers side by side while they
   fit, one under the other where they do not. Set further apart than anything
   else on the row, because each of the two is a label and its answer and the eye
   has to read where one sentence ends and the next starts. */
.beat > .cut {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s4);
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

/* What the beat strikes with, on the words' side of the row under the
   Description: the two matters a beat carries are read one under the other. */
.struck {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s2);
  min-inline-size: 0;
}

.struck select {
  max-inline-size: min(100%, 16rem);
  font-size: 0.8125rem;
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

/* Whether the Reader comes back this way: the label and the answer on one line,
   beside the tests the Exit is offered under rather than under them — two things
   the Author says about the same way on, read along the same edge. It gives way
   before the Conditions do at a narrow width, because the tests are read every
   day and this is answered once. */
.crossing {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--s2);
}

/* Two words on one line: the label is shorter than the answer beside it, and
   broken over two lines it reads as two labels. */
.crossing .eyebrow {
  white-space: nowrap;
}

/* The marks that act on one row, set closer than a row of controls anywhere else:
   three or four are one strip. */
.beneath .row,
.written .row {
  gap: var(--s1);
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
