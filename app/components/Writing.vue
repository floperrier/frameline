<script setup lang="ts">
/**
 * The writing: the whole Story as one document, from the Opening Scene to the
 * last, in the order `inDocumentOrder` reads it — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which is also where the
 * name comes from. It is not *script*, which that record refuses in as many words,
 * and not *text*, which is what a Shot carries beside its Image.
 *
 * A Scene is a heading, the Flags it sets on entry, the Sound it is heard
 * under, one line of how it plays that opens on what it chose from a list, the
 * run of its Shots, and the ways out of it named by where they lead. The next
 * Scene is under it. Nothing has to be opened and nothing
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
 * Image and its Conditions hang off: `Enter` cuts a beat in two where the caret
 * stands and opens the next at the end of one, `Backspace` at the head of a beat
 * joins it to the beat before (#432), and `Alt`
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
  story, sceneWritten, change, write, settled, ask, announce, imageOf,
} = defineProps<{
  /** The Story being written, whole. */
  story: StoryInEditor
  /** The Scene the caret is in, which carries the marks the bar and the path read. */
  sceneWritten?: string
  /** The one holder every write on this page goes through. */
  change: Change
  /** The same holder, for what the Author typed rather than what they clicked. */
  write: Write
  /** Once what the Author typed has all landed, which a cut and a join wait for. */
  settled: () => Promise<unknown>
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
 * be selected for typing over; `read` the Scene and the Shot of it the Preview is
 * to open standing on.
 */
const emit = defineEmits<{ attached: [string], open: [string, boolean?], read: [string, string] }>()

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

/**
 * An image landed on a Shot, said on to the page. Handed to every row rather than
 * heard from one, because a row says it after the upload and may be unmounted by
 * then, and Vue drops what an unmounted component emits; this document never is.
 */
function attached(shotId: string) {
  emit('attached', shotId)
}

/**
 * Whether the Story still holds the row a typed write is about.
 *
 * A field written in and then taken off the screen says so on its way out: the
 * browser fires one last `change` at a control whose value a hand has altered the
 * moment it loses the caret, and being removed from the document is one of the
 * ways it loses it. So a beat emptied and joined to the one before writes itself
 * once more, to a Shot the Story no longer has, and the bench is asking the server
 * for a row it has just taken away itself.
 *
 * What that costs is not the wasted request. The `404` comes back as a refusal
 * like any other — *No such Shot* said over the writing, about a beat that is
 * gone — and a refusal reads the whole Story back, which is the one read
 * `docs/adr/0008-refetch-is-for-a-refusal.md` allows to land on top of what is
 * being typed. By then the caret is in the beat before, and the read puts that
 * beat back as the server holds it, a keystroke and a newline short. Issue #325,
 * where it is a spec that lost the newline, and an Author who would lose it just
 * the same.
 *
 * Read off the Story the document is drawing now, and never off the row the
 * handler was rendered with: the field is removed by the very read that took the
 * row out of the Story, so what the handler closed over is the one reading that
 * still holds it.
 */
function stillWritten(id: string) {
  return story.scenes.some(
    scene => scene.id === id || scene.shots.some(shot => shot.id === id))
    || story.exits.some(exit => exit.id === id)
}

function writing(scene: Scene, written: string, act: () => Promise<unknown>) {
  if (!stillWritten(written)) return Promise.resolve()

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
  /**
   * The slim rows the Shots deleted from it on this page left, by where they
   * stand: those before each Shot of the run, and last those after its end.
   */
  gone: Gone[][]
  /**
   * What it is to Readers' Edition where it is not what they read: a Scene the
   * Edition does not have, or one it has in another form. Nothing on a Story with
   * no Edition, which is every unpublished one.
   */
  published?: 'editor.notYetPublished' | 'editor.changedSincePublished'
  /**
   * What each Exit leaving it says of how often Readers took it, by the Exit, and
   * how many Readings ended in it: both only while the Story is published, and
   * read by its Author and nobody else — see
   * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
   */
  taken: Record<string, string>
  ended: number
}

/**
 * A Shot deleted from this page, which leaves a slim row where it stood until it
 * is put back or the page is left: the Shot that stood before it, which the row is
 * anchored after, and the Place it had. Held in the page and nowhere else, so a
 * reload is the end of putting it back from the bench — see
 * `docs/adr/0064-a-deleted-shot-is-held-for-a-day.md`.
 */
type Gone = { id: string, sceneId: string, after: string | null, place: number }

const deleted = ref<Gone[]>([])

/**
 * Where each slim row of one Scene stands in its run, which `placeBack` reads as
 * the server does, so *Put It Back* lands where the row was drawn. Two rows that
 * stand at one Place stand in the order of the Places they had, and two that had
 * one Place in the order they were deleted, which is the order they stood in.
 */
function standingIn(scene: Scene) {
  const run = scene.shots.map(shot => shot.id)
  const standing = Array.from({ length: run.length + 1 }, (): Gone[] => [])
  const goneFrom = deleted.value.filter(gone => gone.sceneId === scene.id)

  for (const gone of goneFrom.sort((one, other) => one.place - other.place)) {
    standing[placeBack(run, gone.after, gone.place)]!.push(gone)
  }
  return standing
}

/**
 * What the bench calls each Scene, which is what every control naming one is named
 * by here. Two Scenes an Author called the same are numbered by `namesOnTheBench`
 * and by nothing in this file, so no reading of the document, and neither the rail
 * nor the Remarks beside them, can disagree about which *The bar* a control acts
 * on — see `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`. What
 * the Author typed is what the field below holds and what a write sends; the
 * number is drawn and never written.
 *
 * This and the two under it are read off the whole Story and handed to every row
 * of the document, and each is one Map or Set for the document's whole life,
 * laid over in place where what it holds changes — see `keep` in
 * `app/utils/sharing.ts`, which says exactly who is told of what. A row reads the
 * entries it draws and nothing else, so a keystroke into one way on's words draws
 * again that way on's row and the lists of Conditions that offer that Exit by its
 * words, and a keystroke into the Flag a Question is held under draws again that
 * Question and the lists of Conditions that offer the Flags, where a new Map would
 * have been handed to all three hundred rows.
 */
const named = reactive(new Map<string, string>())
watch(() => namesOnTheBench(story, t), next => keep(named, next), { immediate: true })

/** The Exits of the Story as the bench names them, which a Condition may ask about. */
const exits = reactive(new Map<string, ExitOnTheBench>())
watch(() => exitsOnTheBench(story, named), next => keep(exits, next), { immediate: true })

/** The Flags of the Story, set by a Scene or held by a Question, which a Condition's Flag field offers. */
const flags = reactive(new Set<string>())
watch(() => declaredIn(story), next => keep(flags, next), { immediate: true })

/**
 * The face the Story's words are set in and where their lines stand, which every
 * beat is drawn in. Handed to every row as well, and kept as the value it was
 * wherever it says the same — see `steady` in the same file — as the lists under
 * it are.
 */
const set = computed<ReturnType<typeof setIn>>(previous => steady(previous, setIn(story)))

/**
 * The fields of each Scene and of each Exit the lists of where a way on may land
 * read to say which Scenes they offer — see `app/components/Landing.vue` — and
 * nothing else of either: ids, and no name. So a beat written in a Scene, or a
 * Scene's name typed into, leaves this the object it was, and a way on's row
 * handed it is handed nothing new. What a list shows each Scene as is read from
 * a Map by its id, the entry alone.
 */
