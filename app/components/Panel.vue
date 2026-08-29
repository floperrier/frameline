<script setup lang="ts">
/**
 * Where a Scene and an Exit are written: one panel docked at the trailing edge
 * of the bench, holding one or the other and never both — see
 * `docs/adr/0021-a-scene-is-written-in-a-panel-at-the-edge-of-the-bench.md`.
 *
 * Which of the two it holds is the page's to say, because the graph asks for it
 * from the other side of the bench: the panel is handed the Scene or the Exit and
 * says when it should be handed something else.
 *
 * Everything typed here is written into the Story the page fetched, in place, and
 * sent through the one holder the page keeps.
 */
const {
  story, sceneWritten, exitWritten, change, write, ask, announce, imageOf,
} = defineProps<{
  /** The Story being written, which a Condition reads its neighbours out of. */
  story: StoryInEditor
  /** The Scene the panel is writing, or nothing when it is writing an Exit. */
  sceneWritten?: Scene
  /** The Exit the panel is writing, and the two Scenes it joins by name. */
  exitWritten?: { exit: Exit, from: string, to: string }
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
 * What the panel asks of the page: the Scene or the Exit it should hold instead,
 * and the press that takes what is in it out. `attached` is the moment an image
 * landed, which the page holds because the card on the graph draws that image
 * too.
 */
const emit = defineEmits<{
  writeScene: [string]
  openExit: [string]
  close: []
  attached: [string]
}>()

const { t } = useI18n()

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

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

function addShot(scene: Scene) {
  return change(() => send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }))
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

/**
 * The sequence with one id moved a Place, which is what the two controls that
 * move a thing earlier or later send. Each is disabled at the end it cannot move
 * past, so the Place swapped with is always one of the sequence's own.
 */
