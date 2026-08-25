<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
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

/**
 * The time of the last write, told the way a clock is read in the Locale rather
 * than in the Story's own Language: this is the bench talking about itself. There
 * is no date on it because there is no session long enough to need one — what an
 * Author wants from it is that the last thing they typed went somewhere.
 */
const kept = computed(() => keptAt.value && new Intl.DateTimeFormat(
  locale.value, { timeStyle: 'short' }).format(keptAt.value))

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

/**
 * The ways on leaving one Scene, in the Places it numbers them at. Taken by id
 * rather than by the Scene, because the disc drawn on a Cut's line asks this too
 * and it has only the id the Cut carries: one answer, so the number in the node
 * and the number on the bench cannot say two different things.
 */
function cutsFrom(sceneId: string) {
  return story.value?.cuts.filter(cut => cut.fromSceneId === sceneId) ?? []
}

/**
 * The ways in arriving at one Scene — the counterpart of `cutsFrom`, and drawn
 * from the same list, because the schema cascades a delete from both ends of a
 * Cut and only one end was ever counted. In no Place: a Cut is numbered among
 * the ways on leaving the Scene it departs, and the Scene it arrives at has no
 * say in that order.
 */
function cutsInto(sceneId: string) {
  return story.value?.cuts.filter(cut => cut.toSceneId === sceneId) ?? []
}

/**
 * What the bench has just done, said once and gone: a Scene created, a Cut
 * drawn, a gesture begun or abandoned. One live region for the page rather than
 * one per thing announced, because two of them in the same corner would talk
 * over each other and be read out of order.
 */
const { message: announced, show: announce } = useToast()

function createScene() {
  const name = newSceneName.value
  return change(async () => {
    await send(`/api/stories/${id}/scenes`, { method: 'POST', body: { name } })
    newSceneName.value = ''
    announce(t('editor.sceneCreated', { name }))
  })
}

/**
 * `1 Shot` and `2 Shots`: a folded node counts them, and a Delete asks about
 * them. One phrase a count rather than a suffix on a noun, because a plural is
 * not a letter added in every language the interface is read in.
 */
function countedShots(many: number) {
  return t(many === 1 ? 'editor.oneShot' : 'editor.manyShots', { count: many })
}

function countedCuts(many: number) {
  return t(many === 1 ? 'editor.oneCut' : 'editor.manyCuts', { count: many })
}

/**
 * A Scene goes with its Shots and with the Cuts at both of its ends, and the
 * Author named none of them, so it is asked about and all three are counted
 * separately — the ways in were destroyed uncounted before. See
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`.
 */
async function deleteScene(scene: Scene) {
  const named = {
    name: scene.name,
    shots: countedShots(scene.shots.length),
    waysOn: countedCuts(cutsFrom(scene.id).length),
    waysIn: countedCuts(cutsInto(scene.id).length),
  }
  const asking = t('editor.confirmDeleteScene', named)
  if (!await ask(asking, t('editor.deleteScene'))) return
  return change(() => send(`/api/scenes/${scene.id}`, { method: 'DELETE' }))
}

/**
 * Writes the name the Author corrected, when they leave the field. The placement
 * goes with it because the endpoint takes the node whole, and it is the placement
 * already on screen — the name is the only half that has changed.
 */
function renameScene(scene: Scene) {
  return write(() => send(`/api/scenes/${scene.id}`, {
    method: 'PATCH',
    body: { name: scene.name, x: scene.x, y: scene.y },
  }))
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
  return write(() => send(`/api/shots/${shot.id}`, {
    method: 'PATCH',
    body: { text: shot.text, description: shot.description },
  }))
}

/**
 * Writes a whole sequence of Places, which is the only way one is written: the
 * ids of everything the Scene numbers, in the order they are now in.
 */
function renumber(scene: Scene, what: 'shots' | 'cuts', places: string[]) {
  return change(
    () => send(`/api/scenes/${scene.id}/${what}/places`, { method: 'PUT', body: { places } }),
  )
}

/**
 * The sequence with one id moved a Place, which is what the two controls that
 * move a thing earlier or later send. Each is disabled at the end it cannot move
 * past, so the Place swapped with is always one of the sequence's own.
 */
function movedBy(ids: string[], id: string, step: -1 | 1) {
  const from = ids.indexOf(id)
  const moved = [...ids]
  moved[from] = ids[from + step]!
  moved[from + step] = id

  return moved
}

function moveShot(scene: Scene, shot: Shot, step: -1 | 1) {
  return renumber(scene, 'shots', movedBy(scene.shots.map(held => held.id), shot.id, step))
}

/**
 * The Shot being dragged by its number, and the Shot the hand is over. Held by
 * Shot id and not by the Shot, the same trap the other gestures on this page
 * avoid: a read landing mid-drag replaces every Scene in the Story, and the hand
 * would be holding a Shot that is no longer the one on screen.
 *
 * ponytail: the run does not scroll itself when the drag reaches the end of what
 * is on screen, so a Shot travels no further than the Author can already see.
 * Give the drag an auto-scroll at the edge the day a Scene of fifteen Shots asks
 * for one.
 */
const draggedShot = ref<{ shotId: string, over?: string }>()

function startShotDrag(shot: Shot, event: PointerEvent) {
  // A finger scrolls the node instead. The two controls move a Shot a Place
  // without a drag, so touch keeps the whole route and loses only the shortcut —
  // and taking the scroll off a node full of writing would cost it more.
  if (event.pointerType === 'touch') return

  // Capturing the pointer sends the rest of the gesture to the number itself, so
  // the hand can leave it for the Shot it is aiming at.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  draggedShot.value = { shotId: shot.id }
}

function keepShotDrag(event: PointerEvent) {
  if (draggedShot.value) draggedShot.value.over = rowUnder(event, 'shot')
}

