<script setup lang="ts">
// The Author plays their own Story here, before anyone else can see it. The page
// holds nothing but where the Reading has got to: what is on screen comes from
// the engine, the same engine a Reader will run once the Story is published.
definePageMeta({ middleware: 'authenticated' })

const id = useRoute().params.id as string
const headers = useRequestHeaders(['cookie'])
const { data: story } = await useAsyncData(
  `preview-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
)

/** The Reading belongs to this page alone: leaving it starts the Story over. */
const at = ref<Position>(OPENING)
const shown = computed(() => story.value && reading(story.value, at.value))

const sceneNames = computed(
  () => new Map(story.value?.scenes.map(scene => [scene.id, scene.name])),
)

/**
 * A Cut the Author has not phrased yet still has to be takeable in a preview —
 * that is half of what a preview is for — so it is offered by where it arrives.
 */
function offered(cut: Cut) {
  return cut.text || `Cut to ${sceneNames.value.get(cut.toSceneId)}`
}
</script>

<template>
  <main>
    <header>
      <NuxtLink :to="`/stories/${id}`">Back to the Story</NuxtLink>
      <h1>Preview of {{ story?.title }}</h1>
    </header>

    <p v-if="!story?.openingSceneId">
      This Story has no opening Scene, so there is nothing to read yet.
    </p>

    <template v-else-if="shown">
      <p v-if="shown.sceneId" class="scene">{{ sceneNames.get(shown.sceneId) }}</p>

      <!-- One Shot at a time, and the Cuts only once the Scene has played out. -->
      <template v-if="shown.shot">
        <p class="shot">{{ shown.shot.text }}</p>
        <button type="button" @click="at = advance(at)">Next Shot</button>
      </template>

      <ul v-else-if="shown.cuts.length">
        <li v-for="cut in shown.cuts" :key="cut.id">
          <button type="button" @click="at = take(at, cut)">{{ offered(cut) }}</button>
        </li>
      </ul>

      <p v-if="shown.ended" role="status">The path ends here.</p>

      <button type="button" @click="at = OPENING">Read again from the start</button>
    </template>
  </main>
</template>

<style scoped>
.scene {
  text-transform: uppercase;
}

.shot {
  white-space: pre-wrap;
}
</style>
