<script setup lang="ts">
/**
 * What the bench found in the Story, said beside the document on the side the
 * bench talks about the Story from. The reading itself is `app/utils/remarks.ts`;
 * this is the one place it is shown.
 *
 * It stands in a region of its own rather than in the row above the bench because
 * `docs/adr/0043-a-story-is-written-as-one-document.md` gave it one: three regions
 * that never trade width, and this is the third of them. No new noun is coined for
 * that side — *margin* and *gutter* are both already spoken for at the scale of a
 * row — so what stands there is the Remarks, which is a word the glossary already
 * has.
 *
 * A disclosure rather than a panel or a badge on a card: the count is what an
 * Author glances at, and the sentences are what they open when they mean to act
 * on one. It says so even when there is nothing to say — a count that appeared
 * only on a Story with something wrong would be a thing an Author had to notice
 * the absence of; standing there at nothing, it is somewhere they can look.
 *
 * Open by default, which is new. The list used to be laid over the head of the
 * bench, so leaving it open would have covered the table; it now flows in the
 * column it stands in, and at the fold it flows at the head of the document. There
 * is room for it, so the Remarks say what they found without being asked. What
 * folds is the width they are said in and never their voice.
 *
 * The list is still held to its own height and scrolls inside itself: a Story of
 * forty Remarks is forty sentences in one region rather than a region as tall as
 * the Story.
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
 * Whether the list is open, which the disclosure itself settles and this only
 * hears about. Kept because the name the bar offers the summary under has to say
 * what pressing it will do: a `<summary>` toggles, so *Read the Remarks* against
 * an open list would close it, and a Command whose name and act disagree is the
 * one thing `0035` marks a control to prevent. Named by the state, the way the
 * header names Publish and Unpublish on the same fact.
 *
 * It starts where the element itself starts, which is open: the two would
 * otherwise disagree until the first toggle, and the bar would offer *Read the
 * Remarks* over a list already open.
 */
const open = ref(true)

/**
 * The Remarks the bench says out loud: every one it found, and none of them left
 * to anybody else.
 *
 * Two of them used to be dropped while the Scene they were about was open,
 * because the reading standing in the column beside the writing was already
 * saying them in the Scene's own words, and two voices for one fact is the
 * objection `0034` raised about an Exit's text. The reading is one of the readings
 * the middle of the bench can hold rather than a column beside the writing — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md` — so while an Author is
 * writing, it is saying nothing to them at all, and a Remark left to it would be
 * a fact said by nobody. `0043` generalises the rule rather than dropping it: the
 * nearer voice wins, and these two are dropped exactly while the Preview is the
 * reading on screen. Issue #254 is where that is written.
 */
const spoken = computed(() => story ? remarks(story) : [])
</script>

<template>
  <details open class="found" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <!-- Marked as a Command, because reading what the bench found is an act of it
         like the fit and the Publish — see
         `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`. A
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
@import '~/assets/css/folds.css';

/* Drawn in the machine's own materials: this is the bench talking about the Story
   rather than any part of the Story. It flows in the region it stands in — it
   covers nothing, because there is nothing beside it to cover. */
.found {
  min-inline-size: 0;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
}

/* What the disclosure opens into, under its own line and in the same materials,
   so that it reads as the rest of that line rather than as something laid over
   the bench. */
.found > :not(summary) {
  padding-block-start: var(--s2);
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
  /* As wide as the region it stands in, and never taller than a screenful of it:
     a Story of forty Remarks scrolls inside its own disclosure rather than making
     the region as tall as the Story. */
  max-inline-size: 52ch;
  max-block-size: 16rem;
  overflow-y: auto;
  /* An outline is drawn outside the control and takes no part in a scroller's
     overflow, so a Remark flush with the edge of this box would be focused behind
     a clipped ring. Four pixels is what `:focus-visible` asks for — two of line
     and two of offset. */
  padding: var(--s1);
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
  max-inline-size: 46ch;
  color: var(--muted);
  font-size: 0.875rem;
}

/* At the fold the Remarks stand at the head of the document rather than beside
   it, and the document is what the window is for: the list is held to a couple of
   sentences there and goes on scrolling inside itself. It is still open and still
   says what it found — what folds is the width the Remarks are said in and never
   their voice. See `docs/adr/0043-a-story-is-written-as-one-document.md`. */
@media (--two-columns) {
  ul {
    max-block-size: 12rem;
  }
}
</style>