function endShotDrag(scene: Scene) {
  const dragged = draggedShot.value
  draggedShot.value = undefined
  if (!dragged?.over || dragged.over === dragged.shotId) return

  const places = movedInto(scene.shots.map(held => held.id), dragged.shotId, dragged.over)
  if (!places) return

  return renumber(scene, 'shots', places)
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

/**
 * The surface the nodes are laid out on, which is what a pointer's position has
 * to be read against: the bench scrolls, so where the hand is on the screen is
 * not where it is on the Graph.
 */
const surface = useTemplateRef<HTMLElement>('surface')

/**
 * The Cut being drawn by hand, held while the gesture is live and nothing
 * otherwise. `landsOn` is worked out once, when the gesture begins: it depends
 * on the departing Scene and the Cuts already leaving it, and neither changes
 * under the Author's hand — see `docs/adr/0015-a-cut-is-drawn-by-hand.md`. `at`
 * is where the hand has reached on the surface, and `over` the Scene it is over,
 * neither of which the keyboard route has until a pointer moves.
 *
 * Held by Scene id and never by the Scene, the same trap the drag that moves a
 * node avoids: a read landing mid-gesture replaces every Scene in the Story, and
 * a gesture holding the old object would go on aiming from a Scene nothing draws.
 */
const aiming = ref<{
  fromSceneId: string
  landsOn: Set<string>
  at?: Point
  over?: string
}>()

/**
 * The line under the Author's hand. Drawn from the edge of the node it leaves to
 * the point the hand has reached — and not at all until the hand has moved, so
 * the keyboard route enters the same aiming without a line pinned to the origin.
 */
const drawnLine = computed(() => {
  const aimed = aiming.value
  if (!aimed?.at || !sceneById(aimed.fromSceneId)) return

  return cutLineTo(boxOf(aimed.fromSceneId), aimed.at)
})

/**
 * Whether the line would land where it is. The arrowhead is what says "this will
 * land", so over a Scene that cannot take the Cut it is taken off — said before
 * the Author lets go rather than after. Over the bare bench the head stays: there
 * is nothing there to refuse it.
 */
const landing = computed(
  () => !aiming.value?.over || aiming.value.landsOn.has(aiming.value.over))

/**
 * Begins the aiming, from either way in. The pointer and the hidden button enter
 * this one state rather than two that have to be kept in agreement.
 */
function aimFrom(scene: Scene) {
  aiming.value = {
    fromSceneId: scene.id,
    landsOn: scenesACutMayLandOn(story.value?.scenes ?? [], story.value?.cuts ?? [], scene.id),
  }
  announce(t('editor.aimingFrom', { name: scene.name }))
}

function startAiming(scene: Scene, event: PointerEvent) {
  // Capturing the pointer sends the rest of the gesture to the strip itself, so
  // the line goes on following a hand that has left the node it started on.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  aimFrom(scene)
}

function keepAiming(event: PointerEvent) {
  if (!aiming.value) return
  const on = surface.value!.getBoundingClientRect()
  aiming.value.at = { x: event.clientX - on.left, y: event.clientY - on.top }
  aiming.value.over = sceneUnder(event)
}

function endAiming(event: PointerEvent) {
  return landOn(sceneUnder(event), onTheBench(event))
}

/**
 * Whether the hand let go on the bench at all. Pointer capture keeps the line
 * following a hand that has left the graph entirely — over the form at the top of
 * the page, over the toast — and a drop up there is a gesture abandoned rather
 * than a Scene written at the corner of a bench the hand never reached.
 */
function onTheBench(event: PointerEvent) {
  return !!document.elementFromPoint(event.clientX, event.clientY)?.closest('.graph')
}

/**
 * Which Scene's node the hand is over, asked of the page rather than worked out
 * from the placements: the boxes are really there, one may be over another, and
 * the browser already hit-tests them. Pointer capture sends the events to the
 * strip but leaves what is under the hand alone, which is what makes this the
 * answer to both "light this one up" and "land here".
 */
function sceneUnder(event: PointerEvent) {
  const under = document.elementFromPoint(event.clientX, event.clientY)
  return (under?.closest('[data-scene]') as HTMLElement | null)?.dataset.scene
}

/**
 * Draws the Cut where the gesture landed, or lets it go where it landed on a
 * Scene it may not land on — one it already reaches, or the one it left. Landing
 * on the bare bench writes the Scene that was not there; landing off the bench, or
 * on nothing at all, which is the keyboard route abandoned, leaves the Story
 * exactly as it was.
 */
function landOn(sceneId: string | undefined, onBench = false) {
  const aimed = aiming.value
  aiming.value = undefined
  if (!aimed) return
  if (!sceneId) return onBench && aimed.at ? writeSceneAt(aimed.fromSceneId, aimed.at) : undefined
  if (!aimed.landsOn.has(sceneId)) return

  const said = {
    from: sceneNamed(sceneNames.value, aimed.fromSceneId, t),
    to: sceneNamed(sceneNames.value, sceneId, t),
  }

  return change(async () => {
    await send(`/api/scenes/${aimed.fromSceneId}/cuts`, {
      method: 'POST',
      body: { toSceneId: sceneId },
    })
    announce(t('editor.cutDrawn', said))
  })
}

/**
 * Writes the Scene a gesture landed on the bare bench, and the Cut to it. The
 * Scene goes where the hand let go, snapped to the bench's own pitch, and it
 * arrives under a provisional name with its node opened on that name in a field:
 * a name typed in the middle of a gesture could never be corrected, so the
 * gesture leaves the Author in the field that corrects it — see
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 *
 * The two writes are one change, so the bench reads the Story back once and finds
 * the Scene and the Cut in it together. They are not one transaction, and nothing
 * here pretends otherwise: a Cut refused after the Scene was written leaves the
 * Scene on the bench under its provisional name, which the Author can name or
 * delete — the same place a Scene written from the form at the top of the page
 * would have left them.
 */
async function writeSceneAt(fromSceneId: string, at: Point) {
  const name = t('editor.provisionalSceneName')
  const said = { from: sceneNamed(sceneNames.value, fromSceneId, t), to: name }
  let writtenId: string | undefined

  await change(async () => {
    const written = await send(`/api/stories/${id}/scenes`, {
      method: 'POST',
      body: { name, ...snappedWithinReach(at) },
    }) as Scene
    await send(`/api/scenes/${fromSceneId}/cuts`, {
      method: 'POST',
      body: { toSceneId: written.id },
    })

    writtenId = written.id
    opened.add(written.id)
    announce(t('editor.cutDrawn', said))
  })

  // After the read the change asks for and the render it causes, which is what
  // puts the field in the page at all. Selected rather than left with a cursor in
  // it: the name is provisional, so the first thing typed replaces it.
  if (!writtenId) return
  await nextTick()
  const naming = document.getElementById(`scene-name-${writtenId}`) as HTMLInputElement | null
  naming?.focus()
  naming?.select()
}

function abandonAiming() {
  if (!aiming.value) return
  aiming.value = undefined
  announce(t('editor.cutAbandoned'))
}

/**
 * The keyboard's way through the same aiming, on the one button each node hides
 * until it is focused. What it does is what the node is to the gesture: nothing
 * live, so begin from here; the Scene the line left, so let it go; a Scene the
 * Cut may land on, so land it there.
 */
function aimOrLand(scene: Scene) {
  if (!aiming.value) return aimFrom(scene)
  if (aiming.value.fromSceneId === scene.id) return abandonAiming()
  return landOn(scene.id)
}

/**
 * Whether the Cut being drawn may land on a node, which is the one question the
 * bench asks of every Scene while a gesture is live: it lights the node, quiets
 * the rest, and settles what the hidden button offers.
 */
function mayLandOn(scene: Scene) {
  return !!aiming.value?.landsOn.has(scene.id)
}

function aimingName(scene: Scene) {
  const aimed = aiming.value
  if (!aimed) return t('editor.drawCutFrom', { name: scene.name })

  const from = sceneNamed(sceneNames.value, aimed.fromSceneId, t)

  return aimed.fromSceneId === scene.id
    ? t('editor.abandonCutFrom', { name: from })
    : t('editor.cutFromTo', { from, to: scene.name })
}

/**
 * Escape lets go of whatever the bench is holding: the Cut being drawn, whichever
 * way in began it, and the panel a Cut is written in. Listened for on the document
 * because a gesture by pointer has focus nowhere in particular — the hand is on a
 * strip that is not a control — so there is no element to hang it on.
 */
function letGoOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  abandonAiming()
  closeCut()
}

