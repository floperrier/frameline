<script setup lang="ts">
// Where a Reader reads a published Story. No middleware and no session: the page
// asks nothing of whoever opens the link.
//
// The one route left out of localized routing, so the link an Author hands out
// is `/read/<id>` whatever language either of them reads — see
// `docs/adr/0012-the-public-link-carries-no-locale.md`. The chrome is still in
// the Reader's own Locale, detected from their browser; only the address has no
// say in it, which is why every link this page draws is put through
// `localePath`: the work carries no locale, the interface around it does.
definePageMeta({ i18n: false })

const id = useRoute().params.id as string
const { loggedIn } = useUserSession()
const localePath = useLocalePath()
const { data: story, error } = await useAsyncData(
  `read-${id}`,
  () => send(`/api/read/${id}`) as Promise<StoryToShow & {
    title: string
    language: string
    cover: string | null
    authorId: string
    authorName: string | null
    carriesSound: boolean
  }>,
)

// An unpublished Story, one unpublished after this link went out, and one that
// never existed are all the same not-found, which is the point. Anything else
// that went wrong is passed on as itself: a Reader of a Story that is very much
// published must not be told it is gone because a query failed.
if (error.value) throw createError({ ...error.value, fatal: true })

/**
 * The one press a Story that carries a Sound is given before the Reading draws
 * anything: a browser will not play into a page nobody has touched, so the
 * title card is that touch and consent in one. A silent Story skips it —
 * there is nothing to consent to — and keeps the page it always had.
 *
 * `Resume` rather than `Begin` where this browser kept a Path for this Story,
 * read the same way the Reading itself reads it back — see `app/utils/kept.ts`
 * — so the one word said before the frame is on screen already tells a
 * returning Reader they are not starting over.
 */
const begun = ref(!story.value?.carriesSound)
const resuming = ref(false)

onMounted(() => {
  if (story.value) resuming.value = Boolean(keptReading(id, story.value))
})
</script>

<template>
  <main class="room">
    <!-- The title card: the Story is named once, at the head of the reel, and
         then the frames have the room to themselves. -->
    <header :class="{ covered: story?.cover }">
      <!-- The product's own name, leading where the Catalogue's own header leads
           home: a Reader who was sent a link and nothing else is one press from
           the room where Stories are found. -->
      <NuxtLink class="wordmark trail" :to="localePath('/catalogue')">Frameline</NuxtLink>

      <!-- The frame the Story was presented by on the shelf, beside the title as
           it stood beside it there: a Reader arrives where the entry they pressed
           said they would. Small, because the first Shot is about to play under
           it at full width and a poster over a poster is one picture too many.
           Decorative beside the title that names the work — the Shot itself, with
           its Description, is met in the Reading. -->
      <img v-if="story?.cover" class="cover" :src="story.cover" alt="">
      <p class="eyebrow">{{ $t('read.eyebrow') }}</p>
      <!-- The Story's own title, announced in the Story's Language while the
           line above it stays in the Reader's. -->
      <h1 :lang="story?.language">{{ story?.title }}</h1>

      <!-- The one press a Story that carries a Sound is given before it plays
           anything: a browser will not play into a page nobody has touched, and
           consenting to sound is consenting to this one, not to sound in
           general. Says `Resume` rather than `Begin` where this browser kept a
           Path for this Story, so a returning Reader is told before the frame
           is even drawn that they are not starting over. -->
      <button v-if="story && !begun" type="button" class="beginning primary" @click="begun = true">
        {{ resuming ? $t('read.resume') : $t('read.begin') }}
      </button>

      <!-- Put away from the page it is read on, which is where a Reader decides
           they want it again. An Author with no account for it is told so once,
           in the same place, and is left on the Story. -->
      <div v-if="story" class="away">
        <Gathering v-if="loggedIn" :story-id="id" :title="story.title" />
        <p v-else class="signed-out">{{ $t('lists.signedOut') }}</p>
      </div>
    </header>

    <!-- Kept for this Story in this browser, so the Reader who left comes back to
         where they stood. The Preview draws the same component and keeps
         nothing: an Author on the bench is testing, not reading. -->
    <Reading v-if="story && begun" :story="story" :kept-for="id" />

    <!-- The credits, and they are drawn here rather than inside the Reading
         because a Preview is the same component and an Author testing their own
         Story is not somebody to send to the Catalogue. Under the reel and under
         the way back to its start, so nothing stands between a frame and the
         ways out of it. In the document from the first Shot, as the Comments
         under it are: a Story is signed where it is named and not where it ends,
         and the way on is the one the wordmark already offers overhead, so
         holding it back until the path runs out would hide a signature without
         closing a door. Offered to whoever turns up — finding something to read
         needs an account no more than reading does. -->
    <p v-if="story" class="onward">
      <!-- The Name leads to the Author, as it does from an entry on a shelf: one
           page, two ways out of it. An Author who has never written a Name signs
           nothing here, which is what a shelf does rather than fall back to the
           one thing an account always has. -->
      <span v-if="story.authorName" class="eyebrow">
        {{ $t('catalogue.by') }}
        <NuxtLink class="who" :to="localePath(`/profile/${story.authorId}`)">
          {{ story.authorName }}
        </NuxtLink>
      </span>
      <NuxtLink class="trail" :to="localePath('/catalogue')">{{ $t('lists.toCatalogue') }}</NuxtLink>
    </p>

    <!-- What has been said about the Story, under the Story: whoever came to
         read it meets the work before anybody's answer to it. Read with or
         without an account, like the Reading above it. -->
    <Comments v-if="story" :story-id="id" />
  </main>
