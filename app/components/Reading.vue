<script setup lang="ts">
/**
 * One Reading of a Story on screen. An Author's Preview and a Reader's Reading
 * are the same thing seen from two doors, so both draw this: nothing a Reader
 * meets can go untested by a Preview, and nothing an Author previews can behave
 * differently once it is published.
 *
 * The Path is the whole of what one Reading is, and this holds it for whoever is
 * not holding it already. A Reader's page hands it none, so the Path lives here
 * for as long as the page does. The bench hands it one, held above the document
 * so that the middle of the bench can be turned from the writing to the reading
 * and back without the Reading ending — see #247 and
 * `docs/adr/0043-a-story-is-written-as-one-document.md`. Either way it never
 * leaves the browser, so every Reading starts with empty State and two Readers of
 * one Story cannot share what they have accumulated.
 *
 * `keptFor` is the Story whose Reading this browser keeps between visits: named,
 * the Path is written to local storage on every move and read back when the
 * page opens, so a Reader who left comes back to where they stood. Left out,
 * nothing is kept, which is what a Preview asks for — see
 * `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`.
 */
const { story, keptFor } = defineProps<{
  story: StoryToShow & { language: string }
  keptFor?: string
}>()

const { t } = useI18n()

/**
 * Where the Reading has got to, and the whole of what this component offers
 * whoever draws it: a Preview can put the State on a bench under it without this
 * knowing who is watching, because everything else is a pure function of the
 * Path. Two-way, so that a bench holding the Path above the document reads every
 * move back and hands the same Reading down again the next time it is looked at.
 * Left unbound — which is what a Reader's page does — it is a Path of this
 * component's own, and the default is where every Reading starts before a seed
 * has been drawn for it.
 */
const at = defineModel<Path>('at', { default: () => UNDRAWN })

const shown = computed(() => reading(story, at.value))

/**
 * Every move is kept where the browser will find it again: the whole Path, so
 * what is read back is exactly what replays. Watched rather than written at each
 * move, so the opening is kept too — a Reader who has just started over is back
 * at the start next time as well — and so is a move made from outside.
 */
const key = keptFor && readingKey(keptFor)

watch(at, (now) => {
  if (!key) return
  // A browser that refuses storage, or has none left, refuses quietly: the
  // Reading goes on, it is just not kept.
  try {
    localStorage.setItem(key, JSON.stringify(now))
  }
  catch {}
})

/**
 * The Path this browser kept from an earlier visit, if it is one to go back to.
 * `keptFor` is the Story to read it for; left out — a Preview — there is nothing
 * to read back. See `app/utils/kept.ts`.
 */
function kept(): Path | undefined {
  return keptFor ? keptReading(keptFor, story) : undefined
}

/** Whether what is on screen is where the Reader left off, said until they move. */
const resumed = ref(false)

/**
 * Whether sound is on, and whether the Transcript is shown. Sound is on by
 * default, because the press that opened the Reading is the consent, and both
 * answers are kept for the person rather than for this Story: muting is not a
 * property of a reading.
 *
 * Restored in a mount of its own, registered above the Path's — Vue runs the
 * hooks in the order they were registered, and the opening strike and the
 * opening bed both play out of that one. Registered after it, this would leave
 * both plays reading the default rather than the Reader's own answer, and what
 * would escape is sound reaching somebody who asked for none. That the watch
 * below catches up a microtask later is not the guarantee: the guarantee is that
 * neither element is ever played before this has run.
 */
const sounding = ref(true)
const transcribed = ref(false)

onMounted(() => {
  sounding.value = !keptFlag(SOUND_OFF)
  transcribed.value = keptFlag(TRANSCRIPT_SHOWN)
})

/**
 * The seed every draw a Scene makes comes out of, drawn once the Reading is in
 * the browser it will stay in. Here rather than in the Path this starts at,
 * because the server renders this page too and a seed drawn there and drawn
 * again here would be two Stories either side of hydration. It is the one impure
 * moment in a Reading — see `docs/adr/0024-the-seed-belongs-to-the-position.md`.
 * A Path kept from before carries its seed with it, so a Reading picked up draws
 * what it drew.
 *
 * Drawn by whoever finds the Path still `UNDRAWN`, which is the one Path both
 * holders start at: a bench that holds the Path above the document has drawn it
 * as the bench arrived, and a Reading that drew a second seed on every turn back
 * to it would be the defect #247 reports.
 *
 * Held against the value rather than against the constant itself. A Path handed
 * down through the model arrives as a reactive proxy of whatever the holder above
 * keeps, never as the object, so an identity test would read false on every bench
 * and true on a Reader's page only because `defineModel` hands out that very
 * object when nobody binds it — which is a rule holding by an accident it does not
 * name. An undrawn Path has taken nothing, is on the Shot it opened on, and
 * carries the seed of none, and those are the three things `UNDRAWN` is.
 */
onMounted(() => {
  // The frame the server drew has stood on screen, playing its Effects, since the
  // page was first painted, so the flash rule counts it before anything below can
  // put another in its place: a Reading picked up from a kept Path throws its
  // resumed beat a moment after the opening one has flashed.
  if (painted) arrive()
  const before = kept()
  resumed.value = before !== undefined
  if (before) at.value = before
  else if (!moved(at.value) && at.value.seed === UNDRAWN.seed) at.value = opening()
  // The strike below is watched on the Path's position, and the position this
  // Reading lands on here — freshly drawn, or resumed onto a kept Path nothing
  // ever moved from — is the same `0-0` the Path started this component at, so
  // that watch will not see it as a change and will not fire for it. Struck
  // here instead: the opening beat is a beat that plays like any other.
  if (!moved(at.value)) strikeShot()
  // The bed has no such exception and needs the call for the opposite reason:
  // a Preview is mounted afresh over a Path the bench held, so `heard` arrives
  // already standing at its value and the watch below never fires for it. The
  // guard in `holdBed` makes the next crossing into the same carrier a no-op,
  // so nothing started here is restarted.
  holdBed(heard.value)
  // Drawn here in the browser instead, the frame this mount leaves is counted as
  // it is painted, and only if it is still the frame then: a Preview is routed to
  // the Scene being written in the same flush it mounts in, so the beat it mounted
  // on is never seen, and counting it would withhold the routed beat's white for a
  // flash nobody saw. A frame the key's watch below has counted already is not
  // counted twice, and a tab nobody is looking at paints nothing until somebody
  // does, which is when its frame is first seen.
  if (!painted) {
    const mounted = `${at.value.taken.length}-${at.value.shot}`
    requestAnimationFrame(() => {
      if (!arrived && `${at.value.taken.length}-${at.value.shot}` === mounted) arrive()
    })
  }
})

/**
 * Where the Reader is put after the Reading moves. Every beat replaces what was
 * on screen, and the control that was pressed goes with it: without this, focus
 * falls back to the document and reading a Story by keyboard means tabbing in
 * from the top of the page at every Shot. The frame takes focus when a Shot
 * arrives, so what is announced is the beat itself rather than the button that
 * asks for the next one, and the first Exit takes it when the Scene has played
 * out — the Reader lands on what they are being offered. The frame left standing
 * at the end of a Scene is passed over: it is still on screen, but it is not
 * what has just arrived. At the end of the Story there is neither a Shot nor a
 * way on, and the press that got there took its own button away, so the one
 * control left — reading again from the start — takes the focus it held.
 *
 * Starting over is the one move that can land on nothing: it puts the Reading
 * back where reading again is not offered, so a Story whose Opening Scene plays
 * no Shot and offers no way on has no control to hand the keyboard to and none
 * is invented. Focus goes to the document because on that screen there is
 * nothing to put it on.
 *
 * All of which is what the press is owed, and the clock is owed less. A move the
 * Reader asked for always lands them on what arrived; a move the clock made
 * lands them there only where what they are holding is going with the beat — the
 * frame leaving, or the way on the clock is taking, or nothing at all. A Reader
 * who has tabbed to a control of their own is left standing on it, because
 * *Pause the Reading* is two tabs from the frame and a clock that took the focus
 * back at every beat put the one control WCAG 2.2.2 asks for out of the reach of
 * the people it is there for — on a Scene held half a second, out of reach
 * altogether. What it costs is the beat arriving unannounced to somebody who is
 * standing on a control rather than on the work, which is the smaller of the two
 * silences: they are working the Reading at that moment rather than reading it,
 * and a live region reading every beat at them while they decide would be the
 * Story talking over itself. See issue #329 and
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 */
const frame = useTemplateRef<HTMLElement>('frame')
const exits = useTemplateRef<HTMLElement>('exits')
const again = useTemplateRef<HTMLElement>('again')

