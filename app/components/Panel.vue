<script setup lang="ts">
/**
 * Where a Scene is written: the surface that takes the width of the bench, with
 * the graph folded into a rail beside it — see
 * `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`. Nothing else is
 * ever on it. An Exit's text is written on its own line on the graph, and what
 * of an Exit is written here is what is read against the Scene: its Conditions,
 * which test the Flags this Scene sets, and the Place it is offered at.
 *
 * Which Scene it holds is the page's to say, because the graph asks for it from
 * the other side of the bench: the surface is handed the Scene and says when it
 * should be handed nothing.
 *
 * Everything typed here is written into the Story the page fetched, in place, and
 * sent through the one holder the page keeps.
 */
const {
  story, sceneWritten, change, write, ask, announce, imageOf,
} = defineProps<{
  /** The Story being written, which a Condition reads its neighbours out of. */
  story: StoryInEditor
  /** The Scene being written. */
  sceneWritten?: Scene
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
  /**
   * Why the last change was refused, while a Scene is what is being written: the
   * server complaining about a Shot has one Scene on screen to complain against,
   * which is what the width bought. The page shows the same refusal above the
   * bench when there is no Scene here to show it against.
   */
  problem?: Problem
}>()

/**
 * What the surface asks of the page: the press that takes the Scene out of it.
 * `attached` is the moment an image landed, which the page holds because the card
 * on the graph draws that image too.
 */
const emit = defineEmits<{ close: [], attached: [string], open: [string] }>()

const { t } = useI18n()

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

/**
 * How many of each thing the Scene holds, which each section of the document
 * says beside its own heading. They used to be counts on three tabs, and what a
 * tab bought — a short surface — is bought here by a beat costing a row instead
 * of a card. What the tabs cost was that a Condition and the Flags it tests were
 * never on screen together, though they are the same sentence read from two
 * ends: see `docs/adr/0033-a-scene-is-written-as-one-document.md`.
 */
const counted = computed(() => sceneWritten && {
  shots: sceneWritten.shots.length,
  flags: Object.keys(sceneWritten.sets).length,
  ways: exitsFrom(story.exits, sceneWritten.id).length,
})

/**
 * The ways in arriving at one Scene — the counterpart of `exitsFrom`, and drawn
 * from the same list, because the schema cascades a delete from both ends of a
 * Exit and only one end was ever counted. In no Place: an Exit is numbered among
 * the ways on leaving the Scene it departs, and the Scene it arrives at has no
 * say in that order.
 */
function exitsInto(sceneId: string) {
  return story.exits.filter(exit => exit.toSceneId === sceneId)
}

/**
 * A Scene goes with its Shots and with the Exits at both of its ends, and the
 * Author named none of them, so it is asked about and all three are counted
 * separately — the ways in were destroyed uncounted before. See
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`.
 */
async function deleteScene(scene: Scene) {
  const named = {
    name: scene.name,
    shots: countedShots(scene.shots.length, t),
    waysOn: countedExits(exitsFrom(story.exits, scene.id).length, t),
    waysIn: countedExits(exitsInto(scene.id).length, t),
  }
  const asking = t('editor.confirmDeleteScene', named)
  if (!await ask(asking, t('editor.deleteScene'))) return
  return change(() => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

/**
 * Writes the name the Author corrected, when they leave the field. The placement
 * goes with it because the endpoint takes the node whole, and it is the placement
 * already on screen — the name is the only half that has changed.
 */
function renameScene(scene: Scene) {
  return write(() => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { name: scene.name, x: scene.x, y: scene.y },
  }))
}

/**
 * Adds a beat at the end of the Scene, which is where a hand adds one: the
 * control under the run. A key adds one where the caret is — see `openBeat`.
 */
async function addShot(scene: Scene) {
  let writtenId: string | undefined
  await change(async () => {
    writtenId = (await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot).id
  })

  // After the change, which reads the Story back: the field the caret goes into
  // is not in the page until that read has been rendered.
  if (writtenId) return typeInShot(writtenId)
}

/**
 * The run of beats is typed as one document although it stays one field per
 * Shot. Enter at the end of a beat makes the next one, Backspace at the head of
 * an empty one takes it away, and the two arrows with Alt held walk between
 * them: the gestures a run of paragraphs answers to anywhere else, on a list of
 * fields that never has to be parsed and never loses what a beat carries. See
 * `docs/adr/0033-a-scene-is-written-as-one-document.md`.
 *
 * Nothing here is the only way to do what it does. Every one of them has a
 * control on the surface — the button under the run, the mark that deletes a
 * beat, the two that move one — because a key nobody can see is not a way in.
 */
function typeOn(scene: Scene, shot: Shot, place: number, event: KeyboardEvent) {
  const field = event.target as HTMLTextAreaElement

  // Shift and the modifiers are left alone: a beat may hold more than one line,
  // and Shift+Enter is how every field in every editor writes the second.
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault()
    return openBeat(scene, shot, place)
  }

  if (event.key === 'Backspace' && emptied(shot) && field.selectionStart === 0
    && field.selectionEnd === 0 && place > 0) {
    event.preventDefault()
    return joinBeat(scene, shot, place)
  }

  const stepped = event.altKey && { ArrowUp: -1, ArrowDown: 1 }[event.key]
  if (!stepped) return

  const walked = scene.shots[place + stepped]
  if (!walked) return
  event.preventDefault()
  typeInShot(walked.id, true)
}

/**
 * Whether a beat holds nothing an Author would miss. Backspace takes a beat away
 * without asking — which is what the key does to an empty paragraph everywhere —
 * and that is only safe where there is nothing on the beat but the caret: an
 * Image or a Condition is work that took thought and nothing on the screen would
 * show it being destroyed, which is the case
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` exists for. A beat
 * carrying either is deleted by the mark at the end of its row instead.
 */
function emptied(shot: Shot) {
  return !shot.text && !shot.image && !shot.conditions.length
}

/**
 * Enter: the next beat, written where the caret was rather than at the foot of
 * the Scene. The endpoint adds a Shot at the end and the run is renumbered
 * behind it, which is two requests inside the one change — the same seam
 * `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` accepted
 * for a Scene and an Exit, and for the same reason: a third endpoint that
 * inserted would be a copy of the rules both of these already enforce.
 *
 * At the end of the run — where an Author writing forwards spends all their time
 * — there is nothing to renumber and it is one request.
 */
async function openBeat(scene: Scene, shot: Shot, place: number) {
  let writtenId: string | undefined

  await change(async () => {
    // What is in the field goes first, or the beat the Author has just finished
    // is written after the one that follows it and the run is read back stale.
    await send(`/api/shots/${shot.id}`, {
      method: 'PATCH',
      body: { text: shot.text, description: shot.description },
    })

    const written = await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot
    const last = place === scene.shots.length - 1
    if (!last) {
      const places = scene.shots.map(held => held.id)
      places.splice(place + 1, 0, written.id)
      await send(`/api/scenes/${scene.id}/shots/places`, { method: 'PUT', body: { places } })
    }

    writtenId = written.id
  })

  if (writtenId) return typeInShot(writtenId)
}

