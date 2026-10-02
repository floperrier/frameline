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
 */
const named = computed(() => namesOnTheBench(story, t))

/** The Exits of the Story as the bench names them, which a Condition may ask about. */
const exits = computed(() => exitsOnTheBench(story, named.value))

/** The Flags of the Story, set by a Scene or held by a Question, which a Condition's Flag field offers. */
const flags = computed(() => declaredIn(story))

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
  held: SceneInDocument, shot: Shot, place: number, event: KeyboardEvent, atHead: boolean,
  halves?: [Formatted, Formatted],
) {
  const walked = held.scene.shots[place + (event.key === 'ArrowUp' ? -1 : 1)]
  const before = held.scene.shots[place - 1]

  // Struck again before the first has landed, it is taken and does nothing: it
  // would cut or join the words the first has not moved yet a second time.
  if (reshaping && (event.key === 'Enter' || (event.key === 'Backspace' && atHead))) { /* taken */ }
  else if (event.key === 'Enter' && halves) splitBeat(held.scene, shot, halves)
  else if (event.key === 'Enter') openBeat(held.scene, shot, place)
  else if (event.key === 'Backspace' && atHead && before) {
    const kept = emptied(shot) ? undefined : unjoined(shot, before)
    if (kept) announce(t(kept, { place: place + 1, scene: held.name, before: place }))
    else joinBeat(held.scene, shot, before)
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

/**
 * What the Author typed about one Shot: its text as formatted, its image's
 * Description and its Sound's Transcript. Never its plain words, which the
 * server derives from the formatted text — sent alone they would take the
 * formatting away.
 */
function typedAbout(shot: Shot) {
  return { formatted: shot.formatted, description: shot.description, transcript: shot.transcript }
}

/** Writes what the Author typed about one Shot in one request. */
function writeShot(scene: Scene, shot: Shot) {
  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: typedAbout(shot),
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
 * Attaches an image, sent as the whole request body: picked or dropped, it is the
 * same file to the same endpoint, developed first where it has to be — see
 * `developImage`. Developed inside the change, so the act is in flight from the
 * first pixel decoded to the server's answer, and a file the bench cannot develop
 * is refused the way the server refuses one: in the Scene, in the Author's words.
 */
function attach(scene: Scene, shot: Shot, file: File) {
  return changing(scene, async () => {
    const developed = await developImage(file)
    if (typeof developed === 'string') {
      const said = t(developed, { mb: SHOT_IMAGE_MAX_BYTES / 1024 / 1024 })
      throw Object.assign(new Error(said), { data: { message: said } })
    }

    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: developed })
    emit('attached', shot.id)
  })
}

/** Picked from the dialog rather than dropped on the thumbnail — see `depositedFile`. */
function attachImage(scene: Scene, shot: Shot, event: Event) {
  const file = depositedFile(event)
  if (!file) return

  return attach(scene, shot, file)
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

/** The first image among what was dropped is the one taken; a drop with no image at all is still sent, and the endpoint says what an image is. */
function dropImage(scene: Scene, shot: Shot, event: DragEvent) {
  fileOver.value = undefined
  const dropped = [...event.dataTransfer?.files ?? []]
  const image = dropped.find(file => imageTaken(file) !== 'refusals.imageType') ?? dropped[0]
  if (!image) return

  return attach(scene, shot, image)
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
 * #438, `docs/adr/0076-pasted-text-is-cut-at-its-empty-lines.md`. One for the
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

async function stopDrafting(scene: Scene) {
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
  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { transcript: scene.transcript },
  }))
}

/**
 * The Scenes whose Question the Author has opened and not yet written anything
 * in. A Scene whose Question or Flag holds something stands open without being
 * here, so what is written stays open on a reload
 * (`docs/adr/0061-what-is-written-stands-open.md`).
 */
const asking = ref<Record<string, boolean>>({})

function questionOpen(scene: Scene) {
  return !!asking.value[scene.id] || !!scene.question || !!scene.questionFlag
}

/** Opens the two fields and puts the caret in the first. */
async function askQuestion(scene: Scene) {
  asking.value[scene.id] = true
  await nextTick()
  document.getElementById(`question-${scene.id}`)?.focus()
}

/** The Question and the Flag its answer is held under: one typed write for both. */
function writeQuestion(scene: Scene) {
  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { question: scene.question, questionFlag: scene.questionFlag },
  }))
}

/** Empties both and closes the fields, with the caret on the button that reopens them. */
async function removeQuestion(scene: Scene) {
  scene.question = ''
  scene.questionFlag = ''
  delete asking.value[scene.id]
  await writeQuestion(scene)
  await nextTick()
  document.getElementById(`ask-${scene.id}`)?.focus()
}

