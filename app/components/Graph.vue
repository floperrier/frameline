<script setup lang="ts">
/**
 * The Graph: the whole Story seen at once, as its Scenes and the Exits between
 * them, drawn from the Story and nothing else. Every Scene is a node laid out by
 * how far it stands from the Opening Scene and in what order it is offered —
 * `laidOut` in `shared/utils/scenes.ts` — so nothing here is placed by hand,
 * nothing is dragged, and nothing is written back: the Graph is a reading of the
 * Story, and it moves when the Story does. See
 * `docs/adr/0041-the-graph-is-drawn-from-the-story.md`.
 *
 * It is the whole surface of the bench rather than a band across the top of it,
 * and the Scene being written stands on it: the gate takes the place of that
 * Scene's node, at the size a frame and the words under it are looked at, and the
 * Graph opens up around it — the column widens, the Scenes under it are pushed
 * down — then closes again when the gate is lifted off. Which Scene the gate
 * holds is not decided here: a node says which Scene the bench should be writing
 * and asks the page to change it, so one surface answers to one page. See
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md`.
 *
 * The Scene being written has no node while the gate stands on it. There is
 * nothing a press on it could do — it is already the Scene on the bench — and an
 * act with nothing left to do is not one the bar of Commands offers either:
 * `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.
 */
const { story, sceneWritten, imageOf, lifted } = defineProps<{
  /** The Story on the bench, or nothing where the read was refused. */
  story?: StoryInEditor
  /** The Scene the gate is standing on, which the Graph opens up around. */
  sceneWritten?: string
  /** Where a Shot's image is asked for, under the time it was last attached. */
  imageOf: (shot: Shot) => string
  /**
   * Whether the gate has been lifted off, leaving the whole Story on the table
   * with nothing standing on it. The Scene being written is still the one it was:
   * lifting the gate is looking at the Story, not leaving the Scene.
   */
  lifted?: boolean
}>()

const emit = defineEmits<{ writeScene: [string] }>()

const { t } = useI18n()

/** The Scene the gate is drawn on, if it is drawn at all. */
const standing = computed(() => lifted ? undefined : sceneWritten)

/** Where every box stands, and how much room the whole drawing takes. */
const laid = computed(() => laidOut(
  story?.scenes ?? [], story?.exits ?? [], story?.openingSceneId ?? null, standing.value))

/**
 * How much room the whole drawing takes, as custom properties rather than as a
 * width and a height of its own: the fold below gives the surface back to the
 * gate on a phone, and a rule cannot argue with an inline style.
 */
const surfaceSize = computed(() => ({
  '--surface-width': `${laid.value.width}px`,
  '--surface-height': `${laid.value.height}px`,
}))

/**
 * A Scene's box. Every Scene of the Story is placed, so a Scene nothing finds
 * here is one the Graph was asked about before the Story it belongs to was read
 * back — drawn from the corner rather than from nowhere.
 */
function boxOf(sceneId: string): Box {
  return laid.value.placed.get(sceneId)
    ?? { x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT }
}

/** Every Scene with a node: all of them, bar the one the gate is standing on. */
const nodes = computed(() =>
  (story?.scenes ?? []).filter(scene => scene.id !== standing.value))

/** Where the gate can go from here, which is what the Graph keeps lit. */
const reached = computed(() => new Set(
  exitsFrom(story?.exits ?? [], sceneWritten ?? '').map(exit => exit.toSceneId)))

/**
 * Every Exit, as the line that draws it. Every box is known from the Story
 * alone — a node's size, or the gate's on the one Scene being written — so the
 * lines are right in the very first frame, on the server as in the browser, with
 * nothing measured after render.
 *
 * A line that touches the Scene being written is drawn at full strength and the
 * rest of the Story a little back: with the gate down, the Graph says where the
 * gate can travel without saying anything less true about the Story. An Exit from
 * a Scene to itself is not drawn — a line of no length says nothing, and a Scene
 * that re-enters itself is read in its own document, where the way on names the
 * Scene it leaves.
 */
