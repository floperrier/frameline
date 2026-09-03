<script setup lang="ts">
/**
 * The bench asking an Author for the next thing, and lighting the control it is
 * asking about.
 *
 * Which Step is showing is a question asked of the Story — `app/utils/steps.ts` —
 * so this draws it and nothing else. Two elements: a spotlight sitting on the
 * target's own rectangle, and a bubble beneath it carrying the sentence. Neither
 * is a `<dialog>`, and nothing here is modal: the Author has to be able to type
 * into the very field being pointed at, so the guidance makes nothing inert and
 * takes nothing out of the top layer's way.
 *
 * What the bench itself makes inert is read rather than ignored. The writing
 * surface covering the bench on a phone puts the header and the graph out of
 * reach — `docs/adr/0036-the-surface-that-covers-the-bench-is-not-a-dialog.md` —
 * and a Step pointing in there says so from the corner instead of lighting a
 * control the Author cannot press. That the surface is not a dialog is what lets
 * the light and the bubble be drawn over it at all.
 *
 * The bubble is an `<aside>` rather than a live region. It is on screen from the
 * moment the page is, and a live region firing every time a step is met would
 * talk over the field the Author is typing in — the same reason the bench's
 * `keptAt` mark is not one either.
 */
const { story } = defineProps<{
  /** The Story on the bench, which is the whole of what a Step is computed from. */
  story?: StoryInEditor
}>()

/**
 * How far the bubble sits from the control it points at, and how wide it is
 * allowed to be. Both are here rather than in the stylesheet because the
 * placement is arithmetic on a client rectangle and the two numbers have to
 * agree with each other.
 */
const BUBBLE_GAP = 12
const BUBBLE_WIDTH = 320

/**
 * Whether the Author has waved this Story's guidance away. Starts as though they
 * had, so that nothing is drawn before the browser has been asked: the page
 * renders on the server, where there is no local storage and no rectangle to
 * point at, and a bubble in the first frame would only be taken away again.
 */
const dismissed = ref(true)

const step = computed(() => !dismissed.value && story ? stepShowing(story) : undefined)

/** Where the target is on screen, or nothing when the target is not on screen at all. */
const box = ref<DOMRect>()

/**
 * What the Step showing is pointing at, as a selector.
 *
 * Nothing has to be scoped to a Scene by id: the one target the canvas carries is
 * drawn on a Story with no Scene in it, and every other Step points into the
 * panel, which holds one Scene by construction.
 */
const pointing = computed(() => step.value && `[data-step="${step.value.target}"]`)

function dismiss() {
  localStorage.setItem(dismissalOf(story!.id), '1')
  dismissed.value = true
}

/**
 * The target's rectangle, read every frame for as long as a Step is showing.
 *
 * A frame at a time rather than on a list of the things that move it: the graph
 * scrolls, the panel opens and pushes it narrower, the window resizes, a Refusal
 * appears above the bench and pushes everything down, and a spotlight that lags
 * one of those is a defect an Author sees immediately. Nothing is written unless
 * the rectangle actually changed, so a bench nobody is touching costs a read and
 * no render, and the loop stops the moment the Step is met — which is the point of
 * the Step.
 */
function look() {
  const target = pointing.value ? document.querySelector(pointing.value) : null
  const seen = target?.getBoundingClientRect()
  // A target scrolled out of the panel it is in is in the document and has no
  // rectangle worth pointing at: an element that draws nothing measures nothing,
  // and a light on a rectangle of no size would be a dot in the corner of the
  // bench. Read as absent, so the bubble goes adrift rather than being wrong
  // about the screen.
  //
  // A target behind the writing surface covering the bench is read as absent for
  // the same reason, and it is the stronger case: it measures perfectly well and
  // cannot be pressed at all. The light would be drawn over the surface, on a
  // control the surface is hiding — guidance pointing through a wall. Asked of
  // the attribute rather than of the width, because `inert` is how the bench
  // writes "the Author cannot reach this" and the width is only one reason it
  // might. The attribute and not the inertness the browser imposes under a modal
  // dialog: that one needs no answer here, because a dialog is drawn above the
  // light and covers it rather than being pointed at through it.
  const reachable = seen?.width && seen.height && !target?.closest('[inert]')
  const found = reachable ? seen : undefined
  if (!alike(box.value, found)) box.value = found

  looking = step.value ? requestAnimationFrame(look) : 0
}

