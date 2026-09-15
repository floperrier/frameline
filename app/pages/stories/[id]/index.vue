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

/**
 * Which Scene's section of the document the refusal on screen is drawn in, and
 * nothing where it belongs to the Story rather than to a Scene. The document holds
 * every Scene now, so a sentence about a Shot has a Scene to be said against and
 * the writing surface says which one; what the Story's own edge is refused — a
 * title, a Publish — belongs under that edge, where this page draws it.
 */
const refusedIn = ref<string>()

/**
 * The name of the Scene the refusal on screen is about, which is how the sentence
 * says which Scene it concerns now that it is not drawn against it. Nothing while
 * the refusal belongs to the Story's own edge, and nothing while the Scene it was
 * about has gone from under it.
 *
 * Nothing either while the name is blank, which is the one reading where naming it
 * would be worse than not: the field writes through the Story as it is typed, so a
 * name emptied and left is a Scene the sentence would introduce as “ ”. Unnamed,
 * the sentence falls back to what an act about the whole Story says, and the
 * Author is looking at the empty field anyway.
 *
 * Otherwise the name is the one the bench calls the Scene by, `namesOnTheBench`,
 * because the sentence is a control of the bench naming a Scene and every one of
 * those is named off that map — see
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`. That map reads
 * the Story as the field wrote it, so a name typed and refused is still the word
 * under the Author's hand; it is numbered only where another Scene already carries
 * it, and then the number is what says which of the two was refused.
 */
const names = computed(() =>
  (story.value ? namesOnTheBench(story.value, t) : new Map<string, string>()))
const refusedScene = computed(() => {
  const scene = story.value?.scenes.find(scene => scene.id === refusedIn.value)

  return scene?.name.trim() ? names.value.get(scene.id) : undefined
})

/**
 * The two holders the Story's own edge writes through, which are the page's own
 * with the Scene the last refusal was drawn in cleared on the way past: an act
 * about the whole Story cannot be refused in somebody's section of the document.
 *
 * The Contact Sheet writes through them too, for the same reason read the other
 * way round: the one field it carries is about a Shot, but no section of the
 * document is on screen while the sheet is, so a refusal claimed for a Scene would
 * be a sentence said behind a surface nobody is looking at. Cleared, it is said
 * under the Story's edge, where it is on screen whichever reading is up.
 */
const changeStory: Change = (act) => {
  refusedIn.value = undefined

  return change(act)
}

const writeStory: Write = (act) => {
  refusedIn.value = undefined

  return write(act)
}

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
 * The three readings of the one document, in the order an Author moves through
 * them: the writing, where a Story is written; the Contact Sheet, where it is
 * seen rather than read; and the Preview, where it is read on the engine a Reader
 * runs. The rail and the Remarks do not move between them — what changes is what
 * the middle is a reading of, never where anything is. See
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which keeps `0030`'s
 * engine rule and supersedes its *beside*.
 */
type Reading = 'writing' | 'sheet' | 'preview'

/**
 * Which of the three the middle of the bench is showing. The writing is what the
 * server renders, so the bench arrives on the reading it is for and neither of the
 * other two costs a byte until it is asked for.
 */
const reading = ref<Reading>('writing')

