<script setup lang="ts">
/**
 * A Shot's text, drawn as it was formatted by the renderer in
 * `app/utils/draw.ts`, which builds no markup string. The root takes whatever it
 * is given — `class="shot"`, an id, a role, a `lang` — and says where the text
 * stands, which only a frame laid out `full` over an Image, or a card, reads.
 */
import type { TextCut } from '~/utils/draw'

const { formatted, cut } = defineProps<{ formatted: Formatted, cut?: TextCut }>()

/** The text itself, a fragment of the renderer's VNodes. */
const Drawn = () => drawFormatted(formatted, cut)
</script>

<template>
  <div :data-stands="formatted.attrs?.stands ?? undefined"><Drawn /></div>
</template>