/** Where a press puts the Reader, which is the whole of what the paragraph above says. */
function land() {
  (shown.value.shot ? frame.value : (exits.value?.querySelector('button') ?? again.value))?.focus()
}

async function moveTo(to: Path, byClock = false) {
  // Read before the Path moves: the beat on screen is the one about to leave, and
  // `leaving` blurs it a tick from now. Nothing at all — a page just opened, a
  // press that took its own button away — is the focus falling back to the
  // document, which is nobody's and ours to take.
  const was = document.activeElement
  const theirs = byClock && !!was && was !== document.body && !frame.value?.contains(was)

  // Read before the Path moves too, since it is the move and not the beat that
  // says whether an arrival is seen: see `arrives` below.
  arrives.value = !paused.value
  at.value = to
  resumed.value = false
  await nextTick()
  // And theirs only for as long as what holds it is in the document. Every
  // control here is drawn under a condition of its own — a Shot left to ask for,
  // a beat behind, a Transcript to show, a way on still offered — so any of them
  // can go out with the move, and one that has gone has taken the focus with it.
  // Whatever the clock takes away, the beat arriving is where the focus lands.
  if (theirs && was.isConnected) return
  land()
}

/**
 * What the passage on screen is made over: the Cut of the Shot leaving, or of the
 * Exit taken. Read at the move rather than off what arrives, because what a
 * passage looks like is the leaving's to say — and an Exit carries one of its own
 * precisely so that a Scene can end on a fade the next Scene knows nothing about.
 *
 * Nought and through the image is a hard cut, which is what every move the Story
 * says nothing about makes: a step back and a Reading started again are the Reader
 * correcting themselves rather than a raccord, and nothing about either is written
 * on the Story. It is also what the end of a run makes, where the Story says
 * plenty and there is nothing on screen for it to be said over — `passOn` below.
 */
const passing = ref<{ over: number, through: CutThrough }>({ over: 0, through: 'image' })

function passBy(over: number, through: CutThrough, to: Path, byClock = false) {
  passing.value = { over, through }

  return moveTo(to, byClock)
}

/**
 * The cut the press makes, which is the cut the clock makes where the press does
 * not come: the hold below presses this rather than reading the Cut a second time,
 * so the two are one passage made two ways and one place says what it is.
 *
 * **The last Shot of a run is cut hard, whatever the Author wrote on it.** A Cut
 * is what takes one Shot off the screen and puts the next one there, and at the
 * end of a run it does neither: the Path walks past the last Shot and the frame
 * goes on holding it, pushed back behind the ways on. Spending the Scene's Cut
 * there is a dissolve from an image into itself, and a Scene written *fade to
 * black* goes to black and comes back to the frame it started on — a passage
 * between two beats, made where there is only one, and made again by the Exit a
 * moment later. A Scene flowing into the next shows it plainest: two passages
 * back to back over one move the Reader never made.
 *
 * So the passage out of a Scene is the Exit's and only the Exit's, which is what
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` already settled
 * when it refused the Scene's `cut_over` any reach over the way out — an Author
 * lengthening a dissolve between two Shots is not to be lengthening the way out
 * of the Scene without being told. The end of the run is the frame standing
 * still, and the Author's passage is spent once, on the Exit taken. See issue
 * #332. At an ending there is no Exit to make one, and the last Shot's own Cut is
 * made once the move is, on the frame left standing: see `ending` below.
 *
 * Asked of the Shot on screen and the Scene it belongs to without either being
 * checked, because the one control that calls this is drawn only while a Shot is
 * on screen — and a Shot on screen is a Shot of the run the Reading stands in.
 */
function passOn(byClock = false) {
  const made = shown.value.shot === shown.value.run.at(-1)
    ? { over: 0, through: 'image' as const }
    : cut(scene.value!, shown.value.shot!)

  return passBy(made.over, made.through, advance(at.value), byClock)
}

/**
 * How the Reading leaves the screen at its ending, and nothing before it. The move
 * into the ending is cut hard like every end of a run, and the last Shot is shown
 * whole; what its own Cut says is then made on the frame that stands, since at an
 * ending there is no Exit to make a passage out and nothing to be cut to. Through
 * black over a time, the frame goes to black over the whole of it — nothing comes
 * in, so nothing takes the other half — and stays there. A hard cut has nothing to
 * be, and a dissolve with nothing to dissolve into would be a fade to black the
 * Author did not write, so both leave the frame standing.
 *
 * Read off `cut()` for the Shot the frame holds and set on the frame itself: the
 * gate's `--cut-over` is the passage's, and the move into the ending made none.
 * See `docs/adr/0053-a-reading-ends-on-its-last-shot.md`.
 */
const ending = computed(() => (shown.value.ended && scene.value && held.value
  ? cut(scene.value, held.value)
  : undefined))
const toBlack = computed(() => ending.value?.through === 'black' && ending.value.over > 0)

/**
 * A beat still fading out is no longer a beat: it is on screen for whoever is
 * watching and nothing at all for whoever is reading by ear or by keyboard, who
 * would otherwise meet the same Story twice over for the length of a passage.
 * `inert` is the one word for all of it — out of the accessibility tree, out of
 * the tab order and out of reach of a press — and it goes when the element does.
 *
 * Focus is on the frame leaving where the clock made the cut, and taking it out
 * blurs it: `moveTo` is already on its way to the beat arriving, one tick later
 * and in the same task, which is where the focus was always going.
 */
function leaving(frame: Element) {
  if (frame instanceof HTMLElement) frame.inert = true
}

/**
 * The beat behind, or nothing where there is none: the opening beat of the
 * Story, or an Exit the Author closed behind the Reader. The engine is asked
 * rather than the Path read here — an Exit says whether it is crossed backwards
 * and answers as its Story says where it has not — so the control on screen and
 * the move it would make cannot come apart. See
 * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
 */
const behind = computed(() => back(story, at.value))

function stepBack() {
  // Somebody who goes back has asked to stop: a Reader carried forward again a
  // few seconds after stepping back has a control that undoes nothing, and the
  // clock they were ahead of would be reading the Story for them.
  paused.value = true
  if (behind.value) passBy(0, 'image', behind.value)
}

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

/**
 * The Scene the Reading stands in, which the cut, the hold and the stand are read
 * against. Never shown: a Reader is told nothing of the Scene a Shot belongs to —
 * see `docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`.
 */
const scene = computed(() => story.scenes.find(({ id }) => id === shown.value.sceneId))

/**
 * The Shot the frame holds: the one on screen while the Scene plays, and the last
 * of the run once it has played out — the beat the Reader is choosing from stays
 * in front of them rather than the room going empty between the Scene and its
 * ways on. A Scene nobody has written a Shot into leaves the frame nothing to
 * hold, and nothing is invented to stand in for one.
 */
const held = computed(() => shown.value.shot ?? shown.value.run.at(-1))

/** An Exit nobody has phrased yet is offered by where it arrives. */
function offered(exit: Exit) {
  return exitNamed(exit, id => sceneNamed(sceneNames.value, id, t), t)
}

/**
 * The two elements the Story is heard on, held outside everything the Path keys:
 * the frame is drawn afresh on every beat, and a bed inside it would be a bed
 * that restarts on every press. The bed crosses the cut and the strike does not.
 */
const bed = useTemplateRef<HTMLAudioElement>('bed')
const strike = useTemplateRef<HTMLAudioElement>('strike')

/** Whether this Story is heard at all, which is what decides whether the controls are drawn. */
const heardAtAll = computed(() => carriesSound(story))

/** What the Scene the Reading stands in is heard under — its own Sound, or the one it names. */
const heard = computed(() => heardUnder(story.scenes, shown.value.sceneId))

/**
 * Muting is the person turning down what is already playing, not a reason for
 * either element to stop or forget where it stood: a bed keeps running under a
 * Scene whether or not anyone is listening, and a strike already sounding must
 * fall silent at the press rather than at the next beat. One place sets `muted`
 * on both, so nothing above this has to know sound is off at all.
 *
 * It reaches what is already playing, and nothing else: what is about to play
 * sets its own `muted` before the `play()`, because a press and a mount are two
 * different moments and only the press is watched here.
 */
watch(sounding, now => {
  keepFlag(SOUND_OFF, !now)
  if (bed.value) bed.value.muted = !now
  if (strike.value) strike.value.muted = !now
})
watch(transcribed, now => keepFlag(TRANSCRIPT_SHOWN, now))

