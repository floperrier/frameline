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
 * is no date on it because nobody sits at the bench long enough to need one —
 * what an Author wants from it is that the last thing they typed went somewhere.
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

/**
 * How far back the Author is standing from their own graph, where one is the
 * surface's own size. Like what is in the panel, it is the Author's view of their
 * own work rather than part of it: it is written nowhere, and every load opens on
 * the bench at its own size.
 */
const zoom = ref(1)

/**
 * Whether the scale should travel to where it is going or arrive there. The
 * buttons and the shortcuts are steps, and a step that jumps leaves the Author
 * working out what moved; the wheel is already continuous, and easing it would
 * put the surface a frame behind the hand turning it. Set by whichever route is
 * zooming rather than timed, so nothing has to be unset afterwards.
 */
const eased = ref(false)

/**
 * How far back the Author is standing, as a reading. A percentage written the way
 * one is written in the Locale rather than in the Story's own Language: this is
 * the bench talking about itself, like the time of the last write above.
 */
const zoomShown = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'percent' }).format(zoom.value))

/**
 * The graph is as large as the Scenes in it, so it scrolls no further than them.
 * In surface pixels, which is what a Scene's placement is in and what the lines
 * are drawn in: the scale the bench is looked at through is not in here.
 */
const graphSize = computed(() => {
  const scenes = story.value?.scenes ?? []
  const furthest = (of: (scene: Scene) => number) => Math.max(0, ...scenes.map(of))

  return {
    width: furthest(scene => scene.x) + NODE_WIDTH + NODE_GAP,
    height: furthest(scene => scene.y) + NODE_HEIGHT + NODE_GAP,
  }
})

/** The surface itself, and the drawing on it: the size above, in pixels of CSS. */
const surfaceSize = computed(() => ({
  width: `${graphSize.value.width}px`,
  height: `${graphSize.value.height}px`,
}))

/**
 * How far the bench scrolls: the surface at the size it is *drawn* at. A scale
 * is a transform and a transform moves nothing in the layout, so the box that
 * scrolls is a box of its own around the surface — without it a bench zoomed out
 * would scroll as far as a bench at its own size, and one zoomed in would stop
 * short of half its Scenes.
 */
const spreadSize = computed(() => ({
  width: `${graphSize.value.width * zoom.value}px`,
  height: `${graphSize.value.height * zoom.value}px`,
}))

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
 * `1 Shot` and `2 Shots`: a card counts them, and a Delete asks about them. One
 * phrase a count rather than a suffix on a noun, because a plural is not a
 * letter added in every language the interface is read in.
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
 */
const draggedShot = ref<{ shotId: string, over?: string }>()

/**
 * The band along the panel's top and bottom edge that a dragged Shot scrolls it
 * from, and how far the panel travels each tick of the run. Both are felt rather
 * than derived, which is why they are named here with the reasoning rather than
 * dropped into the arithmetic below.
 *
 * The band is about the height of a Shot's own number: wide enough to fall into
 * with a hand that is already carrying something, and narrow enough that a hand
 * resting halfway down a run scrolls nothing. The step comes to five hundred
 * pixels a second, which crosses a node full of Shots in a couple of seconds —
 * slow enough that the row aimed at can be let go of as it comes past.
 *
 * Under `prefers-reduced-motion` the run still travels: refusing to scroll would
 * put the far end of a long Scene out of reach of the gesture that exists to
 * reach it, and the two controls are the route for a hand that wants no drag at
 * all. What it loses is the glide — the same distance in the same time, taken a
 * Shot's row at a stride every fifth of a second instead of a few pixels a
 * frame, so the list steps to where the hand is pointing rather than sliding
 * there.
 */
const SHOT_SCROLL_BAND = 48
const SHOT_SCROLL_TICK = 16
const SHOT_SCROLL_STEP = 8
const SHOT_SCROLL_STILL_TICK = 200
const SHOT_SCROLL_STILL_STEP = 100

/**
 * The run that scrolls the panel under a dragged Shot: the panel itself, how far
 * it goes each tick, where the hand last was, and the timer driving it. One
 * run per drag, started with the gesture and stopped with it however it ends, so
 * nothing goes on scrolling without a hand on it. A hand at rest away from both
 * edges is a tick that moves nothing, which is cheaper than starting and
 * stopping the timer at every edge.
 */
let shotScroll: {
  body: HTMLElement
  step: number
  at: { clientX: number, clientY: number }
  tick: ReturnType<typeof setInterval>
} | undefined

/**
 * Which way the body under the hand should be running: back in the band along
 * its top edge, on in the one along its bottom, and nowhere between the two or
 * past either. The pointer is captured, so a hand that has left the body
 * altogether is a hand outside every band rather than one pinned to the edge it
 * left by.
 *
 * The bands are measured against what is on screen of the panel and not against
 * the whole of it. A panel whose foot is below the fold, where no pointer can go,
 * would carry a band the hand could never reach — so the band sits at the bottom
 * of what the Author can see, which is as far down as they can drag anything.
 */
function shotScrollWay(body: HTMLElement, y: number) {
  const box = body.getBoundingClientRect()
  const top = Math.max(box.top, 0)
  const bottom = Math.min(box.bottom, window.innerHeight)
  if (y >= top && y < top + SHOT_SCROLL_BAND) return -1
  if (y <= bottom && y > bottom - SHOT_SCROLL_BAND) return 1

  return 0
}

/**
 * One tick of the run. Which way it goes is worked out here rather than kept
 * from the last move, because the panel can come out from under a hand that has
 * not moved — the press on a Shot's number focuses its field, and a browser that
 * scrolls the page to show it takes the bands with it.
 *
 * The Shot the hand is over is asked for again once the body has moved, for the
 * same reason: the list comes to meet a pointer standing still in the band, and
 * the row under it is whichever one has arrived there.
 */
function runShotScroll() {
  const run = shotScroll
  if (!run || !draggedShot.value) return

  const way = shotScrollWay(run.body, run.at.clientY)
  if (!way) return

  run.body.scrollTop += way * run.step
  draggedShot.value.over = rowUnder(run.at, 'shot')
}

/** Stops the run, whatever ended the gesture that started it. */
function stopShotScroll() {
  if (shotScroll) clearInterval(shotScroll.tick)
  shotScroll = undefined
}

// Leaving the page ends the gesture as surely as letting go does, and a timer
// left ticking would go on scrolling a node that is no longer on screen.
onBeforeUnmount(stopShotScroll)

function startShotDrag(shot: Shot, event: PointerEvent) {
  // A finger scrolls the node instead. The two controls move a Shot a Place
  // without a drag, so touch keeps the whole route and loses only the shortcut —
  // and taking the scroll off a node full of writing would cost it more.
  if (event.pointerType === 'touch') return

  // Capturing the pointer sends the rest of the gesture to the number itself, so
  // the hand can leave it for the Shot it is aiming at.
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  draggedShot.value = { shotId: shot.id }

  // What scrolls is the panel this drag is inside, never the bench and never the
  // window: a Shot carried to the edge of its run must not take the graph with
  // it.
  const body = handle.closest('.panel')
  if (!(body instanceof HTMLElement)) return

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  shotScroll = {
    body,
    step: still ? SHOT_SCROLL_STILL_STEP : SHOT_SCROLL_STEP,
    at: { clientX: event.clientX, clientY: event.clientY },
    tick: setInterval(runShotScroll, still ? SHOT_SCROLL_STILL_TICK : SHOT_SCROLL_TICK),
  }
}

function keepShotDrag(event: PointerEvent) {
  if (!draggedShot.value) return
  draggedShot.value.over = rowUnder(event, 'shot')
  if (shotScroll) shotScroll.at = { clientX: event.clientX, clientY: event.clientY }
}

/** A gesture abandoned: the Shot is put down where it was, and the run stops. */
function cancelShotDrag() {
  draggedShot.value = undefined
  stopShotScroll()
}

