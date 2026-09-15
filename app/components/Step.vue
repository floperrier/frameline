<script setup lang="ts">
/**
 * The bench asking an Author for the next thing, and lighting the control it is
 * asking about.
 *
 * Which Step is showing is a question asked of the Story — `app/utils/steps.ts` —
 * so this draws it and nothing else. Two elements: a spotlight sitting on as much
 * of the target as anybody can see, and a bubble beside it carrying the sentence.
 * Neither is a `<dialog>`, and nothing here is modal: the Author has to be able to
 * type into the very field being pointed at, so the guidance makes nothing inert,
 * takes nothing out of the top layer's way, and answers no pointer anywhere but on
 * its own control.
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

/**
 * As much of the target as is on screen, or nothing when none of it is — which is
 * what `drawn` below reads and the whole of what the two elements are placed from.
 */
const box = ref<DOMRect>()

/** The bubble itself, whose own height the placement is bounded by. */
const bubble = useTemplateRef<HTMLElement>('bubble')

/**
 * The three numbers the placement is arithmetic on besides the target: how tall
 * the panel is, and how wide and how tall the window is. All three are read in the
 * loop below, with the target's own rectangle, because none of them is reactive on
 * its own — a window made shorter moves nothing in a document that already fits
 * across it, so a placement reading `window.innerHeight` where it stands would be
 * computed once and never asked again.
 */
const measured = ref({ panel: 0, across: 0, down: 0 })

/**
 * What the Step showing is pointing at, as selectors in the order they are tried.
 *
 * Nothing has to be scoped to a Scene by id, although the document holds every
 * Scene of the Story at once: a Step that points into the writing is marked on the
 * Scene the caret is in and on no other — `app/components/Writing.vue` writes
 * `data-step` under `held.here` — so a selector finds one element however long
 * the Story is. The rest are drawn once, outside the document.
 *
 * More than one because a Step is about a row the Scene may not have written yet:
 * the Scene a Step asks for a Shot in arrives with none, so the same Step points at
 * the control that adds one until there is a beat to point at. Which of the two the
 * editor is drawing is the template's to say, and it draws exactly one of them —
 * see `app/utils/steps.ts`.
 */
const pointing = computed(() =>
  step.value?.targets.map(target => `[data-step="${target}"]`))

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
  const found = pointing.value?.map(drawn).find(Boolean)
  if (!alike(box.value, found)) box.value = found

  // The panel and the window belong to the same read: what they say is whether the
  // sentence fits under the target, and the sentence is as long as whichever Step
  // is showing in whichever language.
  const panel = bubble.value?.getBoundingClientRect().height ?? 0
  if (panel !== measured.value.panel || window.innerWidth !== measured.value.across
    || window.innerHeight !== measured.value.down) {
    measured.value = { panel, across: window.innerWidth, down: window.innerHeight }
  }

  looking = step.value ? requestAnimationFrame(look) : 0
}

/**
 * As much of the element a selector reaches as anybody can see, and nothing where
 * it reaches none — or reaches one the editor is not drawing, or one nothing is
 * left of. An element that is in the document and draws nothing measures nothing,
 * and a light on a rectangle of no size would be a dot in the corner of the bench
 * rather than on the control the sentence names; a target scrolled past leaves
 * nothing at all, and both the light and the sentence placed against it would be
 * somewhere else entirely. Read as absent, so the Step falls to its next target
 * and then to the corner rather than being wrong about the screen.
 *
 * Seen against what: every scroller standing between the target and the window,
 * and then the window. The document is one of them — `overflow-y: auto`, starting
 * under the Story's own edge — so a mark wound above that edge is clipped, and
 * what is left of it is what the light is drawn on.
 *
 * Cut down rather than only tested, because half a target is the case a test
 * cannot answer. A mark the document had half swallowed measured a whole rectangle
 * that still met every clip, and the light drawn on the whole of it hung over the
 * bench: at 900 tall on a Story of forty at the Flags Step, wound two pixels at a
 * time, fifty-eight pixels of scroll with the light outside the document at every
 * width, and at 1280 thirty of them with `elementFromPoint` at the light's own
 * centre answering the `header` — twenty-eight answering the Remarks' own summary
 * at the widths where the bench folds what it says into a band over the document —
 * with fifty-seven of the worst frame's fifty-nine pixels above the edge. Cut down,
 * the two cases are one: a half-clipped target is lit on the half that is there and
 * a wholly clipped one on nothing, and the sentence, which is placed from these
 * edges, goes with it.
 *
 * Every clipping ancestor rather than the document by name, because the bench has
 * more than one scroller and the last Step's target stands in another: the strip
 * the acts wind sideways in at the width of a phone.
 */
