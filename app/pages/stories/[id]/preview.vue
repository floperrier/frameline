<script setup lang="ts">
// The Author plays their own Story here, before anyone else can see it. Nothing
// about the Story changes and nobody else can reach the page: what it draws is
// the same component, and so the same engine, a Reader runs once it is published.
definePageMeta({ middleware: 'authenticated' })

const id = useRoute().params.id as string
const headers = useRequestHeaders(['cookie'])
const { data: story } = await useAsyncData(
  `preview-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
)
</script>

<template>
  <main>
    <header>
      <NuxtLink :to="`/stories/${id}`">Back to the Story</NuxtLink>
      <h1>Preview of {{ story?.title }}</h1>
    </header>

    <!-- Said plainly to the Author, who can go and name one. A Reader meeting the
         same Story is simply told the path ends. -->
    <p v-if="story && !story.openingSceneId">
      This Story has no opening Scene, so there is nothing to read yet.
    </p>

    <Reading v-else-if="story" :story="story" />
  </main>
</template>
