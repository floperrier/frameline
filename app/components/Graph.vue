<script setup lang="ts">
/**
 * The Graph, drawn small down the side of the document: the rail —
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md`,
 * `docs/adr/0032-the-bench-reads-the-story-back.md` and
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md` already call the folded
 * Graph that, and this is the word in that sense rather than a new one. The
 * columns run down the page and the Scenes of a column run across it, read off
 * `inColumns` in `shared/utils/scenes.ts` — the same walk the document's own order
 * is flattened out of, so the picture and the writing cannot disagree. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 *
 * It is a locator and not a workspace. It says where in the Story the caret is, it
 * takes a press to go somewhere, and it marks a Scene nothing arrives at. It never
 * grows: every layout before this one gave the drawing a share of the width that
 * the writing then had to win back, and one hundred and twenty pixels is the whole
 * of what this one takes at any width.
 *
 * Nothing is placed by hand and nothing is written here. There are no lines
 * either: an Exit is read in the document of the Scene it leaves, where it is
 * named by where it leads, and a line drawn across a rail this narrow would say
 * less than the column a Scene stands in already does.
 *
 * `aria-hidden` with `tabindex="-1"` is the point of the rail rather than an
 * oversight. Every fact the rail draws — where a Scene stands in the Story,
 * whether the Story opens on it, whether anything arrives at it — is said in words
 * in the document's own markup, so a rail in the accessibility tree would be the
 * whole Story announced twice and a tab order running through a drawing. What
 * still reaches it is the bar of Commands: `app/components/Commands.vue` reads
 * `[data-command]` and filters by `checkVisibility()`, which does not consult
 * `aria-hidden`, so *Go to* every Scene is offered there exactly as before — and
 * that bar is the keyboard's way to a Scene. See
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
 */
const { story, sceneWritten } = defineProps<{
  /** The Story on the bench, or nothing where the read was refused. */
  story?: StoryInEditor
  /** The Scene the caret is in, which the rail marks. */
  sceneWritten?: string
}>()

const emit = defineEmits<{ writeScene: [string] }>()

/** The Story's columns, which is the whole of what the rail draws. */
const columns = computed(() => inColumns(
  story?.scenes ?? [], story?.exits ?? [], story?.openingSceneId ?? null))

/**
 * Every Scene an Exit arrives at. A Scene that is neither this nor the Opening
 * Scene is one no Reader ever gets to, and the rail marks it as the loose end it
 * is — the document says the same in words under its name, and a Remark says it
 * in a sentence.
 */
const arrivedAt = computed(() => new Set((story?.exits ?? []).map(exit => exit.toSceneId)))

/**
 * The mark the caret is on, brought into the rail. The rail scrolls inside itself,
 * and a Story long enough puts the Scene being written past its foot: a locator
 * that cannot show where the Author is standing has stopped being one, which is
 * the condition `0043` says to reopen the whole layout on.
 *
 * `nearest` is what keeps it quiet — a mark already in the rail is not moved, so
 * the rail does not lurch every time the caret moves a Scene — and the document
 * beside it is scrolled by the page rather than by this, so the two cannot argue.
 * The mount is instant for the reason the document's own wind is: the first sight
 * of the bench is a reload coming back to an address, and a rail winding past the
 * Author before they can read it says nothing.
 */
const rail = useTemplateRef<HTMLElement>('rail')

function windOn(behavior: ScrollBehavior) {
  rail.value?.querySelector('.mark.here')
    ?.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' })
}

onMounted(() => windOn('instant'))
watch(() => sceneWritten, async () => {
  await nextTick()
  windOn('smooth')
})
</script>

