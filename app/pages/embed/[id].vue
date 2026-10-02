<script setup lang="ts">
// A published Story laid inside somebody else's page: the one page another site
// may frame, which is why it is a page of its own rather than a flag on the
// reading page — the framing policy is per route, and the reading page keeps
// refusing to be framed. See `docs/adr/0068-a-story-plays-inside-another-page.md`.
//
// The title card and the Reading and nothing else, with one way back to
// Frameline. No Gathering and no Comments: both need the session cookie, which
// a browser does not send to a frame of another site.
//
// Out of localized routing for the reason the reading page is: the code an
// Author pastes names `/embed/<id>` whatever language either of them reads, and
// the chrome is in the visitor's own Locale.
definePageMeta({ i18n: false })

const id = useRoute().params.id as string
const { data: story, error } = await useAsyncData(
  `embed-${id}`,
  () => send(`/api/read/${id}`) as Promise<StoryAtItsLink>,
)

// The not-found the reading page gives, for the same three reasons.
if (error.value) throw createError({ ...error.value, fatal: true })

// A search engine that comes across the frame is sent to the reading page, where
// the Comments are, rather than told about a page made to be put inside another.
const origin = useRequestURL().origin

useHead({ link: [{ rel: 'canonical', href: `${origin}/read/${id}` }] })
useSeoMeta({ title: () => story.value?.title, robots: 'noindex' })

const begun = ref(false)
const reading = useTemplateRef('reading')

/**
 * The card gives the frame up to the Reading, which reads back a kept Path as it
 * mounts, and the Reader is put where a press always puts them. The frame is
 * scrolled back to its head rather than the Reading scrolled into view: that
 * would scroll the host's page as well, and the host's page is not ours to move.
 */
async function begin() {
  begun.value = true
  await nextTick()
  scrollTo(0, 0)
  reading.value?.land()
}
</script>

<template>
  <main class="room" :class="{ begun }">
    <header v-if="story && !begun">
      <TitleCard :id="id" :story="story" framed @begin="begin" />
    </header>
    <!-- The card's heading, kept for whoever reads the frame by its headings
         once the card has given the frame up. -->
    <h1 v-else-if="story" class="visually-hidden" :lang="story.language">{{ story.title }}</h1>

    <!-- Kept for this Story in this browser, as on the reading page. A browser
         that keeps nothing for a frame of another site keeps nothing here, and
         the Reading goes on unkept. -->
    <Reading v-if="story && begun" ref="reading" :story="story" :kept-for="id" />

    <!-- The one way out, to the page the Story is read on with everything said
         about it. In a tab of its own, so a press never takes the host's frame
         away from the Story. -->
    <p v-if="story" class="onward">
      <a class="trail" :href="`/read/${id}`" target="_blank" rel="noopener">
        {{ $t('read.onFrameline') }}
      </a>
    </p>
  </main>
</template>

<style scoped>
/* The frame is the room, so the room's own colour reaches its every edge and the
   margins are the frame's to spare: a blog's column is narrower than a window. */
.room {
  gap: var(--s4);
  padding-block: var(--s4);
}

/* Once begun the Reading stands at the frame's head. A beat laid out full is one
   room tall, and in a frame the room is the frame, so its press is in view
   without anything being scrolled. */
.room.begun {
  padding-block-start: 0;
}

.onward {
  inline-size: min(100%, 46rem);
  margin-inline: auto;
}
</style>