/**
 * Backspace at the head of an empty beat: the beat goes and the caret lands at
 * the end of the one before it, which is where it would be if the two had always
 * been one paragraph.
 */
async function joinBeat(scene: Scene, shot: Shot, place: number) {
  const before = scene.shots[place - 1]

  await change(() => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
  if (before) return typeInShot(before.id, true)
}

/**
 * Puts the caret in a beat, after the read the change asks for has put the field
 * in the page. At the end of what is written there when the caret arrives from
 * below or from an arrow, and at the start of an empty one either way.
 */
async function typeInShot(shotId: string, atTheEnd = false) {
  await nextTick()
  const field = document.getElementById(`shot-${shotId}`) as HTMLTextAreaElement | null
  if (!field) return

  field.focus()
  if (atTheEnd) field.setSelectionRange(field.value.length, field.value.length)
}

/**
 * Writes what the Author typed about one Shot — its text and its image's
 * Description — in the one request, because they are one Shot and either field
 * may be the one that changed.
 */
function writeShot(shot: Shot) {
  return write(() => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description },
  }))
}

/**
 * Writes a whole sequence of Places, which is the only way one is written: the
 * ids of everything the Scene numbers, in the order they are now in.
 */
function renumber(scene: Scene, what: 'shots' | 'exits', places: string[]) {
  return change(
    () => send(`/api/scenes/${scene.id}/${what}/places`, { method: 'PUT', body: { places } }),
  )
}

function moveShot(scene: Scene, shot: Shot, step: -1 | 1) {
  return renumber(scene, 'shots', movedBy(scene.shots.map(held => held.id), shot.id, step))
}

/**
 * The Shot being dragged by its number, and the Shot the hand is over. Held by
 * Shot id and not by the Shot, the same trap the other gestures on this page
 * avoid: a read landing mid-drag replaces every Scene in the Story, and the hand
 * would be holding a Shot that is no longer the one on screen.
 */
const draggedShot = ref<{ shotId: string, over?: string }>()

/**
 * The band along the panel's top and bottom edge that a dragged Shot scrolls it
 * from, and how far the panel travels each tick of the run. Both are felt rather
 * than derived, which is why they are named here with the reasoning rather than
 * dropped into the arithmetic below.
 *
 * The band is about the height of a Shot's own number: wide enough to fall into
 * with a hand that is already carrying something, and narrow enough that a hand
 * resting halfway down a run scrolls nothing. The step comes to five hundred
 * pixels a second, which crosses a node full of Shots in a couple of seconds —
 * slow enough that the row aimed at can be let go of as it comes past.
 *
 * Under `prefers-reduced-motion` the run still travels: refusing to scroll would
 * put the far end of a long Scene out of reach of the gesture that exists to
 * reach it, and the two controls are the route for a hand that wants no drag at
 * all. What it loses is the glide — the same distance in the same time, taken a
 * Shot's row at a stride every fifth of a second instead of a few pixels a
 * frame, so the list steps to where the hand is pointing rather than sliding
 * there.
 */
const SHOT_SCROLL_BAND = 48
const SHOT_SCROLL_TICK = 16
const SHOT_SCROLL_STEP = 8
const SHOT_SCROLL_STILL_TICK = 200
const SHOT_SCROLL_STILL_STEP = 100

/**
 * The run that scrolls the panel under a dragged Shot: the panel itself, how far
 * it goes each tick, where the hand last was, and the timer driving it. One
 * run per drag, started with the gesture and stopped with it however it ends, so
 * nothing goes on scrolling without a hand on it. A hand at rest away from both
 * edges is a tick that moves nothing, which is cheaper than starting and
 * stopping the timer at every edge.
 */
let shotScroll: {
  body: HTMLElement
  step: number
  at: { clientX: number, clientY: number }
  tick: ReturnType<typeof setInterval>
} | undefined

/**
 * Which way the body under the hand should be running: back in the band along
 * its top edge, on in the one along its bottom, and nowhere between the two or
 * past either. The pointer is captured, so a hand that has left the body
 * altogether is a hand outside every band rather than one pinned to the edge it
 * left by.
 *
 * The bands are measured against what is on screen of the panel and not against
 * the whole of it. A panel whose foot is below the fold, where no pointer can go,
 * would carry a band the hand could never reach — so the band sits at the bottom
 * of what the Author can see, which is as far down as they can drag anything.
 */
function shotScrollWay(body: HTMLElement, y: number) {
  const box = body.getBoundingClientRect()
  const top = Math.max(box.top, 0)
  const bottom = Math.min(box.bottom, window.innerHeight)
  if (y >= top && y < top + SHOT_SCROLL_BAND) return -1
  if (y <= bottom && y > bottom - SHOT_SCROLL_BAND) return 1

  return 0
}

/**
 * One tick of the run. Which way it goes is worked out here rather than kept
 * from the last move, because the panel can come out from under a hand that has
 * not moved — the press on a Shot's number focuses its field, and a browser that
 * scrolls the page to show it takes the bands with it.
 *
 * The Shot the hand is over is asked for again once the body has moved, for the
 * same reason: the list comes to meet a pointer standing still in the band, and
 * the row under it is whichever one has arrived there.
 */
function runShotScroll() {
  const run = shotScroll
  if (!run || !draggedShot.value) return

  const way = shotScrollWay(run.body, run.at.clientY)
  if (!way) return

  run.body.scrollTop += way * run.step
  draggedShot.value.over = rowUnder(run.at, 'shot')
}

/** Stops the run, whatever ended the gesture that started it. */
function stopShotScroll() {
  if (shotScroll) clearInterval(shotScroll.tick)
  shotScroll = undefined
}

// Leaving the page ends the gesture as surely as letting go does, and a timer
// left ticking would go on scrolling a node that is no longer on screen.
onBeforeUnmount(stopShotScroll)

function startShotDrag(shot: Shot, event: PointerEvent) {
  // A finger scrolls the node instead. The two controls move a Shot a Place
  // without a drag, so touch keeps the whole route and loses only the shortcut —
  // and taking the scroll off a node full of writing would cost it more.
  if (event.pointerType === 'touch') return

  // Capturing the pointer sends the rest of the gesture to the number itself, so
  // the hand can leave it for the Shot it is aiming at.
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  draggedShot.value = { shotId: shot.id }

  // What scrolls is the panel this drag is inside, never the bench and never the
  // window: a Shot carried to the edge of its run must not take the graph with
  // it.
  const body = handle.closest('.panel')
  if (!(body instanceof HTMLElement)) return

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  shotScroll = {
    body,
    step: still ? SHOT_SCROLL_STILL_STEP : SHOT_SCROLL_STEP,
    at: { clientX: event.clientX, clientY: event.clientY },
    tick: setInterval(runShotScroll, still ? SHOT_SCROLL_STILL_TICK : SHOT_SCROLL_TICK),
  }
}