onMounted(() => document.addEventListener('keydown', letGoOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', letGoOnEscape))

function moveCut(scene: Scene, cut: Cut, step: -1 | 1) {
  return renumber(scene, 'cuts', movedBy(cutsFrom(scene.id).map(held => held.id), cut.id, step))
}

function writeCut(cut: Cut) {
  return write(() => send(`/api/cuts/${cut.id}`, { method: 'PATCH', body: { text: cut.text } }))
}

/**
 * The Cut whose panel is open, and never more than one: a second panel would be
 * a second answer to "which Cut am I writing", and the two would sit over each
 * other on a bench where lines cross. Held by id, like every other thing the
 * bench holds across a read — a refetch replaces every Cut in the Story, and the
 * panel would otherwise be writing into an object nothing draws.
 *
 * Which panel is open is the Author's view of their own graph, so it is written
 * nowhere and lasts as long as the page.
 */
const openedCut = ref<string>()

/**
 * The panel as the page draws it: the Cut it writes, the two Scenes it names, and
 * where on the surface it opens — the middle of the Cut's own line, so it moves
 * with the nodes as the Author lays them out. Nothing at all when no line has
 * been pressed, or when the Cut it was on has since gone.
 */
const panel = computed(() => {
  const cut = story.value?.cuts.find(held => held.id === openedCut.value)
  if (!cut) return

  return {
    cut,
    from: sceneNamed(sceneNames.value, cut.fromSceneId, t),
    to: sceneNamed(sceneNames.value, cut.toSceneId, t),
    at: middleOfCut(cutLine(boxOf(cut.fromSceneId), boxOf(cut.toSceneId))),
  }
})

const cutText = useTemplateRef<HTMLInputElement>('cutText')

/**
 * Opens one Cut's panel, closing whichever was open, and closes this one again if
 * it was the one open. Focus goes into the text as the panel appears: pressed by
 * hand that is where the Author was going anyway, and reached from the strip it is
 * the whole point of the route — a panel nobody can type in is not one the
 * keyboard has reached.
 */
async function openCut(cutId: string) {
  if (openedCut.value === cutId) return closeCut()
  openedCut.value = cutId
  await nextTick()
  cutText.value?.focus()
}

/**
 * Closes the panel and puts focus back on the row of the strip it was opened
 * from, so the keyboard's way into a Cut is also its way out. A panel closed with
 * the pointer is closed by hand and leaves focus alone — see `closeOnBench`.
 */
function closeCut() {
  const closed = openedCut.value
  openedCut.value = undefined
  if (closed) document.getElementById(`way-${closed}`)?.focus()
}

/**
 * A press on the bare bench closes the panel. Anywhere that is not a node, the
 * panel itself or a Cut's own line is the bench — the line stops the press from
 * reaching here, so pressing one line while another's panel is open opens the
 * second rather than closing both.
 */
function closeOnBench(event: PointerEvent) {
  // An `Element` rather than an `HTMLElement`, because the drawing is SVG and a
  // press that reaches here may well have landed on it.
  const on = event.target as Element | null
  if (!on?.closest('article, .panel')) openedCut.value = undefined
}

/**
 * The way on being dragged within a Scene's strip, and the row the hand is over.
 * Held by Cut id and not by the Cut, the same trap the other two gestures avoid.
 */
const draggedWay = ref<{ cutId: string, over?: string }>()

/**
 * Whether the drag that has just ended renumbered anything. A row is pressed to
 * open a Cut and dragged to move it, so the click that follows a drag that moved
 * one has to be let go of: opening a panel on top of a renumbering is a second
 * answer to a gesture that already said what it meant.
 */
let renumberedByDrag = false

function startWayDrag(cut: Cut, event: PointerEvent) {
  // Capturing the pointer sends the rest of the gesture to the row itself, so the
  // hand can leave it for the row it is aiming at.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  draggedWay.value = { cutId: cut.id }
  renumberedByDrag = false
}

function keepWayDrag(event: PointerEvent) {
  if (draggedWay.value) draggedWay.value.over = rowUnder(event, 'way')
}

function endWayDrag(scene: Scene) {
  const dragged = draggedWay.value
  draggedWay.value = undefined
  if (!dragged?.over || dragged.over === dragged.cutId) return

  const places = movedInto(cutsFrom(scene.id).map(held => held.id), dragged.cutId, dragged.over)
  if (!places) return

  // Let go of over a stranger's row nothing was renumbered, so the press that
  // follows is the press it started as and the Cut's own panel opens.
  renumberedByDrag = true

  return renumber(scene, 'cuts', places)
}

/**
 * Which row of a numbered list the hand is over — a way on in a Scene's strip, or
 * a Shot in its run — asked of the page rather than worked out from the rows:
 * they are really there and the browser already hit-tests them, which is what
 * makes this the answer to both "light this row" and "drop here".
 */
function rowUnder(event: PointerEvent, what: 'way' | 'shot') {
  const under = document.elementFromPoint(event.clientX, event.clientY)
  return (under?.closest(`[data-${what}]`) as HTMLElement | null)?.dataset[what]
}

/**
 * The sequence with one thing dropped onto another's Place, or nothing where the
 * row under the hand is not one of this Scene's own: several nodes are open at
 * once, so a Shot can be let go of over another Scene's run, and the hit-test
 * that finds a row asks the whole page rather than one node. A stranger's Place
 * is not a Place here, and a sequence written around one is a numbering the
 * Author never aimed at — one the endpoint would take, because it is still a
 * permutation of what the Scene holds.
 *
 * Taken out of where it was and put back where the row under the hand stands,
 * which is the Place the Author aimed at. Everything between the two shifts by
 * one, so a thing dragged across four of them passes them rather than swapping
 * with the last.
 */
function movedInto(ids: string[], id: string, onto: string) {
  if (!ids.includes(onto)) return

  const moved = ids.filter(other => other !== id)
  const later = ids.indexOf(id) < ids.indexOf(onto)
  moved.splice(moved.indexOf(onto) + (later ? 1 : 0), 0, id)

  return moved
}

/**
 * What a press on a row of the strip does. A drag that renumbered ends in a click
 * too, and that one opens nothing.
 */
function pressWay(cut: Cut) {
  const dragged = renumberedByDrag
  renumberedByDrag = false
  if (!dragged) return openCut(cut.id)
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
  // Onto the fetched Scene as well as into the request, because the field is
  // drawn from what the Scene carries rather than bound to it: left alone, it
  // would go on showing the Flags the Author has just replaced. Writing them
  // here is also what keeps `courage=high` snapping to `courage = high`, which
  // used to be the refetch's doing.
  scene.sets = sets

  return write(() => send(`/api/scenes/${scene.id}/flags`, { method: 'PUT', body: { sets } }))
}

/**
 * Writes the whole list a Cut or a Shot carries, because that is what the
 * endpoint takes. `carrierId` is the Cut's or the Shot's, never the Story's,
 * which is what `id` means everywhere else here.
 */
function writeConditions(where: 'cuts' | 'shots', carrierId: string, carried: Condition[]) {
  return write(() => send(`/api/${where}/${carrierId}/conditions`, {
    method: 'PUT',
    body: { conditions: wholeConditions(carried) },
  }))
}

/**
 * A list of Conditions with the half-written rows left out. A row whose Flag has
 * no name is half a Condition, which the server is right to refuse, and dropping
 * it beats holding back the rest — a Condition taken off has to reach the Story
 * whatever else the Author is in the middle of typing.
 *
 * One function, because every route that sends a list sends it from a panel the
 * Author may be halfway through: the row they are still naming would otherwise
 * take the whole list down with it, and a Cut duplicated at that moment would
 * arrive carrying nothing.
 */
function wholeConditions(carried: Condition[]) {
  return carried.filter(condition => !('flag' in condition) || condition.flag.trim())
}

/**
 * Writes a second Cut to the same Scene, carrying the Conditions of the first.
 * The gesture that draws a Cut will not land on a Scene the departing one already
 * reaches, which is what keeps a slip of the hand from making an accidental
 * duplicate — but two Cuts to one Scene under opposite Conditions is what
 * Conditions on a Cut are for, so it is written on purpose from here: an Author
 * duplicates a Cut at the moment they mean to write its opposite Condition. See
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 *
 * The Conditions are copied and the text is not. The pair exists to be offered
 * under opposite tests, so the second is phrased from scratch, and the Condition
 * that makes it the opposite is the Author's next edit — in the duplicate's own
 * panel, which is theirs to open from the strip. This one stays on the Cut it was
 * duplicated from.
 *
 * The two writes are one change, and are not one transaction: Conditions refused
 * after the Cut was written leave a bare duplicate in the strip, which the Author
 * can go on writing or take away.
 */
function duplicateCut(cut: Cut) {
  const said = {
    from: sceneNamed(sceneNames.value, cut.fromSceneId, t),
    to: sceneNamed(sceneNames.value, cut.toSceneId, t),
  }
  const conditions = wholeConditions(cut.conditions)

  return change(async () => {
    const written = await send(`/api/scenes/${cut.fromSceneId}/cuts`, {
      method: 'POST',
      body: { toSceneId: cut.toSceneId },
    }) as Cut

    if (conditions.length) {
      await send(`/api/cuts/${written.id}/conditions`, { method: 'PUT', body: { conditions } })
    }

    announce(t('editor.cutDuplicated', said))
  })
}

/**
 * Takes a Cut away, from the panel it is written in. Nothing closes the panel
 * here: the read that follows is what takes the Cut out of the Story, and the
 * panel is drawn from the Cut it holds — so a delete that landed leaves nothing
 * to draw, and a refused one leaves the Author looking at the Cut they still
 * have.
 */
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

/**
 * The keyboard moves a node too — a graph that only answers to a pointer is not
 * one everyone can lay out. How far one press moves it is `NODE_PITCH`, which is
 * also the width of a node's strip and the grid a Scene dropped on the bench
 * snaps to, so the graph is handed it as `--pitch` rather than the twenty being
 * written again in the stylesheet.
 */
const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function nudge(scene: Scene, event: KeyboardEvent) {
  const nudged = NUDGES[event.key]
  if (!nudged) return
  event.preventDefault()
  scene.x = withinReach(scene.x + nudged[0] * NODE_PITCH)
  scene.y = withinReach(scene.y + nudged[1] * NODE_PITCH)
  return moveScene(scene)
}

/**
 * How tall each node is drawn, by Scene. Measured off the page rather than
 * worked out from the Story, because a node's height is its Shots, the stills in
 * them, the Conditions they carry and whether the Author has it folded — and a
 * Cut has to leave the edge of the box that is really there.
 *
 * ponytail: measured after every render rather than watched by a
 * `ResizeObserver`, because everything that changes a node's height here is
 * something the page rendered. Observe the boxes the day one of them is resized
 * by something else — a window narrow enough to reflow a node, say.
 */
const nodes = useTemplateRef<HTMLElement[]>('nodes')
const nodeHeights = reactive<Record<string, number>>({})

function measureNodes() {
  for (const node of nodes.value ?? []) {
    const sceneId = node.dataset.scene!
    // Written only where it changed: this runs after every render, and writing a
    // height back unchanged would ask for the next render forever.
    if (nodeHeights[sceneId] !== node.offsetHeight) nodeHeights[sceneId] = node.offsetHeight
  }
}

onMounted(measureNodes)
onUpdated(measureNodes)

/**
 * Every Cut as the line that draws it. A Scene whose node has not been measured
 * yet — the render on the server, and the first one in the browser — is taken to
 * be a full node, and the measurement a moment later moves the line onto the box.
 */
const cutLines = computed(() => story.value?.cuts.map((cut) => {
  const line = cutLine(boxOf(cut.fromSceneId), boxOf(cut.toSceneId))

  // The Place, counted from one for the Author as a Shot's is and read off the
  // same list the strip in the node reads, and the point near the departing
  // Scene where the disc saying it sits.
  return {
    id: cut.id,
    ...line,
    place: cutsFrom(cut.fromSceneId).indexOf(cut) + 1,
    disc: discOfCut(line),
  }
}) ?? [])

function boxOf(sceneId: string): NodeBox {
  const scene = sceneById(sceneId)
  return {
    x: scene?.x ?? 0,
    y: scene?.y ?? 0,
    height: nodeHeights[sceneId] ?? NODE_HEIGHT,
  }
}

/**
 * Which nodes the Author has opened, by Scene. What is folded is how the Author
 * is reading the graph and nothing about the Story, so it is never written
 * anywhere: it lasts as long as the page and no longer. Folded is where a node
 * starts, because a Story of forty Scenes opened is forty editors to scroll
 * through before the shape of the work can be seen at all.
 */
const opened = reactive(new Set<string>())

function foldOrOpen(scene: Scene) {
  if (!opened.delete(scene.id)) opened.add(scene.id)
}

/**
 * What a folded node says about a Scene, under its name: how many Shots are in
 * it, and where its ways on land. The ways on are named rather than counted,
 * because where a Scene leads is the one thing a graph is read for.
 */
function atAGlance(scene: Scene) {
  const shots = countedShots(scene.shots.length)
  const waysOn = cutsFrom(scene.id).map(cut => sceneNamed(sceneNames.value, cut.toSceneId, t))

  return waysOn.length
    ? t('editor.glanceWaysOn', { shots, waysOn: waysOn.join(', ') })
    : t('editor.glanceNoWayOn', { shots })
}
</script>

<template>
  <main>
    <!-- The bench's own header: where the Author came from, what they are working
         on, and the two things that can be done to the Story as a whole. It stays
         on screen, because the graph below it scrolls a long way. -->
    <header>
      <div class="titling">
        <NuxtLink class="back trail" :to="localePath('/stories')">
          {{ $t('editor.allStories') }}
        </NuxtLink>
        <h1>{{ story?.title }}</h1>
      </div>

      <div class="release">
        <!-- The one place an Author changes the language of their own tool. It
             is never drawn on the Reader's page — see
             `docs/adr/0012-the-public-link-carries-no-locale.md`. -->
        <Locales />
        <!-- Published or not is the whole of it: one button either way, and the link
             shown in full so it can be copied out of the page. -->
        <p v-if="story?.publishedAt" class="live">
          <span class="eyebrow">{{ $t('editor.readableAt') }}</span>
          <a class="link" :href="publicLink">{{ publicLink }}</a>
        </p>
        <!-- What a write leaves behind, beside the two controls that act on the
             whole Story. Not a live region: it appears every time a field is left,
             and announcing that would talk over the next thing typed. -->
        <p v-if="kept" class="kept-at">{{ $t('editor.keptAt', { time: kept }) }}</p>
        <NuxtLink class="preview trail" :to="localePath(`/stories/${id}/preview`)">
          {{ $t('editor.preview') }}
        </NuxtLink>
        <button v-if="story?.publishedAt" type="button" @click="unpublish">
          {{ $t('editor.unpublish') }}
        </button>
        <button v-else type="button" class="primary" @click="publish">
          {{ $t('editor.publish') }}
        </button>
      </div>
    </header>

    <form class="naming" @submit.prevent="createScene">
      <label class="eyebrow" for="new-scene-name">{{ $t('editor.newSceneName') }}</label>
      <div class="row">
        <input id="new-scene-name" v-model="newSceneName" required :maxlength="SCENE_NAME_MAX_LENGTH">
        <button type="submit">{{ $t('editor.createScene') }}</button>
      </div>
    </form>

    <p v-if="problem" role="alert">{{ problem }}</p>
    <p v-if="announced" class="toast" role="status">{{ announced }}</p>

    <p v-if="!story?.scenes.length" class="none">{{ $t('editor.noScenes') }}</p>
    <div v-else class="graph" @pointerdown="closeOnBench">
      <div ref="surface" class="surface" :style="{ ...graphSize, '--pitch': `${NODE_PITCH}px` }">
        <!-- The drawing is a pointer's way to a Cut and a second place the one
             being written is shown; the account of where a Scene leads that
             anything reads out is the strip inside the node — see
             `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`. So the
             lines are hidden from what reads the page rather than being the
             keyboard's route to a Cut. -->
        <svg aria-hidden="true" :style="graphSize">
          <defs>
            <marker
              id="cut-head" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="8" markerHeight="8" orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          <g v-for="line in cutLines" :key="line.id" :data-cut="line.id">
            <!-- The wide invisible stroke behind the line, which is what the hand
                 actually aims at: a Cut is written by pressing its line, and a
                 line and a half of pixels is nobody's idea of a target. The press
                 stops here, so it does not reach the bench that would close the
                 panel it just opened — and its default is refused, because a press
                 on a line focuses nothing and would take the focus off the field
                 the panel has just put it in. -->
            <line
              class="aimed"
              :x1="line.from.x"
              :y1="line.from.y"
              :x2="line.to.x"
              :y2="line.to.y"
              @pointerdown.stop.prevent="openCut(line.id)"
            />
            <line
              :class="{ lit: openedCut === line.id }"
              :x1="line.from.x"
              :y1="line.from.y"
              :x2="line.to.x"
              :y2="line.to.y"
              marker-end="url(#cut-head)"
            />
            <!-- The Place the way on is offered at, on a disc near the Scene it
                 leaves. It reports the order; nothing reads the order back out of
                 the drawing — see
                 `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`. -->
            <!-- Nine pixels of radius, which is what holds two digits of the
                 data face the number is set in: a Scene offering more than
                 ninety-nine ways on is not a Scene. -->
            <circle class="disc" :cx="line.disc.x" :cy="line.disc.y" r="9" />
            <text class="place" :x="line.disc.x" :y="line.disc.y">{{ line.place }}</text>
          </g>

          <!-- The Cut under the Author's hand: the same grease pencil as the Cuts
               it is dragged across, told apart from them by its dashes marching,
               and losing its arrowhead where it cannot land. -->
          <line
            v-if="drawnLine"
            class="drawn"
            :x1="drawnLine.from.x"
            :y1="drawnLine.from.y"
            :x2="drawnLine.to.x"
            :y2="drawnLine.to.y"
            :marker-end="landing ? 'url(#cut-head)' : undefined"
          />
        </svg>

        <!-- The node is named by the Scene rather than by its own heading: the
             heading holds the field the name is written in once the node is open,
             and a name read off a field is the label beside it and the value in
             it. Named this way it follows the Scene as the Author retypes it. -->
        <article
          v-for="scene in story.scenes"
          :key="scene.id"
          ref="nodes"
          :data-scene="scene.id"
          :class="{
            opens: story.openingSceneId === scene.id,
            drawing: aiming?.fromSceneId === scene.id,
            lit: mayLandOn(scene),
            quiet: aiming && !mayLandOn(scene),
          }"
          :aria-label="scene.name"
          :style="{
            translate: `${scene.x}px ${scene.y}px`,
            inlineSize: `${NODE_WIDTH}px`,
          }"
        >
          <!-- The strip down the node's leading edge, and where a Cut is drawn
               from. It sits outside the part of the node that scrolls, so it runs
               the node's full height whatever the body beside it is doing, the
               gesture is immediate under a finger with no long press, and it
               carries the mark that says which Scene a Reading opens on.

               `.self`, because the button it holds is pressed and not dragged: a
               pointer going down on it would otherwise begin a gesture the click
               that follows would have to undo. -->
          <div
            class="strip"
            @pointerdown.self="startAiming(scene, $event)"
            @pointermove="keepAiming"
            @pointerup="endAiming"
            @pointercancel="abandonAiming"
          >
            <!-- The keyboard's way into the same aiming: a button hidden until it
                 takes focus, the pattern a skip link uses, so the gesture stays
                 the only visible way in while assistive technology still finds a
                 real button with a real name. It says which Scene it draws from,
                 and once a gesture is live it says instead what pressing it would
                 do to that one — land the Cut, or let it go. A Scene the Cut
                 cannot land on offers it disabled, which is how the hand is kept
                 out of a Cut on itself and a second Cut to the same Scene. -->
            <button
              type="button"
              class="aim"
              :disabled="!!aiming && !mayLandOn(scene) && aiming.fromSceneId !== scene.id"
              @click="aimOrLand(scene)"
            >
              {{ aimingName(scene) }}
            </button>
          </div>

          <div class="body">
            <div class="slate">
              <!-- The name is the heading, and open it is the heading written in:
                   a bare field left to write it, the same idiom as a Shot's text
                   and a Cut's, with no mode to enter first. Folded, the node is
                   read rather than edited, so the name is the text it says.

                   The label sits outside the heading rather than in it: a heading
                   is named by what it holds, and a label inside would be read out
                   ahead of the name the Author is correcting. Outside, the heading
                   is the field's value and nothing else.

                   It is also the one control in a node that does not carry the
                   Scene's name after it, the way the fold and the handle do: this
                   field's own value is that name, so a label carrying it would
                   rename the field under the Author as they typed in it. Which
                   Scene it belongs to is what the node itself is named. -->
              <h2 v-if="!opened.has(scene.id)">{{ scene.name }}</h2>
              <template v-else>
                <label class="visually-hidden" :for="`scene-name-${scene.id}`">
                  {{ $t('editor.sceneName') }}
                </label>
                <h2 class="named">
                  <input
                    :id="`scene-name-${scene.id}`"
                    v-model="scene.name"
                    :maxlength="SCENE_NAME_MAX_LENGTH"
                    @change="renameScene(scene)"
                  >
                </h2>
              </template>

              <div class="grips">
                <!-- Folding is the Author's view of their own graph, so the button
                     says what pressing it does rather than what the node is. -->
                <button
                  type="button"
                  class="fold"
                  :aria-expanded="opened.has(scene.id)"
                  @click="foldOrOpen(scene)"
                >
                  {{ opened.has(scene.id) ? $t('editor.fold') : $t('editor.open') }}
                  <span class="visually-hidden">
                    {{ $t('editor.sceneNamed', { name: scene.name }) }}
                  </span>
                </button>

                <button
                  type="button"
                  class="handle"
                  @pointerdown="startDrag(scene, $event)"
                  @pointermove="keepDragging"
                  @pointerup="endDrag"
                  @keydown="nudge(scene, $event)"
                >
                  {{ $t('editor.move') }}
                  <span class="visually-hidden">
                    {{ $t('editor.sceneNamed', { name: scene.name }) }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Folded, a node is the Scene's name and this line: enough to read the
                 graph, and nothing the Author has to scroll past to reach the next
                 Scene. -->
            <p v-if="!opened.has(scene.id)" class="glance">{{ atAGlance(scene) }}</p>

            <template v-else>
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
                    {{ $t('editor.openingScene') }}
                    <span class="visually-hidden">{{ scene.name }}</span>
                  </label>
                </p>

                <button type="button" class="danger" @click="deleteScene(scene)">
                  {{ $t('editor.deleteScene') }}
                  <span class="visually-hidden">{{ scene.name }}</span>
                </button>
              </div>

              <!-- The Shots as the run they are: numbered from one for the Author,
                   though the Scene counts from zero, and each one's number sits in
                   the gutter where the edge code would be. -->
              <ol class="shots">
                <li
                  v-for="(shot, place) in scene.shots"
                  :key="shot.id"
                  :data-shot="shot.id"
                  :class="{
                    dragged: draggedShot?.shotId === shot.id,
                    under: draggedShot?.over === shot.id && draggedShot.shotId !== shot.id,
                  }"
                >
                  <!-- The number alone in the gutter, where a frame's edge code would be,
                       and the word it is a number of kept for anyone listening. It is
                       also the handle the Shot is dragged by: the gutter holds nothing
                       else, and the number is what the Author refers to the Shot as, so
                       there is no second grip to explain. -->
                  <label
                    class="shot-number"
                    :for="`shot-${shot.id}`"
                    @pointerdown="startShotDrag(shot, $event)"
                    @pointermove="keepShotDrag"
                    @pointerup="endShotDrag(scene)"
                    @pointercancel="draggedShot = undefined"
                  >
                    <span class="visually-hidden">{{ $t('editor.shot') }} </span>{{ place + 1 }}
                  </label>
                  <div class="written">
                    <textarea
                      :id="`shot-${shot.id}`"
                      v-model="shot.text"
                      rows="2"
                      :maxlength="SHOT_TEXT_MAX_LENGTH"
                      @change="writeShot(shot)"
                    />

                    <!-- The thumbnail is the picker: pressing it is how a still is
                         attached and how it is replaced, and the input doing the work
                         is behind it, focusable and named as it was. A Shot carrying
                         no still shows the outline of the thumbnail it would have, so
                         one nobody has finished reads as unfinished. -->
                    <div class="still">
                      <label>
                        <img
                          v-if="shot.image"
                          :src="stillOf(shot)"
                          :alt="$t('editor.stillOfShot', { place: place + 1 })"
                        >
                        <input
                          type="file"
                          class="visually-hidden"
                          :accept="SHOT_IMAGE_TYPES.join(',')"
                          :aria-label="$t('editor.imageOfShot', { place: place + 1 })"
                          @change="attachImage(shot, $event)"
                        >
                      </label>

                      <!-- The Description beside the still it describes, in the width
                           the file chrome used to take: it is what the image shows,
                           and there is nothing to describe until one is attached. A
                           Shot of text alone is not asked for one. -->
                      <p v-if="shot.image" class="described">
                        <label class="eyebrow" :for="`description-${shot.id}`">
                          {{ $t('editor.description') }}
                          <span class="visually-hidden">
                            {{ $t('editor.descriptionOfShot', { place: place + 1 }) }}
                          </span>
                        </label>
                        <input
                          :id="`description-${shot.id}`"
                          v-model="shot.description"
                          type="text"
                          :maxlength="SHOT_DESCRIPTION_MAX_LENGTH"
                          :placeholder="$t('editor.whatTheStillShows')"
                          @change="writeShot(shot)"
                        >
                      </p>
                    </div>

                    <!-- The Conditions the Shot plays under, so a Scene can say
                         something different on a return visit without the Author
                         drawing a second Scene to hold the changed line. -->
                    <Conditions
                      :lead="$t('editor.playedWhen')"
                      :carrier="$t('editor.shotOfScene', { place: place + 1, scene: scene.name })"
                      :conditions="shot.conditions"
                      :scenes="story.scenes"
                      :counting="scene.id"
                      :id="shot.id"
                      @write="writeConditions('shots', shot.id, shot.conditions)"
                    />

                    <!-- The three controls, as the marks they do rather than the
                         sentences that name them: in the width a node gives a Shot
                         the three sentences fill the strip to its end and wrap out
                         of it in the longer of the two languages. What each one
                         says is not lost, it moves to where the Shot's other names
                         are read, by assistive technology alone. -->
                    <div class="row marks">
                      <button
                        type="button"
                        :disabled="place === 0"
                        @click="moveShot(scene, shot, -1)"
                      >
                        <span aria-hidden="true">↑</span>
                        <span class="visually-hidden">
                          {{ $t('common.moveEarlier') }}
                          {{ $t('editor.shotNumber', { place: place + 1 }) }}
                        </span>
                      </button>
                      <button
                        type="button"
                        :disabled="place === scene.shots.length - 1"
                        @click="moveShot(scene, shot, 1)"
                      >
                        <span aria-hidden="true">↓</span>
                        <span class="visually-hidden">
                          {{ $t('common.moveLater') }}
                          {{ $t('editor.shotNumber', { place: place + 1 }) }}
                        </span>
                      </button>
                      <button type="button" class="danger" @click="deleteShot(shot)">
                        <span aria-hidden="true">×</span>
                        <span class="visually-hidden">
                          {{ $t('common.delete') }}
                          {{ $t('editor.shotNumber', { place: place + 1 }) }}
                        </span>
                      </button>
                    </div>
                  </div>
                </li>
              </ol>

              <button type="button" @click="addShot(scene)">
                {{ $t('editor.addShot') }}
                <span class="visually-hidden">{{ $t('editor.toScene', { name: scene.name }) }}</span>
              </button>

              <p class="sets">
                <label class="eyebrow" :for="`flags-${scene.id}`">
                  {{ $t('editor.flagsSet') }}
                  <span class="visually-hidden">{{ scene.name }}</span>
                </label>
                <textarea
                  :id="`flags-${scene.id}`"
                  class="data"
                  rows="2"
                  :value="flagLines(scene.sets)"
                  :placeholder="$t('editor.flagsPlaceholder', { separator: FLAG_SEPARATOR })"
                  @change="writeFlags(scene, ($event.target as HTMLTextAreaElement).value)"
                />
              </p>

              <!-- The ways on, bare: each one's Place, the name it arrives at,
                   and the two controls that renumber it. A Cut's text and its
                   Conditions are written in the panel its line opens, and what
                   stays here is what an Author cannot read a Cut without — where
                   the Scene leads, and in what order — which is also the route to
                   a Cut for a hand that is not on a pointer. -->
              <div class="ways">
                <p :id="`ways-${scene.id}`" class="eyebrow">
                  {{ $t('editor.waysOn') }}
                  <span class="visually-hidden">
                    {{ $t('editor.fromScene', { name: scene.name }) }}
                  </span>
                </p>

                <p v-if="!cutsFrom(scene.id).length" class="none">
                  {{ $t('editor.noWayOnYet') }}
                </p>
                <ol v-else :aria-labelledby="`ways-${scene.id}`">
                  <li
                    v-for="(cut, place) in cutsFrom(scene.id)"
                    :key="cut.id"
                    :data-way="cut.id"
                    :class="{
                      dragged: draggedWay?.cutId === cut.id,
                      under: draggedWay?.over === cut.id && draggedWay.cutId !== cut.id,
                    }"
                  >
                    <!-- The row is pressed to write the Cut and dragged to
                         renumber it: one control, because the strip holds three
                         things and a fourth grip for the drag would be a way on
                         read as a toolbar. Its Place is the number it is offered
                         at, so a row says which Cut it is without the panel
                         being open. -->
                    <button
                      :id="`way-${cut.id}`"
                      type="button"
                      class="way"
                      :aria-expanded="openedCut === cut.id"
                      @pointerdown="startWayDrag(cut, $event)"
                      @pointermove="keepWayDrag"
                      @pointerup="endWayDrag(scene)"
                      @pointercancel="draggedWay = undefined"
                      @click="pressWay(cut)"
                    >
                      <span class="numbered">{{ place + 1 }}</span>
                      {{ sceneNames.get(cut.toSceneId) }}
                      <span class="visually-hidden">
                        {{ $t('editor.wayOnFrom', { name: scene.name }) }}
                      </span>
                    </button>

                    <button
                      type="button"
                      :disabled="place === 0"
                      @click="moveCut(scene, cut, -1)"
                    >
                      {{ $t('common.moveEarlier') }}
                      <span class="visually-hidden">
                        {{ $t('editor.theCutTo', { scene: sceneNames.get(cut.toSceneId) }) }}
                      </span>
                    </button>
                    <button
                      type="button"
                      :disabled="place === cutsFrom(scene.id).length - 1"
                      @click="moveCut(scene, cut, 1)"
                    >
                      {{ $t('common.moveLater') }}
                      <span class="visually-hidden">
                        {{ $t('editor.theCutTo', { scene: sceneNames.get(cut.toSceneId) }) }}
                      </span>
                    </button>
                  </li>
                </ol>
              </div>
            </template>
          </div>
        </article>

        <!-- Where a Cut is written: on the middle of its own line, above the
             nodes and on the surface, so it scrolls with the bench and stays on
             the line it edits. It holds the Cut's text, its Conditions, its
             duplication and its deletion, and not its Place — a Place is read and
             changed beside its siblings, which is the strip inside the node. -->
        <div
          v-if="panel"
          class="panel"
          role="group"
          :aria-label="$t('editor.writingCutTo', { scene: panel.to })"
          :style="{
            insetInlineStart: `${panel.at.x}px`,
            insetBlockStart: `${panel.at.y}px`,
          }"
        >
          <label class="eyebrow" :for="`cut-${panel.cut.id}`">
            {{ $t('cut.to', { scene: panel.to }) }}
            <span class="visually-hidden">
              {{ $t('editor.fromScene', { name: panel.from }) }}
            </span>
          </label>
          <input
            :id="`cut-${panel.cut.id}`"
            ref="cutText"
            v-model="panel.cut.text"
            :maxlength="CUT_TEXT_MAX_LENGTH"
            @change="writeCut(panel.cut)"
          >

          <Conditions
            :lead="$t('editor.offeredWhen')"
            :carrier="$t('editor.theCutTo', { scene: panel.to })"
            :conditions="panel.cut.conditions"
            :scenes="story.scenes"
            :counting="panel.cut.fromSceneId"
            :id="panel.cut.id"
            @write="writeConditions('cuts', panel.cut.id, panel.cut.conditions)"
          />

          <!-- The deliberate route to a second way on to the same Scene, which
               the aiming gesture withholds so that the hand cannot draw one by
               accident. -->
          <button type="button" @click="duplicateCut(panel.cut)">
            {{ $t('editor.duplicateCutTo', { scene: panel.to }) }}
          </button>

          <button type="button" class="danger" @click="deleteCut(panel.cut)">
            {{ $t('editor.deleteCutTo', { scene: panel.to }) }}
          </button>
        </div>
      </div>
    </div>

    <Confirmation :asked="asked" @answer="answer" />
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