/**
 * Puts the caret in one Scene, leaving the middle of the bench on the reading it
 * was showing: a mark pressed on the rail while the Story is being read is the
 * Author reading on, not asking to write. A Remark is the same press — it stands
 * beside every reading too, so it leads to its Scene by this act rather than by a
 * second navigation of the bench. The address is replaced rather than pushed,
 * because a back that walked the Author through every mark they had pressed would
 * never leave the Story.
 *
 * Where the caret lands when the address moves is settled here and in none of the
 * surfaces that reach this act, so that all of them agree on it: the rail's mark,
 * the bar of Commands pressing that mark by name, a Remark, a mark on a band of
 * the Contact Sheet. It lands in the Scene's own name — the first field of its
 * section, and the word an Author who has just gone somewhere is about to type,
 * which is the answer `writeScene` already gave for the one gesture that had one.
 *
 * The other two readings lay out no name of that Scene to land it in. The writing
 * is `display: none` behind them, and its name field is still in the document
 * there — mounted and not laid out — so it is asked for only while the writing is
 * up: focus sent into a box nothing laid out moves nothing and says nothing, and a
 * caret blurred below and then sent there would be a caret left on `<body>`. What
 * keeps the caret out of the drawing on those readings is the drawing itself,
 * which refuses a press its own focus — see `app/components/Graph.vue` and #265,
 * where a mark pressed on the rail was leaving the caret inside the subtree
 * `aria-hidden` takes out of the accessibility tree.
 *
 * So the bench says where it went where nothing took the caret, and stays quiet
 * where something did. `0043` made *Go to* a scroll rather than an opening, and a
 * scroll is a thing the eye follows and nothing else does: the bar of Commands
 * closes, focus goes back to the control that opened it, and the caret has moved
 * Scenes with nobody told — which is what the sentence is for, in the words the
 * writing surface is named by. A field that has just taken the focus announces the
 * Scene under its own name, and a second sentence over that is the bench talking
 * over itself.
 *
 * Asking for the Scene the caret is already in winds the reading on screen to it
 * and takes the caret nowhere: the surface scrolls under it, so an Author who read
 * their way down the Story and then asked for the Scene they are writing has asked
 * to be taken back to it — and one who asked from halfway through a beat has not
 * asked to be lifted out of the word they were typing and put in the name. The
 * address does not change, so nothing is said out loud either: arriving where you
 * already were is not news.
 *
 * What a press does either way is end the typing it interrupted. A field writes
 * what is in it when the caret leaves it, and the mark refuses a press its own
 * focus (#265) — so the two gestures that take no caret away, the Scene under the
 * caret asked for by its own mark and a Scene whose name is being typed in asked
 * for from somewhere else, would each leave a name standing on the screen and on
 * the mark over a Story that never held it. The field is given that blur by hand,
 * which is what the press would have done had it been allowed to land in a drawing
 * nothing announces, and the caret then owed a landing. Where the address does
 * not move it is put straight back. Where it moves on the Contact Sheet, the field
 * it was in is the sheet's one field, the Description of the Shot under the hand —
 * and the wind has just turned that detail to the Scene gone to, so the box the
 * caret left is either gone or describing another Shot. The caret goes onto the
 * first frame of the band the sheet was wound to, which is what the sheet lays out
 * of that Scene, is named by it, and chooses itself as it takes the focus — so the
 * detail and the caret agree. A field and nothing wider: focus stands on a control
 * as often as in a field — a frame is such a button — and a control has nothing
 * typed in it to end, so a caret on one is left there and told where the address
 * went.
 *
 * Only the name is let scroll into view as it takes the focus, because the wind is
 * on its way there anyway. Everything else is focused with the scroll held: the
 * wind above has just said where the surface is to stand, and a browser brings
 * what it focuses into view — which on a Scene longer than the screen would scroll
 * the wind straight back off it.
 */
async function goToScene(sceneId: string) {
  const moving = sceneWritten.value?.id !== sceneId
  if (moving) await router.replace({ query: { ...route.query, scene: sceneId } })
  else windOn('auto')

  await nextTick()
  const named = reading.value === 'writing'
    ? document.getElementById(`scene-name-${sceneId}`) as HTMLInputElement | null
    : null
  const framed = reading.value === 'sheet'
    ? document.querySelector<HTMLElement>(`[data-band="${CSS.escape(sceneId)}"] .frames button`)
    : null
  const typing = document.querySelector<HTMLElement>('input:focus, textarea:focus')
  const landing = moving ? named ?? (typing && framed) : null
  const lands = landing ?? typing

  typing?.blur()
  lands?.focus({ preventScroll: landing !== named })
  if (moving && !landing) {
    announce(t('editor.writingScene', { name: names.value.get(sceneId) ?? '' }))
  }

  return named
}