/**
 * The bed, held under the run and across the cut. It is started again exactly when
 * the carrier changes — B naming A, A naming B and both naming C are one Sound —
 * and nothing records where it had got to, so a crossing into another carrier
 * starts that one from the beginning, forwards or backwards alike. Held in a loop
 * it repeats until the Scene is left or the Reading ends; played once it falls
 * silent and the Scene stays silent, which is the element's own `ended` and
 * nothing this has to do. Runs whether or not sound is on — muting is `.muted`
 * above, not a reason to tear the source down and restart it on the next press.
 *
 * A Reading that ends in a Scene never leaves it, so at the ending the loop is let
 * go of and the bed plays out the pass it is in and stops by itself — no envelope
 * and no second audio pipeline, which iOS would need for a fade. Stepping back off
 * the ending gives the loop back, and a bed that played out while the Reader
 * stood there is played again from its beginning, which is where any bed starts:
 * the one case of a carrier held across a move that is not left alone. See
 * `docs/adr/0053-a-reading-ends-on-its-last-shot.md`.
 *
 * A function rather than only a watch callback, for the reason `strikeShot` is
 * one: a Preview is mounted afresh over a Path the bench was already holding, so
 * the Scene is not crossed into and nothing watched here changes.
 */
function holdBed(now: Heard | undefined, before?: Heard) {
  const element = bed.value
  if (!element) return

  if (!now) {
    element.pause()
    element.removeAttribute('src')
    return
  }

  // Read before the loop is given back, because an element that loops never
  // reads as ended.
  const playedOut = element.ended
  element.loop = now.loops && !shown.value.ended
  const replayed = element.loop && playedOut
  if (heldAcross(before, now) && element.getAttribute('src') === now.sound && !replayed) return

  element.src = now.sound
  element.currentTime = 0
  // Said here rather than left to the watch above, which fires on the press
  // after a Reader turned the sound off and never on the play that starts a
  // bed: what would escape otherwise is sound reaching somebody who asked for
  // none.
  element.muted = !sounding.value
  // A browser that refuses to play refuses quietly: the reading goes on in
  // silence rather than throwing into a page nobody can see it from.
  element.play().catch(() => {})
}

watch([heard, () => shown.value.ended], ([now], [before]) => holdBed(now, before))

/**
 * The strike, which plays as the beat plays and is gone. Keyed on the Path rather
 * than on the Shot, so a Shot played again strikes again — it is the same key the
 * frame is drawn by. Plays whether or not sound is on, for the same reason the
 * bed does: muting is `.muted`, read by the element itself, and set here before
 * the play as well as by the watch above — the press that turns sound off can
 * come after the mount this strikes from and before the watch has set anything.
 *
 * A function rather than only a watch callback, because one transition into a
 * drawn Path — the opening beat, in `onMounted` above — moves nothing this key
 * can see change and would otherwise never strike at all.
 *
 * Stopped by the next beat and by nothing else. The move that ends a run is no
 * beat, and the frame still holds the Shot there — behind the ways on or at the
 * ending alike — so its Sound goes on to its end rather than being cut short by
 * the press the Reader made to move on.
 */
function strikeShot() {
  const element = strike.value
  const sound = shown.value.shot?.sound
  if (!element || !shown.value.shot) return

  if (!sound) {
    element.pause()
    return
  }

  element.src = sound
  element.currentTime = 0
  element.muted = !sounding.value
  element.play().catch(() => {})
}

watch(() => `${at.value.taken.length}-${at.value.shot}`, strikeShot, { flush: 'post' })

/**
 * The clock this Reading is carried by, and the pause the Reader stops it with.
 * Every watch below is set on it, which is what keeps them from disagreeing about
 * the pause or about a tab nobody is looking at: none of them holds an answer of
 * its own. See `app/composables/clock.ts`, issue #334 and
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 */
const { paused, stopped, clock } = useClock()

/**
 * How the text of the beat on screen arrives, resolved against its Scene the way
 * its Cut is: the wait after the Image lands, what it comes by and at what pace,
 * how long each part takes to appear, and how long the whole of it stays. See
 * `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
 */
const arrival = computed(() => shown.value.shot && scene.value
  ? textArrival(scene.value, shown.value.shot)
  : undefined)

/**
 * Whether it arrives in its own time rather than landing whole with its Image.
 * Every Story written before this lands its texts whole and at once, and every one
 * of them is drawn exactly as it was: no animation, no pair of names on the press.
 */
const ownTime = computed(() =>
  !!shown.value.shot && !!scene.value && textArrives(scene.value, shown.value.shot))

/**
 * The beat on screen: where the Path stands, and which Shot it found there. The
 * two can come apart, because the Shot at a position is the engine's to say — the
 * opening beat is drawn on the server under no seed and again here under the
 * Reader's, and a Scene whose Flag decides its first Shot may find another one
 * there, as may an Author drawing again in a Preview — and a text belongs to its
 * Shot rather than to the place the Shot is found at.
 */
const onScreen = computed(() =>
  `${at.value.taken.length}-${at.value.shot}-${shown.value.shot?.id}`)

/**
 * Whether the text of the beat has all arrived, and whether it has left. Both
 * belong to the beat and are reset as it changes: a text landing whole and at
 * once is whole from the landing, and a paused Reader reads by hand, so is given
 * every text whole. `left` is not reset where no Shot is on screen, so the frame
 * held behind the ways on shows the text as it was when the run ended.
 */
const whole = ref(true)
const left = ref(false)

watch(onScreen, () => {
  whole.value = paused.value || !ownTime.value
  if (shown.value.shot) left.value = false
}, { immediate: true })

/** Whether a text is arriving on screen now, which is what draws it arriving. */
const arriving = computed(() => !!shown.value.shot && !whole.value)

// A Reader who pauses mid-arrival is shown the rest: half a text cannot be read.
watch(paused, (now) => {
  if (now) whole.value = true
})

/**
 * The beat's text cut into what it arrives by, or nothing where it arrives whole.
 * One leaf today, handed to the engine the way a text of many would be, so what
 * the Reading draws and what the bench reckons are cut at the same edges.
 */
const cutUp = computed(() => ownTime.value && arrival.value!.by !== 'whole'
  ? pieces([shown.value.shot!.text], arrival.value!.by)[0]!
  : undefined)

/**
 * Which piece arrives last, or -1 where the caption itself is the last to arrive:
 * a text that is one word, or one line, has no unit after the one the caption
 * brings with it, and a piece at nought is not faded twice.
 */
const lastAt = computed(() => cutUp.value?.findLastIndex(piece => !!piece.from) ?? -1)

/**
 * The last part to arrive has painted, so the hold can start on what was seen.
 * Asked of the frame on screen only: a frame still fading out under a passage is
 * a beat that has already gone, and the end of its text says nothing of this one.
 */
function textArrived(event: AnimationEvent) {
  const part = event.target as Element
  if (frame.value?.contains(part) && part.hasAttribute('data-last')) whole.value = true
}

/**
 * Whether the text has finished arriving without anybody hearing it end, which
 * `animationend` alone cannot say: an animation that has ended never ends again,
 * so a last part whose arrival was over by the time it became the last would
 * leave the text arriving for ever — the hold never armed, and a press that seems
 * broken.
 *
 * Two things bring that about. The server draws the beat too, and a browser
 * starts the arrival as it paints that page, before this component has hydrated
 * and is listening for the end of it. And the beat can change under the frame
 * without the frame being drawn again — another Shot found at the same position,
 * or the Author changing what arrives last — so the part that is last now may be
 * one whose arrival ended a while ago. So the page is asked as this mounts, and
 * after each of those changes is drawn: nothing still running on the last part is
 * a text that is whole. A beat just drawn is not mistaken for one, because an
 * arrival waiting to start is still running.
 */
function settle() {
  if (!arriving.value) return
  if (!frame.value?.querySelector('[data-last]')?.getAnimations().length) {
    whole.value = true
  }
}

onMounted(settle)
watch([onScreen, lastAt, ownTime], settle, { flush: 'post' })

// A tab nobody is looking at may not recalculate styles, and then the `paused` the
// arrival is given as the tab hides is never applied: the arrival would run on
// behind the Reader's back instead of resuming where it stood. Asking the page for
// the animations makes it recalculate them, so the pause takes hold as it is set.
watch(stopped, () => {
  if (arriving.value) {
    frame.value?.querySelector('figcaption')?.getAnimations({ subtree: true })
  }
}, { flush: 'post' })

/**
 * The press under the frame: where the text is still arriving it shows the rest,
 * and only then does it cut. The Path does not move, so the focus stays. This
 * amends `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`'s press
 * that always cuts — see `docs/adr/0052-a-text-arrives-in-its-own-time.md`.
 */
function pressed() {
  if (whole.value) return passOn()
  whole.value = true
}

