<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
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
const { t } = useI18n()
const { problem, keptAt, change, write } = useEditing(refresh)
const { asked, ask, answer } = useConfirming()

/**
 * Whether the bar every act of the bench is named in is up. It is opened by the
 * key it listens for itself and by the control in the row above the graph, which
 * is two components away from it, so which of them is showing is the page's — the
 * way which Scene is being written is.
 */
const commanding = ref(false)

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
 * The Scene being written, which the address carries: `?scene=` on the Story's
 * own page. `0011` and `0021` both recorded that nothing below a Story was
 * deep-linkable and
 * `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` reverses it for the
 * Scene alone — a Shot has no address — so an Author can send themselves a link
 * to the Scene they were writing and the browser's own back closes the writing.
 *
 * A query on this page rather than a page of its own, because the two are one
 * room: one fetch of the Story, one holder every control writes through, one
 * refusal, and a graph that has not forgotten where it was scrolled to.
 *
 * An address naming a Scene the Story no longer holds finds nothing here and
 * opens the Story with nothing written, which is what a stale link deserves: the
 * Author deleted that Scene themselves and a not-found would be the bench
 * reporting it back to them as an error.
 */
const sceneWritten = computed(
  () => story.value?.scenes.find(scene => scene.id === route.query.scene))

/**
 * The width below which the writing surface stops being a column of the bench
 * and covers it. It is `--phone` in `app/assets/css/folds.css`, where the folds
 * are named once so no two surfaces disagree about them — but a custom media
 * query cannot be read from a script, so this is the same number written a
 * second time, because inertness is not a thing CSS can say. The e2e spec holds
 * the two against each other.
 */
const COVERING = '(max-width: 44rem)'

/**
 * Whether the bench is behind the writing surface rather than beside it. A
 * surface filling the window owes what any sheet over a page owes: nothing under
 * it may be tabbed into or read out, or a keyboard Author walks out of the Scene
 * they are writing into a header and a graph that are not on the screen.
 *
 * Told to the two components that draw what is covered rather than done here,
 * because `inert` is an attribute on those elements. It is deliberately not a
 * `<dialog>`: the browser would give the inertness for free and take the guided
 * path with it — the top layer is above the spotlight and the bubble, so the
 * Step would point at the far side of the surface it is asking about. See
 * `docs/adr/0036-the-surface-that-covers-the-bench-is-not-a-dialog.md`.
 *
 * False until the browser has been asked, so the render on the server and the
 * first render here agree, and the answer arrives a tick later.
 */
const narrow = ref(false)
const covered = computed(() => narrow.value && !!sceneWritten.value)

let asking: MediaQueryList | undefined

function readWidth() {
  narrow.value = !!asking?.matches
}

onMounted(() => {
  asking = window.matchMedia(COVERING)
  asking.addEventListener('change', readWidth)
  readWidth()
})

onBeforeUnmount(() => asking?.removeEventListener('change', readWidth))

/**
 * Whether the writing already stands on the history as an entry of its own. The
 * first Scene written pushes one, so the browser's back closes the writing and
 * returns to the graph; every Scene written after it — pressed in the rail, or
 * handed over by a way on — replaces that entry rather than adding another, or a
 * back would walk the Author card by card through everything they had opened and
 * never reach the graph.
 *
 * Cleared whenever the Scene leaves the address, by whichever route: the control
 * that closes the writing, or the browser's own back.
 */
let pushed = false

watch(() => route.query.scene, (scene) => {
  if (!scene) pushed = false
})

function addressScene(sceneId: string) {
  const to = { query: { ...route.query, scene: sceneId } }
  // One entry for the writing, not one per Scene written: the rail changes which
  // Scene is on the surface, and a back that walked the Author through every card
  // they had pressed would never reach the graph.
  if (pushed) return router.replace(to)

  pushed = true
  return router.push(to)
}

/**
 * Takes the Scene out of the address, which is what closes the writing. A replace
 * rather than a step back: the page has to be able to wait for it — the focus
 * that follows goes to a button on a card the graph only draws once it is
 * unfolded — and `router.back` is a request to the browser and not a promise.
 */
function stopAddressing() {
  if (!route.query.scene) return

  const { scene: _closed, ...query } = route.query

  return router.replace({ query })
}

/**
 * Puts one Scene on the writing surface, taking out whatever was there, and takes
 * it out again if it was already the one being written. Focus goes into the name
 * as the surface appears, which is the first field of the Scene: a surface nobody
 * can type in is not one the keyboard has reached.
 */
async function writeScene(sceneId: string) {
  if (sceneWritten.value?.id === sceneId) return closePanel()
  await addressScene(sceneId)
  await nextTick()
  document.getElementById(`scene-name-${sceneId}`)?.focus()
}

/**
 * A Scene written from the bar, under the name that reached nothing there. The
 * name is the Author's own rather than the provisional one every other way of
 * making a Scene starts from — they have just typed it — so nothing is selected
 * for them to type over: the Scene arrives named and opens for writing.
 *
 * It joins nothing, which the two gestures that make a Scene never leave a Story
 * in on purpose. That is the honest cost of naming a Scene into existence, and
 * it is why the bench owes an Author a way to see a Scene nothing leads to.
 */
async function makeSceneNamed(name: string) {
  let writtenId: string | undefined

  await change(async () => {
    const written = await send(`/api/stories/${id}/scenes`, {
      method: 'POST',
      body: { name },
    }) as Scene

    writtenId = written.id
    announce(t('editor.sceneCreated', { name }))
  })

  // After the read the change asks for, so the surface the Scene is written on
  // is in the page by the time focus is sent into it.
  if (writtenId) await writeScene(writtenId)
}

