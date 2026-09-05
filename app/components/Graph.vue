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
 * A node is pressed and nothing else: pressing it puts that Scene on the writing
 * surface under the Graph. Everything an Exit is — where it leads, what the Reader
 * presses, what it is offered under — is written in the document of the Scene it
 * leaves, and the drawing keeps what a drawing is for: the line, the arrowhead,
 * and which Scene stands where. See
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md`.
 *
 * Which Scene is being written is not decided here. A node says which Scene the
 * writing surface should hold and asks the page to change it, so one surface
 * answers to one page.
 */
const { story, sceneWritten, imageOf } = defineProps<{
  /** The Story on the bench, or nothing where the read was refused. */
  story?: StoryInEditor
  /** The Scene the writing surface is on, which its node is lit for. */
  sceneWritten?: string
  /** Where a Shot's image is asked for, under the time it was last attached. */
  imageOf: (shot: Shot) => string
}>()

const emit = defineEmits<{ writeScene: [string] }>()

const { t } = useI18n()

/** Where every node stands, and how much room the whole drawing takes. */
const laid = computed(() =>
  laidOut(story?.scenes ?? [], story?.exits ?? [], story?.openingSceneId ?? null))

const surfaceSize = computed(() => ({
  width: `${laid.value.width}px`,
  height: `${laid.value.height}px`,
}))

/**
 * Where a Scene's node stands. Every Scene of the Story is placed, so a Scene
 * nothing finds here is one the Graph was asked about before the Story it belongs
 * to was read back — drawn from the corner rather than from nowhere.
 */
function pointOf(sceneId: string): Point {
  return laid.value.placed.get(sceneId) ?? { x: 0, y: 0 }
}

/**
 * Every Exit, as the line that draws it. Every node is `NODE_WIDTH` by
 * `NODE_HEIGHT`, so the box a line leaves and the box it lands on are known from
 * the Story alone: the lines are right in the very first frame, on the server as
 * in the browser, with nothing measured after render.
 *
 * An Exit from a Scene to itself is not drawn. A line of no length says nothing,
 * and a Scene that re-enters itself is read in its own document, where the way on
 * names the Scene it leaves.
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
      ...exitLine(pointOf(exit.fromSceneId), pointOf(exit.toSceneId), place, waysOn.length),
    }
  }))

/**
 * What a node says under the Scene's name: how many Shots are in it. Where its
 * ways on land is what the lines are for.
 */
function atAGlance(scene: Scene) {
  return countedShots(scene.shots.length, t)
}

/**
 * Writes the Scene a node was pressed for. A press on the node the surface is
 * already on leaves the surface where it is: there is always a Scene on the
 * bench, so a node is a way to one and never a way out of it.
 */
function press(scene: Scene) {
  if (scene.id !== sceneWritten) emit('writeScene', scene.id)
}
</script>

<template>
  <!-- The Graph, a band across the bench above the Scene being written. It scrolls
       both ways inside itself and is never scaled: a node is read at one size
       wherever it stands, and a Story wider than the window is scrolled to, the
       way a reel is wound on. -->
  <nav v-if="story?.scenes.length" class="graph" :aria-label="$t('editor.graph')">
    <div class="surface" :style="surfaceSize">
      <!-- The drawing: the lines are the pointer's way to nothing, because
           nothing about an Exit is written here — what is read out of a line is
           read off a node's document instead. -->
      <svg aria-hidden="true" :style="surfaceSize">
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
        v-for="scene in story.scenes"
        :key="scene.id"
        type="button"
        class="node"
        :data-scene="scene.id"
        :data-command="$t('editor.goToScene', { name: scene.name })"
        :aria-label="$t('editor.goToScene', { name: scene.name })"
        :aria-current="sceneWritten === scene.id ? 'true' : undefined"
        :class="{
          opens: story.openingSceneId === scene.id,
          writing: sceneWritten === scene.id,
          unreached: scene.id !== story.openingSceneId
            && !story.exits.some(exit => exit.toSceneId === scene.id),
        }"
        :style="{
          translate: `${pointOf(scene.id).x}px ${pointOf(scene.id).y}px`,
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
          <span class="glance">{{ atAGlance(scene) }}</span>
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* The band the Graph is drawn in: as tall as three nodes and no taller, so a Story
   that branches wide scrolls inside the band rather than pushing the writing off
   the screen, and as wide as the bench, so a long Story is wound along. Drawn on
   the bench's own dark ground, with the writing surface's steel under it. */
.graph {
  flex: none;
  max-block-size: calc(3 * 44px + 2 * 12px + 2 * var(--s3));
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--bench) 70%, black);
}

/* The surface the nodes are laid out on, exactly as large as the drawing: the
   band scrolls to its edges and no further. */
.surface {
  position: relative;
  margin-inline: auto;
}

svg {
  position: absolute;
  inset: 0;
  /* The drawing takes no presses: a node is pressed, a line is read. */
  pointer-events: none;
}

/* An Exit is a mark the Author made, drawn in the grease pencil rather than in
   the interface's own colour. */
svg line {
  stroke: color-mix(in oklab, var(--grease) 70%, transparent);
  stroke-width: 1.5;
}

svg path {
  fill: var(--grease);
}

/* A node: a frame and a slate side by side in a box every Scene shares, so the
   line that draws an Exit can be drawn against geometry nobody has to measure.
   Positioned by translate rather than by inset, because the Graph is read left to
   right whatever direction the interface's text runs in. */
.node {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--s2);
  align-items: center;
  padding: var(--s1);
  /* The strip down the leading edge, which the Opening Scene wears in grease
     pencil: where the Story opens is read without reading a word. */
  border-inline-start: 3px solid var(--edge);
  text-align: start;
  box-shadow: var(--lifted);
}

.node.opens {
  border-inline-start-color: var(--grease);
}

/* The Scene on the writing surface, said on the Graph as well: the Author's eye
   is on the document, and the Graph says where in the Story it stands. */
.node.writing {
  border-color: var(--light);
  border-inline-start-color: var(--light);
  background: var(--steel-lit);
}

.node.writing.opens {
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
  inline-size: 2.125rem;
  block-size: 2.125rem;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

.frame img {
  display: block;
  -webkit-user-drag: none;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* The slate: the Scene's name on one line, and how much is in it under. A long
   name is cut off rather than making the node taller than every other. */
.slate {
  display: grid;
  gap: 1px;
  min-inline-size: 0;
}

.name {
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.glance {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