function endShotDrag(scene: Scene) {
  const dragged = draggedShot.value
  cancelShotDrag()
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
 * Attaches a still, sent as the whole request body. One function for both ways in:
 * a file picked and a file dropped are the same file handed to the same endpoint.
 */
function attach(shot: Shot, file: File) {
  return change(async () => {
    await send(`/api/shots/${shot.id}/image`, { method: 'PUT', body: file })
    attachedAt[shot.id] = Date.now()
  })
}

/**
 * Attaches the still the Author picked. The input is cleared afterwards so picking
 * the same file twice is a change twice — an Author whose first upload was refused
 * would otherwise have to pick another file before they could retry the same one.
 */
function attachImage(shot: Shot, event: Event) {
  const picker = event.target as HTMLInputElement
  const picked = picker.files?.[0]
  if (!picked) return
  picker.value = ''

  return attach(shot, picked)
}

/**
 * The Shot whose thumbnail a file is over, held by Shot id rather than by the
 * Shot, the same trap the drags on this page avoid: a read landing mid-gesture
 * replaces every Scene in the Story. `over` is what the other gestures call it,
 * because it is the same fact — what the hand is aimed at, before it lets go.
 */
const fileOver = ref<string>()

/**
 * A file over a thumbnail. The template refuses the default, which is the whole of
 * saying yes — an element that does not refuse it is not a drop target at all — and
 * this puts the mark on and the copy cursor with it. The event stops at the
 * thumbnail so the page's own refusal does not take that cursor back off it.
 */
function overStill(shot: Shot, event: DragEvent) {
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  fileOver.value = shot.id
}

/**
 * The file leaving again. Asked of the thumbnail and not of what is inside it:
 * moving onto the image or the input leaves the label by the letter of the event,
 * and the mark would flicker off under a hand that has not gone anywhere. Nor does
 * a thumbnail take the mark off its neighbour — a file crossing from one to the
 * next enters the second before it leaves the first.
 */
function leaveStill(shot: Shot, event: DragEvent) {
  const thumbnail = event.currentTarget as HTMLElement
  if (fileOver.value !== shot.id) return

  if (!thumbnail.contains(event.relatedTarget as Node | null)) fileOver.value = undefined
}

/**
 * The file dropped on a thumbnail. A drop carries what the Author let go of rather
 * than what the picker offered, so it may hold several files, or one of a kind the
 * endpoint will refuse: the first image is the one taken, and the rest are passed
 * over without a word about them. A drop of one file that is no image at all is
 * still sent, because the endpoint is what says what an image is — and it says so
 * in the same phrase a picked file is refused in.
 */
function dropStill(shot: Shot, event: DragEvent) {
  fileOver.value = undefined
  const dropped = [...event.dataTransfer?.files ?? []]
  const still = dropped.find(file => SHOT_IMAGE_TYPES.includes(file.type)) ?? dropped[0]
  if (!still) return

  return attach(shot, still)
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

function deleteShot(shot: Shot) {
  return change(() => send(`/api/shots/${shot.id}`, { method: 'DELETE' }))
}

function openOn(scene: Scene) {
  return change(() => send(`/api/scenes/${scene.id}/opening`, { method: 'POST' }))
}

/**
 * The surface the nodes are laid out on, which is what a pointer's position has
 * to be read against: the bench scrolls and it is drawn at a scale, so where the
 * hand is on the screen is not where it is on the Graph.
 */
const surface = useTemplateRef<HTMLElement>('surface')

/** The box the surface is looked at through: what scrolls, and what pans. */
const graph = useTemplateRef<HTMLElement>('graph')

/**
 * Where a pointer is on the surface. Read off the surface's own rectangle every
 * time rather than kept from the start of a gesture, because the bench can move
 * under a hand that is in the middle of one — a Scene dragged to the edge scrolls
 * the bench, and the panel opening beside it narrows the graph.
 */
function pointOnSurface(at: { clientX: number, clientY: number }) {
  return onTheSurface(
    { x: at.clientX, y: at.clientY }, surface.value!.getBoundingClientRect(), zoom.value)
}

/**
 * The middle of what is on screen of the bench, as a point on the surface. The
 * anchor for every zoom that has no pointer behind it: what an Author is looking
 * at is what stays put.
 */
function middleOfBench() {
  const box = graph.value!.getBoundingClientRect()

  return pointOnSurface({
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  })
}

/**
 * Pulls the bench back or brings it closer, holding one point of the surface
 * where it is. The scroll is written after the render, because the box that
 * scrolls is only as large as the new scale once it has been drawn at it: set
 * before, a scroll past the old extent would be clamped to it and the anchor
 * would slide.
 */
function zoomAbout(to: number, anchor: Point, smoothly = true) {
  const scroller = graph.value
  if (!scroller) return

  const zoomed = zoomedAbout(
    zoom.value, to, anchor, { x: scroller.scrollLeft, y: scroller.scrollTop })
  eased.value = smoothly
  zoom.value = zoomed.zoom

  return nextTick(() => {
    scroller.scrollLeft = zoomed.scroll.x
    scroller.scrollTop = zoomed.scroll.y
  })
}

/**
 * One press of a zoom control. A quarter at a time, which is the whole range in
 * three steps and lands on the scale the fit usually wants anyway.
 */
const ZOOM_STEP = 0.25

function zoomBy(step: -1 | 1) {
  if (graph.value) zoomAbout(zoom.value + step * ZOOM_STEP, middleOfBench())
}

/**
 * Far enough back to see the whole Story at once — or as far back as the bench
 * goes, on a Story larger than a quarter of the screen can hold, which is the
 * bound doing its job rather than the fit failing.
 */
function zoomToFit() {
  const scroller = graph.value
  if (!scroller) return

  const { width, height } = graphSize.value
  zoomAbout(
    Math.min(scroller.clientWidth / width, scroller.clientHeight / height), middleOfBench())
}

/**
 * How much of a wheel makes how much of a zoom. A ratio rather than a difference,
 * so a notch pulls back as far as it pushes in, and read off the pixels the wheel
 * reports so a trackpad's hundred small deltas and a mouse's three large ones
 * arrive at the same place.
 *
 * ponytail: two hundred is a number to be felt at a trackpad rather than derived
 * — it is about a notch of a mouse wheel to a quarter of the scale. Tune it the
 * day the zoom feels heavy under somebody's hand.
 */
const ZOOM_PER_WHEEL = 100

/**
 * The most one event of it may be worth, and what a line of it is worth in
 * pixels. Two hands turn this wheel and they are two orders of magnitude apart:
 * a trackpad pinch arrives as scores of events a few pixels each, and a mouse
 * wheel as one event of a hundred. Uncapped, the ratio that makes a pinch smooth
 * takes a single notch of the mouse from the surface's own size to two thirds of
 * it; capped, a notch is a step of about a quarter and a pinch is untouched,
 * because no event of one ever reaches the cap. A wheel that reports lines rather
 * than pixels — Firefox — is read at a line to sixteen pixels first.
 */
const ZOOM_WHEEL_CAP = 25
const ZOOM_WHEEL_LINE = 16

/**
 * The wheel with Ctrl or Command held, which is also what Chromium sends while
 * two fingers pinch a trackpad. The default is refused, because what the browser
 * would otherwise do with it is zoom the whole page — the header, the panel and
 * the bench together.
 *
 * Anchored on the pointer, so the Scene under the cursor is the Scene still under
 * it afterwards. Safari does not come through here at all: see `pinch` below.
 */
function zoomByWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()

  const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * ZOOM_WHEEL_LINE
    : event.deltaY
  const held = Math.max(-ZOOM_WHEEL_CAP, Math.min(ZOOM_WHEEL_CAP, pixels))

  zoomAbout(zoom.value * Math.exp(-held / ZOOM_PER_WHEEL), pointOnSurface(event), false)
}

/**
 * What WebKit sends while two fingers pinch, and nothing else does. Safari does
 * not report a pinch as a wheel with Ctrl the way Chromium does — it sends these
 * gestures of its own and zooms the whole page itself — so a bench that only
 * listened for the wheel had no pinch at all in the browser most likely to be
 * open on a trackpad. `scale` is the whole gesture so far rather than the step,
 * one being where it began, so the scale to go to is the one the gesture started
 * from multiplied by it.
 *
 * Not in `lib.dom`, because it is nobody's standard: the two fields read here are
 * named rather than a whole interface being declared for them.
 */
type Pinch = Event & { scale: number, clientX: number, clientY: number }

let pinched: { zoom: number, anchor: Point } | undefined

function startPinch(event: Event) {
  event.preventDefault()
  const at = event as Pinch
  pinched = { zoom: zoom.value, anchor: pointOnSurface(at) }
}

function pinch(event: Event) {
  if (!pinched) return
  event.preventDefault()

  zoomAbout(pinched.zoom * (event as Pinch).scale, pinched.anchor, false)
}

function endPinch() {
  pinched = undefined
}

/**
 * The three shortcuts a viewport is expected to answer, taken off the browser's
 * own page zoom: on this page the thing to make larger is the graph.
 *
 * Read off the key the Author pressed *and* off where that key sits, because the
 * character it carries depends on the layout: on a French keyboard the digit row
 * is letters until it is shifted, so `⌘0` arrives as `à` and a shortcut that only
 * knew `event.key` answered nothing at all. `event.code` is the position, which
 * is the same on every layout — and the numeric keypad is named there too, so it
 * comes along for free.
 */
const ZOOMS: Record<string, -1 | 1> = {
  '+': 1,
  '=': 1,
  'Equal': 1,
  'NumpadAdd': 1,
  '-': -1,
  '_': -1,
  'Minus': -1,
  'NumpadSubtract': -1,
}

const FITS = ['0', 'Digit0', 'Numpad0']

function zoomOnKeys(event: KeyboardEvent) {
  if (!(event.metaKey || event.ctrlKey) || !graph.value) return

  const zooming = ZOOMS[event.key] ?? ZOOMS[event.code]
  const fitting = FITS.includes(event.key) || FITS.includes(event.code)
  if (!zooming && !fitting) return

  event.preventDefault()
  return zooming ? zoomBy(zooming) : zoomToFit()
}

/**
 * How far a press may travel and still be a press. The bench does one thing on a
 * press — it closes the panel — and it now does another on a drag, so the two are
 * told apart by how far the hand went before it let go.
 *
 * ponytail: four pixels is the slack in a hand that means to press, felt rather
 * than derived. Raise it the day a press on the bench stops closing the panel
 * under somebody's hand.
 */
const PAN_SLACK = 4

/**
 * The hand pushing the bench about: where it went down, where it was last seen,
 * and which pointer it is. Held while the gesture is live and nothing otherwise,
 * like every other gesture here.
 */
let pushing: { pointerId: number, from: Point, last: Point } | undefined

/**
 * A press on the bare bench. Anywhere that is not a card is the bench — a Cut's
 * line stops its own press from reaching here, so pressing one line while another
 * Cut is in the panel writes the second rather than closing on both, and a press
 * on a card is that card's own drag.
 *
 * The pointer is captured so the push survives the hand leaving the graph, which
 * on a bench pulled back to a quarter is most of the screen.
 */
function pressBench(event: PointerEvent) {
  if ((event.target as Element | null)?.closest('article')) return

  const at = { x: event.clientX, y: event.clientY }
  pushing = { pointerId: event.pointerId, from: at, last: { ...at } }
  // A finger is not captured: the browser is about to scroll the bench itself,
  // and it says so by cancelling the pointer — see `panBench`.
  if (event.pointerType !== 'touch') {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
}

/**
 * The push itself: the view goes the way the hand does, which means the scroll
 * goes the other way. In screen pixels and not surface ones — what is being moved
 * is the window onto the surface, not anything on it.
 *
 * A finger moves nothing here. The browser pans an overflowing box under a touch
 * already, with the momentum that goes with it, and taking that over would be
 * writing a worse one; what a touch does keep is the distance, which is what says
 * whether the press that ends was a press at all.
 */
function panBench(event: PointerEvent) {
  const pushed = pushing
  if (!pushed || event.pointerId !== pushed.pointerId || !graph.value) return

  if (event.pointerType !== 'touch') {
    graph.value.scrollLeft -= event.clientX - pushed.last.x
    graph.value.scrollTop -= event.clientY - pushed.last.y
  }
  pushed.last = { x: event.clientX, y: event.clientY }
}

/**
 * The hand let go. A press that stayed put closes the panel, which is what a
 * press on the bare bench has always done; one that pushed the bench somewhere
 * closes nothing, because moving the view is not saying anything about what is
 * being written.
 */
function releaseBench(event: PointerEvent) {
  const pushed = pushing
  pushing = undefined
  if (!pushed || event.pointerId !== pushed.pointerId) return

  const travelled = Math.hypot(event.clientX - pushed.from.x, event.clientY - pushed.from.y)
  if (travelled < PAN_SLACK) writing.value = undefined
}

/** A push the browser took over — a finger scrolling the bench — moves nothing. */
function letGoOfBench() {
  pushing = undefined
}

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

  return cutLineTo(pointOf(aimed.fromSceneId), aimed.at)
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
  aiming.value.at = pointOnSurface(event)
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
 * arrives under a provisional name with the panel open on that name in a field:
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
    writing.value = { scene: written.id }
    announce(t('editor.cutDrawn', said))
  })

  // After the read the change asks for and the render it causes, which is what
  // puts the field in the page at all. Selected rather than left with a cursor in
  // it: the name is provisional, so the first thing typed replaces it.
  if (!writtenId) return
  await nextTick()
  sceneName.value?.focus()
  sceneName.value?.select()
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
 * way in began it, and the panel at the edge of the bench. Listened for on the
 * document because a gesture by pointer has focus nowhere in particular — the
 * hand is on a strip that is not a control — so there is no element to hang it
 * on.
 */
function letGoOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Not while a confirmation is up. `<dialog>` answers Escape itself, and the
  // control the question was asked from is in the panel: closing the panel out
  // from under that answer would take the focus it hands back with it.
  if (asked.value) return

  abandonAiming()
  closePanel()
}

onMounted(() => {
  document.addEventListener('keydown', letGoOnEscape)
  document.addEventListener('keydown', zoomOnKeys)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', letGoOnEscape)
  document.removeEventListener('keydown', zoomOnKeys)
})

function moveCut(scene: Scene, cut: Cut, step: -1 | 1) {
  return renumber(scene, 'cuts', movedBy(cutsFrom(scene.id).map(held => held.id), cut.id, step))
}

function writeCut(cut: Cut) {
  return write(() => send(`/api/cuts/${cut.id}`, { method: 'PATCH', body: { text: cut.text } }))
}

/**
 * What the panel at the trailing edge of the bench is writing: one Scene, or one
 * Cut, and never both. One panel, so one answer to "what am I writing" — a
 * second would be a second answer, and on a bench where lines cross the two
 * would sit over each other.
 *
 * Held by id, like every other thing the bench holds across a read: a refetch
 * replaces every Scene and every Cut in the Story, and the panel would otherwise
 * be writing into an object nothing draws.
 *
 * What is in the panel is the Author's view of their own graph, so it is written
 * nowhere and lasts as long as the page.
 */
const writing = ref<{ scene: string } | { cut: string }>()

/** The Scene the panel is writing, or nothing when it is writing a Cut. */
const sceneWritten = computed(() => {
  const held = writing.value
  return held && 'scene' in held ? sceneById(held.scene) : undefined
})

/**
 * The Cut the panel is writing, and the two Scenes it joins by name. Nothing at
 * all when a Scene is what is being written, or when the Cut has since gone.
 */
