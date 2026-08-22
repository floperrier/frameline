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
      <NuxtLink class="back" :to="`/stories/${id}`">Back to the Story</NuxtLink>
      <!-- Said in the room the Reader will be in, and marked as the Author's own
           run through it rather than dressed up as a published Story. -->
      <p class="eyebrow">Nobody else can reach this</p>
      <h1>Preview of {{ story?.title }}</h1>
    </header>

    <!-- Said plainly to the Author, who can go and name one. A Reader meeting the
         same Story is simply told the path ends. -->
    <p v-if="story && !story.openingSceneId" class="nothing">
      This Story has no opening Scene, so there is nothing to read yet.
    </p>

    <Reading v-else-if="story" :story="story" />
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

.back {
  justify-self: start;
  margin-block-end: var(--s3);
  font-family: var(--data);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem);
}

.nothing {
  inline-size: min(100%, 46rem);
  margin-inline: auto;
  padding: var(--s4);
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
  color: var(--muted);
}
</style>
