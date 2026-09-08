<script setup lang="ts">
/**
 * Where a Scene is written: the gate, standing on the Graph in the place of the
 * node of the Scene it holds — see
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md`. Everything a Scene is
 * is written here — its name, the Flags it sets, the run of its Shots, and the
 * Exits leaving it, each named by where it leads — because a Story is written
 * without the canvas: `docs/adr/0034-a-story-is-written-without-the-canvas.md`,
 * and the Graph under it is a reading of the Story rather than a surface anything
 * is written on: `docs/adr/0041-the-graph-is-drawn-from-the-story.md`.
 *
 * The run of beats is one beat at a time in the gate — the frame at the size a
 * Reader meets it, and the words under it in the face they are read in — with the
 * whole run along the foot as the strip it is. It is still one document: the
 * three parts stay in the order a Reader meets them, and the run is still typed
 * as one text, `Enter` at the end of a beat opening the next.
 *
 * Which Scene it holds is the page's to say, because the Graph asks for it from
 * under the gate. Everything typed here is written into the Story the page
 * fetched, in place, and sent through the one holder the page keeps.
 */
const {
  story, sceneWritten, change, write, ask, announce, imageOf,
} = defineProps<{
  /** The Story being written, which a Condition reads its neighbours out of. */
  story: StoryInEditor
  /** The Scene being written. */
  sceneWritten: Scene
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
   * Why the last change was refused, against the one Scene on screen: the server
   * complaining about a Shot has a Scene to complain against here.
   */
  problem?: Problem
}>()

/**
 * What the document asks of the page: `attached` the moment an image landed,
 * which the page holds because the node on the Graph draws the image too; `open`
 * the Scene it wants on the surface next — where a way on leads, or the half a
 * split has just made — and whether its name is to be selected for typing over.
 */
const emit = defineEmits<{ attached: [string], open: [string, boolean?] }>()

const { t } = useI18n()

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

/** The ways on leaving the Scene, in the Places it numbers them at. */
const ways = computed(() => exitsFrom(story.exits, sceneWritten.id))

/**
 * Which beat of the run is in the gate, as its Place counted from zero. The
 * strip is what moves it, and so does every act that writes a beat: a Scene put
 * on the bench opens at its first beat, which is where a Reader meets it.
 */
const atShot = ref(0)

watch(() => sceneWritten.id, () => { atShot.value = 0 })

/**
 * Which beat of the run the gate is actually holding, held to the run as it
 * stands: a beat deleted from the end leaves the gate on the one before it
 * rather than on a Place the Scene no longer has, and every mark beside the gate
 * is named for this rather than for what was asked for.
 */
const gated = computed(() =>
  Math.max(0, Math.min(atShot.value, sceneWritten.shots.length - 1)))

/** The beat in the gate, and nothing at all in a Scene with no beats yet. */
const shotWritten = computed(() => sceneWritten.shots[gated.value])

/** Puts one beat of the run in the gate. */
function gateShot(place: number) {
  atShot.value = place
}

/**
 * How many Flags, Shots and words the Scene holds, said beside each heading of
 * the document. The words are the one count an Author writing prose asks for,
 * and no tool this one stands beside gives it; the Shots are the count the
 * node on the Graph gives, so the two cannot say two things.
 */
const counted = computed(() => ({
  flags: Object.keys(sceneWritten.sets).length,
  shots: sceneWritten.shots.length,
  words: countedWords(wordsOf(sceneWritten.shots), t),
}))

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
  return change(() => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

function renameScene(scene: Scene) {
  return write(() => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { name: scene.name },
  }))
}

/**
 * Adds a beat at the end of the Scene, where the hand adds one: the control
 * under the run. The key adds one where the caret is — see `openBeat`.
 */
async function addShot(scene: Scene) {
  let writtenId: string | undefined
  await change(async () => {
    writtenId = (await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot).id
  })

  if (writtenId) return typeInShot(writtenId)
}

/**
 * The run of beats is typed as one document although it stays one field per
 * Shot: `Enter` at the end of a beat opens the next, `Backspace` at the head of
 * an empty one joins it to the one before, `Alt+↑`/`Alt+↓` walk the caret. See
 * `docs/adr/0033-a-scene-is-written-as-one-document.md`. Every one of them is a
 * control on the surface too — a key nobody can see is not the only way in.
 */