function keepShotDrag(event: PointerEvent) {
  if (!draggedShot.value) return
  draggedShot.value.over = rowUnder(event, 'shot')
  if (shotScroll) shotScroll.at = { clientX: event.clientX, clientY: event.clientY }
}

/** A gesture abandoned: the Shot is put down where it was, and the run stops. */
function cancelShotDrag() {
  draggedShot.value = undefined
  stopShotScroll()
}

function endShotDrag(scene: Scene) {
  const dragged = draggedShot.value
  cancelShotDrag()
  if (!dragged?.over || dragged.over === dragged.shotId) return

  const places = movedInto(scene.shots.map(held => held.id), dragged.shotId, dragged.over)
  if (!places) return

  return renumber(scene, 'shots', places)
}

/**
 * Attaches an image, sent as the whole request body. One function for both ways in:
 * a file picked and a file dropped are the same file handed to the same endpoint.
 */
function attach(shot: Shot, file: File) {
  return change(async () => {
    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: file })
    emit('attached', shot.id)
  })
}

/**
 * Attaches the image the Author picked. The input is cleared afterwards so picking
 * the same file twice is a change twice — an Author whose first upload was refused
 * would otherwise have to pick another file before they could retry the same one.
 */
function attachImage(shot: Shot, event: Event) {
  const picker = event.target as HTMLInputElement
  const picked = picker.files?.[0]
  if (!picked) return
  picker.value = ''

  return attach(shot, picked)
}

/**
 * The Shot whose thumbnail a file is over, held by Shot id rather than by the
 * Shot, the same trap the drags on this page avoid: a read landing mid-gesture
 * replaces every Scene in the Story. `over` is what the other gestures call it,
 * because it is the same fact — what the hand is aimed at, before it lets go.
 */
const fileOver = ref<string>()

/**
 * A file over a thumbnail. The template refuses the default, which is the whole of
 * saying yes — an element that does not refuse it is not a drop target at all — and
 * this puts the mark on and the copy cursor with it. The event stops at the
 * thumbnail so the page's own refusal does not take that cursor back off it.
 */
function overImage(shot: Shot, event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  fileOver.value = shot.id
}

/**
 * The file leaving again. Asked of the thumbnail and not of what is inside it:
 * moving onto the image or the input leaves the label by the letter of the event,
 * and the mark would flicker off under a hand that has not gone anywhere. Nor does
 * a thumbnail take the mark off its neighbour — a file crossing from one to the
 * next enters the second before it leaves the first.
 */
function leaveImage(shot: Shot, event: DragEvent) {
  const thumbnail = event.currentTarget as HTMLElement
  if (fileOver.value !== shot.id) return

  if (!thumbnail.contains(event.relatedTarget as Node | null)) fileOver.value = undefined
}

/**
 * The file dropped on a thumbnail. A drop carries what the Author let go of rather
 * than what the picker offered, so it may hold several files, or one of a kind the
 * endpoint will refuse: the first image is the one taken, and the rest are passed
 * over without a word about them. A drop of one file that is no image at all is
 * still sent, because the endpoint is what says what an image is — and it says so
 * in the same phrase a picked file is refused in.
 */
function dropImage(shot: Shot, event: DragEvent) {
  fileOver.value = undefined
  const dropped = [...event.dataTransfer?.files ?? []]
  const image = dropped.find(file => SHOT_IMAGE_TYPES.includes(file.type)) ?? dropped[0]
  if (!image) return

  return attach(shot, image)
}

function deleteShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
}

function openOn(scene: Scene) {
  return change(() => send(`/api/scenes/${scene.id}/opening`, { method: 'POST' }))
}

/**
 * The Scenes a way on out of this Scene may be led to: the Story's own, less the
 * Scene it leaves and less every Scene it already reaches. Asked of the same
 * function the graph's aiming asks, so the gesture and the field cannot disagree
 * about where an Exit may land.
 *
 * `led` is the Scene a way on already arrives at, which belongs in its own field
 * although a new way on may not land there: a select whose current value is not
 * among its options is a control that has lost its own state.
 */
function mayLandOn(scene: Scene, led?: string) {
  const landing = scenesAExitMayLandOn(story.scenes, story.exits, scene.id)

  return story.scenes.filter(other => landing.has(other.id) || other.id === led)
}

/**
 * Where a way on leads, changed in the field that says where it leads. The Exit
 * keeps its text, its Conditions and its Place — only the arrival is written —
 * which is the endpoint the graph's endpoint-drag reaches, from a control instead
 * of from a hand. Until now an Exit could only be led elsewhere on the canvas,
 * so a Story written without one could not be corrected at all: see
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md`.
 */
function leadExit(exit: Exit, toSceneId: string) {
  if (!toSceneId || toSceneId === exit.toSceneId) return

  return change(() => send(`/api/exits/${exit.id}/scene`, {
    method: 'PUT',
    body: { toSceneId },
  }))
}

/**
 * Writes a second way on to the same Scene, carrying the Conditions of the first.
 * The field that adds one will not offer a Scene this Scene already reaches, which
 * is what keeps a slip from making an accidental duplicate — but two ways on to
 * one Scene under opposite Conditions is what Conditions on an Exit are for, so
 * it is written on purpose from here: an Author duplicates a way on at the moment
 * they mean to write its opposite Condition.
 *
 * The Conditions are copied and the text is not. The pair exists to be offered
 * under opposite tests, so the second is phrased from scratch, and the Condition
 * that makes it the opposite is the Author's next edit — on the row it lands on.
 *
 * The two writes are one change, and are not one transaction: Conditions refused
 * after the Exit was written leave a bare duplicate on the surface, which the
 * Author can go on writing or take away.
 */