const cutWritten = computed(() => {
  const held = writing.value
  const cut = held && 'cut' in held ? cutById(held.cut) : undefined
  if (!cut) return

  return {
    cut,
    from: sceneNamed(sceneNames.value, cut.fromSceneId, t),
    to: sceneNamed(sceneNames.value, cut.toSceneId, t),
  }
})

function cutById(cutId: string) {
  return story.value?.cuts.find(cut => cut.id === cutId)
}

const sceneName = useTemplateRef<HTMLInputElement>('sceneName')
const cutText = useTemplateRef<HTMLInputElement>('cutText')

/**
 * Puts one Scene in the panel, taking out whatever was there, and takes it out
 * again if it was already the one being written. Focus goes into the name as the
 * panel appears, which is the first field of the Scene and the same promise the
 * Cut's panel makes: a panel nobody can type in is not one the keyboard has
 * reached.
 */
async function writeScene(sceneId: string) {
  if (sceneWritten.value?.id === sceneId) return closePanel()
  writing.value = { scene: sceneId }
  await nextTick()
  sceneName.value?.focus()
}

/**
 * Puts one Cut in the panel, and takes it out again if it was the one being
 * written. Focus goes into the text: pressed by hand that is where the Author was
 * going anyway, and reached from the strip of ways on it is the whole point of
 * the route.
 */
async function openCut(cutId: string) {
  const held = writing.value
  if (held && 'cut' in held && held.cut === cutId) return closePanel()
  writing.value = { cut: cutId }
  await nextTick()
  cutText.value?.focus()
}

/**
 * Closes the panel and puts focus back on the write button of the card it
 * belongs to — the Scene being written, or the Scene a Cut leaves — so the
 * keyboard comes back out onto the bench rather than at the top of the page. A
 * panel closed with the pointer on the bare bench is closed by hand and leaves
 * focus alone: see `releaseBench`.
 *
 * The card's button rather than the control the panel was opened from, which for
 * a Cut is a row of the ways on: one panel holds one thing, so opening a Cut took
 * the Scene out of the panel and that row is no longer in the page to hand focus
 * back to. The card is the one anchor both routes share, and the Cut's panel
 * offers the way back to the Scene's for a hand that wants the row again.
 */
