<script setup lang="ts">
/**
 * Where a Scene is written: the document under the Graph, which the bench always
 * holds one of. Everything a Scene is is written here — its name, the Flags it
 * sets, the run of its Shots, and the Exits leaving it, each named by where it
 * leads — because a Story is written without the canvas:
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md`, and the Graph above
 * is a reading of the Story rather than a surface anything is written on:
 * `docs/adr/0041-the-graph-is-drawn-from-the-story.md`.
 *
 * Which Scene it holds is the page's to say, because the Graph asks for it from
 * above the document. Everything typed here is written into the Story the page
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

/** Puts the caret in a Shot's field, once the read the change asks for has rendered it. */
async function typeInShot(shotId: string, atTheEnd = false) {
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
 * The Shot dragged by its number, and the Shot the hand is over. Held by id and
 * not by Shot: the read that lands mid-drag replaces every Scene in the Story.
 */
const draggedShot = ref<{ shotId: string, over?: string }>()

/**
 * The band along the document's top and bottom edge where a dragged Shot scrolls
 * the run under it, and how fast: about the height of a Shot's own number, at
 * five hundred pixels a second. Under `prefers-reduced-motion` the run still
 * travels the same distance in the same time, a Shot's row at a stride every
 * fifth of a second instead of a few pixels a frame.
 */
const SHOT_SCROLL_BAND = 48
const SHOT_SCROLL_TICK = 16
const SHOT_SCROLL_STEP = 8
const SHOT_SCROLL_STILL_TICK = 200
const SHOT_SCROLL_STILL_STEP = 100

let shotScroll: {
  body: HTMLElement
  step: number
  at: { clientX: number, clientY: number }
  tick: ReturnType<typeof setInterval>
} | undefined

/**
 * Which way the run under the hand should be running, measured against what is
 * on screen of the document rather than the whole of it: a foot below the fold
 * would carry a band the hand could never reach.
 */
function shotScrollWay(body: HTMLElement, y: number) {
  const box = body.getBoundingClientRect()
  const top = Math.max(box.top, 0)
  const bottom = Math.min(box.bottom, window.innerHeight)
  if (y >= top && y < top + SHOT_SCROLL_BAND) return -1
  if (y <= bottom && y > bottom - SHOT_SCROLL_BAND) return 1

  return 0
}

function runShotScroll() {
  const run = shotScroll
  if (!run || !draggedShot.value) return

  const way = shotScrollWay(run.body, run.at.clientY)
  if (!way) return

  run.body.scrollTop += way * run.step
  draggedShot.value.over = rowUnder(run.at)
}

function stopShotScroll() {
  if (shotScroll) clearInterval(shotScroll.tick)
  shotScroll = undefined
}

onBeforeUnmount(stopShotScroll)

function startShotDrag(shot: Shot, event: PointerEvent) {
  // A finger scrolls the document instead: the two controls move a Shot a Place
  // without a drag, so touch keeps the whole route and loses only the shortcut.
  if (event.pointerType === 'touch') return

  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  draggedShot.value = { shotId: shot.id }

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
  draggedShot.value.over = rowUnder(event)
  if (shotScroll) shotScroll.at = { clientX: event.clientX, clientY: event.clientY }
}

function cancelShotDrag() {
  stopShotScroll()
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

/** The Shot's row under a point, asked of the page: the browser already hit-tests them. */
function rowUnder(at: { clientX: number, clientY: number }) {
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
    <div class="heading">
      <h2 class="named">
        <input
          :id="`scene-name-${sceneWritten.id}`"
          v-model="sceneWritten.name"
          :maxlength="SCENE_NAME_MAX_LENGTH"
          @change="renameScene(sceneWritten)"
        >
      </h2>
    </div>

    <div class="standing">
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
        class="danger"
        :data-command="$t('editor.deleteScene')"
        @click="deleteScene(sceneWritten)"
      >
        {{ $t('editor.deleteScene') }}
        <span class="visually-hidden">{{ sceneWritten.name }}</span>
      </button>
    </div>

    <!-- The Flags the Scene sets, at the head of the document where they happen:
         set on entry, before the first Shot plays. -->
    <section class="held" :aria-labelledby="`flags-of-${sceneWritten.id}`">
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

    <!-- The run of beats, typed as one text although there is one field per Shot
         — see `typeOn` — so nothing is parsed and no beat loses the Image or the
         Conditions it carries. Counted twice: in Shots, which is what the Graph
         says, and in words, which is what a writer asks. -->
    <section class="held" :aria-labelledby="`shots-of-${sceneWritten.id}`">
      <h3 :id="`shots-of-${sceneWritten.id}`">
        {{ $t('editor.shotsHeld') }}
        <span class="counted">{{ counted.shots }}</span>
        <span class="counted words">{{ counted.words }}</span>
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
          <!-- The number alone in the gutter, and the handle the Shot is dragged
               by: it is what the Author refers to the Shot as, so there is no
               second grip to explain. -->
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

            <!-- The thumbnail is pressed to attach an image or replace one: the
                 box is a label and the input is clipped away inside it. Drawn
                 whether or not there is an image in it, so an unfinished Shot
                 reads as unfinished. -->
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

            <!-- What the image shows, for a Reader who cannot see it: nothing to
                 describe until one is attached. -->
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

            <!-- What the beat plays under and what is done to the beat, on one
                 line: a Shot carrying no Conditions — most of them — spends one
                 quiet row on the pair. The marks are `.mark` in `frameline.css`;
                 the scissors split the Scene before this beat, which the first
                 beat has nothing before it to be split from. -->
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

              <div class="row">
                <button
                  v-if="place > 0"
                  type="button"
                  class="mark"
                  @click="splitBefore(sceneWritten, shot)"
                >
                  <span aria-hidden="true">✂</span>
                  <span class="visually-hidden">
                    {{ $t('editor.splitBefore', { place: place + 1 }) }}
                  </span>
                </button>
                <button
                  type="button"
                  class="mark"
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
                  class="mark"
                  :disabled="place === sceneWritten.shots.length - 1"
                  @click="moveShot(sceneWritten, shot, 1)"
                >
                  <span aria-hidden="true">↓</span>
                  <span class="visually-hidden">
                    {{ $t('common.moveLater') }}
                    {{ $t('editor.shotNumber', { place: place + 1 }) }}
                  </span>
                </button>
                <button type="button" class="danger mark" @click="deleteShot(shot)">
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

      <!-- A beat added by hand rather than by key: what an Author who has just
           opened a Scene with nothing in it gets, since there is no beat to
           press Enter at the end of. -->
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
/* The document, a column of the bench under the Graph: it takes the height the
   bench leaves and scrolls inside itself, so a Scene of twenty Shots is read
   here rather than down the page. The containing block for what is inside it,
   so a visually hidden label deep in a long Scene is clipped by the column and
   not by the page. */
.panel {
  flex: 1;
  position: relative;
  display: grid;
  gap: var(--s2);
  align-content: start;
  min-inline-size: 0;
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

/* The Scene's name wears the heading's face; the frame it draws is held off the
   pointer rather than restated, so it and every other field here cannot drift
   apart. */
.named {
  min-inline-size: 0;
}

.named input {
  padding: 0 var(--s1);
  background: none;
}

.named input:not(:hover) {
  border-color: transparent;
  border-block-end-color: var(--edge);
}

.heading {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.heading .named {
  flex: 1;
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

/* The three parts of the document, each headed and counted where it starts, on
   a rule, so an Author scrolling knows which part of the Scene they are in. */
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

.held > h3 .counted {
  color: var(--grease);
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
  font-weight: 500;
}

/* The words, at the far end of the rule: a reading and not a heading. */
.held > h3 .words {
  margin-inline-start: auto;
  color: var(--muted);
  font-size: 0.75rem;
}

.add-shot {
  justify-self: start;
}

/* The run of Shots, numbered in the gutter and each separated from the next by a
   hairline — a Scene read the way a length of film is. */
.shots {
  display: grid;
  gap: var(--s2);
}

.shots li,
.ways li {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr);
  gap: var(--s2);
  padding-block-end: var(--s3);
  border-block-end: 1px dashed color-mix(in oklab, var(--edge) 70%, transparent);
}

.shots li:last-child,
.ways li:last-child {
  border-block-end: none;
  padding-block-end: 0;
}

/* A Shot's number is what the Author refers to it by, read at the contrast the
   other labels are; it is also the handle the Shot is dragged by, so it is not
   selected and not scrolled under the pointer. */
.shot-number {
  padding-block-start: var(--s2);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.8125rem;
  letter-spacing: 0;
  text-align: end;
  font-variant-numeric: tabular-nums;
  user-select: none;
  cursor: grab;
  touch-action: none;
}

.shots li.dragged {
  opacity: 0.5;
}

.shots li.under {
  background: color-mix(in oklab, var(--grease) 12%, transparent);
}

/* A beat is a row and not a card: the text and the thumbnail side by side, the
   Description on a line under where there is an image to describe, and what the
   beat plays under sharing the last line with the marks. */
.written {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--s2);
}

.written textarea {
  font-size: 0.875rem;
}

.written > .described,
.written > .beneath {
  grid-column: 1 / -1;
}

/* The Conditions and the marks on one line, the marks at the trailing edge. A
   beat carrying Conditions grows a column of them and the marks drop under it,
   which is what wrap is for. */
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

/* The focus the input takes cannot be seen where the input is, so the ring is
   drawn round the box that is pressed. */
.image > label:has(:focus-visible) {
  outline: 2px solid var(--light);
  outline-offset: 2px;
}

/* A file over the thumbnail wears the grease pencil: letting go would do
   something. */
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

.described {
  display: grid;
  gap: var(--s1);
}

.described input {
  font-size: 0.8125rem;
}

/* The marks that act on a beat or a way on, set closer than a row of controls
   anywhere else: three or four are one strip. */
.written .row {
  gap: var(--s1);
}

.ways ol {
  display: grid;
  gap: var(--s1);
}

/* The Place of a way on, in the gutter where a Shot's number sits. */
.numbered {
  min-inline-size: 1.25rem;
  padding-block-start: var(--s1);
  color: var(--grease);
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

/* Where the way on leads and what the Reader presses to take it, side by side. */
.ways .written {
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
}

.arrival {
  display: flex;
  align-items: center;
  gap: var(--s1);
  min-inline-size: 0;
}

/* Where the way on leads, worn as a heading rather than a field in a form: the
   name of a Scene, and the rule under it says it can be changed. */
.arrival select {
  flex: 1;
  min-inline-size: 0;
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

.said {
  display: grid;
  gap: var(--s1);
}

.said input {
  font-size: 0.875rem;
}

/* The way on written here, at the foot of the ways on: a label and one field,
   as wide as a Scene's name and no wider. */
.adding {
  display: grid;
  justify-items: start;
  gap: var(--s1);
}

.adding input {
  inline-size: min(100%, 24rem);
  padding: var(--s1) var(--s2);
  font-size: 0.875rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.none {
  color: var(--muted);
  max-inline-size: 60ch;
}

.panel > * {
  justify-self: stretch;
}
</style>