const exitLines = computed(() => (story?.exits ?? [])
  .filter(exit => exit.fromSceneId !== exit.toSceneId)
  .map((exit) => {
    // The Place, counted from one the way the document numbers it, and how many
    // ways on the Scene offers, which the departures are spread over.
    const waysOn = exitsFrom(story?.exits ?? [], exit.fromSceneId)
    const place = waysOn.indexOf(exit) + 1

    return {
      id: exit.id,
      near: Boolean(standing.value)
        && (exit.fromSceneId === sceneWritten || exit.toSceneId === sceneWritten),
      ...exitLine(boxOf(exit.fromSceneId), boxOf(exit.toSceneId), place, waysOn.length),
    }
  }))

/**
 * What a node says under the Scene's name: how many Shots are in it, and how
 * many ways on it offers. Where they land is what the lines are for.
 */
function atAGlance(scene: Scene) {
  const ways = exitsFrom(story?.exits ?? [], scene.id).length

  return {
    shots: countedShots(scene.shots.length, t),
    ways: countedExits(ways, t),
  }
}

function press(scene: Scene) {
  emit('writeScene', scene.id)
}

/**
 * The gate brought onto the screen. The table is wider than a window as soon as
 * a Story has a few columns, and nothing until now scrolled it: measured on a
 * chain of eleven Scenes, the gate stood entirely off the edge for six of them
 * at 1440 and for more at every narrower width, with the table's own
 * `scrollLeft` at zero in every case. `docs/adr/0042-the-scene-is-written-where-it-stands.md`
 * says the gate is scrolled to whenever it moves, and this is what says it.
 *
 * `scrollIntoView` rather than arithmetic on the box. The room to leave around
 * the gate is the table's own padding, and reading that back into script would
 * be the same number written twice; `scroll-margin` says it once, in the units
 * the padding is already written in. `nearest` is what keeps it quiet: a gate
 * already on screen is not moved, so the table does not lurch when an Author
 * presses a node they can already see. Smoothness is the stylesheet's, where
 * the reduced-motion question is answered once.
 */
const gate = useTemplateRef('gate')

function windOn(behavior: ScrollBehavior) {
  gate.value?.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' })
}

// Two callers rather than one immediate watch: an immediate watch runs at setup,
// where the ref is still empty and, on the server, where there is nothing to
// scroll at all. The first sight of the bench is the case that matters — a
// reload comes back to an address — so it is the mount that owns it.
//
// And the two arrive differently. A bench opened on a Scene is already there:
// winding the whole table past the Author before they can read anything says
// nothing and takes half a second. A gate that moves because they pressed a
// node is a move they made, and the table follows it. `instant` beats the
// stylesheet's `smooth`; the empty argument leaves it in charge.
onMounted(() => windOn('instant'))
watch(() => standing.value, async () => {
  await nextTick()
  windOn('smooth')
})
</script>