function closePanel() {
  const held = writing.value
  if (!held) return

  const sceneId = 'scene' in held ? held.scene : cutById(held.cut)?.fromSceneId
  writing.value = undefined
  if (sceneId) document.getElementById(`write-${sceneId}`)?.focus()
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
 *
 * Asked at a point rather than of an event, because the run that scrolls a body
 * under a dragged Shot asks it between one move and the next, when the list has
 * come to the hand rather than the other way about.
 */
function rowUnder(at: { clientX: number, clientY: number }, what: 'way' | 'shot') {
  const under = document.elementFromPoint(at.clientX, at.clientY)
  return (under?.closest(`[data-${what}]`) as HTMLElement | null)?.dataset[what]
}

/**
 * The sequence with one thing dropped onto another's Place, or nothing where the
 * row under the hand is not one of this Scene's own: the hit-test that finds a
 * row asks the whole page rather than the one list, so what it comes back with is
 * held against that list before anything is written. A stranger's Place is not a
 * Place here, and a sequence written around one is a numbering the Author never
 * aimed at — one the endpoint would take, because it is still a permutation of
 * what the Scene holds.
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

/**
 * Begins the drag that lays a Scene out. A card is dragged from anywhere on it —
 * there is nothing on it to type into, so the whole box is the handle — bar the
 * controls it carries and the strip down its leading edge, which is where a Cut
 * is drawn from. One test for every control rather than a list of the two or
 * three there are today: a button on a card is pressed, never dragged, and a
 * button added tomorrow is out of the gesture without anyone remembering to say
 * so.
 */
function startDrag(scene: Scene, event: PointerEvent) {
  if ((event.target as Element).closest('button, .strip')) return

  // Capturing the pointer sends the rest of the gesture to the card itself, so
  // dragging survives the pointer leaving the Scene it is dragging.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const at = pointOnSurface(event)
  drag = { id: scene.id, pointerX: at.x, pointerY: at.y, x: scene.x, y: scene.y }
}

function keepDragging(event: PointerEvent) {
  const dragged = drag && sceneById(drag.id)
  if (!drag || !dragged) return
  // In surface pixels at both ends, so the node travels exactly as far as the
  // hand does whatever the bench is being looked at through: a card dragged an
  // inch on a bench pulled back to a quarter crosses four times as much graph.
  const at = pointOnSurface(event)
  dragged.x = withinReach(drag.x + at.x - drag.pointerX)
  dragged.y = withinReach(drag.y + at.y - drag.pointerY)
}

function endDrag() {
  const dropped = drag && sceneById(drag.id)
  drag = undefined
  if (dropped) return moveScene(dropped)
}

/**
 * The keyboard moves a node too — a graph that only answers to a pointer is not
 * one everyone can lay out — so the card itself takes focus and the four arrow
 * keys. How far one press moves it is `NODE_PITCH`, which is also the width of a
 * node's strip and the grid a Scene dropped on the bench snaps to, so the graph
 * is handed it as `--pitch` rather than the twenty being written again in the
 * stylesheet.
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
 * Every Cut as the line that draws it. Every card is `NODE_WIDTH` by
 * `NODE_HEIGHT`, so the box a line leaves and the box it lands on are known from
 * the Story alone: the lines are right in the very first frame, on the server as
 * in the browser, and nothing is measured after a render.
 */
const cutLines = computed(() => story.value?.cuts.map((cut) => {
  const line = cutLine(pointOf(cut.fromSceneId), pointOf(cut.toSceneId))

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

/**
 * Where a Scene's card sits, which with the two constants is the whole of its
 * box. A Cut naming a Scene the bench has not got — read back a moment before
 * the Scene it joins — is drawn from the graph's own corner rather than from
 * nowhere.
 */
function pointOf(sceneId: string): Point {
  const scene = sceneById(sceneId)

  return { x: scene?.x ?? 0, y: scene?.y ?? 0 }
}

/**
 * How many of the ways on leaving a Scene its card names before it starts
 * counting them. Three is what fits the one line the card gives them at this
 * width; past that, what an Author wants off a card is that there are more of
 * them, and the names are read in the panel.
 */
const WAYS_ON_NAMED = 3

/**
 * What a card says about a Scene, under its name: how many Shots are in it, and
 * where its ways on land. The ways on are named rather than counted, because
 * where a Scene leads is the one thing a graph is read for — and the ones past
 * the third are counted, because a card is the same size for every Scene.
 */
function atAGlance(scene: Scene) {
  const shots = countedShots(scene.shots.length)
  const landing = cutsFrom(scene.id).map(cut => sceneNamed(sceneNames.value, cut.toSceneId, t))
  const named = landing.slice(0, WAYS_ON_NAMED).join(', ')
  const rest = landing.length - WAYS_ON_NAMED

  if (!landing.length) return t('editor.glanceNoWayOn', { shots })

  return t('editor.glanceWaysOn', {
    shots,
    waysOn: rest > 0 ? `${named} ${t('editor.moreWaysOn', { count: rest })}` : named,
  })
}
</script>

<template>
  <main @dragover="refuseDrop" @drop="refuseDrop">
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
        <NuxtLink
          class="preview trail"
          data-cue="preview"
          :to="localePath(`/stories/${id}/preview`)"
        >
          {{ $t('editor.preview') }}
        </NuxtLink>
        <button v-if="story?.publishedAt" type="button" @click="unpublish">
          {{ $t('editor.unpublish') }}
        </button>
        <!-- The guided path ends here, so `data-cue` is on this one and not on
             the button that unpublishes: the Cue is met by the Story being
             published, and by then there is nothing left to point at. -->
        <button v-else type="button" class="primary" data-cue="publish" @click="publish">
          {{ $t('editor.publish') }}
        </button>
      </div>
    </header>

    <form class="naming" @submit.prevent="createScene">
      <label class="eyebrow" for="new-scene-name">{{ $t('editor.newSceneName') }}</label>
      <div class="row">
        <!-- `data-cue` is how the guided path finds this field. The attribute
             lives here rather than a selector living in the guidance, so that
             removing the field takes its target with it visibly — see
             `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. -->
        <input
          id="new-scene-name"
          v-model="newSceneName"
          data-cue="new-scene-name"
          required
          :maxlength="SCENE_NAME_MAX_LENGTH"
        >
        <button type="submit">{{ $t('editor.createScene') }}</button>
      </div>
    </form>

    <Refusal :problem="problem" />
    <p v-if="announced" class="toast" role="status">{{ announced }}</p>

    <p v-if="!story?.scenes.length" class="none">{{ $t('editor.noScenes') }}</p>
    <!-- The bench: the graph, and the panel a Scene or a Cut is written in docked
         at its trailing edge. The panel pushes the graph rather than covering it,
         so nothing the Author is working on ends up hidden underneath it. -->
    <div v-else class="bench">
      <!-- The window onto the graph: the box that scrolls, and the zoom controls
           docked in its corner. They are outside the surface, so they keep their
           own size whatever the bench is being looked at through. -->
      <div class="viewport">
        <div
          ref="graph"
          class="graph"
          @pointerdown="pressBench"
          @pointermove="panBench"
          @pointerup="releaseBench"
          @pointercancel="letGoOfBench"
          @wheel="zoomByWheel"
          @gesturestart="startPinch"
          @gesturechange="pinch"
          @gestureend="endPinch"
        >
          <!-- What the bench scrolls: the surface at the size it is drawn at. A
               scale moves nothing in the layout, so this box is what says how far
               there is to go. -->
          <div class="spread" :style="spreadSize">
            <div
              ref="surface"
              class="surface"
              :class="{ eased }"
              :style="{ ...surfaceSize, '--pitch': `${NODE_PITCH}px`, scale: zoom }"
            >
              <!-- The drawing is a pointer's way to a Cut and a second place the one
                   being written is shown; the account of where a Scene leads that
                   anything reads out is the card and the panel — see
                   `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`. So the
                   lines are hidden from what reads the page rather than being the
                   keyboard's route to a Cut. -->
              <svg aria-hidden="true" :style="surfaceSize">
                <defs>
                  <marker
                    id="cut-head" viewBox="0 0 8 8" refX="7" refY="4"
                    markerWidth="8" markerHeight="8" orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" />
                  </marker>
                </defs>
                <g v-for="line in cutLines" :key="line.id" :data-cut="line.id">
                  <!-- The wide invisible stroke behind the line, which is what the
                       hand actually aims at: a Cut is written by pressing its line,
                       and a line and a half of pixels is nobody's idea of a target.
                       The press stops here, so it does not reach the bench that would
                       close the panel it just opened — and its default is refused,
                       because a press on a line focuses nothing and would take the
                       focus off the field the panel has just put it in. -->
                  <line
                    class="aimed"
                    :x1="line.from.x"
                    :y1="line.from.y"
                    :x2="line.to.x"
                    :y2="line.to.y"
                    @pointerdown.stop.prevent="openCut(line.id)"
                  />
                  <line
                    :class="{ lit: cutWritten?.cut.id === line.id }"
                    :x1="line.from.x"
                    :y1="line.from.y"
                    :x2="line.to.x"
                    :y2="line.to.y"
                    marker-end="url(#cut-head)"
                  />
                  <!-- The Place the way on is offered at, on a disc near the Scene it
                       leaves. It reports the order; nothing reads the order back out
                       of the drawing — see
                       `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`. -->
                  <!-- Nine pixels of radius, which is what holds two digits of the
                       data face the number is set in: a Scene offering more than
                       ninety-nine ways on is not a Scene. -->
                  <circle class="disc" :cx="line.disc.x" :cy="line.disc.y" r="9" />
                  <text class="place" :x="line.disc.x" :y="line.disc.y">{{ line.place }}</text>
                </g>

                <!-- The Cut under the Author's hand: the same grease pencil as the
                     Cuts it is dragged across, told apart from them by its dashes
                     marching, and losing its arrowhead where it cannot land. -->
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

              <!-- A Scene's card: what an Author needs to recognise the Scene at a
                   glance, and nothing to type into. It is named by the Scene rather
                   than by its own heading, and it is the whole of the drag that lays
                   the graph out — dragged from anywhere on it bar its controls and the
                   strip, and focusable so the four arrow keys move it too. -->
              <article
                v-for="scene in story.scenes"
                :key="scene.id"
                :data-scene="scene.id"
                tabindex="0"
                :class="{
                  opens: story.openingSceneId === scene.id,
                  writing: sceneWritten?.id === scene.id,
                  drawing: aiming?.fromSceneId === scene.id,
                  lit: mayLandOn(scene),
                  quiet: aiming && !mayLandOn(scene),
                }"
                :aria-label="scene.name"
                :style="{
                  translate: `${scene.x}px ${scene.y}px`,
                  inlineSize: `${NODE_WIDTH}px`,
                  blockSize: `${NODE_HEIGHT}px`,
                }"
                @pointerdown="startDrag(scene, $event)"
                @pointermove="keepDragging"
                @pointerup="endDrag"
                @keydown="nudge(scene, $event)"
              >
                <!-- The strip down the card's leading edge, and where a Cut is drawn
                     from. It runs the card's full height, the gesture is immediate
                     under a finger with no long press, and it carries the mark that
                     says which Scene a Reading opens on.

                     `.self`, because the button it holds is pressed and not dragged: a
                     pointer going down on it would otherwise begin a gesture the click
                     that follows would have to undo. -->
                <div
                  class="strip"
                  data-cue="draw-cut"
                  @pointerdown.self="startAiming(scene, $event)"
                  @pointermove="keepAiming"
                  @pointerup="endAiming"
                  @pointercancel="abandonAiming"
                >
                  <!-- The keyboard's way into the same aiming: a button hidden until
                       it takes focus, the pattern a skip link uses, so the gesture
                       stays the only visible way in while assistive technology still
                       finds a real button with a real name. It says which Scene it
                       draws from, and once a gesture is live it says instead what
                       pressing it would do to that one — land the Cut, or let it go. A
                       Scene the Cut cannot land on offers it disabled, which is how
                       the hand is kept out of a Cut on itself and a second Cut to the
                       same Scene. -->
                  <button
                    type="button"
                    class="aim"
                    :disabled="!!aiming && !mayLandOn(scene) && aiming.fromSceneId !== scene.id"
                    @click="aimOrLand(scene)"
                  >
                    {{ aimingName(scene) }}
                  </button>
                </div>

                <div class="card">
                  <div class="slate">
                    <h2>{{ scene.name }}</h2>

                    <!-- Write, not Open and not Modify: it is the word the code and
                         the glossary already use for putting words into a Story. The
                         panel it opens is elsewhere on the page, so the button says
                         which Scene it is for, and it is where focus comes back to
                         when the panel is closed from the keyboard. -->
                    <button
                      :id="`write-${scene.id}`"
                      type="button"
                      class="write"
                      data-cue="write-scene"
                      :aria-expanded="sceneWritten?.id === scene.id"
                      @click="writeScene(scene.id)"
                    >
                      {{ $t('editor.write') }}
                      <span class="visually-hidden">
                        {{ $t('editor.sceneNamed', { name: scene.name }) }}
                      </span>
                    </button>
                  </div>

                  <div class="summary">
                    <!-- The still of the first Shot, at the size a card can carry it:
                         what an Author recognises a Scene by before they have read a
                         word of it. A Scene whose first Shot has none shows the
                         outline of the frame it would be, the way a Shot with no still
                         does in the panel. -->
                    <div class="frame">
                      <!-- `draggable="false"`, because a browser drags an image out of
                           a page by default and the whole card is the handle that lays
                           the graph out: the native drag took the gesture and the Scene
                           stayed where it was. -->
                      <img
                        v-if="scene.shots[0]?.image"
                        :src="stillOf(scene.shots[0])"
                        :alt="$t('editor.stillOfShot', { place: 1 })"
                        draggable="false"
                      >
                    </div>

                    <p class="glance">{{ atAGlance(scene) }}</p>
                  </div>

                  <!-- The mark that says a Reading opens here, read on the card and
                       set in the panel. The strip wears the grease pencil for it too,
                       which is the same fact said in colour for whoever is looking at
                       the whole bench at once. -->
                  <p v-if="story.openingSceneId === scene.id" class="eyebrow opening-mark">
                    {{ $t('editor.openingScene') }}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>

        <!-- How far back the Author is standing, and the three ways of changing
             it. Docked in the corner of the window rather than laid on the
             surface, so it is the same size at every scale and never lands on a
             Scene — and at the head of it rather than the foot, because a bench
             is taller than most windows and a control below the fold is one the
             Author has to scroll to find. The pointer's own routes are the wheel
             and the pinch; these are what a hand with neither reaches for. -->
        <div class="zooming">
          <button
            type="button"
            :disabled="zoom <= ZOOM_MIN"
            :aria-label="$t('editor.zoomOut')"
            @click="zoomBy(-1)"
          >
            <span aria-hidden="true">&minus;</span>
          </button>
          <!-- The scale as a reading, in the face the bench reads its own
               numbers in. It says what the two buttons have done, so it is named
               for whoever cannot see it move. -->
          <p class="level">
            <span class="visually-hidden">{{ $t('editor.zoomLevel') }}</span>
            {{ zoomShown }}
          </p>
          <button
            type="button"
            :disabled="zoom >= ZOOM_MAX"
            :aria-label="$t('editor.zoomIn')"
            @click="zoomBy(1)"
          >
            <span aria-hidden="true">+</span>
          </button>
          <button type="button" class="fit" @click="zoomToFit">
            {{ $t('editor.fitGraph') }}
          </button>
        </div>
      </div>

      <!-- Where a Scene and a Cut are written: one panel at the trailing edge of
           the bench, holding one or the other and never both. -->
      <!-- A group rather than a landmark: what holds it together is that it is
           one thing being written, and it is named by which thing that is. -->
      <div
        v-if="sceneWritten || cutWritten"
        class="panel"
        role="group"
        :aria-label="sceneWritten
          ? $t('editor.writingScene', { name: sceneWritten.name })
          : $t('editor.writingCutTo', { scene: cutWritten!.to })"
      >
        <!-- The panel is closed explicitly. Drawn at every width rather than only
             below the breakpoint: on a narrow screen it is the whole of the way
             out, because the panel covers the bench there and there is no bare
             bench left to press, and a control that came and went with the width
             would be one an Author had to learn twice. -->
        <button type="button" class="close" @click="closePanel">
          {{ $t('editor.closePanel') }}
        </button>

        <template v-if="sceneWritten">
          <!-- The name is the heading and the heading is written in: a bare field,
               the same idiom as a Shot's text and a Cut's, with no mode to enter
               first.

               The label sits outside the heading rather than in it: a heading is
               named by what it holds, and a label inside would be read out ahead
               of the name the Author is correcting. Outside, the heading is the
               field's value and nothing else. It is also the one control here that
               does not carry the Scene's name after it — this field's own value is
               that name, and a label carrying it would rename the field under the
               Author as they typed. Which Scene the panel is on is what the panel
               itself is named. -->
          <label class="visually-hidden" :for="`scene-name-${sceneWritten.id}`">
            {{ $t('editor.sceneName') }}
          </label>
          <h2 class="named">
            <input
              :id="`scene-name-${sceneWritten.id}`"
              ref="sceneName"
              v-model="sceneWritten.name"
              :maxlength="SCENE_NAME_MAX_LENGTH"
              @change="renameScene(sceneWritten)"
            >
          </h2>

          <div class="standing">
            <!-- `data-cue` is on the line rather than on the radio: the spotlight
                 is a rectangle, and a radio's own is a dot beside the words that
                 say what it marks. -->
            <p class="opening" data-cue="opening-scene">
              <input
                :id="`opening-${sceneWritten.id}`"
                type="radio"
                name="opening-scene"
                :checked="story.openingSceneId === sceneWritten.id"
                @change="openOn(sceneWritten)"
              >
              <label class="eyebrow" :for="`opening-${sceneWritten.id}`">
                {{ $t('editor.openingScene') }}
                <span class="visually-hidden">{{ sceneWritten.name }}</span>
              </label>
            </p>

            <button type="button" class="danger" @click="deleteScene(sceneWritten)">
              {{ $t('editor.deleteScene') }}
              <span class="visually-hidden">{{ sceneWritten.name }}</span>
            </button>
          </div>

          <!-- The Shots as the run they are: numbered from one for the Author,
               though the Scene counts from zero, and each one's number sits in
               the gutter where the edge code would be. -->
          <ol class="shots">
            <li
              v-for="(shot, place) in sceneWritten.shots"
              :key="shot.id"
              :data-shot="shot.id"
              :class="{
                dragged: draggedShot?.shotId === shot.id,
                under: draggedShot?.over === shot.id && draggedShot.shotId !== shot.id,
              }"
            >
              <!-- The number alone in the gutter, where a frame's edge code would
                   be, and the word it is a number of kept for anyone listening. It
                   is also the handle the Shot is dragged by: the gutter holds
                   nothing else, and the number is what the Author refers to the
                   Shot as, so there is no second grip to explain. -->
              <label
                class="shot-number"
                :for="`shot-${shot.id}`"
                @pointerdown="startShotDrag(shot, $event)"
                @pointermove="keepShotDrag"
                @pointerup="endShotDrag(sceneWritten)"
                @pointercancel="cancelShotDrag"
              >
                <span class="visually-hidden">{{ $t('editor.shot') }} </span>{{ place + 1 }}
              </label>
              <div class="written">
                <textarea
                  :id="`shot-${shot.id}`"
                  v-model="shot.text"
                  data-cue="shot-text"
                  rows="2"
                  :maxlength="SHOT_TEXT_MAX_LENGTH"
                  @change="writeShot(shot)"
                />

                <!-- The thumbnail is the picker: pressing it is how a still is
                     attached and how it is replaced, and the input doing the work
                     is behind it, focusable and named as it was. A Shot carrying
                     no still shows the outline of the thumbnail it would have, so
                     one nobody has finished reads as unfinished. It is also where
                     a file is dropped, which is the same file the picker would
                     have handed over. -->
                <div class="still">
                  <label
                    :class="{ over: fileOver === shot.id }"
                    @dragenter.prevent.stop="overStill(shot, $event)"
                    @dragover.prevent.stop="overStill(shot, $event)"
                    @dragleave="leaveStill(shot, $event)"
                    @drop.prevent.stop="dropStill(shot, $event)"
                  >
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
                     drawing a second Scene to hold the changed line.

                     The guided path points at the whole list rather than at one
                     field of it, because what it asks for is a Condition and a
                     Condition is the row it is added as: `data-cue` lands on the
                     component's own root, which is that list. -->
                <Conditions
                  data-cue="shot-condition"
                  :lead="$t('editor.playedWhen')"
                  :carrier="$t('editor.shotOfScene', {
                    place: place + 1,
                    scene: sceneWritten.name,
                  })"
                  :conditions="shot.conditions"
                  :scenes="story.scenes"
                  :counting="sceneWritten.id"
                  :id="shot.id"
                  @write="writeConditions('shots', shot.id, shot.conditions)"
                />

                <!-- The three controls, as the marks they do rather than the
                     sentences that name them: in the width the panel gives a Shot
                     the three sentences fill the strip to its end and wrap out of
                     it in the longer of the two languages. What each one says is
                     not lost, it moves to where the Shot's other names are read,
                     by assistive technology alone. -->
                <div class="row marks">
                  <button
                    type="button"
                    :disabled="place === 0"
                    @click="moveShot(sceneWritten, shot, -1)"
                  >
                    <span aria-hidden="true">↑</span>
                    <span class="visually-hidden">
                      {{ $t('common.moveEarlier') }}
                      {{ $t('editor.shotNumber', { place: place + 1 }) }}
                    </span>
                  </button>
                  <button
                    type="button"
                    :disabled="place === sceneWritten.shots.length - 1"
                    @click="moveShot(sceneWritten, shot, 1)"
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

          <button type="button" @click="addShot(sceneWritten)">
            {{ $t('editor.addShot') }}
            <span class="visually-hidden">
              {{ $t('editor.toScene', { name: sceneWritten.name }) }}
            </span>
          </button>

          <p class="sets">
            <label class="eyebrow" :for="`flags-${sceneWritten.id}`">
              {{ $t('editor.flagsSet') }}
              <span class="visually-hidden">{{ sceneWritten.name }}</span>
            </label>
            <textarea
              :id="`flags-${sceneWritten.id}`"
              class="data"
              data-cue="scene-flags"
              rows="2"
              :value="flagLines(sceneWritten.sets)"
              :placeholder="$t('editor.flagsPlaceholder', { separator: FLAG_SEPARATOR })"
              @change="writeFlags(sceneWritten, ($event.target as HTMLTextAreaElement).value)"
            />
          </p>

          <!-- The ways on, bare: each one's Place, the name it arrives at, and the
               two controls that renumber it. A Cut's text and its Conditions are
               written in the panel a way on hands over to, and what stays here is
               what an Author cannot read a Cut without — where the Scene leads,
               and in what order — which is also the route to a Cut for a hand that
               is not on a pointer. -->
          <div class="ways">
            <p :id="`ways-${sceneWritten.id}`" class="eyebrow">
              {{ $t('editor.waysOn') }}
              <span class="visually-hidden">
                {{ $t('editor.fromScene', { name: sceneWritten.name }) }}
              </span>
            </p>

            <p v-if="!cutsFrom(sceneWritten.id).length" class="none">
              {{ $t('editor.noWayOnYet') }}
            </p>
            <ol v-else :aria-labelledby="`ways-${sceneWritten.id}`">
              <li
                v-for="(cut, place) in cutsFrom(sceneWritten.id)"
                :key="cut.id"
                :data-way="cut.id"
                :class="{
                  dragged: draggedWay?.cutId === cut.id,
                  under: draggedWay?.over === cut.id && draggedWay.cutId !== cut.id,
                }"
              >
                <!-- The row is pressed to write the Cut and dragged to renumber
                     it: one control, because the strip holds three things and a
                     fourth grip for the drag would be a way on read as a toolbar.
                     Its Place is the number it is offered at, so a row says which
                     Cut it is before it is opened. -->
                <button
                  :id="`way-${cut.id}`"
                  type="button"
                  class="way"
                  @pointerdown="startWayDrag(cut, $event)"
                  @pointermove="keepWayDrag"
                  @pointerup="endWayDrag(sceneWritten)"
                  @pointercancel="draggedWay = undefined"
                  @click="pressWay(cut)"
                >
                  <span class="numbered">{{ place + 1 }}</span>
                  {{ sceneNames.get(cut.toSceneId) }}
                  <span class="visually-hidden">
                    {{ $t('editor.wayOnFrom', { name: sceneWritten.name }) }}
                  </span>
                </button>

                <button
                  type="button"
                  :disabled="place === 0"
                  @click="moveCut(sceneWritten, cut, -1)"
                >
                  {{ $t('common.moveEarlier') }}
                  <span class="visually-hidden">
                    {{ $t('editor.theCutTo', { scene: sceneNames.get(cut.toSceneId) }) }}
                  </span>
                </button>
                <button
                  type="button"
                  :disabled="place === cutsFrom(sceneWritten.id).length - 1"
                  @click="moveCut(sceneWritten, cut, 1)"
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

        <template v-else-if="cutWritten">
          <!-- The Cut names the Scene it leaves, and the name is the way back: a
               Cut is written in the same panel the Scene was, so the panel that
               took the Scene's place hands it back. -->
          <button
            type="button"
            class="back trail"
            @click="writeScene(cutWritten.cut.fromSceneId)"
          >
            {{ $t('editor.backToScene', { name: cutWritten.from }) }}
          </button>

          <label class="eyebrow" :for="`cut-${cutWritten.cut.id}`">
            {{ $t('cut.to', { scene: cutWritten.to }) }}
          </label>
          <input
            :id="`cut-${cutWritten.cut.id}`"
            ref="cutText"
            v-model="cutWritten.cut.text"
            :maxlength="CUT_TEXT_MAX_LENGTH"
            @change="writeCut(cutWritten.cut)"
          >

          <Conditions
            :lead="$t('editor.offeredWhen')"
            :carrier="$t('editor.theCutTo', { scene: cutWritten.to })"
            :conditions="cutWritten.cut.conditions"
            :scenes="story.scenes"
            :counting="cutWritten.cut.fromSceneId"
            :id="cutWritten.cut.id"
            @write="writeConditions('cuts', cutWritten.cut.id, cutWritten.cut.conditions)"
          />

          <!-- The deliberate route to a second way on to the same Scene, which the
               aiming gesture withholds so that the hand cannot draw one by
               accident. -->
          <button type="button" @click="duplicateCut(cutWritten.cut)">
            {{ $t('editor.duplicateCutTo', { scene: cutWritten.to }) }}
          </button>

          <button type="button" class="danger" @click="deleteCut(cutWritten.cut)">
            {{ $t('editor.deleteCutTo', { scene: cutWritten.to }) }}
          </button>
        </template>
      </div>
    </div>

    <Confirmation :asked="asked" @answer="answer" />
    <!-- The step the bench is asking for, if it is asking for one. Last, so it
         is drawn over the bench it is lighting a part of. -->
    <Cue :story="story ?? undefined" :writing="sceneWritten?.id" />
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

/* The bench: the graph, and the panel docked at its trailing edge. The panel is
   a column of the bench rather than something floating over it, so it pushes the
   graph narrower instead of covering whatever the Author was working on. Its
   height is named here because both columns are that tall. */
.bench {
  /* ponytail: the bench can be dragged taller, and `--bench-height` does not
     follow it, so the panel keeps the height the bench started at. Measure the
     bench the day an Author complains. */
  --bench-height: min(70dvh, 44rem);

  display: flex;
  align-items: start;
  gap: var(--s3);
  /* The bench is a cell of the page's own grid, and what is inside it is a
     surface a great deal wider than the screen: without this the cell is sized to
     the graph and the whole page scrolls sideways instead of the bench. */
  min-inline-size: 0;
}

.viewport {
  /* Whatever the panel leaves, and never less than nothing: a graph that refused
     to be narrowed would push the panel off the screen instead. */
  position: relative;
  flex: 1;
  min-inline-size: 0;
  /* And never anything to do with what is inside it. The surface is as wide as
     the Scenes an Author has dragged apart — ten thousand pixels of it are within
     reach — and the window onto it is a window: it takes the width the bench
     leaves and the graph scrolls or is pushed about inside it. Size containment
     says that in one word, so no engine's reading of an automatic minimum size
     can hand the frame its content's width instead. */
  contain: inline-size;
}

.graph {
  overflow: auto;
  resize: vertical;
  block-size: var(--bench-height);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--bench) 70%, black);
}

/* The zoom controls, in the corner of the window and not on the surface: they
   are the same size at every scale. At the head of the bench and at its trailing
   edge — a bench is `min(70dvh, 44rem)` tall and the Scenes are laid out in
   columns from the leading edge, so this is the one corner that is both empty and
   certain to be on screen. Lifted off the graph the way the confirmation and the
   Cue's bubble are, because it is the machine talking rather than part of the
   drawing. */
.zooming {
  position: absolute;
  inset-block-start: var(--s3);
  inset-inline-end: var(--s3);
  display: flex;
  align-items: center;
  gap: var(--s1);
  padding: var(--s1);
  border: 1px solid var(--light);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

.zooming button {
  padding: var(--s1) var(--s2);
  line-height: 1;
}

/* The reading between the two buttons, in the face the interface sets its own
   numbers in, and wide enough for three digits so the buttons do not shuffle
   about as the scale changes. */
.zooming .level {
  min-inline-size: 4ch;
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
  text-align: center;
}

.surface {
  position: relative;
  /* The scale is taken from the surface's own corner, which is the corner the
     nodes are placed from: what is drawn at half size is the whole graph, and a
     Scene's coordinates are untouched by it. */
  transform-origin: 0 0;
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

/* A step of the zoom travels, so that what moved can be seen to have moved. The
   wheel is not eased — it is continuous already, and easing it would leave the
   surface a frame behind the hand. Under `prefers-reduced-motion` this is cut to
   a single tick with every other transition on the page, by the block at the foot
   of `app/assets/css/frameline.css`: the scale is simply the new one. */
.surface.eased {
  transition: scale 120ms ease-out;
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

/* A card is two columns of a fixed box: the strip down its leading edge, and the
   Scene at a glance beside it. Every card is the same size, which is what lets a
   Cut's line be drawn against a geometry nobody has to measure. The width is the
   one a phone can show, and the strip comes out of it rather than adding to it.

   The whole card is the handle that lays the graph out, so it takes the drag
   rather than passing it to a scroller — the two controls on it are pressed, and
   `startDrag` leaves them alone. */
article {
  position: absolute;
  display: grid;
  grid-template-columns: var(--pitch) minmax(0, 1fr);
  /* Nothing on a card scrolls: what does not fit is clipped by the box, which has
     machined corners of its own. */
  overflow: hidden;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
  cursor: move;
  touch-action: none;
}

/* Whichever card is being worked on comes to the front, so two dragged over each
   other are both reachable. */
article:focus-within {
  z-index: 1;
  border-color: color-mix(in oklab, var(--light) 45%, var(--edge));
}

/* The Scene the panel is writing, said on the bench as well: the Author's eye is
   on the graph, and the panel is at the edge of it.

   Not `.written`, which is a Shot's own block of writing in the panel and carries
   a grid gap: a card wearing that class inherited the gap and shifted its own
   face eight pixels sideways the moment its Scene was opened. */
article.writing {
  border-color: var(--light);
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

/* The strip: a groove down the card's leading edge, running its full height
   because it is a column of the card. The Scene a Reading starts on has it filled
   with the grease pencil, so the Author can see where the Story opens without
   reading a single word — the card says it in words as well, for whoever is not
   reading the colour. */
.strip {
  position: relative;
  border-inline-end: 1px solid var(--edge);
  background: color-mix(in oklab, var(--bench) 60%, transparent);
  /* The hand draws a Cut from here, and a finger draws one without waiting. */
  cursor: crosshair;
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

/* The card's face: the Scene's name and the button that writes it, the still of
   its first Shot with what the Scene is at a glance, and the mark that says a
   Reading opens here. Three rows in a fixed box, so what is on a card is what
   fits one. */
.card {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: var(--s2);
  padding: var(--s2) var(--s3) var(--s3);
  overflow: hidden;
  /* The card is the handle, so a drag across it moves the Scene rather than
     sweeping a selection through its name and the line under it. */
  user-select: none;
}

/* The slate: the Scene's name, and the button that opens the panel it is written
   in. */
.slate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  padding-block-end: var(--s2);
  border-block-end: 1px solid var(--edge);
}

/* A card is one line of name, whatever the Author called the Scene: a long name
   is cut off rather than pushing the button off the card or the still off the
   bottom of it. */
.slate h2 {
  min-inline-size: 0;
  overflow: hidden;
  font-size: 1rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* The panel's heading, as it is written in: the field inside is the heading's own
   type on the panel's own ground — dressed as the heading it replaces, not as
   another box — and the line under it is all that says it is a field. Focus is
   left to the outline every control here is given. */
.named {
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

/* The one thing done to a Scene from its card: writing it. A target a thumb can
   find on a phone rather than the size of its ten-pixel label, and a pointer
   rather than the card's own move cursor, because this is pressed and not
   dragged. */
.write {
  flex: none;
  min-block-size: 2.25rem;
  padding: var(--s1) var(--s3);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}

/* The still of the first Shot, and what the Scene is at a glance beside it. */
.summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--s2);
}

/* The frame the first Shot's still is shown in, drawn whether or not there is a
   still to put in it: an empty one is the outline of the still nobody has
   attached, which is how an unfinished Scene reads as unfinished. */
.frame {
  inline-size: 5.5rem;
  block-size: 3.5rem;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

.frame img {
  display: block;
  /* Safari drags an image by itself whatever the attribute says. */
  -webkit-user-drag: none;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  border-radius: inherit;
}

/* What the card says: read at a glance, so it is a line of quiet type beside the
   still and not a table of counts. Held to three lines, because every card is the
   size of every other one and a Scene with a long list of ways on would otherwise
   run out of the box. */
.glance {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.8125rem;
}

/* The mark that says a Reading opens on this Scene, at the foot of the card in
   the grease pencil the strip is filled with: the same fact, in words. */
.opening-mark {
  align-self: end;
  color: var(--grease);
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
     the same renumbering through the two controls under every Shot. What the
     number does refuse is being selected: a mouse held down on text drags a
     selection, and the browser scrolls the bench and the page after it — which is
     the graph moving under a gesture that is about one node's run. */
  user-select: none;
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
   carries, and leaves the panel's height to the Flags and the Cuts. The
   Description sits beside it, in the width the browser's own file chrome used to
   take. */
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

/* While a file is over the thumbnail: the grease pencil a dragged Shot and a Cut
   being drawn both wear, because it is the same promise — this is what letting go
   would do. Drawn in the tokens rather than left to the browser, which marks a drop
   target in nothing this room owns. */
.still > label.over {
  border-color: var(--grease);
  background: color-mix(in oklab, var(--grease) 12%, var(--bench));
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
   between it and the Flags above it — the panel holds three things, and the space
   between them is what says so. */
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

/* The panel a Scene or a Cut is written in, docked at the trailing edge of the
   bench. Three hundred and eighty pixels is a node's own width and a little over:
   wide enough for a Shot's text, its still and its Description on the lines they
   sit on inside a node today, and narrow enough to leave the graph most of the
   screen. It is as tall as the bench and scrolls inside itself, so a Scene of
   twenty Shots is read here rather than down the page. */
.panel {
  flex: none;
  display: grid;
  gap: var(--s2);
  align-content: start;
  justify-items: start;
  inline-size: 380px;
  /* As tall as what is being written and no taller, up to the height of the
     bench, past which it scrolls inside itself. A Cut is three controls and a
     line of text, so a panel held at the bench's full height would be mostly
     empty steel; a Scene of twenty Shots is read here rather than down the page. */
  max-block-size: var(--bench-height);
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  box-shadow: var(--lifted);
}

/* Everything in the panel is one column of it, whatever the grid would rather do
   with a lone button. */
.panel > * {
  justify-self: stretch;
}

.close,
.back {
  justify-self: start;
}

/* On a phone the graph is worked on a screen narrower than a node, so it is
   given more of the screen's height rather than a slice of it. In `dvh`, because
   a browser's own chrome comes and goes and `vh` would leave the bench taller
   than the screen it is on — three nested scrollbars deep.

   There is no room beside the graph at this width, so the panel stops being a
   column of the bench and covers it instead — which is why it carries a control
   that closes it: on a wide screen the graph is still there to press. */
@media (max-width: 44rem) {
  .bench {
    --bench-height: 70dvh;
  }

  .panel {
    position: fixed;
    inset: 0;
    z-index: 3;
    inline-size: auto;
    block-size: auto;
    /* The page's own margin, because at this width the panel *is* the page. */
    padding: var(--s4);
    border: none;
    border-radius: 0;
  }
}
</style>
