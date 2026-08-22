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
const { data: story, error } = await useAsyncData(
  `read-${id}`,
  () => send(`/api/read/${id}`) as Promise<StoryToShow & { title: string }>,
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
    <header>
      <p class="eyebrow">A Frameline Story</p>
      <h1>{{ story?.title }}</h1>
    </header>

    <Reading v-if="story" :story="story" />
  </main>
</template>

<style scoped>
h1 {
  font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem);
}
</style>
