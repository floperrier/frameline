<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
// `useFetch` would forward the session cookie itself, but it cannot be given a
// URL that is not a literal (see `send`), so the cookie is passed on by hand —
// without it the render on the server reaches the API as nobody.
const headers = useRequestHeaders(['cookie'])
// `deep`, because the page edits the fetched Story in place — a Condition
// chosen, a name typed — and Nuxt hands back a shallow ref by default, which
// would leave those changes on the object and off the screen.
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
 * key it listens for itself and by the control on the bench's own edge, so
 * which of them is showing is the page's — the way which Scene is being written
 * is.
 */
const commanding = ref(false)

/**
 * The key the bar of Commands is opened with, as the platform names it. Asked of
 * the browser after the page is in one — the server has no platform to ask —
 * and the Command key until then, because that is what most benches are opened
 * on.
 */
const modifier = ref(t('editor.commandKey'))

onMounted(() => {
  if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform)) modifier.value = t('editor.controlKey')
})

/**
 * What the bench has just done, said once and gone: a Scene created, an Exit
 * drawn. One live region for the page rather than one per thing announced,
 * because two of them in the same corner would talk over each other.
 */
const { message: announced, show: announce } = useToast()

/**
 * When each Shot's image was last attached, kept by the Shot's id. An image is
 * served at an address made of the Shot's own id, so replacing one leaves `src`
 * byte-identical and the browser goes on drawing the image it already has.
 * Asking for it under a different address is what makes the new image the one
 * on screen.
 */
const attachedAt = reactive<Record<string, number>>({})

function imageOf(shot: Shot) {
  const at = attachedAt[shot.id]

  return at ? `${shot.image}?at=${at}` : shot.image!
}

/**
 * A file let go of anywhere but a frame. What the browser does with an image
 * dropped on a page is leave the editor and open the file, so the default is
 * refused for the whole page and the cursor says as much. A file and nothing
 * else: dragging a line of text from one field into another is the browser's.
 */
function refuseDrop(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return

  event.preventDefault()
  event.dataTransfer.dropEffect = 'none'
}

/**
 * The Scene being written, which the address carries as `?scene=` on the
 * Story's own page, so an Author can send themselves a link to the Scene they
 * were writing. There is always one on the bench while the Story has a Scene at
 * all: the one the address names, or the Opening Scene, or the first written —
 * a Story is not opened onto nothing, and a stale link to a Scene the Author
 * deleted opens the Story where a Reading would.
 */
const sceneWritten = computed(() => story.value?.scenes.find(scene => scene.id === route.query.scene)
  ?? story.value?.scenes.find(scene => scene.id === story.value?.openingSceneId)
  ?? story.value?.scenes[0])

/**
 * Puts one Scene under the gate, leaving the gate on the face it was showing: a
 * node pressed while the Story is being read is the Author reading on, not asking
 * to write. The gate comes back down if it had been lifted off — pressing a node
 * is asking for that Scene — and the address is replaced rather than pushed,
 * because a back that walked the Author through every node they had pressed
 * would never leave the Story.
 */
async function goToScene(sceneId: string) {
  lifted.value = false

  if (sceneWritten.value?.id !== sceneId) {
    await router.replace({ query: { ...route.query, scene: sceneId } })
    await nextTick()
  }
}

/**
 * Puts one Scene under the gate to be written: the same as going there, and the
 * gate is turned to the face a Scene is written on, with focus in the name — its
 * first field — selected where the Scene arrived under a provisional name, so the
 * first thing typed replaces it. This is what a Remark opens, what a way on's own
 * mark opens, and what a Scene written from nothing arrives in.
 */
async function writeScene(sceneId: string, naming = false) {
  reading.value = false
  await goToScene(sceneId)
  await nextTick()

  const named = document.getElementById(`scene-name-${sceneId}`) as HTMLInputElement | null
  named?.focus()
  if (naming) named?.select()
}