function movedBy(ids: string[], id: string, step: -1 | 1) {
  const from = ids.indexOf(id)
  const moved = [...ids]
  moved[from] = ids[from + step]!
  moved[from + step] = id

  return moved
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

function moveExit(scene: Scene, exit: Exit, step: -1 | 1) {
  const ways = exitsFrom(story.exits, scene.id).map(held => held.id)

  return renumber(scene, 'exits', movedBy(ways, exit.id, step))
}

function writeExit(exit: Exit) {
  return write(() => send(`/api/exits/${exit.id}`, { method: 'PATCH', body: { text: exit.text } }))
}

/**
 * The way on being dragged within a Scene's strip, and the row the hand is over.
 * Held by Exit id and not by the Exit, the same trap the other two gestures avoid.
 */
const draggedWay = ref<{ exitId: string, over?: string }>()

/**
 * Whether the drag that has just ended renumbered anything. A row is pressed to
 * open an Exit and dragged to move it, so the click that follows a drag that moved
 * one has to be let go of: opening a panel on top of a renumbering is a second
 * answer to a gesture that already said what it meant.
 */
let renumberedByDrag = false

function startWayDrag(exit: Exit, event: PointerEvent) {
  // Capturing the pointer sends the rest of the gesture to the row itself, so the
  // hand can leave it for the row it is aiming at.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  draggedWay.value = { exitId: exit.id }
  renumberedByDrag = false
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

  // Let go of over a stranger's row nothing was renumbered, so the press that
  // follows is the press it started as and the Exit's own panel opens.
  renumberedByDrag = true

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
 * What a press on a row of the strip does. A drag that renumbered ends in a click
 * too, and that one opens nothing.
 */
function pressWay(exit: Exit) {
  const dragged = renumberedByDrag
  renumberedByDrag = false
  if (!dragged) return emit('openExit', exit.id)
}

/**
 * The Flags a Scene sets on entry, written as the Author typed them.
 *
 * ponytail: typed as text rather than edited a row apiece — one text field
 * instead of a whole repeatable form with a request per Flag. Give each Flag its
 * own row the day Authors trip over the separator.
 */
function writeFlags(scene: Scene, typed: string) {
  const sets = flagsTyped(typed)
  // Onto the fetched Scene as well as into the request, because the field is
  // drawn from what the Scene carries rather than bound to it: left alone, it
  // would go on showing the Flags the Author has just replaced. Writing them
  // here is also what keeps `courage=high` snapping to `courage = high`, which
  // used to be the refetch's doing.
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

/**
 * A list of Conditions with the half-written rows left out. A row whose Flag has
 * no name is half a Condition, which the server is right to refuse, and dropping
 * it beats holding back the rest — a Condition taken off has to reach the Story
 * whatever else the Author is in the middle of typing.
 *
 * One function, because every route that sends a list sends it from a panel the
 * Author may be halfway through: the row they are still naming would otherwise
 * take the whole list down with it, and an Exit duplicated at that moment would
 * arrive carrying nothing.
 */
function wholeConditions(carried: Condition[]) {
  return carried.filter(condition => !('flag' in condition) || condition.flag.trim())
}

/**
 * Writes a second Exit to the same Scene, carrying the Conditions of the first.
 * The gesture that draws an Exit will not land on a Scene the departing one already
 * reaches, which is what keeps a slip of the hand from making an accidental
 * duplicate — but two Exits to one Scene under opposite Conditions is what
 * Conditions on an Exit are for, so it is written on purpose from here: an Author
 * duplicates an Exit at the moment they mean to write its opposite Condition. See
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 *
 * The Conditions are copied and the text is not. The pair exists to be offered
 * under opposite tests, so the second is phrased from scratch, and the Condition
 * that makes it the opposite is the Author's next edit — in the duplicate's own
 * panel, which is theirs to open from the strip. This one stays on the Exit it was
 * duplicated from.
 *
 * The two writes are one change, and are not one transaction: Conditions refused
 * after the Exit was written leave a bare duplicate in the strip, which the Author
 * can go on writing or take away.
 */
function duplicateExit(exit: Exit) {
  const said = {
    from: sceneNamed(sceneNames.value, exit.fromSceneId, t),
    to: sceneNamed(sceneNames.value, exit.toSceneId, t),
  }
  const conditions = wholeConditions(exit.conditions)

  return change(async () => {
    const written = await send(`/api/scenes/${exit.fromSceneId}/exits`, {
      method: 'POST',
      body: { toSceneId: exit.toSceneId },
    }) as Exit

    if (conditions.length) {
      await send(`/api/exits/${written.id}/conditions`, { method: 'PUT', body: { conditions } })
    }

    announce(t('editor.exitDuplicated', said))
  })
}

/**
 * Takes an Exit away, from the panel it is written in. Nothing closes the panel
 * here: the read that follows is what takes the Exit out of the Story, and the
 * panel is drawn from the Exit it holds — so a delete that landed leaves nothing
 * to draw, and a refused one leaves the Author looking at the Exit they still
 * have.
 */
function deleteExit(exit: Exit) {
  return change(() => send(`/api/exits/${exit.id}`, { method: 'DELETE' }))
}

</script>

<template>
  <!-- Where a Scene and an Exit are written: one panel at the trailing edge of
       the bench, holding one or the other and never both. -->
  <!-- A group rather than a landmark: what holds it together is that it is
       one thing being written, and it is named by which thing that is. -->
  <div
    class="panel"
    role="group"
    :aria-label="sceneWritten
      ? $t('editor.writingScene', { name: sceneWritten.name })
      : $t('editor.writingExitTo', { scene: exitWritten!.to })"
  >
    <!-- The panel is closed explicitly. Drawn at every width rather than only
         below the breakpoint: on a narrow screen it is the whole of the way
         out, because the panel covers the bench there and there is no bare
         bench left to press, and a control that came and went with the width
         would be one an Author had to learn twice. -->
    <button type="button" class="close" @click="$emit('close')">
      {{ $t('editor.closePanel') }}
    </button>

    <template v-if="sceneWritten">
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
      <h2 class="named">
        <input
          :id="`scene-name-${sceneWritten.id}`"
          v-model="sceneWritten.name"
          :maxlength="SCENE_NAME_MAX_LENGTH"
          @change="renameScene(sceneWritten)"
        >
      </h2>

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

        <button type="button" class="danger" @click="deleteScene(sceneWritten)">
          {{ $t('editor.deleteScene') }}
          <span class="visually-hidden">{{ sceneWritten.name }}</span>
        </button>
      </div>

      <!-- The Shots as the run they are: numbered from one for the Author,
           though the Scene counts from zero, and each one's number sits in
           the gutter where the edge code would be. -->
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

              <!-- The Description beside the image it describes, in the width
                   the file chrome used to take: it is what the image shows,
                   and there is nothing to describe until one is attached. A
                   Shot of text alone is not asked for one. -->
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
            </div>

            <!-- The Conditions the Shot plays under, so a Scene can say
                 something different on a return visit without the Author
                 drawing a second Scene to hold the changed line.

                 The guided path points at the whole list rather than at one
                 field of it, because what it asks for is a Condition and a
                 Condition is the row it is added as: `data-step` lands on the
                 component's own root, which is that list. -->
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
        </li>
      </ol>

      <button type="button" @click="addShot(sceneWritten)">
        {{ $t('editor.addShot') }}
        <span class="visually-hidden">
          {{ $t('editor.toScene', { name: sceneWritten.name }) }}
        </span>
      </button>

      <p class="sets">
        <label class="eyebrow" :for="`flags-${sceneWritten.id}`">
          {{ $t('editor.flagsSet') }}
          <span class="visually-hidden">{{ sceneWritten.name }}</span>
        </label>
        <textarea
          :id="`flags-${sceneWritten.id}`"
          class="data"
          data-step="scene-flags"
          rows="3"
          :value="flagLines(sceneWritten.sets)"
          :placeholder="$t('editor.flagsPlaceholder', {
            separator: FLAG_SEPARATOR,
            values: FLAG_VALUES_SEPARATOR,
          })"
          @change="writeFlags(sceneWritten, ($event.target as HTMLTextAreaElement).value)"
        />
      </p>

      <!-- The ways on, bare: each one's Place, the name it arrives at, and the
           two controls that renumber it. An Exit's text and its Conditions are
           written in the panel a way on hands over to, and what stays here is
           what an Author cannot read an Exit without — where the Scene leads,
           and in what order — which is also the route to an Exit for a hand that
           is not on a pointer. -->
      <div class="ways">
        <p :id="`ways-${sceneWritten.id}`" class="eyebrow">
          {{ $t('editor.waysOn') }}
          <span class="visually-hidden">
            {{ $t('editor.fromScene', { name: sceneWritten.name }) }}
          </span>
        </p>

        <p v-if="!exitsFrom(story.exits, sceneWritten.id).length" class="none">
          {{ $t('editor.noWayOnYet') }}
        </p>
        <ol v-else :aria-labelledby="`ways-${sceneWritten.id}`">
          <li
            v-for="(exit, place) in exitsFrom(story.exits, sceneWritten.id)"
            :key="exit.id"
            :data-way="exit.id"
            :class="{
              dragged: draggedWay?.exitId === exit.id,
              under: draggedWay?.over === exit.id && draggedWay.exitId !== exit.id,
            }"
          >
            <!-- The row is pressed to write the Exit and dragged to renumber
                 it: one control, because the strip holds three things and a
                 fourth grip for the drag would be a way on read as a toolbar.
                 Its Place is the number it is offered at, so a row says which
                 Exit it is before it is opened. -->
            <button
              :id="`way-${exit.id}`"
              type="button"
              class="way"
              @pointerdown="startWayDrag(exit, $event)"
              @pointermove="keepWayDrag"
              @pointerup="endWayDrag(sceneWritten)"
              @pointercancel="draggedWay = undefined"
              @click="pressWay(exit)"
            >
              <span class="numbered">{{ place + 1 }}</span>
              {{ sceneNames.get(exit.toSceneId) }}
              <span class="visually-hidden">
                {{ $t('editor.wayOnFrom', { name: sceneWritten.name }) }}
              </span>
            </button>

            <button
              type="button"
              :disabled="place === 0"
              @click="moveExit(sceneWritten, exit, -1)"
            >
              {{ $t('common.moveEarlier') }}
              <span class="visually-hidden">
                {{ $t('editor.theExitTo', { scene: sceneNames.get(exit.toSceneId) }) }}
              </span>
            </button>
            <button
              type="button"
              :disabled="place === exitsFrom(story.exits, sceneWritten.id).length - 1"
              @click="moveExit(sceneWritten, exit, 1)"
            >
              {{ $t('common.moveLater') }}
              <span class="visually-hidden">
                {{ $t('editor.theExitTo', { scene: sceneNames.get(exit.toSceneId) }) }}
              </span>
            </button>
          </li>
        </ol>
      </div>
    </template>

    <template v-else-if="exitWritten">
      <!-- The Exit names the Scene it leaves, and the name is the way back: a
           Exit is written in the same panel the Scene was, so the panel that
           took the Scene's place hands it back. -->
      <button
        type="button"
        class="back trail"
        @click="$emit('writeScene', exitWritten.exit.fromSceneId)"
      >
        {{ $t('editor.backToScene', { name: exitWritten.from }) }}
      </button>

      <label class="eyebrow" :for="`exit-${exitWritten.exit.id}`">
        {{ $t('exit.to', { scene: exitWritten.to }) }}
      </label>
      <input
        :id="`exit-${exitWritten.exit.id}`"
        v-model="exitWritten.exit.text"
        :maxlength="EXIT_TEXT_MAX_LENGTH"
        @change="writeExit(exitWritten.exit)"
      >

      <Conditions
        :lead="$t('editor.offeredWhen')"
        :carrier="$t('editor.theExitTo', { scene: exitWritten.to })"
        :conditions="exitWritten.exit.conditions"
        :scenes="story.scenes"
        :counting="exitWritten.exit.fromSceneId"
        :id="exitWritten.exit.id"
        @write="writeConditions('exits', exitWritten.exit.id, exitWritten.exit.conditions)"
      />

      <!-- The deliberate route to a second way on to the same Scene, which the
           aiming gesture withholds so that the hand cannot draw one by
           accident. -->
      <button type="button" @click="duplicateExit(exitWritten.exit)">
        {{ $t('editor.duplicateExitTo', { scene: exitWritten.to }) }}
      </button>

      <button type="button" class="danger" @click="deleteExit(exitWritten.exit)">
        {{ $t('editor.deleteExitTo', { scene: exitWritten.to }) }}
      </button>
    </template>
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

