<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
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
const { problem, keptAt, change, write } = useEditing(refresh)
const { asked, ask, answer } = useConfirming()

const sceneNames = computed(
  () => new Map(story.value?.scenes.map(scene => [scene.id, scene.name])),
)

/**
 * What the bench has just done, said once and gone: a Scene created, an Exit
 * drawn, a gesture begun or abandoned. One live region for the page rather than
 * one per thing announced, because two of them in the same corner would talk
 * over each other and be read out of order.
 */
const { message: announced, show: announce } = useToast()

/**
 * When each Shot's image was last attached, kept by the Shot's id. An image is
 * served at an address made of the Shot's own id, so replacing one leaves `src`
 * byte-identical and the browser goes on drawing the image it already has — the
 * very one the Author has just replaced. Asking for it under a different address
 * is what makes the new image the one on screen.
 */
const attachedAt = reactive<Record<string, number>>({})

function imageOf(shot: Shot) {
  const at = attachedAt[shot.id]

  return at ? `${shot.image}?at=${at}` : shot.image!
}

/**
 * A file let go of anywhere but a thumbnail. What the browser does with an image
 * dropped on a page is leave the editor and open the file, which would take the
 * Story off the screen along with everything the Author had open, so the default
 * is refused for the whole page and the cursor says as much: the thumbnails stop
 * their own events before they reach here, and nothing else takes a file.
 *
 * A file and nothing else, though. Dragging a line of text from one field into
 * another is the browser's to carry out, and a page that refused every drop would
 * take that away from every field on it.
 */
function refuseDrop(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return

  event.preventDefault()
  event.dataTransfer.dropEffect = 'none'
}

/**
 * What the panel at the trailing edge of the bench is writing: one Scene, or one
 * Exit, and never both. One panel, so one answer to "what am I writing" — a
 * second would be a second answer, and on a bench where lines cross the two
 * would sit over each other.
 *
 * Held by id, like every other thing the bench holds across a read: a refetch
 * replaces every Scene and every Exit in the Story, and the panel would otherwise
 * be writing into an object nothing draws.
 *
 * What is in the panel is the Author's view of their own graph, so it is written
 * nowhere and lasts as long as the page.
 */
const writing = ref<{ scene: string } | { exit: string }>()

/** The Scene the panel is writing, or nothing when it is writing an Exit. */
const sceneWritten = computed(() => {
  const held = writing.value
  if (!held || !('scene' in held)) return

  return story.value?.scenes.find(scene => scene.id === held.scene)
})

/**
 * The Exit the panel is writing, and the two Scenes it joins by name. Nothing at
 * all when a Scene is what is being written, or when the Exit has since gone.
 */
const exitWritten = computed(() => {
  const held = writing.value
  const exit = held && 'exit' in held ? exitById(held.exit) : undefined
  if (!exit) return

  return {
    exit,
    from: sceneNamed(sceneNames.value, exit.fromSceneId, t),
    to: sceneNamed(sceneNames.value, exit.toSceneId, t),
  }
})

function exitById(exitId: string) {
  return story.value?.exits.find(exit => exit.id === exitId)
}

/**
 * Puts one Scene in the panel, taking out whatever was there, and takes it out
 * again if it was already the one being written. Focus goes into the name as the
 * panel appears, which is the first field of the Scene and the same promise the
 * Exit's panel makes: a panel nobody can type in is not one the keyboard has
 * reached.
 */
async function writeScene(sceneId: string) {
  if (sceneWritten.value?.id === sceneId) return closePanel()
  writing.value = { scene: sceneId }
  await nextTick()
  document.getElementById(`scene-name-${sceneId}`)?.focus()
}

/**
 * Puts one Exit in the panel, and takes it out again if it was the one being
 * written. Focus goes into the text: pressed by hand that is where the Author was
 * going anyway, and reached from the strip of ways on it is the whole point of
 * the route.
 */
