<script setup lang="ts">
/**
 * The Contact Sheet: the whole Story seen rather than read — every Shot of every
 * Scene as the Image it carries, in bands, one band a Scene, in the order
 * `inDocumentOrder` reads it. It is the second of the three readings the middle
 * of the bench turns over to, and the one an Author judges by looking: how much
 * of the work is still a grey rectangle is a question no amount of reading
 * answers. See `docs/adr/0043-a-story-is-written-as-one-document.md`, which
 * coined the term, and `CONTEXT.md`, which now carries it.
 *
 * A Shot with no Image is drawn as a Shot with no Image and not as an empty box:
 * the frame keeps its size and wears the hatch, so the holes are countable at a
 * glance rather than being an absence somebody has to notice.
 *
 * Beside the bands stands the Shot under the hand — its frame at the size an
 * image is actually looked at, its words, its Description and the Conditions it
 * plays under. That is why this reading is where a Description is written: it is
 * the one an Author is looking at the Image in. The field writes what the writing
 * writes, through the same endpoint and in the same request, so the two readings
 * cannot hold two Descriptions of one Image.
 *
 * Nothing else here is written. The words are the Shot's own, set in the reading
 * face because that is what a Shot's text is set in everywhere, and the
 * Conditions are the sentence `app/components/Conditions.vue` writes them as,
 * said rather than offered — a second editor of the same list, drawn over the
 * first while the first is only hidden, would be two sets of fields carrying one
 * pair of ids.
 */
const { story, sceneWritten, write, imageOf } = defineProps<{
  /** The Story on the bench, whole: every band of the sheet is a Scene of it. */
  story: StoryInEditor
  /** The Scene the caret is in, which the sheet is wound to and opens on. */
  sceneWritten?: string
  /**
   * The holder a typed change goes through. The page's own rather than the
   * document's: a refusal here is said under the Story's edge, because the sheet
   * has no section of the document on screen to say it in.
   */
  write: Write
  /** Where a Shot's image is asked for, under the time it was last attached. */
  imageOf: (shot: Shot) => string
}>()

/** Which Scene the Author asked to be taken to, which is the page's to answer. */
const emit = defineEmits<{ open: [string] }>()

const { t } = useI18n()

/** One frame of the sheet: a Shot, where it comes, and what it answers to. */
type Frame = { shot: Shot, scene: Scene, place: number, named: string }

/**
 * What the bench calls each Scene, which is what every band and every frame is
 * named by. Read from `namesOnTheBench` rather than off the Scene, so that two
 * Scenes an Author called the same are told apart here exactly as they are
 * everywhere else the bench names one — see
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
 */
const names = computed(() => namesOnTheBench(story, t))

/**
 * A Scene read by name where something else names it: the far side of an Exit, the
 * Scene a Condition counts visits to. One a Condition still names after it was
 * deleted is said to be gone rather than shown as the id it holds.
 */
function sceneName(sceneId: string) {
  return sceneNamed(names.value, sceneId, t)
}

/**
 * The bands, one a Scene, in the order the Story is written in — the same walk
 * the document is laid out by, so the sheet and the writing read the Story the
 * same way round. What a band shows besides its frames is what an Author judging
 * the shape of a Scene asks of it: its name, whether the Story opens on it, the
 * Flags it sets on entry, and the Scenes its Exits land on.
 *
 * A frame's name is the Scene and the Place and never the file: a sheet drawing
 * every Shot of a Story of forty Scenes is the surface most likely to say one
 * name twice, and *Shot 3 of The bar* is the one pair of facts that tells two
 * frames carrying the same image apart. It tells them apart as far as the bench
 * tells the Scenes apart, which is what `namesOnTheBench` now answers for: an
 * Author may call two Scenes *The bar*, and the bench numbers them wherever it
 * names one, here as in every other reading — issue #284.
 */
const bands = computed(() =>
  inDocumentOrder(story.scenes, story.exits, story.openingSceneId).map((scene) => {
    const named = sceneName(scene.id)

    return {
      scene,
      name: named,
      opens: scene.id === story.openingSceneId,
      flags: flagRows(scene.sets),
      ways: exitsFrom(story.exits, scene.id),
      frames: scene.shots.map((shot, place): Frame => ({
        shot,
        scene,
        place,
        named: t('editor.shotOfScene', { place: place + 1, scene: named }),
      })),
    }
  }))

/** Every frame of the sheet, in the order they are drawn: what the arrows walk. */
const frames = computed(() => bands.value.flatMap(band => band.frames))

