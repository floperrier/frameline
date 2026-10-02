<script setup lang="ts">
/**
 * A Shot's text, drawn as it was formatted by the renderer in
 * `app/utils/draw.ts`, which builds no markup string. The root takes whatever it
 * is given — `class="shot"`, an id, a role, a `lang` — and says where the text
 * stands, which only a frame laid out `full` over an Image, or a card, reads.
 * The Reading passes `moving`, and every other surface draws a run still.
 */
import type { Moving, TextCut } from '~/utils/draw'

const { formatted, cut, moving } = defineProps<{ formatted: Formatted, cut?: TextCut, moving?: Moving }>()

/** The text itself, a fragment of the renderer's VNodes. */
const Drawn = () => drawFormatted(formatted, cut, moving)
</script>

<template>
  <div :data-stands="formatted.attrs?.stands ?? undefined"><Drawn /></div>
</template>