async function openExit(exitId: string) {
  const held = writing.value
  if (held && 'exit' in held && held.exit === exitId) return closePanel()
  writing.value = { exit: exitId }
  await nextTick()
  document.getElementById(`exit-${exitId}`)?.focus()
}

/**
 * Closes the panel and puts focus back on the write button of the card it
 * belongs to — the Scene being written, or the Scene an Exit leaves — so the
 * keyboard comes back out onto the bench rather than at the top of the page. A
 * panel closed with the pointer on the bare bench is closed by hand and leaves
 * focus alone: see `releaseBench`.
 *
 * The card's button rather than the control the panel was opened from, which for
 * an Exit is a row of the ways on: one panel holds one thing, so opening an Exit took
 * the Scene out of the panel and that row is no longer in the page to hand focus
 * back to. The card is the one anchor both routes share, and the Exit's panel
 * offers the way back to the Scene's for a hand that wants the row again.
 */
function closePanel() {
  const held = writing.value
  if (!held) return

  const sceneId = 'scene' in held ? held.scene : exitById(held.exit)?.fromSceneId
  writing.value = undefined
  if (sceneId) document.getElementById(`write-${sceneId}`)?.focus()
}

/**
 * Escape closes the panel at the edge of the bench. Listened for on the document
 * because the Author may be anywhere on the page when they press it — over the
 * graph, in a field of the panel — so there is no element to hang it on. The
 * graph listens for the same key to let go of an Exit being drawn.
 */
function letGoOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Not while a confirmation is up. `<dialog>` answers Escape itself, and the
  // control the question was asked from is in the panel: closing the panel out
  // from under that answer would take the focus it hands back with it.
  if (asked.value) return

  closePanel()
}

onMounted(() => document.addEventListener('keydown', letGoOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', letGoOnEscape))
</script>

<template>
  <main @dragover="refuseDrop" @drop="refuseDrop">
    <StoryHeader :id="id" :story="story ?? undefined" :kept-at="keptAt" :change="change" />

    <!-- The graph and the row of controls above it, with the panel docked at the
         bench's trailing edge: the two halves of the one surface an Author works
         on — see `docs/adr/0011-the-scene-editor-is-the-scenes-own-node.md`. What
         is in the panel is settled here, because both halves ask for it. -->
    <Graph
      :id="id"
      :story="story ?? undefined"
      :scene-written="sceneWritten?.id"
      :exit-written="exitWritten?.exit.id"
      :asking="!!asked"
      :change="change"
      :announce="announce"
      :image-of="imageOf"
      @write-scene="writeScene"
      @open-exit="openExit"
      @let-go="writing = undefined"
    >
      <!-- What the bench says about itself, between the row of controls and the
           graph: why the last change was refused, and what has just been done. -->
      <Refusal :problem="problem" />
      <p v-if="announced" class="toast" role="status">{{ announced }}</p>

      <template #panel>
        <Panel
          v-if="story && (sceneWritten || exitWritten)"
          :story="story"
          :scene-written="sceneWritten"
          :exit-written="exitWritten"
          :change="change"
          :write="write"
          :ask="ask"
          :announce="announce"
          :image-of="imageOf"
          @write-scene="writeScene"
          @open-exit="openExit"
          @close="closePanel"
          @attached="attachedAt[$event] = Date.now()"
        />
      </template>
    </Graph>

    <Confirmation :asked="asked" @answer="answer" />
    <!-- The step the bench is asking for, if it is asking for one. Last, so it
         is drawn over the bench it is lighting a part of. -->
    <Step :story="story ?? undefined" :writing="sceneWritten?.id" />
  </main>
</template>

<style scoped>
/* The bench. Everything above the graph is the Story as a whole, and the graph
   itself takes what is left of the screen. Each piece of it carries its own
   drawing: what is left here is the page they are laid out on. */
main {
  display: grid;
  gap: var(--s4);
  align-content: start;
  min-block-size: 100dvh;
  padding: var(--s4) var(--s4) var(--s5);
}
</style>