/**
 * The two things a press of that control means, and they are not symmetrical.
 * Stopping is the Reader asking to be left where they are, so the focus stays on
 * the control they stopped the clock with — it is the control they will press
 * again. Starting again is the Reader asking the Story to carry on, which is a
 * press like any other and hands the focus back to the beat the way every other
 * press does. Without that, a Reader who stopped the clock and started it again
 * would be stationed on this button for the rest of the Reading, and every beat
 * after it would arrive unannounced — which is the likeliest way to be stationed
 * at all, and the one silence `moveTo`'s rule would otherwise have left standing.
 */
function pauseOrResume() {
  paused.value = !paused.value
  if (!paused.value) land()
}

/**
 * The hold: where the Cut of the Shot on screen names a time, the clock presses
 * what the hand presses and nothing else — so a Path arrived at by waiting is the
 * Path a hand would have arrived at, over the passage a hand would have made it
 * over, and neither can be changed without the other. Where the Cut names no time
 * the beat is held until the press, and there is nothing to time.
 *
 * The time is read inside the clock rather than off a computed beside it, because
 * the Preview is where this feature is written: an Author who turns a Scene from
 * *at the press* to *after a time* has changed the hold on the beat in front of
 * them, and what the clock reads is what restarts it. How the cut is then made is
 * `passOn`'s alone, read at the move like every other passage.
 *
 * The hold counts from the text having arrived rather than from the Image landing,
 * so the clock never cuts a text short and never makes the first press, the one
 * that shows the rest: it arms only once the text is whole, which is the moment
 * `whole` turns and this is read again.
 */
clock(() => {
  const beat = shown.value.shot
  if (!beat || !scene.value || !whole.value) return

  const { after } = cut(scene.value, beat)
  if (after === null) return

  return { after, press: () => passOn(true) }
})

/**
 * The stay: a whole text whose Shot says it leaves is taken off by the clock
 * after its time, and the Image stands alone until the Cut. Where the hold is
 * shorter than the stay, the cut takes the text with the Image.
 */
clock(() => {
  const stays = arrival.value?.stays
  if (!shown.value.shot?.text.trim() || !whole.value || left.value) return
  if (stays === undefined || stays === null) return

  return { after: stays, press: () => { left.value = true } }
})

/**
 * The ways on, in the three states a Scene may offer them in. Standing until one
 * is taken is null and is every Story written before this existed. A number is
 * the time they stand, after which the first one still offered is taken — the
 * one the Place puts first, which is the one Enter presses from inside the list,
 * so the order the Author wrote them in is the whole of what says which. Nought
 * is the Scene flowing into the next without asking, and there they are never
 * painted at all.
 */
const standing = computed(() => (shown.value.exits.length ? scene.value?.exitsAfter ?? null : null))
const asking = computed(() => shown.value.exits.length > 0 && standing.value !== 0)

/**
 * What the ways on say for themselves as they arrive, for whoever cannot see
 * them arrive. A Reader standing on the frame is told by the focus landing in the
 * list; a Reader standing on a control of their own is told by this and by
 * nothing else, so it says a choice is there whether or not a clock is running on
 * it — a Scene whose beats are clocked and whose choice is open is the commonest
 * shape there is, and it would otherwise stop in silence. Empty where nothing is
 * being asked: a run still playing, or a Scene flowing into the next.
 */
const waysOnSay = computed(() => {
  if (!asking.value) return ''

  return standing.value === null
    ? t('reading.waysOnStand')
    : t('reading.waysOnStandFor', { count: standing.value / 1000 })
})

/**
 * The stand: where the ways on are given a time, the clock takes the first one
 * still offered when it runs out — the one the Place puts first, which is the one
 * Enter presses from inside the list, so the order the Author wrote them in is the
 * whole of what says which. Nought is a Scene flowing into the next, and it is
 * taken through the clock like any other time.
 */
clock(() => {
  const first = shown.value.exits[0]
  if (!first || standing.value === null) return

  return {
    after: standing.value,
    press: () => passBy(first.cutOver, first.cutThrough, take(at.value, first), true),
  }
})

/**
 * Whether anything in this Story moves by itself, which is whether the Reader is
 * given the control that stops it. WCAG 2.2.2 asks for a pause the moment
 * something advances on its own and asks for nothing where nothing does, so a
 * Story read entirely by the hand is given no control over a clock that never
 * runs — the way a Story carrying no Sound is given no title card to press. The
 * Story is asked rather than the Reading, so the control is on screen from the
 * opening beat of a Story whose clock runs three Scenes later: a pause that
 * arrived with the thing it stops would be a pause nobody could reach in time.
 *
 * A clock is not the only thing that moves by itself. An Effect that lasts goes
 * on for as long as its beat stands, which is the motion 2.2.2 owes a pause over
 * just as surely, so `lasts` gives the same control for the same reason. It is a
 * second answer rather than a wider `clocked`, because `clocked` also says
 * whether the ways on are told how long they stand, and that is a clock's alone.
 */
const clocked = computed(() => movesItself(story))
const lasts = computed(() => lasting(story))

/**
 * Whether the beat on screen is seen arriving, which is whether its arrival
 * plays. Read at the move, from the pause: a beat arriving while the clock runs
 * plays it — the opening beat, a Reading picked up and a Reading started again
 * among them — and a beat the Reader lands on with the clock stopped does not,
 * because a stopped arrival holds its first frame, and the first frame of a flash
 * from white or of a blur coming clear is a screen with nothing on it. That is a
 * step back, which stops the clock first, and any press while it is stopped. The
 * frame held behind the ways on is drawn afresh without arriving, so it plays
 * none either, and its lasting Effects go on.
 *
 * A beat that does not arrive is drawn in the state its arrival ends in, which is
 * every Effect's own style with its animation taken off: see `[data-rest]`.
 */
const arrives = ref(true)
const atRest = computed(() => !arrives.value || !shown.value.shot)

/**
 * The flash rule, as the Reading keeps it: the frame drawn last, and whether the
 * flash from white on the frame on screen is withheld. See `app/utils/flashes.ts`.
 *
 * Every frame put on screen is recorded, the one pushed back behind the ways on
 * included, because a frame that is recorded and plays nothing can only withhold
 * more — and a frame replaced before it was ever painted is not, because a white
 * withheld for a flash nobody saw is a white the Author wrote and nobody sees.
 * Each is recorded when its Effects start rather than when the move is made,
 * which is later by the half of a passage through black the arriving frame waits
 * out, and time the Effects stood stopped is not counted as time they stood: a
 * white held in a tab nobody is looking at is a white seen the moment somebody
 * does. Kept out of reactivity, because nothing on screen is drawn from it.
 */
let arrived: Arrived | undefined
const whiteWithheld = ref(false)

/**
 * Whether this Reading takes over a frame the server drew, which the browser has
 * painted and whose Effects have played since. Read as the component is set up,
 * which happens inside hydration or not at all, rather than in the mounted hook:
 * a hydrated component's mounted hooks run out of the Suspense resolving, which
 * is also what Nuxt clears the flag on, so which of the two goes first is theirs
 * to order and not something the flash rule should stand on.
 */
const painted = useNuxtApp().isHydrating

/** How long the arriving frame's Effects wait, which is the half of a passage through black it waits too. */
const wait = computed(() => (passing.value.through === 'black' ? passing.value.over / 2 : 0))

function arrive() {
  const now = performance.now() + wait.value
  whiteWithheld.value = withholdsFlash(arrived, now)
  arrived = { at: now, flickers: !!held.value && flickers(held.value) }
}

// Before the frame is drawn, so a white the rule withholds is never painted at all.
watch(() => `${at.value.taken.length}-${at.value.shot}`, arrive)

let stoppedSince = 0

watch(stopped, (now) => {
  if (now) stoppedSince = performance.now()
  else if (arrived) arrived.at += performance.now() - stoppedSince
})

/**
 * The Image's Effects that are drawn over it rather than on it: a sheet of white,
 * the edges closing in, and grain, none of which a filter or a transform of the
 * picture can paint.
 */
const OVERLAID: readonly string[] = ['from-white', 'closing-in', 'grain']

function overlaid(effect: Arrival | Lasting | null | undefined): effect is Arrival | Lasting {
  return !!effect && OVERLAID.includes(effect.effect)
}

/**
 * What one slot is drawn with: its Effect and its strength, the time it plays
 * over or its round, and whether it is at rest. Nothing where the slot is empty,
 * so a beat without an Effect is the beat every Story was drawn as before.
 */
