<script setup lang="ts">
/**
 * The Graph and the gestures on it: the Scenes as cards laid out on a surface,
 * the Exits drawn between them, the row of controls above the bench, and every
 * hand that moves any of it — a node dragged, an Exit aimed, the bench pushed
 * about, the scale pulled back. See
 * `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`.
 *
 * Which Scene is being written is not decided here. The card says which Scene the
 * writing surface should hold and asks the page to change it, so that one surface
 * answers to one page: see
 * `docs/adr/0011-the-scene-editor-is-the-scenes-own-node.md`, whose single surface
 * this is half of. An Exit is decided here, because it is written here — on its
 * own line, where it can be seen leading somewhere.
 *
 * While a Scene is being written the graph is folded into a rail: the same
 * drawing at the scale that fits it, kept for what an Author recognises their own
 * Story by, and pressed rather than laid out. See
 * `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`.
 */
const { id, story, sceneWritten, asking, change, write, announce, imageOf } = defineProps<{
  /**
   * The Story's own id, which a Scene is created against. It comes from the route
   * rather than from the Story, because the form that names one stands there
   * while a refused read has left the bench holding no Story at all.
   */
  id: string
  /** The Story the bench is on, or nothing where the read was refused. */
  story?: StoryInEditor
  /** The Scene the writing surface is on, which its card is lit for. */
  sceneWritten?: string
  /** Whether a confirmation is up, which Escape belongs to rather than to the aiming. */
  asking: boolean
  /** The one holder every write on this page goes through. */
  change: Change
  /** The same holder, for what the Author typed rather than what they clicked. */
  write: Write
  /** What the bench has just done, said once and gone. */
  announce: (said: string) => void
  /** Where a Shot's image is asked for, under the time it was last attached. */
  imageOf: (shot: Shot) => string
}>()

/**
 * What the graph asks of the page: which Scene the writing surface should hold,
 * and the one press that takes what is in it out again. The Scene is the page's,
 * so the graph says what happened and the page decides what is written. An Exit
 * is not in there at all — it is written on its own line, here.
 */
const emit = defineEmits<{ writeScene: [string], letGo: [] }>()

const { t, locale } = useI18n()

const sceneNames = computed(
  () => new Map(story?.scenes.map(scene => [scene.id, scene.name])),
)

/**
 * The name of the Scene an Author is asking to be taken to, while they are typing
 * it. A Story of forty Scenes had no way to reach one but to find its card: on a
 * bench pulled back to a quarter the names are small, and folded into a rail they
 * are gone — so the one thing an Author always has, the Scene's own name, was the
 * one thing they could not use. It is also the last thing the canvas was needed
 * for: see `docs/adr/0034-a-story-is-written-without-the-canvas.md`.
 *
 * A field with the names behind it rather than a list of them, because the list is
 * already on the bench: what this adds is the keyboard, and the browser's own
 * completion is what everybody already knows how to type into.
 */
const reaching = ref('')

/**
 * Puts the Scene the Author named on the writing surface. Where two Scenes share a
 * name the first is the one opened — nothing here can tell them apart, and
 * refusing to open either would be worse than opening one of them. A name that
 * matches nothing is left in the field: the Author is halfway through typing it,
 * and a field emptied under them would take the half back.
 */
function reachScene() {
  const named = story?.scenes.find(scene => scene.name === reaching.value)
  if (!named) return

  reaching.value = ''
  emit('writeScene', named.id)
}

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
 * The scale as the graduation carries it: whole percentages, which is what a
 * slider can be dragged and arrow-keyed along. The reading beside it is the same
 * number in the Locale's own way of writing one, so the two never disagree.
 */
const ZOOM_GRADUATION = { min: ZOOM_MIN * 100, max: ZOOM_MAX * 100 }

const graduated = computed(() => Math.round(zoom.value * 100))

/**
 * Which key the shortcuts are written with. The two platforms name it
 * differently, and a hint that names the wrong one is worse than no hint at all.
 * Asked of the browser after the page is in one — the server has no platform to
 * ask — and Command until then, because that is what most of this bench is opened
 * on.
 */
const modifier = ref(t('editor.commandKey'))

onMounted(() => {
  // `platform` is the deprecated one and the only one every browser answers:
  // `userAgentData` is Chromium's alone.
  if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    modifier.value = t('editor.controlKey')
  }
})

/**
 * The graph is as large as the Scenes in it, so it scrolls no further than them.
 * In surface pixels, which is what a Scene's placement is in and what the lines
 * are drawn in: the scale the bench is looked at through is not in here.
 */
const graphSize = computed(() => {
  const scenes = story?.scenes ?? []
  const furthest = (of: (scene: Scene) => number) => Math.max(0, ...scenes.map(of))

  return {
    width: furthest(scene => scene.x) + NODE_WIDTH + NODE_GAP,
    height: furthest(scene => scene.y) + NODE_HEIGHT + NODE_GAP,
  }
})

/**
 * How wide the rail is, in pixels of the screen. The number is here rather than
 * in the stylesheet because the scale below is arithmetic on it: a Story spread
 * over ten thousand pixels is folded further than a small one, and both are drawn
 * whole.
 */
const RAIL_WIDTH = 160

/** Whether the graph is folded, which is the same fact as a Scene being written. */
const folded = computed(() => !!sceneWritten)

const railZoom = computed(() => Math.min(1, RAIL_WIDTH / graphSize.value.width))

/**
 * The scale the surface is actually drawn at: how far back the Author is
 * standing, or — folded — as far back as the rail's width asks. The Author's own
 * scale is left alone while the rail is drawn, so unfolding gives it back.
 */
const drawnAt = computed(() => (folded.value ? railZoom.value : zoom.value))

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
  width: `${graphSize.value.width * drawnAt.value}px`,
  height: `${graphSize.value.height * drawnAt.value}px`,
}))

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
    { x: at.clientX, y: at.clientY }, surface.value!.getBoundingClientRect(), drawnAt.value)
}

/**
 * Where a pointer is on the surface, with the hand kept on the bench: a point
 * outside the window onto the graph is read at the edge of it instead.
 *
 * What this is for is the two gestures that put something somewhere. The panel
 * opens beside the graph and narrows it, so the hand that is still holding a card
 * can be over the panel — and a node that went on following it would be dropped
 * where the Author cannot see it and never aimed it. Held at the edge, the card
 * stops at the edge of the bench, which is where they can see it stop. The line
 * of an Exit being drawn reaches the same edge and no further, for the same reason:
 * it can only land on something that is on the bench.
 */