function duplicateExit(scene: Scene, exit: Exit) {
  const conditions = wholeConditions(exit.conditions)

  return change(async () => {
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

/**
 * Takes a way on away, from the row it is written on. No confirmation, for the
 * reason the same act on the canvas has none: it is a control pressed on purpose
 * and named for what it takes, which is not the slip of the hand
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` is about.
 */
function deleteExit(exit: Exit) {
  return change(() => send(`/api/exits/${exit.id}`, { method: 'DELETE' }))
}

/**
 * What the field at the foot of the ways on is set to, which is nothing for as
 * long as nobody has chosen: it is a control that acts and then forgets, like the
 * field above the bench that goes to a Scene by name, so it never stands there
 * holding the last thing it did.
 */
const adding = ref('')

/**
 * What the field is set to for the one option that is not a Scene. A word rather
 * than the empty string, which is what the field reads when nothing has been
 * chosen: the two must not be the same answer.
 */
const NEW_SCENE = 'new'

/**
 * A way on written from the Scene's own document: chosen from the Scenes it may
 * land on, or to a Scene that does not exist yet — which is the counterpart of
 * dropping an Exit on the bare bench, for an Author who never opens the canvas.
 */
async function addExit(scene: Scene, chosen: string) {
  adding.value = ''
  if (!chosen) return
  if (chosen === NEW_SCENE) return openSceneFrom(scene)

  return change(() => send(`/api/scenes/${scene.id}/exits`, {
    method: 'POST',
    body: { toSceneId: chosen },
  }))
}

/**
 * The Scene at the far end of a way on that had none: written under a provisional
 * name, placed beside the Scene it leaves, joined to it, and handed to the page
 * so that the Author is left in the field that names it. The same two writes in
 * the same order as the gesture on the canvas — see
 * `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md`, whose
 * seam this shares: they are one change and not one transaction.
 */
async function openSceneFrom(scene: Scene) {
  const name = t('editor.provisionalSceneName')
  let writtenId: string | undefined

  await change(async () => {
    const written = await send(`/api/stories/${story.id}/scenes`, {
      method: 'POST',
      body: { name, ...placedBeside(story.scenes, scene) },
    }) as Scene

    await send(`/api/scenes/${scene.id}/exits`, {
      method: 'POST',
      body: { toSceneId: written.id },
    })

    writtenId = written.id
    // Asked for inside the change, so the page has put the Scene in the address
    // and on the surface by the time the read the change asks for comes back:
    // this is the order the same gesture on the canvas is written in.
    emit('open', written.id)
    announce(t('editor.exitDrawn', { from: scene.name, to: name }))
  })

  // After the read and the render it causes, which is what puts the field in the
  // page at all. Selected rather than left with a caret in it: the name is
  // provisional, so the first thing typed replaces it.
  if (!writtenId) return
  await nextTick()
  const named = document.getElementById(`scene-name-${writtenId}`) as HTMLInputElement | null
  named?.focus()
  named?.select()
}

/**
 * The words a Reader reads on the button that takes this way on. A typed write,
 * like a Shot's text and the Scene's own name: what is on screen is what the
 * Author typed, and the mark it leaves is the time on the bench and the flash in
 * the field.
 */
function writeExitText(exit: Exit) {
  return write(() => send(`/api/exits/${exit.id}`, { method: 'PATCH', body: { text: exit.text } }))
}

function moveExit(scene: Scene, exit: Exit, step: -1 | 1) {
  const ways = exitsFrom(story.exits, scene.id).map(held => held.id)

  return renumber(scene, 'exits', movedBy(ways, exit.id, step))
}

/**
 * The way on being dragged within a Scene's strip, and the row the hand is over.
 * Held by Exit id and not by the Exit, the same trap the other two gestures avoid.
 */
const draggedWay = ref<{ exitId: string, over?: string }>()

function startWayDrag(exit: Exit, event: PointerEvent) {
  // Capturing the pointer sends the rest of the gesture to the row itself, so the
  // hand can leave it for the row it is aiming at.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  draggedWay.value = { exitId: exit.id }
}

function keepWayDrag(event: PointerEvent) {
  if (draggedWay.value) draggedWay.value.over = rowUnder(event, 'way')
}

function endWayDrag(scene: Scene) {
  const dragged = draggedWay.value
  draggedWay.value = undefined
  if (!dragged?.over || dragged.over === dragged.exitId) return

  const ways = exitsFrom(story.exits, scene.id).map(held => held.id)
  const places = movedInto(ways, dragged.exitId, dragged.over)
  if (!places) return

  return renumber(scene, 'exits', places)
}

/**
 * Which row of a numbered list the hand is over — a way on in a Scene's strip, or
 * a Shot in its run — asked of the page rather than worked out from the rows:
 * they are really there and the browser already hit-tests them, which is what
 * makes this the answer to both "light this row" and "drop here".
 *
 * Asked at a point rather than of an event, because the run that scrolls a body
 * under a dragged Shot asks it between one move and the next, when the list has
 * come to the hand rather than the other way about.
 */
function rowUnder(at: { clientX: number, clientY: number }, what: 'way' | 'shot') {
  const under = document.elementFromPoint(at.clientX, at.clientY)
  return (under?.closest(`[data-${what}]`) as HTMLElement | null)?.dataset[what]
}

/**
 * The sequence with one thing dropped onto another's Place, or nothing where the
 * row under the hand is not one of this Scene's own: the hit-test that finds a
 * row asks the whole page rather than the one list, so what it comes back with is
 * held against that list before anything is written. A stranger's Place is not a
 * Place here, and a sequence written around one is a numbering the Author never
 * aimed at — one the endpoint would take, because it is still a permutation of
 * what the Scene holds.
 *
 * Taken out of where it was and put back where the row under the hand stands,
 * which is the Place the Author aimed at. Everything between the two shifts by
 * one, so a thing dragged across four of them passes them rather than swapping
 * with the last.
 */
function movedInto(ids: string[], id: string, onto: string) {
  if (!ids.includes(onto)) return

  const moved = ids.filter(other => other !== id)
  const later = ids.indexOf(id) < ids.indexOf(onto)
  moved.splice(moved.indexOf(onto) + (later ? 1 : 0), 0, id)

  return moved
}

/**
 * The Flags a Scene sets on entry, as the rows the Author wrote them in amount
 * to. What the rows leave out is what the server would refuse — a Flag with no
 * name, or none given a value yet — so the panel sends what is whole and the row
 * being written stays on screen.
 */
function writeFlags(scene: Scene, sets: Sets) {
  // Onto the fetched Scene as well as into the request, because the guided path
  // reads the Flags a Scene sets off the Story the page holds: left alone, the
  // Step that asks for one would go on asking after it was written.
  scene.sets = sets

  return write(() => send(`/api/scenes/${scene.id}/flags`, { method: 'PUT', body: { sets } }))
}

/**
 * Writes the whole list an Exit or a Shot carries, because that is what the
 * endpoint takes. `carrierId` is the Exit's or the Shot's, never the Story's,
 * which is what `id` means everywhere else here.
 */
function writeConditions(where: 'exits' | 'shots', carrierId: string, carried: Condition[]) {
  return write(() => send(`/api/${where}/${carrierId}/conditions`, {
    method: 'PUT',
    body: { conditions: wholeConditions(carried) },
  }))
}


</script>

<template>
  <!-- Where a Scene is written: the surface beside the graph folded into a rail.
       A group rather than a landmark — what holds it together is that it is one
       Scene being written, and it is named by that Scene. -->
  <div
    v-if="sceneWritten"
    class="panel"
    role="group"
    :aria-label="$t('editor.writingScene', { name: sceneWritten.name })"
  >
    <!-- Why the last change was refused, against the Scene it concerns: with
         one Scene on the surface the server has somewhere precise to complain,
         which is what `0011` gave up when it said a refusal about a Shot is
         shown against the whole Story. -->
    <Refusal :problem="problem" />

    <!-- The name is the heading and the heading is written in: a bare field,
         the same idiom as a Shot's text and an Exit's, with no mode to enter
         first.

         The label sits outside the heading rather than in it: a heading is
         named by what it holds, and a label inside would be read out ahead
         of the name the Author is correcting. Outside, the heading is the
         field's value and nothing else. It is also the one control here that
         does not carry the Scene's name after it — this field's own value is
         that name, and a label carrying it would rename the field under the
         Author as they typed. Which Scene the panel is on is what the panel
         itself is named. -->
    <label class="visually-hidden" :for="`scene-name-${sceneWritten.id}`">
      {{ $t('editor.sceneName') }}
    </label>
    <div class="heading">
      <h2 class="named">
        <input
          :id="`scene-name-${sceneWritten.id}`"
          v-model="sceneWritten.name"
          :maxlength="SCENE_NAME_MAX_LENGTH"
          @change="renameScene(sceneWritten)"
        >
      </h2>

      <!-- The writing is closed explicitly. Drawn at every width rather than
           only below the breakpoint: on a narrow screen it is the whole of the
           way out, because the surface covers the bench there and there is no
           bare bench left to press, and a control that came and went with the
           width would be one an Author had to learn twice. Beside the name
           rather than above it, because a row of its own at the head made the
           way out the first thing on a surface whose subject is what is written
           on it. -->
      <button
        type="button"
        class="close"
        :data-command="$t('editor.closePanel')"
        @click="$emit('close')"
      >
        {{ $t('editor.closePanel') }}
      </button>
    </div>

    <div class="standing">
      <!-- `data-step` is on the line rather than on the radio: the spotlight
           is a rectangle, and a radio's own is a dot beside the words that
           say what it marks. -->
      <p class="opening" data-step="opening-scene">
        <input
          :id="`opening-${sceneWritten.id}`"
          type="radio"
          name="opening-scene"
          :checked="story.openingSceneId === sceneWritten.id"
          @change="openOn(sceneWritten)"
        >
        <label class="eyebrow" :for="`opening-${sceneWritten.id}`">
          {{ $t('editor.openingScene') }}
          <span class="visually-hidden">{{ sceneWritten.name }}</span>
        </label>
      </p>

      <button
        type="button"
        class="danger"
        :data-command="$t('editor.deleteScene')"
        @click="deleteScene(sceneWritten)"
      >
        {{ $t('editor.deleteScene') }}
        <span class="visually-hidden">{{ sceneWritten.name }}</span>
      </button>
    </div>

    <!-- The Flags the Scene sets, at the head of the document because that is
         where they happen: they are set on entry, before a word of the Scene is
         played. On the surface rather than behind a tab, so a Condition further
         down and the Flags that satisfy it are read together — which is the
         whole point of taking the tabs out. -->
    <section class="held" :aria-labelledby="`flags-of-${sceneWritten.id}`">
      <h3 :id="`flags-of-${sceneWritten.id}`" class="eyebrow">
        {{ $t('editor.flagsHeld') }}
        <span class="numbered">{{ counted!.flags }}</span>
      </h3>

      <Flags
        data-step="scene-flags"
        :sets="sceneWritten.sets"
        :scene="sceneWritten.name"
        :id="sceneWritten.id"
        @write="writeFlags(sceneWritten, $event)"
      />
    </section>

    <!-- The body of the document: the run of beats, numbered from one for the
         Author though the Scene counts from zero, each number in the gutter
         where a frame's edge code would be. Typed as one text although it is one
         field per Shot — see `typeOn` — so nothing is parsed and no beat loses
         the Image and the Conditions it carries. -->
    <section class="held" :aria-labelledby="`shots-of-${sceneWritten.id}`">
      <h3 :id="`shots-of-${sceneWritten.id}`" class="eyebrow">
        {{ $t('editor.shotsHeld') }}
        <span class="numbered">{{ counted!.shots }}</span>
      </h3>

      <ol class="shots">
        <li
          v-for="(shot, place) in sceneWritten.shots"
          :key="shot.id"
          :data-shot="shot.id"
          :class="{
            dragged: draggedShot?.shotId === shot.id,
            under: draggedShot?.over === shot.id && draggedShot.shotId !== shot.id,
          }"
        >
          <!-- The number alone in the gutter, where a frame's edge code would
               be, and the word it is a number of kept for anyone listening. It
               is also the handle the Shot is dragged by: the gutter holds
               nothing else, and the number is what the Author refers to the
               Shot as, so there is no second grip to explain. -->
          <label
            class="shot-number"
            :for="`shot-${shot.id}`"
            @pointerdown="startShotDrag(shot, $event)"
            @pointermove="keepShotDrag"
            @pointerup="endShotDrag(sceneWritten)"
            @pointercancel="cancelShotDrag"
          >
            <span class="visually-hidden">{{ $t('editor.shot') }} </span>{{ place + 1 }}
          </label>
          <div class="written">
            <textarea
              :id="`shot-${shot.id}`"
              v-model="shot.text"
              data-step="shot-text"
              rows="2"
              :maxlength="SHOT_TEXT_MAX_LENGTH"
              @change="writeShot(shot)"
              @keydown="typeOn(sceneWritten, shot, place, $event)"
            />

            <!-- The thumbnail is the picker: pressing it is how an image is
                 attached and how it is replaced, and the input doing the work
                 is behind it, focusable and named as it was. A Shot carrying
                 no image shows the outline of the thumbnail it would have, so
                 one nobody has finished reads as unfinished. It is also where
                 a file is dropped, which is the same file the picker would
                 have handed over. -->
            <div class="image">
              <label
                :class="{ over: fileOver === shot.id }"
                @dragenter.prevent.stop="overImage(shot, $event)"
                @dragover.prevent.stop="overImage(shot, $event)"
                @dragleave="leaveImage(shot, $event)"
                @drop.prevent.stop="dropImage(shot, $event)"
              >
                <img
                  v-if="shot.image"
                  :src="imageOf(shot)"
                  :alt="$t('editor.imageOfShot', { place: place + 1 })"
                >
                <input
                  type="file"
                  class="visually-hidden"
                  :accept="SHOT_IMAGE_TYPES.join(',')"
                  :aria-label="$t('editor.pickImageOfShot', { place: place + 1 })"
                  @change="attachImage(shot, $event)"
                >
              </label>
            </div>

            <!-- The Description under the image it describes, across the width
                 of the beat: it is what the image shows, and there is nothing to
                 describe until one is attached. A Shot of text alone is not
                 asked for one. -->
            <p v-if="shot.image" class="described">
              <label class="eyebrow" :for="`description-${shot.id}`">
                {{ $t('editor.description') }}
                <span class="visually-hidden">
                  {{ $t('editor.descriptionOfShot', { place: place + 1 }) }}
                </span>
              </label>
              <input
                :id="`description-${shot.id}`"
                v-model="shot.description"
                type="text"
                :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
                :placeholder="$t('editor.whatTheImageShows')"
                @change="writeShot(shot)"
              >
            </p>

            <!-- The Conditions the Shot plays under, so a Scene can say
                 something different on a return visit without the Author
                 drawing a second Scene to hold the changed line.

                 The guided path points at the whole list rather than at one
                 field of it, because what it asks for is a Condition and a
                 Condition is the row it is added as: `data-step` lands on the
                 component's own root, which is that list. -->
            <!-- What the beat plays under and what is done to the beat, on one
                 line: a Shot carrying no Conditions — which is most of them —
                 spends one quiet row on the pair instead of a full-width button
                 and a row of marks under it. They part company the moment a
                 Condition is written, because a list of Conditions is a
                 column. -->
            <div class="beneath">
              <Conditions
                data-step="shot-condition"
                :lead="$t('editor.playedWhen')"
                :carrier="$t('editor.shotOfScene', {
                  place: place + 1,
                  scene: sceneWritten.name,
                })"
                :conditions="shot.conditions"
                :scenes="story.scenes"
                :counting="sceneWritten.id"
                :id="shot.id"
                @write="writeConditions('shots', shot.id, shot.conditions)"
              />

              <!-- The three controls, as the marks they do rather than the
                   sentences that name them: in the width the panel gives a Shot
                   the three sentences fill the strip to its end and wrap out of
                   it in the longer of the two languages. What each one says is
                   not lost, it moves to where the Shot's other names are read,
                   by assistive technology alone. -->
              <div class="row marks">
                <button
                  type="button"
                  :disabled="place === 0"
                  @click="moveShot(sceneWritten, shot, -1)"
                >
                  <span aria-hidden="true">↑</span>
                  <span class="visually-hidden">
                    {{ $t('common.moveEarlier') }}
                    {{ $t('editor.shotNumber', { place: place + 1 }) }}
                  </span>
                </button>
                <button
                  type="button"
                  :disabled="place === sceneWritten.shots.length - 1"
                  @click="moveShot(sceneWritten, shot, 1)"
                >
                  <span aria-hidden="true">↓</span>
                  <span class="visually-hidden">
                    {{ $t('common.moveLater') }}
                    {{ $t('editor.shotNumber', { place: place + 1 }) }}
                  </span>
                </button>
                <button type="button" class="danger" @click="deleteShot(shot)">
                  <span aria-hidden="true">×</span>
                  <span class="visually-hidden">
                    {{ $t('common.delete') }}
                    {{ $t('editor.shotNumber', { place: place + 1 }) }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <!-- The beat added by a hand rather than by a key. Enter at the end of the
           last beat is what an Author writing gets, and this is what an Author
           who has just opened a Scene with nothing in it gets — there is no beat
           to press Enter at the end of. -->
      <button
        type="button"
        class="add-shot"
        :data-command="$t('editor.addShot')"
        @click="addShot(sceneWritten)"
      >
        {{ $t('editor.addShot') }}
        <span class="visually-hidden">
          {{ $t('editor.toScene', { name: sceneWritten.name }) }}
        </span>
      </button>
    </section>

    <!-- The foot of the document: the ways on, in the Places the Scene offers
         them at, each with the Conditions it is offered under. Last because that
         is where a Reader meets them, and on the surface with everything else
         because a way on's Conditions test the Flags at the head of this very
         document. The Exit's text is written on the graph, where it can be seen
         leading somewhere. -->
    <section class="ways held" :aria-labelledby="`ways-of-${sceneWritten.id}`">
      <h3 :id="`ways-of-${sceneWritten.id}`" class="eyebrow">
        {{ $t('editor.waysHeld') }}
        <span class="numbered">{{ counted!.ways }}</span>
      </h3>

      <p v-if="!exitsFrom(story.exits, sceneWritten.id).length" class="none">
        {{ $t('editor.noWayOnYet') }}
      </p>
      <ol v-else :aria-labelledby="`ways-of-${sceneWritten.id}`">
        <li
          v-for="(exit, place) in exitsFrom(story.exits, sceneWritten.id)"
          :key="exit.id"
          :data-way="exit.id"
          :class="{
            dragged: draggedWay?.exitId === exit.id,
            under: draggedWay?.over === exit.id && draggedWay.exitId !== exit.id,
          }"
        >
          <!-- The Place alone in the gutter, where a Shot's number sits, and the
               handle the way on is dragged by: the row now holds a list of
               Conditions, so a drag anywhere on it would be a drag begun in the
               middle of a field. The two controls beside it are the same
               renumbering for a hand that wants no drag at all. -->
          <span
            class="numbered"
            @pointerdown="startWayDrag(exit, $event)"
            @pointermove="keepWayDrag"
            @pointerup="endWayDrag(sceneWritten)"
            @pointercancel="draggedWay = undefined"
          >{{ place + 1 }}</span>

          <div class="written">
            <!-- Where the way on leads, in the field that says so: a way on is
                 corrected here rather than only by dragging its endpoint across
                 the canvas, so a Story can be written and put right without ever
                 opening one. -->
            <p class="arrival">
              <label class="visually-hidden" :for="`leads-${exit.id}`">
                {{ $t('editor.wayOnLeadsTo', { place: place + 1, name: sceneWritten.name }) }}
              </label>
              <select
                :id="`leads-${exit.id}`"
                :value="exit.toSceneId"
                @change="leadExit(exit, ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="landing in mayLandOn(sceneWritten, exit.toSceneId)"
                  :key="landing.id"
                  :value="landing.id"
                >
                  {{ landing.name }}
                </option>
              </select>
            </p>

            <!-- The words the Reader reads on the button. Written here, with
                 where the way on leads beside it and the Conditions it is
                 offered under below, because those are the three things an Exit
                 is — and a way on written on the canvas was a way on an Author
                 who never opens one could not phrase at all. See
                 `docs/adr/0034-a-story-is-written-without-the-canvas.md`. -->
            <p class="said">
              <!-- The label is read by assistive technology alone: the field
                   stands beside the name of the Scene it leads to, and the
                   placeholder says what is written in it, so a label over it
                   would be the third thing on the row saying where the way on
                   goes. -->
              <label class="visually-hidden" :for="`exit-${exit.id}`">
                {{ $t('exit.to', { scene: sceneNames.get(exit.toSceneId) }) }}
              </label>
              <input
                :id="`exit-${exit.id}`"
                v-model="exit.text"
                :maxlength="EXIT_TEXT_MAX_LENGTH"
                :placeholder="$t('editor.whatTheReaderPresses')"
                @change="writeExitText(exit)"
              >
            </p>

            <!-- Named by the Place as well as by where it arrives: a Scene may
                 offer two ways on to the same Scene under opposite Conditions,
                 and the Place is what tells the two rows apart — on the bench it
                 is the disc on the line. -->
            <!-- What the way on is offered under, and what is done to the way
                 on, on one line — as they are on a beat, and for the same
                 reason: a way on carrying no Conditions is the ordinary way on,
                 and two rows of controls under two fields made a way on as tall
                 as a Scene. -->
            <div class="beneath">
              <Conditions
                :lead="$t('editor.offeredWhen')"
                :carrier="$t('editor.theWayOnTo', {
                  place: place + 1,
                  scene: sceneNames.get(exit.toSceneId),
                })"
                :conditions="exit.conditions"
                :scenes="story.scenes"
                :counting="sceneWritten.id"
                :id="exit.id"
                @write="writeConditions('exits', exit.id, exit.conditions)"
              />

              <div class="row marks">
                <button
                  type="button"
                  :disabled="place === 0"
                  @click="moveExit(sceneWritten, exit, -1)"
                >
                  {{ $t('common.moveEarlier') }}
                  <span class="visually-hidden">
                    {{ $t('editor.theWayOnTo', {
                      place: place + 1,
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
                <button
                  type="button"
                  :disabled="place === exitsFrom(story.exits, sceneWritten.id).length - 1"
                  @click="moveExit(sceneWritten, exit, 1)"
                >
                  {{ $t('common.moveLater') }}
                  <span class="visually-hidden">
                    {{ $t('editor.theWayOnTo', {
                      place: place + 1,
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
                <button type="button" @click="duplicateExit(sceneWritten, exit)">
                  <span aria-hidden="true">⧉</span>
                  <span class="visually-hidden">
                    {{ $t('editor.duplicateExitTo', {
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
                <button type="button" class="danger" @click="deleteExit(exit)">
                  <span aria-hidden="true">×</span>
                  <span class="visually-hidden">
                    {{ $t('common.delete') }}
                    {{ $t('editor.theWayOnTo', {
                      place: place + 1,
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
  </div>
            </div>
          </div>
        </li>
      </ol>

      <!-- A way on written from here: to a Scene the Story already holds, or to
           one that does not exist yet, which is the counterpart of dropping an
           Exit on the bare bench for an Author who never opens the canvas. A
           field that acts and forgets rather than one that holds an answer. -->
      <p class="adding">
        <label class="eyebrow" :for="`add-way-${sceneWritten.id}`">
          {{ $t('editor.addWayOn') }}
        </label>
        <select
          :id="`add-way-${sceneWritten.id}`"
          :value="adding"
          @change="addExit(sceneWritten, ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>{{ $t('editor.chooseWhereItLeads') }}</option>
          <option
            v-for="landing in mayLandOn(sceneWritten)"
            :key="landing.id"
            :value="landing.id"
          >
            {{ landing.name }}
          </option>
          <option :value="NEW_SCENE">{{ $t('editor.toANewScene') }}</option>
        </select>
      </p>
    </section>
  </div>
</template>

<style scoped>
/* The panel's heading, as it is written in: the field inside is the heading's own
   type on the panel's own ground — dressed as the heading it replaces, not as
   another box — and the line under it is all that says it is a field. Focus is
   left to the outline every control here is given. */
.named {
  min-inline-size: 0;
}

.named input {
  padding: 0 var(--s1);
  background: none;
}

/* Held off the pointer rather than restating what a hovered field looks like,
   so the frame that comes up is the one every other field here draws and the
   two cannot drift apart. */
.named input:not(:hover) {
  border-color: transparent;
  border-block-end-color: var(--edge);
}

.standing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
}

.opening {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

/* The three parts of the document, in the order a Reader meets them: the Flags
   set on entry, the run of beats, the ways on. Each one headed and counted where
   it starts, on a rule, so an Author scrolling knows which part of the Scene
   they are in — which is the whole of what the tabs were bought for, without
   what they cost. */
.held {
  display: grid;
  gap: var(--s2);
}

.held > h3 {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  padding-block-end: var(--s1);
  border-block-end: 1px solid var(--edge);
}

/* The count in the grease pencil, because what it counts is what the Author
   wrote on the film and not anything the machine is doing. */
.held > h3 .numbered {
  color: var(--grease);
}

/* The beat added by a hand, at the end of the run and no wider than the words on
   it: the ordinary way to add one is Enter, and a control across the whole
   surface would say otherwise. */
.add-shot {
  justify-self: start;
}

/* The run of Shots, each numbered in the gutter and separated from the next by a
   hairline — a Scene read the way a length of film is. Not to be read as the
   node's own strip, which is the column beside all of this. */
.shots {
  display: grid;
  gap: var(--s2);
}

.shots li {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr);
  gap: var(--s2);
  padding-block-end: var(--s3);
  border-block-end: 1px dashed color-mix(in oklab, var(--edge) 70%, transparent);
}

.shots li:last-child {
  border-block-end: none;
  padding-block-end: 0;
}

.shot-number {
  padding-block-start: var(--s2);
  font-family: var(--data);
  /* A Shot's number is what the Author refers to it by, so it is read at the
     same contrast as the rest of the labels and not dimmed to decoration. */
  color: var(--muted);
  font-size: 0.8125rem;
  letter-spacing: 0;
  text-align: end;
  font-variant-numeric: tabular-nums;
  /* The number is what the Shot is dragged by. No `touch-action` here, unlike the
     three gestures on the bench: a finger goes on scrolling the run, and reaches
     the same renumbering through the two controls under every Shot. What the
     number does refuse is being selected: a mouse held down on text drags a
     selection, and the browser scrolls the bench and the page after it — which is
     the graph moving under a gesture that is about one node's run. */
  user-select: none;
  cursor: grab;
}

/* The Shot in the hand, and the Shot whose Place it would take: the run says what
   the gesture is about to do before the Author lets go, as a way on being dragged
   does. The Place aimed at is washed in the grease pencil rather than outlined in
   it the way a way on is, because a row of the strip is a bordered thing and a
   Shot is a whole block of writing — the same mark, put where each can wear it. */
.shots li.dragged {
  opacity: 0.5;
}

.shots li.under {
  background: color-mix(in oklab, var(--grease) 12%, transparent);
}

/* A beat is a row and not a card. The text and the thumbnail stand side by side,
   the Description takes the line under them where there is an image to describe,
   and what the beat plays under shares the last line with the marks. A beat used
   to cost the better part of a screen — a field, a thumbnail on a line of its
   own, a full-width control that adds a Condition, and three buttons under that
   — which is why a Scene had to be folded into tabs at all. */
.written {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--s2);
}

.written textarea {
  font-size: 0.875rem;
}

/* Everything but the text and the thumbnail takes the whole row. */
.written > .described,
.written > .beneath {
  grid-column: 1 / -1;
}

/* An image is a thumbnail here and nothing more: it says which image the Shot
   carries, and leaves the panel's height to the beats, the Flags and the ways
   on. */
.image {
  display: grid;
}

/* What the beat plays under, and what is done to the beat: side by side, with
   the marks at the trailing edge. A beat carrying Conditions grows a column of
   them and the marks drop under it, which is the wrap doing the arithmetic. */
.beneath {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--s1) var(--s3);
}

.beneath .conditions {
  flex: 1 1 auto;
  min-inline-size: 0;
}

/* The thumbnail itself is what is pressed to attach an image or to replace one, so
   the box is the label and the input is clipped away inside it. Drawn whether or
   not there is an image to put in it: an empty one is the outline of the image the
   Shot has not attached, which is how an unfinished Shot reads as unfinished. */
.image > label {
  position: relative;
  display: block;
  inline-size: 4.5rem;
  block-size: 3rem;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  cursor: pointer;
}

/* The focus the input takes cannot be seen where the input is, so the ring is drawn
   round the box that is pressed instead. It is the one in `frameline.css`, restated
   here because `:has()` cannot reach back to a rule written for `:focus-visible`. */
.image > label:has(:focus-visible) {
  outline: 2px solid var(--light);
  outline-offset: 2px;
}

/* While a file is over the thumbnail: the grease pencil a dragged Shot and an Exit
   being drawn both wear, because it is the same promise — this is what letting go
   would do. Drawn in the tokens rather than left to the browser, which marks a drop
   target in nothing this room owns. */
.image > label.over {
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

/* The Description beside the image it describes, the label above the field, so
   the two read as one thing said about the image next to them. */
.described {
  display: grid;
  gap: var(--s1);
}

.described input {
  font-size: 0.8125rem;
}

.written .row {
  gap: var(--s1);
}

/* A Shot's three controls, each one mark wide: the square the words used to be
   pressed by, kept as a square rather than shrunk to the mark inside it, so the
   three sit on one line without asking a finger for more aim than before. */
.written .row.marks button {
  min-inline-size: 1.75rem;
  padding: var(--s1) var(--s2);
  font-size: 0.8125rem;
  line-height: 1.2;
}

/* The bare strip of the ways on leaving this Scene: a row apiece, and nothing
   between it and the Flags above it — the panel holds three things, and the space
   between them is what says so. */
.ways {
  display: grid;
  gap: var(--s1);
}

.ways ol {
  display: grid;
  gap: var(--s1);
}

/* A way on is laid out as a Shot is: its number in the gutter, and what is
   written about it beside — where it arrives, the Conditions it is offered
   under, and the two controls that renumber it. */
.ways li {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr);
  gap: var(--s2);
  padding-block-end: var(--s3);
  border-block-end: 1px dashed color-mix(in oklab, var(--edge) 70%, transparent);
}

.ways li:last-child {
  border-block-end: none;
  padding-block-end: 0;
}

/* Where the way on arrives, read as the line it is: the Scene's name, at the
   weight the Shots' own text is read at. */
.arrival {
  font-size: 0.8125rem;
}

/* The Place, in the grease pencil the disc on the line wears, so the number in
   the strip and the number on the bench read as the one number. It is also what
   the row is dragged by, and it refuses to be selected for the reason a Shot's
   number does: a mouse held down on text drags a selection and the page scrolls
   after it. */
.numbered {
  min-inline-size: 1.25rem;
  color: var(--grease);
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
  text-align: end;
  user-select: none;
  cursor: grab;
  /* Dragged rather than scrolled under a finger, the same as the gestures the
     bench carries. The two controls are the route for a hand that wants no drag
     at all. */
  touch-action: none;
}

/* The row in the hand, and the row whose Place it would take: the gesture says
   what it is about to do before the Author lets go, the same way the line being
   drawn does, and the same way a Shot being dragged does. */
.ways li.dragged {
  opacity: 0.5;
}

.ways li.under {
  background: color-mix(in oklab, var(--grease) 12%, transparent);
}

/* The two controls that renumber, held to the size the ones under a Shot are:
   they are the keyboard's way to do what the drag does. */
.ways li .row button {
  flex: none;
  padding: var(--s1) var(--s2);
  font-size: 0.6875rem;
}

/* A Scene is written at the width the folded graph leaves, which is the bench's
   own less the rail: writing is the state the bench is in rather than a strip at
   the edge of it. */
.panel {
  flex: 1;
  display: grid;
  gap: var(--s2);
  align-content: start;
  justify-items: start;
  min-inline-size: 0;
  /* The height of the bench, past which a Scene of twenty Shots scrolls inside
     itself rather than down the page. */
  block-size: var(--bench-height);
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

/* A way on reads across two columns of its row: where it leads, and what the
   Reader presses to take it. The Conditions and the marks take the whole width
   under them, as they do on a beat. */
.ways .written {
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
}

.ways .written > .beneath {
  grid-column: 1 / -1;
}

/* Where a way on leads, worn as the heading of its own row rather than as a
   field in a form: it is the name of a Scene, which is what an Author reads a way
   on by, and the rule under it is all that says it can be changed. */
.arrival select {
  padding: 0 var(--s1);
  border-color: transparent;
  border-block-end-color: var(--edge);
  background: none;
  font-size: 0.9375rem;
}

.arrival select:hover,
.arrival select:focus-visible {
  border-color: var(--edge);
}

/* The way on written from here, at the foot of the ways on: a label and a field,
   as narrow as the words in it — it is one control and not a section. */
.adding {
  display: grid;
  justify-items: start;
  gap: var(--s1);
}

.adding select {
  inline-size: fit-content;
  max-inline-size: 100%;
  padding: var(--s1) var(--s2);
  font-size: 0.875rem;
}

/* What a Reader reads on the button, in the width the row gives it: it is the
   Author's own words and the longest thing on the row. */
.said {
  display: grid;
  gap: var(--s1);
}

.said input {
  font-size: 0.875rem;
}

/* A row of controls, as the bench draws one everywhere it draws one. */
.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

/* What a Scene with no way on out of it says, in the voice the bench says the
   same of a Story with no Scene in it. */
.none {
  color: var(--muted);
  max-inline-size: 46ch;
}

/* Everything in the panel is one column of it, whatever the grid would rather do
   with a lone button. */
.panel > * {
  justify-self: stretch;
}

/* The Scene's name takes the line and the way out sits at the end of it: the
   name is what the surface is about, and a control that closes a thing belongs
   at the far edge of the thing it closes. */
.heading {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.heading .named {
  flex: 1;
}

.close {
  flex: none;
  padding: var(--s1) var(--s2);
  font-size: 0.7rem;
}

/* On a phone there is no room beside the graph, so the panel stops being a
   column of the bench and covers it instead — which is why it carries a control
   that closes it: on a wide screen the graph is still there to press. */
@media (max-width: 44rem) {
  .panel {
    position: fixed;
    inset: 0;
    z-index: 3;
    block-size: auto;
    /* The page's own margin, because at this width the panel *is* the page. */
    padding: var(--s4);
    border: none;
    border-radius: 0;
  }
}
</style>