function typeOn(scene: Scene, shot: Shot, place: number, event: KeyboardEvent) {
  const field = event.target as HTMLTextAreaElement

  // Shift+Enter is how every field in every editor writes a second line.
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
 * Whether a beat holds nothing the Author would miss. Backspace takes it away
 * without asking, which is what the key does to an empty paragraph everywhere,
 * so only where nothing but the caret is on it: an Image or a Condition took
 * thought, and a beat carrying either is deleted by the mark at the end of its
 * row instead.
 */
function emptied(shot: Shot) {
  return !shot.text && !shot.image && !shot.conditions.length
}

/**
 * Enter: the next beat, written where the caret is rather than at the end. Two
 * requests inside one change — the seam
 * `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` accepted,
 * for the same reason: a third endpoint that inserted would copy rules both
 * already enforce. At the end of the run — where an Author writing forwards
 * spends all their time — nothing is renumbered.
 */
async function openBeat(scene: Scene, shot: Shot, place: number) {
  let writtenId: string | undefined

  await change(async () => {
    // What is in the field goes first, or the beat the Author just finished is
    // written after the one that follows it and the run reads back stale.
    await send(`/api/shots/${shot.id}`, {
      method: 'PATCH',
      body: { text: shot.text, description: shot.description },
    })

    const written = await send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }) as Shot
    if (place !== scene.shots.length - 1) {
      const places = scene.shots.map(held => held.id)
      places.splice(place + 1, 0, written.id)
      await send(`/api/scenes/${scene.id}/shots/places`, { method: 'PUT', body: { places } })
    }

    writtenId = written.id
  })

  if (writtenId) return typeInShot(writtenId)
}

/** Backspace at the head of an empty beat: it goes, and the caret lands at the end of the one before. */
async function joinBeat(scene: Scene, shot: Shot, place: number) {
  const before = scene.shots[place - 1]

  await change(() => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
  if (before) return typeInShot(before.id, true)
}

/**
 * Puts the caret in a Shot's field, once the read the change asks for has
 * rendered it. There is one such field — the gate's — so the beat is put in the
 * gate first: walking the run with `Alt` and the arrows, opening a beat with
 * `Enter`, joining one to the beat before it with `Backspace` all move the gate
 * as well, because the caret and the frame are never on two different beats.
 */
async function typeInShot(shotId: string, atTheEnd = false) {
  await nextTick()
  const place = sceneWritten.shots.findIndex(held => held.id === shotId)
  if (place === -1) return

  gateShot(place)
  await nextTick()

  const field = document.getElementById(`shot-${shotId}`) as HTMLTextAreaElement | null
  if (!field) return

  field.focus()
  if (atTheEnd) field.setSelectionRange(field.value.length, field.value.length)
}

/** Writes what the Author typed about one Shot — its text and its image's Description — in one request. */
function writeShot(shot: Shot) {
  return write(() => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description },
  }))
}

/** Writes a whole sequence of Places, which is the only way one is written. */
function renumber(scene: Scene, what: 'shots' | 'exits', places: string[]) {
  return change(
    () => send(`/api/scenes/${scene.id}/${what}/places`, { method: 'PUT', body: { places } }),
  )
}

function moveShot(scene: Scene, shot: Shot, step: -1 | 1) {
  return renumber(scene, 'shots', movedBy(scene.shots.map(held => held.id), shot.id, step))
}

/**
 * Splits the Scene in two before one of its Shots: the beats from that one on
 * become a Scene of their own, every way on out of here moves to it, and one
 * Exit joins the two halves — so a Reading plays exactly what it played, with
 * one press between. It is the act
 * `docs/adr/0001-branching-only-between-scenes.md` owed: an Author who wants
 * the Story to branch in the middle of a Scene splits it here and writes the
 * second way on out of the first half.
 *
 * The new half arrives under a provisional name made of this one's, and is
 * opened with that name selected, so the first thing typed replaces it.
 */
async function splitBefore(scene: Scene, shot: Shot) {
  const name = t('editor.splitSceneName', { name: scene.name }).slice(0, SCENE_NAME_MAX_LENGTH)
  let writtenId: string | undefined

  await change(async () => {
    const written = await send(`/api/scenes/${scene.id}/split`, {
      method: 'POST',
      body: { shotId: shot.id, name },
    }) as Pick<Scene, 'id' | 'name'>

    writtenId = written.id
    announce(t('editor.sceneSplit', { name: scene.name, to: name }))
  })

  if (writtenId) emit('open', writtenId, true)
}

/**
 * The Shot dragged along the strip, and the Shot the hand is over. Held by id and
 * not by Shot: the read that lands mid-drag replaces every Scene in the Story.
 */
const draggedShot = ref<{ shotId: string, over?: string }>()

/**
 * The band at either end of the strip where a dragged Shot winds the run under
 * it, and how fast: about the width of a cell, at five hundred pixels a second.
 * Under `prefers-reduced-motion` the run still travels the same distance in the
 * same time, a cell at a stride every fifth of a second instead of a few pixels
 * a frame.
 */
const STRIP_SCROLL_BAND = 64
const STRIP_SCROLL_TICK = 16
const STRIP_SCROLL_STEP = 8
const STRIP_SCROLL_STILL_TICK = 200
const STRIP_SCROLL_STILL_STEP = 100

let stripScroll: {
  strip: HTMLElement
  step: number
  at: { clientX: number, clientY: number }
  tick: ReturnType<typeof setInterval>
} | undefined

/**
 * Which way the strip under the hand should be winding, measured against what is
 * on screen of it rather than the whole run: a band off the end of the window
 * would be one the hand could never reach.
 */