const landing = computed<{
  scenes: Pick<Scene, 'id'>[]
  exits: Pick<Exit, 'fromSceneId' | 'toSceneId'>[]
}>(previous => steady(previous, {
  scenes: story.scenes.map(({ id }) => ({ id })),
  exits: story.exits.map(({ fromSceneId, toSceneId }) => ({ fromSceneId, toSceneId })),
}))

/**
 * Each Scene's name as the Author typed it, which the list at the foot of a
 * Scene offers to be typed: a name typed there is the name the Scene is written
 * under, so it is not the bench's number. Kept like the names above it, so a
 * Scene's name typed into draws again only the lists that offer that Scene.
 */
const typed = reactive(new Map<string, string>())
watch(() => new Map(story.scenes.map(({ id, name }) => [id, name])), next => keep(typed, next),
  { immediate: true })

/** The name the bench gives one Scene, which is the map above read for it. */
function nameOf(sceneId: string) {
  return sceneNamed(named, sceneId, t)
}

const sections = computed<SceneInDocument[]>(() => {
  const arriving = new Map<string, number>()
  for (const exit of story.exits) {
    arriving.set(exit.toSceneId, (arriving.get(exit.toSceneId) ?? 0) + 1)
  }

  return inDocumentOrder(story.scenes, story.exits, story.openingSceneId).map((scene) => {
    const arrivals = arriving.get(scene.id) ?? 0
    const ways = exitsFrom(story.exits, scene.id)

    return {
      scene,
      name: nameOf(scene.id),
      opens: scene.id === story.openingSceneId,
      here: scene.id === sceneWritten,
      arrivals: countedArrivals(arrivals, t),
      unreached: !arrivals && scene.id !== story.openingSceneId,
      ways,
      counted: {
        flags: Object.keys(scene.sets).length,
        shots: scene.shots.length,
      },
      heard: heardUnder(story.scenes, scene.id),
      namedBy: story.scenes.filter(other => other.soundOfSceneId === scene.id).length,
      gone: standingIn(scene),
      published: story.changes?.added.includes(scene.id)
        ? 'editor.notYetPublished'
        : story.changes?.changed.includes(scene.id) ? 'editor.changedSincePublished' : undefined,
      taken: story.publishedAt ? takenFrom(ways) : {},
      ended: story.publishedAt ? story.readings.endedIn[scene.id] ?? 0 : 0,
    }
  })
})

/**
 * What each of one Scene's Exits says of how often Readers took it. The share is
 * out of every take of the Exits the Scene holds, so theirs add up to a hundred,
 * each rounded to a whole one.
 */
function takenFrom(ways: Exit[]) {
  const takes = ways.map(way => story.readings.taken[way.id] ?? 0)
  const all = takes.reduce((sum, count) => sum + count, 0)

  return Object.fromEntries(ways.map((way, place) => [way.id, takes[place]
    ? t('editor.takenTimes', { share: Math.round(100 * takes[place] / all) }, takes[place])
    : t('editor.notTakenYet')]))
}

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
  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
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
 *
 * Asked by the editor before it acts on a key — `Enter` with neither `Shift` nor
 * `Ctrl`/`Cmd`, `Backspace`, and `Alt` with an arrow — with whether the caret
 * stands at the head of the text, and answering whether the bench took it. A key
 * taken here goes no further: the Scene's own section hears keys too.
 *
 * `Enter` with words after the caret cuts the beat in two there, and `Backspace`
 * at the head of a beat holding words joins them back to the one before, as
 * paragraphs are cut and joined anywhere — issue #432,
 * `docs/adr/0071-a-shots-words-are-cut-where-the-caret-stands.md`.
 */