/**
 * The reading on screen wound to the Scene the address names. The whole Story is
 * on the bench, so going to a Scene is a scroll rather than an opening — which is
 * what `docs/adr/0043-a-story-is-written-as-one-document.md` says *Go to* now
 * means.
 *
 * Which surface is scrolled is asked of `reading` and not assumed, because the
 * middle of the bench holds three readings of the one document and lays out
 * exactly one of them at a time: the writing goes `display: none` behind the other
 * two, and `scrollIntoView` on a box that is not laid out moves nothing and says
 * nothing. A winder that always addressed the document was therefore wrong by
 * construction wherever the Author was not in the document — so it asks the
 * reading that is up where that Scene stands in it: the document's own section, or
 * the sheet's band.
 *
 * Every way of going to a Scene routes through here — the rail's mark, the bar of
 * Commands, a Remark, a way on pressed in the Preview and a band's own mark — so
 * there is one answer to *where is that Scene on this surface* rather than one per
 * reading to keep in step.
 *
 * The Preview is the reading with no box to wind to: it draws the Scene the Reading
 * is standing on and nothing else, so arriving at a Scene there is the Reading
 * moving and never a scroll. Nothing is looked for and nothing happens.
 *
 * `scrollIntoView` rather than arithmetic on the box's offset: the room to leave
 * above it is `scroll-margin-block-start` on the box itself, said once in the units
 * that surface's own padding is written in. Smoothness is the stylesheet's, where
 * the answer to `prefers-reduced-motion` is given once, per scroller.
 *
 * It walks every scrollable ancestor, so a wind moves only what is there to move:
 * the bench is a window tall and the window has nothing to scroll, which
 * `tests/e2e/sheet-signed-in.spec.ts` holds it to. That is all this can promise:
 * the gestures that call it move focus too, and a browser brings what it focuses
 * into view.
 *
 * Callers rather than one immediate watch, and they arrive differently. The first
 * sight of a reading is a reload coming back to an address, or a turn onto a
 * surface that was not there a moment ago, and winding it past the Author before
 * they can read anything says nothing and takes half a second — so those are
 * instant. A Scene reached afterwards is a move they made, and the reading follows
 * it — asked for as `auto`, which is the one value that defers to
 * `scroll-behavior`, so the reduced-motion blocks are the single answer rather than
 * a rule an explicit `smooth` would walk past. `instant` is where this overrides
 * it.
 */
/** The frame the Author chose on the Contact Sheet, which `windOn` lets go of. */
const chosenFrame = ref<string>()

function windOn(behavior: ScrollBehavior) {
  const scene = sceneWritten.value?.id
  if (!scene) return

  // The sheet lets its chosen frame go here rather than on a change of address,
  // because asking for the Scene the caret is already in winds without changing
  // one. Left to the sheet, the bands would scroll to the Scene asked for while
  // the detail, the one tab stop among the frames and the marks in the tab order
  // all stayed on a band thirty down — and the first `Tab` would undo the wind.
  chosenFrame.value = undefined

  if (reading.value === 'preview') return

  const stands = reading.value === 'sheet'
    ? document.querySelector(`[data-band="${CSS.escape(scene)}"]`)
    : document.getElementById(`scene-${scene}`)

  stands?.scrollIntoView({ behavior, block: 'start' })
}

onMounted(() => windOn('instant'))
watch(() => sceneWritten.value?.id, async () => {
  await nextTick()
  windOn('auto')
})

/**
 * The writing left where the hands are when the sentence a refusal is said in takes
 * its room. The band stands in the column's furniture rather than in the document,
 * which is what keeps it off the writing — and the price of standing there is that
 * the head of the scroller moves down as it arrives and every row of the document
 * goes down with it. The browser's own scroll anchoring answers for what changes
 * inside a scroller and never for the scroller's own box, so the distance the head
 * moved is wound back on here: the same correction, made by hand.
 *
 * Measured off the head of the scroller rather than off the band, because the room
 * the band takes is not its height alone — a Scene renamed under its own refusal
 * rewrites the sentence that names it, and the sentence rewraps — and the head is
 * the one number that says how far the writing was pushed whatever pushed it. What
 * it does not answer for is a window resized while the sentence is up, which
 * rewraps it with no render to watch; that is a resize and not a typing hand.
 *
 * `instant` because the scroller is smooth by stylesheet, and a correction the
 * Author can watch travel is the movement this exists to prevent.
 */
const scroller = useTemplateRef('scroller')

watch(() => [refusedIn.value, refusedScene.value, problem.value], async () => {
  const head = scroller.value?.getBoundingClientRect().top
  await nextTick()
  const moved = (scroller.value?.getBoundingClientRect().top ?? 0) - (head ?? 0)

  if (moved) scroller.value?.scrollBy({ top: moved, behavior: 'instant' })
})

/**
 * Puts the caret in one Scene to write it: the same as going there, with the
 * middle of the bench turned back to the writing first — which is what lays the
 * Scene's name out to be focused at all — and the name selected where the Scene
 * arrived under a provisional name, so the first thing typed replaces it. This is
 * what a way on's own mark opens, and what a Scene written from nothing arrives
 * in.
 *
 * The name is focused here rather than left to the act above, which lands the
 * caret where the address moved and nowhere else: the first Scene of a Story is
 * the one the address already names as it arrives, and writing it is the whole of
 * what was asked for.
 */