function drawnAs(effect: Arrival | Lasting | null | undefined): Record<string, unknown> {
  if (!effect) return {}

  return {
    'data-effect': effect.effect,
    'data-strength': effect.strength,
    'data-rest': 'over' in effect && atRest.value ? '' : undefined,
    style: 'over' in effect
      ? { '--over': `${effect.over}ms` }
      : 'every' in effect ? { '--every': `${effect.every}ms` } : undefined,
  }
}

const imageArrival = computed(() => (overlaid(held.value?.imageArrives) ? {} : drawnAs(held.value?.imageArrives)))
const imageLasting = computed(() => (overlaid(held.value?.imageLasts) ? {} : drawnAs(held.value?.imageLasts)))
const captionArrival = computed(() => drawnAs(held.value?.textArrives))
const captionLasting = computed(() => drawnAs(held.value?.textLasts))

/**
 * The overlay the Image's arrival is drawn on, where it is one. A flash from white
 * is not drawn at all where it would not be seen arriving or where the flash rule
 * withholds it: its end state is no white, and a sheet of nothing is no sheet.
 */
const arrivalOverlay = computed(() => {
  const effect = held.value?.imageArrives
  if (!overlaid(effect)) return undefined
  if (effect.effect === 'from-white' && (atRest.value || whiteWithheld.value)) return undefined
  return drawnAs(effect)
})

const lastingOverlay = computed(() => (overlaid(held.value?.imageLasts) ? drawnAs(held.value?.imageLasts) : undefined))
</script>

<template>
  <div class="reading">
    <!-- The two layers, outside everything the Path keys: the bed is held under
         the run and crosses the cut, and the strike plays with the beat and is
         gone. They lie over each other without ducking — there is no mixing and
         no priority. -->
    <audio ref="bed" data-sound="scene" preload="auto" aria-hidden="true" />
    <audio ref="strike" data-sound="shot" preload="auto" aria-hidden="true" />

    <!-- Said before the frame, where a Reader landing mid-Story looks first: they
         are where they left off, not at a Story that starts in the middle. A
         status, so a screen reader hears it as the beat arrives, and gone at the
         next move — the notice is about the arrival, not about the Reading. -->
    <p v-if="resumed" class="resumed trail" role="status">{{ $t('reading.resumed') }}</p>

    <!-- One Shot at a time, and the Exits only once the Scene has played out —
         behind the frame it played out on, which is held rather than taken away. -->
    <template v-if="held">
      <!-- The gate the frame sits in, and the one thing here that outlasts a
           beat: a passage puts two frames in it at once, so what the Author wrote
           the passage over is carried by what holds both of them. A dissolve
           leaves them over each other and a passage through black takes the room
           down to nothing between them — either way it is the beat leaving that
           says how, which is why the duration is set at the move and not read off
           what arrives.

           Stopped, it stops every Effect in it where it stood, and they resume
           from there: the hold restarts, but a restarted arrival replays a flash
           nobody wrote and a restarted flicker dips too soon. -->
      <div class="gate" :class="{ stopped }" :style="{ '--cut-over': `${passing.over}ms` }">
        <!-- A hard cut is not a passage: `css` false takes the whole transition
             out of the way, so the beat leaving is gone in the same tick rather
             than lying over the next one at nothing for as long as the browser
             takes to agree it has finished. The beat arriving is drawn whole in
             that tick, with nothing of the product's laid over it, so nought is
             seen as the hard cut it says — see
             `docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`. -->
        <Transition
          :name="passing.through === 'black' ? 'through-black' : 'dissolve'"
          :css="passing.over > 0"
          @leave="leaving"
        >
          <!-- Keyed on the Path, so arriving at a Shot draws the frame afresh:
               the passage and the focus both need a new element at every beat,
               and reading a Scene again draws its first frame again. -->
          <!-- The frame holds nothing but the Author's own work — the image, what
               it shows, and the beat — so the whole of it is announced in the
               Story's Language whatever language the chrome around it is read in.
               Nothing translates a Story: see
               `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`. -->
          <figure
            ref="frame"
            :key="`${at.taken.length}-${at.shot}`"
            class="frame"
            :class="{ 'pushed-back': !shown.shot && !shown.ended, 'to-black': toBlack }"
            :lang="story.language"
            :style="{ '--wait': `${wait}ms`, '--end-over': toBlack ? `${ending!.over}ms` : undefined }"
            tabindex="-1"
          >
            <!-- The image and the text are one beat, so the Reader moves past both
                 at once. The text may come after the image in its own time — a wait,
                 then whole or a line, a word or a letter at a time — but it is in
                 the accessibility tree from the landing: opacity leaves the tree
                 alone, and a text cut into parts is drawn twice, the parts hidden
                 from it and an unsplit copy read, because some screen readers read
                 one span at a time and would spell the sentence out. A Reader by ear
                 has every word as the Shot lands, the Description first.

                 `alt` is the image's Description and nothing else: the Shot's text
                 is never used as one, because the text carries the beat and is read
                 out beside the image anyway. An Image nobody has described falls
                 back to empty, which is what keeps a screen reader from announcing
                 a frame it has nothing to say about. -->
            <!-- One element for each owner of a property, so no two of them write
                 one element's `transform` or `animation`: the arrival wraps what
                 lasts, and what lasts wraps whatever moves the frame over the Image
                 later, so a shake keeps its reach whatever the frame does inside it.
                 The wrappers are drawn on every beat and carry an Effect only where
                 there is one, so a beat without one is the beat it always was. What
                 no filter or transform of the picture can paint — a sheet of white,
                 the edges closing in, grain — lies over it, fixed to the box and
                 kept from the accessibility tree, since an Effect is never
                 announced: it would narrate the decoration over the Author's
                 sentence. -->
            <div v-if="held.image" class="picture">
              <div class="arrives" v-bind="imageArrival">
                <div class="lasts" v-bind="imageLasting">
                  <img :src="held.image" :alt="held.description">
                </div>
              </div>
              <div v-if="arrivalOverlay" class="overlay" v-bind="arrivalOverlay" aria-hidden="true" />
              <div v-if="lastingOverlay" class="overlay" v-bind="lastingOverlay" aria-hidden="true" />
            </div>
            <figcaption
              v-if="shown.shot || !left"
              :class="{
                arriving,
                stopped: arriving && stopped,
                left: shown.shot && left,
              }"
              :style="arrival && {
                '--after': `${arrival.after}ms`,
                '--text-over': `${arrival.over}ms`,
                '--wait': arriving ? 'calc(var(--cut-over, 0ms) + var(--after))' : undefined,
              }"
              :data-last="arriving && lastAt < 0 ? '' : undefined"
              @animationend="textArrived"
            >
              <div class="arrives" v-bind="captionArrival">
                <div class="lasts" v-bind="captionLasting">
                  <p class="shot">
                    <template v-if="cutUp">
                      <span aria-hidden="true"><span
                        v-for="(piece, index) in cutUp"
                        :key="index"
                        :class="{ unit: piece.from }"
                        :style="piece.from
                          ? { '--at': `${Math.round((piece.from / arrival!.pace) * 1000)}ms` }
                          : undefined"
                        :data-last="arriving && index === lastAt ? '' : undefined"
                      >{{ piece.text }}</span></span>
                      <span class="visually-hidden">{{ held.text }}</span>
                    </template>
                    <template v-else>{{ held.text }}</template>
                  </p>
                </div>
              </div>
            </figcaption>
          </figure>
        </Transition>
      </div>

      <!-- What a Reader who cannot hear is owed. Always in the document: hidden it
           is `visually-hidden` and still read, never taken out of the
           accessibility tree and never announced in a live region, which would
           trample the reading. The Shot's is the Shot the frame holds, so it
           stays past the end of the run the way that Shot's Sound does. -->
      <div v-if="heard?.transcript || held.transcript" class="heard">
        <p v-if="heard?.transcript" class="transcript" :class="{ 'visually-hidden': !transcribed }">
          <span class="eyebrow">{{ $t('reading.sceneTranscript') }}</span>
          <span :lang="story.language">{{ heard.transcript }}</span>
        </p>
        <p
          v-if="held.transcript"
          class="transcript"
          :class="{ 'visually-hidden': !transcribed }"
        >
          <span class="eyebrow">{{ $t('reading.shotTranscript') }}</span>
          <span :lang="story.language">{{ held.transcript }}</span>
        </p>
      </div>
    </template>

    <!-- The one control the frame carries, and only while there is a Shot left to
         ask for: the frame held behind the ways on asks for nothing. -->
    <button v-if="shown.shot" type="button" class="next" @click="pressed">
      <!-- Named for what its press does: the rest of the text while it is still
           arriving, the next beat after. Both names share one cell so the width
           holds, and only a beat whose text arrives in its own time is given the
           pair — every other beat keeps the one name it always had. -->
      <template v-if="ownTime">
        <span :class="{ idle: whole }">{{ $t('reading.showWholeText') }}</span>
        <span :class="{ idle: !whole }">{{ $t('reading.next') }}</span>
      </template>
      <template v-else>{{ $t('reading.next') }}</template>
    </button>

    <!-- What tells a Reader who cannot see the ways on that they are being asked,
         and what the choice stands under. It comes before the list rather than
         after it, because the focus lands inside the list and what follows the
         control a screen reader is announcing is reached only by walking the
         virtual cursor forward, which is walking it while the clock runs. A
         status, so it is heard where it is rather than found, and in the document
         before it has anything to say — the way `ended` below is, and for the
         same reason. Drawn only where a clock can run at all, which is one of the
         two places the pause below is drawn: a Story read entirely by the hand
         never strands a Reader, because every arrival on it is a press of theirs,
         and an Effect that lasts moves the beat but never the Reading on. Still
         not a timer: it says how long the ways on stand, true for the whole of the
         stand, and never counts anything down. -->
    <p v-if="clocked" class="visually-hidden" role="status">{{ waysOnSay }}</p>

    <!-- The ways on go under the frame rather than over it, and carry no eyebrow
         of their own: a Reader is told nothing of the Scene they leave. -->
    <ul v-if="asking" ref="exits" class="exits">
      <li v-for="exit in shown.exits" :key="exit.id">
        <!-- What the Author wrote on the Exit, so it carries the Story's Language
             like the beat above it does. -->
        <button
          type="button"
          class="splice"
          :lang="story.language"
          @click="passBy(exit.cutOver, exit.cutThrough, take(at, exit))"
        >
          {{ offered(exit) }}
        </button>

        <!-- Whatever an Author is given beside the way on they are being offered:
             the pair of controls that renumber it, which is where the order of
             the ways on is set — see
             `docs/adr/0030-a-story-is-read-where-it-is-written.md`. Empty for a
             Reader, who is offered the choice and nothing about how it is made. -->
        <slot name="ordering" :exit="exit" />
      </li>
    </ul>

    <!-- The time the ways on stand, drained by a bar keyed on the Path so a fresh
         arrival restarts it rather than resuming one already spent. Decoration
         and nothing else, all the way through: what it draws is said in words
         above the list, where it is heard. -->
    <div
      v-if="standing"
      :key="`${at.taken.length}-${at.shot}`"
      class="expiring"
      aria-hidden="true"
      :style="{ '--standing': `${standing}ms` }"
    >
      <span class="drain" :class="{ stopped }" />
    </div>

    <!-- In the document before it has anything to say: a live region announces
         a change to a node it already holds, never a node that arrives with its
         sentence inside it. Said to whoever reads by ear and seen by nobody: any
         sentence the interface set on the screen here would be the product
         speaking over the Author's last frame, in the Locale rather than in the
         Story's Language. A Story that wants the end said says it in a Shot. -->
    <p class="ended visually-hidden" role="status">{{ shown.ended ? $t('reading.ended') : '' }}</p>

    <!-- What the Reader is given over the Reading itself: the clock stopped, the
         one refusal of the Sound, and the words for whoever cannot hear it. All
         three are the person's rather than the Reading's, so none of them touches
         the Path.

         The pause comes first because it is the one control over something
         already happening, and it is drawn only where something can happen: a
         clock, or an Effect that lasts, which moves by itself for as long as its
         beat stands. A Story nobody wrote a time or a lasting Effect into is read
         entirely by the hand, and a control over nothing that ever moves would do
         nothing — the way a Story carrying no Sound is given no title card to
         press. -->
    <p v-if="clocked || lasts || heardAtAll" class="given">
      <button v-if="clocked || lasts" type="button" class="trail" @click="pauseOrResume">
        {{ paused ? $t('reading.resume') : $t('reading.pause') }}
      </button>
      <button v-if="heardAtAll" type="button" class="trail" @click="sounding = !sounding">
        {{ sounding ? $t('reading.soundOff') : $t('reading.soundOn') }}
      </button>
      <button
        v-if="heardAtAll && (heard?.transcript || held?.transcript)"
        type="button"
        class="trail"
        @click="transcribed = !transcribed"
      >
        {{ transcribed ? $t('reading.hideTranscript') : $t('reading.showTranscript') }}
      </button>
    </p>

    <!-- The two ways back, offered once the Reading has moved and not before: on
         the first beat of the Opening Scene there is nothing to read again, and
         the press would draw a new seed and throw the same frame the Reader is
         already looking at. It is a stop the keyboard is spared too, on the one
         screen whose whole tab order is otherwise the next beat — and the Author
         who does want that frame drawn again has the reroll on the bench, which
         is a control of the Preview rather than one of the Reading.

         They stand together under everything they are a way back out of, and
         never between the frame and the ways on: a Reader choosing an Exit is
         choosing among the Exits, and a control that undoes the last press has
         no business in that list. The lighter of the two comes first — one beat
         before the whole Reading.

         The step back is asked of the engine and not of the Reading having
         moved: the two agreed until an Exit could refuse to be crossed
         backwards, and where one does the Reader is left with the Story to read
         again and no beat behind. Nothing says why. A door that has closed says
         nothing, and a Story that wants it said says it in a Shot.

         At the ending, and only there, reading again is drawn with the weight
         *Next Shot* had: nothing of the interface's is said on the screen there,
         so the controls are what tell a Reader who is looking that the Reading
         has ended, and a trail on every screen once the Reading has moved would
         tell them nothing. -->
    <p v-if="moved(at)" class="back">
      <button v-if="behind" type="button" class="trail" @click="stepBack">
        {{ $t('reading.back') }}
      </button>
      <button
        ref="again"
        type="button"
        :class="{ trail: !shown.ended }"
        @click="passBy(0, 'image', opening())"
      >
        {{ $t('reading.again') }}
      </button>
    </p>
  </div>