function typeOn(
  scene: Scene, name: string, shot: Shot, place: number, event: KeyboardEvent, atHead: boolean,
  halves?: [Formatted, Formatted],
) {
  const walked = scene.shots[place + (event.key === 'ArrowUp' ? -1 : 1)]
  const before = scene.shots[place - 1]

  // Struck again before the first has landed, it is taken and does nothing: it
  // would cut or join the words the first has not moved yet a second time.
  if (reshaping && (event.key === 'Enter' || (event.key === 'Backspace' && atHead))) { /* taken */ }
  else if (event.key === 'Enter' && halves) splitBeat(scene, shot, halves)
  else if (event.key === 'Enter') openBeat(scene, shot, place)
  else if (event.key === 'Backspace' && atHead && before) {
    const kept = emptied(shot) ? undefined : unjoined(shot, before)
    if (kept) announce(t(kept, { place: place + 1, scene: name, before: place }))
    else joinBeat(scene, shot, before)
  }
  else if (event.key.startsWith('Arrow') && walked) typeInShot(walked.id)
  else return false

  event.preventDefault()
  event.stopPropagation()
  return true
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
  return !shot.text && !shot.image && !shot.sound && !shot.conditions.length
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
    await send(`/api/shots/${shot.id}`, { method: 'PATCH', body: typedAbout(shot) })

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

/**
 * Enter with words after the caret: the beat is cut in two there, in one request
 * — the Shot keeps the words before and what is about its Image and its Sound, and
 * a new Shot right under it takes the words after and what is about them — and the
 * caret lands at the head of the words after.
 */
async function splitBeat(scene: Scene, shot: Shot, [before, after]: [Formatted, Formatted]) {
  let writtenId: string | undefined

  await reshaped(scene, async () => {
    writtenId = (await send(`/api/shots/${shot.id}/split`, { method: 'POST', body: { before, after } }) as Shot).id
  })

  if (writtenId) return typeInShot(writtenId, 0)
}

/** Whether a cut or a join is on its way: until it has landed, the words it moves are still where they were. */
let reshaping = false

/**
 * A cut or a join, sent once every typed write before it has landed — the beat
 * before's words written as it was left, a Description typed a moment ago —
 * because it rewrites words those would otherwise write back over it.
 */
async function reshaped(scene: Scene, act: () => Promise<unknown>) {
  reshaping = true
  try {
    return await changing(scene, async () => {
      await settled()
      await act()
    })
  }
  finally {
    reshaping = false
  }
}

/**
 * Why Backspace leaves a beat's words where they are rather than join them to the
 * beat before, or nothing where it may: joined, the beat goes, and what it carries
 * that is not its words would go with it — an Image, a Sound, or Conditions the
 * words would otherwise play under.
 */
function unjoined(shot: Shot, before: Shot) {
  return shot.image ? 'editor.notJoinedImage'
    : shot.sound ? 'editor.notJoinedSound'
    : same(shot.conditions, before.conditions) ? undefined : 'editor.notJoinedConditions'
}

/**
 * Backspace at the head of a beat: its words are joined onto the end of the one
 * before, which is written first so that a delete that fails leaves the words
 * twice rather than nowhere, and the beat goes — with no *Put It Back* row, as an
 * empty one goes. The caret lands where the two met, or at the end of the beat
 * before where there were no words to join; a join refused — words that would be
 * too long together — leaves it where it was, in the beat still standing.
 */
async function joinBeat(scene: Scene, shot: Shot, before: Shot) {
  const joined = emptied(shot) ? undefined : joinFormatted(before.formatted, shot.formatted)

  const went = await reshaped(scene, async () => {
    if (joined) await send(`/api/shots/${before.id}`, { method: 'PATCH', body: { formatted: joined.formatted } })
    await send(`/api/shots/${shot.id}`, { method: 'DELETE' })
  })
  if (went) return typeInShot(before.id, joined?.seam)
}

/**
 * Puts the caret in a Shot's field, once the read the change asks for has rendered
 * it. There is a field per beat of every Scene now, so the field is simply there
 * to be found: the gate that had to be moved to the beat first went with
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md`.
 *
 * The field is a box until the caret is in it, and a box focused mounts the
 * editor with the caret at the end — or with every word selected, where the words
 * are there to be typed over. The Shot asked for is never the one the editor is
 * on, which the caret is leaving.
 */
async function typeInShot(shotId: string, landing?: 'all' | number) {
  await nextTick()
  landsAt = landing === undefined ? undefined : { id: shotId, at: landing }
  document.getElementById(`shot-${shotId}`)?.focus()
}

/**
 * The one editor on the bench, on the Shot the caret is in — issue #359. Every
 * other Shot is its text drawn in a box carrying what the field carries, and a
 * press or a key in a box mounts the editor there, with the caret where the box
 * was pressed or at the end of the text where the focus came by key. It stays
 * until the caret enters another Shot's box, so turning to the Preview and back
 * finds it, and its selection, where it was left.
 */
const editing = ref<string>()
const at = ref<'end' | 'all' | number | { x: number, y: number }>('end')

/** Where the last box was pressed, which the focus that follows the press reads. */
let pressed: { id: string, x: number, y: number } | undefined

/**
 * Where the next focus of a Shot puts the caret, other than at the end: over
 * every word of a copy, written to be typed over, or at a place in the text — the
 * head of the words a cut took on, or where two beats were joined.
 */
let landsAt: { id: string, at: 'all' | number } | undefined

function press(shot: Shot, event: PointerEvent) {
  pressed = { id: shot.id, x: event.clientX, y: event.clientY }
}

/**
 * A box taking the focus mounts the editor in its place, in the same turn, so no
 * key struck after the press lands anywhere but in the editor. Where the editor's
 * chunk has not landed yet the box stays, focused and drawing the text, until it
 * has — rather than leaving an empty row and the caret on nothing — and a caret
 * that has left the box by then is not taken back.
 */
async function edit(shot: Shot, event: FocusEvent) {
  const pressedAt = pressed?.id === shot.id ? pressed : undefined
  const landing = landsAt?.id === shot.id ? landsAt.at : 'end'
  pressed = undefined
  landsAt = undefined

  if (!Formatting.value) {
    // A box that cannot become the editor says so rather than holding the focus
    // in silence, and becomes it at the next focus if it can.
    try {
      await editorChunk()
    }
    catch {
      return announce(t('error.refused'))
    }
    if (document.activeElement !== event.target) return
  }
  at.value = pressedAt ? { x: pressedAt.x, y: pressedAt.y } : landing
  editing.value = shot.id
}

/**
 * The editor itself, the bench's alone: the Reader's page never asks for it.
 * Fetched while the bench is idle, so the first box pressed has an editor to draw
 * at once — and drawn from the component the chunk resolved to rather than through
 * a lazy component, whose wrapper asks the browser for the module again at its
 * first mount and is answered a task later, with the box gone and a key free to
 * land on nothing.
 */
const Formatting = shallowRef<typeof import('~/components/Formatting.client.vue')['default']>()
let loading: Promise<void> | undefined
// Never asked for on the server, whose build leaves the editor out entirely.
const editorChunk = () => import.meta.server ? undefined : loading ??= import('~/components/Formatting.client.vue').then(
  ({ default: loaded }) => {
    Formatting.value = loaded
  },
  (error) => {
    // Asked again at the next press, so a fetch that failed once does not leave
    // every Shot unwritable until the page is reloaded.
    loading = undefined
    throw error
  },
)
// A fetch that fails while idle is left to the press, which asks again and says
// so if it fails too.
onNuxtReady(() => editorChunk()?.catch(() => {}))

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
 * Reads the Story from one beat: the Preview opens standing on it, as it arrives.
 * The mark takes the focus before the bench turns, because a browser that does not
 * focus a button it clicks would leave the bench no caret to put back on it when
 * the Author comes back to write — see `turnTo` on the page.
 */
function read(scene: Scene, shot: Shot, event: Event) {
  (event.currentTarget as HTMLElement).focus()
  emit('read', scene.id, shot.id)
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

/**
 * The Shot whose thumbnail, or the Scene whose run, a file is over, held by id: the
 * read that lands mid-drag replaces every Scene in the Story.
 */
const fileOver = ref<string>()

function overImage(shot: Shot, event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  fileOver.value = shot.id
}

/** Asked of the box and not what is inside it, or the mark flickers off under a hand that has not gone anywhere. */
function leaveFile(over: Shot | Scene, event: DragEvent) {
  const box = event.currentTarget as HTMLElement
  if (fileOver.value !== over.id) return

  if (!box.contains(event.relatedTarget as Node | null)) fileOver.value = undefined
}

/**
 * The Scene a handful of Images, or a text pasted, is being made into Shots in,
 * while it is. One handful at a time across the document, because the status line
 * saying how far it has got is one line: the adding controls of every Scene stand
 * disabled meanwhile, so no beat lands between two of the pictures, and a drop
 * arriving meanwhile is let go of.
 */
const filling = ref<string>()

/** The picker behind *Add Shots from Images*, found by id the way `typeInShot` finds a field. */
function pickImages(scene: Scene) {
  document.getElementById(`images-for-${scene.id}`)?.click()
}

/** Every file chosen, and the picker cleared as `depositedFile` clears it. */
function addPickedShots(scene: Scene, event: Event) {
  const picker = event.target as HTMLInputElement
  const files = [...picker.files ?? []]
  picker.value = ''

  return addShotsFrom(scene, files)
}

/**
 * A file over a Scene's run, which is the list of its Shots and the controls under
 * it. Files alone: a line of text dragged from one beat into another is the
 * browser's to carry. A thumbnail stops its own, so a file over one is that Shot's,
 * and the run stops these, or the page's refusal of a stray file would refuse
 * this one too.
 */
function overRun(scene: Scene, event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return

  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'copy'
  fileOver.value = scene.id
}

function dropOnRun(scene: Scene, event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return

  event.preventDefault()
  event.stopPropagation()
  fileOver.value = undefined
  return addShotsFrom(scene, [...event.dataTransfer.files])
}

/**
 * A handful of Images, picked or dropped on the run, as as many Shots at the end of
 * it: in the order of their names, less what a Shot cannot carry — see
 * `imagesForShots` — and one file after the other, because a new Shot's Place is
 * read and written in one statement and two of them in flight would race for it.
 *
 * Each file is developed before its Shot is made — see `developImage` — so one the
 * bench cannot develop makes no empty beat: it is left out, and said with the
 * files left out for their type once the handful is through.
 *
 * One change round the whole handful, so the Story is read back once, at the end,
 * and no read can land on the files still waiting. A file the server refuses —
 * bytes that are not what its type said — leaves its Shot a beat with no picture
 * yet, the files after it carry on, and the refusal is said once the last is
 * through, where a refused attach is said. A Shot the Scene refuses ends it there,
 * because the next would be refused too.
 */
async function addShotsFrom(scene: Scene, files: File[]) {
  if (filling.value || !files.length) return

  const { taken, leftOut } = imagesForShots(files)
  const undeveloped: { file: File, why: string }[] = []
  const name = nameOf(scene.id)
  const added: string[] = []

  if (taken.length) {
    filling.value = scene.id
    try {
      await changing(scene, async () => {
        let refused: unknown
        for (const [at, file] of taken.entries()) {
          announce(t('editor.addingShots', { name, at: at + 1, count: taken.length }))
          const developed = await developImage(file)
          if (typeof developed === 'string') {
            undeveloped.push({ file, why: developed })
            continue
          }

          const shot = await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot
          added.push(shot.id)
          await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: developed })
            .catch((error: unknown) => { refused = error })
        }
        if (refused) throw refused
      })
    }
    finally {
      filling.value = undefined
    }
  }

  const said = added.length === 1 ? 'editor.oneShotAdded' : added.length ? 'editor.shotsAdded' : 'editor.noShotAdded'
  announce([
    t(said, { name, count: added.length }),
    ...[...leftOut, ...undeveloped].map(({ file, why }) => t('editor.imageLeftOut', {
      file: file.name,
      why: t(why, { mb: SHOT_IMAGE_MAX_BYTES / 1024 / 1024 }),
    })),
  ].join(' '))

  if (added[0]) return typeInShot(added[0])
}