async function writeScene(sceneId: string, naming = false) {
  reading.value = 'writing'

  const named = await goToScene(sceneId)
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

  await changeStory(async () => {
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
 * Where the Reading the Preview replays has got to. The bench holds it, above
 * the document, because the middle of the bench holds one reading at a time: a
 * Path held inside the reading would be drawn afresh every time the Author
 * turned back to it, and a Preview that redraws its seed each time it is looked
 * at is not replaying a Path — see #247 and
 * `docs/adr/0043-a-story-is-written-as-one-document.md`.
 *
 * It opens at `UNDRAWN` and the seed is drawn once the bench is in the browser
 * it will stay in. The server renders the bench whole, and a seed drawn there
 * and drawn again here would be two different Stories either side of hydration —
 * `docs/adr/0024-the-seed-belongs-to-the-position.md`.
 *
 * A `ref` and nothing more: the bench keeps no Reading across sessions, so a
 * reload starts the Story over. An Author is testing rather than reading, and a
 * Preview that reopened mid-Story would be a bench remembering what they have
 * stopped meaning — `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`.
 */
const at = ref<Path>(UNDRAWN)

onMounted(() => {
  at.value = opening()
})

/**
 * What each reading is offered under: what pressing it does, rather than which
 * reading is up — so the control and the Command that runs it are one sentence.
 */
const faceSays = computed<Record<Reading, string>>(() => ({
  writing: t('editor.writeTheScene'),
  sheet: t('editor.seeTheContactSheet'),
  preview: t('editor.readTheStory'),
}))

/**
 * Whatever in the writing last took focus: a beat, a Scene's own name, one of the
 * marks a row carries. Recorded as focus moves through the document rather than
 * read when the turn is asked for, because the turn is an act of the bar of
 * Commands as well as a control, and focus stands on the bar while the bar is up.
 */
let caret: HTMLElement | undefined

function focusedIn(event: FocusEvent) {
  if (reading.value === 'writing') caret = event.target as HTMLElement
}

/**
 * Whether the caret is one to put back rather than a note the address has moved
 * out from under: still in the document, and in the section of the Scene the
 * address names. Read off the document by the `data-scene` each section carries,
 * so there is nothing kept here to fall out of step with where the Author is.
 */
function inSceneWritten(held: HTMLElement) {
  return held.isConnected
    && held.closest<HTMLElement>('[data-scene]')?.dataset.scene === sceneWritten.value?.id
}

/**
 * The middle of the bench turned onto one of the other two readings. Focus stays
 * on the control on the way out of the writing, because the writing that goes dark
 * takes whatever was focused inside it with it and the reading that arrives has
 * nothing that has just been left.
 *
 * Whichever reading arrives, it arrives wound to the Scene the address names: a
 * surface that was not laid out a moment ago has never been scrolled, and an Author
 * turning the bench over has not moved in the Story. That is one act for the three
 * of them rather than a winder of its own inside each, which is what left the
 * Contact Sheet holding the only copy that worked.
 *
 * Coming back to the writing, it goes to the beat the Author left instead — where
 * that beat is still in the Scene the address names. The caret is a variable of
 * this page, and what makes it go stale is the one thing this turn is about: while
 * one of the other two readings is up, the writing lays out no field for `goToScene`
 * to land the caret in, so the rail's mark, the bar of Commands, a Remark, a mark on
 * a band of the Contact Sheet and a way on pressed in the reading all move the
 * address with the caret left standing where the Author last typed. Put back, it
 * would take them — and the next word they type — into the Scene they left. There is
 * one notion of where the Author is and it is the Path, so anything the address does
 * not answer to is wound to instead — as is a Story opened and turned over without a
 * word typed into it, which has no beat to come back to at all.
 *
 * The writing is never taken out of the document — the reading takes its place in
 * front of it — so a beat that is still the right one holds the caret it held, and
 * the focus the browser dropped when the field went dark is the whole of what has
 * to be put back.
 */
async function turnTo(turn: Reading, event: Event) {
  reading.value = turn
  ;(event.currentTarget as HTMLElement).focus()

  await nextTick()
  if (turn === 'writing' && caret && inSceneWritten(caret)) caret.focus()
  else windOn('instant')
}
</script>

<template>
  <main @dragover="refuseDrop" @drop="refuseDrop">
    <StoryHeader
      :id="id"
      :story="story ?? undefined"
      :kept-at="keptAt"
      :change="changeStory"
      :write="writeStory"
    >
      <!-- The bench's own acts, on the Story's own edge: the way into every act
           by naming it, and the two readings the middle of the bench is not
           showing. Three controls, because the document under them is what the
           screen is for — the Remarks left this row for a region of their own
           beside the document, see
           `docs/adr/0043-a-story-is-written-as-one-document.md`. -->
      <div class="tools">
        <!-- The key does the same thing as the control, drawn on the control where
             somebody who never reads a legend will find it — see
             `docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`. -->
        <button type="button" class="commanding" @click="commanding = true">
          {{ $t('editor.commands') }}
          <span class="combination"><kbd>{{ modifier }}</kbd><kbd>K</kbd></span>
        </button>

        <!-- The two readings the middle is not showing, each named for what
             pressing it does, and standing in the order the three readings are
             read in — so the way back to the writing is the same control in the
             same place from either of the other two. Written out rather than
             looped, because the mark the guided path resolves by has to be a
             literal in the template for the spec that reads the template as
             source to find it once and only once. -->
        <template v-if="sceneWritten">
          <button
            v-if="reading !== 'writing'"
            type="button"
            :data-command="faceSays.writing"
            @click="turnTo('writing', $event)"
          >
            {{ faceSays.writing }}
          </button>

          <button
            v-if="reading !== 'sheet'"
            type="button"
            :data-command="faceSays.sheet"
            @click="turnTo('sheet', $event)"
          >
            {{ faceSays.sheet }}
          </button>

          <!-- `data-step` is here rather than on the reading itself: the guided
               path sends an Author to read why a Shot is not playing, and the
               turn is the gesture it has to point at — see
               `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. -->
          <button
            v-if="reading !== 'preview'"
            type="button"
            data-step="reading"
            :data-command="faceSays.preview"
            @click="turnTo('preview', $event)"
          >
            {{ faceSays.preview }}
          </button>
        </template>
      </div>
    </StoryHeader>

    <!-- Why the last change was refused, where it is about the Story rather than
         about a Scene of it. A refusal a Scene can be named for is drawn in that
         Scene's own section of the document instead, which is where the Author was
         typing when it arrived. -->
    <Refusal v-if="!refusedIn" :problem="problem" />
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
         and the side the bench says what it read back on. Nothing covers anything
         and nothing is made `inert`: what folds is the width the Remarks are said
         in and never their voice. The one thing here that is `display: none` is
         the writing while one of the other two readings is up, which is not a fold
         at all — the three readings are three faces of one column and only one of
         them is on at a time. See
         `docs/adr/0043-a-story-is-written-as-one-document.md`. -->
    <div v-else-if="story" class="bench">
      <!-- The Graph drawn small, and it never grows: 120 pixels at every width,
           narrowing to a strip of dots on a phone. -->
      <Graph
        :story="story"
        :scene-written="sceneWritten?.id"
        @write-scene="goToScene"
      />

      <!-- The middle of the bench: what the bench has to say about the reading in
           it, and under that the reading. The name is the page's own word for this
           region — `.column` is the Graph's, for the columns it draws a Story in. -->
      <div class="middle">
        <!-- Why the last change in one Scene of the document was refused. Said
             above the reading rather than inside it, and naming the Scene it is
             about rather than standing on it — `.refused` says why that is not a
             choice. -->
        <Refusal
          v-if="refusedIn"
          class="refused"
          :problem="problem"
          :scene="refusedScene"
        />

        <!-- The one of the three regions that scrolls. Which reading it holds is
             the page's to say; where it is, is not. The Contact Sheet fills it and
             scrolls its bands inside itself, so this scrollbar belongs to the
             writing and to the Preview. -->
        <div ref="scroller" class="document" @focusin="focusedIn">
          <!-- There is one notion of where the Author is and it is the Path, so a
               way on pressed in the reading moves the writing with it — see
               `docs/adr/0030-a-story-is-read-where-it-is-written.md`, whose engine
               rule `0043` keeps. -->
          <Preview
            v-if="reading === 'preview' && sceneWritten"
            v-model:at="at"
            :story="story"
            :scene-written="sceneWritten.id"
            :change="changeStory"
            @moved="follow"
          />

          <!-- The Story seen rather than read: every Shot of every Scene as the
               Image it carries. Taken out of the document when it is not the
               reading on screen rather than left dark like the writing, because
               every frame of it is an image the browser would go and fetch: a Story
               of forty Scenes drawn whole is the heaviest thing this product
               renders, and nothing on the sheet is a caret that has to be found
               again. -->
          <ContactSheet
            v-else-if="reading === 'sheet'"
            :story="story"
            v-model:chosen="chosenFrame"
            :scene-written="sceneWritten?.id"
            :write="writeStory"
            :image-of="imageOf"
            @open="goToScene"
          />

          <!-- The whole Story as one document, every Scene of it written where it
               stands: there is no one Scene to put on a bench first, because the
               bench is the document. It goes dark while one of the other two
               readings is up rather than out of the document, so the beat the caret
               was left on is still the beat it is on when the Author turns back —
               see `turnTo`. -->
          <Writing
            v-show="reading === 'writing'"
            v-model:refused-in="refusedIn"
            :story="story"
            :scene-written="sceneWritten?.id"
            :change="change"
            :write="write"
            :ask="ask"
            :announce="announce"
            :image-of="imageOf"
            @attached="attachedAt[$event] = Date.now()"
            @open="writeScene"
          />
        </div>
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

        <!-- What the bench noticed, less whatever the reading in the middle is
             already saying in the Scene's own words: the nearer voice wins, which
             is why the Remarks are told which reading is up. A Remark leads to its
             Scene by the rail's own press — the act that already exists — so the
             reading the Author is on stays up. See
             `docs/adr/0032-the-bench-reads-the-story-back.md`. -->
        <Remarks
          :story="story"
          :scene-written="sceneWritten?.id"
          :previewed="reading === 'preview'"
          @open="goToScene"
        />
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

/* The middle of the bench: the scroller, and above it the furniture the bench puts
   over the reading rather than in it. It takes the grid's room and hands the
   scroller everything the furniture leaves. */
.middle {
  grid-area: document;
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  min-block-size: 0;
}

/* The sentence a refusal about one Scene is said in, and the whole of what that
   furniture is. Five things were asked of it, and four rounds of this branch spent
   themselves discovering that a band inside the scroller can hold four: readable
   wherever in the Scene the Author is working, over no control, taking the pointer
   like anything else on the bench, never outside the window, and moving nothing
   under a typing hand.

   Inside the scroller the first and the second are the two halves of a choice. In
   the flow at the foot of its slate the sentence is wound off the screen the moment
   the Author is a row below it; stuck to the head of the scroller it is read
   everywhere and it is drawn over whatever row the head of the scroller holds,
   which at the wind the issue names is the row of Flags the refusal is about. No
   inset moves it off the writing, because every inset lands it on the row an inset
   further down. Letting the press through is not a third way out: an opaque band
   that answers no pointer hands the press to the row it is hiding, which is how the
   round before this one deleted a Flag from a click on the door.

   Out here it covers nothing, because there is nothing under it to cover: the
   scroller starts where the sentence ends. Which is what costs the geometry the
   one thing it was carrying — *against the Scene it concerns* — and what the words
   take back, `error.inScene` naming the Scene the way every other sentence on the
   bench names one. The Story's own edge refuses above the bench, about no Scene and
   naming none.

   `tests/e2e/scenes-signed-in.spec.ts` drives all five, over the range rather than
   at the wind and the width the defect was read at: what the sentence stands on,
   what the door does under a real mouse press, whether the band is whole in the
   window, and what moves under the hands. */
/* Out of the scroller, so it covers nothing — and capped, because what it stopped
   taking from the length of the document it would otherwise take from its height.
   Measured before the cap: a Scene named to the two hundred characters the API
   allows left a document of sixty-four pixels at 320 wide and of none at all at
   390 × 400, where the band then ran past the foot of the window. Six lines is more
   than any refusal this product writes needs, and a seventh scrolls. */
.refused {
  margin: var(--s4) var(--s4) 0;
  max-block-size: 6lh;
  overflow-y: auto;
}

/* The scroller the middle of the bench holds, and the only one the layout has: the
   document is what the window is for at every width. The Contact Sheet takes the
   whole of it and scrolls its own bands inside itself, which leaves this one with
   nothing to do while that reading is up. Wound to the Scene the address names —
   smoothly when the Author asked for the move, and instantly on the first sight of
   the bench, which `windOn` says. The answer to `prefers-reduced-motion` is given
   once, here, rather than at each call. */
.document {
  flex: 1;
  min-block-size: 0;
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
    /* Room for the focus ring, which is drawn outside a control and clipped by a
       scroller whose content is flush with it: two pixels of line and two of
       offset. */
    padding-block-end: var(--s1);
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