/**
 * Which frame the Author chose, held by the page so that it goes when the reading
 * is wound rather than only when the address changes — asking for the Scene the
 * caret is already in winds and renames nothing, and a detail left thirty bands
 * away would be the sheet saying two things about where the Author is. See
 * `windOn` in `app/pages/stories/[id]/index.vue`.
 *
 * And the frame that is actually under the hand —
 * theirs where it is still in the Story, the first of the Scene the caret is in
 * otherwise, and the first of the Story where that Scene has no Shot yet. Read
 * back off the Story rather than kept, so a Shot deleted from another window
 * cannot leave the sheet describing something that is gone.
 */
const chosen = defineModel<string>('chosen')

const shown = computed(() => frames.value.find(frame => frame.shot.id === chosen.value)
  ?? frames.value.find(frame => frame.scene.id === sceneWritten)
  ?? frames.value[0])

function choose(shotId: string) {
  chosen.value = shotId
}

/**
 * The band under the hand: the one the chosen frame stands in, and the Scene the
 * caret is in where there is no frame in the whole sheet to choose. What it
 * settles is which band's marks are in the tab order — see the marks themselves.
 */
const banded = computed(() => shown.value?.scene.id ?? sceneWritten)

/**
 * The arrows across the sheet. The frames wrap into as many rows as the width
 * allows, so what the two axes walk is the Story and not the grid: left and right
 * run the Shots of the Story in the order they are drawn, straight across the
 * seam between one band and the next, and up and down walk band to band at the
 * same Place — the Author's way of asking what the third beat of the next Scene
 * looks like. A band with no Shot in it yet is stepped over rather than stopped
 * at, so an empty Scene is not a wall halfway down the sheet.
 *
 * Focus is what carries the choice, so moving it is the whole of the act: a frame
 * reached by the arrows, by `Tab` or by a press chooses itself the same way.
 */
function walk(event: KeyboardEvent) {
  const all = frames.value
  const at = all.findIndex(frame => frame.shot.id === shown.value?.shot.id)
  const here = all[at]
  if (!here) return

  const stepped = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
  const stepping = { ArrowDown: 1, ArrowUp: -1 }[event.key]
  let to = stepped ? all[at + stepped] : undefined

  if (stepping) {
    const band = bands.value.findIndex(other => other.scene.id === here.scene.id)
    for (let next = band + stepping; next >= 0 && next < bands.value.length; next += stepping) {
      const walked = bands.value[next]!
      if (!walked.frames.length) continue

      to = walked.frames[here.place] ?? walked.frames.at(-1)
      break
    }
  }

  if (!to) return

  event.preventDefault()
  document.getElementById(`frame-${to.shot.id}`)?.focus()
}

/**
 * The Description, written where the Author is looking at the Image. The same
 * request the writing sends — the text goes with it, because the endpoint takes
 * the pair — so the two readings write one field and neither can be holding a
 * Description the other has not got.
 */
function describe(shot: Shot) {
  return write(() => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description },
  }))
}
</script>