</template>

<style scoped>
/* One column, as wide as a gate wants to be and no wider, and sat in the middle
   of the room it was given rather than under whatever is above it. */
.reading {
  display: grid;
  align-self: center;
  gap: var(--s4);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
  padding-block-end: var(--s6);
}

/* The image and the text share the one gate, because they are one beat and not
   an illustration with a caption under it. */
.frame {
  overflow: clip;
}

/* A passage is two frames on screen at once, and the room is the size of the one
   arriving: the beat leaving is taken out of the flow and fades where it stood,
   so the page settles the moment the new beat is in — which is what a hard cut
   has always done here and what every Story written before the Cut still does. */
.gate {
  display: grid;
  position: relative;
}

/* The beat leaving is `inert` from the moment it starts to go, which is what
   takes it out of reach of a press as well as out of the reading. */
.dissolve-leave-active,
.through-black-leave-active {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
}

/* Its Effects stop where they stood rather than going: a beat leaving is a beat
   that dips no more, so two frames on screen never flicker at once and the frame
   arriving is the only one whose flashes count. Taking them off would be worse, a
   frame changing under the passage — a grey going back to colour, a white
   thrown back up. */
.dissolve-leave-active [data-effect],
.through-black-leave-active [data-effect] {
  animation-play-state: paused;
}

/* A dissolve is the two frames over each other for the whole of the duration the
   Author wrote. Nought — a hard cut, and every Story that says nothing — is a
   transition of no duration, which is the beat swapped for the next one exactly
   as before. */
.dissolve-enter-active,
.dissolve-leave-active {
  transition: opacity var(--cut-over, 0ms) ease;
}

.dissolve-enter-from,
.dissolve-leave-to,
.through-black-enter-from,
.through-black-leave-to {
  opacity: 0;
}

/* A passage through black is the same fade twice over a room already painted
   black: the beat leaving goes first and the beat arriving waits for the room to
   be empty, so the two halves share the duration rather than doubling it.

   Written as a delay rather than as `<Transition mode="out-in">`, which would
   take the frame out of the document between the halves — everything under it
   would jump up and back down, and the focus `moveTo` puts on the beat arriving
   would have nothing to land on for half the passage. */
.through-black-enter-active,
.through-black-leave-active {
  transition: opacity calc(var(--cut-over, 0ms) / 2) ease;
}

.through-black-enter-active {
  transition-delay: calc(var(--cut-over, 0ms) / 2);
}

/* The hold stays — it is the rhythm of the work and not a decoration — and every
   passage goes. `frameline.css` already takes each duration to nothing for
   anyone who has asked for that; the wait between the two halves above is the one
   thing a duration cut to nothing leaves standing, so it is cut here.

   And a text does not wait for a passage that takes no time, so the passage is
   taken out of what its arrival counts from. The same rule takes the time each
   part takes to appear to nothing and leaves the delays, so the wait, the cadence
   and the stay stand: they are when the words come, which is the work's. */