/**
 * The reading has moved on: the writing follows it. The face the Author is
 * reading on stays up — pressing a way on in the reading is reading, not asking
 * to write the Scene it lands in — and there is one notion of where they are,
 * which is the Path: see
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md`.
 */
async function follow(sceneId: string) {
  if (sceneWritten.value?.id === sceneId) return

  await router.replace({ query: { ...route.query, scene: sceneId } })
}

/**
 * A Scene written from nothing: the first of a Story, from the control that
 * stands where the Graph will, or one named into the bar of Commands. The first
 * arrives under a provisional name and is opened with it selected; one named in
 * the bar arrives under the Author's own name, which they have just typed.
 *
 * It joins nothing, which the way on that makes every other Scene never leaves
 * a Story in. That is the honest cost of naming a Scene into existence, and it
 * is why the Graph draws a Scene nothing leads to as the loose end it is.
 */
async function makeScene(name = t('editor.provisionalSceneName')) {
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
  if (writtenId) await writeScene(writtenId, name === t('editor.provisionalSceneName'))
}

/**
 * Whether the gate has been lifted off the Graph, leaving the whole Story on the
 * table with nothing standing on it. The Scene being written is still the one it
 * was — lifting the gate is looking at the Story, not leaving the Scene — so
 * putting it back down needs no address and no read.
 */
const lifted = ref(false)

/** What the control that lifts and lowers the gate says: what pressing it does. */
const liftSays = computed(() => lifted.value
  ? t('editor.writingIn', { name: sceneWritten.value?.name ?? '' })
  : t('editor.wholeStory'))

function lift(event: Event) {
  lifted.value = !lifted.value
  ;(event.currentTarget as HTMLElement).focus()
}

/**
 * Which of its two faces the gate is showing: the Scene being written, or the
 * Story read on the engine a Reader runs. One box on the table with two faces,
 * rather than two columns of a bench — a Story is read exactly where it is
 * written, which is what
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md` asked for and what
 * `docs/adr/0042-the-scene-is-written-where-it-stands.md` finally gives it.
 */
const reading = ref(false)

/**
 * What the control that turns the gate over says: what pressing it does, rather
 * than which face is up — so the control and the Command that runs it are one
 * sentence. Focus is kept on the control, because the face that goes takes
 * whatever was focused inside it with it.
 */
const faceSays = computed(() =>
  reading.value ? t('editor.writeTheScene') : t('editor.readTheStory'))

function turnGate(event: Event) {
  reading.value = !reading.value
  lifted.value = false
  ;(event.currentTarget as HTMLElement).focus()
}
</script>

