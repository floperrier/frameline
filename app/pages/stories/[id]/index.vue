<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const id = useRoute().params.id as string
// `useFetch` would forward the session cookie itself, but it cannot be given a
// URL that is not a literal (see `send`), so the cookie is passed on by hand —
// without it the render on the server reaches the API as nobody.
const headers = useRequestHeaders(['cookie'])
const { data: story, refresh } = await useAsyncData(
  `story-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
)
const { problem, change } = useEditing(refresh)

const newSceneName = ref('')
/** Which Scene each node's Cut form is aimed at, kept per Scene by its id. */
const cutTargets = reactive<Record<string, string>>({})

const sceneNames = computed(
  () => new Map(story.value?.scenes.map(scene => [scene.id, scene.name])),
)

/** The graph is as large as the Scenes in it, so it scrolls no further than them. */
const graphSize = computed(() => {
  const scenes = story.value?.scenes ?? []
  const furthest = (of: (scene: Scene) => number) => Math.max(0, ...scenes.map(of))
  return {
    width: `${furthest(scene => scene.x) + NODE_WIDTH + NODE_GAP}px`,
    height: `${furthest(scene => scene.y) + NODE_HEIGHT + NODE_GAP}px`,
  }
})

function cutsFrom(scene: Scene) {
  return story.value?.cuts.filter(cut => cut.fromSceneId === scene.id) ?? []
}

function createScene() {
  const name = newSceneName.value
  return change(async () => {
    await send(`/api/stories/${id}/scenes`, { method: 'POST', body: { name } })
    newSceneName.value = ''
  })
}

function deleteScene(scene: Scene) {
  const cuts = cutsFrom(scene).length
  if (!confirm(`Delete “${scene.name}”, its ${scene.shots.length} Shots and ${cuts} Cuts?`)) return
  return change(() => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

function addShot(scene: Scene) {
  return change(() => send(`/api/scenes/${scene.id}/shots`, { method: 'POST' }))
}

function writeShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, { method: 'PATCH', body: { text: shot.text } }))
}

function moveShot(shot: Shot, direction: 'earlier' | 'later') {
  return change(() => send(`/api/shots/${shot.id}/move`, { method: 'POST', body: { direction } }))
}

function deleteShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
}

function openOn(scene: Scene) {
  return change(() => send(`/api/scenes/${scene.id}/opening`, { method: 'POST' }))
}

function drawCut(scene: Scene) {
  const toSceneId = cutTargets[scene.id]
  return change(() => send(`/api/scenes/${scene.id}/cuts`, { method: 'POST', body: { toSceneId } }))
}

function writeCut(cut: Cut) {
  return change(() => send(`/api/cuts/${cut.id}`, { method: 'PATCH', body: { text: cut.text } }))
}

function deleteCut(cut: Cut) {
  return change(() => send(`/api/cuts/${cut.id}`, { method: 'DELETE' }))
}

/**
 * Writes where a Scene ended up, once the Author has stopped moving it. The Scene
 * on screen moves with the hand and only the last placement is written, which is
 * what makes a held-down arrow key one request instead of thirty — and keeps two
 * of them from racing, where the earlier write could be the one that lands last.
 *
 * A Scene waits on its own timer: one timer for the graph would let a Scene
 * moved a moment later cancel the write of the one moved before it, and that
 * Scene would spring back on the next read.
 */
const settling: Record<string, ReturnType<typeof setTimeout>> = {}

function moveScene(scene: Scene) {
  clearTimeout(settling[scene.id])
  settling[scene.id] = setTimeout(() => change(() => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { x: scene.x, y: scene.y },
  })), 150)
}

// The Scene being dragged is held by id, not by the object read from the server:
// a read landing mid-drag replaces every Scene in the Story, and the hand would
// carry on moving one nothing draws any more.
let drag: { id: string, pointerX: number, pointerY: number, x: number, y: number } | undefined

function sceneById(id: string) {
  return story.value?.scenes.find(scene => scene.id === id)
}

function startDrag(scene: Scene, event: PointerEvent) {
  // Capturing the pointer sends the rest of the gesture to the handle itself, so
  // dragging survives the pointer leaving the Scene it is dragging.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drag = { id: scene.id, pointerX: event.clientX, pointerY: event.clientY, x: scene.x, y: scene.y }
}

function keepDragging(event: PointerEvent) {
  const dragged = drag && sceneById(drag.id)
  if (!drag || !dragged) return
  dragged.x = withinReach(drag.x + event.clientX - drag.pointerX)
  dragged.y = withinReach(drag.y + event.clientY - drag.pointerY)
}

function endDrag() {
  const dropped = drag && sceneById(drag.id)
  drag = undefined
  if (dropped) return moveScene(dropped)
}

/** The keyboard moves a node too — a graph that only answers to a pointer is not one everyone can lay out. */
const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}
const NUDGE = 20

function nudge(scene: Scene, event: KeyboardEvent) {
  const nudged = NUDGES[event.key]
  if (!nudged) return
  event.preventDefault()
  scene.x = withinReach(scene.x + nudged[0] * NUDGE)
  scene.y = withinReach(scene.y + nudged[1] * NUDGE)
  return moveScene(scene)
}

function withinReach(pixels: number) {
  return Math.min(GRAPH_REACH, Math.max(0, Math.round(pixels)))
}

/**
 * ponytail: a Cut is drawn between fixed points on the two nodes rather than
 * between the edges of their boxes, so a line crosses whatever sits between
 * them. Measuring the boxes needs their rendered heights, which change with
 * every Shot written. Anchor on the real geometry the day the lines are hard to
 * follow.
 */
function anchor(sceneId: string) {
  const scene = sceneById(sceneId)
  return { x: (scene?.x ?? 0) + NODE_WIDTH / 2, y: (scene?.y ?? 0) + NUDGE }
}
</script>

<template>
  <main>
    <header>
      <NuxtLink to="/stories">All Stories</NuxtLink>
      <h1>{{ story?.title }}</h1>
      <NuxtLink :to="`/stories/${id}/preview`">Preview this Story</NuxtLink>
    </header>

    <form @submit.prevent="createScene">
      <label for="new-scene-name">Name of a new Scene</label>
      <input id="new-scene-name" v-model="newSceneName" required :maxlength="SCENE_NAME_MAX_LENGTH">
      <button type="submit">Create Scene</button>
    </form>

    <p v-if="problem" role="alert">{{ problem }}</p>

    <p v-if="!story?.scenes.length">No Scenes yet.</p>
    <div v-else class="graph">
      <div class="canvas" :style="graphSize">
        <!-- The Cuts are listed under the Scene they leave, so the lines that
             draw them are decoration and nothing reads them out. -->
        <svg aria-hidden="true" :style="graphSize">
          <defs>
            <marker
              id="cut-head" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="8" markerHeight="8" orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          <line
            v-for="cut in story.cuts"
            :key="cut.id"
            :x1="anchor(cut.fromSceneId).x"
            :y1="anchor(cut.fromSceneId).y"
            :x2="anchor(cut.toSceneId).x"
            :y2="anchor(cut.toSceneId).y"
            marker-end="url(#cut-head)"
          />
        </svg>

        <article
          v-for="scene in story.scenes"
          :key="scene.id"
          :aria-labelledby="`scene-${scene.id}`"
          :style="{
            translate: `${scene.x}px ${scene.y}px`,
            inlineSize: `${NODE_WIDTH}px`,
            maxBlockSize: `${NODE_HEIGHT}px`,
          }"
        >
          <h2 :id="`scene-${scene.id}`">{{ scene.name }}</h2>

          <button
            type="button"
            class="handle"
            @pointerdown="startDrag(scene, $event)"
            @pointermove="keepDragging"
            @pointerup="endDrag"
            @keydown="nudge(scene, $event)"
          >
            Move <span class="visually-hidden">Scene {{ scene.name }}</span>
          </button>

          <p>
            <input
              :id="`opening-${scene.id}`"
              type="radio"
              name="opening-scene"
              :checked="story.openingSceneId === scene.id"
              @change="openOn(scene)"
            >
            <label :for="`opening-${scene.id}`">
              Opening Scene <span class="visually-hidden">{{ scene.name }}</span>
            </label>
          </p>

          <button type="button" @click="deleteScene(scene)">
            Delete Scene <span class="visually-hidden">{{ scene.name }}</span>
          </button>

          <!-- Numbered from one for the Author, though the Scene counts from zero. -->
          <ol>
            <li v-for="(shot, place) in scene.shots" :key="shot.id">
              <label :for="`shot-${shot.id}`">Shot {{ place + 1 }}</label>
              <textarea
                :id="`shot-${shot.id}`"
                v-model="shot.text"
                :maxlength="SHOT_TEXT_MAX_LENGTH"
                @change="writeShot(shot)"
              />
              <button type="button" :disabled="place === 0" @click="moveShot(shot, 'earlier')">
                Move earlier <span class="visually-hidden">Shot {{ place + 1 }}</span>
              </button>
              <button
                type="button"
                :disabled="place === scene.shots.length - 1"
                @click="moveShot(shot, 'later')"
              >
                Move later <span class="visually-hidden">Shot {{ place + 1 }}</span>
              </button>
              <button type="button" @click="deleteShot(shot)">
                Delete <span class="visually-hidden">Shot {{ place + 1 }}</span>
              </button>
            </li>
          </ol>

          <button type="button" @click="addShot(scene)">
            Add Shot <span class="visually-hidden">to {{ scene.name }}</span>
          </button>

          <ul>
            <li v-for="cut in cutsFrom(scene)" :key="cut.id">
              <label :for="`cut-${cut.id}`">
                Cut to {{ sceneNames.get(cut.toSceneId) }}
                <span class="visually-hidden">from {{ scene.name }}</span>
              </label>
              <input
                :id="`cut-${cut.id}`"
                v-model="cut.text"
                :maxlength="CUT_TEXT_MAX_LENGTH"
                @change="writeCut(cut)"
              >
              <button type="button" @click="deleteCut(cut)">
                Delete Cut to {{ sceneNames.get(cut.toSceneId) }}
              </button>
            </li>
          </ul>

          <form @submit.prevent="drawCut(scene)">
            <label :for="`cut-from-${scene.id}`">Cut from {{ scene.name }} to</label>
            <select :id="`cut-from-${scene.id}`" v-model="cutTargets[scene.id]" required>
              <!-- Nothing is aimed at until the Author says so, so a Cut cannot
                   be drawn by pressing the button alone. -->
              <option value="">Choose a Scene</option>
              <option v-for="other in story.scenes" :key="other.id" :value="other.id">
                {{ other.name }}
              </option>
            </select>
            <button type="submit">Draw Cut from {{ scene.name }}</button>
          </form>
        </article>
      </div>
    </div>
  </main>
</template>

<style scoped>
.graph {
  overflow: auto;
  resize: vertical;
  block-size: 70vh;
  border: 1px solid;
}

.canvas {
  position: relative;
}

svg {
  position: absolute;
  inset: 0;
}

svg line {
  stroke: currentColor;
  stroke-width: 2;
}

svg path {
  fill: currentColor;
}

article {
  position: absolute;
  /* A Scene with many Shots scrolls inside its node rather than growing over the
     ones below it. */
  overflow: auto;
  padding: 0.5rem;
  border: 1px solid;
  background: Canvas;
}

/* Whichever node is being worked in comes to the front, so two nodes dragged
   over each other are both reachable. */
article:focus-within {
  z-index: 1;
}

.handle {
  cursor: move;
  touch-action: none;
}
</style>