@media (prefers-reduced-motion: reduce) {
  .through-black-enter-active {
    transition-delay: 0ms;
  }

  .frame {
    --cut-over: 0ms;
  }
}

/* A Reader who asked for less motion sees no Effect move, only the state it
   leaves: nothing at all of most of them, the grey of `out-of-colour` and the
   edges of `closing-in` from the start, and grain standing still — each is its
   own style with the animation off, which is what the Effects below are written
   to leave. `frameline.css` cutting every duration to nothing is not enough here:
   it still starts each animation, and a first keyframe painted even once is a
   white screen for `from-white`, held for as long as a passage through black
   delays it. So the animation is taken off outright. */
@media (prefers-reduced-motion: reduce) {
  .frame [data-effect] {
    animation: none;
  }
}

/* Where the last Shot's Cut is through black, the ending goes to black over the
   whole of the time the Author wrote and stays there, on the room the Reading is
   drawn on. The frame keeps its box as it fades, so nothing under it moves, and
   stays in the accessibility tree, since its words are what the Story ended on.
   A Reader who asked for less motion is given the black at once: `frameline.css`
   takes the duration to nothing and the fill leaves the end state standing,
   because the black is the work and the fade is the decoration on it. */
.frame.to-black {
  animation: to-black var(--end-over) ease forwards;
}

@keyframes to-black {
  to {
    opacity: 0;
  }
}

/* The Scene has played out and the frame it ended on is held behind the ways on:
   the same beat, pushed back into the room so that what is being asked of the
   Reader is the lit thing on screen.

   The image takes the push back and the prose only half of it: the last beat has
   to stay as readable as it was to whoever is reading it while they choose, and a
   dimmed serif is the one thing on this page that cannot afford to be. The image
   is its whole box, the sheets an Effect lays over it included, which dims to
   exactly what the image alone did: the box is the room the image is set on.

   The frame a Reading ends on is not pushed back at all: there is no choice to
   set it behind, and the last Shot is the ending, shown whole. */
.frame.pushed-back .picture {
  opacity: 0.5;
}

.frame.pushed-back .shot {
  color: var(--muted);
}

/* The frame is given focus on arrival, not by tabbing to it, so the ring says
   "this is the beat you have landed on" rather than "this is a control". */
.frame:focus-visible {
  outline-offset: 4px;
}

/* The gate takes an image of any shape: a wide one fills the frame, and a tall
   one is held to a height a beat can be taken in without scrolling — the frame
   is what the Reader looks at, not something they travel down. */
img {
  display: block;
  inline-size: 100%;
  block-size: auto;
  max-block-size: min(60vh, 32rem);
  object-fit: contain;
  background: var(--room);
}

/* The Image's box, which its Effects are clipped to: a shake, a pulse or a tremor
   moves the picture inside it and never the gate around it, and where one uncovers
   an edge it uncovers the room, as either side of a narrow image already does.
   The image and the text below it are one surface, so the hairline between them
   is the only thing that separates them — drawn on the box rather than on the
   image, so an Effect that moves or blurs the picture leaves it where it was.

   It is also what the Image's Effects are measured against, so a blur of 4% is 4%
   of the frame it blurs whatever the room makes of the frame's width; it never
   took its width from the image, so being measured moves nothing. The words are
   measured against the letter instead: measuring the caption would stop a word too
   long for the line from widening it, and a word clipped is a word lost. */
.picture {
  position: relative;
  overflow: clip;
  container-type: inline-size;
  background: var(--room);
  border-block-end: 1px solid var(--edge);
}

figcaption {
  padding: var(--s5) clamp(var(--s4), 4vw, var(--s5));
}

/* Fixed to the box whatever moves the picture under it, and never in the way of
   a press. */
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* What every Effect shares, and why each is written the way it is.

   An arrival's own style is the state it ends in, and its animation starts from
   the state it arrives out of and fills both ways: waiting, it holds its first
   frame, and ended, its last, which is its own style again. So taking the
   animation off — a beat drawn at rest, a Reader who asked for less motion —
   always leaves the beat as the arrival would have. A lasting Effect's first frame
   is its rest, so one drawn stopped starts still.

   An Effect waits for its frame: the half of a passage through black the frame
   waits too, and nothing under any other.

   Every Effect is keyed on the attribute alone and set in one `animation`, so each
   rule that rests, stops or delays one outranks it wherever it is written: the
   shorthand resets every longhand, and these must win over it. */
.frame [data-effect] {
  animation-delay: var(--wait, 0ms);
  animation-fill-mode: both;
}

/* A beat the Reader is not shown arriving — a step back, a press while the clock
   is stopped, the frame held behind the ways on — is drawn in the state its
   arrival ends in, which is the Effect's own style with the animation off. */
[data-effect][data-rest] {
  animation: none;
}

/* The Pause and a tab nobody is looking at stop every Effect where it stands
   rather than taking it off, so each resumes from there: a restarted arrival
   would replay a flash nobody wrote, and a restarted flicker dips too soon. */
.stopped [data-effect] {
  animation-play-state: paused;
}

/* An Effect's three degrees, written with it as the three columns they are, and
   the one its strength reads. */
[data-strength="slight"] {
  --degree: var(--slight);
}

[data-strength="marked"] {
  --degree: var(--marked);
}

[data-strength="strong"] {
  --degree: var(--strong);
}

/* A jolt dying away, by a share of the width and of the height, overscaled on the
   Image by twice its reach so no edge of the picture shows while it jolts. Words
   have no edge to show. */
[data-effect="shake"] {
  --slight: 0.005;
  --marked: 0.015;
  --strong: 0.03;

  animation: shake var(--over) linear;
}

.picture [data-effect="shake"] {
  --overscale: calc(1 + 2 * var(--degree));
}

@keyframes shake {
  0% {
    translate: 0;
    scale: var(--overscale, 1);
  }
  8% {
    translate: calc(var(--degree) * -100%) calc(var(--degree) * 60%);
  }
  20% {
    translate: calc(var(--degree) * 90%) calc(var(--degree) * -50%);
  }
  34% {
    translate: calc(var(--degree) * -60%) calc(var(--degree) * 35%);
  }
  50% {
    translate: calc(var(--degree) * 40%) calc(var(--degree) * -20%);
  }
  66% {
    translate: calc(var(--degree) * -20%) calc(var(--degree) * 10%);
  }
  80% {
    translate: calc(var(--degree) * 8%) 0;
    scale: var(--overscale, 1);
  }
  100% {
    translate: 0;
    scale: 1;
  }
}

/* From its strength to sharp: a share of the frame's width on the Image, and of
   the letter on the words. */
[data-effect="from-blur"] {
  --slight: 0.5cqi;
  --marked: 1.5cqi;
  --strong: 4cqi;

  animation: from-blur var(--over) ease-out;
}

figcaption [data-effect="from-blur"] {
  --slight: 0.15em;
  --marked: 0.4em;
  --strong: 1em;
}

@keyframes from-blur {
  from {
    filter: blur(var(--degree));
  }
}

/* A sheet of paper fading off the Image, and at rest no sheet at all. */
[data-effect="from-white"] {
  --slight: 0.4;
  --marked: 0.7;
  --strong: 1;

  opacity: 0;
  background: var(--paper);
  animation: from-white var(--over) ease-out;
}

@keyframes from-white {
  from {
    opacity: var(--degree);
  }
}

/* The grey the Image arrives out of, or the grey it arrives at and keeps. */
[data-effect="into-colour"],
[data-effect="out-of-colour"] {
  --slight: 0.4;
  --marked: 0.7;
  --strong: 1;
}

[data-effect="into-colour"] {
  animation: into-colour var(--over) ease-in-out;
}

@keyframes into-colour {
  from {
    filter: grayscale(var(--degree));
  }
}

[data-effect="out-of-colour"] {
  filter: grayscale(var(--degree));
  animation: out-of-colour var(--over) ease-in-out;
}

@keyframes out-of-colour {
  from {
    filter: grayscale(0);
  }
}

/* A falloff to the room, scaled in from past the edges of the box and kept. */
[data-effect="closing-in"] {
  --slight: 30%;
  --marked: 55%;
  --strong: 80%;

  background: radial-gradient(
    closest-side,
    transparent 45%,
    color-mix(in oklab, var(--room) var(--degree), transparent)
  );
  animation: closing-in var(--over) ease-in-out;
}

@keyframes closing-in {
  from {
    opacity: 0;
    scale: 1.6;
  }
}

