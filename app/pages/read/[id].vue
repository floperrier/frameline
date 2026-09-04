<script setup lang="ts">
// Where a Reader reads a published Story. No middleware and no session: the page
// asks nothing of whoever opens the link.
//
// The one route left out of localized routing, so the link an Author hands out
// is `/read/<id>` whatever language either of them reads — see
// `docs/adr/0012-the-public-link-carries-no-locale.md`. The chrome is still in
// the Reader's own Locale, detected from their browser; only the address has no
// say in it.
definePageMeta({ i18n: false })

const id = useRoute().params.id as string
const { loggedIn } = useUserSession()
const { data: story, error } = await useAsyncData(
  `read-${id}`,
  () => send(`/api/read/${id}`) as Promise<StoryToShow & { title: string, language: string, cover: string | null }>,
)

// An unpublished Story, one unpublished after this link went out, and one that
// never existed are all the same not-found, which is the point. Anything else
// that went wrong is passed on as itself: a Reader of a Story that is very much
// published must not be told it is gone because a query failed.
if (error.value) throw createError({ ...error.value, fatal: true })
</script>

<template>
  <main class="room">
    <!-- The title card: the Story is named once, at the head of the reel, and
         then the frames have the room to themselves. -->
    <header :class="{ covered: story?.cover }">
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
    <Reading v-if="story" :story="story" :kept-for="id" />

    <!-- What has been said about the Story, under the Story: whoever came to
         read it meets the work before anybody's answer to it. Read with or
         without an account, like the Reading above it. -->
    <Comments v-if="story" :story-id="id" />
  </main>
</template>

<style scoped>
/* The title card with its frame: the Cover down the left, the words beside it,
   the same card the shelf drew so the Reader knows they arrived. */
header.covered {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  column-gap: var(--s4);
}

.cover {
  grid-row: 1 / span 3;
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
</style>