function stripScrollWay(strip: HTMLElement, x: number) {
  const box = strip.getBoundingClientRect()
  const start = Math.max(box.left, 0)
  const finish = Math.min(box.right, window.innerWidth)
  if (x >= start && x < start + STRIP_SCROLL_BAND) return -1
  if (x <= finish && x > finish - STRIP_SCROLL_BAND) return 1

  return 0
}

function runStripScroll() {
  const run = stripScroll
  if (!run || !draggedShot.value) return

  const way = stripScrollWay(run.strip, run.at.clientX)
  if (!way) return

  run.strip.scrollLeft += way * run.step
  draggedShot.value.over = cellUnder(run.at)
}

function stopStripScroll() {
  if (stripScroll) clearInterval(stripScroll.tick)
  stripScroll = undefined
}

onBeforeUnmount(stopStripScroll)

function startShotDrag(shot: Shot, event: PointerEvent) {
  // A finger winds the strip instead: the two controls move a Shot a Place
  // without a drag, so touch keeps the whole route and loses only the shortcut.
  if (event.pointerType === 'touch') return

  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  draggedShot.value = { shotId: shot.id }

  const strip = handle.closest('.strip')
  if (!(strip instanceof HTMLElement)) return

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  stripScroll = {
    strip,
    step: still ? STRIP_SCROLL_STILL_STEP : STRIP_SCROLL_STEP,
    at: { clientX: event.clientX, clientY: event.clientY },
    tick: setInterval(runStripScroll, still ? STRIP_SCROLL_STILL_TICK : STRIP_SCROLL_TICK),
  }
}

function keepShotDrag(event: PointerEvent) {
  if (!draggedShot.value) return
  draggedShot.value.over = cellUnder(event)
  if (stripScroll) stripScroll.at = { clientX: event.clientX, clientY: event.clientY }
}

function cancelShotDrag() {
  stopStripScroll()
  draggedShot.value = undefined
}

function endShotDrag(scene: Scene) {
  const dragged = draggedShot.value
  cancelShotDrag()
  if (!dragged?.over || dragged.over === dragged.shotId) return

  const places = movedInto(scene.shots.map(held => held.id), dragged.shotId, dragged.over)
  if (!places) return

  return renumber(scene, 'shots', places)
}

/** The Shot's cell under a point, asked of the page: the browser already hit-tests them. */
function cellUnder(at: { clientX: number, clientY: number }) {
  const under = document.elementFromPoint(at.clientX, at.clientY)
  return (under?.closest('[data-shot]') as HTMLElement | null)?.dataset.shot
}

/**
 * The sequence with one thing dropped onto another's Place, or nothing where the
 * row under the hand is not one of this Scene's own. Taken out where it was and
 * put back where the row under the hand stands, so everything between shifts by
 * one rather than swapping with the last.
 */
function movedInto(ids: string[], id: string, onto: string) {
  if (!ids.includes(onto)) return

  const moved = ids.filter(other => other !== id)
  const later = ids.indexOf(id) < ids.indexOf(onto)
  moved.splice(moved.indexOf(onto) + (later ? 1 : 0), 0, id)

  return moved
}

/** Attaches an image, sent as the whole request body: picked or dropped, it is the same file to the same endpoint. */
function attach(shot: Shot, file: File) {
  return change(async () => {
    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: file })
    emit('attached', shot.id)
  })
}

/** The picker is cleared afterwards, so picking the same file twice is a change twice. */
function attachImage(shot: Shot, event: Event) {
  const picker = event.target as HTMLInputElement
  const picked = picker.files?.[0]
  if (!picked) return
  picker.value = ''

  return attach(shot, picked)
}

/** The Shot whose thumbnail a file is over, held by id for the reason the drags are. */
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
 * The Scenes a way on from this Scene may land on: every one bar itself and
 * the ones it already reaches. What the field offers, not what it refuses: the
 * server allows both slips, and a name typed in full is written on purpose.
 * `led` is the Scene a way on already arrives at, which belongs in its own
 * field although a new way on may not land there.
 */
function mayLandOn(scene: Scene, led?: string) {
  const landing = scenesAExitMayLandOn(story.scenes, story.exits, scene.id)

  return story.scenes.filter(other => landing.has(other.id) || other.id === led)
}

/** Where a way on leads, changed in the field that says where it leads: the Exit keeps its text, its Conditions and its Place. */
function leadExit(exit: Exit, toSceneId: string) {
  if (!toSceneId || toSceneId === exit.toSceneId) return

  return change(() => send(`/api/exits/${exit.id}/scene`, {
    method: 'PUT',
    body: { toSceneId },
  }))
}

/**
 * Writes a second way on to the same Scene, carrying the Conditions of the
 * first: two ways on to one Scene under opposite Conditions is what Conditions
 * on an Exit are for, so it is written on purpose here. The text is not copied
 * — the second is offered under opposite tests and phrased from scratch.
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

/** No confirmation: the control is named for what it takes, which is not the slip of a hand. */
function deleteExit(exit: Exit) {
  return change(() => send(`/api/exits/${exit.id}`, { method: 'DELETE' }))
}

/**
 * What the field at the foot of the ways on holds while a name is being typed
 * into it. The field acts and then forgets, so it never stands holding the
 * last thing it did.
 */