function pointOnBench(at: { clientX: number, clientY: number }) {
  const box = graph.value!.getBoundingClientRect()

  return pointOnSurface({
    clientX: Math.min(box.right, Math.max(box.left, at.clientX)),
    clientY: Math.min(box.bottom, Math.max(box.top, at.clientY)),
  })
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
 * Where the bench is scrolled to, kept as the Author scrolls it rather than read
 * when it folds. A box narrowed to a rail has its own scroll clamped to what fits
 * the rail, and the surface a Scene is written on is in the page before this
 * component hears that it folded: asked then, the browser answers with the
 * clamped number and the Author is given back somewhere they never were.
 *
 * The scale needs no keeping of its own — the rail draws at its own and leaves
 * `zoom` where the Author left it — and both are given back on unfolding, because
 * a fold that forgets is a fresh search rather than a fold. See
 * `docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`.
 */
let leftAt = { x: 0, y: 0 }

function rememberScroll() {
  const scroller = graph.value
  if (folded.value || !scroller) return

  leftAt = { x: scroller.scrollLeft, y: scroller.scrollTop }
}

watch(folded, (folding) => {
  // The fold is a state the bench is in rather than a step of the zoom, so the
  // scale arrives instead of travelling: a scale in transit is a scroll extent in
  // transit — the surface is drawn through a transform and what a box scrolls
  // across is what is drawn in it — and the place the Author left would be given
  // back clamped to a rail the graph is halfway out of.
  eased.value = false
  if (folding) {
    return
  }

  return nextTick(() => {
    const scroller = graph.value
    if (!scroller) return

    // Measured before it is scrolled, which is what settles the layout the render
    // has just changed: a scroll written against the rail's own extent is clamped
    // to it, and the Author is given back the corner of the bench instead of the
    // place they left.
    void scroller.scrollWidth
    scroller.scrollTo(leftAt.x, leftAt.y)
  })
})

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
 * The scale an Author asked for outright, off the graduation. Not eased: the
 * thumb is already travelling under their hand, and a scale easing after it would
 * arrive where the hand no longer is.
 */
function zoomToScale(percent: number) {
  if (graph.value) zoomAbout(percent / 100, middleOfBench(), false)
}

/**
 * Far enough back to see the whole Story at once — or as far back as the bench
 * goes, on a Story larger than a quarter of the screen can hold, which is the
 * bound doing its job rather than the fit failing.
 *
 * The one route that anchors on nothing. Every other way of zooming holds a point
 * where it was, because the Author is looking at that point; this one is what they
 * press when they have lost the work — pushed the bench into the room around it,
 * or dragged a Scene somewhere they cannot find — so it goes to the corner the
 * Scenes are laid out from and shows the whole of them.
 */
function zoomToFit() {
  const scroller = graph.value
  if (!scroller) return

  const { width, height } = graphSize.value
  zoomAbout(Math.min(scroller.clientWidth / width, scroller.clientHeight / height), { x: 0, y: 0 })
  return nextTick(() => {
    scroller.scrollLeft = 0
    scroller.scrollTop = 0
  })
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
  // The rail is drawn at the width's own scale, so there is nothing here to pull
  // back from — and the default is still refused, or the page would zoom instead.
  if (folded.value) return

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
  if (folded.value) return
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
  if (!(event.metaKey || event.ctrlKey) || !graph.value || folded.value) return

  const zooming = ZOOMS[event.key] ?? ZOOMS[event.code]
  const fitting = FITS.includes(event.key) || FITS.includes(event.code)
  if (!zooming && !fitting) return

  event.preventDefault()
  return zooming ? zoomBy(zooming) : zoomToFit()
}

/**
 * How far a press may travel and image be a press. The bench does one thing on a
 * press — it closes the panel — and it now does another on a drag, so the two are
 * told apart by how far the hand went before it let go.
 *
 * ponytail: four pixels is the slack in a hand that means to press, felt rather
 * than derived. Raise it the day a press on the bench stops closing the panel
 * under somebody's hand.
 */
const PAN_SLACK = 4

/**
 * The hand pushing the bench about: which pointer it is, where it went down, and
 * where the bench was scrolled to when it did. Held while the gesture is live and
 * nothing otherwise, like every other gesture here.
 *
 * The scroll at the start rather than the scroll a moment ago, because the view
 * is written from the origin of the gesture every time. Taking the difference
 * from the last position and subtracting it read the browser's own `scrollTop`
 * back on every event, and that value is quantised: half a pixel of rounding an
 * event, always the same way, is four pixels of drift in eight events and a great
 * deal more under a trackpad, which sends scores of them. The bench has to arrive
 * exactly where the hand put it.
 */
let pushing: { pointerId: number, from: Point, scroll: Point } | undefined

/**
 * A press on the bare bench. Anywhere that is not a card is the bench — an Exit's
 * line stops its own press from reaching here, so pressing one line while another
 * Exit is in the panel writes the second rather than closing on both, and a press
 * on a card is that card's own drag.
 *
 * The pointer is captured so the push survives the hand leaving the graph, which
 * on a bench pulled back to a quarter is most of the screen.
 */
function pressBench(event: PointerEvent) {
  if ((event.target as Element | null)?.closest('article') || !graph.value) return

  pushing = {
    pointerId: event.pointerId,
    from: { x: event.clientX, y: event.clientY },
    scroll: { x: graph.value.scrollLeft, y: graph.value.scrollTop },
  }
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
 * writing a worse one. How far the press travelled is read off where it went down
 * when it is let go, so a touch still says whether it was a press at all.
 */
function panBench(event: PointerEvent) {
  const pushed = pushing
  if (!pushed || event.pointerId !== pushed.pointerId || !graph.value) return
  if (event.pointerType === 'touch') return

  graph.value.scrollLeft = pushed.scroll.x - (event.clientX - pushed.from.x)
  graph.value.scrollTop = pushed.scroll.y - (event.clientY - pushed.from.y)
}

/**
 * The hand let go. A press that stayed put lets go of what is being written —
 * the Exit on its line here, and the Scene in the page's own surface — which is
 * what a press on the bare bench has always done; one that pushed the bench
 * somewhere lets go of nothing, because moving the view is not saying anything
 * about what is being written.
 */
function releaseBench(event: PointerEvent) {
  const pushed = pushing
  pushing = undefined
  if (!pushed || event.pointerId !== pushed.pointerId) return

  const travelled = Math.hypot(event.clientX - pushed.from.x, event.clientY - pushed.from.y)
  if (travelled >= PAN_SLACK) return

  // Focus is left where the hand is: a press on the bare bench says nothing about
  // where the keyboard should be.
  emit('letGo')
}

/** A push the browser took over — a finger scrolling the bench — moves nothing. */
function letGoOfBench() {
  pushing = undefined
}

/**
 * The Exit being drawn by hand, held while the gesture is live and nothing
 * otherwise. `landsOn` is worked out once, when the gesture begins: it depends
 * on the departing Scene and the Exits already leaving it, and neither changes
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
  /**
   * The Exit being led somewhere else, where the gesture took hold of one that is
   * already drawn, and nothing where it is drawing a new one. Which of the two is
   * happening is the only thing that differs between them: the same line follows
   * the hand, the same Scenes are lit, and the same key lets go.
   */
  led?: string
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

  return exitLineTo(pointOf(aimed.fromSceneId), aimed.at)
})

