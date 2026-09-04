<script setup lang="ts">
/**
 * The bench's own header, in two halves. On one side what the Story **is**: the
 * way back, its title — written here, so an Author never leaves the Story to
 * rename it — the Language it is written in, and the state of the last write. On
 * the other, one place for where it can be **read**: the Synopsis, the public
 * link, Publish and List, which are four faces of the one subject rather than
 * four controls that appear and disappear under one another.
 *
 * The interface's Locale is not here. It is a property of the person reading and
 * not of the Story — see
 * `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md` — so it is
 * changed where the rest of what is theirs is, on the list of their own Stories.
 */
const { id, story, keptAt, writing, change, write } = defineProps<{
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
  /**
   * Whether a Scene is on the writing surface, which is what the header folds
   * for. Writing a Scene is a state of the whole bench — see
   * `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` — and the graph
   * already folds into a rail for it; the header owes the same. What the Story
   * is stays, because that is what the Author is inside, and so do the acts that
   * publish it and the link a Publish hands out. The Synopsis folds away: it is
   * the one thing here nobody writes while they are writing a Scene.
   */
  writing?: boolean
  /** The one holder every write on this page goes through. */
  change: Change
  /**
   * The typed write, for the two fields here that are typed in: the title and
   * the Synopsis. A click that alters the Story goes through `change` and reads
   * it back; what was typed is already on the screen it was typed on.
   */
  write: Write
}>()

const { locale } = useI18n()
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
  <!-- The bench's own header, in two halves: what the Story is, and where it can
       be read. It stays on screen, because the graph below it scrolls a long
       way. -->
  <header :class="{ writing }">
    <div class="titling">
      <NuxtLink class="back trail" :to="localePath('/stories')">
        {{ $t('editor.allStories') }}
      </NuxtLink>
      <!-- The title is the heading and the heading is written in, the same idiom
           as a Scene's name in the panel: a bare field with no mode to enter
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

    <section class="release" :class="{ folded: writing }" aria-labelledby="release">
      <h2 id="release" class="eyebrow">{{ $t('editor.whereItIsRead') }}</h2>

      <!-- The few lines the Story is presented by wherever somebody meets it
           before opening it. Written here, beside the acts that put the Story
           where it can be met, because it is the same subject: what a stranger
           is handed. -->
      <p v-if="!writing" class="synopsis">
        <label class="eyebrow" for="story-synopsis">{{ $t('editor.synopsis') }}</label>
        <textarea
          v-if="story"
          id="story-synopsis"
          v-model="story.synopsis"
          rows="2"
          :maxlength="STORY_SYNOPSIS_MAX_LENGTH"
          @change="present"
        />
      </p>

      <!-- The link, shown in full so it can be copied out of the page. It is
           what publishing hands over, and it goes on working whether or not
           the Story is in the Catalogue. -->
      <p v-if="story?.publishedAt" class="live">
        <span class="eyebrow">{{ $t('editor.readableAt') }}</span>
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
header {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: var(--s3) var(--s4);
  padding-block: var(--s3);
  border-block-end: 1px solid var(--edge);
  /* The graph scrolls under the header, so the header cannot be transparent. */
  background: var(--bench);
}

.titling {
  display: grid;
  gap: var(--s1);
  flex: 1 1 20rem;
  max-inline-size: 34rem;
}

/* A Story's title is the Author's own words, so nothing here recases them. The
   field is the heading and wears the heading's face, the way a Scene's name does
   in the panel: the frame it draws is held off the pointer rather than restated
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

/* Where the Story can be read: the Synopsis, the link and the two acts, in one
   column so that they read as one subject rather than as a row of controls. */
.release {
  display: grid;
  gap: var(--s2);
  flex: 1 1 24rem;
  max-inline-size: 34rem;
}

/* Writing a Scene is a state of the bench and the header takes it too, the way
   the graph beside it folds into a rail: the title comes down to a label on a
   reel and the Synopsis folds away, because the three columns below are what the
   screen is for. Nothing leaves the tab order and nothing changes shape. */
header.writing {
  padding-block: var(--s2);
}

header.writing .named input {
  font-size: 1.75rem;
}

.release.folded {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: end;
  gap: var(--s2) var(--s3);
}

.release .synopsis {
  display: grid;
  gap: var(--s1);
}

/* The two acts on the Story as a whole, side by side: they are the one decision
   read twice — whether anybody but the Author can reach this work. */
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

/* The Name asked for in the listing: a row of its own under the acts, because
   it is a sentence and a field rather than another control beside the buttons. */
.signing {
  display: grid;
  gap: var(--s1);
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
   bench that anyone outside can reach. */
.live {
  display: grid;
  gap: 2px;
  padding-inline-start: var(--s3);
  border-inline-start: 2px solid var(--grease);
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
  color: var(--paper);
  font-family: var(--data);
  font-size: 0.75rem;
  word-break: break-all;
}

/* The way back to the Stories, at the start of the line it is on. */
.back {
  justify-self: start;
}
</style>
