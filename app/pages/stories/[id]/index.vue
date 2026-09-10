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
 * key it listens for itself and by the control in the row above the Graph, so
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
 * A file let go of anywhere but a thumbnail. What the browser does with an image
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
 * Puts one Scene on the writing surface. The address is replaced rather than
 * pushed: the Graph changes which Scene is on the surface, and a back that walked
 * the Author through every node they had pressed would never leave the Story.
 * Focus goes into the name, the first field of the Scene — selected where the
 * Scene arrived under a provisional name, so the first thing typed replaces it.
 */
async function writeScene(sceneId: string, naming = false) {
  if (sceneWritten.value?.id !== sceneId) {
    await router.replace({ query: { ...route.query, scene: sceneId } })
    await nextTick()
  }

  const named = document.getElementById(`scene-name-${sceneId}`) as HTMLInputElement | null
  named?.focus()
  if (naming) named?.select()
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
 * Whether the Preview is what the bench is showing in the column the Scene is
 * otherwise written in. Read only where the bench cannot hold the two side by
 * side — the style at the foot of the file names the width — so on a wide screen
 * the Preview stands beside the writing whatever this says, and an Author who
 * chose it in the band has still chosen it when the window narrows again. See
 * `docs/adr/0037-the-reading-folds-before-the-writing-does.md`.
 */
const previewing = ref(false)

/**
 * What the control that swaps them says: what pressing it does, rather than
 * which is showing — so the control and the Command that runs it are one
 * sentence. Focus is kept on the control, because the column that goes takes
 * whatever was focused inside it with it.
 */
const foldSays = computed(() =>
  previewing.value ? t('editor.writeTheScene') : t('editor.readTheStory'))

function foldPreview(event: Event) {
  previewing.value = !previewing.value
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
    />

    <!-- The row above the Graph: the way into every act by naming it, what the
         bench noticed about the Story, and — where the bench cannot hold the
         document and the Preview side by side — which of the two it is showing.
         Every one of them is about the Story rather than about how it is drawn,
         because nothing about the drawing is set any more. -->
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
        class="folding"
        :data-command="foldSays"
        @click="foldPreview"
      >
        {{ foldSays }}
      </button>
    </div>

    <!-- What the bench says about itself while there is no Scene to say it
         against: why the last change was refused. With a Scene on the surface
         the refusal is shown there instead. -->
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

    <!-- The Graph, a band across the bench, and under it the Scene being written
         with the Story read beside it: one surface, laid out from the Story
         alone — see `docs/adr/0041-the-graph-is-drawn-from-the-story.md`. -->
    <Graph
      :story="story ?? undefined"
      :scene-written="sceneWritten?.id"
      :image-of="imageOf"
      @write-scene="writeScene"
    />

    <!-- Each column stands in a holder of its own so the fold can take one of
         the two away without reaching into either component's own drawing.
         Which one a holder holds is said in an attribute rather than a class,
         because the fold reads it and a class would be one more name to keep. -->
    <div v-if="story && sceneWritten" class="bench" :class="{ previewing }">
      <div class="column" data-holds="document">
        <Panel
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
      </div>
      <div class="column" data-holds="preview">
        <!-- There is one notion of where the Author is and it is the Path, so a
             way on pressed in the reading moves the writing with it — see
             `docs/adr/0030-a-story-is-read-where-it-is-written.md`. -->
        <Preview
          :story="story"
          :scene-written="sceneWritten.id"
          :change="change"
          @moved="writeScene"
        />
      </div>
    </div>

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
@import '~/assets/css/folds.css';

/* The page is a column exactly one window tall, and the bench is the one thing
   on it that grows: the Graph takes its band, and the columns under it take what
   the rows above leave. `dvh` because a browser's own chrome comes and goes. */
main {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  block-size: 100dvh;
  padding: var(--s4) var(--s4) var(--s5);
}

.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2) var(--s3);
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

.folding {
  margin-inline-start: auto;
}

/* The bench with nothing on it: a note where the Graph would be, and the one
   control that writes the first Scene. */
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s3);
  padding: var(--s4);
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
}

.empty .none {
  max-inline-size: 60ch;
  color: var(--muted);
}

/* The two columns under the Graph, as tall as what the Graph leaves and each
   scrolling inside itself. Never shorter than a floor, below which the document
   is a slot: a window too short to leave that much is the one case the page
   still scrolls. */
.bench {
  display: flex;
  flex: 1;
  gap: var(--s3);
  min-block-size: 24rem;
}

.column {
  display: contents;
}

/* The control that says which of the two is showing exists only where there is a
   choice to make: below the width the two columns need, named once in
   `app/assets/css/folds.css` and read off the document's own rows — see
   `docs/adr/0037-the-reading-folds-before-the-writing-does.md`. Down to the
   phone and onto it: the document is a column of the page at every width now,
   so the Preview is a press away at every width. */
.folding {
  display: none;
}

@media (--two-columns) {
  .folding {
    display: inline-block;
  }

  .column[data-holds='preview'] {
    display: none;
  }

  /* The Preview standing where the writing was is a column of its own rather than
     the bench's contents, because it is set to a measure and a measure in a
     column twice as wide belongs in the middle of it. */
  .bench.previewing .column[data-holds='preview'] {
    display: flex;
    flex: 1;
    justify-content: center;
    min-inline-size: 0;
  }

  .bench.previewing .column[data-holds='document'] {
    display: none;
  }
}
</style>