/**
 * Whether the line would land where it is. The arrowhead is what says "this will
 * land", so over a Scene that cannot take the Exit it is taken off — said before
 * the Author lets go rather than after. Over the bare bench the head stays: there
 * is nothing there to refuse it.
 */
const landing = computed(
  () => !aiming.value?.over || aiming.value.landsOn.has(aiming.value.over))

/**
 * Begins the aiming, from any of the ways in. The pointer on an edge, the pointer
 * on an Exit's endpoint, the hidden button and the panel all enter this one state
 * rather than four that have to be kept in agreement.
 *
 * An Exit being led elsewhere is aimed from the Scene it leaves, which is why the
 * Scenes it may land on are the same set as for one being drawn: the Scene it
 * leaves is out, and so is every Scene that Scene already reaches — including the
 * one this very Exit reaches, so letting go where it already leads leaves it
 * alone.
 */
function aimFrom(scene: Scene, led?: Exit) {
  aiming.value = {
    fromSceneId: scene.id,
    landsOn: scenesAExitMayLandOn(story?.scenes ?? [], story?.exits ?? [], scene.id),
    led: led?.id,
  }
  announce(led
    ? t('editor.leadingExit', {
        from: scene.name,
        to: sceneNamed(sceneNames.value, led.toSceneId, t),
      })
    : t('editor.aimingFrom', { name: scene.name }))
}

function startAiming(scene: Scene, event: PointerEvent) {
  if (folded.value) return
  // Capturing the pointer sends the rest of the gesture to the rim itself, so
  // the line goes on following a hand that has left the node it started on.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  aimFrom(scene)
}

/**
 * The hand taking hold of an Exit's endpoint. Where it began is what tells this
 * gesture from the one that draws a new Exit — an endpoint rather than an edge —
 * and from there the two are the same gesture with the same ends.
 */
function startLeading(exitId: string, event: PointerEvent) {
  if (folded.value) return
  const led = story?.exits.find(exit => exit.id === exitId)
  const from = led && sceneById(led.fromSceneId)
  if (!led || !from) return

  ;(event.currentTarget as SVGElement).setPointerCapture(event.pointerId)
  aimFrom(from, led)
}

