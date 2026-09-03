<script setup lang="ts">
/**
 * What the bench found in the Story, said in the row above the bench and beside
 * the bar every act is named in. The reading itself is `app/utils/remarks.ts`;
 * this is the one place it is shown.
 *
 * It stands here rather than on the graph because
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md` took the canvas off
 * the critical path: a Story is now written, corrected and published without the
 * graph ever being unfolded, so anything said only on the drawing is said to
 * nobody. This row is on the screen in both of the bench's states — it is where
 * `0035` put the way into the Commands — and a count in it is a count an Author
 * passes their eyes over on the way to everything else.
 *
 * A disclosure rather than a panel or a badge on a card: the count is what an
 * Author glances at, and the sentences are what they open when they mean to act
 * on one. It says so even when there is nothing to say — a count that appeared
 * only on a Story with something wrong would be a thing an Author had to notice
 * the absence of; standing there at nothing, it is somewhere they can look.
 *
 * The line and its count are in the flow of the row, always the same height; the
 * list it opens into is laid over the head of the bench. The zoom controls beside
 * it argue the opposite way and both are right: those are always there, so a card
 * scrolled under them is a card that cannot be pressed, while this is open only
 * for as long as an Author is reading it and covers the one thing they are not
 * looking at meanwhile.
 */
const { story, sceneWritten } = defineProps<{
  /** The Story on the bench, which is the whole of what a Remark is read from. */
  story?: StoryInEditor
  /** The Scene on the writing surface, if one is — see `spoken`. */
  sceneWritten?: string
}>()

/**
 * Which Scene the Author asked to be taken to. The same act the card's own
 * control and the bar's *Go to X* perform, by the same route: the page owns
 * which Scene is being written, and a list that routed there itself would be a
 * second navigation of the bench able to disagree with the first two about where
 * a Scene is.
 */
const emit = defineEmits<{ open: [string] }>()

/**
 * The Remarks the bench says out loud, which is every one it found less whatever
 * the Preview beside the writing surface is already saying. Two voices for one
 * fact is the objection `0034` raised about the Exit's text, and the Preview says
 * both of these in the Scene's own words while that Scene is open: that the Story
 * opens on nothing, and that nothing leads to the Scene being written.
 *
 * It says only one of them at a time, though, and that bounds what is dropped.
 * A Story with no opening Scene is the whole of what the Preview reports — there
 * is nowhere to read from, so it never gets as far as the Scene on the surface —
 * and a Remark dropped there would be a fact said by nobody. So the Scene's own
 * sentence is left to the Preview only where the Story opens somewhere.
 *
 * Dropped here rather than in the reading, which knows the Story and has no
 * business knowing the bench.
 */
/**
 * Whether the list is open, which the disclosure itself settles and this only
 * hears about. Kept because the name the bar offers the summary under has to say
 * what pressing it will do: a `<summary>` toggles, so *Read the Remarks* against
 * an open list would close it, and a Command whose name and act disagree is the
 * one thing `0035` marks a control to prevent. Named by the state, the way the
 * header names Publish and Unpublish on the same fact.
 */
const open = ref(false)

const spoken = computed(() => {
  const found = story ? remarks(story) : []
  if (!sceneWritten) return found

  return found.filter(remark => !(
    remark.name === 'noOpening'
    || (remark.name === 'sceneUnreached'
      && remark.sceneId === sceneWritten
      && story?.openingSceneId)
  ))
})
</script>

<template>
  <details class="found" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <!-- Marked as a Command, because reading what the bench found is an act of it
         like the fit and the Publish — see
         `docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md`. A
         summary is pressed by the bar exactly as it is pressed by a hand, and it
         is named for what that press does from where the list stands. -->
    <summary :data-command="$t(open ? 'editor.closeRemarks' : 'editor.readRemarks')">
      {{ $t('editor.remarks') }}
      <span class="numbered">{{ spoken.length }}</span>
    </summary>

    <p v-if="!spoken.length" class="none">{{ $t('editor.noRemarks') }}</p>
    <ul v-else>
      <li v-for="(remark, at) in spoken" :key="`${remark.name}-${at}`">
        <!-- The Remark said of the Story itself — that it opens nowhere — has no
             Scene to be taken to, so it is a sentence rather than a control that
             would go nowhere when pressed. -->
        <button v-if="remark.sceneId" type="button" @click="emit('open', remark.sceneId)">
          {{ $t(`remark.${remark.name}`, remark.said) }}
          <span class="visually-hidden">
            {{ $t('editor.remarkAbout', { scene: remark.said.scene }) }}
          </span>
        </button>
        <p v-else>{{ $t(`remark.${remark.name}`, remark.said) }}</p>
      </li>
    </ul>
  </details>
</template>

<style scoped>
/* Drawn in the machine's own materials, like the control beside it: this is the
   bench talking about the Story rather than any part of the Story. */
.found {
  position: relative;
  align-self: end;
  min-inline-size: 0;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
}

/* What the disclosure opens into: under its own line and over the head of the
   bench, drawn in the same materials so that it reads as the rest of that line
   rather than as something the bench put on top of itself. */
.found > :not(summary) {
  position: absolute;
  inset-block-start: calc(100% + var(--s1));
  inset-inline-start: 0;
  z-index: 2;
  padding: var(--s2);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

/* A closed disclosure is one line and its count; open, it is a list under the
   same line. The marker is the browser's, because a triangle that says a thing
   opens is one every reader of a page already knows. */
summary {
  cursor: pointer;
  font-family: var(--data);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.found[open] summary {
  color: var(--paper);
}

/* The count in the grease pencil the Author's own marks are written in, because
   what it counts is what is written on the film and not what the machine is
   doing. */
.numbered {
  color: var(--grease);
  font-variant-numeric: tabular-nums;
}

ul {
  display: grid;
  gap: var(--s1);
  /* As wide as a sentence and no wider, and never taller than the head of the
     bench: a Story of forty Remarks scrolls inside its own disclosure rather
     than running off the foot of the bench. */
  inline-size: max-content;
  max-inline-size: min(52ch, 90vw);
  max-block-size: 16rem;
  overflow-y: auto;
}

/* A Remark reads as the sentence it is, not as a button: the whole line is the
   target, aligned to the start and wrapping like prose, and what says it can be
   pressed is the machine's own light under the pointer. */
li button,
li p {
  inline-size: 100%;
  padding: var(--s1) var(--s2);
  color: var(--paper);
  font-size: 0.875rem;
  text-align: start;
}

li button {
  border-color: transparent;
  background: none;
  font-family: inherit;
  text-transform: none;
  letter-spacing: normal;
}

li button:hover,
li button:focus-visible {
  border-color: var(--edge);
  background: var(--steel-lit);
  color: var(--light);
}

.none {
  max-inline-size: min(46ch, 90vw);
  color: var(--muted);
  font-size: 0.875rem;
}
</style>