<template>
  <main @dragover="refuseDrop" @drop="refuseDrop">
    <StoryHeader
      :id="id"
      :story="story ?? undefined"
      :kept-at="keptAt"
      :change="change"
      :write="write"
    >
      <!-- The bench's own acts, on the Story's own edge: the way into every act
           by naming it, what the bench noticed about the Story, whether the gate
           is standing on the Graph, and which of its two faces is up. One row,
           because the table under it is what the screen is for. -->
      <div class="tools">
        <!-- The key does the same thing as the control, drawn on the control where
             somebody who never reads a legend will find it — see
             `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`. -->
        <button type="button" class="commanding" @click="commanding = true">
          {{ $t('editor.commands') }}
          <span class="combination"><kbd>{{ modifier }}</kbd><kbd>K</kbd></span>
        </button>

        <!-- See `docs/adr/0032-the-bench-reads-the-story-back.md`. -->
        <Remarks
          :story="story ?? undefined"
          :scene-written="sceneWritten?.id"
          @open="writeScene"
        />

        <button
          v-if="sceneWritten"
          type="button"
          :data-command="liftSays"
          @click="lift"
        >
          {{ liftSays }}
        </button>

        <!-- `data-step` is here rather than on the reading itself: the guided
             path sends an Author to read why a Shot is not playing, and the turn
             is the gesture it has to point at — see
             `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. -->
        <button
          v-if="sceneWritten"
          type="button"
          data-step="reading"
          :data-command="faceSays"
          @click="turnGate"
        >
          {{ faceSays }}
        </button>
      </div>
    </StoryHeader>

    <!-- What the bench says about itself while there is no Scene to say it
         against: why the last change was refused. With a Scene on the table the
         refusal is shown in the gate instead. -->
    <Refusal v-if="!sceneWritten" :problem="problem" />
    <!-- Always in the document, empty between sentences: a live region announces
         a change to what it already holds, never a node that arrives with its
         sentence inside it. -->
    <p class="toast" role="status">{{ announced }}</p>

    <!-- A Story with nothing on its bench yet. Every Scene after the first is
         made by naming where a way on leads, which needs a Scene to lead from,
         so the first one is a control of its own — gone the moment there is a
         Scene to write from. `data-step` is how the guided path finds it: see
         `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. -->
    <div v-if="story && !story.scenes.length" class="empty">
      <p class="none">{{ $t('editor.noScenes') }}</p>
      <button
        type="button"
        data-step="first-scene"
        :data-command="$t('editor.writeFirstScene')"
        @click="makeScene()"
      >
        {{ $t('editor.writeFirstScene') }}
      </button>
    </div>

    <!-- The Graph is the bench, and the Scene being written stands on it: one
         surface, laid out from the Story alone, with the gate in the place of the
         node of the Scene it holds — see
         `docs/adr/0042-the-scene-is-written-where-it-stands.md`. -->
    <Graph
      :story="story ?? undefined"
      :scene-written="sceneWritten?.id"
      :image-of="imageOf"
      :lifted="lifted"
      @write-scene="goToScene"
    >
      <template v-if="story && sceneWritten">
        <Panel
          v-if="!reading"
          :story="story"
          :scene-written="sceneWritten"
          :change="change"
          :write="write"
          :ask="ask"
          :announce="announce"
          :image-of="imageOf"
          :problem="problem"
          @attached="attachedAt[$event] = Date.now()"
          @open="writeScene"
        />
        <!-- There is one notion of where the Author is and it is the Path, so a
             way on pressed in the reading moves the writing with it — see
             `docs/adr/0030-a-story-is-read-where-it-is-written.md`. -->
        <Preview
          v-else
          :story="story"
          :scene-written="sceneWritten.id"
          :change="change"
          @moved="follow"
        />
      </template>
    </Graph>

    <Confirmation :asked="asked" @answer="answer" />
    <!-- Every act the bench is offering, reached by naming it. It reads the
         controls off the page as it opens, so it stands after all of them. -->
    <Commands v-model="commanding" @make="makeScene" />
    <!-- The step the bench is asking for, if it is asking for one. Last, so it
         is drawn over the bench it is lighting a part of. -->
    <Step :story="story ?? undefined" />
  </main>
</template>

<style scoped>
/* The page is a column exactly one window tall, and the Graph is the one thing
   on it that grows: the edge takes its row and the table takes everything the
   rows above leave. `dvh` because a browser's own chrome comes and goes. */
main {
  display: flex;
  flex-direction: column;
  block-size: 100dvh;
}

/* The bench's own acts, on the Story's edge. */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

/* The way into the bar, with the key that opens it drawn on its face. */
.commanding {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
}

.combination {
  display: inline-flex;
  gap: 2px;
}

kbd {
  padding: 0 var(--s1);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.6875rem;
}

/* The bench with nothing on it: a note where the Graph would be, and the one
   control that writes the first Scene. */
.empty {
  display: grid;
  justify-items: start;
  align-content: center;
  gap: var(--s3);
  flex: 1;
  margin: var(--s4);
  padding: var(--s5);
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
}

.empty .none {
  max-inline-size: 60ch;
  color: var(--muted);
}
</style>