/**
 * The one field a text is pasted into under a Scene, while it is open — issue
 * #438, `docs/adr/0081-pasted-text-is-cut-at-its-empty-lines.md`. One for the
 * document, as the field a Shot is moved from is.
 */
const drafting = ref<{ sceneId: string, typed: string }>()

/**
 * What the text typed makes, read by `shotsOf` once for both the line under the
 * field and the request, so what the line says is what is made.
 */
const drafted = computed(() => {
  const made = shotsOf(drafting.value?.typed ?? '')
  const long = made.findIndex(shot => textOf(shot).length > SHOT_TEXT_MAX_LENGTH)
  const spoken = made.filter(shot => shot.content[0]!.type === 'speech').length
  const n = made.length

  const said = long !== -1 ? t('editor.textTooLong', { place: long + 1, max: SHOT_TEXT_MAX_LENGTH })
    : n > SHOTS_ADDED_MAX ? t('editor.textTooMany', { n, max: SHOTS_ADDED_MAX })
    : t('editor.textMakes', { n }, n) + (spoken ? t('editor.textSpoken', { m: spoken }, spoken) : '')
  return { made, said, ready: n > 0 && n <= SHOTS_ADDED_MAX && long === -1 }
})

/** The button opens the field under the run with the hand in it, or closes it and takes the hand back. */
async function toggleDrafting(scene: Scene) {
  if (drafting.value?.sceneId === scene.id) return stopDrafting(scene)

  drafting.value = { sceneId: scene.id, typed: '' }
  await nextTick()
  document.getElementById(`text-for-${scene.id}`)?.focus()
}

/**
 * Neither Esc nor *Close this Field* closes it while its text is being sent: the
 * field outlives the request, so a refusal leaves the Author what they typed.
 */
async function stopDrafting(scene: Scene) {
  if (filling.value === scene.id) return
  drafting.value = undefined
  await nextTick()
  document.getElementById(`from-text-${scene.id}`)?.focus()
}

/**
 * The text as the Shots it makes, at the end of the run in one request. The
 * bench stands busy meanwhile as it does over a handful of Images, and the field
 * stays open until the Shots are made, so a refusal costs the Author nothing they
 * typed. The caret then lands at the head of the first of them.
 */
async function addShotsFromText(held: SceneInDocument) {
  const { made, ready } = drafted.value
  if (drafting.value?.sceneId !== held.scene.id || filling.value || !ready) return

  let added: Shot[] = []
  filling.value = held.scene.id
  try {
    await changing(held.scene, async () => {
      added = await send(`/api/scenes/${held.scene.id}/shots`, {
        method: 'POST',
        body: { formatted: made },
      }) as Shot[]
    })
  }
  finally {
    filling.value = undefined
  }

  if (!added[0]) return
  drafting.value = undefined
  announce(t(added.length === 1 ? 'editor.oneShotAdded' : 'editor.shotsAdded', {
    name: held.name,
    count: added.length,
  }))
  return typeInShot(added[0].id, 0)
}

/**
 * The Sounds a Scene may be heard under: the ones this Story already carries, and
 * the library. One list rather than two, because naming a Sound the Story carries
 * and taking one off the shelf are the same gesture for the Author — and the list
 * offers carriers alone, which is the rule the API refuses the rest by.
 */
const carriers = computed(() => soundCarriers(story.scenes))

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

/**
 * The Scenes whose fold of how they play is wanted, which is when its answers are
 * drawn: closed, the browser draws none of them anyway, and a Story of forty
 * Scenes and three hundred beats would otherwise build three hundred and forty
 * folds of fields nobody opened — see
 * `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`. Wanted on the
 * press of its line, heard before the browser opens it, so the answers are drawn
 * in the same task and the fold never shows open and empty; on the `toggle` of a
 * fold opened from code, as `wind` in `app/components/Finding.vue` opens the fold
 * a found word stands in; and, as the document mounts, wherever the browser
 * opened one before the bench's script took over, its `toggle` heard by nobody.
 * Kept drawn after. The browser's find in the page opens none: a shut fold's
 * answers are not in the document, so there is nothing in it to find. A Shot's is
 * `app/components/ShotPlays.vue`, which wants its own the same way.
 */
const unfolded = reactive<Record<string, boolean>>({})

onMounted(() => {
  for (const fold of written.value?.querySelectorAll<HTMLElement>('.held.playing > details[open]') ?? []) {
    const scene = fold.closest<HTMLElement>('[data-scene]')?.dataset.scene
    if (scene) unfolded[scene] = true
  }
})

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
  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { transcript: scene.transcript },
  }))
}

function writeSoundLoops(scene: Scene, answer: string) {
  scene.soundLoops = answer === 'loop'

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { soundLoops: scene.soundLoops },
  }))
}

/**
 * What a Scene, a Shot or an Exit says about its Cut. One function per carrier
 * rather than one clever one — this one, `writeShotCut` in `ShotRow.vue` and
 * `writeExitCut` in `ExitRow.vue` — because the three rows are three endpoints and
 * the panel reads better where each says which it writes. The value is put on the row
 * before the request leaves, the way every other typed write here does it, so the
 * document does not flicker back to the answer that was chosen against.
 */