function keepAiming(event: PointerEvent) {
  if (!aiming.value) return
  aiming.value.at = pointOnBench(event)
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
 * Draws the Exit where the gesture landed — or leads the one it took hold of
 * there, keeping its text, its Conditions and its Place, because only where it
 * arrives is written. Letting go on a Scene it may not land on, one it already
 * reaches or the one it left, does nothing.
 *
 * Landing on the bare bench writes the Scene that was not there, but only for an
 * Exit being drawn: an endpoint let go of in empty space leaves its Exit exactly
 * as it was, rather than dragging a Scene into the Story behind it or, as
 * Arcweave would have it, destroying the Exit unasked — `0017` says a
 * confirmation is drawn on the bench. Landing off the bench, or on nothing at
 * all, which is the keyboard route abandoned, leaves the Story as it was either
 * way.
 */
function landOn(sceneId: string | undefined, onBench = false) {
  const aimed = aiming.value
  aiming.value = undefined
  if (!aimed) return
  const led = aimed.led

  if (!sceneId || !aimed.landsOn.has(sceneId)) {
    // An endpoint let go of anywhere but on a Scene the Exit may reach leaves the
    // Exit exactly as it was, and says so: a drag that ends in silence reads as a
    // drag that went wrong.
    if (led) return announce(t('editor.exitNotLed'))

    return !sceneId && onBench && aimed.at
      ? makeScene({ joining: aimed.fromSceneId, placed: aimed.at })
      : undefined
  }

  const said = {
    from: sceneNamed(sceneNames.value, aimed.fromSceneId, t),
    to: sceneNamed(sceneNames.value, sceneId, t),
  }

  return change(async () => {
    await (led
      ? send(`/api/exits/${led}/scene`, { method: 'PUT', body: { toSceneId: sceneId } })
      : send(`/api/scenes/${aimed.fromSceneId}/exits`, {
          method: 'POST',
          body: { toSceneId: sceneId },
        }))
    announce(t(led ? 'editor.exitLedTo' : 'editor.exitDrawn', said))
  })
}

/**
 * Makes a Scene, which every gesture that makes one comes through: it arrives
 * under a provisional name with the panel open on that name in a field, selected,
 * so the Author names it where they write it. Named for making rather than for
 * writing, because `writeScene` is what this component asks of the page — which
 * Scene the writing surface should hold — and the two would be one word for two
 * things. A name asked for before the Scene exists
 * is a name typed with nothing to hang it on, and one typed in the middle of a
 * gesture could never be corrected — so no gesture asks for it and every one of
 * them leaves the Author in the field that corrects it. See
 * `docs/adr/0015-a-cut-is-drawn-by-hand.md`.
 *
 * `joining` is the Scene the Exit leaves, and nothing for the first Scene of a
 * Story, which comes from nowhere. `placed` is where the hand let go, snapped to
 * the bench's own pitch, and nothing where no hand named a point — the first
 * Scene, or one the keyboard landed an Exit on. A Scene joining another is then
 * placed beside it, by `placedBeside`, so the graph draws the shape of the Story
 * whichever hand wrote it; the first Scene of all is left to the endpoint, which
 * lays it at the corner the bench begins from.
 *
 * The two writes are one change, so the bench reads the Story back once and finds
 * the Scene and the Exit in it together. They are not one transaction, and nothing
 * here pretends otherwise: an Exit refused after the Scene was written leaves the
 * Scene on the bench under its provisional name, and the refusal beside the graph
 * says so — the Author can name that Scene or delete it.
 */
async function makeScene({ joining, placed }: { joining?: string, placed?: Point } = {}) {
  const name = t('editor.provisionalSceneName')
  let writtenId: string | undefined
  // Where the hand let go, or — where no hand named a point — the free spot beside
  // the Scene the Exit leaves, which is what makes the graph draw the shape of the
  // Story rather than a column of everything in it. The first Scene of a Story
  // leaves nothing and names no point, so the endpoint lays it at the corner the
  // bench begins from.
  const from = joining ? sceneById(joining) : undefined
  const at = placed
    ? snappedWithinReach(placed)
    : from && placedBeside(story?.scenes ?? [], from)

  await change(async () => {
    const written = await send(`/api/stories/${id}/scenes`, {
      method: 'POST',
      body: { name, ...(at ?? {}) },
    }) as Scene

    if (joining) {
      await send(`/api/scenes/${joining}/exits`, {
        method: 'POST',
        body: { toSceneId: written.id },
      })
    }

    writtenId = written.id
    emit('writeScene', written.id)
    announce(joining
      ? t('editor.exitDrawn', { from: sceneNamed(sceneNames.value, joining, t), to: name })
      : t('editor.sceneCreated', { name }))
  })

  // After the read the change asks for and the render it causes, which is what
  // puts the field in the page at all. Selected rather than left with a cursor in
  // it: the name is provisional, so the first thing typed replaces it.
  if (!writtenId) return
  await nextTick()
  const named = document.getElementById(`scene-name-${writtenId}`) as HTMLInputElement | null
  named?.focus()
  named?.select()
}

function abandonAiming() {
  const aimed = aiming.value
  if (!aimed) return
  aiming.value = undefined
  announce(t(aimed.led ? 'editor.exitNotLed' : 'editor.exitAbandoned'))
}

/**
 * The keyboard's way through the same aiming, on the one button each node hides
 * until it is focused. What it does is what the node is to the gesture: nothing
 * live, so begin from here; the Scene the line left, so let it go; a Scene the
 * Exit may land on, so land it there.
 */
function aimOrLand(scene: Scene) {
  if (!aiming.value) return aimFrom(scene)
  if (aiming.value.fromSceneId === scene.id) return abandonAiming()
  return landOn(scene.id)
}

/**
 * The other end of that gesture: the Exit landed on a Scene that is not there
 * yet, which the pointer does by letting go on bare bench. Offered beside the
 * button the aiming began at, on the card the line leaves, so the hand that
 * started the gesture finishes it without leaving the node.
 *
 * Only while an Exit is being drawn. An Exit being led elsewhere is left where it
 * leads by everything but a landing on a card — a slip of the hand may not make a
 * Scene any more than it may destroy an Exit — so the button is not there to be
 * pressed in the first place.
 */
function landOnNewScene() {
  const aimed = aiming.value
  aiming.value = undefined
  if (!aimed || aimed.led) return

  return makeScene({ joining: aimed.fromSceneId })
}

/**
 * Whether the Exit being drawn may land on a node, which is the one question the
 * bench asks of every Scene while a gesture is live: it lights the node, quiets
 * the rest, and settles what the hidden button offers.
 */
function mayLandOn(scene: Scene) {
  return !!aiming.value?.landsOn.has(scene.id)
}

function aimingName(scene: Scene) {
  const aimed = aiming.value
  if (!aimed) return t('editor.drawExitFrom', { name: scene.name })

  const from = sceneNamed(sceneNames.value, aimed.fromSceneId, t)

  if (aimed.fromSceneId === scene.id) {
    return t(aimed.led ? 'editor.leaveExitFrom' : 'editor.abandonExitFrom', { name: from })
  }

  return t(aimed.led ? 'editor.leadExitTo' : 'editor.exitFromTo', { from, to: scene.name })
}

/**
 * Escape lets go of what the bench is holding: the Exit being drawn, whichever
 * way in began it. Listened for on the
 * document because a gesture by pointer has focus nowhere in particular — the
 * hand is on a rim that is not a control — so there is no element to hang it on.
 * The page listens for the same key to close the Scene being written, and the
 * graph is mounted first, so the two happen in the order they always have.
 */
function letGoOnEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // Not while a confirmation is up. `<dialog>` answers Escape itself, and the
  // control the question was asked from is on the bench: letting go out from
  // under that answer would take the focus it hands back with it.
  if (asking) return

  abandonAiming()
}

onMounted(() => {
  document.addEventListener('keydown', letGoOnEscape)
  document.addEventListener('keydown', zoomOnKeys)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', letGoOnEscape)
  document.removeEventListener('keydown', zoomOnKeys)
})

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
  return story?.scenes.find(scene => scene.id === id)
}

/**
 * Begins the drag that lays a Scene out. A card is dragged from anywhere on it —
 * there is nothing on it to type into, so the whole box is the handle — bar the
 * controls it carries and the rim round its edge, which is where an Exit is drawn
 * from. One test for every control rather than a list of the two or three there
 * are today: a button on a card is pressed, never dragged, and a button added
 * tomorrow is out of the gesture without anyone remembering to say so.
 */
function startDrag(scene: Scene, event: PointerEvent) {
  if ((event.target as Element).closest('button, .rim')) return
  // A card in the rail is pressed rather than dragged: nothing is moved and
  // nothing renumbered there, and the press writes the Scene it lands on. The
  // controls the card carries are left out above, so the one on it that writes
  // this very Scene does not undo this by toggling it shut again.
  if (folded.value) return emit('writeScene', scene.id)

  // Capturing the pointer sends the rest of the gesture to the card itself, so
  // dragging survives the pointer leaving the Scene it is dragging.
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const at = pointOnBench(event)
  drag = { id: scene.id, pointerX: at.x, pointerY: at.y, x: scene.x, y: scene.y }
}

function keepDragging(event: PointerEvent) {
  const dragged = drag && sceneById(drag.id)
  if (!drag || !dragged) return
  // In surface pixels at both ends, so the node travels exactly as far as the
  // hand does whatever the bench is being looked at through: a card dragged an
  // inch on a bench pulled back to a quarter crosses four times as much graph.
  const at = pointOnBench(event)
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
  // Folded, the four keys are left to the rail, which scrolls: a Scene is not
  // laid out at a tenth of its size.
  if (!nudged || folded.value) return
  event.preventDefault()
  scene.x = withinReach(scene.x + nudged[0] * NODE_PITCH)
  scene.y = withinReach(scene.y + nudged[1] * NODE_PITCH)
  return moveScene(scene)
}

