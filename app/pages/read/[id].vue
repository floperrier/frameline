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
    synopsis: string
    language: string
    textFace: Face
    textAlign: Align
    cover: Cover | null
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
 * The card the link unfurls as wherever it is pasted, written on the server
 * because no unfurler runs a script. It carries what the title card and the
 * shelf carry and nothing more: a Story with no Synopsis has no description, and
 * one with no Image has no picture, rather than either being made up out of its
 * Shots — the shelf invents no lines out of the Story's own text either. A null
 * is a tag left out. The addresses are absolute, the way `StoryHeader.vue` hands
 * out the link, because the card is read from somewhere else.
 */
const origin = useRequestURL().origin

useSeoMeta({
  title: () => story.value?.title,
  ogTitle: () => story.value?.title,
  ogType: 'website',
  ogSiteName: 'Frameline',
  ogUrl: `${origin}/read/${id}`,
  description: () => story.value?.synopsis || null,
  ogDescription: () => story.value?.synopsis || null,
  ogImage: () => story.value?.cover ? `${origin}${story.value.cover.image}` : null,
  twitterCard: () => story.value?.cover ? 'summary_large_image' : 'summary',
})

/**
 * The one press every Story is given before the Reading draws anything, so the
 * opening beat's arrival and its clock are spent under the Reader's eyes rather
 * than under the title they are still reading. For a Story that carries a Sound
 * it is also the consent: a browser will not play into a page nobody has
 * touched. See `docs/adr/0063-a-story-opens-on-its-title-card.md`.
 *
 * `Resume` rather than `Begin` where this browser kept a Path for this Story,
 * read the same way the Reading itself reads it back — see `app/utils/kept.ts`
 * — so the one word said before the frame is on screen already tells a
 * returning Reader they are not starting over.
 */
const begun = ref(false)
const resuming = ref(false)

onMounted(() => {
  if (story.value) resuming.value = Boolean(keptReading(id, story.value))
})

const reading = useTemplateRef('reading')

/**
 * Mounts the Reading, which reads back a kept Path as it mounts, then puts the
 * Reader where a press always puts them and brings the Reading's head to the
 * window's head: the first beat, its words and the press under it in the window at
 * once, whatever the card above it took. Instant, as `moveTo` in the Reading makes
 * the same jump: a jump the Reader asked for is not a motion to be watched.
 */
async function begin() {
  begun.value = true
  await nextTick()
  reading.value?.land()
  reading.value?.$el.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <main class="room">
    <!-- The title card: the Story is presented once, at the head of the reel,
         and then the frames have the room to themselves. -->
    <header>
      <!-- The product's own name, leading where the Catalogue's own header leads
           home: a Reader who was sent a link and nothing else is one press from
           the room where Stories are found. -->
      <NuxtLink class="wordmark trail" :to="localePath('/catalogue')">Frameline</NuxtLink>

      <!-- The frame the Story was presented by on the shelf, drawn as wide as the
           column the Reading will stand in, because nothing plays under it until
           the Reader asks. Sixteen by nine, the shape a full beat most often lands
           in on a desk, cropped around the point the Author pressed. Decorative
           above the title that names the work — the Shot itself, with its
           Description, is met in the Reading. -->
      <img
        v-if="story?.cover"
        class="cover"
        :src="story.cover.image"
        :style="{ objectPosition: cropPosition(story.cover) }"
        alt=""
      >
      <p class="eyebrow">{{ $t('read.eyebrow') }}</p>
      <!-- The Story's own title, announced in the Story's Language while the
           line above it stays in the Reader's. -->
      <h1 :lang="story?.language">{{ story?.title }}</h1>

      <!-- What the Author wrote to present the Story, presented where it is
           opened as well as on a shelf and in the link's card. Plain text with
           its line breaks kept: only a Shot's text is formatted. -->
      <p v-if="story?.synopsis" class="synopsis" :lang="story.language">{{ story.synopsis }}</p>

      <!-- Signed where the work is named, as an entry on a shelf is, and the
           Name leads to the Author: one page, two ways out of it. An Author who
           has never written a Name signs nothing here, which is what a shelf does
           rather than fall back to the one thing an account always has. -->
      <p v-if="story?.authorName" class="eyebrow">
        {{ $t('catalogue.by') }}
        <NuxtLink class="who" :to="localePath(`/profile/${story.authorId}`)">
          {{ story.authorName }}
        </NuxtLink>
      </p>

      <!-- The one press every Story is given before it plays anything, and for a
           Story that carries a Sound the consent as well: consenting to sound is
           consenting to this one, not to sound in general. Says `Resume` rather
           than `Begin` where this browser kept a Path for this Story, so a
           returning Reader is told before the frame is even drawn that they are
           not starting over. -->
      <button v-if="story && !begun" type="button" class="beginning primary" @click="begin">
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
    <Reading v-if="story && begun" ref="reading" :story="story" :kept-for="id" />

    <!-- The way on, and it is drawn here rather than inside the Reading because
         a Preview is the same component and an Author testing their own Story is
         not somebody to send to the Catalogue. Under the reel and under the way
         back to its start, so nothing stands between a frame and the ways out of
         it. In the document from the first Shot, as the Comments under it are:
         the way on is the one the wordmark already offers overhead, so holding it
         back until the path runs out would close no door. Offered to whoever
         turns up — finding something to read needs an account no more than
         reading does. -->
    <p v-if="story" class="onward">
      <NuxtLink class="trail" :to="localePath('/catalogue')">{{ $t('lists.toCatalogue') }}</NuxtLink>
    </p>

    <!-- What has been said about the Story, under the Story: whoever came to
         read it meets the work before anybody's answer to it. Read with or
         without an account, like the Reading above it. -->
    <Comments v-if="story" :story-id="id" />
  </main>
</template>

<style scoped>
/* Tracked wider than any label, as it is at the head of the Catalogue, of a
   Profile, of the Lists and of an Author's own Stories: the five pages that wear
   the mark declare it the same way, because five copies that have drifted are
   five marks. The margin is the one line the other four have no use for: their
   headers set their own rows on `--s2` and the wordmark takes that step from the
   gap, where this header takes `--s1` from `.room > header` — the step the three
   lines of the title card are read on, and the wordmark is not one of them. */
.wordmark {
  margin-block-end: var(--s2);
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-decoration: none;
}

.wordmark:hover {
  color: var(--paper);
}

.cover {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  margin-block-end: var(--s2);
  object-fit: cover;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

h1 {
  font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem);
}

/* Quiet and measured, as it is on a shelf: what the eye lands on is the title,
   and the Synopsis is what it reads next rather than instead. */
.synopsis {
  color: var(--muted);
  max-inline-size: 60ch;
  white-space: pre-line;
}

/* The one control the title card carries: the press that starts the Reading,
   and for a Story that carries a Sound the gesture a browser requires before
   anything may play. `.primary` because it is the one action the card is for —
   there is nothing else to press until it has been. At its own width, where the
   column would stretch it. */
.beginning {
  justify-self: start;
  margin-block-start: var(--s3);
  padding-inline: var(--s4);
}

/* Under the title card, off the line the title sits on: what is offered about
   the Story is not part of the Story. */
.away {
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