<template>
  <!-- The Graph, the whole surface of the bench. It scrolls both ways inside
       itself and is never scaled: a node is read at one size wherever it stands,
       and a Story wider than the window is scrolled to, the way a reel is wound
       on. -->
  <div v-if="story?.scenes.length" class="graph">
    <div class="surface" :style="surfaceSize">
      <!-- The drawing is the landmark, and the gate is not part of it: what is on
           the table to be navigated is the Story's own shape, and the Scene being
           written is a document standing on it. The lines are the pointer's way
           to nothing, because nothing about an Exit is written here — what is
           read out of a line is read off a Scene's own document instead. -->
      <nav class="drawing" :aria-label="$t('editor.graph')">
      <svg aria-hidden="true">
        <defs>
          <marker
            id="exit-head" viewBox="0 0 8 8" refX="7" refY="4"
            markerWidth="8" markerHeight="8" orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
        </defs>
        <line
          v-for="line in exitLines"
          :key="line.id"
          :data-exit="line.id"
          :class="{ near: line.near }"
          :x1="line.from.x"
          :y1="line.from.y"
          :x2="line.to.x"
          :y2="line.to.y"
          marker-end="url(#exit-head)"
        />
      </svg>

      <!-- A Scene's node: what an Author needs to recognise the Scene at a
           glance, and nothing to type into. One button, named for what pressing
           it does, so the bar of Commands offers every Scene under the same
           words the node answers to. -->
      <button
        v-for="scene in nodes"
        :key="scene.id"
        type="button"
        class="node"
        :data-scene="scene.id"
        :data-command="$t('editor.goToScene', { name: scene.name })"
        :aria-label="$t('editor.goToScene', { name: scene.name })"
        :class="{
          opens: story.openingSceneId === scene.id,
          next: !lifted && reached.has(scene.id),
          back: !lifted && !reached.has(scene.id),
          unreached: scene.id !== story.openingSceneId
            && !story.exits.some(exit => exit.toSceneId === scene.id),
        }"
        :style="{
          translate: `${boxOf(scene.id).x}px ${boxOf(scene.id).y}px`,
          inlineSize: `${NODE_WIDTH}px`,
          blockSize: `${NODE_HEIGHT}px`,
        }"
        @click="press(scene)"
      >
        <!-- The image of the first Shot, at the size a node can carry it: what
             the Author recognises a Scene by before they read a word of it. A
             Scene whose first Shot has none shows the outline of the frame it
             would be. -->
        <span class="frame" aria-hidden="true">
          <img
            v-if="scene.shots[0]?.image"
            :src="imageOf(scene.shots[0])"
            alt=""
            draggable="false"
          >
        </span>
        <span class="slate" aria-hidden="true">
          <span class="name">{{ scene.name }}</span>
          <span class="glance">
            <span>{{ atAGlance(scene).shots }}</span>
            <span class="out">{{ atAGlance(scene).ways }}</span>
          </span>
        </span>
      </button>
      </nav>

      <!-- The gate, standing in the place of the node of the Scene it holds. The
           page puts the writing surface in it, or the reading of the Story: one
           box on the table with two faces — see
           `docs/adr/0042-the-scene-is-written-where-it-stands.md`. -->
      <div
        v-if="standing"
        ref="gate"
        class="gate"
        :style="{
          '--at-x': `${boxOf(standing).x}px`,
          '--at-y': `${boxOf(standing).y}px`,
          '--gate-width': `${GATE_WIDTH}px`,
          '--gate-height': `${GATE_HEIGHT}px`,
        }"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The table the Story is laid out on: the whole of the bench under its own
   header, on the bench's deepest ground, scrolling both ways and centring what
   is on it while that fits. */
.graph {
  flex: 1;
  /* The containing block the gate covers on a phone. */
  position: relative;
  display: grid;
  /* Centred while the drawing fits, and hung from the corner the moment it does
     not: content centred in a scroller that overflows both ways puts what spills
     past the start edge somewhere nothing can scroll to, which on a short window
     is the head of the gate. `safe` is the one-word answer, and the line before
     it is what a browser without it does. */
  place-content: center;
  place-content: safe center;
  min-block-size: 0;
  overflow: auto;
  padding: var(--s5) var(--s4);
  /* The gate is wound onto the screen rather than jumped to, because the nodes
     glide to their new columns at the same moment and a table that arrived
     before them would have moved for no reason an eye can follow. Asked of the
     scroller in CSS rather than of `scrollIntoView` at each call, so the answer
     to `prefers-reduced-motion` is given once. */
  scroll-behavior: smooth;
  background: color-mix(in oklab, var(--bench) 70%, black);
}

@media (prefers-reduced-motion: reduce) {
  .graph {
    scroll-behavior: auto;
  }
}

/* The surface the nodes are laid out on, exactly as large as the drawing: the
   table scrolls to its edges and no further. */
.surface {
  position: relative;
  inline-size: var(--surface-width);
  block-size: var(--surface-height);
}

/* The drawing fills the surface, and the gate stands on it as a sibling: what is
   navigated is the Story's shape, and the document is not part of it. */
.drawing {
  position: absolute;
  inset: 0;
}

/* The drawing fills the surface. An SVG is a replaced element, so `inset` alone
   leaves it at the three hundred by a hundred and fifty a browser gives one with
   no size of its own: the size is asked for, and the lines inside it are in the
   surface's own pixels. */
svg {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  /* The drawing takes no presses: a node is pressed, a line is read. */
  pointer-events: none;
}

/* An Exit is a mark the Author made, drawn in the grease pencil rather than in
   the interface's own colour. The whole Story is drawn; the lines the gate could
   travel are the ones drawn at full strength. */
svg line {
  stroke: color-mix(in oklab, var(--grease) 70%, transparent);
  stroke-width: 1.5;
}