function drawn(selector: string) {
  const found = document.querySelector(selector)
  if (!found) return undefined

  let seen = found.getBoundingClientRect()
  if (!seen.width || !seen.height) return undefined

  for (let over = found.parentElement; over; over = over.parentElement) {
    if (getComputedStyle(over).overflow !== 'visible') {
      seen = within(seen, over.getBoundingClientRect())
    }
  }
  seen = within(seen, new DOMRect(0, 0, window.innerWidth, window.innerHeight))

  return seen.width && seen.height ? seen : undefined
}

/**
 * What is left of a rectangle inside another, and a rectangle of no size where
 * they do not meet at all — which is the same answer as a target that draws
 * nothing, and is read as absent by the one test above.
 */
function within(seen: DOMRect, clip: DOMRect) {
  const top = Math.max(seen.top, clip.top)
  const left = Math.max(seen.left, clip.left)

  return new DOMRect(left, top,
    Math.max(0, Math.min(seen.right, clip.right) - left),
    Math.max(0, Math.min(seen.bottom, clip.bottom) - top))
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
 * The spotlight, on as much of the target's rectangle as anybody can see. It is
 * one element with an enormous spread shadow, so what surrounds the target is
 * dimmed by the shadow and the target itself is never covered — no stacking order
 * has to be arranged and the light is cut to the shape of what it is on.
 *
 * What a half-clipped target costs is the machined corner drawn along an edge the
 * scroller cuts straight. Weighed against the light hanging over the bench at that
 * edge, which is what it is instead of.
 */
const lit = computed(() => box.value && {
  top: `${box.value.top}px`,
  left: `${box.value.left}px`,
  width: `${box.value.width}px`,
  height: `${box.value.height}px`,
})

/**
 * The bubble, against the control it points at and kept whole on the screen.
 *
 * Under the target where the sentence fits under it, and above it where it does
 * not: a window a Shot's field sits near the foot of is an ordinary window, and a
 * sentence placed below it would run off the bottom of the screen. Never over it,
 * which is the one placement ruled out — the light is on that control and the
 * Author is being asked to press it.
 *
 * Sideways it is slid rather than flipped, because a sentence moved along the
 * window still stands against the control it is about: a target near the right
 * edge would otherwise send it off the screen.
 *
 * The edges it is measured from are the ones `drawn` read, which are the seen
 * part of the target rather than the whole of it. That is what puts the sentence
 * against a half-clipped mark instead of against the part of it standing under a
 * scroller's edge, where the mark is not and nor is the light.
 *
 * With no room on either side of the target — and with no rectangle at all — there
 * is no placement, and the bubble falls back to a fixed panel: see `adrift` below.
 */
const said = computed(() => {
  const seen = box.value
  if (!seen) return undefined

  const { panel, across, down } = measured.value
  const under = seen.bottom + BUBBLE_GAP
  const top = under + panel <= down ? under : seen.top - BUBBLE_GAP - panel
  if (top < 0) return undefined

  return {
    top: `${top}px`,
    left: `${Math.max(BUBBLE_GAP, Math.min(seen.left, across - BUBBLE_WIDTH - BUBBLE_GAP))}px`,
  }
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
         the middle of the bench over to the reading, which takes the document and
         every mark in it off the screen, or scroll the target out of the document
         at any moment, and a bubble pointing at nothing would be the guidance being
         wrong about the screen; adrift, it carries the same sentence from a
         corner. -->
    <aside
      ref="bubble"
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
   talking, so it is drawn in the machine's light rather than in a tooltip.

   It takes no pointer, for the reason the spotlight takes none. Wherever it
   stands it stands over the document — under the control it points at, or in the
   corner where the document ends, which on the bench is a Scene's own last
   controls — and a panel that swallowed a press would be guidance making the
   thing it guides unreachable. Its own control takes the pointer back, so the
   sentence can still be waved away by hand.

   The sentence itself does not, and that is a real loss: a Step that names a Flag
   and the value to give it — *courage = high* — is naming words an Author would
   otherwise take out of it with the mouse and put in the field the light is on.
   Driven at 1280 by 720, which is an ordinary window, the panel stands on three
   controls of the Scene being written — the Shot's Image, *Add a Condition to Shot
   1* and *Add a Shot* — so words that answered a pointer would cost three presses
   that silently do nothing. The retyping is the cheaper of the two. */
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
  pointer-events: none;
}

.bubble button {
  pointer-events: auto;
}

/* Said from a corner rather than against a control: the same sentence, put where
   it can always be read. Three things leave a Step with nowhere to stand — the
   middle of the bench turned over to the reading, which takes the document and
   every mark in it off the screen; the target wound out of the scroller it stands
   in or off the window altogether, which is a document of forty Scenes moving
   under a mark on the Scene the caret is in; and a window with room for the
   sentence neither under the target nor over it. A Step is otherwise pointed at a
   control that is drawn whatever the Scene holds, or at the one that writes the
   row it is about. */
.bubble.adrift {
  inset-block-end: var(--s4);
  inset-inline-start: var(--s4);
}

.asked {
  text-wrap: pretty;
}
</style>
