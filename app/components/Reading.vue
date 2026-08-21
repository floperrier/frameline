<script setup lang="ts">
/**
 * One Reading of a Story on screen. An Author's Preview and a Reader's Reading
 * are the same thing seen from two doors, so both draw this: nothing a Reader
 * meets can go untested by a Preview, and nothing an Author previews can behave
 * differently once it is published.
 *
 * The Position lives here and nowhere else. It never leaves the browser, so
 * every Reading starts with empty State and two Readers of one Story cannot
 * share what they have accumulated — there is no place for them to share it.
 * Leaving the page starts the Story over for the same reason.
 */
const { story } = defineProps<{ story: StoryToShow }>()

const at = ref<Position>(OPENING)
const shown = computed(() => reading(story, at.value))

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

/**
 * A Cut nobody has phrased yet is offered by where it arrives. An unphrased Cut
 * is half of what a Preview is for; a published one is a Story its Author let
 * out unfinished, and a Reading that cannot go on is the worse answer.
 */
function offered(cut: Cut) {
  return cut.text || `Cut to ${sceneNames.value.get(cut.toSceneId)}`
}
</script>

<template>
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

<style scoped>
.shot {
  white-space: pre-wrap;
}
</style>
