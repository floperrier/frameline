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
 * were writing. A query rather than a fragment, because a fragment never reaches
 * the server and a bench rendered whole is a server's answer — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`. There is always one on
 * the bench while the Story has a Scene at all: the one the address names, or the
 * Opening Scene, or the first written — a Story is not opened onto nothing, and a
 * stale link to a Scene the Author deleted opens the Story where a Reading would.
 */
const sceneWritten = computed(() => story.value?.scenes.find(scene => scene.id === route.query.scene)
  ?? story.value?.scenes.find(scene => scene.id === story.value?.openingSceneId)
  ?? story.value?.scenes[0])

/**
 * Puts the caret in one Scene, leaving the middle of the bench on the reading it
 * was showing: a mark pressed on the rail while the Story is being read is the
 * Author reading on, not asking to write. The address is replaced rather than
 * pushed, because a back that walked the Author through every mark they had
 * pressed would never leave the Story.
 */
async function goToScene(sceneId: string) {
  if (sceneWritten.value?.id !== sceneId) {
    await router.replace({ query: { ...route.query, scene: sceneId } })
    await nextTick()
  }
}

/**
 * The document wound to the Scene the address names. The whole Story is on the
 * bench, so going to a Scene is a scroll rather than an opening — which is what
 * `docs/adr/0043-a-story-is-written-as-one-document.md` says *Go to* now means.
 *
 * `scrollIntoView` rather than arithmetic on the section's offset: the room to
 * leave above it is `scroll-margin-block-start` on the section itself, said once
 * in the units the document's own padding is written in. Smoothness is the
 * stylesheet's, where the answer to `prefers-reduced-motion` is given once.
 *
 * Two callers rather than one immediate watch, and they arrive differently. The
 * first sight of the bench is a reload coming back to an address, and winding the
 * document past the Author before they can read anything says nothing and takes
 * half a second — so the mount is instant. A Scene reached afterwards is a move
 * they made, and the document follows it. `instant` beats the stylesheet's
 * `smooth`; the empty argument leaves it in charge.
 */
function windOn(behavior: ScrollBehavior) {
  document.getElementById(`scene-${sceneWritten.value?.id}`)
    ?.scrollIntoView({ behavior, block: 'start' })
}

onMounted(() => windOn('instant'))
watch(() => sceneWritten.value?.id, async () => {
  await nextTick()
  windOn('smooth')
})

/**
 * Puts the caret in one Scene to write it: the same as going there, with the
 * middle of the bench turned back to the writing, and focus in the name — its
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
 * is why the rail marks a Scene nothing leads to as the loose end it is and the
 * document says so under its name.
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
 * What the bench has read out of the whole Story, said beside the document: how
 * much of a work it is. The Shots and the words are counted across every Scene
 * rather than the one being written — the Scene's own counts are in its section of
 * the document — because this is the figure an Author asks of a manuscript. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 */
const counted = computed(() => {
  const shots = story.value?.scenes.flatMap(scene => scene.shots) ?? []

  return {
    scenes: countedScenes(story.value?.scenes.length ?? 0, t),
    shots: countedShots(shots.length, t),
    words: countedWords(wordsOf(shots), t),
    exits: countedExits(story.value?.exits.length ?? 0, t),
  }
})

/**
 * Which reading the middle of the bench is showing: the writing, or the Story read
 * on the engine a Reader runs. The rail and the Remarks do not move between them —
 * what changes is what the middle is a reading of, never where anything is. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which keeps `0030`'s
 * engine rule and supersedes its *beside*.
 */
const reading = ref(false)

/**
 * What the control that turns the middle over says: what pressing it does, rather
 * than which reading is up — so the control and the Command that runs it are one
 * sentence. Focus is kept on the control, because the reading that goes takes
 * whatever was focused inside it with it.
 */
const faceSays = computed(() =>
  reading.value ? t('editor.writeTheScene') : t('editor.readTheStory'))

