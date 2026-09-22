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
 * A Scene is a point and an Exit is the line between two points, drawn with the
 * way it runs on it: the shape of the Story is what the rail is for, and a shape
 * is where the ways on go and not only where the Scenes land. Where every point
 * stands and where every line bends is arithmetic on the Story — `app/utils/graph.ts`
 * is the whole of it, nothing is measured after render, nothing is placed by hand
 * and nothing is written back. See `docs/adr/0045-the-rail-draws-the-ways-on.md`.
 *
 * It is a locator and not a workspace. It says where in the Story the caret is, it
 * takes a press to go somewhere, it lights the ways on and off the Scene being
 * written, and it marks a Scene nothing arrives at. It grew once, from one hundred
 * and twenty pixels to two hundred and twenty, and that is the whole of what it
 * takes at the wider width; at the narrower one it is a strip the drawing scrolls
 * sideways through, so what the fold narrows is the window on the rail and never
 * the point that can be pressed.
 *
 * `aria-hidden` with `tabindex="-1"` is the point of the rail rather than an
 * oversight. Every fact the rail draws — where a Scene stands in the Story,
 * whether the Story opens on it, whether anything arrives at it, which Scenes its
 * ways on reach — is said in words in the document's own markup, so a rail in the
 * accessibility tree would be the whole Story announced twice and a tab order
 * running through a drawing. What still reaches it is the bar of Commands:
 * `app/components/Commands.vue` reads `[data-command]` and filters by
 * `checkVisibility()`, which does not consult `aria-hidden`, so *Go to* every Scene
 * is offered there exactly as before — and that bar is the keyboard's way to a
 * Scene. See
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
 *
 * Neither of the two keeps a pointer out, and that is what #265 cost: a `<button>`
 * at `tabindex="-1"` still takes the focus on a mouse press in Chrome and in
 * Firefox, so a point pressed left the caret inside the very subtree `aria-hidden`
 * takes out of the accessibility tree and the next `Tab` resumed from a place
 * nothing had announced. So the press is refused its own focus — `preventDefault`
 * on `mousedown` is what a browser reads as *do not put the caret here*, and the
 * click it precedes is untouched. Where the caret goes instead belongs to the page
 * rather than to the drawing: it is settled once in the handler this emits to, so
 * that the bar of Commands, which reaches the same act by pressing the same point,
 * lands it in the same place.
 */
const { story, sceneWritten } = defineProps<{
  /** The Story on the bench, or nothing where the read was refused. */
  story?: StoryInEditor
  /** The Scene the caret is in, which the rail marks. */
  sceneWritten?: string
}>()

const emit = defineEmits<{ writeScene: [string] }>()

const { t } = useI18n()

/**
 * What the bench calls each Scene, which is what a point is named by and so what
 * the bar of Commands offers *Go to* under. Read from `namesOnTheBench` rather
 * than off the Scene, because two Scenes an Author called the same would
 * otherwise put the same act in the bar twice with nothing to choose between
 * them — see `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
 */
const names = computed(() => (story ? namesOnTheBench(story, t) : new Map<string, string>()))

/**
 * The Story's columns, as the ids in each: the whole of the shape, and all the
 * drawing asks of a Scene. What is drawn inside a point — the Story's opening, the
 * caret, a loose end — is read off the ids too.
 */
const columns = computed(() => inColumns(
  story?.scenes ?? [], story?.exits ?? [], story?.openingSceneId ?? null)
  .map(column => column.map(scene => scene.id)))

/**
 * Every Scene an Exit arrives at. A Scene that is neither this nor the Opening
 * Scene is one no Reader ever gets to, and the rail marks it as the loose end it
 * is — the document says the same in words under its name, and a Remark says it
 * in a sentence.
 */
const arrivedAt = computed(() => new Set((story?.exits ?? []).map(exit => exit.toSceneId)))

/**
 * Every Scene that flows into the next without asking, which the rail marks the
 * way it marks a Scene nothing arrives at: both are the shape of the Story read
 * off the drawing rather than assembled out of the panels. See
 * `docs/adr/0045-the-rail-draws-the-ways-on.md`.
 */
const flowsOn = computed(() =>
  new Set((story?.scenes ?? []).filter(scene => scene.exitsAfter === 0).map(scene => scene.id)))

/** Where every point stands, and how tall the drawing comes out. */
const drawing = computed(() => drawn(columns.value))