/**
 * Every Exit as the line that draws it. Every card is `NODE_WIDTH` by
 * `NODE_HEIGHT`, so the box a line leaves and the box it lands on are known from
 * the Story alone: the lines are right in the very first frame, on the server as
 * in the browser, and nothing is measured after a render.
 */
const exitLines = computed(() => story?.exits.map((exit) => {
  const line = exitLine(pointOf(exit.fromSceneId), pointOf(exit.toSceneId))

  // The Place, counted from one for the Author as a Shot's is and read off the
  // same list the strip in the node reads, and the point near the departing
  // Scene where the disc saying it sits.
  return {
    id: exit.id,
    exit,
    ...line,
    place: exitsFrom(story?.exits ?? [], exit.fromSceneId).indexOf(exit) + 1,
    disc: discOfExit(line),
  }
}) ?? [])

/**
 * The press on an Exit's line: it opens the Scene the Exit leaves, which is where
 * the Exit is written. An Exit used to be written on its own line here, and its
 * text is now one field of the Scene's own document beside where it leads and the
 * Conditions it is offered under — see
 * `docs/adr/0034-a-story-is-written-without-the-canvas.md`. So the line is a way
 * to the writing rather than a place to write, and the drawing has one job again.
 */
function writeWhereExitLeaves(exit: Exit) {
  emit('writeScene', exit.fromSceneId)
}