svg path {
  fill: var(--grease);
}

.surface:has(.gate) svg line {
  stroke: color-mix(in oklab, var(--grease) 22%, transparent);
}

.surface:has(.gate) svg line.near {
  stroke: color-mix(in oklab, var(--grease) 85%, transparent);
}

/* A node: a frame and a slate side by side in a box every Scene shares, so the
   line that draws an Exit can be drawn against geometry nobody has to measure.
   Positioned by translate rather than by inset, because the Graph is read left to
   right whatever direction the interface's text runs in. */
.node {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0;
  padding: 0;
  overflow: hidden;
  /* The strip down the leading edge, which the Opening Scene wears in grease
     pencil: where the Story opens is read without reading a word. */
  border-inline-start: 3px solid var(--edge);
  text-align: start;
  box-shadow: var(--lifted);
  transition: translate 240ms ease-out, opacity 160ms ease-out;
}

.node.opens {
  border-inline-start-color: var(--grease);
}

/* With the gate down, the Scenes its ways on lead to are where it can travel and
   stay lit; the rest of the Story goes back — still drawn, still true, not being
   worked on. */
.node.back {
  opacity: 0.4;
}

.node.next {
  border-color: color-mix(in oklab, var(--light) 35%, var(--edge));
}

.node.next.opens {
  border-inline-start-color: var(--grease);
}

/* A Scene nothing leads to is on the Graph like every other, and read as the loose
   end it is: a Remark says the same in words, for whoever is not reading the
   dashes. */
.node.unreached {
  border-style: dashed;
  border-inline-start-style: solid;
}

/* The image of the first Shot, drawn whether or not there is one to put in it:
   an empty one is the outline of the image nobody attached, which is how an
   unfinished Scene reads as unfinished. */
.frame {
  display: block;
  aspect-ratio: 16 / 9;
  border-block-end: 1px solid var(--edge);
  background: var(--bench);
}

.frame img {
  display: block;
  -webkit-user-drag: none;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

/* The slate: the Scene's name on one line, and how much is in it under. A long
   name is cut off rather than making the node taller than every other. */
.slate {
  display: grid;
  align-content: center;
  gap: 1px;
  min-inline-size: 0;
  padding: var(--s1) var(--s2);
}

.name {
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.glance {
  display: flex;
  gap: var(--s2);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.04em;
}

.glance .out {
  margin-inline-start: auto;
  color: var(--grease);
}

/* The gate: the box the Scene being written is drawn in, exactly the room the
   layout reserved for it. The two numbers arrive as custom properties rather
   than as a width and a translate of their own, so the fold below can put the
   gate over the whole window without an inline style to beat. */
.gate {
  position: absolute;
  z-index: 1;
  inset-block-start: 0;
  inset-inline-start: 0;
  /* What the table leaves around the gate when it winds it onto the screen: its
     own padding, so the gate arrives sitting where a gate sits rather than
     wedged against the edge. */
  scroll-margin: var(--s5) var(--s4);
  display: flex;
  inline-size: var(--gate-width);
  block-size: var(--gate-height);
  translate: var(--at-x) var(--at-y);
}

/* On a phone the bench holds one Scene. There is no width at which a table and
   a gate stand side by side — the gate is a frame and the words under it — so
   below the width the gate itself needs, the gate takes the whole table and
   lifting it off is what shows the Story. It stays under the Story's own edge:
   the acts that lift it, name it and publish it are read there, and a surface
   that covered them would be a surface with no way out. See
   `docs/adr/0042-the-scene-is-written-where-it-stands.md`. */
@media (--phone) {
  .graph {
    padding: var(--s3);
  }

  /* The gate covers the drawing rather than replacing it. Every node is still
     drawn, so every Scene is still an act the bar of Commands offers — the bar
     offers what the bench draws, and a bench that drew nothing under the gate
     would put the Story out of reach of the one surface that reaches everything.
     See `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`. */
  .graph:has(.gate) {
    place-content: stretch;
    overflow: hidden;
  }

  .surface:has(.gate) {
    position: static;
  }

  .surface:has(.gate) > .drawing {
    position: static;
  }

  .gate {
    position: absolute;
    inset: 0;
    inline-size: auto;
    block-size: auto;
    translate: none;
  }
}
</style>