function turnGate(event: Event) {
  reading.value = !reading.value
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
           by naming it, and which reading the middle of the bench is showing. Two
           controls, because the document under them is what the screen is for —
           the Remarks left this row for a region of their own beside the document,
           see `docs/adr/0043-a-story-is-written-as-one-document.md`. -->
      <div class="tools">
        <!-- The key does the same thing as the control, drawn on the control where
             somebody who never reads a legend will find it — see
             `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`. -->
        <button type="button" class="commanding" @click="commanding = true">
          {{ $t('editor.commands') }}
          <span class="combination"><kbd>{{ modifier }}</kbd><kbd>K</kbd></span>
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
         against: why the last change was refused. With a Scene on the bench the
         refusal is shown in that Scene's own section of the document instead. -->
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

    <!-- The bench: three regions that never trade width — the rail, the document,
         and the side the bench says what it read back on. Nothing covers anything,
         nothing is made `inert` and nothing is `display: none`: what folds is the
         width the Remarks are said in and never their voice. See
         `docs/adr/0043-a-story-is-written-as-one-document.md`. -->
    <div v-else-if="story" class="bench">
      <!-- The Graph drawn small, and it never grows: 120 pixels at every width,
           narrowing to a strip of dots on a phone. -->
      <Graph
        :story="story"
        :scene-written="sceneWritten?.id"
        @write-scene="goToScene"
      />

      <!-- The one thing on the bench that scrolls. Which reading it holds is the
           page's to say; where it is, is not. -->
      <div class="document">
        <!-- There is one notion of where the Author is and it is the Path, so a
             way on pressed in the reading moves the writing with it — see
             `docs/adr/0030-a-story-is-read-where-it-is-written.md`, whose engine
             rule `0043` keeps. -->
        <Preview
          v-if="reading && sceneWritten"
          :story="story"
          :scene-written="sceneWritten.id"
          :change="change"
          @moved="follow"
        />

        <!-- The whole Story as one document, with the Scene the caret is in
             written in the place the order already gave it. -->
        <Writing v-else :story="story" :scene-written="sceneWritten?.id">
          <Panel
            v-if="sceneWritten"
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
        </Writing>
      </div>

      <!-- What the bench read back out of the Story: how much of a work it is,
           and then what it noticed about it — see
           `docs/adr/0032-the-bench-reads-the-story-back.md`. -->
      <aside class="said">
        <p class="counts">
          <span>{{ counted.scenes }}</span>
          <span>{{ counted.shots }}</span>
          <span>{{ counted.words }}</span>
          <span>{{ counted.exits }}</span>
        </p>

        <Remarks :story="story" :scene-written="sceneWritten?.id" @open="writeScene" />
      </aside>
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
   on it that grows: the edge takes its row and the bench takes everything the
   rows above leave. `dvh` because a browser's own chrome comes and goes. */
main {
  display: flex;
  flex-direction: column;
  block-size: 100dvh;
}

/* The bench: the rail, the document and what the bench says beside them, and the
   three never trade width. The rail is as wide as it is at every width, the
   document takes the rest and the side the Remarks are said on has a ceiling —
   `minmax(0, …)` on both so that a long word in either cannot push the page wider
   than the window. See `docs/adr/0043-a-story-is-written-as-one-document.md`. */
.bench {
  flex: 1;
  display: grid;
  grid-template-areas: 'rail document said';
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 20rem);
  min-block-size: 0;
}

.rail {
  grid-area: rail;
}

/* The scroller, and the only one on the bench: the document is what the window is
   for at every width. Wound to the Scene the address names — smoothly when the
   Author asked for the move, and instantly on the first sight of the bench, which
   `windOn` says. The answer to `prefers-reduced-motion` is given once, here,
   rather than at each call. */
.document {
  grid-area: document;
  min-inline-size: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  .document {
    scroll-behavior: auto;
  }
}

/* What the bench read back out of the Story. No new noun is coined for this side:
   *margin* and *gutter* are both already spoken for at the scale of a row, so what
   stands here is the counts and the Remarks, which are words the glossary already
   has. */
.said {
  grid-area: said;
  display: grid;
  align-content: start;
  gap: var(--s3);
  min-inline-size: 0;
  overflow-y: auto;
  padding: var(--s4);
}

/* How much of a work the Story is, stencilled in the machine's own data face:
   this is the bench counting rather than anything the Author wrote. */
.counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s3);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

/* The first fold: there is room for the document and the rail but not for what
   the bench says beside them, so that region goes to the head of the document and
   the rail spans both rows. Nothing is hidden — what folds is the width the
   Remarks are said in and never their voice. */
@media (--two-columns) {
  .bench {
    grid-template-areas:
      'rail said'
      'rail document';
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .said {
    overflow-y: visible;
    padding: var(--s3) var(--s4) 0;
  }
}

/* The bench's own acts, on the Story's edge. */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

/* At the width of a phone they are a strip that winds sideways rather than a row
   that wraps into two: every one of them stays drawn, so the bar of Commands
   reaches them all — see
   `docs/adr/0042-the-scene-is-written-where-it-stands.md`. */
@media (--phone) {
  .tools {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    min-inline-size: 0;
    overflow-x: auto;
    padding-block-end: 2px;
  }

  .tools > * {
    flex: none;
  }
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

/* The bench with nothing on it: a note where the document would be, and the one
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