/**
 * The plate the drawing is laid on, at the size the arithmetic gives it, and the
 * box the lines are drawn in, which is the same size. `--mark` travels with it so
 * that the point a line stops at the rim of and the point a finger presses are one
 * number rather than two.
 */
const plate = computed(() => ({
  inlineSize: `${DRAWING_WIDTH}px`,
  blockSize: `${drawing.value.height}px`,
  '--mark': `${MARK}px`,
}))

const box = computed(() => ({
  width: DRAWING_WIDTH,
  height: drawing.value.height,
  viewBox: `0 0 ${DRAWING_WIDTH} ${drawing.value.height}`,
}))

/**
 * The points, in the order the Story is written in, which is the order they read,
 * each carrying where it stands: a point is placed by its own centre, and the box
 * drawn around it is the target that centre is the middle of.
 */
const points = computed(() => [...drawing.value.at].map(([id, { x, y }]) => ({
  id,
  at: {
    insetInlineStart: `${x - MARK / 2}px`,
    insetBlockStart: `${y - MARK / 2}px`,
  },
})))

/**
 * The lines: one per pair of Scenes an Exit joins, not one per Exit. Two ways on
 * from one Scene to another — the same landing under opposite Conditions, which is
 * what Conditions on an Exit are for — are one line on the shape of the Story, and
 * drawing it twice would put a heavier stroke on the pair that says nothing about
 * it. How many there are, and what each carries, is the document's to say.
 *
 * An Exit whose far side the Story no longer holds is left undrawn rather than
 * drawn to nowhere: the Scene it names is gone, and the document says so where the
 * Exit is written.
 */
const links = computed(() => {
  const at = drawing.value.at
  const joined = new Set<string>()

  return (story?.exits ?? []).flatMap((exit) => {
    const pair = `${exit.fromSceneId}>${exit.toSceneId}`
    const from = at.get(exit.fromSceneId)
    const to = at.get(exit.toSceneId)
    if (!from || !to || joined.has(pair)) return []

    joined.add(pair)

    return [{ pair, d: linkPath(from, to), from: exit.fromSceneId, to: exit.toSceneId }]
  })
})

/**
 * The point the caret is on, brought into the rail. The rail scrolls inside itself,
 * and a Story long enough puts the Scene being written past its foot — and at the
 * narrower width past its side as well: a locator that cannot show where the Author
 * is standing has stopped being one, which is the condition `0043` says to reopen
 * the whole layout on.
 *
 * `nearest` is what keeps it quiet — a point already in the rail is not moved, so
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
  windOn('auto')
})
</script>

<template>
  <!-- The drawing is one plate exactly as wide as the arithmetic makes it, with the
       lines under the points and the points over them. Nothing inside is announced
       and nothing inside is tabbed to: the document is where all of this is said in
       words. -->
  <div v-if="story?.scenes.length" ref="rail" class="rail" aria-hidden="true">
    <div class="drawing" :style="plate">
      <svg class="ways" v-bind="box">
        <defs>
          <!-- Which way the Exit runs, drawn at the end it arrives at. `context-stroke`
               is what gives the head the colour of its own line, so a way on lit
               because the caret is on one of its Scenes is lit whole. -->
          <marker
            id="arrives"
            markerWidth="7"
            markerHeight="6"
            refX="6.5"
            refY="3"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 7 3 L 0 6 Z" fill="context-stroke" />
          </marker>
        </defs>

        <path
          v-for="link in links"
          :key="link.pair"
          :d="link.d"
          marker-end="url(#arrives)"
          :class="{ lit: link.from === sceneWritten || link.to === sceneWritten }"
        />
      </svg>

      <!-- Named for what pressing it does, so the bar of Commands offers every
           Scene under the same words the point answers to — and by the name the
           bench calls the Scene, so two Scenes of one name are two acts there and
           not one act offered twice. The name is also the point's `title`, because
           a rail this narrow carries no words of its own and a locator nobody can
           read is not one. -->
      <button
        v-for="point in points"
        :key="point.id"
        type="button"
        class="mark"
        tabindex="-1"
        :data-scene="point.id"
        :data-command="$t('editor.goToScene', { name: names.get(point.id) })"
        :title="$t('editor.goToScene', { name: names.get(point.id) })"
        :style="point.at"
        :class="{
          opens: story.openingSceneId === point.id,
          here: point.id === sceneWritten,
          unreached: point.id !== story.openingSceneId && !arrivedAt.has(point.id),
          flows: flowsOn.has(point.id),
        }"
        @mousedown.prevent
        @click="emit('writeScene', point.id)"
      />
    </div>
  </div>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The rail: exactly its own width at every window, a machined plate beside the
   document rather than a hole cut through the bench — the same material every
   control on the bench is drawn in, so the document beside it reads as the lit
   surface. It scrolls inside itself, because a Story of forty Scenes is a tall
   rail and the document is what the window is for. */
