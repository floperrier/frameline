<script setup lang="ts">
// Where a Reader reads a published Story. No middleware and no session: the page
// asks nothing of whoever opens the link.
const id = useRoute().params.id as string
const { data: story } = await useAsyncData(
  `read-${id}`,
  () => send(`/api/read/${id}`) as Promise<StoryToShow & { title: string }>,
)

// An unpublished Story, or one that was unpublished after this link went out, is
// not here — and neither is a Story that never existed. The page cannot tell the
// three apart, which is the point.
if (!story.value) {
  throw createError({ statusCode: 404, statusMessage: 'No such Story.', fatal: true })
}
</script>

<template>
  <main>
    <h1>{{ story?.title }}</h1>
    <Reading v-if="story" :story="story" />
  </main>
</template>
