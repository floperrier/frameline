<script setup lang="ts">
/**
 * The bench's own edge: one row above the table the Story is laid out on. What
 * the Story **is** — the way back, its title, written here so an Author never
 * leaves the Story to rename it, the Language it is written in and the state of
 * the last write — then the acts of the bench, which the page puts in the slot
 * between the two halves, and then one place for where the Story can be
 * **read**: the Synopsis, the public link, Publish and List, which are four
 * faces of the one subject rather than four controls that appear and disappear
 * under one another.
 *
 * One row, because the table under it is the whole of the screen — see
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md`. What is written once
 * rather than all day, the Synopsis and the Cover, folds into a disclosure that
 * opens over the table instead of pushing the edge taller.
 *
 * The interface's Locale is not here. It is a property of the person reading and
 * not of the Story — see
 * `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md` — so it is
 * changed where the rest of what is theirs is, on the list of their own Stories.
 */
const { id, story, keptAt, change, write } = defineProps<{
  /**
   * The Story's own id, which every act here is sent against. It comes from the
   * route rather than from the Story, because the Publish is offered while a
   * refused read has left the bench holding no Story at all.
   */
  id: string
  /** The Story the bench is on, or nothing where the read was refused. */
  story?: StoryInEditor
  /** When a typed change last reached the Story, which the bench reports here. */
  keptAt?: Date
  /** The one holder every write on this page goes through. */
  change: Change
  /**
   * The typed write, for the two fields here that are typed in: the title and
   * the Synopsis. A click that alters the Story goes through `change` and reads
   * it back; what was typed is already on the screen it was typed on.
   */
  write: Write
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { languageNamed } = useEntries()
const { user: author, fetch: refreshAuthor } = useUserSession()

// Whether the listing is standing there asking for a Name, and what has been
// typed into it. Both start where an Author with a Name never sees them.
const askingName = ref(false)
const authorName = ref(author.value?.name ?? '')

/**
 * The time of the last write, told the way a clock is read in the Locale rather
 * than in the Story's own Language: this is the bench talking about itself. There
 * is no date on it because nobody sits at the bench long enough to need one —
 * what an Author wants from it is that the last thing they typed went somewhere.
 */
const kept = computed(() => keptAt && new Intl.DateTimeFormat(
  locale.value, { timeStyle: 'short' }).format(keptAt))

/**
 * The public link a Publish hands out. Built from the Story's own id, so it is
 * the same link every time — an Author who unpublishes and publishes again has
 * not invalidated what they sent anyone.
 */
const publicLink = `${useRequestURL().origin}/read/${id}`

/**
 * The title and the Synopsis, each written on its own: the body names the one
 * field that was typed in, so leaving the title alone cannot carry a Synopsis
 * half-typed along with it. Both are typed writes — what is on screen is what
 * the Author typed, and the mark it leaves is `keptAt` and the flash in the
 * field, never an announcement.
 */
function rename() {
  return write(() => send(`/api/stories/${id}`, {
    method: 'PATCH',
    body: { title: story?.title },
  }))
}

function present() {
  return write(() => send(`/api/stories/${id}`, {
    method: 'PATCH',
    body: { synopsis: story?.synopsis },
  }))
}

/**
 * Every Image the Story carries, in the order the Story is written — each one a
 * frame the Author may name as the Cover — and the one a shelf shows today,
 * named or standing in. The bench runs the same rule the server does, so the
 * frame marked here is the frame a Reader meets. See
 * `docs/adr/0040-a-story-is-presented-by-one-of-its-own-frames.md`.
 *
 * Each frame is a radio named by the Shot's Place and the Scene, so the Scene is
 * named the way every control of the bench names one — by `namesOnTheBench`, which
 * numbers two Scenes an Author called the same. Read off the Scene instead, two
 * Scenes called *The bar* with an Image apiece put two radios under one name — see
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
 */
const names = computed(() => (story ? namesOnTheBench(story, t) : new Map<string, string>()))
const frames = computed(() => (story?.scenes ?? []).flatMap(scene => scene.shots
  .filter(shot => shot.image)
  .map(shot => ({ shot, place: shot.position + 1, scene: names.value.get(scene.id)! }))))
const presented = computed(() => story && coverOf(story))

/**
 * Naming the Cover, and taking the naming away. A click rather than a typed
 * write, so the Story is read back and the shelf's own rule marks the frame.
 * Taking it away leaves the Opening Scene's first Image standing in, which is
 * what a Story nobody named a Cover for is presented by.
 */
/**
 * What an Exit of this Story answers when it has not answered for itself:
 * whether a Reading crosses it backwards. A change and not a typed write — one
 * press settles it, and what it settles is how the whole work is read, so the
 * Story on the bench is reloaded around it the way listing and publishing are.
 * See `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
 */
function readBack(stepsBack: boolean) {
  return change(() => send(`/api/stories/${id}`, { method: 'PATCH', body: { stepsBack } }))
}

function nameCover(coverShotId: string | null) {
  return change(() => send(`/api/stories/${id}`, { method: 'PATCH', body: { coverShotId } }))
}

function publish() {
  return change(() => send(`/api/stories/${id}/publish`, { method: 'POST' }))
}

function unpublish() {
  return change(() => send(`/api/stories/${id}/publish`, { method: 'DELETE' }))
}

/**
 * Putting the Story in the Catalogue, and taking it back out. A second act after
 * a Publish rather than part of one — see
 * `docs/adr/0023-being-published-and-being-found-are-two-acts.md` — so a Story
 * can go on being sent to three friends without going on show to everybody.
 * Unlisting leaves it published, and every link already sent goes on working.
 */
function list() {
  // Every entry in the Catalogue is signed, so an Author with no Name yet is
  // asked for one here, in the act that needs it. It is the only moment the
  // product asks: publishing never does, and a settings page would be a room
  // built for one field somebody would have to be sent to — see
  // `docs/adr/0025-a-name-is-asked-for-in-the-listing.md`.
  if (!author.value?.name) {
    askingName.value = true
    return
  }

  return change(() => send(`/api/stories/${id}/listed`, { method: 'POST' }))
}

/**
 * The Name, and the listing it was asked for, in one gesture: the Author wrote
 * the Name to get the Story listed, so being asked and then having to click
 * again would be the product asking twice for one decision. The session carries
 * the Name and the server reseals it, so it is read back here — from then on the
 * button lists without asking anything.
 */
async function listUnder() {
  const name = authorName.value
  const listed = await change(async () => {
    await send('/api/author', { method: 'PATCH', body: { name } })
    await send(`/api/stories/${id}/listed`, { method: 'POST' })
  })

  await refreshAuthor()
  if (listed) askingName.value = false
}

function unlist() {
  return change(() => send(`/api/stories/${id}/listed`, { method: 'DELETE' }))
}
</script>

<template>
  <!-- The bench's own header, in two halves on one row: what the Story is, and
       where it can be read. One row, because a Scene is always being written
       under it and the rows below are what the screen is for: the Synopsis and
       the Cover, which nobody writes while writing a Scene, fold into a
       disclosure, and the acts that publish stay on the row. -->
  <header>
    <div class="titling">
      <NuxtLink class="back trail" :to="localePath('/stories')">
        {{ $t('editor.allStories') }}
      </NuxtLink>
      <!-- The title is the heading and the heading is written in, the same idiom
           as a Scene's name in the document: a bare field with no mode to enter
           first. The label sits outside the heading rather than in it, or it
           would be read out ahead of the title the Author is correcting. -->
      <label class="visually-hidden" for="story-title">{{ $t('editor.storyTitle') }}</label>
      <h1 class="named">
        <input
          v-if="story"
          id="story-title"
          v-model="story.title"
          :maxlength="STORY_TITLE_MAX_LENGTH"
          @change="rename"
        >
      </h1>
      <!-- The Language the work is written in, shown and not offered: nothing
           translates a Story, so there is no later moment at which it changes —
           it is declared when the Story is named. One sentence rather than a
           label and a word beside it, because it is a label on the reel and
           reads as one line. -->
      <p v-if="story" class="eyebrow">
        {{ $t('editor.writtenIn', { language: languageNamed(story.language) }) }}
      </p>
      <!-- What a write leaves behind. Not a live region: it appears every time a
           field is left, and announcing that would talk over the next thing
           typed. -->
      <p v-if="kept" class="kept-at">{{ $t('editor.keptAt', { time: kept }) }}</p>
    </div>

    <!-- The acts of the bench, which belong to the page and not to the Story:
         the way into every act by naming it, and which reading the middle of the
         bench is showing. Two of them, since the Remarks left this row for a
         region beside the document and nothing here opens a Scene any more: the
         whole Story is in the document — see
         `docs/adr/0043-a-story-is-written-as-one-document.md`. -->
    <slot />

    <section class="release" aria-labelledby="release">
      <h2 id="release" class="visually-hidden">{{ $t('editor.whereItIsRead') }}</h2>

      <!-- What a stranger is handed before they open the work — the few lines
           of the Synopsis and the Cover — folded shut, because it is written
           once and the Scene under the header is written all day. A native
           disclosure, so the browser keeps it open or shut and the keyboard
           already knows it. -->
      <!-- Named with the fold beside it, so opening one shuts the other: both
           panels hang from the same end of the edge, and two open at once would
           be drawn over each other. The browser settles it — see the exclusive
           disclosure a shared `name` makes — rather than a watcher here. -->
      <details v-if="story" class="presenting" name="bench-fold">
        <summary class="eyebrow">{{ $t('editor.presentation') }}</summary>

        <div class="folded">
        <p class="synopsis">
          <label class="eyebrow" for="story-synopsis">{{ $t('editor.synopsis') }}</label>
          <textarea
            id="story-synopsis"
            v-model="story.synopsis"
            rows="2"
            :maxlength="STORY_SYNOPSIS_MAX_LENGTH"
            @change="present"
          />
        </p>

        <!-- Named from among the Story's own Images and never uploaded here, so a
             Cover is always a frame of the work — each thumbnail is a radio, and
             the one checked is the one a shelf shows, whether the Author named it
             or the Opening Scene is standing in. -->
        <fieldset class="cover">
        <legend class="eyebrow">{{ $t('editor.cover') }}</legend>
        <p class="note">{{ $t(frames.length ? 'editor.coverNote' : 'editor.coverNone') }}</p>
        <div v-if="frames.length" class="frames">
          <label
            v-for="{ shot, place, scene } in frames"
            :key="shot.id"
            :class="{ chosen: shot.id === presented }"
          >
            <input
              type="radio"
              name="cover"
              :value="shot.id"
              :checked="shot.id === presented"
              @change="nameCover(shot.id)"
            >
            <img :src="shot.image!" :alt="$t('editor.coverOf', { place, scene })">
          </label>
        </div>
        <!-- Offered only while a Cover is named: with none, the Opening Scene is
             already standing in and there is nothing to take away. -->
        <button
          v-if="story.coverShotId"
          type="button"
          :data-command="$t('editor.coverUnname')"
          @click="nameCover(null)"
        >
          {{ $t('editor.coverUnname') }}
        </button>
        </fieldset>
        </div>
      </details>

      <!-- How the work is read, which is one question and is answered once: may a
           Reading come back through an Exit that has not said otherwise? It folds
           like the presentation beside it and for the same reason — it is settled
           when the Story is being thought about rather than while a Scene is
           being written — and it is a fold of its own because what a stranger is
           handed before opening the work and how the work is read are two
           different things.

           An Exit says it for itself where the Author wrote it, in the document;
           this is what an Exit that has said nothing answers. See
           `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`. -->
      <details v-if="story" class="how" name="bench-fold">
        <summary class="eyebrow">{{ $t('editor.howItIsRead') }}</summary>

        <div class="folded">
          <p class="crossing">
            <label class="eyebrow" for="story-steps-back">
              {{ $t('editor.storySteppingBack') }}
            </label>
            <select
              id="story-steps-back"
              :value="story.stepsBack ? 'yes' : 'no'"
              @change="readBack(($event.target as HTMLSelectElement).value === 'yes')"
            >
              <option value="yes">{{ $t('editor.steppingBackOffered') }}</option>
              <option value="no">{{ $t('editor.steppingBackRefused') }}</option>
            </select>
          </p>
        </div>
      </details>

      <!-- The link, shown in full so it can be copied out of the page. It is
           what publishing hands over, and it goes on working whether or not
           the Story is in the Catalogue. -->
      <p v-if="story?.publishedAt" class="live">
        <span class="visually-hidden">{{ $t('editor.readableAt') }}</span>
        <a class="link" :href="publicLink">{{ publicLink }}</a>
      </p>

      <div class="acts">
        <!-- Listing is offered only once the Story is published, because the
             Catalogue leads to the public link and an entry pointing at a link
             that answers with a not-found is worse than no entry. -->
        <button
          v-if="story?.listed"
          type="button"
          :data-command="$t('editor.unlist')"
          @click="unlist"
        >
          {{ $t('editor.unlist') }}
        </button>
        <button
          v-else-if="story?.publishedAt"
          type="button"
          :data-command="$t('editor.list')"
          @click="list"
        >
          {{ $t('editor.list') }}
        </button>
        <button
          v-if="story?.publishedAt"
          type="button"
          :data-command="$t('editor.unpublish')"
          @click="unpublish"
        >
          {{ $t('editor.unpublish') }}
        </button>
        <!-- The guided path ends here, so `data-step` is on this one and not on
             the button that unpublishes: the Step is met by the Story being
             published, and by then there is nothing left to point at. -->
        <button
          v-else
          type="button"
          class="primary"
          data-step="publish"
          :data-command="$t('editor.publish')"
          @click="publish"
        >
          {{ $t('editor.publish') }}
        </button>
      </div>

      <!-- The Name asked for in the listing itself, and only where there is
           none: an Author who has one lists in a single click and is asked
           nothing. -->
      <form v-if="askingName" class="signing" @submit.prevent="listUnder">
        <p class="asked">{{ $t('author.askedBeforeListing') }}</p>
        <label class="eyebrow" for="author-name">{{ $t('author.name') }}</label>
        <div class="row">
          <input
            id="author-name"
            v-model="authorName"
            required
            autofocus
            :maxlength="AUTHOR_NAME_MAX_LENGTH"
          >
          <button type="submit" class="primary">{{ $t('author.list') }}</button>
        </div>
      </form>
    </section>
  </header>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The edge: one row, and the containing block for the two things that open over
   the table rather than pushing the row taller. */
header {
  position: relative;
  z-index: 2;
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s4);
  padding: var(--s2) var(--s4);
  border-block-end: 1px solid var(--edge);
  background: var(--bench);
}