/* Data the Author types rather than prose: the Flags a Scene sets. A Condition's
   own fields wear it inside the component that draws them. */
.data {
  font-family: var(--data);
  font-size: 0.8125rem;
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

.written {
  display: grid;
  gap: var(--s2);
}

.written textarea {
  font-size: 0.875rem;
}

/* An image is a thumbnail here and nothing more: it says which image the Shot
   carries, and leaves the panel's height to the Flags and the Exits. The
   Description sits beside it, in the width the browser's own file chrome used to
   take. */
.image {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--s2);
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

.sets {
  display: grid;
  gap: var(--s2);
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

.ways li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
}

/* One way on, read as the line it is rather than as a button: where it arrives,
   and the Place it is offered at in the gutter. The whole row is the target,
   because it is pressed to write the Exit and dragged to renumber it. */
.way {
  /* Narrow enough that the name and the two controls are one line of a node this
     width, and free to grow into what they leave: a long Scene name wraps inside
     the row rather than pushing a control onto a line of its own. */
  flex: 1 1 4rem;
  min-inline-size: 0;
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: var(--s1) var(--s2);
  font-size: 0.8125rem;
  font-weight: 400;
  text-align: start;
  cursor: grab;
  /* Dragged rather than scrolled under a finger, the same as the two gestures the
     bench already carries. */
  touch-action: none;
}

/* The Place, in the grease pencil the disc on the line wears, so the number in
   the node and the number on the bench read as the one number. */
.numbered {
  flex: none;
  min-inline-size: 1.25rem;
  color: var(--grease);
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

/* The row in the hand, and the row whose Place it would take: the gesture says
   what it is about to do before the Author lets go, the same way the line being
   drawn does. */
.ways li.dragged .way {
  opacity: 0.5;
}

.ways li.under .way {
  border-color: var(--grease);
}

/* The two controls that renumber, held to the size the ones under a Shot are:
   they are the keyboard's way to do what the drag does. */
.ways li button:not(.way) {
  flex: none;
  padding: var(--s1) var(--s2);
  font-size: 0.6875rem;
}

/* The panel a Scene or an Exit is written in, docked at the trailing edge of the
   bench. Three hundred and eighty pixels is a node's own width and a little over:
   wide enough for a Shot's text, its image and its Description on the lines they
   sit on inside a node today, and narrow enough to leave the graph most of the
   screen. It is as tall as the bench and scrolls inside itself, so a Scene of
   twenty Shots is read here rather than down the page. */
.panel {
  flex: none;
  display: grid;
  gap: var(--s2);
  align-content: start;
  justify-items: start;
  inline-size: 380px;
  /* As tall as what is being written and no taller, up to the height of the
     bench, past which it scrolls inside itself. An Exit is three controls and a
     line of text, so a panel held at the bench's full height would be mostly
     empty steel; a Scene of twenty Shots is read here rather than down the page. */
  max-block-size: var(--bench-height);
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
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

.close,
.back {
  justify-self: start;
}

/* On a phone there is no room beside the graph, so the panel stops being a
   column of the bench and covers it instead — which is why it carries a control
   that closes it: on a wide screen the graph is still there to press. */
@media (max-width: 44rem) {
  .panel {
    position: fixed;
    inset: 0;
    z-index: 3;
    inline-size: auto;
    block-size: auto;
    /* The page's own margin, because at this width the panel *is* the page. */
    padding: var(--s4);
    border: none;
    border-radius: 0;
  }
}
</style>