/* The time of the last write, set in the face the interface reads its own
   readings in, and quiet: it is there to be glanced at, never to be the thing
   the eye lands on when the bench is opened. */
.kept-at {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
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

/* The bench the graph is laid out on. Its height is named here rather than only
   set, because it is also the ceiling an open node grows to. */
.graph {
  /* ponytail: the bench can be dragged taller, and `--bench-height` does not
     follow it, so a node opened after a resize is capped at the height the bench
     started at. Measure the bench the day an Author complains. */
  --bench-height: min(70dvh, 44rem);

  overflow: auto;
  resize: vertical;
  block-size: var(--bench-height);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--bench) 70%, black);
}

.surface {
  position: relative;
  /* The bench is pricked out every twenty pixels, which is exactly how far an
     arrow key moves a Scene: the grid is the step, not a texture. */
  background-image:
    radial-gradient(
      circle at 1px 1px,
      color-mix(in oklab, var(--edge) 55%, transparent) 1px,
      transparent 0
    );
  background-size: var(--pitch) var(--pitch);
}

svg {
  position: absolute;
  inset: 0;
  /* The drawing takes no presses. The one exception is the wide stroke behind each
     Cut, which asks for them back below: a line paints over that stroke, and a
     disc paints over both, so leaving the whole of it live would have the hand
     landing on whichever of the three was drawn last. */
  pointer-events: none;
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

/* What the hand aims at: the same line, twenty pixels of it and none of it drawn.
   Twenty is the pitch the bench is pricked out at, so the target is the graph's
   own step rather than a number picked for this one thing. `stroke` decides where
   a hit lands, not whether the paint can be seen, so nothing here has to be
   visible to be pressed. */
svg line.aimed {
  stroke: transparent;
  stroke-width: var(--pitch);
  pointer-events: stroke;
  cursor: pointer;
}

/* The Cut being written, lit: the panel says which Cut it is holding, and this is
   the same thing said on the bench, where the Author is looking. */
svg line.lit {
  stroke: var(--grease);
  /* Twice the weight of a finished Cut, which is the whole of the difference: the
     Cut being written is the same mark, drawn heavier. */
  stroke-width: 3;
}

/* The Place a way on is offered at, on a disc near the Scene it leaves. It is the
   Author's own numbering, so it wears the grease pencil, and the number is punched
   out of it in the bench's own dark. */
svg circle.disc {
  fill: var(--grease);
}

svg text.place {
  fill: var(--ink);
  font-family: var(--data);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
  dominant-baseline: central;
}

/* The Cut under the Author's hand. It is the Author's mark, so it is the grease
   pencil like every finished Cut — and since it is dragged across a bench full of
   them in that same colour, what tells it apart is that its dashes march. That
   makes it the first animation in the product, and the stylesheet's own
   reduced-motion block is what stops it: asked for stillness, the line is still
   dashed and simply does not move. */
svg line.drawn {
  stroke: var(--grease);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  animation: marching 600ms linear infinite;
}

@keyframes marching {
  to {
    stroke-dashoffset: -10;
  }
}

/* A node is two columns that do not themselves scroll: the strip down its leading
   edge, and the body beside it. The width is the one a phone can show, and the
   strip comes out of it rather than adding to it. */
article {
  position: absolute;
  display: grid;
  grid-template-columns: var(--pitch) minmax(0, 1fr);
  /* The body scrolls inside a box with machined corners, so the box clips it. */
  overflow: hidden;
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

/* While a Cut is being drawn, the Scenes that can take it are lit and every
   other one goes quiet — the Scene the line left, and any it already reaches — so
   what the hand may land on is read off the bench rather than out of a list. Two
   static classes and nothing recomputed as the pointer moves: what a Cut may land
   on is fixed the moment the gesture begins. */
article.lit {
  border-color: var(--grease);
}

article.quiet {
  opacity: 0.4;
}

/* The node the line is leaving keeps a ring, so the source stays legible with the
   pointer at the far end of the bench. */
article.drawing {
  outline: 2px dashed var(--grease);
  outline-offset: 2px;
}

/* The strip: a groove down the node's leading edge, running its full height
   because it is a column of the node and not something inside what scrolls. The
   Scene a Reading starts on has it filled with the grease pencil, so the Author
   can see where the Story opens without reading a single radio button — and
   without opening the node the button is folded inside. */
.strip {
  position: relative;
  border-inline-end: 1px solid var(--edge);
  background: color-mix(in oklab, var(--bench) 60%, transparent);
  /* The hand draws a Cut from here, and a finger draws one without waiting: the
     strip is outside the part of the node that scrolls, so taking the touch off
     the scroller costs the node's own scrolling nothing. */
  cursor: crosshair;
  touch-action: none;
}

/* The keyboard's way in, hidden until it is focused — the pattern a skip link
   uses. Off the top of the strip it belongs to rather than out of the page, so
   focus lands on the node it draws from. */
.aim {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  /* A button's own padding and border are a floor under its size — it is laid out
     border-box — so both come off, or the thing nobody can see is still
     twenty-six pixels of it. */
  padding: 0;
  border: 0;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.aim:focus {
  z-index: 2;
  inline-size: max-content;
  block-size: auto;
  overflow: visible;
  clip-path: none;
  padding: var(--s1) var(--s2);
  border: 1px solid var(--edge);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

article.opens .strip {
  background: var(--grease);
}

/* The body: everything the Author reads and writes, and the only part of a node
   that scrolls. An open one is as tall as what is in it, up to the height of the
   bench, past which it scrolls inside itself rather than over the Scenes below. */
.body {
  display: grid;
  /* Tight, because everything a Scene is — its Shots, the Flags it sets and the
     Cuts leaving it — has to fit a node before the node has to be scrolled. */
  gap: var(--s2);
  align-content: start;
  /* Less the node's two hairlines, so the box the Author sees is the height of the
     bench and not two pixels past it. */
  max-block-size: calc(var(--bench-height) - 2px);
  overflow: auto;
  padding: 0 var(--s3) var(--s3);
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

/* The heading as it is written in. It takes what the grips leave rather than
   sizing itself to the name in it, because a field that grew with the Author's
   typing would push the fold and the handle off the slate. The field inside is
   the heading's own type on the slate's own ground — dressed as the heading it
   replaces, not as another box in the node — and the line under it is all that
   says it is a field. Focus is left to the outline every control here is given. */
.named {
  flex: 1;
  min-inline-size: 0;
}

.named input {
  padding: 0 var(--s1);
  background: none;
}

/* Held off the pointer rather than restating what a hovered field looks like,
   so the frame that comes up is the one every other field here draws and the
   two cannot drift apart. */
.named input:not(:hover) {
  border-color: transparent;
  border-block-end-color: var(--edge);
}

/* The two things done to a node rather than to the Scene in it: opened, and
   moved. Both stay on the slate, so a folded node is still one the Author can
   lay out. */
.grips {
  flex: none;
  display: flex;
  gap: var(--s1);
}

.fold,
.handle {
  /* Targets a thumb can find on a phone rather than the size of their
     ten-pixel labels — and the handle is the only pointer route to moving a
     Scene at all. */
  min-block-size: 2.25rem;
  padding: var(--s1) var(--s3);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.handle {
  cursor: move;
  touch-action: none;
}

/* What a folded node says: read at a glance, so it is a line of quiet type under
   the Scene's name and not a table of counts. Held to two lines, because every
   folded node is the size of every other one and a Scene with a long list of ways
   on would otherwise be taller than its neighbours. */
.glance {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  block-size: 2lh;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.8125rem;
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

/* Data the Author types rather than prose: the Flags a Scene sets. A Condition's
   own fields wear it inside the component that draws them. */
.data {
  font-family: var(--data);
  font-size: 0.8125rem;
}

/* The run of Shots, each numbered in the gutter and separated from the next by a
   hairline — a Scene read the way a length of film is. Not to be read as the
   node's own strip, which is the column beside all of this. */
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
  /* The number is what the Shot is dragged by. No `touch-action` here, unlike the
     three gestures on the bench: a finger goes on scrolling the run, and reaches
     the same renumbering through the two controls under every Shot. */
  cursor: grab;
}

/* The Shot in the hand, and the Shot whose Place it would take: the run says what
   the gesture is about to do before the Author lets go, as a way on being dragged
   does. The Place aimed at is washed in the grease pencil rather than outlined in
   it the way a way on is, because a row of the strip is a bordered thing and a
   Shot is a whole block of writing — the same mark, put where each can wear it. */
.shots li.dragged {
  opacity: 0.5;
}

.shots li.under {
  background: color-mix(in oklab, var(--grease) 12%, transparent);
}

.written {
  display: grid;
  gap: var(--s2);
}

.written textarea {
  font-size: 0.875rem;
}

/* A still is a thumbnail here and nothing more: it says which image the Shot
   carries, and leaves the node's height to the Flags and the Cuts. The Description
   sits beside it, in the width the browser's own file chrome used to take. */
.still {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--s2);
}

/* The thumbnail itself is what is pressed to attach a still or to replace one, so
   the box is the label and the input is clipped away inside it. Drawn whether or
   not there is a still to put in it: an empty one is the outline of the still the
   Shot has not attached, which is how an unfinished Shot reads as unfinished. */
.still > label {
  position: relative;
  display: block;
  inline-size: 4.5rem;
  block-size: 3rem;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  cursor: pointer;
}

/* The focus the input takes cannot be seen where the input is, so the ring is drawn
   round the box that is pressed instead. It is the one in `frameline.css`, restated
   here because `:has()` cannot reach back to a rule written for `:focus-visible`. */
.still > label:has(:focus-visible) {
  outline: 2px solid var(--light);
  outline-offset: 2px;
}

.still img {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* The Description beside the still it describes, the label above the field, so
   the two read as one thing said about the image next to them. */
.described {
  display: grid;
  gap: var(--s1);
}

.described input {
  font-size: 0.8125rem;
}

.written .row {
  gap: var(--s1);
}

/* A Shot's three controls, each one mark wide: the square the words used to be
   pressed by, kept as a square rather than shrunk to the mark inside it, so the
   three sit on one line without asking a finger for more aim than before. */
.written .row.marks button {
  min-inline-size: 1.75rem;
  padding: var(--s1) var(--s2);
  font-size: 0.8125rem;
  line-height: 1.2;
}

.sets {
  display: grid;
  gap: var(--s2);
}

/* The bare strip of the ways on leaving this Scene: a row apiece, and nothing
   between it and the Flags above it — an open node holds three things, and the
   space between them is what says so. */
.ways {
  display: grid;
  gap: var(--s1);
}

.ways ol {
  display: grid;
  gap: var(--s1);
}

.ways li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
}

/* One way on, read as the line it is rather than as a button: where it arrives,
   and the Place it is offered at in the gutter. The whole row is the target,
   because it is pressed to write the Cut and dragged to renumber it. */
.way {
  /* Narrow enough that the name and the two controls are one line of a node this
     width, and free to grow into what they leave: a long Scene name wraps inside
     the row rather than pushing a control onto a line of its own. */
  flex: 1 1 4rem;
  min-inline-size: 0;
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: var(--s1) var(--s2);
  font-size: 0.8125rem;
  font-weight: 400;
  text-align: start;
  cursor: grab;
  /* Dragged rather than scrolled under a finger, the same as the two gestures the
     bench already carries. */
  touch-action: none;
}

/* The Place, in the grease pencil the disc on the line wears, so the number in
   the node and the number on the bench read as the one number. */
.numbered {
  flex: none;
  min-inline-size: 1.25rem;
  color: var(--grease);
  font-family: var(--data);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

/* The row in the hand, and the row whose Place it would take: the gesture says
   what it is about to do before the Author lets go, the same way the line being
   drawn does. */
.ways li.dragged .way {
  opacity: 0.5;
}

.ways li.under .way {
  border-color: var(--grease);
}

/* The two controls that renumber, held to the size the ones under a Shot are:
   they are the keyboard's way to do what the drag does. */
.ways li button:not(.way) {
  flex: none;
  padding: var(--s1) var(--s2);
  font-size: 0.6875rem;
}

/* The panel one Cut is written in, on the middle of its own line and centred on
   that point, so it sits over the Cut rather than beside it. On the surface, which
   is what makes it scroll with the bench, and above the nodes, including whichever
   one is being worked in. It wears the grease pencil, because everything in it is
   the Author's mark on a Cut. */
.panel {
  position: absolute;
  z-index: 2;
  translate: -50% -50%;
  display: grid;
  gap: var(--s2);
  /* Narrower than the twenty rem of a node, because a panel sits between the two
     boxes its line joins and one wider than they are would cover both. */
  inline-size: 17rem;
  padding: var(--s3);
  border: 1px solid var(--grease);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}


/* On a phone the graph is worked on a screen narrower than a node, so it is
   given more of the screen's height rather than a slice of it. In `dvh`, because
   a browser's own chrome comes and goes and `vh` would leave the bench taller
   than the screen it is on — three nested scrollbars deep. */
@media (max-width: 44rem) {
  .graph {
    --bench-height: 70dvh;
  }
}
</style>