function writeSoundLoops(scene: Scene, answer: string) {
  scene.soundLoops = answer === 'loop'

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, {
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

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

function writeShotCut(
  scene: Scene,
  shot: Shot,
  body: Partial<Pick<Shot, 'cutAfter' | 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

/**
 * The Layout a Scene says for its run, and the one a Shot says for itself, where
 * *as the Scene says* is the null the column holds. Written the way the Cut is:
 * on the row before the request leaves, so the document does not flicker back to
 * the answer that was chosen against.
 */
function writeSceneLayout(scene: Scene, layout: Layout) {
  scene.layout = layout

  return writing(scene, scene.id, () =>
    send(`/api/scenes/${scene.id}`, { method: 'PATCH', body: { layout } }))
}

function writeShotLayout(scene: Scene, shot: Shot, answer: string) {
  const layout = answer === 'scene' ? null : answer as Layout
  shot.layout = layout

  return writing(scene, shot.id, () =>
    send(`/api/shots/${shot.id}`, { method: 'PATCH', body: { layout } }))
}

/**
 * Where a Movement starts when the Author chooses a direction for an Image held
 * still: fifteen percent of the frame, as *A dissolve* starts at 800 ms — the
 * number is where the field starts and not what it is.
 */
const MOVEMENT_BY_START = 15

type MovementSaid = Partial<Pick<Shot, 'movementBy' | 'movementDirection' | 'movementOver'>>

/**
 * What a Scene or a Shot says about how its Images move, one function a carrier
 * as the Cut's are and for the same reason, written on the row before the request
 * leaves. A Scene's body never holds a null and is typed as a Shot's all the same:
 * the door refuses what the column cannot hold.
 */
function writeSceneMovement(scene: Scene, body: MovementSaid) {
  if (!wholeCut(body)) return
  Object.assign(scene, body)

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

function writeShotMovement(scene: Scene, shot: Shot, body: MovementSaid) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

/**
 * How an Image moves, read off the two columns that say it: still where it moves
 * by nought, whatever direction stands — *Not at all* leaves it, as *Hard* leaves
 * `cut_through` — its direction otherwise, and on a Shot that says nothing, *as
 * the Scene says*.
 */
function movementKind(carrier: { movementBy: number | null, movementDirection: MovementDirection | null }) {
  if (carrier.movementBy === 0) return 'still'

  return carrier.movementDirection ?? 'scene'
}

/** How long it takes: as the Scene says, as long as its Shot is on screen, or a time of its own. */
function movementTakesKind(carrier: { movementOver: number | null }) {
  if (carrier.movementOver === null) return 'scene'

  return carrier.movementOver === 0 ? 'whole' : 'time'
}

/** And what each answer writes, the Scene's and then the Shot's. */
function writeSceneMoves(scene: Scene, answer: string) {
  return writeSceneMovement(scene, answer === 'still'
    ? { movementBy: 0 }
    : { movementDirection: answer as MovementDirection, movementBy: scene.movementBy || MOVEMENT_BY_START })
}

function writeSceneMovementTakes(scene: Scene, answer: string) {
  return writeSceneMovement(scene, { movementOver: answer === 'whole' ? 0 : MOVEMENT_OVER_UNTIMED })
}

function writeShotMoves(scene: Scene, shot: Shot, answer: string) {
  if (answer === 'scene') {
    return writeShotMovement(scene, shot, { movementBy: null, movementDirection: null })
  }
  if (answer === 'still') return writeShotMovement(scene, shot, { movementBy: 0 })

  return writeShotMovement(scene, shot, {
    movementDirection: answer as MovementDirection,
    movementBy: shot.movementBy || MOVEMENT_BY_START,
  })
}

function writeShotMovementTakes(scene: Scene, shot: Shot, answer: string) {
  return writeShotMovement(scene, shot, {
    movementOver: answer === 'scene' ? null : answer === 'whole' ? 0 : MOVEMENT_OVER_UNTIMED,
  })
}

/**
 * A field of percent read back as the amount, by `secondsWritten`'s rule: nought
 * is handed back, because *Not at all* is what says it, and an empty field is no
 * change. Anything else is written, and refused by its phrase where it is out of
 * bounds, as the pace is.
 */
function percentWritten(event: Event, stood: number | null) {
  const field = event.target as HTMLInputElement
  const written = field.valueAsNumber

  if (written) return written
  if (stood && !Number.isNaN(written)) field.value = String(stood)

  return undefined
}

type EffectSlot = 'imageArrives' | 'imageLasts' | 'textArrives' | 'textLasts'

/**
 * The four sentences a beat says about its Effects, in the order they are read:
 * the Image arriving and staying, then the text arriving and staying. A slot
 * whose Effects are an arrival takes a time always, and one whose are a lasting
 * only where the Effect has a round.
 */
const EFFECT_SLOTS: {
  slot: EffectSlot, image: boolean, arrives: boolean, effects: readonly string[]
}[] = [
  { slot: 'imageArrives', image: true, arrives: true, effects: IMAGE_ARRIVALS },
  { slot: 'imageLasts', image: true, arrives: false, effects: IMAGE_LASTINGS },
  { slot: 'textArrives', image: false, arrives: true, effects: TEXT_ARRIVALS },
  { slot: 'textLasts', image: false, arrives: false, effects: TEXT_LASTINGS },
]

/**
 * What a Shot says about one of its Effects. Choosing writes the whole object,
 * as `effectWritten` makes it; *No Effect* writes null.
 */
function writeShotEffect(
  scene: Scene,
  shot: Shot,
  body: Partial<Pick<Shot, EffectSlot>>,
) {
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

function writeShotEffectChosen(scene: Scene, shot: Shot, slot: EffectSlot, effect: string) {
  if (!effect) return writeShotEffect(scene, shot, { [slot]: null })

  return writeShotEffect(scene, shot, {
    [slot]: effectWritten(effect, slot.endsWith('Arrives') ? 'arrives' : 'lasts', shot[slot]?.strength ?? 'marked'),
  })
}

function writeShotEffectTime(scene: Scene, shot: Shot, slot: EffectSlot, event: Event) {
  const held = shot[slot]
  const time = held && effectTime(held)
  const written = secondsWritten(event, time ?? null)
  if (!held || written === undefined) return

  return writeShotEffect(scene, shot, {
    [slot]: { ...held, [slot.endsWith('Arrives') ? 'over' : 'every']: written },
  })
}

function writeShotEffectStrength(scene: Scene, shot: Shot, slot: EffectSlot, strength: string) {
  const held = shot[slot]
  if (!held) return

  return writeShotEffect(scene, shot, { [slot]: { ...held, strength: strength as Strength } })
}

function writeExitCut(
  scene: Scene, exit: Exit, body: Partial<Pick<Exit, 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(exit, body)

  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}`, { method: 'PATCH', body }))
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

/**
 * Where a text's times start on the answer that asks for one: a second's wait,
 * the brief fade of a fifth of a second, and three seconds of stay. The fade is
 * also written beside a wait or a unit where the text would otherwise appear at
 * once, because a text that arrives late or by the word and then snaps on is the
 * arrival nobody meant — as *A dissolve* writes its 800 ms.
 */
const A_TEXT_WAIT = 1000
const A_TEXT_FADE = 200
const A_TEXT_STAY = 3000

type TextSaid = Partial<Pick<Shot, 'textAfter' | 'textBy' | 'textPace' | 'textOver' | 'textStays'>>

function faded(over: number, body: TextSaid): TextSaid {
  return over === 0 ? { ...body, textOver: A_TEXT_FADE } : body
}

/**
 * What a Scene or a Shot says about how its texts arrive, one function a carrier as
 * the Cut's are and for the same reason. A Scene's body never holds a null on the
 * first four and is typed as a Shot's all the same: the door refuses what the
 * column cannot hold.
 */
function writeSceneText(scene: Scene, body: TextSaid) {
  if (!wholeCut(body)) return
  Object.assign(scene, body)

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}`, { method: 'PATCH', body }))
}

function writeShotText(scene: Scene, shot: Shot, body: TextSaid) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

/**
 * A field of characters a second read back as the pace, and nothing where it is
 * empty. A pace out of bounds is written and refused by its phrase.
 */
function paceWritten(event: Event) {
  const written = (event.target as HTMLInputElement).valueAsNumber

  return Number.isNaN(written) ? undefined : written
}

/**
 * The four answers a text is given, read off the columns that say them. Each of a
 * Shot's is null where it answers as its Scene says, which a Scene's never is —
 * except for how long the text stays, whose null on a Scene is *until the Cut* and
 * on a Shot is the Scene's answer, with nought there the Cut.
 */
function textArrivesKind(carrier: { textAfter: number | null }) {
  if (carrier.textAfter === null) return 'scene'

  return carrier.textAfter === 0 ? 'image' : 'time'
}

function textAppearsKind(carrier: { textOver: number | null }) {
  if (carrier.textOver === null) return 'scene'

  return carrier.textOver === 0 ? 'once' : 'time'
}

function textStaysKind(shot: { textStays: number | null }) {
  if (shot.textStays === null) return 'scene'

  return shot.textStays === 0 ? 'cut' : 'time'
}

/** And what each answer writes, the Scene's and then the Shot's. */
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

function writeShotTextArrives(scene: Scene, shot: Shot, answer: string) {
  if (answer === 'scene') return writeShotText(scene, shot, { textAfter: null })
  if (answer === 'image') return writeShotText(scene, shot, { textAfter: 0 })

  return writeShotText(scene, shot,
    faded(shot.textOver ?? scene.textOver, { textAfter: A_TEXT_WAIT }))
}

function writeShotTextComes(scene: Scene, shot: Shot, answer: string) {
  // The pace goes with the unit: its field is only there while the Shot has a unit of
  // its own, and a pace left behind would still be the one the Reading plays.
  if (answer === 'scene') {
    return writeShotText(scene, shot, { textBy: null, textPace: null })
  }
  const textBy = answer as TextBy

  return writeShotText(scene, shot, textBy === 'whole'
    ? { textBy }
    : faded(shot.textOver ?? scene.textOver, { textBy }))
}

function writeShotTextAppears(scene: Scene, shot: Shot, answer: string) {
  return writeShotText(scene, shot, {
    textOver: answer === 'scene' ? null : answer === 'once' ? 0 : A_TEXT_FADE,
  })
}

function writeShotTextStays(scene: Scene, shot: Shot, answer: string) {
  return writeShotText(scene, shot, {
    textStays: answer === 'scene' ? null : answer === 'cut' ? 0 : A_TEXT_STAY,
  })
}

/**
 * A Shot goes at one press and is never asked about — see
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` — so it leaves a slim
 * row where it stood with the way back on it, and the focus moves there: a hand
 * that slipped is one press from undoing it, and the status line says what went.
 */
async function deleteShot(held: SceneInDocument, shot: Shot, place: number) {
  const gone = {
    id: shot.id,
    sceneId: held.scene.id,
    after: held.scene.shots[place - 1]?.id ?? null,
    place,
  }

  if (!await changing(held.scene, () => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))) return

  deleted.value.push(gone)
  announce(t('editor.shotDeleted', { place: place + 1, scene: held.name }))
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
async function duplicateShot(held: SceneInDocument, shot: Shot, place: number) {
  let copyId: string | undefined

  await changing(held.scene, async () => {
    // What is in the fields goes first, as before `Enter` opens a beat: the write
    // the editor's blur queued is not ordered with a click, and the copy is taken
    // of what the server holds.
    await send(`/api/shots/${shot.id}`, { method: 'PATCH', body: typedAbout(shot) })
    copyId = (await send(`/api/shots/${shot.id}/duplicate`, { method: 'POST' }) as Shot).id
  })

  if (!copyId) return
  announce(t('editor.shotDuplicated', { place: place + 1, scene: held.name, next: place + 2 }))
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
async function moveToScene(held: SceneInDocument, shot: Shot, place: number) {
  const open = moving.value
  if (open?.shotId !== shot.id || !open.typed.trim()) return

  const chosen = sceneToMoveTo(named.value, held.scene.id, open.typed)
  if (chosen.refused) {
    open.refused = t(chosen.refused, { scene: held.name })
    return
  }

  moving.value = undefined
  const left = { from: place + 1, name: held.name }
  let landed: number | undefined

  await changing(held.scene, async () => {
    landed = (await send(`/api/shots/${shot.id}/move`, {
      method: 'POST',
      body: { toSceneId: chosen.sceneId },
    }) as { position: number }).position
  })

  if (landed === undefined) return
  announce(t('editor.shotMoved', { ...left, scene: nameOf(chosen.sceneId), place: landed + 1 }))
  return typeInShot(shot.id)
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
 * is offered under opposite tests and phrased from scratch. How it is crossed is
 * copied, backwards or not and the passage it cuts through, since it is crossed
 * into the same Scene (#344).
 */
function duplicateExit(scene: Scene, exit: Exit) {
  const conditions = wholeConditions(exit.conditions)
  const { stepsBack, cutOver, cutThrough } = exit

  return changing(scene, async () => {
    const written = await send(`/api/scenes/${scene.id}/exits`, {
      method: 'POST',
      body: { toSceneId: exit.toSceneId },
    }) as Exit

    if (conditions.length) {
      await send(`/api/exits/${written.id}/conditions`, { method: 'PUT', body: { conditions } })
    }

    if (stepsBack !== null || cutOver) {
      await send(`/api/exits/${written.id}`, {
        method: 'PATCH',
        body: { stepsBack, cutOver, cutThrough },
      })
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

/** The words the Reader reads on the button that takes the way on. A typed write, like a Shot's text. */
function writeExitText(scene: Scene, exit: Exit) {
  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}`, {
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

  return writing(scene, exit.id, () => send(`/api/exits/${exit.id}`, {
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

  return writing(scene, scene.id, () => send(`/api/scenes/${scene.id}/flags`, {
    method: 'PUT',
    body: { sets },
  }))
}

/** Writes the whole list an Exit or a Shot carries, which is what the endpoint takes. */
function writeConditions(
  scene: Scene, where: 'exits' | 'shots', carrierId: string, carried: Condition[],
) {
  return writing(scene, carrierId, () => send(`/api/${where}/${carrierId}/conditions`, {
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
           while the section is, which is as long as the Scene's id is.

           Every answer is a `<select>` and never a number, so the noughts the
           columns hold — a Shot held until the press, Exits offered for no time
           at all — are sentences the Author reads rather than sentinels they have
           to know to type. That is also why none of these is marked for the bar of
           Commands: no press opens a `<select>`, which is the exemption `CONTEXT.md`
           writes into the Command entry, and a control in a shut fold is not one
           the bar finds. -->
      <section class="held playing">
        <h3>{{ $t('editor.howThisScenePlays') }}</h3>

        <details class="plays">
          <summary>
            {{ scenePlaysAs(held.scene, t) }}
            <span class="visually-hidden">{{ held.name }}</span>
          </summary>

          <div class="answers">
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
               the two — see `deleted`. -->
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

            <li v-if="shot" class="handed" :data-shot="shot.id">
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
                  @dragleave="leaveFile(shot, $event)"
                  @drop.prevent.stop="dropImage(held.scene, shot, $event)"
                >
                  <img
                    v-if="shot.image"
                    :src="imageOf(shot)"
                    :style="{ objectPosition: cropPosition(shot) }"
                    :alt="$t('editor.imageOfShot', {
                      place: place + 1,
                      scene: held.name,
                    })"
                  >
                  <input
                    type="file"
                    class="visually-hidden"
                    :accept="SHOT_IMAGE_ACCEPT"
                    :aria-label="$t('editor.pickImageOfShot', {
                      place: place + 1,
                      scene: held.name,
                    })"
                    @change="attachImage(held.scene, shot, $event)"
                  >
                </label>

                <span :id="`shot-named-${shot.id}`" class="visually-hidden">
                  {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                </span>
                <!-- The text, as every reading of the Shot draws it, in a box that is
                     the field until the caret is in it; then the one editor, under
                     the same name and id. Its words are the Shot's as they are typed,
                     for the counts and the Remarks, and its formatted text is written
                     when the caret leaves it — see `edit`. -->
                <component
                  :is="Formatting"
                  v-if="Formatting && editing === shot.id"
                  :id="`shot-${shot.id}`"
                  :formatted="shot.formatted"
                  :labelledby="`shot-named-${shot.id}`"
                  :label="$t('editor.formattingOf', { place: place + 1, scene: held.name })"
                  :lang="story.language"
                  :step="held.here && !place ? 'shot-text' : undefined"
                  :at
                  :keys="(event, atHead, halves) => typeOn(held, shot, place, event, atHead, halves)"
                  :stands-read="!shot.image || layout(held.scene, shot) === 'full'"
                  :set-in="setIn(story)"
                  @words="(text, formatted) => Object.assign(shot, { text, formatted })"
                  @change="formatted => writeShot(held.scene, Object.assign(shot, { formatted }))"
                />
                <Formatted
                  v-else
                  :id="`shot-${shot.id}`"
                  :data-step="held.here && !place ? 'shot-text' : undefined"
                  class="shot"
                  v-bind="setIn(story)"
                  role="textbox"
                  aria-multiline="true"
                  :aria-labelledby="`shot-named-${shot.id}`"
                  tabindex="0"
                  :lang="story.language"
                  :formatted="shot.formatted"
                  @pointerdown="press(shot, $event)"
                  @focus="edit(shot, $event)"
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
                     Shot's Sound strikes with the beat and is gone. A Sound not yet
                     deposited is a choice from a list, so its picker is folded with
                     the others below. -->
                <p v-if="shot.sound" class="struck">
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

                <div class="beneath">
                  <!-- What the beat plays as: every answer it chose from a list, folded
                       under one line that says only what this Shot says for itself —
                       `playsAs`, and `docs/adr/0061-what-a-beat-plays-as-is-folded-under-its-words.md`.
                       What is written or deposited stands open above it. First on the
                       line, so that opening it never moves what was pressed: an open
                       fold takes the line, and the Conditions and the marks wrap under
                       it. No `open` is bound, so the state is the browser's own and is
                       kept while the row is, which is as long as the Shot's id is. -->
                  <details class="plays">
                    <summary>
                      {{ playsAs(shot, held.scene, t) }}
                      <span class="visually-hidden">
                        {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                      </span>
                    </summary>

                    <div class="answers">
                      <!-- The Sound picker while there is no Sound: a choice from the
                           library, or a file to deposit. -->
                      <p v-if="!shot.sound" class="struck">
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
                      </p>

                      <!-- What this beat says about its own Cut, where the Scene has said
                           it for the run: both answer *as the Scene says* until the Author
                           says otherwise, which is the null the columns hold. A run where
                           one Shot is held longer than the others is still read by seeing
                           the row that differs: its line says so where the others say
                           nothing. -->
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
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="press">{{ $t('editor.cutAtThePress') }}</option>
                            <option value="clock">{{ $t('editor.cutAfterATime') }}</option>
                          </select>
                          <template v-if="shot.cutAfter">
                            <input
                              type="number"
                              inputmode="decimal"
                              :min="CUT_AFTER_MIN / 1000"
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
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
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

                      <!-- What this beat says about its own Layout, answering *as the Scene
                           says* until the Author says otherwise, which is the null the
                           column holds. -->
                      <div class="laid">
                        <p class="cutting">
                          <label class="eyebrow" :for="`shot-layout-${shot.id}`">
                            {{ $t('editor.shotIsLaidOut') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-layout-${shot.id}`"
                            :value="shot.layout ?? 'scene'"
                            @change="writeShotLayout(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option v-for="layout in LAYOUTS" :key="layout" :value="layout">
                              {{ $t(`editor.layout${layout === 'full' ? 'Full' : 'Inset'}`) }}
                            </option>
                          </select>
                        </p>
                      </div>

                      <!-- What this beat says about how its Image moves, drawn only where the
                           Shot has an Image, as the Description is, and its columns survive
                           the Image's removal. -->
                      <div v-if="shot.image" class="moved">
                        <p class="cutting">
                          <label class="eyebrow" :for="`shot-movement-${shot.id}`">
                            {{ $t('editor.imageMoves') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-movement-${shot.id}`"
                            :value="movementKind(shot)"
                            @change="writeShotMoves(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="still">{{ $t('editor.movementStill') }}</option>
                            <option v-for="direction in MOVEMENT_DIRECTIONS" :key="direction" :value="direction">
                              {{ $t(`editor.movement${direction[0]!.toUpperCase()}${direction.slice(1)}`) }}
                            </option>
                          </select>
                          <template v-if="shot.movementBy">
                            <input
                              type="number"
                              inputmode="numeric"
                              min="1"
                              :max="MOVEMENT_BY_MAX"
                              step="1"
                              :value="shot.movementBy"
                              :aria-label="$t('editor.percentThisImageMoves', {
                                place: place + 1,
                                scene: held.name,
                              })"
                              @change="writeShotMovement(held.scene, shot, {
                                movementBy: percentWritten($event, shot.movementBy),
                              })"
                            >
                            <span class="unit" aria-hidden="true">{{ $t('editor.percentUnit') }}</span>
                          </template>
                        </p>

                        <p v-if="(shot.movementBy ?? held.scene.movementBy) > 0" class="cutting">
                          <label class="eyebrow" :for="`shot-movement-over-${shot.id}`">
                            {{ $t('editor.movementTakes') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-movement-over-${shot.id}`"
                            :value="movementTakesKind(shot)"
                            @change="writeShotMovementTakes(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="whole">{{ $t('editor.movementWholeTime') }}</option>
                            <option value="time">{{ $t('editor.movementATime') }}</option>
                          </select>
                          <template v-if="shot.movementOver">
                            <input
                              type="number"
                              inputmode="decimal"
                              min="0.1"
                              :max="MOVEMENT_OVER_MAX / 1000"
                              step="0.1"
                              :value="shot.movementOver / 1000"
                              :aria-label="$t('editor.secondsThisMovementTakes', {
                                place: place + 1,
                                scene: held.name,
                              })"
                              @change="writeShotMovement(held.scene, shot, {
                                movementOver: secondsWritten($event, shot.movementOver),
                              })"
                            >
                            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                          </template>
                        </p>
                      </div>

                      <!-- What this beat does as its Image and its text arrive and while they
                           stay: a run where one Shot shakes is read by the line that says
                           so. The Image's two wait for an Image, as the Description does.
                           No Command is marked here, because every control is a `<select>`
                           or a field — and none may be, folded where the bar cannot see it. -->
                      <div class="cut">
                        <template v-for="slot in EFFECT_SLOTS" :key="slot.slot">
                          <p v-if="!slot.image || shot.image" class="cutting">
                            <label
                              :id="`shot-${slot.slot}-label-${shot.id}`"
                              class="eyebrow"
                              :for="`shot-${slot.slot}-${shot.id}`"
                            >
                              {{ $t(`editor.${slot.slot}`) }}
                              <span class="visually-hidden">
                                {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                              </span>
                            </label>
                            <select
                              :id="`shot-${slot.slot}-${shot.id}`"
                              :value="shot[slot.slot]?.effect ?? ''"
                              @change="writeShotEffectChosen(
                                held.scene, shot, slot.slot, ($event.target as HTMLSelectElement).value)"
                            >
                              <option value="">{{ $t('editor.noEffect') }}</option>
                              <option v-for="effect in slot.effects" :key="effect" :value="effect">
                                {{ $t(`editor.${EFFECT_LABELS[effect]}`) }}
                              </option>
                            </select>
                            <template v-if="shot[slot.slot]">
                              <template v-if="effectTime(shot[slot.slot]!) !== undefined">
                                <span :id="`shot-${slot.slot}-seconds-${shot.id}`" class="visually-hidden">
                                  {{ $t('editor.effectSeconds') }}
                                </span>
                                <input
                                  type="number"
                                  inputmode="decimal"
                                  :min="(slot.arrives ? ARRIVES_OVER_MIN : LASTS_EVERY_MIN) / 1000"
                                  :max="(slot.arrives ? ARRIVES_OVER_MAX : LASTS_EVERY_MAX) / 1000"
                                  step="0.1"
                                  :value="effectTime(shot[slot.slot]!)! / 1000"
                                  :aria-labelledby="
                                    `shot-${slot.slot}-label-${shot.id} shot-${slot.slot}-seconds-${shot.id}`"
                                  @change="writeShotEffectTime(held.scene, shot, slot.slot, $event)"
                                >
                                <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                              </template>
                              <span :id="`shot-${slot.slot}-strength-${shot.id}`" class="visually-hidden">
                                {{ $t('editor.effectStrength') }}
                              </span>
                              <select
                                :value="shot[slot.slot]!.strength"
                                :aria-labelledby="
                                  `shot-${slot.slot}-label-${shot.id} shot-${slot.slot}-strength-${shot.id}`"
                                @change="writeShotEffectStrength(
                                  held.scene, shot, slot.slot, ($event.target as HTMLSelectElement).value)"
                              >
                                <option v-for="strength in STRENGTHS" :key="strength" :value="strength">
                                  {{ $t(`editor.strength${strength[0]!.toUpperCase()}${strength.slice(1)}`) }}
                                </option>
                              </select>
                            </template>
                          </p>
                        </template>
                      </div>

                      <!-- What this beat says about how its own text arrives, drawn on every
                           beat that has text, and not as the Description is drawn only
                           beside an Image: a beat with no words has nothing to arrive. Each
                           answer is *as the Scene says* until the Author says otherwise,
                           which is the null the columns hold. Drawn plainly, as the Cut's
                           are, because the fold it stands in is already one. -->
                      <div v-if="shot.text.trim()" class="cut">
                        <p class="cutting">
                          <label class="eyebrow" :for="`shot-text-after-${shot.id}`">
                            {{ $t('editor.shotTextArrives') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-text-after-${shot.id}`"
                            :value="textArrivesKind(shot)"
                            @change="writeShotTextArrives(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="image">{{ $t('editor.textWithTheImage') }}</option>
                            <option value="time">{{ $t('editor.textAfterATime') }}</option>
                          </select>
                          <template v-if="shot.textAfter">
                            <input
                              type="number"
                              inputmode="decimal"
                              min="0.1"
                              :max="TEXT_AFTER_MAX / 1000"
                              step="0.1"
                              :value="shot.textAfter / 1000"
                              :aria-label="$t('editor.secondsBeforeThisText', {
                                place: place + 1,
                                scene: held.name,
                              })"
                              @change="writeShotText(held.scene, shot, {
                                textAfter: secondsWritten($event, shot.textAfter),
                              })"
                            >
                            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                          </template>
                        </p>

                        <p class="cutting">
                          <label class="eyebrow" :for="`shot-text-by-${shot.id}`">
                            {{ $t('editor.shotTextComes') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-text-by-${shot.id}`"
                            :value="shot.textBy ?? 'scene'"
                            @change="writeShotTextComes(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="whole">{{ $t('editor.textWhole') }}</option>
                            <option value="line">{{ $t('editor.textByLine') }}</option>
                            <option value="word">{{ $t('editor.textByWord') }}</option>
                            <option value="letter">{{ $t('editor.textByLetter') }}</option>
                          </select>
                          <template v-if="shot.textBy && shot.textBy !== 'whole'">
                            <input
                              type="number"
                              inputmode="decimal"
                              min="1"
                              :max="TEXT_PACE_MAX"
                              step="1"
                              :value="shot.textPace ?? held.scene.textPace"
                              :aria-label="$t('editor.paceOfThisText', {
                                place: place + 1,
                                scene: held.name,
                              })"
                              @change="writeShotText(held.scene, shot, {
                                textPace: paceWritten($event),
                              })"
                            >
                            <span class="unit" aria-hidden="true">
                              {{ $t('editor.charactersUnit') }}
                            </span>
                          </template>
                        </p>

                        <p class="cutting">
                          <label class="eyebrow" :for="`shot-text-over-${shot.id}`">
                            {{ $t('editor.shotTextAppears') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-text-over-${shot.id}`"
                            :value="textAppearsKind(shot)"
                            @change="writeShotTextAppears(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="once">{{ $t('editor.textAtOnce') }}</option>
                            <option value="time">{{ $t('editor.textOverATime') }}</option>
                          </select>
                          <template v-if="shot.textOver">
                            <input
                              type="number"
                              inputmode="decimal"
                              min="0.1"
                              :max="TEXT_OVER_MAX / 1000"
                              step="0.1"
                              :value="shot.textOver / 1000"
                              :aria-label="$t('editor.secondsThisTextAppears', {
                                place: place + 1,
                                scene: held.name,
                              })"
                              @change="writeShotText(held.scene, shot, {
                                textOver: secondsWritten($event, shot.textOver),
                              })"
                            >
                            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                          </template>
                        </p>

                        <p class="cutting">
                          <label class="eyebrow" :for="`shot-text-stays-${shot.id}`">
                            {{ $t('editor.shotTextStays') }}
                            <span class="visually-hidden">
                              {{ $t('editor.shotOfScene', { place: place + 1, scene: held.name }) }}
                            </span>
                          </label>
                          <select
                            :id="`shot-text-stays-${shot.id}`"
                            :value="textStaysKind(shot)"
                            @change="writeShotTextStays(
                              held.scene, shot, ($event.target as HTMLSelectElement).value)"
                          >
                            <option value="scene">{{ $t('editor.asTheSceneSays') }}</option>
                            <option value="cut">{{ $t('editor.textUntilTheCut') }}</option>
                            <option value="time">{{ $t('editor.textForATime') }}</option>
                          </select>
                          <template v-if="shot.textStays">
                            <input
                              type="number"
                              inputmode="decimal"
                              min="0.5"
                              :max="TEXT_STAYS_MAX / 1000"
                              step="0.5"
                              :value="shot.textStays / 1000"
                              :aria-label="$t('editor.secondsThisTextStays', {
                                place: place + 1,
                                scene: held.name,
                              })"
                              @change="writeShotText(held.scene, shot, {
                                textStays: secondsWritten($event, shot.textStays),
                              })"
                            >
                            <span class="unit" aria-hidden="true">{{ $t('editor.secondsUnit') }}</span>
                          </template>
                        </p>
                      </div>
                    </div>
                  </details>

                  <Conditions
                    :data-step="held.here && !place ? 'shot-condition' : undefined"
                    :lead="$t('editor.playedWhen')"
                    :carrier="$t('editor.shotOfScene', {
                      place: place + 1,
                      scene: held.name,
                    })"
                    :conditions="shot.conditions"
                    :names="named"
                    :exits="exits"
                    :flags="flags"
                    :counting="held.scene.id"
                    :id="shot.id"
                    :named="held.here"
                    @write="writeConditions(held.scene, 'shots', shot.id, shot.conditions)"
                  />

                  <!-- The marks act on the row they are drawn on: the first reads the
                       Story from this beat, the scissors split the Scene before it,
                       which the first beat has nothing before it to be split from,
                       the arrow after them moves it to another Scene, which a
                       Story of one Scene has none of, and ⧉ writes it again under
                       itself, which every beat can be. -->
                  <div class="row">
                    <button
                      type="button"
                      class="mark"
                      @click="read(held.scene, shot, $event)"
                    >
                      <span aria-hidden="true">▶</span>
                      <span class="visually-hidden">
                        {{ $t('editor.readFromShot', {
                          place: place + 1,
                          scene: held.name,
                        }) }}
                      </span>
                    </button>
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
                      v-if="story.scenes.length > 1"
                      :id="`move-${shot.id}`"
                      type="button"
                      class="mark"
                      :aria-expanded="moving?.shotId === shot.id"
                      @click="toggleMoving(shot)"
                    >
                      <span aria-hidden="true">↗</span>
                      <span class="visually-hidden">
                        {{ $t('editor.moveShot', {
                          shot: $t('editor.shotOfScene', {
                            place: place + 1,
                            scene: held.name,
                          }),
                        }) }}
                      </span>
                    </button>
                    <button
                      type="button"
                      class="mark"
                      @click="duplicateShot(held, shot, place)"
                    >
                      <span aria-hidden="true">⧉</span>
                      <span class="visually-hidden">
                        {{ $t('editor.duplicateShot', {
                          shot: $t('editor.shotOfScene', {
                            place: place + 1,
                            scene: held.name,
                          }),
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
                      @click="deleteShot(held, shot, place)"
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

                  <!-- Where the Shot moves to, named as a way on's landing is: the
                       field offers every other Scene as the bench calls it, and a
                       name answering to none is refused here rather than written,
                       because a beat moved somewhere new lands in a Scene nothing
                       arrives at. -->
                  <form
                    v-if="moving?.shotId === shot.id"
                    class="moving"
                    @submit.prevent="moveToScene(held, shot, place)"
                    @keydown.esc.stop.prevent="stopMoving(shot)"
                  >
                    <label class="eyebrow" :for="`moving-${shot.id}`">
                      {{ $t('editor.sceneToMoveTo') }}
                    </label>
                    <input
                      :id="`moving-${shot.id}`"
                      v-model="moving.typed"
                      :list="`moving-to-${shot.id}`"
                      autocomplete="off"
                      :placeholder="$t('editor.nameWhereItMoves')"
                      :aria-invalid="moving.refused ? 'true' : undefined"
                      @input="moving.refused = undefined"
                      @change="moveToScene(held, shot, place)"
                    >
                    <datalist :id="`moving-to-${shot.id}`">
                      <template v-for="other in sections" :key="other.scene.id">
                        <option v-if="other.scene.id !== held.scene.id" :value="other.name" />
                      </template>
                    </datalist>
                    <p v-if="moving.refused" role="alert">{{ moving.refused }}</p>
                  </form>
                </div>
              </div>
            </li>
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
             `docs/adr/0076-pasted-text-is-cut-at-its-empty-lines.md` — and the line
             under the field says what it makes as it is typed. -->
        <form
          v-if="drafting?.sceneId === held.scene.id"
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
            <button type="button" @click="stopDrafting(held.scene)">
              {{ $t('editor.closeThisField') }}
            </button>
          </p>
        </form>
      </section>

      <!-- Where the Question plays: after the run, before the Exits are judged,
           so it stands between the Shots and the ways out. The two fields stand
           open wherever either holds anything. -->
      <div class="asks">
        <template v-if="questionOpen(held.scene)">
          <p class="asked">
            <label class="eyebrow" :for="`question-${held.scene.id}`">
              {{ $t('editor.question') }}
              <span class="visually-hidden">{{ held.name }}</span>
            </label>
            <input
              :id="`question-${held.scene.id}`"
              v-model="held.scene.question"
              type="text"
              :maxlength="QUESTION_MAX_LENGTH"
              @change="writeQuestion(held.scene)"
            >
          </p>
          <p class="asked">
            <label class="eyebrow" :for="`question-flag-${held.scene.id}`">
              {{ $t('editor.questionFlag') }}
              <span class="visually-hidden">{{ held.name }}</span>
            </label>
            <input
              :id="`question-flag-${held.scene.id}`"
              v-model="held.scene.questionFlag"
              type="text"
              autocomplete="off"
              :maxlength="FLAG_NAME_MAX_LENGTH"
              @change="writeQuestion(held.scene)"
            >
          </p>
          <button
            type="button"
            class="danger going"
            :data-command="held.here ? $t('editor.removeQuestion') : undefined"
            @click="removeQuestion(held.scene)"
          >
            {{ $t('editor.removeQuestion') }}
            <span class="visually-hidden">{{ held.name }}</span>
          </button>
        </template>
        <button
          v-else
          :id="`ask-${held.scene.id}`"
          type="button"
          :data-command="held.here ? $t('editor.askAQuestion') : undefined"
          @click="askQuestion(held.scene)"
        >
          {{ $t('editor.askAQuestion') }}
          <span class="visually-hidden">{{ held.name }}</span>
        </button>
      </div>

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

              <!-- How often Readers took it, which its Author is told here and
                   nowhere a Reader looks. -->
              <p v-if="held.taken[exit.id]" class="eyebrow read-mark taken">{{ held.taken[exit.id] }}</p>

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
                  :exits="exits"
                  :flags="flags"
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

/* The Question and its Flag, one field to a line under the run of Shots, each
   read as a label over a box the width of the column. */
.asks {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s2);
  margin-block: var(--s3);
}

.asked {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  inline-size: 100%;
  margin: 0;
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
.beat > .transcribed {
  grid-column: 1 / -1;
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

/* And the marks stay at the trailing edge of the row when a long line pushes them
   under it. */
.beat .beneath > .row {
  margin-inline-start: auto;
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
   straight into the document — and grows as it is typed, from the two lines a beat
   always had. The box and the editor that replaces it are one size, so nothing
   moves under the hand as the one becomes the other: the editor keeps its own two
   lines in `app/components/Formatting.client.vue`. */
.beat > .shot {
  min-block-size: 2lh;
  cursor: text;
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

/* How often the way on was taken, under the words the Reader presses: the last
   column, which is that field's in a row and the only one once the row folds,
   and set in as far as the words in the field are. */
.written > .taken {
  grid-column: -2 / -1;
  padding-inline: var(--s2);
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
   wide as a Scene's name and no wider. The field a Shot is moved from is the same
   line, under its row's marks. */
.adding,
.moving {
  display: grid;
  justify-items: start;
  gap: var(--s1);
  padding-block-start: var(--s1);
}

.moving {
  flex-basis: 100%;
}

.adding input,
.moving input {
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