/**
 * Where a Scene's card sits, which with the two constants is the whole of its
 * box. An Exit naming a Scene the bench has not got — read back a moment before
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
  const shots = countedShots(scene.shots.length, t)
  const landing = exitsFrom(story?.exits ?? [], scene.id)
    .map(exit => sceneNamed(sceneNames.value, exit.toSceneId, t))
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
  <!-- The row above the bench: how far back the Author is standing to look at
       the Scenes they have. Nothing here makes one — a Scene is made on the
       bench, where it goes. -->
  <div class="tools">
    <!-- The way to any Scene by its name, which stays while a Scene is being
         written because that is when it is most needed: the graph is a rail then,
         and a rail is names too small to read. The scale beside it does not — a
         rail is drawn at the width's own scale and there is nothing to set. -->
    <p v-if="story?.scenes.length" class="reach">
      <label class="eyebrow" for="reach-scene">{{ $t('editor.goToScene') }}</label>
      <!-- The names behind the field are the browser's own completion, which is a
           list, a filter and a keyboard route that nobody had to write and
           everybody has already used. -->
      <input
        id="reach-scene"
        v-model="reaching"
        list="scene-names"
        :placeholder="$t('editor.goToSceneHint')"
        :maxlength="SCENE_NAME_MAX_LENGTH"
        @change="reachScene"
      >
      <datalist id="scene-names">
        <option v-for="scene in story.scenes" :key="scene.id" :value="scene.name" />
      </datalist>
    </p>

    <!-- How far back the Author is standing, and the ways of changing it. Above
         the bench and in the flow of the page rather than floating in a corner
         of it: a control laid over the surface is a control something on the
         surface can end up under — the button that writes a Scene did, on a
         graph scrolled so that its card came up under this one — and a bench is
         taller than most windows, so the foot of it is below the fold. Here it
         is always on screen, it is the same size at every scale, and it covers
         nothing. -->
    <div v-if="story?.scenes.length && !folded" class="zooming">
      <div class="dial">
        <button
          type="button"
          :disabled="zoom <= ZOOM_MIN"
          :aria-label="$t('editor.zoomOut')"
          @click="zoomBy(-1)"
        >
          <span aria-hidden="true">&minus;</span>
        </button>

        <!-- The graduation, which says where in its range the bench is standing
             and not merely that it can be moved. A range input, so the hand
             drags it, the keyboard steps it and what reads the page announces
             it, none of which had to be written. -->
        <label class="visually-hidden" for="zoom-level">{{ $t('editor.zoomLevel') }}</label>
        <input
          id="zoom-level"
          type="range"
          :min="ZOOM_GRADUATION.min"
          :max="ZOOM_GRADUATION.max"
          :value="graduated"
          @input="zoomToScale(Number(($event.target as HTMLInputElement).value))"
        >

        <!-- The scale as a reading, in the face the bench sets its own numbers
             in. Hidden from what reads the page, because the graduation beside
             it announces the very same number as its own value: one control,
             one voice. -->
        <p class="level" aria-hidden="true">{{ zoomShown }}</p>

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

      <!-- What the hand can do that no control here shows: the shortcuts, and
           the push that moves the view. Written out rather than left to be
           discovered, and written with the key this platform actually calls it.
           Not a live region and not a tooltip — it is a legend on an instrument,
           read once and then known.

           A key is drawn as a key. `<kbd>` is the element for exactly this, and
           a combination is a run of them shoulder to shoulder, so `⌘` and `0`
           read as two keys pressed together rather than as a word. Nothing
           separates one binding from the next but the space between them: a
           character there would be one more thing to translate and one more
           thing read out. -->
      <p class="graven">
        <span class="binding">
          <span class="combination"><kbd>{{ modifier }}</kbd><kbd>&minus;</kbd></span>
          <span class="combination"><kbd>{{ modifier }}</kbd><kbd>+</kbd></span>
          {{ $t('editor.scaleShortcut') }}
        </span>
        <span class="binding">
          <span class="combination"><kbd>{{ modifier }}</kbd><kbd>0</kbd></span>
          {{ $t('editor.fitShortcut') }}
        </span>
        <span class="binding">{{ $t('editor.pushBench') }}</span>
      </p>
    </div>
  </div>
  <slot />

  <!-- A Story with nothing on its bench yet. Every Scene after this one is made
       by drawing an Exit onto bare bench, which needs a Scene to be drawn from,
       so the first one has a control of its own — and it is gone the moment there
       is a card to draw from, which is what keeps this from being a second way to
       make a Scene. It writes exactly what the gesture writes: a Scene under a
       provisional name, open for writing with that name selected.

       `data-step` is how the guided path finds it. The attribute lives here
       rather than a selector living in the guidance, so that moving the control
       takes its target with it visibly — see
       `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`. -->
  <div v-if="!story?.scenes.length" class="empty">
    <p class="none">{{ $t('editor.noScenes') }}</p>
    <button type="button" data-step="first-scene" @click="makeScene()">
      {{ $t('editor.writeFirstScene') }}
    </button>
  </div>
  <!-- The bench, in whichever of its two states it is in. The graph is the whole
       of it while nothing is being written, and the panel an Exit is written in is
       docked at its trailing edge; a Scene being written folds the graph into a
       rail and takes the width that frees. Either way the writing pushes the
       drawing rather than covering it, so nothing the Author is working on ends
       up hidden underneath. -->
  <div v-else class="bench" :class="{ folded }">
    <!-- The window onto the graph: the box that scrolls, and the zoom controls
         docked in its corner. They are outside the surface, so they keep their
         own size whatever the bench is being looked at through. -->
    <div class="viewport" :style="folded ? { inlineSize: `${RAIL_WIDTH}px` } : undefined">
      <div
        ref="graph"
        class="graph"
        @pointerdown="pressBench"
        @pointermove="panBench"
        @pointerup="releaseBench"
        @pointercancel="letGoOfBench"
        @scroll="rememberScroll"
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
            :style="{ ...surfaceSize, '--pitch': `${NODE_PITCH}px`, scale: drawnAt }"
          >
            <!-- The drawing is a pointer's way to an Exit and a second place the one
                 being written is shown; the account of where a Scene leads that
                 anything reads out is the card and the panel — see
                 `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`. So the
                 lines are hidden from what reads the page rather than being the
                 keyboard's route to an Exit. -->
            <svg aria-hidden="true" :style="surfaceSize">
              <defs>
                <marker
                  id="exit-head" viewBox="0 0 8 8" refX="7" refY="4"
                  markerWidth="8" markerHeight="8" orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
              <g
                v-for="line in exitLines"
                :key="line.id"
                :data-exit="line.id"
                :class="{ leading: aiming?.led === line.id }"
              >
                <!-- The wide invisible stroke behind the line, which is what the
                     hand actually aims at: pressing a line opens the Scene the
                     Exit leaves, which is where the Exit is written, and a line and
                     a half of pixels is nobody's idea of a target. The press stops
                     here so it does not reach the bench that would close the very
                     writing it opened, and its default is refused because a press
                     on a line focuses nothing. -->
                <line
                  class="aimed"
                  :x1="line.from.x"
                  :y1="line.from.y"
                  :x2="line.to.x"
                  :y2="line.to.y"
                  @pointerdown.stop.prevent="writeWhereExitLeaves(line.exit)"
                />
                <line
                  :x1="line.from.x"
                  :y1="line.from.y"
                  :x2="line.to.x"
                  :y2="line.to.y"
                  marker-end="url(#exit-head)"
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

                <!-- The endpoint, where the Exit arrives: taken hold of and dropped
                     on another card, it leads the Exit there and keeps everything
                     the Exit carries. The cards are drawn over the lines, so what is
                     really under the hand is the half of this that lies outside the
                     card the arrowhead points at — which is the half an Author aims
                     for anyway.

                     The press stops here and its default is refused, for the two
                     reasons the line beside it does: it must not reach the bench
                     that would close the panel, and it must not take the focus off
                     whatever the panel has just put it in. -->
                <circle
                  class="endpoint"
                  :cx="line.to.x"
                  :cy="line.to.y"
                  r="11"
                  @pointerdown.stop.prevent="startLeading(line.id, $event)"
                  @pointermove="keepAiming"
                  @pointerup="endAiming"
                  @pointercancel="abandonAiming"
                />
              </g>

              <!-- The Exit under the Author's hand: the same grease pencil as the
                   Exits it is dragged across, told apart from them by its dashes
                   marching, and losing its arrowhead where it cannot land. -->
              <line
                v-if="drawnLine"
                class="drawn"
                :x1="drawnLine.from.x"
                :y1="drawnLine.from.y"
                :x2="drawnLine.to.x"
                :y2="drawnLine.to.y"
                :marker-end="landing ? 'url(#exit-head)' : undefined"
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
                writing: sceneWritten === scene.id,
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
              <!-- The strip down the card's leading edge: the column that carries
                   the mark saying which Scene a Reading opens on, and the keyboard's
                   way into the aiming. The gesture itself is the rim's now, and the
                   rim covers the strip, so what an Author has always drawn an Exit
                   from goes on drawing one. -->
              <div class="strip" data-step="draw-exit">
                <!-- The keyboard's way into the same aiming: a button hidden until
                     it takes focus, the pattern a skip link uses, so the gesture
                     stays the only visible way in while assistive technology still
                     finds a real button with a real name. It says which Scene it
                     draws from, and once a gesture is live it says instead what
                     pressing it would do to that one — land the Exit, or let it go. A
                     Scene the Exit cannot land on offers it disabled, which is how
                     the hand is kept out of an Exit on itself and a second Exit to the
                     same Scene. -->
                <button
                  type="button"
                  class="aim"
                  :disabled="folded
                    || (!!aiming && !mayLandOn(scene) && aiming.fromSceneId !== scene.id)"
                  @click="aimOrLand(scene)"
                >
                  {{ aimingName(scene) }}
                </button>

                <!-- The landing that has no card to aim at: the Scene this Exit
                     leads to made where the pointer would have let go on bare
                     bench. It is on the card the line leaves, next in the tab
                     order after the button that began the aiming, so the hand
                     that started the gesture is already on the one that ends
                     it. -->
                <button
                  v-if="aiming && !aiming.led && aiming.fromSceneId === scene.id"
                  type="button"
                  class="aim"
                  @click="landOnNewScene()"
                >
                  {{ $t('editor.exitToNewScene', { from: scene.name }) }}
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
                    :aria-expanded="sceneWritten === scene.id"
                    @click="$emit('writeScene', scene.id)"
                  >
                    {{ $t('editor.write') }}
                    <span class="visually-hidden">
                      {{ $t('editor.sceneNamed', { name: scene.name }) }}
                    </span>
                  </button>
                </div>

                <div class="summary">
                  <!-- The image of the first Shot, at the size a card can carry it:
                       what an Author recognises a Scene by before they have read a
                       word of it. A Scene whose first Shot has none shows the
                       outline of the frame it would be, the way a Shot with no image
                       does in the panel. -->
                  <div class="frame">
                    <!-- `draggable="false"`, because a browser drags an image out of
                         a page by default and the whole card is the handle that lays
                         the graph out: the native drag took the gesture and the Scene
                         stayed where it was. -->
                    <img
                      v-if="scene.shots[0]?.image"
                      :src="imageOf(scene.shots[0])"
                      :alt="$t('editor.imageOfShot', { place: 1 })"
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

              <!-- The rim: a band of the bench's own pitch round all four edges of
                   the card, and where an Exit is drawn from. Any edge rather than
                   one, so the gesture is found by reaching for the outside of the
                   card instead of for a particular side of it — the card's body is
                   still the handle that lays the graph out, and the two are told
                   apart by where the hand goes down rather than by a modifier.

                   Laid over the card with its middle cut out, so one declaration
                   settles both where the crosshair is shown and where the gesture
                   begins: the browser hit-tests what `clip-path` leaves and no
                   more. Last, so it covers the strip; the two controls a card
                   carries come back over it by their own z-index. -->
              <div
                class="rim"
                @pointerdown="startAiming(scene, $event)"
                @pointermove="keepAiming"
                @pointerup="endAiming"
                @pointercancel="abandonAiming"
              ></div>
            </article>

          </div>
        </div>
      </div>
    </div>

    <!-- The surface a Scene is written on, beside the graph folded into a rail.
         What is on it is the page's to settle, because both halves of the bench
         ask for it. -->
    <slot name="panel" />

    <!-- The third column of the bench while a Scene is being written: the Story
         read as a Reader gets it. The page settles what is in it, like the panel
         beside it — see
         `docs/adr/0030-a-story-is-read-where-it-is-written.md`. -->
    <slot name="reading" />
  </div>
</template>

<style scoped>
/* The row above the bench, read left to right as the two things in it: the way to
   any Scene in the Story, and how far back the Author is standing to look at the
   lot. The first is the Story; the second is the view of it, so it sits at the far
   end on its own. */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--s2) var(--s4);
}