</template>

<style scoped>
/* The title card with its frame: the Cover down the left, the words beside it,
   the same card the shelf drew so the Reader knows they arrived. The wordmark
   keeps the full width above both, where it is on every other public page. */
header.covered {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  column-gap: var(--s4);
}

/* Tracked wider than any label, as it is at the head of the Catalogue, of a
   Profile, of the Lists and of an Author's own Stories: the five pages that wear
   the mark declare it the same way, because five copies that have drifted are
   five marks. The margin is the one line the other four have no use for: their
   headers set their own rows on `--s2` and the wordmark takes that step from the
   gap, where this header takes `--s1` from `.room > header` — the step the three
   lines of the title card are read on, and the wordmark is not one of them. */
.wordmark {
  grid-column: 1 / -1;
  margin-block-end: var(--s2);
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-decoration: none;
}

.wordmark:hover {
  color: var(--paper);
}

.cover {
  grid-row: 2 / span 3;
  inline-size: 9rem;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

h1 {
  font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem);
}

/* The one control the title card carries where the Story asks for it: the
   press that is both the Reader's consent and the gesture a browser requires
   before anything may play. `.primary` because it is the one action the card
   is for — there is nothing else to press until it has been. Pinned to the
   second column: a covered card's Cover spans three rows and this is a fourth
   one down the text beside it, so left to auto-placement it would fall back
   into the Cover's own column once that span runs out. */
.beginning {
  grid-column: 2;
  margin-block-start: var(--s3);
  padding-inline: var(--s4);
}

/* Under the title card, off the line the title sits on: what is offered about
   the Story is not part of the Story. Pinned to the second column for the same
   reason `.beginning` above it is: it is the row past a covered card's Cover. */
.away {
  grid-column: 2;
  margin-block-start: var(--s2);
}

.signed-out {
  color: var(--muted);
  font-size: 0.875rem;
  max-inline-size: 60ch;
}

/* Held to the column the Reading and the Comments are held to, so the page reads
   as one strip of film and not three. At the leading edge, under the way back to
   the start rather than beside it, so the ways out of a frame keep the line they
   are read on to themselves. */
.onward {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
}

/* The Name is the one thing in the line that leads to a person, so it is the one
   thing lit: the words around it are stencil and stay muted, as on a shelf. */
.who {
  color: var(--paper);
}
</style>
