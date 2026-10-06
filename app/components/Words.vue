<script setup lang="ts">
/**
 * How many words a Scene holds, said beside the heading of its run — the one
 * count an Author writing prose asks of a document.
 *
 * A component of its own for what it costs rather than for what it draws. It is
 * the one figure on the bench that changes on every keystroke, and read straight
 * into the document's template it makes every keystroke the document's business:
 * a count over the whole Story recomputed to say one number, and the writing's own
 * render dragged along behind it, which on a Story of forty Scenes rebuilds every
 * Scene's list of where a way on may land. A component re-renders on what its own
 * render read, so what a character typed into a beat invalidates here is this
 * Scene's count and nothing else — see `app/components/Landing.vue`, which is the
 * other half of the same argument.
 */
const { shots } = defineProps<{
  /** The Shots whose words are counted, which are one Scene's. */
  shots: Shot[]
}>()

const { t } = useI18n()

const counted = computed(() => countedWords(wordsOf(shots), t))
</script>

<template>
  <span>{{ counted }}</span>
</template>