/* The way to a Scene by its name: the label above the field, the way a label sits
   over every other field on the bench. */
.reach {
  display: grid;
  gap: var(--s1);
}

.reach input {
  inline-size: 14rem;
  max-inline-size: 100%;
  padding: var(--s1) var(--s2);
  font-size: 0.875rem;
}

/* The bench of a Story that has none: the sentence saying so, and the one control
   that makes the first Scene. Aligned to the start rather than centred in the
   room, because this is where the bench begins and not a poster. */
.empty {
  display: grid;
  justify-items: start;
  gap: var(--s3);
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
  /* The bare bench is pushed about, and a surface that can be pushed says so
     before it is pressed. The cards inside it keep their own cursor: they are
     dragged, which is a different thing done to a different object. */
  cursor: grab;
  block-size: var(--bench-height);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--bench) 70%, black);
}

/* The zoom controls: in the flow of the row above the bench, so nothing on the
   surface can come up underneath them and nothing they cover can be pressed.
   Drawn in the machine's own materials, the way the confirmation and the Step's
   bubble are, because this is the bench talking about how it is being looked at
   rather than part of the drawing. */
.zooming {
  display: grid;
  gap: var(--s1);
  justify-items: end;
  padding: var(--s1) var(--s2) var(--s2);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
}

.dial {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.dial button {
  padding: var(--s1) var(--s2);
  line-height: 1;
}

/* The reading, in the face the interface sets its own numbers in, and wide enough
   for three digits so nothing beside it shuffles about as the scale changes. */
.level {
  min-inline-size: 4ch;
  color: var(--paper);
  font-family: var(--data);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* The graduation. Its track carries four notches, which are the four scales the
   two buttons step between — a quarter, a half, three quarters, the surface's own
   size — so the marks on it say something rather than decorate it: an Author can
   see which step they are on and put the thumb on another. The thumb is a mark
   rather than a knob, the shape of the one a cut is made at. */
.dial input[type='range'] {
  appearance: none;
  inline-size: 7rem;
  background: none;
}

.dial input[type='range']::-webkit-slider-runnable-track {
  block-size: 14px;
  border: 1px solid var(--edge);
  border-radius: 1px;
  /* The notches sit a third of the track apart, which is where the quarters fall
     between the two ends: the track runs from a quarter to the whole. */
  background:
    color-mix(in oklab, var(--bench) 70%, black)
    repeating-linear-gradient(
      to right,
      var(--edge) 0 1px,
      transparent 1px calc(100% / 3)
    );
}

.dial input[type='range']::-moz-range-track {
  block-size: 14px;
  border: 1px solid var(--edge);
  border-radius: 1px;
  /* The notches sit a third of the track apart, which is where the quarters fall
     between the two ends: the track runs from a quarter to the whole. */
  background:
    color-mix(in oklab, var(--bench) 70%, black)
    repeating-linear-gradient(
      to right,
      var(--edge) 0 1px,
      transparent 1px calc(100% / 3)
    );
}

.dial input[type='range']::-webkit-slider-thumb {
  appearance: none;
  inline-size: 4px;
  block-size: 20px;
  margin-block-start: -4px;
  border: none;
  border-radius: 1px;
  background: var(--paper);
  cursor: grab;
}

.dial input[type='range']::-moz-range-thumb {
  inline-size: 4px;
  block-size: 20px;
  border: none;
  border-radius: 1px;
  background: var(--paper);
  cursor: grab;
}

.dial input[type='range']:active::-webkit-slider-thumb {
  cursor: grabbing;
}

/* The legend: what the hand can do that no control here shows. Set in the data
   face at the size of an engraving, because that is what it is — read once and
   then known, rather than something the eye has to get past every time. */
.graven {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1) var(--s4);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

/* One binding: the keys, then what they do. The keys of a combination touch each
   other and the combinations stand well apart, so `⌘−` and `⌘+` read as two
   things to press and not as one run of four keys. */
.binding {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

/* A combination is pressed at once, so its keys are drawn touching. */
.combination {
  display: inline-flex;
  gap: 2px;
}

/* A key, drawn as a key: the machine's own materials, a hairline of a radius like
   everything else machined here, and one lit edge along the top where a keycap
   catches the light. Sized in `em` off the legend it sits in, so it never drags
   the line it is on out of rhythm. */
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-inline-size: 1.7em;
  padding: 0.25em 0.4em;
  border: 1px solid color-mix(in oklab, var(--edge) 80%, var(--paper));
  border-block-start-color: color-mix(in oklab, var(--edge) 40%, var(--paper));
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--steel) 60%, var(--paper) 8%);
  box-shadow: inset 0 -1px 0 color-mix(in oklab, black 45%, transparent);
  color: var(--paper);
  font-family: inherit;
  font-size: 0.75rem;
  line-height: 1;
}

