<script setup lang="ts">
/**
 * The bench's own header: where the Author came from, what they are working on,
 * and the two things that can be done to the Story as a whole — publishing it,
 * and putting it in the Catalogue. Everything here acts on the Story rather than
 * on anything in it, which is what makes it a piece of its own.
 */
const { id, story, keptAt, change } = defineProps<{
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
}>()

const { locale } = useI18n()
const localePath = useLocalePath()
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
  <!-- The bench's own header: where the Author came from, what they are working
       on, and the two things that can be done to the Story as a whole. It stays
       on screen, because the graph below it scrolls a long way. -->
  <header>
    <div class="titling">
      <NuxtLink class="back trail" :to="localePath('/stories')">
        {{ $t('editor.allStories') }}
      </NuxtLink>
      <h1>{{ story?.title }}</h1>
    </div>

    <div class="release">
      <!-- The one place an Author changes the language of their own tool. It
           is never drawn on the Reader's page — see
           `docs/adr/0012-the-public-link-carries-no-locale.md`. -->
      <Locales />
      <!-- The link, shown in full so it can be copied out of the page. It is
           what publishing hands over, and it goes on working whether or not
           the Story is in the Catalogue. -->
      <p v-if="story?.publishedAt" class="live">
        <span class="eyebrow">{{ $t('editor.readableAt') }}</span>
        <a class="link" :href="publicLink">{{ publicLink }}</a>
      </p>
      <!-- What a write leaves behind, beside the two controls that act on the
           whole Story. Not a live region: it appears every time a field is left,
           and announcing that would talk over the next thing typed. -->
      <p v-if="kept" class="kept-at">{{ $t('editor.keptAt', { time: kept }) }}</p>
      <!-- Listing is offered only once the Story is published, because the
           Catalogue leads to the public link and an entry pointing at a link
           that answers with a not-found is worse than no entry. -->
      <button v-if="story?.listed" type="button" @click="unlist">
        {{ $t('editor.unlist') }}
      </button>
      <button v-else-if="story?.publishedAt" type="button" @click="list">
        {{ $t('editor.list') }}
      </button>
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
      <button v-if="story?.publishedAt" type="button" @click="unpublish">
        {{ $t('editor.unpublish') }}
      </button>
      <!-- The guided path ends here, so `data-step` is on this one and not on
           the button that unpublishes: the Step is met by the Story being
           published, and by then there is nothing left to point at. -->
      <button v-else type="button" class="primary" data-step="publish" @click="publish">
        {{ $t('editor.publish') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
header {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: end;
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
}

/* A Story's title is the Author's own words, so nothing here recases them. */

.release {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
}

/* The Name asked for in the listing: a whole row of the release panel, because
   it is a sentence and a field rather than another control beside the buttons. */
.signing {
  display: grid;
  gap: var(--s1);
  flex: 1 1 100%;
  max-inline-size: 34rem;
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
