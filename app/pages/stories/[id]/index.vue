<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const id = useRoute().params.id as string
// `useFetch` would forward the session cookie itself, but it cannot be given a
// URL that is not a literal (see `send`), so the cookie is passed on by hand —
// without it the render on the server reaches the API as nobody.
const headers = useRequestHeaders(['cookie'])
// `deep`, because the page edits the fetched Story in place — a node dragged, a
// Condition chosen — and Nuxt hands back a shallow ref by default, which would
// leave those changes on the object and off the screen.
const { data: story, refresh } = await useAsyncData(
  `story-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
  { deep: true },
)
const { problem, change } = useEditing(refresh)

/**
 * The public link a Publish hands out. Built from the Story's own id, so it is
 * the same link every time — an Author who unpublishes and publishes again has
 * not invalidated what they sent anyone.
 */
const publicLink = `${useRequestURL().origin}/read/${id}`

function publish() {
  return change(() => send(`/api/stories/${id}/publish`, { method: 'POST' }))
}

function unpublish() {
  return change(() => send(`/api/stories/${id}/publish`, { method: 'DELETE' }))
}

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

/**
 * Writes what the Author typed about one Shot — its text and its still's
 * Description — in the one request, because they are one Shot and either field
 * may be the one that changed.
 */
function writeShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description },
  }))
}

function moveShot(shot: Shot, direction: 'earlier' | 'later') {
  return change(() => send(`/api/shots/${shot.id}/move`, { method: 'POST', body: { direction } }))
}

/**
 * When each Shot's still was last attached, kept by the Shot's id. A still is
 * served at an address made of the Shot's own id, so replacing one leaves `src`
 * byte-identical and the browser goes on drawing the image it already has — the
 * very one the Author has just replaced. Asking for it under a different address
 * is what makes the new still the one on screen.
 */
const attachedAt = reactive<Record<string, number>>({})

function stillOf(shot: Shot) {
  const at = attachedAt[shot.id]

  return at ? `${shot.image}?at=${at}` : shot.image!
}

/**
 * Attaches the still the Author picked, sent as the whole request body. The input
 * is cleared afterwards so picking the same file twice is a change twice — an
 * Author whose first upload was refused would otherwise have to pick another file
 * before they could retry the same one.
 */
function attachImage(shot: Shot, event: Event) {
  const picker = event.target as HTMLInputElement
  const picked = picker.files?.[0]
  if (!picked) return
  picker.value = ''

  return change(async () => {
    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: picked })
    attachedAt[shot.id] = Date.now()
  })
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

function moveCut(cut: Cut, direction: 'earlier' | 'later') {
  return change(() => send(`/api/cuts/${cut.id}/move`, { method: 'POST', body: { direction } }))
}

function writeCut(cut: Cut) {
  return change(() => send(`/api/cuts/${cut.id}`, { method: 'PATCH', body: { text: cut.text } }))
}

/**
 * The Flags a Scene sets on entry, written as the Author typed them.
 *
 * ponytail: typed as text rather than edited a row apiece — one text field
 * instead of a whole repeatable form with a request per Flag. Give each Flag its
 * own row the day Authors trip over the separator.
 */
function writeFlags(scene: Scene, typed: string) {
  const sets = flagsTyped(typed)

  return change(() => send(`/api/scenes/${scene.id}/flags`, { method: 'PUT', body: { sets } }))
}

/** Which of the two things one Condition of a Cut tests. */
type ConditionKind = 'flag' | 'visits'

function conditionKind(condition: Condition): ConditionKind {
  return 'flag' in condition ? 'flag' : 'visits'
}

/**
 * Adds a Condition to a Cut. It starts as a Flag with no name, which is half a
 * Condition and which the server is right to refuse, so nothing is written until
 * the name is typed — or until the Author turns the row into a visit count,
 * which is whole the moment it is chosen.
 */
function addCondition(cut: Cut) {
  cut.conditions.push({ flag: '', is: '' })
}

function removeCondition(cut: Cut, place: number) {
  cut.conditions.splice(place, 1)
  return writeConditions(cut)
}

/**
 * Turns one row into a Condition of the other kind, and writes what that leaves:
 * a visit count is whole the moment it is chosen, and a Flag with no name yet is
 * a row the Story does not carry until it is typed. A Condition counting visits
 * starts on the Scene the Cut leaves, entered twice — the Cut an Author draws
 * for a second reading of a Scene, which is the common one.
 */
function chooseCondition(cut: Cut, place: number, kind: ConditionKind) {
  cut.conditions[place] = kind === 'flag'
    ? { flag: '', is: '' }
    : { scene: cut.fromSceneId, visits: 'at least', times: 2 }

  return writeConditions(cut)
}

/**
 * Writes the whole list, because that is what the Cut carries and what the
 * endpoint takes. A row whose Flag has no name is half a Condition, which the
 * server is right to refuse, so it is left out of what is sent rather than
 * holding back the rest — a Condition taken off a Cut has to reach the Story
 * whatever else the Author is in the middle of typing.
 */
function writeConditions(cut: Cut) {
  const conditions = cut.conditions.filter(
    condition => !('flag' in condition) || condition.flag.trim())

  return change(
    () => send(`/api/cuts/${cut.id}/conditions`, { method: 'PUT', body: { conditions } }),
  )
}

/**
 * How one Condition of a Cut is named where the row's own labels are too short to
 * say it: "Condition 2 of the Cut to The platform". Every field of the row ends
 * in it, so a Story of forty Cuts has no two labels alike.
 */
function conditionCalled(cut: Cut, place: number) {
  return `Condition ${place + 1} of the Cut to ${sceneNames.value.get(cut.toSceneId)}`
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
    <!-- The bench's own header: where the Author came from, what they are working
         on, and the two things that can be done to the Story as a whole. It stays
         on screen, because the graph below it scrolls a long way. -->
    <header>
      <div class="titling">
        <NuxtLink class="back trail" to="/stories">All Stories</NuxtLink>
        <h1>{{ story?.title }}</h1>
      </div>

      <div class="release">
        <!-- Published or not is the whole of it: one button either way, and the link
             shown in full so it can be copied out of the page. -->
        <p v-if="story?.publishedAt" class="live">
          <span class="eyebrow">Anyone can read this Story at</span>
          <a class="link" :href="publicLink">{{ publicLink }}</a>
        </p>
        <NuxtLink class="preview trail" :to="`/stories/${id}/preview`">Preview this Story</NuxtLink>
        <button v-if="story?.publishedAt" type="button" @click="unpublish">
          Unpublish this Story
        </button>
        <button v-else type="button" class="primary" @click="publish">Publish this Story</button>
      </div>
    </header>

    <form class="naming" @submit.prevent="createScene">
      <label class="eyebrow" for="new-scene-name">Name of a new Scene</label>
      <div class="row">
        <input id="new-scene-name" v-model="newSceneName" required :maxlength="SCENE_NAME_MAX_LENGTH">
        <button type="submit">Create Scene</button>
      </div>
    </form>

    <p v-if="problem" role="alert">{{ problem }}</p>

    <p v-if="!story?.scenes.length" class="none">
      No Scenes yet. Name one above, and it lands on the bench with a Shot to write.
    </p>
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
          <div class="slate">
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
          </div>

          <div class="standing">
            <p class="opening">
              <input
                :id="`opening-${scene.id}`"
                type="radio"
                name="opening-scene"
                :checked="story.openingSceneId === scene.id"
                @change="openOn(scene)"
              >
              <label class="eyebrow" :for="`opening-${scene.id}`">
                Opening Scene <span class="visually-hidden">{{ scene.name }}</span>
              </label>
            </p>

            <button type="button" class="danger" @click="deleteScene(scene)">
              Delete Scene <span class="visually-hidden">{{ scene.name }}</span>
            </button>
          </div>

          <!-- The Shots as a strip: numbered from one for the Author, though the
               Scene counts from zero, and each one's number sits in the gutter
               where the edge code would be. -->
          <ol class="shots">
            <li v-for="(shot, place) in scene.shots" :key="shot.id">
              <!-- The number alone in the gutter, where a frame's edge code would be,
                   and the word it is a number of kept for anyone listening. -->
              <label class="shot-number" :for="`shot-${shot.id}`">
                <span class="visually-hidden">Shot </span>{{ place + 1 }}
              </label>
              <div class="written">
                <textarea
                  :id="`shot-${shot.id}`"
                  v-model="shot.text"
                  rows="2"
                  :maxlength="SHOT_TEXT_MAX_LENGTH"
                  @change="writeShot(shot)"
                />

                <!-- The still beside the picker that attached it, small: it is
                     here to say which image the Shot carries, and the Preview is
                     where the Author meets it at the size a Reader will. -->
                <div class="still">
                  <img v-if="shot.image" :src="stillOf(shot)" :alt="`The still of Shot ${place + 1}`">
                  <div>
                    <label class="eyebrow" :for="`image-${shot.id}`">
                      Image <span class="visually-hidden">of Shot {{ place + 1 }}</span>
                    </label>
                    <input
                      :id="`image-${shot.id}`"
                      type="file"
                      :accept="SHOT_IMAGE_TYPES.join(',')"
                      @change="attachImage(shot, $event)"
                    >
                  </div>
                </div>

                <!-- The Description sits under the picker, because it is what the
                     still shows and there is nothing to describe until one is
                     attached. A Shot of text alone is not asked for one. -->
                <p v-if="shot.image" class="described">
                  <label class="eyebrow" :for="`description-${shot.id}`">
                    Description <span class="visually-hidden">of the still of Shot {{ place + 1 }}</span>
                  </label>
                  <input
                    :id="`description-${shot.id}`"
                    v-model="shot.description"
                    type="text"
                    :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
                    placeholder="What the still shows"
                    @change="writeShot(shot)"
                  >
                </p>

                <div class="row">
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
                  <button type="button" class="danger" @click="deleteShot(shot)">
                    Delete <span class="visually-hidden">Shot {{ place + 1 }}</span>
                  </button>
                </div>
              </div>
            </li>
          </ol>

          <button type="button" @click="addShot(scene)">
            Add Shot <span class="visually-hidden">to {{ scene.name }}</span>
          </button>

          <p class="sets">
            <label class="eyebrow" :for="`flags-${scene.id}`">
              Flags set on entering <span class="visually-hidden">{{ scene.name }}</span>
            </label>
            <textarea
              :id="`flags-${scene.id}`"
              class="data"
              rows="2"
              :value="flagLines(scene.sets)"
              :placeholder="`courage ${FLAG_SEPARATOR} high`"
              @change="writeFlags(scene, ($event.target as HTMLTextAreaElement).value)"
            />
          </p>

          <ul class="cuts">
            <li v-for="(cut, place) in cutsFrom(scene)" :key="cut.id">
              <label class="eyebrow" :for="`cut-${cut.id}`">
                Cut to {{ sceneNames.get(cut.toSceneId) }}
                <span class="visually-hidden">from {{ scene.name }}</span>
              </label>
              <input
                :id="`cut-${cut.id}`"
                v-model="cut.text"
                :maxlength="CUT_TEXT_MAX_LENGTH"
                @change="writeCut(cut)"
              >

              <!-- The Conditions a Cut carries, a row apiece and all of them
                   holding for the Cut to be offered: flat, so a Condition is read
                   as one sentence and the list is read as the whole of them. A
                   Cut carrying none is offered to everyone. -->
              <div class="conditions">
                <p class="eyebrow">
                  Offered when
                  <span class="visually-hidden">
                    taking the Cut to {{ sceneNames.get(cut.toSceneId) }}
                  </span>
                  <template v-if="!cut.conditions.length">— always</template>
                </p>

                <div v-for="(condition, place) in cut.conditions" :key="place" class="when">
                  <label class="eyebrow" :for="`when-${cut.id}-${place}`">
                    Condition {{ place + 1 }}
                    <span class="visually-hidden">
                      of the Cut to {{ sceneNames.get(cut.toSceneId) }}
                    </span>
                  </label>
                  <select
                    :id="`when-${cut.id}-${place}`"
                    :value="conditionKind(condition)"
                    @change="chooseCondition(
                      cut, place, ($event.target as HTMLSelectElement).value as ConditionKind)"
                  >
                    <option value="flag">A Flag holds</option>
                    <option value="visits">A Scene has been entered</option>
                  </select>

                  <template v-if="'flag' in condition">
                    <label class="eyebrow" :for="`flag-${cut.id}-${place}`">
                      Flag
                      <span class="visually-hidden">of {{ conditionCalled(cut, place) }}</span>
                    </label>
                    <input
                      :id="`flag-${cut.id}-${place}`"
                      v-model="condition.flag"
                      class="data"
                      :maxlength="FLAG_NAME_MAX_LENGTH"
                      @change="writeConditions(cut)"
                    >
                    <label class="eyebrow" :for="`is-${cut.id}-${place}`">
                      holds
                      <span class="visually-hidden">for {{ conditionCalled(cut, place) }}</span>
                    </label>
                    <input
                      :id="`is-${cut.id}-${place}`"
                      v-model="condition.is"
                      class="data"
                      :maxlength="FLAG_VALUE_MAX_LENGTH"
                      @change="writeConditions(cut)"
                    >
                  </template>

                  <template v-else>
                    <label class="eyebrow" :for="`counted-${cut.id}-${place}`">
                      Scene
                      <span class="visually-hidden">
                        counted by {{ conditionCalled(cut, place) }}
                      </span>
                    </label>
                    <select
                      :id="`counted-${cut.id}-${place}`"
                      v-model="condition.scene"
                      @change="writeConditions(cut)"
                    >
                      <!-- A Scene deleted since the Condition was written is still
                           what it counts, and saying so beats showing the Author a
                           Scene they never chose. -->
                      <option v-if="!sceneNames.get(condition.scene)" :value="condition.scene">
                        A Scene that is gone
                      </option>
                      <option v-for="counted in story.scenes" :key="counted.id" :value="counted.id">
                        {{ counted.name }}
                      </option>
                    </select>
                    <label class="eyebrow" :for="`visits-${cut.id}-${place}`">
                      entered
                      <span class="visually-hidden">for {{ conditionCalled(cut, place) }}</span>
                    </label>
                    <select
                      :id="`visits-${cut.id}-${place}`"
                      v-model="condition.visits"
                      @change="writeConditions(cut)"
                    >
                      <option value="at least">at least</option>
                      <option value="fewer than">fewer than</option>
                    </select>
                    <label class="eyebrow" :for="`times-${cut.id}-${place}`">
                      times
                      <span class="visually-hidden">for {{ conditionCalled(cut, place) }}</span>
                    </label>
                    <input
                      :id="`times-${cut.id}-${place}`"
                      v-model.number="condition.times"
                      class="times data"
                      type="number"
                      min="1"
                      :max="VISITS_MAX"
                      @change="writeConditions(cut)"
                    >
                  </template>

                  <button type="button" class="danger" @click="removeCondition(cut, place)">
                    Remove Condition {{ place + 1 }}
                    <span class="visually-hidden">
                      of the Cut to {{ sceneNames.get(cut.toSceneId) }}
                    </span>
                  </button>
                </div>

                <button
                  v-if="cut.conditions.length < CUT_CONDITIONS_MAX"
                  type="button"
                  @click="addCondition(cut)"
                >
                  Add a Condition
                  <span class="visually-hidden">
                    to the Cut to {{ sceneNames.get(cut.toSceneId) }}
                  </span>
                </button>
              </div>

              <div class="row">
                <button
                  type="button"
                  :disabled="place === 0"
                  @click="moveCut(cut, 'earlier')"
                >
                  Move earlier
                  <span class="visually-hidden">
                    the Cut to {{ sceneNames.get(cut.toSceneId) }}
                  </span>
                </button>
                <button
                  type="button"
                  :disabled="place === cutsFrom(scene).length - 1"
                  @click="moveCut(cut, 'later')"
                >
                  Move later
                  <span class="visually-hidden">
                    the Cut to {{ sceneNames.get(cut.toSceneId) }}
                  </span>
                </button>
                <button type="button" class="danger" @click="deleteCut(cut)">
                  Delete Cut to {{ sceneNames.get(cut.toSceneId) }}
                </button>
              </div>
            </li>
          </ul>

          <form class="drawing" @submit.prevent="drawCut(scene)">
            <label class="eyebrow" :for="`cut-from-${scene.id}`">Cut from {{ scene.name }} to</label>
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
/* The bench. Everything above the graph is the Story as a whole, and the graph
   itself takes what is left of the screen. */
main {
  display: grid;
  gap: var(--s4);
  align-content: start;
  min-block-size: 100dvh;
  padding: var(--s4) var(--s4) var(--s5);
}

header {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--s3) var(--s4);
  padding-block: var(--s3);
  border-block-end: 1px solid var(--edge);
  /* The graph scrolls under the header, so the header cannot be transparent. */
  background: var(--bench);
}

.titling {
  display: grid;
  gap: var(--s1);
}

/* A Story's title is the Author's own words, so nothing here recases them. */

.release {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s3);
}

/* A published Story wears the grease pencil: the link is the one thing on the
   bench that anyone outside can reach. */
.live {
  display: grid;
  gap: 2px;
  padding-inline-start: var(--s3);
  border-inline-start: 2px solid var(--grease);
}

.link {
  color: var(--paper);
  font-family: var(--data);
  font-size: 0.75rem;
  word-break: break-all;
}

.naming {
  display: grid;
  gap: var(--s2);
  max-inline-size: 34rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.naming .row input {
  flex: 1 1 14rem;
}

.naming .row button {
  flex: none;
}

.none {
  color: var(--muted);
  max-inline-size: 46ch;
}

.graph {
  overflow: auto;
  resize: vertical;
  block-size: min(70dvh, 44rem);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--bench) 70%, black);
}

.canvas {
  position: relative;
  /* The bench is pricked out every twenty pixels, which is exactly how far an
     arrow key moves a Scene: the grid is the step, not a texture. */
  background-image:
    radial-gradient(
      circle at 1px 1px,
      color-mix(in oklab, var(--edge) 55%, transparent) 1px,
      transparent 0
    );
  background-size: 20px 20px;
}

svg {
  position: absolute;
  inset: 0;
}

/* A Cut is a mark the Author made, so it is drawn in the grease pencil rather
   than in the interface's own colour. */
svg line {
  stroke: color-mix(in oklab, var(--grease) 70%, transparent);
  stroke-width: 1.5;
}

svg path {
  fill: var(--grease);
}

article {
  position: absolute;
  display: grid;
  /* Tight, because everything a Scene is — its Shots, the Flags it sets and the
     Cuts leaving it — has to fit a node before the node has to be scrolled. */
  gap: var(--s2);
  align-content: start;
  /* A Scene with many Shots scrolls inside its node rather than growing over the
     ones below it. */
  overflow: auto;
  padding: 0 var(--s3) var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

/* Whichever node is being worked in comes to the front, so two nodes dragged
   over each other are both reachable. */
article:focus-within {
  z-index: 1;
  border-color: color-mix(in oklab, var(--light) 45%, var(--edge));
}

/* The Scene a Reading starts on, marked down the edge of the node: the Author
   can see where the Story opens without reading a single radio button. */
article:has(input[type='radio']:checked) {
  border-inline-start: 2px solid var(--grease);
}

/* The slate: the Scene's name, and the grip that moves it. It stays put while
   the node scrolls, so the node being dragged always says which one it is. */
.slate {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  padding-block: var(--s3) var(--s2);
  border-block-end: 1px solid var(--edge);
  background: var(--steel);
}

.handle {
  flex: none;
  /* The only pointer route to moving a Scene, so it is a target a thumb can
     find on a phone rather than the size of its ten-pixel label. */
  min-block-size: 2.25rem;
  padding: var(--s1) var(--s3);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: move;
  touch-action: none;
}

.standing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
}

.opening {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

/* Data the Author types rather than prose: Flags, a Condition's two sides, the
   count of visits. */
.data {
  font-family: var(--data);
  font-size: 0.8125rem;
}

/* The strip of Shots, each numbered in the gutter and separated from the next by
   a hairline — a Scene read the way a length of film is. */
.shots {
  display: grid;
  gap: var(--s2);
}

.shots li {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr);
  gap: var(--s2);
  padding-block-end: var(--s3);
  border-block-end: 1px dashed color-mix(in oklab, var(--edge) 70%, transparent);
}

.shots li:last-child {
  border-block-end: none;
  padding-block-end: 0;
}

.shot-number {
  padding-block-start: var(--s2);
  font-family: var(--data);
  /* A Shot's number is what the Author refers to it by, so it is read at the
     same contrast as the rest of the labels and not dimmed to decoration. */
  color: var(--muted);
  font-size: 0.8125rem;
  letter-spacing: 0;
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.written {
  display: grid;
  gap: var(--s2);
}

.written textarea {
  font-size: 0.875rem;
}

/* A still is a thumbnail here and nothing more: it says which image the Shot
   carries, and leaves the node's height to the Flags and the Cuts. */
.still {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--s2);
}

/* The Description under the still it describes, the label above the field, so
   the two read as one thing said about the image beside them. */
.described {
  display: grid;
  gap: var(--s1);
}

.described input {
  font-size: 0.8125rem;
}

.still img {
  display: block;
  inline-size: 4.5rem;
  block-size: 3rem;
  object-fit: cover;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

.written .row {
  gap: var(--s1);
}

.written .row button {
  padding: var(--s1) var(--s2);
  font-size: 0.6875rem;
}

.sets {
  display: grid;
  gap: var(--s2);
}

/* The Cuts leaving this Scene. Each carries the grease pencil down its edge,
   because a Cut is drawn and not computed. */
.cuts {
  display: grid;
  gap: var(--s2);
}

.cuts > li {
  display: grid;
  gap: var(--s2);
  padding: var(--s2) var(--s3);
  border-inline-start: 2px solid color-mix(in oklab, var(--grease) 60%, transparent);
  background: color-mix(in oklab, var(--bench) 55%, transparent);
}

/* The Conditions of one Cut, stacked, each read across its own row as the
   sentence it is: "offered when a Flag holds — coat — on". */
.conditions {
  display: grid;
  gap: var(--s1);
}

.when {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s2);
}

.when select,
.when input {
  inline-size: auto;
  flex: 1 1 6rem;
  padding: var(--s1) var(--s2);
  font-size: 0.8125rem;
}

.when .times {
  flex: 0 0 4.5rem;
}

.drawing {
  display: grid;
  gap: var(--s2);
  padding-block-start: var(--s3);
  border-block-start: 1px solid var(--edge);
}

/* On a phone the graph is worked on a screen narrower than a node, so it is
   given more of the screen's height rather than a slice of it. In `dvh`, because
   a browser's own chrome comes and goes and `vh` would leave the bench taller
   than the screen it is on — three nested scrollbars deep. */
@media (max-width: 44rem) {
  .graph {
    block-size: 70dvh;
  }
}
</style>