<template>
  <!-- One element per column, the Scenes of a column running across it. Nothing
       inside is announced and nothing inside is tabbed to: the document is where
       all of this is said in words. -->
  <div v-if="story?.scenes.length" ref="rail" class="rail" aria-hidden="true">
    <div v-for="(column, depth) in columns" :key="depth" class="column">
      <!-- Named for what pressing it does, so the bar of Commands offers every
           Scene under the same words the mark answers to. The name is also the
           mark's `title`, because a rail this narrow carries no words of its own
           and a locator nobody can read is not one. -->
      <button
        v-for="scene in column"
        :key="scene.id"
        type="button"
        class="mark"
        tabindex="-1"
        :data-scene="scene.id"
        :data-command="$t('editor.goToScene', { name: scene.name })"
        :title="$t('editor.goToScene', { name: scene.name })"
        :class="{
          opens: story.openingSceneId === scene.id,
          here: scene.id === sceneWritten,
          unreached: scene.id !== story.openingSceneId && !arrivedAt.has(scene.id),
        }"
        @click="emit('writeScene', scene.id)"
      />
    </div>
  </div>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The rail: exactly its own width at every window, on the bench's deepest ground
   so that the document beside it reads as the lit surface. It scrolls inside
   itself, because a Story of forty Scenes is a tall rail and the document is what
   the window is for. */
.rail {
  /* Twenty-four pixels, which is the smallest a target may be for a finger, at
     both of the widths below: what narrows at the fold is the rail and never what
     can be pressed. Four to a row at this width, and one to a row at the strip's. */
  --mark: 24px;
  flex: none;
  display: grid;
  align-content: start;
  gap: var(--s3);
  inline-size: 120px;
  min-block-size: 0;
  overflow-y: auto;
  padding: var(--s2) var(--s1);
  border-inline-end: 1px solid var(--edge);
  background: color-mix(in oklab, var(--bench) 70%, black);
  /* The mark the caret is on is wound into the rail rather than jumped to, and
     the answer to `prefers-reduced-motion` is given once here rather than at each
     call — the same arrangement the document beside it is scrolled under. */
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  .rail {
    scroll-behavior: auto;
  }
}

/* A column of the Graph, read across the rail rather than down it: the page runs
   the columns down, so what an eye follows downwards is the Story's own depth in
   Exits taken. */
.column {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
}

/* A Scene, at the size a rail can carry one: a mark and no words. Square rather
   than shrunk to a dot at this width, so the two things it says — where the Story
   opens, and what nothing arrives at — have an edge to say them on. */
.rail .mark {
  min-inline-size: 0;
  inline-size: var(--mark);
  block-size: var(--mark);
  padding: 0;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
}

.rail .mark:hover {
  border-color: color-mix(in oklab, var(--light) 55%, var(--edge));
  background: var(--steel-lit);
}

/* Where the Story opens, in the grease pencil the Author's own marks are written
   in — the strip the node wore down its leading edge, at the size a rail leaves
   for one. */
.rail .mark.opens {
  border-color: var(--grease);
  background: color-mix(in oklab, var(--grease) 22%, var(--steel));
}

/* Where the caret is, in the machine's own light: this is the interface saying
   where in the Story the Author is standing, not anything the Author wrote. */
.rail .mark.here {
  border-color: var(--light);
  background: var(--light);
}

/* Both at once — the Story opens on the Scene being written — keeps the grease
   pencil on the edge and the light inside, so neither fact is lost to the other. */
.rail .mark.opens.here {
  border-color: var(--grease);
}

/* A Scene nothing leads to, read as the loose end it is. The document says the
   same under its name and a Remark says it in a sentence; this is for whoever is
   looking rather than reading. */
.rail .mark.unreached {
  border-style: dashed;
}

/* On a phone the rail is a strip of dots and the document keeps the window —
   the fold that hides nothing, which is the whole of what
   `docs/adr/0043-a-story-is-written-as-one-document.md` asks of the layout. The
   dots are smaller and still a finger's target: one per row, at the full width of
   the strip, so what narrows is the rail and never what can be pressed. */
@media (--phone) {
  .rail {
    gap: var(--s2);
    inline-size: 32px;
    padding: var(--s1);
  }

  .rail .mark {
    border-radius: 50%;
  }
}
</style>