/* The one flicker every flickering carrier keeps. Its pattern is fixed, and
   `tests/unit/effects.spec.ts` reads it out of this file: dips 120 ms long at 400,
   1100, 1600 and 2700 ms into a 3200 ms round, so no two start under half a
   second apart and none in the first 400 ms of a beat, and whatever arrives next
   dips no sooner than 400 ms after it. That is what keeps a run of flickering
   beats to three flashes in a second, so it takes no pace from the Author and
   none may be added to it here. */
[data-effect="flicker"] {
  --slight: 0.8;
  --marked: 0.55;
  --strong: 0.3;
  --dip: var(--degree);

  animation: flicker 3200ms linear infinite;
}

@keyframes flicker {
  0%, 12.5%, 16.25%, 34.375%, 38.125%, 50%, 53.75%, 84.375%, 88.125%, 100% { opacity: 1 }
  14.375%, 36.25%, 51.875%, 86.25% { opacity: var(--dip) }
}

/* A double beat and a rest, each round. */
[data-effect="pulse"] {
  --slight: 1.01;
  --marked: 1.025;
  --strong: 1.05;

  animation: pulse var(--every) ease-in-out infinite;
}

@keyframes pulse {
  0%,
  36%,
  100% {
    scale: 1;
  }
  12% {
    scale: var(--degree);
  }
  20% {
    scale: calc(1 + (var(--degree) - 1) * 0.4);
  }
  26% {
    scale: calc(1 + (var(--degree) - 1) * 0.75);
  }
}

/* An unsteady jitter each round: a share of the frame's width on the Image, and
   on the words a share of the letter, which is what they are read at. */
[data-effect="tremor"] {
  --slight: 0.25cqi;
  --marked: 0.6cqi;
  --strong: 1.2cqi;

  animation: tremor var(--every) linear infinite;
}

figcaption [data-effect="tremor"] {
  --slight: 0.03em;
  --marked: 0.06em;
  --strong: 0.12em;
}

@keyframes tremor {
  0%,
  100% {
    translate: 0;
  }
  10% {
    translate: calc(var(--degree) * -0.8) calc(var(--degree) * 0.3);
  }
  22% {
    translate: calc(var(--degree) * 0.6) calc(var(--degree) * -0.7);
  }
  35% {
    translate: calc(var(--degree) * -0.3) calc(var(--degree) * 0.9);
  }
  47% {
    translate: var(--degree) calc(var(--degree) * -0.2);
  }
  60% {
    translate: calc(var(--degree) * -0.9) calc(var(--degree) * -0.5);
  }
  74% {
    translate: calc(var(--degree) * 0.4) calc(var(--degree) * 0.6);
  }
  87% {
    translate: calc(var(--degree) * -0.5) calc(var(--degree) * -0.3);
  }
}

/* Grain is a sheet because a filter cannot make noise: one tile of it, painted
   once on a sheet twice the box's size and moved to another offset 24 times a
   second, which costs the compositor a layer and repaints nothing. It lies over
   the Image and under the words, which are not on the film. Standing still, it
   is still grain. */
[data-effect="grain"] {
  --slight: 0.06;
  --marked: 0.12;
  --strong: 0.2;

  inset: -50%;
  opacity: var(--degree);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E");
  animation: grain 250ms steps(1) infinite;
}

@keyframes grain {
  0% {
    translate: 0;
  }
  16.667% {
    translate: -9% 6%;
  }
  33.333% {
    translate: 7% -11%;
  }
  50% {
    translate: -13% -4%;
  }
  66.667% {
    translate: 11% 9%;
  }
  83.333% {
    translate: -4% 13%;
  }
}

/* A text arriving in its own time: the caption fades up after its wait, counted
   from the Image landing, and each unit after it at the characters before it
   over the pace. A part not yet arrived keeps its room at opacity nought, so
   nothing moves as the words come, and it does not rise into place either, since
   how the words look is not when they come. A duration of nought still hides a
   part through its delay and still ends, which is what tells the hold the text is
   whole. The text's own Effects are given the caption's wait as their `--wait`
   while it arrives, so they play as it appears rather than unseen before it. */
.arriving,
.arriving .unit {
  animation: arrive var(--text-over) ease backwards;
}

.arriving {
  animation-delay: calc(var(--cut-over, 0ms) + var(--after));
}

.arriving .unit {
  animation-delay: calc(var(--cut-over, 0ms) + var(--after) + var(--at));
}

/* The text leaving whole over the same time it took to appear, so a title that
   faded up fades out. */
.left {
  animation: leave var(--text-over) ease forwards;
}

/* A hidden tab stops an arrival where it stood, and the tab looked at again
   resumes it from there, because an arrival is drawn rather than timed. Only an
   arrival is held, and while one runs the clock can only be stopped by a hidden
   tab, because the pause shows the whole text. A text leaving goes on leaving,
   so a Reader who pauses during its fade is not left half of it. */
.arriving.stopped,
.arriving.stopped .unit {
  animation-play-state: paused;
}

@keyframes arrive {
  from {
    opacity: 0;
  }
}

@keyframes leave {
  to {
    opacity: 0;
  }
}

/* The Transcript sits under the frame rather than over the image, so it never
   pushes the frame around on arrival: on or off, the beat is where it was. */
.heard {
  display: grid;
  gap: var(--s1);
}

.transcript {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  color: var(--muted);
  font-size: 0.875rem;
}

.next {
  display: inline-grid;
  justify-self: start;
  padding-inline: var(--s4);
}

/* The two names the press is given where a text arrives, laid in the one cell so
   the button is as wide as the longer of them whichever is said: a control that
   changed its width as the words came would move under the hand reaching for it.
   The idle one keeps its room and is out of the accessible name. */
.next > span {
  grid-area: 1 / 1;
}

.next > .idle {
  visibility: hidden;
}

/* The Exits on offer, as a splice list: a grease-pencil mark and the line the
   Reader takes, each across the whole column so the choice is read and not
   hunted for. */
.exits {
  display: grid;
  gap: var(--s2);
}

/* The line the Reader takes, and whatever is offered beside it: nothing at all
   for a Reader, so the choice is the whole width it was. */
.exits li {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.exits .splice {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s3);
  flex: 1;
  min-inline-size: 0;
  padding: var(--s3) var(--s4);
  background: color-mix(in oklab, var(--steel) 70%, transparent);
  font-family: var(--ui);
  font-size: 1rem;
  text-align: start;
}

.exits .splice:hover {
  background: var(--steel-lit);
}

/* The time the ways on stand: a track the width of the column, and a bar drained
   out of it at the pace the Author wrote, in the edge-and-grease pair. */
.expiring {
  block-size: 3px;
  background: var(--edge);
  overflow: hidden;
}

.drain {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  background: var(--grease);
  transform-origin: left;
  animation: drain var(--standing) linear forwards;
}

/* Full rather than paused mid-drain: the clock behind this bar is thrown away and
   restarted at the full duration on resume (see the watch above), not picked back
   up from where it stood, so a bar resumed from six seconds left would be showing
   a stand the clock is about to give ten again. Same answer as the reduced-motion
   rule below, and the same reason — removing `animation: none` later starts a new
   animation rather than continuing the old one, so this also restarts the bar. */
.drain.stopped {
  animation: none;
}

@keyframes drain {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* The clock is the work and the bar is the decoration on it: the time still runs
   underneath, but nothing here is asked to watch it counting down. Overrides
   `frameline.css`'s own answer to the same query, which would otherwise still run
   the animation — over a duration cut to nothing, landing the bar drained rather
   than full. */
@media (prefers-reduced-motion: reduce) {
  .drain {
    animation: none;
  }
}

.resumed {
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: 0.8125rem;
}

/* The tail sample either side of a Reading picked up, which is a splice: the
   film was cut here, and here it runs on. */
.resumed::before,
.resumed::after {
  content: '';
  flex: 1;
  block-size: 1px;
  background: var(--edge);
}

/* The clock stopped, the one refusal and the Transcript's own switch, and
   stepping back a beat or reading the Story again from the start: all of them are
   the same quiet trail, none of them a control the Story is read with, so
   `.given` shares `.back`'s rules rather than repeating them. Keyed on the trail
   in `.back`, because reading again at the ending is drawn as a button and keeps
   the border and the ground every button has. */
.given,
.back {
  display: flex;
  /* Three of them on the one line where a Story is heard and held under a clock,
     which is wider than a phone: the trail wraps rather than running off the
     side of the room. */
  flex-wrap: wrap;
  gap: var(--s2);
}

.given button,
.back .trail {
  border-color: transparent;
  background: none;
}

.given button:hover,
.back .trail:hover {
  border-color: transparent;
  background: none;
  color: var(--paper);
}
</style>
