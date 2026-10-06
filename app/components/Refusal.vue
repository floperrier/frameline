<script setup lang="ts">
/**
 * What the server said when it refused, and the one gesture that refusal offers.
 * The words are always the server's — negotiated from the request that carried
 * the write, see `docs/adr/0009-a-refusal-travels-in-the-body.md` — and the door
 * is drawn on the `401` status alone, which `useEditing` reads off the refusal.
 *
 * The door sits inside the `role="alert"`, so it is announced with the sentence
 * that gives it its sense, and it opens beside this page rather than in it: the
 * tab holding the Story is never navigated, so the field being typed in when the
 * door shut survives. Nothing moves the focus. See
 * `docs/adr/0016-the-door-is-reopened-beside-the-bench.md`.
 *
 * A refusal about one Scene of a document names that Scene, because on the bench
 * it is not drawn against it: a band standing inside the document covers a row of
 * the writing wherever it is put, so the sentence stands above the scroller and
 * the Scene is said in the words — see `.refused` in
 * `app/pages/stories/[id]/index.vue`. The Stories list refuses about no Scene and
 * passes none.
 *
 * Drawn by both surfaces that refuse, the editor and the Stories list, so the
 * two refuse in one voice and there is one place the voice is written.
 */
const { problem, scene } = defineProps<{
  /** The refusal on screen, while there is one and not after. */
  problem?: Problem
  /** The name of the Scene the refusal is about, where it is about one. */
  scene?: string
}>()

const localePath = useLocalePath()
</script>

<template>
  <p v-if="problem" role="alert">
    <template v-if="scene">{{ $t('error.inScene', { scene }) }}</template>
    {{ problem.said }}
    <NuxtLink v-if="problem.door" :to="localePath('/')" target="_blank">
      {{ $t('error.signInAgain') }}
    </NuxtLink>
  </p>
</template>