/* What the bench scrolls, and what the push moves. Never smaller than half a
   frame past the window itself: a Story whose Scenes all fit on screen would
   otherwise have nothing to push — the extent would be the extent of the cards —
   and the gesture would be dead on the Story every Author has on their first day.
   A bench has room around the work on it. */
.spread {
  min-inline-size: 150%;
  min-block-size: 150%;
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
     Exit, which asks for them back below: a line paints over that stroke, and a
     disc paints over both, so leaving the whole of it live would have the hand
     landing on whichever of the three was drawn last. */
  pointer-events: none;
}

/* An Exit is a mark the Author made, so it is drawn in the grease pencil rather
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

/* The endpoint of a finished Exit: nothing to look at until the hand is on it,
   and then the grease pencil, so a way on stays a line rather than a line with a
   fitting on the end of it. What can be taken hold of is the half of this that
   lies outside the card, the cards being drawn over the lines. */
svg circle.endpoint {
  fill: transparent;
  /* Asked back from the drawing, which takes no presses. `fill` and not the
     default, which wants paint that can be seen: what settles where a hit lands
     is the circle, not whether anything was drawn in it. */
  pointer-events: fill;
  cursor: grab;
}

svg circle.endpoint:hover {
  fill: color-mix(in oklab, var(--grease) 35%, transparent);
}

/* The Exit being led somewhere else is taken off the bench while the hand carries
   it: what is on screen is the one line under the hand, not that line and the
   Exit's old one both. The endpoint itself stays, because it is what the pointer
   is captured on. */
svg g.leading line,
svg g.leading circle.disc,
svg g.leading text.place {
  visibility: hidden;
}

/* The Exit under the Author's hand. It is the Author's mark, so it is the grease
   pencil like every finished Exit — and since it is dragged across a bench full of
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
   Exit's line be drawn against a geometry nobody has to measure. The width is the
   one a phone can show, and the strip comes out of it rather than adding to it.

   The whole card is the handle that lays the graph out, so it takes the drag
   rather than passing it to a scroller — the two controls on it are pressed, and
   `startDrag` leaves them alone. */
article {
  position: absolute;
  display: grid;
  grid-template-columns: var(--pitch) minmax(0, 1fr);
  /* A stacking context of its own, so the order the rim, the card's controls and
     the hidden button are drawn in is settled inside one card and says nothing
     about which card is in front of which. */
  isolation: isolate;
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

/* While an Exit is being drawn, the Scenes that can take it are lit and every
   other one goes quiet — the Scene the line left, and any it already reaches — so
   what the hand may land on is read off the bench rather than out of a list. Two
   static classes and nothing recomputed as the pointer moves: what an Exit may land
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
}

/* The rim: the band an Exit is drawn from, one pitch wide round all four edges,
   laid over the card with its middle cut out. `clip-path` is hit-tested as well
   as painted, so the crosshair is shown exactly where the gesture begins and the
   card's body underneath is left to the drag that lays the graph out — no
   arithmetic to keep in step with a stylesheet, and no second box to keep the
   size of.

   A finger draws from here without waiting: `touch-action` is already `none` on
   the card this sits on. */
.rim {
  position: absolute;
  inset: 0;
  z-index: 1;
  cursor: crosshair;
  clip-path: polygon(
    evenodd,
    0 0,
    100% 0,
    100% 100%,
    0 100%,
    0 0,
    var(--pitch) var(--pitch),
    calc(100% - var(--pitch)) var(--pitch),
    calc(100% - var(--pitch)) calc(100% - var(--pitch)),
    var(--pitch) calc(100% - var(--pitch)),
    var(--pitch) var(--pitch)
  );
}

/* The keyboard's way in, hidden until it is focused — the pattern a skip link
   uses. Off the top of the strip it belongs to rather than out of the page, so
   focus lands on the node it draws from: a gesture is the visible way in, and a
   real button with a real name is what anything not holding a pointer finds. */
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
  z-index: 3;
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

/* The card's face: the Scene's name and the button that writes it, the image of
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
   is cut off rather than pushing the button off the card or the image off the
   bottom of it. */
.slate h2 {
  min-inline-size: 0;
  overflow: hidden;
  font-size: 1rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* The one thing done to a Scene from its card: writing it. A target a thumb can
   find on a phone rather than the size of its ten-pixel label, and a pointer
   rather than the card's own move cursor, because this is pressed and not
   dragged. */
/* Over the rim, which reaches a pitch into the card and would otherwise take the
   top of this button for the gesture that draws an Exit: a control on a card is
   pressed, and the rim is what is left of the card once its controls have had
   what they need. */
.write {
  position: relative;
  z-index: 2;
  flex: none;
  min-block-size: 2.25rem;
  padding: var(--s1) var(--s3);
  font-family: var(--data);
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}

/* The image of the first Shot, and what the Scene is at a glance beside it. */
.summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--s2);
}

/* The frame the first Shot's image is shown in, drawn whether or not there is an
   image to put in it: an empty one is the outline of the image nobody has
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
   image and not a table of counts. Held to three lines, because every card is the
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

/* The graph folded into a rail: the same drawing, at the scale that fits it, so
   the layout an Author arranged by hand is still how they recognise their own
   Story at a tenth of the size. The rail takes the width the inline style names —
   the scale is arithmetic on that number, so it is written once, in the script —
   and the writing surface takes the rest. */
.bench.folded .viewport {
  flex: none;
}

/* Nothing on the rail is pushed about or dragged: it is pressed, and a card in it
   says so. */
.bench.folded .graph {
  cursor: default;
}

.bench.folded article {
  cursor: pointer;
}

/* The room a bench has around the work on it is the unfolded graph's. The rail is
   drawn at the scale that fits the Story in it exactly, and half a frame more
   would be a scrollbar down a strip a hundred and sixty pixels wide. */
.bench.folded .spread {
  min-inline-size: 100%;
  min-block-size: 100%;
}

/* On a phone the graph is worked on a screen narrower than a node, so it is
   given more of the screen's height rather than a slice of it. In `dvh`, because
   a browser's own chrome comes and goes and `vh` would leave the bench taller
   than the screen it is on — three nested scrollbars deep. */
@media (max-width: 44rem) {
  .bench {
    --bench-height: 70dvh;
  }
}
</style>