/**
 * Closes the writing and puts focus back on the write button of the card the
 * Scene belongs to, so the keyboard comes back out onto the bench rather than at
 * the top of the page. A press with the pointer on the bare bench closes it by
 * hand and leaves focus alone: see `releaseBench`.
 */
async function closePanel() {
  const sceneId = sceneWritten.value?.id
  if (!sceneId) return

  await stopAddressing()
  // After the graph is whole again, so the button focus goes to is the one on an
  // unfolded card rather than on a rail that is on its way out.
  await nextTick()
  // Without moving the bench, which the graph has just put back where the Author
  // left it: a focus that scrolls its own element into view would undo the fold's
  // one promise, and the card focus lands on is the one they were writing.
  document.getElementById(`write-${sceneId}`)?.focus({ preventScroll: true })
}

/**
 * The writing let go of rather than closed: a press on the bare bench, which says
 * nothing about where the keyboard should be and leaves focus alone.
 */
function letGo() {
  return stopAddressing()
}

/**
 * Escape closes the panel at every width, including the one where the panel
 * covers the bench: the surface is not a dialog there, so the key is this
 * listener's and there is nothing of the browser's to defer to. Listened for on
 * the document because the Author may be anywhere on the page when they press it
 * — over the graph, in a field of the panel — so there is no element to hang it
 * on. The graph listens for the same key to let go of an Exit being drawn.
 */
function letGoOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Not while a dialog is up — a confirmation, the bar of Commands, whatever is
  // opened next. Each of them answers Escape itself, and the control it was
  // opened from is in the panel: closing the panel out from under that answer
  // would take the focus it hands back with it. Asked of the document rather
  // than of a flag per dialog, because the fact is the browser's own and a flag
  // is one more thing to remember the day a third dialog is drawn.
  //
  // The panel is never one of them, at any width. Were it opened modally on a
  // phone this guard would read it as the dialog to defer to and refuse to close
  // the very thing it exists to close — the question worth asking of a surface
  // that starts behaving like a sheet, and answered by it not becoming one.
  if (document.querySelector('dialog:modal')) return

  closePanel()
}

onMounted(() => document.addEventListener('keydown', letGoOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', letGoOnEscape))
</script>

<template>
  <main @dragover="refuseDrop" @drop="refuseDrop">
    <!-- Out of reach while the writing surface is covering it: the header is
         behind the surface at that width, and Publish is the first thing a
         keyboard walks into past the control that closes the writing. -->
    <StoryHeader
      :id="id"
      :story="story ?? undefined"
      :kept-at="keptAt"
      :writing="!!sceneWritten"
      :inert="covered"
      :change="change"
      :write="write"
    />

    <!-- The graph and the row of controls above it, with what is being written
         beside it: the two halves of the one surface an Author works on — see
         `docs/adr/0011-the-scene-editor-is-the-scenes-own-node.md`, and
         `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` for the fold a
         Scene puts the graph into. What is being written is settled here, because
         both halves ask for it. -->
    <Graph
      :id="id"
      :story="story ?? undefined"
      :scene-written="sceneWritten?.id"
      :covered="covered"
      :change="change"
      :write="write"
      :announce="announce"
      :image-of="imageOf"
      @write-scene="writeScene"
      @let-go="letGo"
      @command="commanding = true"
    >
      <!-- What the bench says about itself, between the row of controls and the
           graph: why the last change was refused, and what has just been done.
           A refusal while a Scene is being written is shown against that Scene
           instead, on the surface it is written on. -->
      <Refusal v-if="!sceneWritten" :problem="problem" />
      <p v-if="announced" class="toast" role="status">{{ announced }}</p>

      <template #panel>
        <Panel
          v-if="story && sceneWritten"
          :story="story"
          :scene-written="sceneWritten"
          :change="change"
          :write="write"
          :ask="ask"
          :announce="announce"
          :image-of="imageOf"
          :problem="problem"
          @close="closePanel"
          @attached="attachedAt[$event] = Date.now()"
          @open="writeScene"
        />
      </template>

      <template #reading>
        <!-- The Story read beside the Scene being written, on the engine a Reader
             runs. There is one notion of where the Author is and it is the Path,
             so a way on pressed in the reading moves the writing with it — see
             `docs/adr/0030-a-story-is-read-where-it-is-written.md`. -->
        <Preview
          v-if="story && sceneWritten"
          :story="story"
          :scene-written="sceneWritten.id"
          :change="change"
          @moved="addressScene"
        />
      </template>
    </Graph>

    <Confirmation :asked="asked" @answer="answer" />
    <!-- Every act the bench is offering, reached by naming it. It reads the
         controls off the page as it opens, so it stands after all of them. -->
    <Commands v-model="commanding" @make="makeSceneNamed" />
    <!-- The step the bench is asking for, if it is asking for one. Last, so it
         is drawn over the bench it is lighting a part of. -->
    <Step :story="story ?? undefined" />
  </main>
</template>

<style scoped>
/* The bench. Everything above the graph is the Story as a whole, and the graph
   itself takes what is left of the screen — literally what is left: a column, so
   that the bench is the one thing on it that grows and the height it grows to is
   the window's less what stands above it. A fraction of the window is what it
   used to be, and no fraction is the height that is there. Each piece of it
   carries its own drawing: what is left here is the page they are laid out on. */
main {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
  /* Exactly the window, so that what is left of it after the rows above the
     bench is a definite height for the bench to take. `dvh` because a browser's
     own chrome comes and goes. A window too short to hold the bench's own floor
     is the one case the page still scrolls. */
  block-size: 100dvh;
  padding: var(--s4) var(--s4) var(--s5);
}
</style>