function writeSceneCut(
  scene: Scene,
  body: Partial<Pick<Scene, 'cutAfter' | 'cutOver' | 'cutThrough' | 'exitsAfter'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(scene, body)

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

/**
 * The Layout a Scene says for its run, and the one a Shot says for itself in
 * `ShotRow.vue`, where *as the Scene says* is the null the column holds. Written
 * the way the Cut is: on the row before the request leaves, so the document does
 * not flicker back to the answer that was chosen against.
 */
function writeSceneLayout(scene: Scene, layout: Layout) {
  scene.layout = layout

  return writing(scene, scene.id, () =>
    send(`/api/scenes/${scene.id}`, { method: 'PATCH', body: { layout } }))
}

/**
 * What a Scene or a Shot says about how its Images move, one function a carrier
 * as the Cut's are and for the same reason — the Shot's in `ShotRow.vue` — written on the row before the request
 * leaves. A Scene's body never holds a null and is typed as a Shot's all the same:
 * the door refuses what the column cannot hold.
 */
function writeSceneMovement(scene: Scene, body: MovementSaid) {
  if (!wholeCut(body)) return
  Object.assign(scene, body)

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

/** And what each answer writes, the Scene's here and the Shot's in `ShotRow.vue`. */
function writeSceneMoves(scene: Scene, answer: string) {
  return writeSceneMovement(scene, answer === 'still'
    ? { movementBy: 0 }
    : { movementDirection: answer as MovementDirection, movementBy: scene.movementBy || MOVEMENT_BY_START })
}

function writeSceneMovementTakes(scene: Scene, answer: string) {
  return writeSceneMovement(scene, { movementOver: answer === 'whole' ? 0 : MOVEMENT_OVER_UNTIMED })
}

/** The three answers the Scene gives about how long it leaves its ways on standing, each written as the column holds it. */
function writeExitsAfter(scene: Scene, answer: string) {
  return writeSceneCut(scene, {
    exitsAfter: answer === 'taken' ? null : answer === 'none' ? 0 : A_TIME_OFFERED,
  })
}

/**
 * What a Scene or a Shot says about how its texts arrive, one function a carrier as
 * the Cut's are and for the same reason — the Shot's in `ShotRow.vue`. A Scene's body never holds a null on the
 * first four and is typed as a Shot's all the same: the door refuses what the
 * column cannot hold.
 */
function writeSceneText(scene: Scene, body: TextSaid) {
  if (!wholeCut(body)) return
  Object.assign(scene, body)

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

/** And what each answer writes, the Scene's here and the Shot's in `ShotRow.vue`. */
function writeSceneTextArrives(scene: Scene, answer: string) {
  return writeSceneText(scene, answer === 'image'
    ? { textAfter: 0 }
    : faded(scene.textOver, { textAfter: A_TEXT_WAIT }))
}

function writeSceneTextComes(scene: Scene, answer: string) {
  const textBy = answer as TextBy

  return writeSceneText(scene, textBy === 'whole'
    ? { textBy }
    : faded(scene.textOver, { textBy }))
}

function writeSceneTextAppears(scene: Scene, answer: string) {
  return writeSceneText(scene, { textOver: answer === 'once' ? 0 : A_TEXT_FADE })
}

function writeSceneTextStays(scene: Scene, answer: string) {
  return writeSceneText(scene, { textStays: answer === 'cut' ? null : A_TEXT_STAY })
}

/**
 * A Shot goes at one press and is never asked about — see
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` — so it leaves a slim
 * row where it stood with the way back on it, and the focus moves there: a hand
 * that slipped is one press from undoing it, and the status line says what went.
 */
async function deleteShot(scene: Scene, name: string, shot: Shot, place: number) {
  const gone = {
    id: shot.id,
    sceneId: scene.id,
    after: scene.shots[place - 1]?.id ?? null,
    place,
  }

  if (!await changing(scene, () => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))) return

  deleted.value.push(gone)
  announce(t('editor.shotDeleted', { place: place + 1, scene: name }))
  await nextTick()
  document.getElementById(`back-${shot.id}`)?.focus()
}

/**
 * Puts a deleted Shot back where its slim row stands, carrying everything it
 * carried, and the caret in its words. The row goes as it is pressed, whatever
 * the answer: a refusal is said where every refusal is, and a Shot the server no
 * longer holds is not one a second press could bring back.
 */
async function putBack(scene: Scene, gone: Gone) {
  deleted.value = deleted.value.filter(held => held.id !== gone.id)
  let backId: string | undefined

  await changing(scene, async () => {
    const back = await send(`/api/shots/${gone.id}/back`, {
      method: 'POST',
      body: { after: gone.after },
    }) as Shot
    backId = back.id
  })

  if (backId) return typeInShot(backId)
}

/**
 * Writes the Shot again right under itself, carrying everything it carries, so
 * the same frame takes the next line: the caret lands in the copy's words with
 * all of them selected, and what is typed replaces them. Undone by the copy's own
 * ×, like any Shot.
 */
async function duplicateShot(scene: Scene, name: string, shot: Shot, place: number) {
  let copyId: string | undefined

  await changing(scene, async () => {
    // What is in the fields goes first, as before `Enter` opens a beat: the write
    // the editor's blur queued is not ordered with a click, and the copy is taken
    // of what the server holds.
    await send(`/api/shots/${shot.id}`, { method: 'PATCH', body: typedAbout(shot) })
    copyId = (await send(`/api/shots/${shot.id}/duplicate`, { method: 'POST' }) as Shot).id
  })

  if (!copyId) return
  announce(t('editor.shotDuplicated', { place: place + 1, scene: name, next: place + 2 }))
  return typeInShot(copyId, 'all')
}

/**
 * The one field a Shot is moved to another Scene from, while it is open: the Shot
 * it moves, what is typed into it, and the sentence it was last refused with. One
 * for the document, so the mark that opens it on one row closes it on the last.
 */
const moving = ref<{ shotId: string, typed: string, refused?: string }>()

/** The mark opens the field under its row with the hand in it, or closes it and takes the hand back. */
async function toggleMoving(shot: Shot) {
  if (moving.value?.shotId === shot.id) return stopMoving(shot)

  moving.value = { shotId: shot.id, typed: '' }
  await nextTick()
  document.getElementById(`moving-${shot.id}`)?.focus()
}

async function stopMoving(shot: Shot) {
  moving.value = undefined
  await nextTick()
  document.getElementById(`move-${shot.id}`)?.focus()
}

/**
 * Moves a Shot to the Scene named, which `sceneToMoveTo` reads off the bench's own
 * names. What it refuses is said under the field and sent nowhere. The Shot lands
 * last in that Scene's run, the status line says where, and the caret follows it.
 *
 * Reached by `change` and by `submit` both, as `addExit` is, and the field closes
 * before anything waits, so whichever fires second finds it closed — and so does
 * the `change` a field removed by `Esc` fires on its way out.
 */
async function moveToScene(scene: Scene, name: string, shot: Shot, place: number) {
  const open = moving.value
  if (open?.shotId !== shot.id || !open.typed.trim()) return

  const chosen = sceneToMoveTo(named, scene.id, open.typed)
  if (chosen.refused) {
    open.refused = t(chosen.refused, { scene: name })
    return
  }

  moving.value = undefined
  const left = { from: place + 1, name }
  let landed: number | undefined

  await changing(scene, async () => {
    landed = (await send(`/api/shots/${shot.id}/move`, {
      method: 'POST',
      body: { toSceneId: chosen.sceneId },
    }) as { position: number }).position
  })

  if (landed === undefined) return
  announce(t('editor.shotMoved', { ...left, scene: nameOf(chosen.sceneId), place: landed + 1 }))
  return typeInShot(shot.id)
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
 *
 * The slim rows deleted Shots left go with their Scene the same way: the server
 * let go of those Shots with it, so there is nowhere left to put them back.
 */
const adding = reactive<Record<string, string>>({})

watch(() => story.scenes, (scenes) => {
  const standing = new Set(scenes.map(scene => scene.id))
  for (const id of Object.keys(adding)) {
    if (!standing.has(id)) delete adding[id]
  }
  if (deleted.value.some(gone => !standing.has(gone.sceneId))) {
    deleted.value = deleted.value.filter(gone => standing.has(gone.sceneId))
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

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}/flags`, {
    method: 'PUT',
    body: { sets },
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
          <span v-if="held.published" class="eyebrow published-mark">{{ $t(held.published) }}</span>
          <span v-if="held.ended" class="eyebrow read-mark">{{ $t('editor.endedHere', held.ended) }}</span>
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
           run before the first beat plays. Only while there is one, its own or
           another Scene's: a Sound is something the Author put there, with a
           Transcript a Reader who cannot hear depends on, so it stands open by
           `0061`'s rule. A Scene heard under nothing has its picker in the fold
           under this, because a choice from a list folds. -->
      <section v-if="held.heard" class="held heard">
        <h3>{{ $t('editor.soundHeld') }}</h3>

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
      </section>

      <!-- How the Scene plays: every answer its head chooses from a list, folded
           under one line that says them — `scenePlaysAs`, and
           `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`, whose
           rule #400 carried from a Shot's row to the Scene's head. Read along one
           line with its heading the way the Flags are, and dropped under it once
           open. No `open` is bound, so the state is the browser's own and is kept
           while the section is, which is as long as the Scene's id is. Its answers
           are drawn once it is wanted, before it shows open, and stay drawn after,
           as a Shot's are — see `unfolded`.

           Every answer is a `<select>` and never a number, so the noughts the
           columns hold — a Shot held until the press, Exits offered for no time
           at all — are sentences the Author reads rather than sentinels they have
           to know to type. That is also why none of these is marked for the bar of
           Commands: no press opens a `<select>`, which is the exemption `CONTEXT.md`
           writes into the Command entry, and a control in a shut fold is not one
           the bar finds. -->
      <section class="held playing">
        <h3>{{ $t('editor.howThisScenePlays') }}</h3>

        <details class="plays" @toggle="unfolded[held.scene.id] = true">
          <summary @click="unfolded[held.scene.id] = true">
            {{ scenePlaysAs(held.scene, t) }}
            <span class="visually-hidden">{{ held.name }}</span>
          </summary>

          <div v-if="unfolded[held.scene.id]" class="answers">
            <!-- Two ways in, and they are the same gesture twice: a file of the
                 Author's own, or one this Story already carries or the library
                 ships. One list rather than two, so naming and picking read alike. -->
            <div v-if="!held.heard" class="heard">
              <p class="none">{{ $t('editor.noSoundYet') }}</p>

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
            </div>

            <!-- How the Scene's run is cut: when a Shot leaves the screen, how it
                 leaves it, and how long the Exits stand at the end — and a Shot may
                 answer otherwise on its own row. See
                 `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`. -->
            <div class="cut">
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
                <!-- The number is drawn only under the answer that asks for one: a
                     field of seconds beside *at the press* would be a duration
                     nobody wrote. -->
                <template v-if="held.scene.cutAfter !== null">
                  <input
                    type="number"
                    inputmode="decimal"
                    :min="CUT_AFTER_MIN / 1000"
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
                    :min="EXITS_AFTER_MIN / 1000"
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
            </div>

            <!-- How the Scene's texts arrive: after how long, by what unit and at
                 what pace, over how long each part appears, and for how long the
                 text stays — and a Shot may answer otherwise on its own row. Drawn
                 plainly, because the fold it stands in is already one. See
                 `docs/adr/0052-a-text-arrives-in-its-own-time.md`. -->
            <div class="cut">
              <p class="cutting">
                <label class="eyebrow" :for="`text-after-${held.scene.id}`">
                  {{ $t('editor.theTextArrives') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`text-after-${held.scene.id}`"
                  :value="textArrivesKind(held.scene)"
                  @change="writeSceneTextArrives(
                    held.scene, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="image">{{ $t('editor.textWithTheImage') }}</option>
                  <option value="time">{{ $t('editor.textAfterATime') }}</option>
                </select>
                <template v-if="held.scene.textAfter > 0">
                  <input
                    type="number"
                    inputmode="decimal"
                    min="0.1"
                    :max="TEXT_AFTER_MAX / 1000"
                    step="0.1"
                    :value="held.scene.textAfter / 1000"
                    :aria-label="$t('editor.secondsBeforeTheText', { name: held.name })"
                    @change="writeSceneText(
                      held.scene, { textAfter: secondsWritten($event, held.scene.textAfter) })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                </template>
              </p>

              <p class="cutting">
                <label class="eyebrow" :for="`text-by-${held.scene.id}`">
                  {{ $t('editor.textComes') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`text-by-${held.scene.id}`"
                  :value="held.scene.textBy"
                  @change="writeSceneTextComes(
                    held.scene, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="whole">{{ $t('editor.textWhole') }}</option>
                  <option value="line">{{ $t('editor.textByLine') }}</option>
                  <option value="word">{{ $t('editor.textByWord') }}</option>
                  <option value="letter">{{ $t('editor.textByLetter') }}</option>
                </select>
                <template v-if="held.scene.textBy !== 'whole'">
                  <input
                    type="number"
                    inputmode="decimal"
                    min="1"
                    :max="TEXT_PACE_MAX"
                    step="1"
                    :value="held.scene.textPace"
                    :aria-label="$t('editor.paceOfTheText', { name: held.name })"
                    @change="writeSceneText(held.scene, { textPace: paceWritten($event) })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.charactersUnit') }}</span>
                </template>
              </p>

              <p class="cutting">
                <label class="eyebrow" :for="`text-over-${held.scene.id}`">
                  {{ $t('editor.textAppears') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`text-over-${held.scene.id}`"
                  :value="textAppearsKind(held.scene)"
                  @change="writeSceneTextAppears(
                    held.scene, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="once">{{ $t('editor.textAtOnce') }}</option>
                  <option value="time">{{ $t('editor.textOverATime') }}</option>
                </select>
                <template v-if="held.scene.textOver > 0">
                  <input
                    type="number"
                    inputmode="decimal"
                    min="0.1"
                    :max="TEXT_OVER_MAX / 1000"
                    step="0.1"
                    :value="held.scene.textOver / 1000"
                    :aria-label="$t('editor.secondsTheTextAppears', { name: held.name })"
                    @change="writeSceneText(
                      held.scene, { textOver: secondsWritten($event, held.scene.textOver) })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                </template>
              </p>

              <p class="cutting">
                <label class="eyebrow" :for="`text-stays-${held.scene.id}`">
                  {{ $t('editor.textStays') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`text-stays-${held.scene.id}`"
                  :value="held.scene.textStays === null ? 'cut' : 'time'"
                  @change="writeSceneTextStays(
                    held.scene, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="cut">{{ $t('editor.textUntilTheCut') }}</option>
                  <option value="time">{{ $t('editor.textForATime') }}</option>
                </select>
                <template v-if="held.scene.textStays !== null">
                  <input
                    type="number"
                    inputmode="decimal"
                    min="0.5"
                    :max="TEXT_STAYS_MAX / 1000"
                    step="0.5"
                    :value="held.scene.textStays / 1000"
                    :aria-label="$t('editor.secondsTheTextStays', { name: held.name })"
                    @change="writeSceneText(
                      held.scene, { textStays: secondsWritten($event, held.scene.textStays) })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                </template>
              </p>
            </div>

            <!-- How the Scene's Shots are laid out: the Image above the text, or the
                 Image across the whole screen with the text over it — and a Shot may
                 answer otherwise on its own row. -->
            <div class="laid">
              <p class="cutting">
                <label class="eyebrow" :for="`layout-${held.scene.id}`">
                  {{ $t('editor.shotsAreLaidOut') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`layout-${held.scene.id}`"
                  :value="held.scene.layout"
                  @change="writeSceneLayout(
                    held.scene, ($event.target as HTMLSelectElement).value as Layout)"
                >
                  <option v-for="layout in LAYOUTS" :key="layout" :value="layout">
                    {{ $t(`editor.layout${layout === 'full' ? 'Full' : 'Inset'}`) }}
                  </option>
                </select>
              </p>
            </div>

            <!-- How the Scene's Images move while their Shots are on screen, and for
                 how long: inside the frame the Layout gives, and a Shot may answer
                 otherwise on its own row. -->
            <div class="moved">
              <p class="cutting">
                <label class="eyebrow" :for="`movement-${held.scene.id}`">
                  {{ $t('editor.imagesMove') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`movement-${held.scene.id}`"
                  :value="movementKind(held.scene)"
                  @change="writeSceneMoves(held.scene, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="still">{{ $t('editor.movementStill') }}</option>
                  <option v-for="direction in MOVEMENT_DIRECTIONS" :key="direction" :value="direction">
                    {{ $t(`editor.movement${direction[0]!.toUpperCase()}${direction.slice(1)}`) }}
                  </option>
                </select>
                <template v-if="held.scene.movementBy > 0">
                  <input
                    type="number"
                    inputmode="numeric"
                    min="1"
                    :max="MOVEMENT_BY_MAX"
                    step="1"
                    :value="held.scene.movementBy"
                    :aria-label="$t('editor.percentTheImagesMove', { name: held.name })"
                    @change="writeSceneMovement(
                      held.scene, { movementBy: percentWritten($event, held.scene.movementBy) })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.percentUnit') }}</span>
                </template>
              </p>

              <p v-if="held.scene.movementBy > 0" class="cutting">
                <label class="eyebrow" :for="`movement-over-${held.scene.id}`">
                  {{ $t('editor.movementTakes') }}
                  <span class="visually-hidden">{{ held.name }}</span>
                </label>
                <select
                  :id="`movement-over-${held.scene.id}`"
                  :value="held.scene.movementOver === 0 ? 'whole' : 'time'"
                  @change="writeSceneMovementTakes(
                    held.scene, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="whole">{{ $t('editor.movementWholeTime') }}</option>
                  <option value="time">{{ $t('editor.movementATime') }}</option>
                </select>
                <template v-if="held.scene.movementOver > 0">
                  <input
                    type="number"
                    inputmode="decimal"
                    min="0.1"
                    :max="MOVEMENT_OVER_MAX / 1000"
                    step="0.1"
                    :value="held.scene.movementOver / 1000"
                    :aria-label="$t('editor.secondsTheMovementTakes', { name: held.name })"
                    @change="writeSceneMovement(
                      held.scene, { movementOver: secondsWritten($event, held.scene.movementOver) })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                </template>
              </p>
            </div>
          </div>
        </details>
      </section>

      <!-- The run: one row a beat, its Place in the margin, the thumbnail and the
           words side by side, the Description under them where there is an Image to
           describe, and what the beat plays under sharing its last line with the
           marks that move and take it away — `0033`'s row, over the whole Story.
           Counted twice: in Shots, which is the count the bench gives of the whole
           Story beside the document, and in words, which is what a writer asks.
           A handful of Images let go of anywhere on it but a thumbnail becomes as
           many Shots at its end — see `addShotsFrom`. -->
      <section
        class="held run"
        :class="{ over: fileOver === held.scene.id }"
        @dragenter="overRun(held.scene, $event)"
        @dragover="overRun(held.scene, $event)"
        @dragleave="leaveFile(held.scene, $event)"
        @drop="dropOnRun(held.scene, $event)"
      >
        <h3>
          {{ $t('editor.shotsHeld') }}
          <span class="counted">{{ held.counted.shots }}</span>
          <!-- Its own component so that the one number here that changes on every
               keystroke does not make every keystroke the document's business —
               see `app/components/Words.vue`. -->
          <Words class="counted words" :shots="held.scene.shots" />
        </h3>

        <p v-if="!held.scene.shots.length && !held.gone[0]?.length" class="none">
          {{ $t('editor.noShotYet') }}
        </p>

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
               it.

               The run is walked one Place past its end, so the slim rows a
               deleted Shot leaves are drawn before the Shot they stand before and
               the last of them after the last Shot, with one template between
               the two — see `deleted`.

               A beat's own row is `app/components/ShotRow.vue`, handed its Shot
               and otherwise only what an act on another beat leaves as it was, and
               told its acts on what the document holds for every row by events. -->
          <template v-for="(shot, place) in [...held.scene.shots, undefined]" :key="shot?.id ?? 'end'">
            <li v-for="gone in held.gone[place]" :key="`gone-${gone.id}`" class="gone">
              <p>
                {{ $t('editor.shotDeleted', { place: gone.place + 1, scene: held.name }) }}
                <button :id="`back-${gone.id}`" type="button" @click="putBack(held.scene, gone)">
                  {{ $t('editor.putBack') }}
                  <!-- Its own key rather than `shotOfScene`, because the French
                       control already names the Plan: *Remettre le Plan 2 de …*. -->
                  <span class="visually-hidden">
                    {{ $t('editor.putBackShot', { place: gone.place + 1, scene: held.name }) }}
                  </span>
                </button>
              </p>
            </li>

            <ShotRow
              v-if="shot"
              :shot
              :scene="held.scene"
              :name="held.name"
              :place
              :last="place === held.scene.shots.length - 1"
              :here="held.here"
              :elsewhere="story.scenes.length > 1"
              :language="story.language"
              :set
              :names="named"
              :exits
              :flags
              :image-of="imageOf"
              :picked
              :editor="editing === shot.id ? Formatting : undefined"
              :at="editing === shot.id ? at : undefined"
              :over="fileOver === shot.id"
              :moving="moving?.shotId === shot.id ? moving : undefined"
              :landings="moving?.shotId === shot.id
                ? sections.filter(other => other.scene.id !== held.scene.id).map(other => other.name)
                : undefined"
              :changing
              :writing
              :type-on="typeOn"
              :attached
              @press="press(shot, $event)"
              @edit="edit(shot, $event)"
              @over="overImage(shot, $event)"
              @leave="leaveFile(shot, $event)"
              @dropped="fileOver = undefined"
              @listen="listen"
              @read="read(held.scene, shot, $event)"
              @split="splitBefore(held.scene, shot)"
              @toggle-moving="toggleMoving(shot)"
              @stop-moving="stopMoving(shot)"
              @move-to-scene="moveToScene(held.scene, held.name, shot, place)"
              @duplicate="duplicateShot(held.scene, held.name, shot, place)"
              @move="moveShot(held.scene, shot, $event)"
              @delete="deleteShot(held.scene, held.name, shot, place)"
            />
          </template>
        </ol>

        <!-- A beat added by hand rather than by key: what an Author who has just
             written a Scene with nothing in it gets, since there is no beat to
             press Enter at the end of.

             `data-step` while the Scene has no beat, because that is exactly when
             the two Steps that ask for one have no row of their own to point at: a
             Scene arrives with no Shot in it. Drawn here or on the beat's own
             field, never both, so the Step that names the two of them in order
             finds one — see `app/utils/steps.ts` and
             `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.

             Beside it, the beats of a folder of pictures at once: the picker
             behind it takes several files, and `addShotsFrom` makes each a Shot. -->
        <p class="adds">
          <button
            type="button"
            :disabled="!!filling"
            :data-step="held.here && !held.scene.shots.length ? 'add-shot' : undefined"
            :data-command="held.here ? $t('editor.addShot') : undefined"
            @click="addShot(held.scene)"
          >
            {{ $t('editor.addShot') }}
            <span class="visually-hidden">
              {{ $t('editor.toScene', { name: held.name }) }}
            </span>
          </button>
          <button
            type="button"
            :disabled="!!filling"
            :data-command="held.here ? $t('editor.addShotsFromImages') : undefined"
            @click="pickImages(held.scene)"
          >
            {{ $t('editor.addShotsFromImages') }}
            <span class="visually-hidden">
              {{ $t('editor.toScene', { name: held.name }) }}
            </span>
          </button>
          <input
            :id="`images-for-${held.scene.id}`"
            type="file"
            multiple
            hidden
            :accept="SHOT_IMAGE_ACCEPT"
            @change="addPickedShots(held.scene, $event)"
          >
          <button
            :id="`from-text-${held.scene.id}`"
            type="button"
            :disabled="!!filling"
            :aria-expanded="drafting?.sceneId === held.scene.id"
            :aria-controls="drafting?.sceneId === held.scene.id ? `drafting-${held.scene.id}` : undefined"
            :data-command="held.here ? $t('editor.addShotsFromText') : undefined"
            @click="toggleDrafting(held.scene)"
          >
            {{ $t('editor.addShotsFromText') }}
            <span class="visually-hidden">
              {{ $t('editor.toScene', { name: held.name }) }}
            </span>
          </button>
        </p>

        <!-- The beats of a draft at once: a text pasted here is cut at its empty
             lines into as many Shots — see `shotsOf` and
             `docs/adr/0081-pasted-text-is-cut-at-its-empty-lines.md` — and the line
             under the field says what it makes as it is typed. -->
        <form
          v-if="drafting?.sceneId === held.scene.id"
          :id="`drafting-${held.scene.id}`"
          class="drafting"
          @submit.prevent="addShotsFromText(held)"
          @keydown.esc.stop.prevent="stopDrafting(held.scene)"
        >
          <label class="eyebrow" :for="`text-for-${held.scene.id}`">
            {{ $t('editor.textOfNewShots') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </label>
          <textarea
            :id="`text-for-${held.scene.id}`"
            v-model="drafting.typed"
            rows="8"
            :readonly="filling === held.scene.id"
            :aria-describedby="`text-makes-${held.scene.id}`"
          />
          <p :id="`text-makes-${held.scene.id}`" class="makes">{{ drafted.said }}</p>
          <p class="adds">
            <button type="submit" :disabled="!drafted.ready || !!filling">
              {{ $t('editor.addTheShots') }}
            </button>
            <button type="button" :disabled="filling === held.scene.id" @click="stopDrafting(held.scene)">
              {{ $t('editor.closeThisField') }}
            </button>
          </p>
        </form>
      </section>

      <!-- Where the Question plays: after the run, before the Exits are judged,
           so it stands between the Shots and the ways out. Its own component,
           `app/components/Asking.vue`, so that a keystroke into the Question or
           its Flag draws again the two fields and not the document. -->
      <Asking :scene="held.scene" :name="held.name" :here="held.here" :writing />

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
               box arrives with the hand. The row is `app/components/ExitRow.vue`,
               drawn the way a beat's is. -->
          <ExitRow
            v-for="(exit, place) in held.ways"
            :key="exit.id"
            :exit
            :scene="held.scene"
            :place
            :last="place === held.ways.length - 1"
            :name="held.name"
            :to-name="nameOf(exit.toSceneId)"
            :here="held.here"
            :taken="held.taken[exit.id]"
            :names="named"
            :exits
            :flags
            :landing
            :changing
            :writing
            :announce
            @open="emit('open', $event)"
            @move="moveExit(held, exit, $event)"
          />
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
            <Landing
              :scenes="landing.scenes"
              :exits="landing.exits"
              :from="held.scene.id"
              :names="typed"
              typed
            />
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
/* The document's own elements: the Scenes, their heads and what folds under
   them, the runs and the ways out as lists, and the fields and buttons that add
   to them. Each row draws its own in its own block — `ShotRow.vue`, `ShotPlays.vue`,
   `ExitRow.vue` and `Asking.vue` — and a rule stands in every block whose template
   draws an element it matches, and in no other: the root of a row is the
   document's element as much as the row's, and a few classes, `.cutting` first
   among them, are drawn by more than one template. So every rule matches exactly
   the elements it matched when the rows stood in this template, and is compiled
   once for each template it reaches rather than once for every one of them. */

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

/* A Scene Readers do not read as it is written wears the grease a published link
   does, and so does what the Author is told of how Readers read it: a class of
   its own, because the one says the Scene differs and the other never does. */
.published-mark,
.read-mark {
  color: var(--grease);
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
   the Flags are, and the picker of a Scene heard under nothing along one line of
   its fold. */
.heard {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
}

/* How the Scene plays, read along one line with its own heading the way the Flags
   are while it is folded, and dropped under the heading once it opens — `.plays[open]`
   takes the line. */
.held.playing {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
}

.plays > summary {
  cursor: pointer;
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

/* The picker takes what is left of its line in the fold, so *Listen* and *Take
   This Sound* keep their words whole beside the list rather than wrapping inside
   their own boxes. */
.picking {
  flex-grow: 1;
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

/* The row a deleted Shot leaves: no Place in the margin, because it holds none
   now, and in the beat's column a quiet sentence with the way back beside it. */
.gone > p {
  grid-column: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
}

/* What the beat plays as, folded to one line of what it says for itself: the
   interface's face at the row's size and not an `.eyebrow`, because it is a
   reading of answers rather than a label, and three of them in capitals spaced
   for a label do not hold on one line. Open, it takes the line, so the
   Conditions and the marks drop under its fields rather than the line it was
   pressed on moving. */
.plays > summary {
  color: var(--muted);
  font-size: 0.8125rem;
}

.plays[open] {
  flex-basis: 100%;
}

.plays .answers {
  display: grid;
  gap: var(--s2);
  margin-block-start: var(--s2);
}

/* What the beat says about its own Cut, Layout and Movement, and about how its
   text arrives: the answers side by side while they fit, one under the other where
   they do not. Set further apart than anything else on the row, because each is a
   label and its answer and the eye has to read where one sentence ends and the
   next starts. */
.plays .cut,
.plays .laid,
.plays .moved {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s4);
}

/* The beat added by hand, under the run it is added to the end of. */
.adds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

/* A handful of files over the run wears the thumbnail's grease pencil, round the
   whole of it: letting go would add a Shot apiece. */
.run.over {
  outline: 1px dashed var(--grease);
  outline-offset: var(--s2);
  background: color-mix(in oklab, var(--grease) 6%, var(--bench));
}

.adds button {
  font-size: 0.8125rem;
}

.ways ol {
  display: grid;
  gap: var(--s2);
}

/* The way on written here, at the foot of the ways on: a label and one field, as
   wide as a Scene's name and no wider. The field a Shot is moved from is the same
   line, under its row's marks. */
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

/* The text a run of beats is pasted from, under the controls that add them: the
   same label and field as a way on's, a little wider than a Shot's measure, since
   what is pasted is a draft of the very lines the run sets at it. */
.drafting {
  display: grid;
  justify-items: start;
  gap: var(--s1);
  padding-block-start: var(--s2);
}

.drafting textarea {
  inline-size: min(100%, 48ch);
  font-size: 0.875rem;
}

.drafting .makes {
  color: var(--muted);
  font-size: 0.8125rem;
}

.none {
  color: var(--muted);
  font-size: 0.875rem;
  max-inline-size: 60ch;
}
</style>
