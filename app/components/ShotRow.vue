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
 * new — see `docs/adr/0043-a-story-is-written-as-one-document.md` and issue #449.
 *
 * What writes nothing but this Shot is written here: its words, its Image and its
 * Sound. How it plays is its fold's, `app/components/ShotPlays.vue`, which draws
 * its answers once it is opened. What touches what the document holds for all of
 * them — the one editor, the keys that cut, join and walk a run, the one mark a
 * file being dragged wears, the one Sound being listened to, the one field a Shot
 * is moved from, deleting, splitting, duplicating and renumbering — is asked of
 * the document by an event, which is never compared the way a prop is.
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

/** No confirmation: a beat's Sound is a beat's, and nothing else is heard under it. */
function removeShotSound(scene: Scene, shot: Shot) {
  return changing(scene, () => send(`/api/shots/${shot.id}/sound`, { method: 'DELETE' }))
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
        <!-- What the beat plays as, folded under one line that says only what
             this Shot says for itself: `app/components/ShotPlays.vue`, which
             draws its answers once the fold is wanted. What is written or
             deposited stands open above it. First on the line, so that opening
             it never moves what was pressed: an open fold takes the line, and
             the Conditions and the marks wrap under it. No `open` is bound, so
             the state is the browser's own and is kept while the row is, which
             is as long as the Shot's id is. -->
        <ShotPlays
          :shot
          :scene
          :name
          :place
          :picked
          :changing
          :writing
          @listen="emit('listen', $event)"
        />

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

<style scoped>
/* A beat's own elements: the rules of the writing whose elements this template
   draws, in the order the writing gives them, written here because a scoped rule
   reaches only the elements of the template it is written in — see the head of
   the block in `Writing.vue`, which says why a few of them stand there too. */

@import '~/assets/css/folds.css';

.transport {
  block-size: 2rem;
  inline-size: min(100%, 18rem);
}

.transcribed {
  display: flex;
  align-items: center;
  gap: var(--s2);
  min-inline-size: 0;
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

.shots > li {
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr);
  gap: var(--s1) var(--s3);
  align-items: start;
}

.shots > li + li {
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
.beat > .transcribed {
  grid-column: 1 / -1;
}

.plays[open] {
  flex-basis: 100%;
}

/* And the marks stay at the trailing edge of the row when a long line pushes them
   under it. */
.beat .beneath > .row {
  margin-inline-start: auto;
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
.beneath .row {
  gap: var(--s1);
}

.moving {
  display: grid;
  justify-items: start;
  gap: var(--s1);
  padding-block-start: var(--s1);
}

.moving {
  flex-basis: 100%;
}

.moving input {
  inline-size: min(100%, 24rem);
  padding: var(--s2) var(--s3);
  font-size: 0.875rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
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
}
</style>
