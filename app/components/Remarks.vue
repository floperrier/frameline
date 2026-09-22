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
 * Open where there is room for it, which is new. The list used to be laid over the
 * head of the bench, so leaving it open would have covered the table; it now flows
 * in the column it stands in, so the Remarks say what they found without being
 * asked. At the fold they go to the head of the document, where the document is
 * what the window is for, and there they are the line and its count until the
 * Author opens them. What folds is the width they are said in and never their
 * voice: the line is still on the screen, and the act that opens it is still named
 * in the bar.
 *
 * The list is still held to its own height and scrolls inside itself: a Story of
 * forty Remarks is forty sentences in one region rather than a region as tall as
 * the Story.
 */
const { story, sceneWritten, previewed } = defineProps<{
  /** The Story on the bench, which is the whole of what a Remark is read from. */
  story?: StoryInEditor
  /** The Scene on the writing surface, if one is — see `spoken`. */
  sceneWritten?: string
  /** Whether the Preview is the reading the middle of the bench is showing — see `spoken`. */
  previewed?: boolean
}>()

const { t } = useI18n()

/**
 * Which Scene the Author asked to be taken to, which is the rail's own press and
 * nothing else: the page owns which Scene the caret is in, and a list that routed
 * there itself would be a second navigation of the bench able to disagree with the
 * rail and with the bar's *Go to X* about where a Scene is.
 *
 * It leaves the middle of the bench on the reading it was showing, for the reason
 * the rail's press does: the Remarks stand beside every reading, so a Remark
 * pressed while the Story is being read is the Author reading on rather than
 * asking to write.
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
 * It starts where the element itself starts, which is closed: the two would
 * otherwise disagree until the first toggle, and the bar would offer *Read the
 * Remarks* over a list already open. Closed is what the server renders, because
 * the bench is drawn whole before anything has measured a window and a list that
 * arrives open below the fold is shut a frame later — measured at 0.15 of layout
 * shift at 390 and at 900, where the Remarks stand in the document's own column
 * and closing them pulls the writing up by some two hundred pixels. Opening them
 * above the fold costs nothing, because there they grow inside a column of their
 * own width that pushes nothing. `settle` decides which, once there is a window
 * to read it from.
 */
const open = ref(false)

/**
 * The fold, asked of the stylesheet rather than measured here. `--two-columns` is
 * a custom media query and script cannot read one, and the width it stands for is
 * not a number this component may hold a second copy of — `app/assets/css/folds.css`
 * is where a fold is named — so the stylesheet says which side of it the Remarks
 * are on in a value that can be read back off the element.
 *
 * The disclosure is opened and closed on the element rather than through a bound
 * attribute, because the element is where that state lives and a second copy of it
 * drifts: a `<details>` coalesces its `toggle` events, so a template that renders
 * `open` from a `ref` can be left holding the opposite of what the browser has, and
 * the next write of the same value patches nothing. Measured rather than reasoned
 * about — driven at 1280 and then at 390, the bound version left the list open one
 * run in four.
 *
 * The name the bar offers is written here as well as left to the `toggle` that
 * follows, for the same reason: an event that may be coalesced away is not
 * something a Command's name can be left waiting on.
 *
 * Only a crossing moves it. What the fold decides is where the Remarks stand and
 * whether they are said without being asked; what the Author decides after that is
 * theirs until the layout changes under them again.
 */
const region = useTemplateRef<HTMLDetailsElement>('region')
let folded: boolean | undefined

function settle() {
  if (!region.value) return

  const now = getComputedStyle(region.value).getPropertyValue('--folded').trim() === '1'
  if (now === folded) return

  folded = now
  region.value.open = !now
  open.value = !now
}

onMounted(() => {
  settle()
  window.addEventListener('resize', settle)
})

onUnmounted(() => window.removeEventListener('resize', settle))

/**
 * The Remarks the bench says out loud: every one it found, less whatever the
 * reading in the middle of the bench is already saying in the Scene's own words.
 * Two voices for one fact is the objection `0034` raised about an Exit's text, and
 * the answer is the same here: the nearer voice wins.
 *
 * The Preview says two of them — that the Story opens on nothing, and that nothing
 * leads to the Scene being written — so those two are dropped exactly while it is
 * the reading on screen, and said again the moment the Author turns back to the
 * writing, where nothing else is saying them. See
 * `docs/adr/0032-the-bench-reads-the-story-back.md`, which
 * `docs/adr/0043-a-story-is-written-as-one-document.md` generalises from one Scene
 * to every reading.
 *
 * It says only one of the two at a time, though, and that bounds what is dropped.
 * A Story with no opening Scene is the whole of what the Preview reports — there
 * is nowhere to read from, so it never gets as far as the Scene on the surface —
 * and a Remark dropped there would be a fact said by nobody. So the Scene's own
 * sentence is left to the Preview only where the Story opens somewhere.
 *
 * Dropped here rather than in the reading, which knows the Story and has no
 * business knowing the bench.
 */
const spoken = computed(() => {
  const found = story ? remarks(story, t) : []
  if (!previewed || !sceneWritten) return found

  return found.filter(remark => !(
    remark.name === 'noOpening'
    || (remark.name === 'sceneUnreached'
      && remark.sceneId === sceneWritten
      && story?.openingSceneId)
  ))
})
</script>

<template>
  <details
    ref="region"
    class="found"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
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
  /* Which side of the fold the Remarks are on, said where the fold is reached by
     name so that the script has no second copy of the width — see `settle`. */
  --folded: 0;
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
  /* The containing block of the `.visually-hidden` span in every Remark. That span
     is `position: absolute` and, with no positioned ancestor, was positioned
     against the viewport: a scroller clips nothing whose containing block is
     outside it, so forty Remarks laid forty one-pixel boxes down the page at the
     rows they would have stood at in the list — the last of them 3290 pixels down
     on a Story of forty Scenes at 900 tall — and the window scrolled by exactly
     that (#285). Positioned, the list is what they are laid out against, and what
     it scrolls is the whole of them. */
  position: relative;
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

/* At the fold the Remarks stand at the head of the document rather than beside it,
   and the document is what the window is for: they are the line and its count
   there, which opens them, and the list it opens into is held to a couple of
   sentences and goes on scrolling inside itself. What folds is the width the
   Remarks are said in and never their voice — the line is on the screen at the
   head of the document, and the bar still names the act that opens it. See
   `docs/adr/0043-a-story-is-written-as-one-document.md`. */
@media (--two-columns) {
  .found {
    --folded: 1;
  }

  ul {
    max-block-size: 12rem;
  }
}
</style>