const adding = ref('')

/**
 * A way on written by naming where it leads. A name that answers to a Scene of
 * the Story — compared the way the bar of Commands compares names, so *cafe*
 * finds *Le café* — joins the two; a name nothing answers to writes a Scene
 * under it and joins that, which is how every Scene after the first is born.
 * Either way the hand is put on the new way on's text, which is the next thing
 * to write: the Author has just said where it leads, and what the Reader
 * presses is the other half of it.
 *
 * The two writes of a new Scene are one change and not one transaction, the
 * seam `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md`
 * accepted. Reached by `change` and by `submit` both, because a name picked
 * from the list fires the one and a name typed and entered fires the other —
 * and sometimes both, which is why the field is emptied before anything waits.
 */
async function addExit(scene: Scene) {
  const name = adding.value.trim()
  adding.value = ''
  if (!name) return

  const found = story.scenes.find(other => plainly(other.name) === plainly(name))
  let writtenId: string | undefined

  await change(async () => {
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
function writeExitText(exit: Exit) {
  return write(() => send(`/api/exits/${exit.id}`, { method: 'PATCH', body: { text: exit.text } }))
}

function moveExit(scene: Scene, exit: Exit, step: -1 | 1) {
  return renumber(scene, 'exits', movedBy(ways.value.map(held => held.id), exit.id, step))
}

/**
 * The Flags the Scene sets on entry, as the rows the Author wrote them in
 * amount to. Written onto the fetched Scene as well, because the guided path
 * reads the Flags off the Story the page holds.
 */
function writeFlags(scene: Scene, sets: Sets) {
  scene.sets = sets

  return write(() => send(`/api/scenes/${scene.id}/flags`, { method: 'PUT', body: { sets } }))
}

/** Writes the whole list an Exit or a Shot carries, which is what the endpoint takes. */
function writeConditions(where: 'exits' | 'shots', carrierId: string, carried: Condition[]) {
  return write(() => send(`/api/${where}/${carrierId}/conditions`, {
    method: 'PUT',
    body: { conditions: wholeConditions(carried) },
  }))
}
</script>

<template>
  <!-- The document of one Scene: a group named by the Scene, because it holds
       together everything about it. -->
  <div class="panel" role="group" :aria-label="$t('editor.writingScene', { name: sceneWritten.name })">
    <Refusal :problem="problem" />

    <!-- The name is the heading and the heading is written in: a bare field, the
         same idiom as a Shot's text, with no mode to enter first. -->
    <label class="visually-hidden" :for="`scene-name-${sceneWritten.id}`">
      {{ $t('editor.sceneName') }}
    </label>
    <!-- The name, what the Scene stands for in the Story and the one act that
         takes it away, on one line: the slate at the head of the document, read
         before anything under it and never a second row of chrome. -->
    <div class="heading">
      <h2 class="named">
        <input
          :id="`scene-name-${sceneWritten.id}`"
          v-model="sceneWritten.name"
          :maxlength="SCENE_NAME_MAX_LENGTH"
          @change="renameScene(sceneWritten)"
        >
      </h2>

      <!-- A Command only where the press does something: the radio already
           checked answers a press with no `change` at all. -->
      <p class="opening" data-step="opening-scene">
        <input
          :id="`opening-${sceneWritten.id}`"
          type="radio"
          name="opening-scene"
          :checked="story.openingSceneId === sceneWritten.id"
          :data-command="story.openingSceneId === sceneWritten.id
            ? undefined
            : $t('editor.markOpeningScene')"
          @change="openOn(sceneWritten)"
        >
        <label class="eyebrow" :for="`opening-${sceneWritten.id}`">
          {{ $t('editor.openingScene') }}
          <span class="visually-hidden">{{ sceneWritten.name }}</span>
        </label>
      </p>

      <button
        type="button"
        class="danger going"
        :data-command="$t('editor.deleteScene')"
        @click="deleteScene(sceneWritten)"
      >
        {{ $t('editor.deleteScene') }}
        <span class="visually-hidden">{{ sceneWritten.name }}</span>
      </button>
    </div>

    <!-- The Flags the Scene sets, at the head of the document where they happen:
         set on entry, before the first Shot plays. On one line with its heading
         while the Scene sets none — which is most Scenes — because the frame
         under it is what the gate is for. -->
    <section class="held set" :aria-labelledby="`flags-of-${sceneWritten.id}`">
      <h3 :id="`flags-of-${sceneWritten.id}`">
        {{ $t('editor.flagsHeld') }}
        <span class="counted">{{ counted.flags }}</span>
      </h3>

      <Flags
        data-step="scene-flags"
        :sets="sceneWritten.sets"
        :scene="sceneWritten.name"
        :id="sceneWritten.id"
        @write="writeFlags(sceneWritten, $event)"
      />
    </section>

    <!-- The run of beats: the one in the gate at the size a Reader meets it — the
         frame, and the words under it in the face they are read in — and the
         whole run along the foot as the strip it is. Still typed as one text, and
         still one field per Shot: the field is the gate's, and walking the run
         moves the gate with the caret. Counted twice: in Shots, which is what the
         node says, and in words, which is what a writer asks. -->
    <section class="held run" :aria-labelledby="`shots-of-${sceneWritten.id}`">
      <h3 :id="`shots-of-${sceneWritten.id}`">
        {{ $t('editor.shotsHeld') }}
        <span class="counted">{{ counted.shots }}</span>
        <span class="counted words">{{ counted.words }}</span>
      </h3>

      <p v-if="!shotWritten" class="none">{{ $t('editor.noShotYet') }}</p>

      <div v-else class="looking">
        <!-- The gate proper: exactly what a Reader is shown of this beat, and the
             field the Author types it in. -->
        <div class="lit">
          <!-- The frame is pressed to attach an image or replace one: the box is
               a label and the input is clipped away inside it. Drawn whether or
               not there is an image in it, so an unfinished beat reads as
               unfinished. -->
          <label
            class="image"
            :class="{ over: fileOver === shotWritten.id }"
            @dragenter.prevent.stop="overImage(shotWritten, $event)"
            @dragover.prevent.stop="overImage(shotWritten, $event)"
            @dragleave="leaveImage(shotWritten, $event)"
            @drop.prevent.stop="dropImage(shotWritten, $event)"
          >
            <img
              v-if="shotWritten.image"
              :src="imageOf(shotWritten)"
              :alt="$t('editor.imageOfShot', { place: gated + 1 })"
            >
            <input
              type="file"
              class="visually-hidden"
              :accept="SHOT_IMAGE_TYPES.join(',')"
              :aria-label="$t('editor.pickImageOfShot', { place: gated + 1 })"
              @change="attachImage(shotWritten, $event)"
            >
          </label>

          <label class="visually-hidden" :for="`shot-${shotWritten.id}`">
            {{ $t('editor.shotNumber', { place: gated + 1 }) }}
          </label>
          <textarea
            :id="`shot-${shotWritten.id}`"
            v-model="shotWritten.text"
            data-step="shot-text"
            class="prose"
            rows="2"
            :lang="story.language"
            :maxlength="SHOT_TEXT_MAX_LENGTH"
            @change="writeShot(shotWritten)"
            @keydown="typeOn(sceneWritten, shotWritten, gated, $event)"
          />
        </div>

        <!-- What the machine has to say about the beat in the gate, and what is
             done to it rather than written in it: beside the gate, so the gate
             holds the work and nothing else. -->
        <aside class="machine">
          <!-- What the image shows, for a Reader who cannot see it: nothing to
               describe until one is attached. -->
          <p v-if="shotWritten.image" class="described">
            <label class="eyebrow" :for="`description-${shotWritten.id}`">
              {{ $t('editor.description') }}
              <span class="visually-hidden">
                {{ $t('editor.descriptionOfShot', { place: gated + 1 }) }}
              </span>
            </label>
            <input
              :id="`description-${shotWritten.id}`"
              v-model="shotWritten.description"
              type="text"
              :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
              :placeholder="$t('editor.whatTheImageShows')"
              @change="writeShot(shotWritten)"
            >
          </p>

          <!-- The marks act on the beat in the gate, which is the beat they are
               beside: the scissors split the Scene before it, which the first
               beat has nothing before it to be split from. -->
          <div class="row">
            <button
              v-if="gated > 0"
              type="button"
              class="mark"
              @click="splitBefore(sceneWritten, shotWritten)"
            >
              <span aria-hidden="true">✂</span>
              <span class="visually-hidden">
                {{ $t('editor.splitBefore', { place: gated + 1 }) }}
              </span>
            </button>
            <button
              type="button"
              class="mark"
              :disabled="gated === 0"
              @click="moveShot(sceneWritten, shotWritten, -1)"
            >
              <span aria-hidden="true">↑</span>
              <span class="visually-hidden">
                {{ $t('common.moveEarlier') }}
                {{ $t('editor.shotNumber', { place: gated + 1 }) }}
              </span>
            </button>
            <button
              type="button"
              class="mark"
              :disabled="gated === sceneWritten.shots.length - 1"
              @click="moveShot(sceneWritten, shotWritten, 1)"
            >
              <span aria-hidden="true">↓</span>
              <span class="visually-hidden">
                {{ $t('common.moveLater') }}
                {{ $t('editor.shotNumber', { place: gated + 1 }) }}
              </span>
            </button>
            <button type="button" class="danger mark" @click="deleteShot(shotWritten)">
              <span aria-hidden="true">×</span>
              <span class="visually-hidden">
                {{ $t('common.delete') }}
                {{ $t('editor.shotNumber', { place: gated + 1 }) }}
              </span>
            </button>
          </div>
        </aside>
      </div>

      <!-- What the beat plays under, across the width of the gate: a Condition is
           a sentence and reads as one, which a column twelve rems wide is not. -->
      <Conditions
        v-if="shotWritten"
        data-step="shot-condition"
        :lead="$t('editor.playedWhen')"
        :carrier="$t('editor.shotOfScene', {
          place: gated + 1,
          scene: sceneWritten.name,
        })"
        :conditions="shotWritten.conditions"
        :scenes="story.scenes"
        :counting="sceneWritten.id"
        :id="shotWritten.id"
        @write="writeConditions('shots', shotWritten.id, shotWritten.conditions)"
      />

      <!-- The strip: the whole run, wound under the gate. A cell is dragged to
           another Place by the same grip that puts it in the gate — it is what the
           Author refers to the beat as, so there is no second grip to explain.
           Unmarked for the bar of Commands: which beat is in the gate is where the
           Author is standing rather than an act they would say out loud, the way
           the marks that renumber a row are pressed beside the row. -->
      <ol class="strip">
        <li
          v-for="(shot, place) in sceneWritten.shots"
          :key="shot.id"
          :data-shot="shot.id"
          :class="{
            dragged: draggedShot?.shotId === shot.id,
            under: draggedShot?.over === shot.id && draggedShot.shotId !== shot.id,
          }"
        >
          <button
            type="button"
            class="cell"
            :aria-label="$t('editor.writeShot', { place: place + 1 })"
            :aria-current="place === gated ? 'true' : undefined"
            @click="gateShot(place)"
            @pointerdown="startShotDrag(shot, $event)"
            @pointermove="keepShotDrag"
            @pointerup="endShotDrag(sceneWritten)"
            @pointercancel="cancelShotDrag"
          >
            <span class="cut" aria-hidden="true">
              <img v-if="shot.image" :src="imageOf(shot)" alt="" draggable="false">
            </span>
            <span class="no" aria-hidden="true">{{ place + 1 }}</span>
          </button>
        </li>

        <!-- A beat added by hand rather than by key: what an Author who has just
             opened a Scene with nothing in it gets, since there is no beat to
             press Enter at the end of. -->
        <li>
          <button
            type="button"
            class="cell more"
            :data-command="$t('editor.addShot')"
            @click="addShot(sceneWritten)"
          >
            <span class="cut" aria-hidden="true">+</span>
            <span class="no" aria-hidden="true">{{ $t('editor.add') }}</span>
            <span class="visually-hidden">
              {{ $t('editor.addShot') }}
              {{ $t('editor.toScene', { name: sceneWritten.name }) }}
            </span>
          </button>
        </li>
      </ol>
    </section>

    <!-- The foot of the document: the ways on, in the Places the Scene offers
         them at, each with the Conditions it is offered under. Last because that
         is where the Reader meets them. -->
    <section class="held ways" :aria-labelledby="`ways-of-${sceneWritten.id}`">
      <h3 :id="`ways-of-${sceneWritten.id}`">
        {{ $t('editor.waysHeld') }}
        <span class="counted">{{ ways.length }}</span>
      </h3>

      <p v-if="!ways.length" class="none">{{ $t('editor.noWayOnYet') }}</p>
      <ol v-else :aria-labelledby="`ways-of-${sceneWritten.id}`">
        <li v-for="(exit, place) in ways" :key="exit.id" :data-way="exit.id">
          <span class="numbered">{{ place + 1 }}</span>

          <div class="written">
            <!-- Where the way on leads, in a field that says so, and beside it
                 the mark that goes there: the Scene at the far end is one press
                 away from the document that names it. -->
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
              <button
                type="button"
                class="mark"
                @click="emit('open', exit.toSceneId)"
              >
                <span aria-hidden="true">→</span>
                <span class="visually-hidden">
                  {{ $t('editor.goToScene', { name: sceneNames.get(exit.toSceneId) }) }}
                </span>
              </button>
            </p>

            <!-- The words the Reader reads on the button. -->
            <p class="said">
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

              <div class="row">
                <button
                  type="button"
                  class="mark"
                  :disabled="place === 0"
                  @click="moveExit(sceneWritten, exit, -1)"
                >
                  <span aria-hidden="true">↑</span>
                  <span class="visually-hidden">
                    {{ $t('common.moveEarlier') }}
                    {{ $t('editor.theWayOnTo', {
                      place: place + 1,
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
                <button
                  type="button"
                  class="mark"
                  :disabled="place === ways.length - 1"
                  @click="moveExit(sceneWritten, exit, 1)"
                >
                  <span aria-hidden="true">↓</span>
                  <span class="visually-hidden">
                    {{ $t('common.moveLater') }}
                    {{ $t('editor.theWayOnTo', {
                      place: place + 1,
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
                <button type="button" class="mark" @click="duplicateExit(sceneWritten, exit)">
                  <span aria-hidden="true">⧉</span>
                  <span class="visually-hidden">
                    {{ $t('editor.duplicateExitTo', {
                      scene: sceneNames.get(exit.toSceneId),
                    }) }}
                  </span>
                </button>
                <button type="button" class="danger mark" @click="deleteExit(exit)">
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

      <!-- A way on written by naming where it leads: one field, offering the
           Scenes it may land on and taking any name at all. A name the Story
           answers to joins; one it does not writes the Scene. `data-step` is on
           the whole line, because what the guided path asks for is the whole of
           it. Marked for the bar of Commands like every act here; a field cannot
           be pressed, so the bar puts the hand on it instead. -->
      <form class="adding" data-step="way-on" @submit.prevent="addExit(sceneWritten)">
        <label class="eyebrow" :for="`add-way-${sceneWritten.id}`">
          {{ $t('editor.addWayOn') }}
        </label>
        <input
          :id="`add-way-${sceneWritten.id}`"
          v-model="adding"
          :list="`landing-${sceneWritten.id}`"
          autocomplete="off"
          :maxlength="SCENE_NAME_MAX_LENGTH"
          :placeholder="$t('editor.nameWhereItLeads')"
          :data-command="$t('editor.addWayOnCommand')"
          @change="addExit(sceneWritten)"
        >
        <datalist :id="`landing-${sceneWritten.id}`">
          <option v-for="landing in mayLandOn(sceneWritten)" :key="landing.id" :value="landing.name" />
        </datalist>
      </form>
    </section>
  </div>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The gate: the Scene being written, standing on the Graph in the place of its
   own node — see `docs/adr/0042-the-scene-is-written-where-it-stands.md`. It
   fills exactly the box the layout reserved for it and scrolls inside itself, so
   a Scene of twenty beats and six ways on is read here rather than pushing the
   Story it stands on about. It is the one thing on the table drawn in the
   machine's own light: everything else there is a reading of the Story, and this
   is where the Story is written.

   It is the containing block for what is inside it, so a visually hidden label at
   the foot of a long Scene is clipped by the gate and not by the page. */
.panel {
  flex: 1;
  position: relative;
  display: grid;
  gap: var(--s3);
  align-content: start;
  min-inline-size: 0;
  overflow: auto;
  padding: var(--s4);
  border: 1px solid var(--light);
  border-radius: var(--machined);
  background: var(--bench);
  box-shadow: 0 40px 90px -25px rgb(0 0 0 / 0.85);
}

/* The slate: the Scene's name, whether the Story opens on it, and the one act
   that takes it away — one line, and the only place on the bench where the
   condensed face a title card is set in appears at the size it is meant to be
   read at. The name is typed where it is read, so the field draws no box until
   the pointer is on it. */
.heading {
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

/* Taking the Scene away is named in full — it is what the bar of Commands reads
   and what a screen reader hears — and worn as the quiet mark it should be: the
   act at the far end of the slate, in the alarm's colour only once the hand is
   on it. */
.going {
  border-color: transparent;
  background: none;
  color: var(--muted);
}

/* The three parts of the document — what the Scene sets on entry, the run of
   beats, the ways out — each headed and counted where it starts. The heading is
   the only stencilled line in the column, so an Author scrolling a long Scene
   always knows which part of it they are in. */
.held {
  display: grid;
  gap: var(--s3);
}

/* What the Scene sets on entering, read along one line with its own heading: a
   Scene that sets nothing spends a line on saying so and not a paragraph, and
   one that sets three Flags wraps them under it. */
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

/* The beat in the gate and the machine beside it. The gate takes the width and
   the machine what is left, because the gate is what the surface is for. */
.looking {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12rem;
  gap: var(--s3);
  align-items: start;
}

/* The gate proper: the frame, and the words under it. On the film gate's own
   ground and behind its own curve — the one curve in the product — because this
   is the frame a Reader will meet and not a thumbnail of it. */
.lit {
  display: grid;
  gap: var(--s3);
  padding: var(--s3);
  border-radius: var(--gate);
  background: var(--room);
}

/* The frame, drawn whether or not there is an image in it: an empty one is the
   outline of the image nobody attached, which is how an unfinished beat reads as
   unfinished. Pressed to attach one or replace one — the box is the label and the
   input is clipped away inside it. Held to a share of the window so the words
   under it are never pushed off the gate by a tall screen's worth of frame. */
.image {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  inline-size: min(100%, 42ch);
  max-block-size: 30vh;
  margin-inline: auto;
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
  font-size: 1.5rem;
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

/* A file over the frame wears the grease pencil: letting go would do something. */
.image.over {
  border-color: var(--grease);
  background: color-mix(in oklab, var(--grease) 12%, var(--bench));
}

.image img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  border-radius: inherit;
}

/* The one field on the bench an Author spends hours in, and the only place in
   the product where the interface is set in the reading face: what is typed here
   is what is read, at the size and on the measure a Reader reads it at. It
   carries no box at all — the beat is written straight into the gate — and grows
   as it is typed rather than opening a scrollbar two lines deep. `rows` is still
   on the element for a browser without `field-sizing`, which simply keeps the two
   lines it was given. */
.prose {
  field-sizing: content;
  block-size: auto;
  min-block-size: 2lh;
  max-block-size: 10lh;
  inline-size: min(100%, 42ch);
  margin-inline: auto;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--prose);
  font-size: clamp(1.125rem, 1rem + 0.5vw, 1.375rem);
  line-height: 1.5;
}

.prose:hover {
  border: none;
}

/* Where the field sizes itself there is nothing left for a grip to do, and the
   hatched corner it draws is the one piece of browser chrome on a surface that
   is otherwise all writing. Where the browser has no `field-sizing`, the grip
   is how a long beat is read, so it stays. */
@supports (field-sizing: content) {
  .prose {
    resize: none;
  }
}

/* What the machine has to say about the beat in the gate: the Description, and
   the marks that act on it. One beat's worth, so none of it waits to be asked
   for — there is nothing here about a beat the Author is not looking at. */
.machine {
  display: grid;
  align-content: start;
  gap: var(--s3);
}

.machine .row {
  gap: var(--s1);
}

/* The strip: the whole run wound under the gate, one cell a beat, with its Place
   under it. It scrolls inside itself, so a Scene of twenty beats is wound along
   rather than pushing the ways on off the gate. */
.strip {
  display: flex;
  gap: var(--s2);
  overflow-x: auto;
  padding-block: var(--s2);
  border-block: 1px solid var(--edge);
}

.strip li {
  flex: none;
}

/* A cell is the grip as well as the way into the beat: it is what the Author
   refers to the beat as, so there is no second handle to explain. Not selected
   and not scrolled under the pointer, for that reason. */
.strip .cell {
  display: grid;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  user-select: none;
  cursor: grab;
  touch-action: none;
}

.strip .cut {
  display: grid;
  place-items: center;
  inline-size: 5rem;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  color: var(--muted);
  font-family: var(--data);
}

.strip .cut img {
  display: block;
  -webkit-user-drag: none;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.strip .no {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.strip .cell:hover .cut {
  border-color: color-mix(in oklab, var(--light) 55%, var(--edge));
}

/* The beat in the gate, said on the strip as well: the machine's own light, on
   the cell whose frame is up. */
.strip .cell[aria-current] .cut {
  border-color: var(--light);
  outline: 1px solid var(--light);
}

.strip .cell[aria-current] .no {
  color: var(--light);
}

.strip .more .cut {
  border-style: dashed;
}

.strip li.dragged {
  opacity: 0.5;
}

.strip li.under .cut {
  border-color: var(--grease);
  background: color-mix(in oklab, var(--grease) 12%, var(--steel));
}

/* A way on is a row and not a card: where it leads and what the Reader presses
   side by side, and what it is offered under under both. */
.written {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--s2);
}

/* The Conditions and the marks on one line, the marks at the trailing edge. A
   way on carrying Conditions grows a column of them and the marks drop under it,
   which is what wrap is for. */
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

/* What is done to a way on rather than written in it — move it, take it away,
   write a second one to the same Scene, put it under a Condition — waits for the
   hand or the keyboard to arrive at the row. It is drawn and laid out at every
   moment, so nothing moves when it appears and nothing is taken out of the tab
   order or off a screen reader: it is simply not lit until the row is the one
   being worked on. What the Author has already written — a Condition that
   exists — is never dimmed; only the offer to add one is. */
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

/* A screen with no pointer has no hover to reveal anything with, so there the
   row is simply always lit. */
@media (hover: none) {
  .ways .written .row,
  .ways .beneath .conditions.quiet {
    opacity: 1;
  }
}

/* What the image shows, in the machine column beside the gate: a label over a
   field, at the size of the note it is rather than of the beat it belongs to. */
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

/* The marks that act on a way on, set closer than a row of controls anywhere
   else: three or four are one strip. */
.written .row {
  gap: var(--s1);
}

.ways ol {
  display: grid;
  gap: var(--s2);
}

/* A way out is the Author's own cut, so the strip it is written on wears the
   grease pencil down its edge where a beat wears the machined one. */
.ways li {
  border-inline-start-color: color-mix(in oklab, var(--grease) 60%, var(--edge));
}

/* The Place of a way on, in the margin where a Shot's number sits. */
.numbered {
  color: var(--grease);
  font-family: var(--data);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  text-align: end;
}

/* Where the way on leads and what the Reader presses to take it, side by side,
   and what it is offered under across the width of both — a Condition is a
   sentence and reads as one whichever half of the row it belongs to. */
.ways .written {
  grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr);
  align-items: center;
}

.ways .written > .beneath {
  grid-column: 1 / -1;
}

.arrival {
  display: flex;
  align-items: center;
  gap: var(--s1);
  min-inline-size: 0;
}

/* Where the way on leads: a Scene's name worn as one, in a field that draws its
   frame only under the pointer — the same idiom as the Scene's own name at the
   head of the document — and as wide as the name in it rather than as wide as
   the column, so the row reads "1 → The bar" and not as a slot with a name lying
   at one end of it. */
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

/* The way on's own way through: the mark that opens the Scene at the far end,
   quiet until the strip is under the hand, like everything else that acts on a
   row. */
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
   the Exit, in a field that draws its frame under the pointer like the name of
   the Scene it leads to. */
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

.panel > * {
  justify-self: stretch;
}

/* On a phone the gate is the whole table, and there is no room beside the frame
   for the machine's own column: it goes under the gate, where the strip and the
   ways on already are. */
@media (--phone) {
  .looking {
    grid-template-columns: minmax(0, 1fr);
  }

  .panel {
    padding: var(--s3);
  }
}
</style>
