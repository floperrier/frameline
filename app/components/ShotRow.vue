<script setup lang="ts">
/**
 * One beat of the document: its Place, its thumbnail and its words, its
 * Description and its Sound, the fold of how it plays, its Conditions, its marks
 * and the field it is moved from — the row `app/components/Writing.vue` draws for
 * every Shot of every Scene. A component of its own so that a change re-renders
 * the row it changes: a keystroke into one beat used to be a render of every beat
 * of the Story, because the document read every Shot in its one render. Here a row
 * reads its own Shot, and is handed otherwise only values that are primitive or
 * kept while they say the same, so an act on one beat hands its neighbours nothing
 * new — see `docs/adr/0077-a-change-costs-what-it-changes.md`.
 *
 * What writes nothing but this Shot is written here: its words, its Image, its
 * Sound, how it plays and what it is played under. What touches what the document
 * holds for all of them — the one editor, the keys that cut, join and walk a run,
 * the one mark a file being dragged wears, the one Sound being listened to, the one
 * field a Shot is moved from, deleting, splitting, duplicating and renumbering —
 * is asked of the document by an event, which is never compared the way a prop is.
 */
const { shot, scene, name, place, changing, writing, typeOn, attached } = defineProps<{
  /** The Shot itself, typed into where it is drawn. */
  shot: Shot
  /** The Scene whose run it stands in, which it falls back on wherever it says nothing. */
  scene: Scene
  /** What the bench calls that Scene, which every control of the row is named by. */
  name: string
  /** Its Place in the run, counted from nought. */
  place: number
  /** Whether it is the last of the run, which has no later Place to move to. */
  last: boolean
  /** Whether the caret is in its Scene, which is what carries a mark's name. */
  here: boolean
  /** Whether the Story holds another Scene for it to be moved to. */
  elsewhere: boolean
  /** The Language the Story is written in, which its words are read in. */
  language: string
  /** The face the Story is set in and where its lines stand, `setIn`'s. */
  set: ReturnType<typeof setIn>
  /** What the bench calls each Scene and each Exit, and the Flags of the Story, which its Conditions offer. */
  names: Map<string, string>
  exits: Map<string, ExitOnTheBench>
  flags: ReadonlySet<string>
  /** Where its image is asked for, under the time it was last attached. */
  imageOf: (shot: Shot) => string
  /**
   * Said the moment an image landed, which the page holds — see `Writing.vue`. A
   * function of the document's rather than an event of the row's, because the
   * notice is said after the upload and the row may be gone by then: a Shot moved
   * or its Scene split while the image went up is drawn by a row of its own, and
   * Vue drops an event a component emits once it is unmounted, which would leave
   * the old image drawn until the page was opened again.
   */
  attached: (shotId: string) => void
  /** What every picker of the document is standing on, the document's own record: the row's is its Shot's entry. */
  picked: Record<string, string>
  /** The one editor on the bench, handed to the row the caret is in and to no other. */
  editor?: typeof import('~/components/Formatting.client.vue')['default']
  /** Where the caret lands in it, while it is on this row. */
  at?: 'end' | 'all' | number | { x: number, y: number }
  /** Whether a file is over the thumbnail. */
  over: boolean
  /** The one field a Shot is moved from, while it is this row's. */
  moving?: { shotId: string, typed: string, refused?: string }
  /** The other Scenes as the bench calls them, in the order the Story is written in, which that field offers. */
  landings?: string[]
  /** The document's own two doors, which say a refusal in the Scene the act was in. */
  changing: (scene: Scene, act: () => Promise<unknown>) => Promise<boolean>
  writing: (scene: Scene, written: string, act: () => Promise<unknown>) => Promise<void>
  /** The keys the editor puts to the bench before it acts on them — see `typeOn` in `Writing.vue`. */
  typeOn: (
    scene: Scene, name: string, shot: Shot, place: number, event: KeyboardEvent, atHead: boolean,
    halves?: [Formatted, Formatted],
  ) => boolean
}>()

/**
 * What the row asks of the document: every act on what the document holds for all
 * its rows, each heard there with this row's Shot, Scene and Place.
 */