.rail {
  flex: none;
  /* The drawing is two hundred and six, and the rest is the gutter the scrollbar
     stands in, kept whether or not there is one so the points do not step sideways
     the moment a Story grows past the window. */
  inline-size: 220px;
  min-block-size: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  border-inline-end: 1px solid var(--edge);
  background: var(--steel);
  /* The point the caret is on is wound into the rail rather than jumped to, and
     the answer to `prefers-reduced-motion` is given once here rather than at each
     call — the same arrangement the document beside it is scrolled under. */
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  .rail {
    scroll-behavior: auto;
  }
}

/* The plate the Story is drawn on, at the size the arithmetic gives it: the lines
   are laid out in its own coordinates and the points are laid over them at the
   same ones, so the two cannot drift apart. */
.drawing {
  position: relative;
}

.ways {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  /* The lines are the drawing and never the target: a press belongs to a point. */
  pointer-events: none;
}

/* A way on. Quiet enough that the points stay the thing being read and loud enough
   to be followed across a column — `--muted` is the palette's quietest readable
   value, and a line is read along its length rather than at a glance, so it is
   drawn at a little under it. */
.ways path {
  fill: none;
  stroke: color-mix(in oklab, var(--muted) 70%, transparent);
  stroke-width: 1.25;
  stroke-linecap: round;
}

/* The ways on and off the Scene being written, in the machine's own light: the one
   question a shape is asked while a Scene is open is what reaches it and where it
   goes, and the rail answers it without being pressed. */
.ways path.lit {
  stroke: var(--light);
  stroke-width: 1.75;
}

/* A Scene, at the size a rail can carry one: a point and no words, machined into
   the plate the way a field is machined into the bench. Round, because it is what
   a line arrives at rather than a box the Scene is kept in — the two shapes
   `frameline.css` allows are the shapes of the bench's own controls, and a node in
   a drawing is not one of them. Its edge is the whole of what it says — where the
   Story opens, and what nothing arrives at — so the edge has to be legible on its
   own: `--edge` is a hairline meant to be read beside the box it bounds, and at
   this size, with nothing inside it, it reaches 1.95:1 and says nothing. `--muted`
   is the palette's quietest readable value and it clears three to one, which is
   what a control's own boundary is held to. */
.rail .mark {
  position: absolute;
  min-inline-size: 0;
  /* The one size in the drawing that is also a rule: `--mark` is set on the plate
     from the arithmetic itself, so the point a line is drawn to the rim of and the
     point a finger presses are one number. */
  inline-size: var(--mark);
  block-size: var(--mark);
  padding: 0;
  border: 1px solid var(--muted);
  border-radius: 50%;
  background: var(--bench);
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
  background: color-mix(in oklab, var(--grease) 30%, var(--bench));
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

/* A Scene that flows into the next without asking, read on the edge the way the
   loose end above it is rather than in a colour of its own: a line already
   carries weight as a second channel next to colour — `.ways path.lit` is
   heavier than a quiet one — and the edge here doubles for the same reason,
   legible under `forced-colors` and needing no motion to say it. The document
   says the same under the Scene's name and a Remark says it in a sentence; this
   is for whoever is looking rather than reading. */
.rail .mark.flows {
  border-width: 2px;
}

/* On a phone the rail is a strip the drawing scrolls sideways through, and the
   document keeps the window — the fold that hides nothing, which is the whole of
   what `docs/adr/0043-a-story-is-written-as-one-document.md` asks of the layout.
   Nothing about the drawing changes at the fold: the points keep the size a finger
   needs and the lines keep the lengths they are read at, and the point the caret is
   on is wound into the strip across as well as down. */
@media (--phone) {
  .rail {
    inline-size: 88px;
    /* A classic scrollbar on either axis is a bar nobody here needs: the rail is
       `aria-hidden`, out of the tab order, and wound to the caret by the component
       itself. */
    scrollbar-gutter: auto;
    scrollbar-width: none;
  }
}
</style>
