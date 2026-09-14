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
 * Nothing has to be scoped to a Scene by id, although the document holds every
 * Scene of the Story at once: a Step that points into the writing is marked on the
 * Scene the caret is in and on no other — `app/components/Writing.vue` writes
 * `data-step` under `held.here` — so the selector finds one element however long
 * the Story is. The rest are drawn once, outside the document.
 */
const pointing = computed(() => step.value && `[data-step="${step.value.target}"]`)

function dismiss() {
  localStorage.setItem(dismissalOf(story!.id), '1')
  dismissed.value = true
}

/**
 * The target's rectangle, read every frame for as long as a Step is showing.
 *
 * A frame at a time rather than on a list of the things that move it: the
 * document scrolls, the caret moves to another Scene and the marks move with it,
 * the window resizes, a Refusal is drawn — against a Scene, or above the bench —
 * and pushes what is under it down, and a spotlight that lags one of those is a
 * defect an Author sees immediately. Nothing is written unless
 * the rectangle actually changed, so a bench nobody is touching costs a read and
 * no render, and the loop stops the moment the Step is met — which is the point of
 * the Step.
 */
function look() {
  const target = pointing.value ? document.querySelector(pointing.value) : null
  const seen = target?.getBoundingClientRect()
  // An element that is in the document and draws nothing measures nothing, and a
  // light on a rectangle of no size would be a dot in the corner of the bench
  // rather than on the control the sentence names. Read as absent, so the bubble
  // goes adrift rather than being wrong about the screen.
  const reachable = seen?.width && seen.height
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
    <!-- Drawn whether or not there is anything to point at. The Author can turn
         the middle of the bench over to the reading, move the caret to another
         Scene and take the marks with it, or scroll the target out of the document
         at any moment, and a bubble pointing at nothing would be the guidance being
         wrong about the screen; adrift, it carries the same sentence from a
         corner. -->
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

/* Pointing at nothing: the same sentence, put where it can always be read. It
   takes no pointer there, for the reason the spotlight takes none: the corner it
   stands in is where the document ends, and on the bench that is a Scene's own
   last controls — a panel over them would be guidance that made the thing it is
   guiding unreachable. Its own control takes the pointer back, so the sentence can
   still be waved away by hand. Where the bubble should be anchored instead of
   adrift is issue #257's. */
.bubble.adrift {
  inset-block-end: var(--s4);
  inset-inline-start: var(--s4);
  pointer-events: none;
}

.bubble.adrift button {
  pointer-events: auto;
}

.asked {
  text-wrap: pretty;
}
</style>
