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
 * Drawn by both surfaces that refuse, the editor and the Stories list, so the
 * two refuse in one voice and there is one place the voice is written.
 */
const { problem } = defineProps<{
  /** The refusal on screen, while there is one and not after. */
  problem?: Problem
}>()

const localePath = useLocalePath()
</script>

<template>
  <p v-if="problem" role="alert">
    {{ problem.said }}
    <NuxtLink v-if="problem.door" :to="localePath('/')" target="_blank">
      {{ $t('error.signInAgain') }}
    </NuxtLink>
  </p>
</template>
