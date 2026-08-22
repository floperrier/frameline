<script setup lang="ts">
// Where a Reader reads a published Story. No middleware and no session: the page
// asks nothing of whoever opens the link.
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
  <main>
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
main {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--s5);
  min-block-size: 100dvh;
  padding: clamp(var(--s4), 5vw, var(--s6)) var(--s4);
  background: var(--room);
}

header {
  display: grid;
  gap: var(--s1);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
}

/* Whatever follows the title card is the projection, and it sits in the middle
   of the room rather than under the header. */
main > :last-child {
  align-self: center;
  padding-block-end: var(--s6);
}

h1 {
  font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem);
}
</style>
