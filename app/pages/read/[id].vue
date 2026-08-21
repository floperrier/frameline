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
    <h1>{{ story?.title }}</h1>
    <Reading v-if="story" :story="story" />
  </main>
</template>