/* What the Story is, read along the edge: the way back, the title, and the two
   marks the bench keeps about it. */
.titling {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
  min-inline-size: 0;
}

/* A Story's title is the Author's own words, so nothing here recases them. The
   field is the heading and wears the heading's face, the way a Scene's name does
   in the document: the frame it draws is held off the pointer rather than restated
   here, so the two fields cannot drift apart. */
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

/* Where the Story can be read: the Synopsis, the link and the two acts, at the
   trailing end of the edge so that they read as one subject rather than as a row
   of controls scattered along it. */
.release {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
  margin-inline-start: auto;
  min-inline-size: 0;
}

/* The title comes down to a label on a reel: the table under the edge is what
   the screen is for. */
.named input {
  font-size: 1.375rem;
}

/* The disclosure the Synopsis and the Cover fold into, its summary set as the
   labels around it are. Open, it lays the two out over the table rather than
   making the edge two rows tall: they are written once, and the Story is laid
   out under them all day. */
.presenting summary,
.how summary {
  cursor: pointer;
}

/* The one question this fold holds: the label and the answer on one line, the
   way the same question is written on an Exit in the document. */
.crossing {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.folded {
  position: absolute;
  z-index: 3;
  inset-block-start: 100%;
  inset-inline-end: var(--s4);
  display: grid;
  gap: var(--s3);
  inline-size: min(30rem, calc(100vw - 2 * var(--s4)));
  padding: var(--s4);
  border: 1px solid var(--edge);
  border-block-start: none;
  border-radius: 0 0 var(--machined) var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

.release .synopsis {
  display: grid;
  gap: var(--s1);
}

/* The Cover beside the Synopsis: a strip of the Story's own frames, each one a
   thumbnail the size the document draws a Shot's, so the same Image reads as the
   same thing on the two surfaces. The fieldset draws no box of its own — the
   legend is the label the other fields wear. */
.cover {
  display: grid;
  gap: var(--s1);
  justify-items: start;
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.cover legend {
  padding: 0;
}

.cover .note {
  color: var(--muted);
  font-size: 0.875rem;
  max-inline-size: 60ch;
}

.cover .frames {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

/* The radio lies over its thumbnail at no opacity, so the frame is what is pressed
   and what is marked, and the press lands on the control itself. The chosen one
   wears the grease pencil the Opening Scene wears on the graph: it is the frame the
   world outside is shown. */
.cover label {
  position: relative;
  display: block;
  inline-size: 4.5rem;
  block-size: 3rem;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  cursor: pointer;
}

.cover input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.cover label.chosen {
  border-color: var(--grease);
  outline: 2px solid var(--grease);
  outline-offset: -1px;
}

/* The focus the input takes cannot be seen where the input is, so the ring is
   drawn round the frame that is pressed — the one in `frameline.css`, restated
   here because `:has()` cannot reach back to a rule written for `:focus-visible`. */
.cover label:has(:focus-visible) {
  outline: 2px solid var(--light);
  outline-offset: 2px;
}

.cover img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* The two acts on the Story as a whole, side by side: they are the one decision
   read twice — whether anybody but the Author can reach this work. */
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

/* At the width of a phone the edge is three rows and not eight: what the Story
   is, then the acts of the bench, then the acts on the Story — each of the last
   two a strip that winds sideways rather than a row that wraps into four. Every
   control stays drawn, so the bar of Commands still reaches every one of them and
   the guided path still has something to point at; and the acts lead their strip,
   so what a row too narrow to hold everything shows first is what an Author
   presses. See `docs/adr/0042-the-scene-is-written-where-it-stands.md`. */
@media (--phone) {
  header {
    gap: var(--s2) var(--s3);
    padding: var(--s2) var(--s3);
  }

  .release {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    min-inline-size: 0;
    overflow-x: auto;
    margin-inline-start: 0;
    padding-block-end: 2px;
  }

  .release > * {
    flex: none;
  }

  /* The acts lead the strip: what a row too narrow to hold everything shows
     first is what an Author presses. In the fold rather than in the document,
     because the order of the edge is a visual matter and the document's order is
     the order the bar of Commands reads the bench in — see
     `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`. */
  .acts {
    order: -1;
  }

  /* The link gives up its width first: it is read once and copied, and the acts
     beside it are pressed. */
  .link {
    max-inline-size: 11rem;
  }
}

/* The Name asked for in the listing, over the table for the reason the Synopsis
   is: it is a sentence and a field rather than another control beside the
   buttons, and the edge is one row. */
.signing {
  position: absolute;
  z-index: 3;
  inset-block-start: 100%;
  inset-inline-end: var(--s4);
  display: grid;
  gap: var(--s2);
  inline-size: min(26rem, calc(100vw - 2 * var(--s4)));
  padding: var(--s4);
  border: 1px solid var(--edge);
  border-block-start: none;
  border-radius: 0 0 var(--machined) var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

.signing .asked {
  color: var(--muted);
}

.signing .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.signing .row input {
  flex: 1 1 14rem;
}

/* A published Story wears the grease pencil: the link is the one thing on the
   bench that anyone outside can reach. Along the edge it is a mark rather than a
   block, and it gives up its width before the acts beside it do. */
.live {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s1) var(--s2);
  min-inline-size: 0;
  padding-inline-start: var(--s2);
  border-inline-start: 2px solid var(--grease);
}

.live .eyebrow {
  flex: none;
}

/* The time of the last write, set in the face the interface reads its own
   readings in, and quiet: it is there to be glanced at, never to be the thing
   the eye lands on when the bench is opened. */
.kept-at {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
}

.link {
  overflow: hidden;
  max-inline-size: 16rem;
  color: var(--paper);
  font-family: var(--data);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The way back to the Stories, at the start of the line it is on. */
.back {
  justify-self: start;
}
</style>