const emit = defineEmits<{
  press: [PointerEvent]
  edit: [FocusEvent]
  over: [DragEvent]
  leave: [DragEvent]
  dropped: []
  listen: [string | undefined]
  read: [Event]
  split: []
  toggleMoving: []
  stopMoving: []
  moveToScene: []
  duplicate: []
  move: [-1 | 1]
  delete: []
}>()

const { t } = useI18n()

/**
 * The keys the editor puts to the bench, with this row's Shot and Place as they
 * stand when the key arrives. One function for the row's whole life, so the editor
 * is never handed a new one by a render that changed nothing it reads.
 */
function keys(event: KeyboardEvent, atHead: boolean, halves?: [Formatted, Formatted]) {
  return typeOn(scene, name, shot, place, event, atHead, halves)
}

/**
 * Whether the fold of how it plays has been opened, which is when its answers are
 * drawn. Read once off the fold as the row mounts as well, because a fold pressed
 * before the bench's script took over is opened by the browser alone, its `toggle`
 * fired at nobody, and it would stand open and empty until shut and opened again.
 */
const opened = ref(false)
const fold = useTemplateRef<HTMLDetailsElement>('fold')

onMounted(() => {
  if (fold.value?.open) opened.value = true
})

/** Writes what the Author typed about one Shot in one request. */
function writeShot(scene: Scene, shot: Shot) {
  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: typedAbout(shot),
  }))
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
    attached(shot.id)
  })
}

/** Picked from the dialog rather than dropped on the thumbnail — see `depositedFile`. */
function attachImage(scene: Scene, shot: Shot, event: Event) {
  const file = depositedFile(event)
  if (!file) return

  return attach(scene, shot, file)
}

/**
 * The first image among what was dropped is the one taken; a drop with no image at
 * all is still sent, and the endpoint says what an image is. The mark a file over
 * the thumbnail wears is the document's, which is told first.
 */
function dropImage(scene: Scene, shot: Shot, event: DragEvent) {
  emit('dropped')
  const dropped = [...event.dataTransfer?.files ?? []]
  const image = dropped.find(file => imageTaken(file) !== 'refusals.imageType') ?? dropped[0]
  if (!image) return

  return attach(scene, shot, image)
}

/**
 * The three gestures a Scene's Sound is given in `Writing.vue`, on a beat: a
 * file of the Author's own or one off the library (see `depositedFile`,
 * `depositSoundAt` and `takeLibrarySoundAt`), and taking it away. There is no
 * naming here and no loop — a Shot's Sound strikes with the beat and is gone,
 * and a struck sound weighs 20 KB, which is not worth a column and a `<select>`
 * to save.
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
 * What the Shot says about its own Cut, its Movement and how its text arrives,
 * each put on the Shot before the request leaves, as `writeSceneCut` in
 * `Writing.vue` says why.
 */
function writeShotCut(
  scene: Scene,
  shot: Shot,
  body: Partial<Pick<Shot, 'cutAfter' | 'cutOver' | 'cutThrough'>>,
) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
}

/** The Layout the Shot says for itself, where *as the Scene says* is the null the column holds. */
function writeShotLayout(scene: Scene, shot: Shot, answer: string) {
  const layout = answer === 'scene' ? null : answer as Layout
  shot.layout = layout

  return writing(scene, shot.id, () =>
    send(`/api/shots/${shot.id}`, { method: 'PATCH', body: { layout } }))
}

function writeShotMovement(scene: Scene, shot: Shot, body: MovementSaid) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
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