<template>
  <!-- A landmark, because an Author can be sent to it and because the middle of
       the bench is three different things depending on which reading is up: the
       region says which one it is holding. -->
  <section class="sheet" aria-labelledby="sheet-heading">
    <p id="sheet-heading" class="eyebrow">{{ $t('editor.contactSheet') }}</p>

    <!-- The bands, which are what a long Story scrolls: the Shot under the hand
         keeps its own place beside them however far down the sheet the Author is
         looking, so the field the Description is written in is never scrolled off
         by the act of choosing what to describe. -->
    <div class="bands">
      <!-- A heading and no landmark, for the reason the document's own sections
           carry none: a Story of forty Scenes would put forty regions in a screen
           reader's rotor, and what an Author moves by is the Scene — which the
           rail, the address and the bar of Commands each reach. A `<section>` with
           no accessible name is not a region, so the outline reads the Scene and
           its frames under it and nothing is announced twice. -->
      <section
        v-for="band in bands"
        :key="band.scene.id"
        class="band"
        :data-band="band.scene.id"
      >
        <header>
          <h2>{{ band.name }}</h2>
          <p v-if="band.opens" class="eyebrow opens">{{ $t('editor.openingScene') }}</p>

          <!-- The Flags the Scene sets on entry, said as the sentence they are
               written in rather than offered as fields: the sheet is looked at,
               and a Flag is written where a Scene is. -->
          <p v-if="band.flags.length" class="sets">
            <span v-for="row in band.flags" :key="row.name" class="set">
              <span class="data">{{ row.name }}</span>
              <span class="says">{{ $t('flags.holds') }}</span>
              <template v-for="(value, at) in row.values" :key="at">
                <span v-if="at" class="says">{{ $t('flags.or') }}</span>
                <span class="data">{{ value }}</span>
              </template>
            </span>
          </p>

          <!-- Where the Scene's Exits land, as marks that go there. Named for the
               Exit they are read off and not for the Scene alone: a Story that
               converges offers the same Scene out of five bands, and five marks
               reading *Go to The bar* would be one name five times over. No
               `data-command`: the rail already offers *Go to* every Scene of the
               Story, and a second copy per Exit is the bar growing with the Story
               in something other than *Go to* — see
               `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.

               In the tab order in the band under the hand and nowhere else, which
               is the same roving the frames are walked by and is here for the same
               reason. These marks stand in a band's header, ahead of that band's
               frames, so every band's own marks left tabbable would put the
               Description field of the frame just chosen one press per Exit of the
               rest of the Story away — forty presses on the Story this reading is
               built for, which is precisely the defect the frames' roving tabindex
               exists to prevent. The marks of the other bands are reached by going
               to the band; and every Scene of the Story is a *Go to* in the bar of
               Commands and a mark on the rail besides, so nothing here is the only
               way to anywhere. -->
          <p v-if="band.ways.length" class="ways">
            <button
              v-for="(way, place) in band.ways"
              :key="way.id"
              type="button"
              class="way"
              :tabindex="band.scene.id === banded ? 0 : -1"
              :aria-label="$t('editor.goToSceneByExit', {
                name: sceneName(way.toSceneId),
                place: place + 1,
                scene: band.name,
              })"
              @click="emit('open', way.toSceneId)"
            >
              {{ sceneName(way.toSceneId) }}
            </button>
          </p>
        </header>

        <p v-if="!band.frames.length" class="none">{{ $t('editor.noShotYet') }}</p>

        <!-- One tab stop for the frames of the whole sheet and the arrows inside
             it, which is what makes the reading usable at the size it is for: a
             Story of forty Scenes is some hundreds of frames, and a `Tab` that
             walked every one of them would put the Description field of the frame
             just chosen hundreds of presses away. `Tab` reaches the chosen frame
             and leaves it for the field beside it; the arrows walk the frames. The
             marks in a band's header rove with them, for the same reason — see
             them. -->
        <ol v-else class="frames">
          <li v-for="frame in band.frames" :key="frame.shot.id">
            <button
              :id="`frame-${frame.shot.id}`"
              type="button"
              class="print"
              :class="{ bare: !frame.shot.image }"
              :tabindex="frame.shot.id === shown?.shot.id ? 0 : -1"
              :aria-current="frame.shot.id === shown?.shot.id ? 'true' : undefined"
              @focus="choose(frame.shot.id)"
              @click="choose(frame.shot.id)"
              @keydown="walk"
            >
              <img
                v-if="frame.shot.image"
                :src="imageOf(frame.shot)"
                alt=""
                loading="lazy"
                decoding="async"
              >
              <span class="numbered" aria-hidden="true">{{ frame.place + 1 }}</span>
              <span class="visually-hidden">
                {{ frame.named }}
                <template v-if="!frame.shot.image">— {{ $t('editor.noImageYet') }}</template>
              </span>
            </button>
          </li>
        </ol>
      </section>
    </div>

    <!-- The Shot under the hand. A landmark of its own and named by the frame it
         is holding, so the one region on this surface whose subject moves says
         what it has moved to. -->
    <section v-if="shown" class="shown" aria-labelledby="shown-heading">
      <h2 id="shown-heading" class="eyebrow">{{ shown.named }}</h2>

      <p class="print big" :class="{ bare: !shown.shot.image }">
        <img v-if="shown.shot.image" :src="imageOf(shown.shot)" :alt="$t('editor.imageOfShot', {
          place: shown.place + 1,
          scene: sceneName(shown.scene.id),
        })">
      </p>

      <!-- Everything about the Shot that is not the frame, held together so that
           the fold can put it beside the frame rather than under it: at the foot of
           the window there is width to spare and no height at all. -->
      <div class="about">
        <!-- The Shot's words, in the face a Shot's text is set in everywhere. Not
             at the reading measure, which this column is not wide enough to be and
             which the writing and the Preview are both for: what these words are
             here is what the frame beside them is a frame of.

             A Shot carrying none says so in its own words and not in the Scene's:
             the sentence a band with no frame in it wears — *Nothing is written in
             this Scene yet. Add the first beat.* — is false said here, where the
             Shot exists and its Scene may hold five more, and it offers an act this
             reading does not carry. Beats are added where they stand, in the
             writing. -->
        <p v-if="shown.shot.text" class="shot" :lang="story.language">{{ shown.shot.text }}</p>
        <p v-else class="none">{{ $t('editor.noWordsYet') }}</p>

        <!-- What the image shows, for a Reader who cannot see it. The one field on
             this reading, and the reason the reading has one: an Author writes a
             Description while they are looking at the Image. -->
        <p v-if="shown.shot.image" class="described">
          <label class="eyebrow" :for="`sheet-description-${shown.shot.id}`">
            {{ $t('editor.description') }}
            <span class="visually-hidden">
              {{ $t('editor.descriptionOfShot', {
                place: shown.place + 1,
                scene: sceneName(shown.scene.id),
              }) }}
            </span>
          </label>
          <input
            :id="`sheet-description-${shown.shot.id}`"
            v-model="shown.shot.description"
            type="text"
            :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
            :placeholder="$t('editor.whatTheImageShows')"
            @change="describe(shown.shot)"
          >
        </p>

        <!-- What the Shot plays under, said in the words its own editor writes it
             in: "Played when — Flag coat holds on". Read and not offered — the list
             is written in the Scene, on the row the beat stands in. -->
        <p v-if="shown.shot.conditions.length" class="played">
          <span class="eyebrow">{{ $t('editor.playedWhen') }}</span>
          <span v-for="(condition, at) in shown.shot.conditions" :key="at" class="when">
            <template v-if="'flag' in condition">
              {{ $t('conditions.flag') }}
              <span class="data">{{ condition.flag }}</span>
              {{ $t('conditions.holds') }}
              <span class="data">{{ condition.is }}</span>
            </template>
            <template v-else>
              {{ $t('conditions.scene') }}
              <span class="data">{{ sceneName(condition.scene) }}</span>
              {{ $t('conditions.entered') }}
              {{ condition.visits === 'at least'
                ? $t('conditions.atLeast') : $t('conditions.fewerThan') }}
              <span class="data">{{ condition.times }}</span>
              {{ $t('conditions.times') }}
            </template>
          </span>
        </p>
      </div>
    </section>
  </section>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The sheet fills the middle of the bench and scrolls inside itself, which is why
   the column it stands in has nothing left to scroll: the bands move under the
   Author's eye and the Shot under their hand stays where it is. Nothing is laid
   over anything — the two are columns of one grid, and at the fold they are rows
   of it. */
.sheet {
  display: grid;
  grid-template-areas:
    'head head'
    'bands shown';
  grid-template-columns: minmax(0, 1fr) 19rem;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--s3) var(--s4);
  block-size: 100%;
  min-block-size: 0;
  padding: var(--s4);
}

#sheet-heading {
  grid-area: head;
}

.bands {
  grid-area: bands;
  display: grid;
  align-content: start;
  gap: var(--s5);
  min-block-size: 0;
  overflow-y: auto;
  /* Wound to the Scene the address names rather than jumped to, and the answer to
     `prefers-reduced-motion` is given once here — the same arrangement the
     document beside it is scrolled under. */
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  .bands {
    scroll-behavior: auto;
  }
}

/* A band is a Scene: what it is, and then what is in it. The room left above it
   is what a Scene wound to by the rail arrives with, said in the units the sheet's
   own padding is written in. */
.band {
  display: grid;
  gap: var(--s3);
  scroll-margin-block-start: var(--s2);
}

.band header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
  padding-block-end: var(--s2);
  border-block-end: 1px solid var(--edge);
}

/* Where the Story opens, in the grease pencil the Author's own marks are written
   in — the same fact the rail marks and the document says under the name. */
.opens {
  color: var(--grease);
}

/* The Flags a Scene sets, read as the sentence they are written in: the name, the
   word the draw is made on, and the values it is drawn from. */
.sets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s3);
  font-size: 0.75rem;
}

.set {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s1);
}

.says {
  color: var(--muted);
  font-size: 0.75rem;
}

.data {
  font-family: var(--data);
  font-size: 0.75rem;
}

/* Where the Scene's Exits land. A row of marks rather than a list, because what
   they are is a row of ways out read across the foot of the band's own heading. */
.ways {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  margin-inline-start: auto;
}

.way {
  padding: 2px var(--s2);
  font-size: 0.75rem;
}

/* The frames of a band, as many to a row as the width allows and every one of
   them the same box: a sheet is read by the size of the holes in it, so nothing
   here is sized by what it holds. */
.frames {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
  gap: var(--s2);
}

/* One frame. Called a print because that is what a cell of a contact sheet is,
   and because `.frame` in `app/assets/css/frameline.css` is already the film
   gate — the one curve in the product, the surface a Shot is thrown onto — and a
   name at two scales is what the glossary exists to prevent.

   It carries no border of its own where there is an image in it — the picture is
   the box — and wears the hatch where there is none, so a Shot with no Image is
   drawn as a Shot with no Image and the holes are countable at a glance rather
   than being an absence somebody has to notice. */
.print {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  inline-size: 100%;
  padding: 0;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: var(--machined);
  background: var(--steel);
}

.print.bare {
  border-style: dashed;
  border-color: var(--edge);
  background:
    repeating-linear-gradient(
      -45deg,
      transparent 0 5px,
      color-mix(in oklab, var(--edge) 55%, transparent) 5px 6px
    ),
    var(--bench);
}

.print:hover {
  border-color: color-mix(in oklab, var(--light) 55%, var(--edge));
}

/* The frame the detail beside the bands is holding, in the machine's own light:
   this is the interface saying which Shot is under the hand. */
.print[aria-current] {
  border-color: var(--light);
}

.print img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

/* The Place, stencilled into the corner of the frame the way a number is written
   on the edge of a strip. It is read off the frame's own name by anything that
   listens, so here it is for the eye alone. */
.numbered {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  padding: 0 var(--s1);
  background: color-mix(in oklab, var(--bench) 70%, transparent);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.6875rem;
  line-height: 1.4;
}

/* The Shot under the hand, beside the bands: the frame at the size an image is
   actually looked at, and everything the sheet knows about it under that. */
.shown {
  grid-area: shown;
  /* The containing block for what is inside it, for the reason the writing
     surface and the Remarks list are one: see `Writing.vue` and `Remarks.vue`.
     This pane scrolls, and the hidden span in its Description's label was laid
     out against the viewport instead, at its row down the page (#293). */
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--s3);
  min-block-size: 0;
  overflow-y: auto;
  padding-inline-start: var(--s4);
  border-inline-start: 1px solid var(--edge);
}

/* Everything about the Shot that is not the frame, which is one block at every
   width: under the frame where the detail is a column, beside it where the fold
   has laid it along the foot. */
.about {
  display: grid;
  gap: var(--s3);
}

.shown .print.big {
  cursor: default;
}

.shown .print.big:hover {
  border-color: transparent;
}

.shown .print.bare:hover {
  border-color: var(--edge);
}

/* The Shot's words. The reading face, because a Shot's text is set in it
   everywhere; not the reading measure, which is the writing's and the Preview's —
   this column is not that wide and would set four words to a line if it claimed
   to be. */
.shown .shot {
  font-size: 1rem;
  max-inline-size: none;
}

.none {
  color: var(--muted);
  font-size: 0.875rem;
}

.described {
  display: grid;
  gap: var(--s1);
}

/* What the Shot plays under, one Condition a line, read as the sentence its own
   editor writes it in. */
.played {
  display: grid;
  gap: var(--s1);
  font-size: 0.75rem;
}

.when {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s1);
  color: var(--muted);
}

.when .data {
  color: var(--paper);
}

/* The fold, at the width the bench folds the Remarks in: there is room for the
   bands and not for a column beside them, so the Shot under the hand takes a row
   of its own along the foot and the bands keep the top of the window, which is
   where the eye goes. Rows of one grid, so nothing is laid over anything and the
   detail is still after the bands in the tab order, as it is at every width.

   Along the foot it is read across rather than down — the frame, and everything
   else beside it — because what is short of at a fold is height and never width.
   Held to a share of the window as well, so a Shot of two hundred words cannot
   push the bands off the screen. */
@media (--two-columns) {
  .sheet {
    grid-template-areas:
      'head'
      'bands'
      'shown';
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .shown {
    /* A share of the width rather than a fixed frame, so the field the Description
       is written in keeps a line worth reading at the narrowest window and the
       frame is still looked at rather than glanced at on a tablet. */
    grid-template-columns: clamp(7rem, 26%, 11rem) minmax(0, 1fr);
    column-gap: var(--s4);
    align-items: start;
    max-block-size: 40dvh;
    padding-block-start: var(--s3);
    padding-inline-start: 0;
    border-block-start: 1px solid var(--edge);
    border-inline-start: none;
  }

  .shown > .eyebrow {
    grid-column: 1 / -1;
  }
}
</style>