function alike(was: DOMRect | undefined, is: DOMRect | undefined) {
  if (!was || !is) return was === is

  return was.top === is.top && was.left === is.left
    && was.width === is.width && was.height === is.height
}

let looking = 0

// Started when a Step appears and left to `look` to end, so the loop is only ever
// running while there is something on screen following something else.
watch(() => Boolean(step.value), (showing) => {
  if (showing && !looking) looking = requestAnimationFrame(look)
}, { flush: 'post' })

onMounted(() => {
  dismissed.value = story ? localStorage.getItem(dismissalOf(story.id)) !== null : true
})

onBeforeUnmount(() => cancelAnimationFrame(looking))

/**
 * The spotlight, on the target's own rectangle. It is one element with an
 * enormous spread shadow, so what surrounds the target is dimmed by the shadow
 * and the target itself is never covered — no stacking order has to be arranged
 * and the corner the light is cut with is the target's own.
 */
const lit = computed(() => box.value && {
  top: `${box.value.top}px`,
  left: `${box.value.left}px`,
  width: `${box.value.width}px`,
  height: `${box.value.height}px`,
})

/**
 * The bubble, under the control it points at and kept on screen: a target near
 * the right edge of the window would otherwise send the sentence off it. With no
 * rectangle to work from there is no placement either, and the bubble falls back
 * to a fixed panel — see `adrift` below.
 */
const said = computed(() => box.value && {
  top: `${box.value.bottom + BUBBLE_GAP}px`,
  left: `${Math.max(
    BUBBLE_GAP,
    Math.min(box.value.left, window.innerWidth - BUBBLE_WIDTH - BUBBLE_GAP),
  )}px`,
})

/**
 * How wide the bubble is, written here rather than in the stylesheet because the
 * clamp above has to agree with it: a width in the stylesheet and a number in the
 * arithmetic would be one fact in two places, and the placement would go wrong
 * the first time one of them changed.
 */
const wide = { inlineSize: `min(${BUBBLE_WIDTH}px, calc(100vw - 2 * var(--s4)))` }
</script>

<template>
  <template v-if="step">
    <div v-if="lit" class="spotlight" :style="lit" />
    <!-- Drawn whether or not there is anything to point at. The Author can close
         the panel or scroll the target off the bench at any moment, and a bubble
         pointing at nothing would be the guidance being wrong about the screen;
         adrift, it carries the same sentence from a corner. -->
    <aside
      class="bubble"
      :class="{ adrift: !said }"
      :style="{ ...wide, ...said }"
      :aria-label="$t('step.heading')"
    >
      <p class="eyebrow">{{ $t('step.heading') }}</p>
      <p class="asked">{{ $t(`step.${step.name}`) }}</p>
      <button type="button" @click="dismiss">{{ $t('step.dismiss') }}</button>
    </aside>
  </template>
</template>

<style scoped>
/* The light itself: nothing of its own, only the shadow it throws over
   everything that is not the control being asked about. It takes no pointer, so
   every part of the bench under the dimming is still worked at normally. */
.spotlight {
  position: fixed;
  z-index: 4;
  border-radius: var(--machined);
  box-shadow: 0 0 0 100vmax color-mix(in oklab, var(--room) 70%, transparent);
  pointer-events: none;
}

/* The bench's own materials, the way the confirmation is: this is the machine
   talking, so it is drawn in the machine's light rather than in a tooltip. */
.bubble {
  position: fixed;
  z-index: 5;
  display: grid;
  gap: var(--s2);
  justify-items: start;
  padding: var(--s3) var(--s4) var(--s4);
  border: 1px solid var(--light);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

/* Pointing at nothing: the same sentence, put where it can always be read. */
.bubble.adrift {
  inset-block-end: var(--s4);
  inset-inline-start: var(--s4);
}

.asked {
  text-wrap: pretty;
}
</style>