function writeShotText(scene: Scene, shot: Shot, body: TextSaid) {
  if (!wholeCut(body)) return
  Object.assign(shot, body)

  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}`, { method: 'PATCH', body }))
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

/** Writes the whole list the Shot carries, which is what the endpoint takes. */
function writeConditions(scene: Scene, shot: Shot) {
  return writing(scene, shot.id, () => send(`/api/shots/${shot.id}/conditions`, {
    method: 'PUT',
    body: { conditions: wholeConditions(shot.conditions) },
  }))
}
</script>

<template>
  <li class="handed" :data-shot="shot.id">
    <span class="numbered">{{ place + 1 }}</span>

    <div class="beat">
      <!-- The frame is pressed to attach an image or replace one: the box
           is a label and the input is clipped away inside it. Drawn whether
           or not there is an image in it, so an unfinished beat reads as
           unfinished — at the size of a thumbnail here, because the size a
           Reader meets it at is what the Preview and the contact sheet are
           for. Brought in lazily, as the contact sheet's prints are: each is
           the whole Image, and a long Story is hundreds of them that nobody
           is looking at yet. -->
      <label
        class="image"
        :class="{ over }"
        @dragenter.prevent.stop="emit('over', $event)"
        @dragover.prevent.stop="emit('over', $event)"
        @dragleave="emit('leave', $event)"
        @drop.prevent.stop="dropImage(scene, shot, $event)"
      >
        <img
          v-if="shot.image"
          :src="imageOf(shot)"
          :style="{ objectPosition: cropPosition(shot) }"
          :alt="$t('editor.imageOfShot', {
            place: place + 1,
            scene: name,
          })"
          loading="lazy"
          decoding="async"
        >
        <input
          type="file"
          class="visually-hidden"
          :accept="SHOT_IMAGE_ACCEPT"
          :aria-label="$t('editor.pickImageOfShot', {
            place: place + 1,
            scene: name,
          })"
          @change="attachImage(scene, shot, $event)"
        >
      </label>

      <span :id="`shot-named-${shot.id}`" class="visually-hidden">
        {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
      </span>
      <!-- The text, as every reading of the Shot draws it, in a box that is
           the field until the caret is in it; then the one editor, under
           the same name and id. Its words are the Shot's as they are typed,
           for the counts and the Remarks, and its formatted text is written
           when the caret leaves it — see `edit` in `Writing.vue`. -->
      <component
        :is="editor"
        v-if="editor"
        :id="`shot-${shot.id}`"
        :formatted="shot.formatted"
        :labelledby="`shot-named-${shot.id}`"
        :label="$t('editor.formattingOf', { place: place + 1, scene: name })"
        :lang="language"
        :step="here && !place ? 'shot-text' : undefined"
        :at="at!"
        :keys
        :stands-read="!shot.image || layout(scene, shot) === 'full'"
        :set-in="set"
        @words="(text, formatted) => Object.assign(shot, { text, formatted })"
        @change="formatted => writeShot(scene, Object.assign(shot, { formatted }))"
      />
      <Formatted
        v-else
        :id="`shot-${shot.id}`"
        :data-step="here && !place ? 'shot-text' : undefined"
        class="shot"
        v-bind="set"
        role="textbox"
        aria-multiline="true"
        :aria-labelledby="`shot-named-${shot.id}`"
        tabindex="0"
        :lang="language"
        :formatted="shot.formatted"
        @pointerdown="emit('press', $event)"
        @focus="emit('edit', $event)"
      />

      <!-- What the image shows, for a Reader who cannot see it: nothing to
           describe until one is attached. -->
      <p v-if="shot.image" class="described">
        <label class="eyebrow" :for="`description-${shot.id}`">
          {{ $t('editor.description') }}
          <span class="visually-hidden">
            {{ $t('editor.descriptionOfShot', {
              place: place + 1,
              scene: name,
            }) }}
          </span>
        </label>
        <input
          :id="`description-${shot.id}`"
          v-model="shot.description"
          type="text"
          :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
          :placeholder="$t('editor.whatTheImageShows')"
          @change="writeShot(scene, shot)"
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
          :aria-label="$t('editor.soundOfShot', { place: place + 1, scene: name })"
        />
        <button type="button" class="danger mark" @click="removeShotSound(scene, shot)">
          <span aria-hidden="true">×</span>
          <span class="visually-hidden">
            {{ $t('editor.removeSound') }}
            {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
          </span>
        </button>
      </p>

      <p v-if="shot.sound" class="transcribed">
        <label class="eyebrow" :for="`shot-transcript-${shot.id}`">
          {{ $t('editor.transcript') }}
          <span class="visually-hidden">
            {{ $t('editor.transcriptOfShot', { place: place + 1, scene: name }) }}
          </span>
        </label>
        <input
          :id="`shot-transcript-${shot.id}`"
          v-model="shot.transcript"
          type="text"
          :maxlength="SOUND_TRANSCRIPT_MAX_LENGTH"
          :placeholder="$t('editor.whatTheSoundMakesHeard')"
          @change="writeShot(scene, shot)"
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
             kept while the row is, which is as long as the Shot's id is.

             Its answers are drawn the first time it opens and stay drawn
             after, so a Story of three hundred beats draws only the folds an
             Author has opened — see
             `docs/adr/0077-a-change-costs-what-it-changes.md`. -->
        <details ref="fold" class="plays" @toggle="opened = true">
          <summary>
            {{ playsAs(shot, scene, t) }}
            <span class="visually-hidden">
              {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
            </span>
          </summary>

          <div v-if="opened" class="answers">
            <!-- The Sound picker while there is no Sound: a choice from the
                 library, or a file to deposit. -->
            <p v-if="!shot.sound" class="struck">
              <label class="visually-hidden" :for="`shot-sound-${shot.id}`">
                {{ $t('editor.soundOfShot', { place: place + 1, scene: name }) }}
              </label>
              <select :id="`shot-sound-${shot.id}`" v-model="picked[shot.id]">
                <option value="">{{ $t('editor.noSoundPicked') }}</option>
                <option v-for="sound in SOUND_LIBRARY" :key="sound.file" :value="`library:${sound.file}`">
                  {{ sound.label[$i18n.locale as 'en' | 'fr'] ?? sound.label.en }}
                  · {{ $t('editor.soundSeconds', { count: sound.seconds }) }}
                </option>
              </select>
              <!-- Inert on nothing, so disabled on nothing: see the Scene's
                   own pair in `Writing.vue`. -->
              <button
                type="button"
                class="mark"
                :disabled="!picked[shot.id]"
                @click="emit('listen', picked[shot.id])"
              >
                {{ $t('editor.listenToSound') }}
                <span class="visually-hidden">
                  {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                </span>
              </button>
              <button
                type="button"
                :disabled="!picked[shot.id]"
                @click="takeShotSound(scene, shot, picked[shot.id])"
              >
                {{ $t('editor.takeSound') }}
                <span class="visually-hidden">
                  {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                </span>
              </button>
              <label class="depositing">
                <span class="visually-hidden">
                  {{ $t('editor.pickSoundOfShot', { place: place + 1, scene: name }) }}
                </span>
                <input
                  type="file"
                  :accept="SOUND_ACCEPT"
                  @change="depositShotSound(scene, shot, $event)"
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-cut-after-${shot.id}`"
                  :value="cutWhen(shot)"
                  @change="writeShotCutAfter(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotCut(scene, shot, {
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-cut-over-${shot.id}`"
                  :value="cutKind(shot)"
                  @change="writeShotCutMade(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotCut(scene, shot, {
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-layout-${shot.id}`"
                  :value="shot.layout ?? 'scene'"
                  @change="writeShotLayout(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-movement-${shot.id}`"
                  :value="movementKind(shot)"
                  @change="writeShotMoves(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotMovement(scene, shot, {
                      movementBy: percentWritten($event, shot.movementBy),
                    })"
                  >
                  <span class="unit" aria-hidden="true">{{ $t('editor.percentUnit') }}</span>
                </template>
              </p>

              <p v-if="(shot.movementBy ?? scene.movementBy) > 0" class="cutting">
                <label class="eyebrow" :for="`shot-movement-over-${shot.id}`">
                  {{ $t('editor.movementTakes') }}
                  <span class="visually-hidden">
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-movement-over-${shot.id}`"
                  :value="movementTakesKind(shot)"
                  @change="writeShotMovementTakes(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotMovement(scene, shot, {
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
                      {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                    </span>
                  </label>
                  <select
                    :id="`shot-${slot.slot}-${shot.id}`"
                    :value="shot[slot.slot]?.effect ?? ''"
                    @change="writeShotEffectChosen(
                      scene, shot, slot.slot, ($event.target as HTMLSelectElement).value)"
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
                        @change="writeShotEffectTime(scene, shot, slot.slot, $event)"
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
                        scene, shot, slot.slot, ($event.target as HTMLSelectElement).value)"
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-text-after-${shot.id}`"
                  :value="textArrivesKind(shot)"
                  @change="writeShotTextArrives(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotText(scene, shot, {
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-text-by-${shot.id}`"
                  :value="shot.textBy ?? 'scene'"
                  @change="writeShotTextComes(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                    :value="shot.textPace ?? scene.textPace"
                    :aria-label="$t('editor.paceOfThisText', {
                      place: place + 1,
                      scene: name,
                    })"
                    @change="writeShotText(scene, shot, {
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-text-over-${shot.id}`"
                  :value="textAppearsKind(shot)"
                  @change="writeShotTextAppears(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotText(scene, shot, {
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
                    {{ $t('editor.shotOfScene', { place: place + 1, scene: name }) }}
                  </span>
                </label>
                <select
                  :id="`shot-text-stays-${shot.id}`"
                  :value="textStaysKind(shot)"
                  @change="writeShotTextStays(
                    scene, shot, ($event.target as HTMLSelectElement).value)"
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
                      scene: name,
                    })"
                    @change="writeShotText(scene, shot, {
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
          :data-step="here && !place ? 'shot-condition' : undefined"
          :lead="$t('editor.playedWhen')"
          :carrier="$t('editor.shotOfScene', {
            place: place + 1,
            scene: name,
          })"
          :conditions="shot.conditions"
          :names
          :exits="exits"
          :flags="flags"
          :counting="scene.id"
          :id="shot.id"
          :named="here"
          @write="writeConditions(scene, shot)"
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
            @click="emit('read', $event)"
          >
            <span aria-hidden="true">▶</span>
            <span class="visually-hidden">
              {{ $t('editor.readFromShot', {
                place: place + 1,
                scene: name,
              }) }}
            </span>
          </button>
          <button
            v-if="place > 0"
            type="button"
            class="mark"
            @click="emit('split')"
          >
            <span aria-hidden="true">✂</span>
            <span class="visually-hidden">
              {{ $t('editor.splitBefore', {
                place: place + 1,
                scene: name,
              }) }}
            </span>
          </button>
          <button
            v-if="elsewhere"
            :id="`move-${shot.id}`"
            type="button"
            class="mark"
            :aria-expanded="!!moving"
            @click="emit('toggleMoving')"
          >
            <span aria-hidden="true">↗</span>
            <span class="visually-hidden">
              {{ $t('editor.moveShot', {
                shot: $t('editor.shotOfScene', {
                  place: place + 1,
                  scene: name,
                }),
              }) }}
            </span>
          </button>
          <button
            type="button"
            class="mark"
            @click="emit('duplicate')"
          >
            <span aria-hidden="true">⧉</span>
            <span class="visually-hidden">
              {{ $t('editor.duplicateShot', {
                shot: $t('editor.shotOfScene', {
                  place: place + 1,
                  scene: name,
                }),
              }) }}
            </span>
          </button>
          <button
            type="button"
            class="mark"
            :disabled="place === 0"
            @click="emit('move', -1)"
          >
            <span aria-hidden="true">↑</span>
            <span class="visually-hidden">
              {{ $t('common.moveEarlier') }}
              {{ $t('editor.shotOfScene', {
                place: place + 1,
                scene: name,
              }) }}
            </span>
          </button>
          <button
            type="button"
            class="mark"
            :disabled="last"
            @click="emit('move', 1)"
          >
            <span aria-hidden="true">↓</span>
            <span class="visually-hidden">
              {{ $t('common.moveLater') }}
              {{ $t('editor.shotOfScene', {
                place: place + 1,
                scene: name,
              }) }}
            </span>
          </button>
          <button
            type="button"
            class="danger mark"
            @click="emit('delete')"
          >
            <span aria-hidden="true">×</span>
            <span class="visually-hidden">
              {{ $t('common.delete') }}
              {{ $t('editor.shotOfScene', {
                place: place + 1,
                scene: name,
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
          v-if="moving"
          class="moving"
          @submit.prevent="emit('moveToScene')"
          @keydown.esc.stop.prevent="emit('stopMoving')"
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
            @change="emit('moveToScene')"
          >
          <datalist :id="`moving-to-${shot.id}`">
            <option v-for="other in landings" :key="other" :value="other" />
          </datalist>
          <p v-if="moving.refused" role="alert">{{ moving.refused }}</p>
        </form>
      </div>
    </div>
  </li>
</template>

<style scoped src="~/assets/css/writing.css"></style>
