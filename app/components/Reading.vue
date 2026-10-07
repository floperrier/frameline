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
  story: StoryToShow & { language: string, textFace: Face, textAlign: Align }
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

/**
 * The seed every draw a Scene makes comes out of, drawn once, by whichever side
 * renders the Reading first. A server rendering it draws it there: Nuxt writes it
 * into the payload, and the browser hydrating that page reads the same number back
 * rather than drawing a second, so the opening beat is one Story on both sides of
 * hydration. Drawn twice, a Flag said or tested on the opening beat would read one
 * value as the page is painted and another once it answers — issue #387. Every
 * Reading a Reader opens is set up in the browser alone now, behind its title
 * card, and the card draws the seed as it is rendered, so it knows which beat the
 * Reading opens on and brings that beat's Image in before the press.
 * It is the one impure moment in a Reading — see
 * `docs/adr/0024-the-seed-belongs-to-the-position.md`,
 * `docs/adr/0060-the-seed-is-carried-to-the-browser.md` and
 * `docs/adr/0063-a-story-opens-on-its-title-card.md`.
 *
 * Drawn for whoever finds the Path still `UNDRAWN`, which is the one Path both
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
 *
 * Drawn before the Path is watched below, so drawing it is not a move: every move
 * is written over what the browser kept, and a Path kept from an earlier visit is
 * read back only once the Reading is mounted.
 */
const served = useState('reading-seed', () => opening().seed)
if (!moved(at.value) && at.value.seed === UNDRAWN.seed) at.value = opening(served.value)

/**
 * The names a text of this Story says, which are the Flags some Scene of it sets.
 * See `docs/adr/0059-a-flag-is-said-by-its-name.md`.
 */
const declared = computed(() => declaredIn(story))

/**
 * What this Story shows the Path, with every text of the run said as this
 * Reading holds its Flags: State is judged once a Scene, so the whole Scene says
 * one value from its first beat to the frame held behind its ways on. The beat is
 * read back out of the said run, so it is still the run's own last Shot at the end.
 */
const shown = computed(() => {
  const now = reading(story, at.value)
  const says = (text: string) => said(text, now.state.flags, declared.value)
  const run = now.run.map((shot) => {
    const formatted = runsSaid(shot.formatted, says)
    return {
      ...shot,
      formatted,
      text: textOf(formatted),
      description: says(shot.description),
      transcript: says(shot.transcript).trim(),
    }
  })
  return { ...now, run, shot: now.shot && run[at.value.shot] }
})

/** A text outside the run, said against the State on screen. */
function says(text: string) {
  return said(text, shown.value.state.flags, declared.value)
}

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
 * What the Story's Author is told of this Reading: that it began at the opening,
 * each Exit it took, and that it ended and in which Scene — a number each, and
 * nothing of the Path. Only a Reading kept for a Story tells, which a Preview
 * never is. Sent and never waited on, and a count that fails is a count lost,
 * never a Reading stopped. See
 * `docs/adr/0072-a-reading-is-counted-for-its-author.md`.
 */
function tell(kind: 'begun' | 'ended' | 'taken', body?: { scene: string } | { exit: string }) {
  if (!keptFor) return
  fetch(`/api/read/${keptFor}/${kind}`, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  }).catch(() => {})
}

/**
 * Whether this Reading's ending has been told. A step back from the ending and
 * the same ending reached again is one Reading ended; reading again from the
 * start is a Reading begun anew, whose ending is its own.
 */
let toldEnded = false

watch(() => shown.value.ended, (ended) => {
  if (!ended || toldEnded || !shown.value.sceneId) return
  toldEnded = true
  tell('ended', { scene: shown.value.sceneId })
}, { immediate: true })

/**
 * The Exits this Reading has told it took. A step back across one and the same
 * Exit taken again is one take; a Reading picked up from a kept Path told the
 * Exits it holds on the visit that took them, and starts with them told.
 */
let toldTaken = new Set<string>()

/**
 * The Reader takes an Exit, by a press or by the clock — which is also a Scene
 * flowing on — told the first time this Reading does. Nothing at all while a move
 * is held, so a take that is not made is not told either: see `moveTo`.
 */
function taking(exit: Exit, byClock = false) {
  if (holding) return
  if (!toldTaken.has(exit.id)) {
    toldTaken.add(exit.id)
    tell('taken', { exit: exit.id })
  }
  return passBy(exit.cutOver, exit.cutThrough, take(at.value, exit), byClock)
}

function readAgain() {
  if (holding) return
  toldEnded = false
  toldTaken = new Set()
  tell('begun')
  return passBy(0, 'image', opening())
}

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
 * Where a Reading picked up is put back, once it is in the browser that kept it.
 * A Path kept from before carries its seed with it, so a Reading picked up draws
 * what it drew, and `resumes` only hands back a Path that has moved: the beat it
 * puts the Reader on is another beat than the one the server drew, never that one
 * drawn again.
 */
onMounted(() => {
  // The frame the server drew has stood on screen, playing its Effects, since the
  // page was first painted, so the flash rule counts it before anything below can
  // put another in its place: a Reading picked up from a kept Path throws its
  // resumed beat a moment after the opening one has flashed.
  if (painted) arrive()
  // The seed the server drew is this Reading's now, and only this one's: the next
  // Reading this page opens without being reloaded draws a seed of its own.
  clearNuxtState('reading-seed')
  const before = kept()
  resumed.value = before !== undefined
  // A Reading picked up was begun on an earlier visit, and is not begun again,
  // nor told again of the Exits it took on it.
  if (before) {
    at.value = before
    toldTaken = new Set(before.taken)
  }
  else tell('begun')
  // The strike below is watched on the Path's position, and a Reading that is not
  // picked up stands on the `0-0` it was set up at, so that watch will not see a
  // change and will not fire for it. Struck here instead: the opening beat is a
  // beat that plays like any other.
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
 * out — the Reader lands on what they are being offered. A Scene that asks puts
 * its Question there first, and its field takes the focus as the Question
 * appears, so the Reader is told what they are asked and is already where the
 * answer is written. The frame left standing at the end of a Scene is passed
 * over: it is still on screen, but it is not what has just arrived. At the end
 * of the Story there is neither a Shot nor a way on, and the press that got
 * there took its own button away, so the one control left — reading again from
 * the start — takes the focus it held.
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
 *
 * A beat laid out full is the one the focus is put on without the browser
 * scrolling to it. The frame is the room there, and a focused element is brought
 * into view by the browser's own rule, which promises the element and nothing
 * under it: *Next Shot* or the ways on could be left below the fold. So a move of
 * the hand onto such a beat brings the whole Reading into the window itself —
 * see `moveTo` — and a move of the clock leaves the scroll where the Reader left
 * it, for the reason it leaves their focus there.
 */
const root = useTemplateRef<HTMLElement>('root')
const frame = useTemplateRef<HTMLElement>('frame')
const exits = useTemplateRef<HTMLElement>('exits')
const asked = useTemplateRef<HTMLInputElement>('asked')
const again = useTemplateRef<HTMLElement>('again')

/** Where a press puts the Reader, which is the whole of what the paragraph above says. */
function land() {
  (shown.value.shot
    ? frame.value
    : (asked.value ?? exits.value?.querySelector('button') ?? again.value))
    ?.focus({ preventScroll: full.value })
}

// The Preview opened from a beat's own ▶ puts the Author there too: the mark
// they pressed went dark with the writing and took the focus with it.
defineExpose({ land })

/**
 * Whether a move is held while the Image of the beat it lands on is brought in,
 * and whether that has gone on past half a second, which the frame and the trail
 * say. One move at a time: a press made during the hold does nothing, because the
 * beat being brought in is the one the Reader asked for, and two presses landing
 * as two beats a split second apart would show them a beat they never saw. See
 * `docs/adr/0073-a-beat-lands-when-its-image-can-be-shown.md`.
 */
let holding = false
const onItsWay = ref(false)

/**
 * What is brought in ahead, whenever the Path moves or the Story under it does:
 * every Image `needed` names, and the one on screen, kept so that a step back onto
 * it asks for nothing. In the browser alone, which is the one place an Image is
 * shown, and let go of as the Reading ends. See `app/utils/brought.ts`.
 */
if (import.meta.client) {
  watchEffect(() => {
    for (const image of [imageHeld(story, at.value), ...needed(story, at.value)]) {
      if (image) bringIn(image)
    }
  })
}

onBeforeUnmount(letGo)

async function moveTo(to: Path, byClock = false, passage?: { over: number, through: CutThrough }) {
  if (holding) return
  // The beat leaving stays on screen as it is until the one arriving can be shown,
  // its own clock having run, so whatever the Author wrote about a beat's time is
  // counted from a frame the Reader can see. A beat whose Image is in already is
  // not waited on at all, and lands in this very task. Past the ceiling, or once
  // a load has failed, it lands anyway. A move made from outside while this one
  // was held — the bench drawing again — is the one that stands, and a move of the
  // clock's is not made into a Reading stopped while it was held: the clock is
  // armed again as it starts.
  const from = at.value
  const ready = untilShown(imageHeld(story, to), onItsWay)
  if (ready) {
    holding = true
    await ready
    holding = false
    if (at.value !== from || (byClock && stopped.value)) return
  }
  // Set after the wait, since the frame still on screen through it reads it.
  if (passage) passing.value = passage

  // Read before the Path moves: the beat on screen is the one about to leave, and
  // `leaving` blurs it a tick from now. Nothing at all — a page just opened, a
  // press that took its own button away — is the focus falling back to the
  // document, which is nobody's and ours to take.
  const was = document.activeElement
  const theirs = byClock && !!was && was !== document.body && !frame.value?.contains(was)

  // Read before the Path moves too, since it is the move and not the beat that
  // says whether an arrival is seen: see `arrives` below. So is the box the beat
  // leaving keeps through the passage: see `pinned`.
  arrives.value = !paused.value
  stands()
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
  // The Reading's own head to the head of whatever scrolls it, which a Reading
  // laid out full fits under from there: the beat, its words and the press under
  // it in the window at once. Instant, because a jump the Reader asked for is not
  // a motion to be watched, and so there is nothing for reduced motion to take
  // off.
  // Given the whole screen, the Reading is what scrolls, so its head is its own.
  if (full.value && !byClock) {
    root.value?.scrollIntoView({ block: 'start' })
    root.value?.scrollTo(0, 0)
  }
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
  return moveTo(to, byClock, { over, through })
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
 * The end of a run carries the Movement over too. The frame standing still is a
 * frame drawn afresh, keyed on the Path, and an Image moving in it would start
 * its Movement again from the start: so how far it had got is read off the frame
 * leaving and handed to the one drawn in its place, which goes on from there —
 * paused behind the ways on, running on at the ending. See `travelled`.
 *
 * Asked of the Shot on screen and the Scene it belongs to without either being
 * checked, because the one control that calls this is drawn only while a Shot is
 * on screen — and a Shot on screen is a Shot of the run the Reading stands in.
 */
function passOn(byClock = false) {
  if (holding) return
  const last = shown.value.shot === shown.value.run.at(-1)
  const made = last ? { over: 0, through: 'image' as const } : cut(scene.value!, shown.value.shot!)
  const to = advance(at.value)
  // The animation holds its own progress, read here before the frame it runs on
  // is drawn afresh, and so does the time it runs over: see `travelled`.
  const ran = last ? frame.value?.querySelector('.moving')?.getAnimations()[0]?.currentTime : undefined
  travelled.value = typeof ran === 'number'
    ? { at: `${to.taken.length}-${to.shot}`, ms: ran, over: travelOver.value }
    : undefined

  return passBy(made.over, made.through, to, byClock)
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
 * The beat leaving keeps the box it stood in, written on it as it starts to go:
 * taken out of the flow, a frame laid out full would otherwise be as tall as its
 * words, since its Image covers it without sizing it, and a frame of either
 * Layout would take the size of the Reading the beat arriving draws.
 *
 * The box is read as the move starts, in `moveTo`, and not as the frame leaves.
 * Where the move leaves the passage as it was, the transition is not handed
 * anything new and draws its next beat in an update of its own, after this
 * component has already put the Reading in the arriving beat's Layout: read
 * then, a frame in the column is as tall as the room it is about to give up. A
 * move made from outside — the bench drawing again — is read where it leaves,
 * which is the best there is for it.
 */
let stood: { frame: HTMLElement, inline: number, block: number } | undefined

function stands() {
  const on = frame.value
  if (!on) {
    stood = undefined
    return
  }
  // The box as drawn and not as rounded: a pane a fraction wide, pinned a pixel
  // short, would rewrap a word of the leaving frame and clip its last line.
  const box = on.getBoundingClientRect()
  stood = { frame: on, inline: box.width, block: box.height }
}

function pinned(leaving: Element) {
  if (!(leaving instanceof HTMLElement)) return
  const drawn = leaving.getBoundingClientRect()
  const box = stood?.frame === leaving
    ? stood
    : { inline: drawn.width, block: drawn.height }
  leaving.style.inlineSize = `${box.inline}px`
  leaving.style.blockSize = `${box.block}px`
}

/**
 * What the Reader has typed into the field of the Question on screen and not yet
 * answered with, and the answer handed back where they step back onto it. It
 * never leaves this component and is no part of the Path until it is answered,
 * so it is not kept between visits: a sentence half written is not a move.
 *
 * A Scene asks one Question, so a draft belongs to the Scene it was typed in and
 * is let go as the Reading stands in another: a Reader who stepped away from one
 * Question is never shown what they typed there under the next.
 */
const draft = ref('')
/** The id the Question's sentence labels its field by. */
const questionId = useId()

watch(() => shown.value.sceneId, () => {
  draft.value = ''
})

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
  if (holding) return
  // Somebody who goes back has asked to stop: a Reader carried forward again a
  // few seconds after stepping back has a control that undoes nothing, and the
  // clock they were ahead of would be reading the Story for them.
  paused.value = true
  // The step back from the Exits of a Scene that asked lets its answer go and
  // puts the Question again, and the Reader finds what they said in the field,
  // to keep or to change: they are going back over an answer, not being asked
  // afresh. Read before the move, while the Path still holds it.
  const sceneId = shown.value.sceneId
  const given = sceneId ? at.value.answers?.[sceneId] : undefined
  if (given !== undefined) draft.value = given
  if (behind.value) passBy(0, 'image', behind.value)
}

/**
 * The Exits this Reading took where it could have taken another, oldest first,
 * each with the Path standing where it was taken and the words its button showed
 * there: said with the Flags held on that Path, or the Scene it leads to where
 * its Author left it without words. The engine says which, and where a door
 * closed backwards cuts the list — see
 * `docs/adr/0080-a-reader-goes-back-to-the-exit-they-name.md`.
 */
const forked = computed(() => forks(story, at.value).map(({ exit, index }) => {
  const to = backTo(story, at.value, index)
  return { exit, to, words: offered(exit, reading(story, to).state.flags) }
}))

/**
 * Whether the list of them is open. Any move of the Reading closes it, since it
 * lists the Path that was, and a press on one of its entries took that entry
 * away with it. Esc closes it too, and puts the Reader back on the control that
 * opened it.
 *
 * Going back to one is a hard cut, as a step back is, and does not stop the
 * clock: the Reader has said where they want to stand, and a stand with a time
 * counts it again from the ways on being offered.
 */
const othersOpen = ref(false)
const othersId = useId()
const another = useTemplateRef<HTMLElement>('another')

watch(at, () => {
  othersOpen.value = false
})

function closeOthers() {
  othersOpen.value = false
  another.value?.focus()
}

/**
 * The Reader answers the Question on screen with what they typed, which is a move
 * like any other and lands them where the Exits are now offered — judged with the
 * answer, and said with it.
 */
function answers() {
  const sceneId = shown.value.sceneId
  if (!sceneId) return

  return moveTo(answer(at.value, sceneId, draft.value))
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

/**
 * Whether the Shot the frame holds is laid out full, covering the room the
 * Reading is shown in rather than standing in the reading column. Read off the
 * Shot and the Scene it is held in, the way its Cut is, so the frame held behind
 * the ways on keeps the Layout it played in. The whole Reading is drawn by it,
 * not the frame alone: under `full` it is one room tall. See
 * `docs/adr/0055-a-shot-is-laid-out-as-its-scene-says.md`.
 */
const full = computed(() => !!scene.value && !!held.value && layout(scene.value, held.value) === 'full')

/**
 * How the Image the frame holds moves while its Shot is on screen, resolved
 * against its Scene the way its Cut is, and nothing where it holds still — which
 * draws no animation at all, so every still Shot is the Shot it always was. See
 * `docs/adr/0057-the-image-moves-over-the-time-its-shot-is-on-screen.md`.
 */
const travel = computed(() => (scene.value && held.value ? movement(scene.value, held.value) : null))

/**
 * How long the Image the frame holds moves for. A Movement over the whole time
 * the clock holds its Shot is to end as the clock cuts, and the hold counts from
 * the text having arrived: so where the text arrives in its own time the
 * Movement spans the arrival too, which is the passage the caption's `--wait`
 * waits for, the wait after the Image lands, the last part's own `--at` and the
 * time that part takes to appear, whose end `textArrived` hears and arms the hold
 * on. A beat landed on with the clock stopped is given its text whole and counts
 * its hold from the Resume, so it has no arrival to span.
 */
const travelOver = computed(() => {
  if (!travel.value) return 0
  if (!travel.value.held || !ownTime.value || !arrives.value) return travel.value.over
  const { after, pace, over } = arrival.value!

  return passing.value.over + after + Math.round((lastAt.value / pace) * 1000) + over
    + travel.value.over
})

/**
 * How far the last Shot of a run had moved when the run ended, and over how
 * long, carried to the frame held behind the ways on or at the ending: that frame
 * is drawn afresh, keyed on the Path, and would otherwise start its Movement
 * over, and the Shot it holds is no longer on screen to say how long its text
 * took to arrive. Set by the move that ends the run, in `passOn`, and let go by
 * every other move of the Reading. The position it was carried to is kept only
 * to tell that move from the rest, and never to say which frame is owed it: a
 * step back across an Exit lands on that very position. So a held frame reached
 * any other way — a step back across an Exit, a Reading resumed at its ways on, a
 * Preview remounted or routed there — is handed no run's progress, and shows
 * where its Movement ends.
 */
const travelled = ref<{ at: string, ms: number, over: number }>()

watch(() => `${at.value.taken.length}-${at.value.shot}`, (now) => {
  if (travelled.value?.at !== now) travelled.value = undefined
})

/** A held frame nothing carried a Movement to is drawn where the Movement ends. */
const travelEnded = computed(() => !!travel.value && !shown.value.shot && !travelled.value)

const travelStyle = computed(() => {
  if (!travel.value || !held.value) return undefined
  const { from, to } = movementEnds(travel.value, held.value)

  return {
    '--travel-from': from,
    '--travel-to': to,
    '--travel-over': `${travelled.value?.over ?? travelOver.value}ms`,
    '--travelled': `${-(travelled.value?.ms ?? 0)}ms`,
    '--point': cropPosition(held.value),
  }
})

/**
 * An Exit is offered by what its text says once said, so one whose text says
 * nothing — a name this Reading holds no value for — is offered, like one nobody
 * has phrased yet, by where it arrives. Said against the State on screen, or
 * against the Flags of the Path an Exit taken earlier was offered on.
 */
function offered(exit: Exit, flags = shown.value.state.flags) {
  return exitNamed(
    { ...exit, text: said(exit.text, flags, declared.value) },
    id => sceneNamed(sceneNames.value, id, t),
    t,
  )
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

/** What that Scene's Transcript says, so one that says nothing is not drawn. */
const heardSaid = computed(() => heard.value && says(heard.value.transcript).trim())

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
 * two can come apart, because the Shot at a position is the engine's to say — a
 * Scene whose Flag decides its first Shot may find another one there when an
 * Author draws again in a Preview — and a text belongs to its Shot rather than to
 * the place the Shot is found at.
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

/** What the beat's text arrives by, or nothing where it arrives whole. */
const by = computed(() =>
  ownTime.value && arrival.value!.by !== 'whole' ? arrival.value!.by : undefined)

/**
 * The characters before the unit that arrives last, or nought where the caption
 * itself is the last to arrive: a text that is one word, or one line, has no unit
 * after the one the caption brings with it, and a piece at nought is not faded
 * twice. Reckoned on the plain words, as the bench reckons it.
 */
const lastAt = computed(() => by.value ? lastUnitAt(shown.value.shot!.text, by.value) : 0)

/**
 * How the renderer cuts the beat's text into what it arrives by, or nothing where
 * it arrives whole. The units are found over the formatted text's plain words, so
 * what the Reading draws and what the bench reckons are cut at the same edges;
 * each one after the first is due at the characters before it over the pace.
 */
const cutting = computed(() => by.value && {
  by: by.value,
  unit: (from: number) => ({
    class: 'unit',
    style: { '--at': `${Math.round((from / arrival.value!.pace) * 1000)}ms` },
    'data-last': arriving.value && from === lastAt.value ? '' : undefined,
  }),
})

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
// A Movement is held the same way and asked for the same reason.
watch(stopped, () => {
  if (arriving.value) {
    frame.value?.querySelector('figcaption')?.getAnimations({ subtree: true })
  }
  if (travel.value) frame.value?.querySelector('.moving')?.getAnimations()
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
 * The keys a Reading is gone on with. Each does what one of the two controls
 * under the frame does at that moment, and only where that control is drawn:
 * `Space`, `Enter`, `→` and `PageDown` what *Next Shot* does, `←` and `PageUp`
 * what *Step Back* does. Every beat lands the focus on the frame, which is no
 * control, so without them every beat costs a Reader by keyboard a Tab and an
 * Enter — see issue #391.
 *
 * Heard on the document, the way the bar of Commands hears ⌘K, and answered from
 * inside the Reading. On the page a Reader reads on, the one that keeps the Path,
 * they are answered from the page itself too. A Preview is one pane of a bench
 * full of fields, so it answers from inside alone. A field or a control keeps its
 * own keys: `Space` on an Exit takes that Exit. A key held with a modifier is
 * never answered either, since that is how the bench's own keys are pressed. The
 * browser's answer to the key, such as scrolling the page, is taken away only
 * where the key acted.
 *
 * Pressing the picture is still no way on. A Reader pressing it to look at it would
 * be carried on by accident, and pressing a key is not a way of looking — see
 * `docs/adr/0055-a-shot-is-laid-out-as-its-scene-says.md`.
 */
const GOES_ON = [' ', 'Enter', 'ArrowRight', 'PageDown']
const STEPS_BACK = ['ArrowLeft', 'PageUp']

/**
 * What a key or a swipe asked for, done where its control is drawn; whether it
 * was. *Next Shot* is drawn only while a Shot is on screen, so the Question
 * stands still for both: it is answered in its field or not at all, and no key
 * and no finger goes on past it. Stepping back from it is a step back like any
 * other, and the keys typed in the field are the field's own, below.
 */
function went(way: 'on' | 'back' | null) {
  if (way === 'on' && shown.value.shot) pressed()
  else if (way === 'back' && moved(at.value) && behind.value) stepBack()
  else return false
  return true
}

function readByKeys(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  const on = event.target as HTMLElement
  if (!root.value?.contains(on) && !(keptFor && on === document.body)) return
  if (on.isContentEditable || on.matches('button, a, input, textarea, select')) return

  const way = GOES_ON.includes(event.key) ? 'on' : STEPS_BACK.includes(event.key) ? 'back' : null
  if (went(way)) event.preventDefault()
}

/**
 * A finger crossing the frame is a press of the control that way, the way a key
 * is: read as it lifts, by `swiped`, and answered by `went`, so the focus and
 * what is announced are a key's. A touch alone counts. A mouse or a pen dragging
 * across the frame selects its words, and nothing here takes that away. Heard on
 * the frame alone, which holds no control, so a touch that starts on one is the
 * control's; one the browser takes for a scroll is cancelled and forgotten. The
 * frame does not follow the finger: the Cut stays the one passage between two
 * beats — see `docs/adr/0065-a-swipe-across-the-frame-is-a-press.md`.
 */
let touched: Touched | undefined

function touches(event: PointerEvent) {
  touched = event.pointerType === 'touch'
    ? { x: event.clientX, y: event.clientY, t: event.timeStamp }
    : undefined
}

function lifts(event: PointerEvent) {
  if (!touched || event.pointerType !== 'touch') return
  const from = touched
  touched = undefined
  went(swiped(from, { x: event.clientX, y: event.clientY, t: event.timeStamp }))
}

/**
 * Whether the Reader is offered the whole screen, and whether the Reading has it.
 * Only a Reader is offered it. A Preview's pane is the room its full Shots are
 * measured against, and an Author reads where they write — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`. It is offered only where
 * the browser can give an element the screen at all, which Safari on an iPhone
 * cannot: a control over nothing is not drawn, which is the rule *Pause* follows.
 * Read once mounted, because the server knows neither the browser nor its screen.
 *
 * Followed off `fullscreenchange` rather than set by the press, so leaving with the
 * browser's own Esc relabels the control too. Arriving there puts the Reader on the
 * beat, as starting the clock again does: left on the control, the next `Space`
 * would hand the screen back instead of going on.
 */
const fillable = ref(false)
const filling = ref(false)

function fills() {
  filling.value = !!root.value && document.fullscreenElement === root.value
  if (filling.value) land()
}

function fillOrLeave() {
  // A browser that refuses refuses quietly: the Reading goes on in its page.
  if (filling.value) document.exitFullscreen().catch(() => {})
  else root.value?.requestFullscreen().catch(() => {})
}

onMounted(() => {
  fillable.value = !!keptFor && document.fullscreenEnabled
  document.addEventListener('keydown', readByKeys)
  document.addEventListener('fullscreenchange', fills)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', readByKeys)
  document.removeEventListener('fullscreenchange', fills)
})

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
 *
 * All three wait on a Question. While one stands no Exit is offered, so there is
 * no time to stand for and nothing to take; the Question waits for the Reader
 * whatever the Scene says. The answer puts the Exits on offer, and that is when
 * their time starts — a Scene that flows into the next flows the moment it is
 * answered, into the first Exit the answer offers.
 */
const standing = computed(() => (shown.value.exits.length ? scene.value?.exitsAfter ?? null : null))
const asking = computed(() => shown.value.exits.length > 0 && standing.value !== 0)

/**
 * What the ways on say for themselves as they arrive, for whoever cannot see
 * them arrive. A Reader standing on the frame is told by the focus landing in the
 * list; a Reader standing on a control of their own is told by this and by
 * nothing else, so it says a choice is there whether or not a clock is running on
 * it — a Scene whose beats are clocked and whose choice is open is the commonest
 * shape there is, and it would otherwise stop in silence. A Question is told the
 * same way: a clock that cuts to it leaves that Reader on their control and puts
 * no focus in its field, so this says that a Question waits for their answer.
 * Empty where nothing is being asked: a run still playing, or a Scene flowing
 * into the next.
 */
const waysOnSay = computed(() => {
  if (shown.value.question) return t('reading.questionWaits')
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
    press: () => taking(first, true),
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
 * A clock is not the only thing that moves by itself. An Image that moves goes on
 * moving while its Shot is on screen, and an Effect that lasts goes on for as long
 * as its beat stands, which is the motion 2.2.2 owes a pause over just as surely,
 * so `movesAtAll` and `lasts` give the same control for the same reason. They are
 * answers beside `clocked` rather than a wider `clocked`, because `clocked` also
 * says whether the ways on are told how long they stand, and that is a clock's
 * alone.
 */
const clocked = computed(() => timed(story))
const movesAtAll = computed(() => movesItself(story))
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
 * Whether a run of the beat's words is taken apart into words or letters, which
 * draws the text twice, as a text cut into units is: the copy that moves hidden
 * from the accessibility tree, and the words whole beside it, so a screen reader
 * reads the sentence as written from the landing and never a stand-in. A run on
 * its own inline element leaves its text in the tree and needs neither.
 */
const apart = computed(() => !!held.value && takesApart(held.value.formatted))

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
  <!-- As wide as the room at every Layout, and one room tall where the beat it
       holds is laid out full: see `.reading.full`. -->
  <div ref="root" class="reading" :class="{ full }">
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
             `docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`.

             The beat leaving is pinned at the size it stood at before it is
             taken out of the flow, so a passage between two Layouts is one
             picture opening onto the other: a frame covering the room keeps the
             room while a frame in the column arrives, and the other way about. -->
        <Transition
          :name="passing.through === 'black' ? 'through-black' : 'dissolve'"
          :css="passing.over > 0"
          @before-leave="pinned"
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
          <!-- What the Shot carries is read before its Layout is, and neither is a
               setting: a Shot carrying no Image is a card, the room going dark with
               words in it, and its Layout says only how large the card is. -->
          <figure
            ref="frame"
            :key="`${at.taken.length}-${at.shot}`"
            class="frame"
            :class="{
              'pushed-back': !shown.shot && !shown.ended,
              'to-black': toBlack,
              full,
              card: !held.image,
            }"
            :lang="story.language"
            :style="{ '--wait': `${wait}ms`, '--end-over': toBlack ? `${ending!.over}ms` : undefined }"
            :aria-busy="onItsWay || undefined"
            tabindex="-1"
            @pointerdown="touches"
            @pointerup="lifts"
            @pointercancel="touched = undefined"
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
                 lasts, and what lasts wraps the Movement, so a shake keeps its reach
                 however the Image moves inside it.
                 The wrappers are drawn on every beat and carry an Effect only where
                 there is one, so a beat without one is the beat it always was. What
                 no filter or transform of the picture can paint — a sheet of white,
                 the edges closing in, grain — lies over it, fixed to the box and
                 kept from the accessibility tree, since an Effect is never
                 announced: it would narrate the decoration over the Author's
                 sentence. -->
            <!-- Laid out full, the Image covers the frame and is cropped around
                 the point the Author pressed on the Contact Sheet. Inset it is
                 shown whole, so nothing is cropped and there is no point to say —
                 unless it moves, and then it covers its box and is cropped around
                 its point too. -->
            <div v-if="held.image" class="picture">
              <div class="arrives" v-bind="imageArrival">
                <div class="lasts" v-bind="imageLasting">
                  <!-- The Movement, the innermost box, so whatever an Effect does
                       moves the moving Image with it, and `.picture` clips both. -->
                  <div class="moving" :class="{ moves: travel, ended: travelEnded }" :style="travelStyle">
                    <img
                      :src="held.image"
                      :alt="held.description"
                      :style="full || travel ? { objectPosition: cropPosition(held) } : undefined"
                    >
                  </div>
                </div>
              </div>
              <div v-if="arrivalOverlay" class="overlay" v-bind="arrivalOverlay" aria-hidden="true" />
              <div v-if="lastingOverlay" class="overlay" v-bind="lastingOverlay" aria-hidden="true" />
            </div>
            <!-- Only where the Shot has words to say: white space is none, and a
                 Shot carrying only an Image is the Image and nothing under it. -->
            <figcaption
              v-if="(shown.shot || !left) && held.text.trim()"
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
              :data-last="arriving && lastAt === 0 ? '' : undefined"
              @animationend="textArrived"
            >
              <div class="arrives" v-bind="captionArrival">
                <div class="lasts" v-bind="captionLasting">
                  <!-- The text as it was formatted, in the face and alignment its
                       Story is set in, each run moving as its Effect says. Cut into
                       what it arrives by, or with a run taken apart into its words
                       or its letters, it is drawn twice, as the comment on the
                       frame says: the pieces hidden from the accessibility tree,
                       and the whole beside them, so a screen reader hears the
                       styles, the languages and what a bar hides rather than
                       pieces, and never a stand-in. -->
                  <div v-if="cutting || apart" class="shot" v-bind="setIn(story)">
                    <Formatted
                      aria-hidden="true"
                      :formatted="held.formatted"
                      :cut="cutting"
                      :moving="drawnAs"
                    />
                    <Formatted class="visually-hidden" :formatted="held.formatted" />
                  </div>
                  <Formatted
                    v-else
                    class="shot"
                    v-bind="setIn(story)"
                    :formatted="held.formatted"
                    :moving="drawnAs"
                  />
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
      <div v-if="heardSaid || held.transcript" class="heard">
        <p v-if="heardSaid" class="transcript" :class="{ 'visually-hidden': !transcribed }">
          <span class="eyebrow">{{ $t('reading.sceneTranscript') }}</span>
          <span :lang="story.language">{{ heardSaid }}</span>
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

    <!-- Said once a move has been held past half a second for the Image of the
         beat it lands on, and gone as that beat lands. Quiet, and no live region:
         the frame says it is busy, and the network is not to be read out over
         the Story. -->
    <p v-if="onItsWay" class="trail">{{ $t('reading.onItsWay') }}</p>

    <!-- The Question, drawn where the ways on are drawn and instead of them, under
         the frame the Scene played out on. Its sentence is the Author's, said with
         the Flags this Reading holds and set in the Story's Language, and it is the
         field's own label, so whoever lands in the field hears what they are asked.
         What is typed there is the Reader's, in the Story's Language too.

         A form, so `Enter` in the field presses *Answer* as the browser has it do,
         and the keys a Reading is gone on with are the field's own while it is
         typed in: `readByKeys` leaves a field alone. The Flag the answer is held
         under is the Author's name for it and is nowhere here, on screen or in an
         accessible name — see
         `docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`. -->
    <form v-if="shown.question" class="question" @submit.prevent="answers">
      <label :for="questionId" :lang="story.language" :style="setIn(story).style">
        {{ says(shown.question) }}
      </label>
      <input
        :id="questionId"
        ref="asked"
        v-model="draft"
        type="text"
        :lang="story.language"
        :maxlength="FLAG_VALUE_MAX_LENGTH"
        autocomplete="off"
      >
      <button type="submit">{{ $t('reading.answer') }}</button>
    </form>

    <!-- What tells a Reader who cannot see the ways on that they are being asked,
         and what the choice stands under. It comes before the list rather than
         after it, because the focus lands inside the list and what follows the
         control a screen reader is announcing is reached only by walking the
         virtual cursor forward, which is walking it while the clock runs. A
         status, so it is heard where it is rather than found, and in the document
         before it has anything to say — the way `ended` below is, and for the
         same reason. Drawn only where a clock can run at all, which is one of the
         places the pause below is drawn: a Story read entirely by the hand never
         strands a Reader, because every arrival on it is a press of theirs, and an
         Image that moves or an Effect that lasts moves the beat but never the
         Reading on. Still not a timer: it says how long the ways on stand, true
         for the whole of the stand, and never counts anything down. -->
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
          @click="taking(exit)"
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
         one refusal of the Sound, the words for whoever cannot hear it, and the
         whole screen. All four are the person's rather than the Reading's, so none
         of them touches the Path.

         The pause comes first because it is the one control over something
         already happening, and it is drawn only where something can happen: a
         clock, an Image that moves while its Shot is on screen, or an Effect that
         lasts, which moves by itself for as long as its beat stands. A Story
         nobody wrote a time, a Movement or a lasting Effect into is read entirely
         by the hand, and a control over nothing that ever moves would do nothing
         — the way a Story carrying no Sound is given no title card to press. The
         whole screen comes last, because it is the one control that is not over
         anything the Story does. -->
    <p v-if="movesAtAll || lasts || heardAtAll || fillable" class="given">
      <button v-if="movesAtAll || lasts" type="button" class="trail" @click="pauseOrResume">
        {{ paused ? $t('reading.resume') : $t('reading.pause') }}
      </button>
      <button v-if="heardAtAll" type="button" class="trail" @click="sounding = !sounding">
        {{ sounding ? $t('reading.soundOff') : $t('reading.soundOn') }}
      </button>
      <button
        v-if="heardAtAll && (heardSaid || held?.transcript)"
        type="button"
        class="trail"
        @click="transcribed = !transcribed"
      >
        {{ transcribed ? $t('reading.hideTranscript') : $t('reading.showTranscript') }}
      </button>
      <button v-if="fillable" type="button" class="trail" @click="fillOrLeave">
        {{ filling ? $t('reading.leaveFullScreen') : $t('reading.fullScreen') }}
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
      <!-- Between the two, since it goes back further than a beat and less far
           than the start. Drawn wherever an Exit taken can be gone back to — at an
           ending, at the ways on, and in the middle of a run, because a Reader
           who sees where an Exit led them often knows at once they wanted the
           other. -->
      <button
        v-if="forked.length"
        ref="another"
        type="button"
        class="trail"
        :aria-expanded="othersOpen"
        :aria-controls="othersId"
        @click="othersOpen = !othersOpen"
        @keydown.esc="closeOthers"
      >
        {{ $t('reading.another') }}
      </button>
      <button
        ref="again"
        type="button"
        :class="{ trail: !shown.ended }"
        @click="readAgain"
      >
        {{ $t('reading.again') }}
      </button>
    </p>

    <!-- What *Take Another Exit* opens, in place under the controls: each Exit by
         the words its button showed, which are the Story's own and in its
         Language, and nothing else of the Story — no Scene, no Place, no count.
         In the document while the control is, so the control names an element
         that is there. -->
    <ol
      v-if="forked.length"
      v-show="othersOpen"
      :id="othersId"
      class="others"
      :aria-label="$t('reading.taken')"
      @keydown.esc="closeOthers"
    >
      <li v-for="way in forked" :key="way.exit.id">
        <button
          type="button"
          :aria-label="$t('reading.backTo', { words: way.words })"
          @click="passBy(0, 'image', way.to)"
        >
          <span :lang="story.language">{{ way.words }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/* As wide as the room it was given, and sat in the middle of it rather than under
   whatever is above it. Both doors pad the room inline by the same step — `.room`
   on the Reader's page, `.preview` on the bench — and the Reading takes that step
   back on either side, so a frame laid out full can reach the room's edges.
   Everything in it stands in the one reading column, as wide as a gate wants to
   be and no wider, centred, with the step kept either side of it on a phone; only
   the gate is given the room. A Story with no Shot laid out full is drawn at
   exactly the widths it always was.

   The column is drawn as lines of a grid rather than as a width on each thing in
   it, so whatever stands in it keeps its own alignment there: *Next Shot* is as
   wide as its name, at the column's leading edge, as it always was. Never
   narrower than the longest word in it, because the frame clips what overflows
   it: a word too long for a phone widens the column and the page scrolls
   sideways, as it always did, rather than lose its end. */
.reading {
  display: grid;
  grid-template-columns:
    [room-start] minmax(var(--s4), 1fr)
    [column-start] minmax(auto, 46rem)
    [column-end] minmax(var(--s4), 1fr)
    [room-end];
  align-self: center;
  row-gap: var(--s4);
  inline-size: calc(100% + 2 * var(--s4));
  margin-inline: calc(-1 * var(--s4));
  padding-block-end: var(--s6);
}

.reading > * {
  grid-column: column;
}

/* Under a beat laid out full, the Reading is at least one room tall and the frame
   is what the rows under it leave: *Next Shot* or the ways on, the drain, the
   Transcripts and the trail, each of them in the window at every width, and
   nothing laid over the Image but the Shot's own words. At least and not exactly,
   so a text longer than the room can carry grows the room rather than lose a word
   off its foot: the frame's row may shrink to nothing and is never smaller than
   what it holds. The room is the pane on the bench, which is a size container, and
   the window on the Reader's page, where nothing is and `cqb` is the small viewport
   — the right height there anyway, since a frame whose foot carries the text must
   never reach under a phone's browser bar.

   The notice of a Reading picked up stands above the frame, so where it is said
   the frame's row is the second. */
.reading.full {
  grid-template-rows: minmax(0, 1fr);
  min-block-size: 100cqb;
}

.reading.full:has(> .resumed) {
  grid-template-rows: auto minmax(0, 1fr);
}

/* Given the whole screen, the Reading is the room. It is painted the room's colour
   over anything the browser would show behind it, and it scrolls itself where
   what it holds is taller than the screen. Its column stands in the middle of the
   screen, down as well as across: safely, so a Reading taller than the screen
   starts at its head rather than above it.

   The browser holds an element in the whole screen at exactly the screen's
   height, so under a beat laid out full the frame's row is never shorter than
   what it holds. A text the screen cannot carry makes the Reading scroll rather
   than lose a line off its foot. */
.reading:fullscreen {
  align-content: safe center;
  overflow-y: auto;
  background: var(--room);
}

.reading.full:fullscreen {
  grid-template-rows: 1fr;
}

.reading.full:fullscreen:has(> .resumed) {
  grid-template-rows: auto 1fr;
}

/* The image and the text share the one gate, because they are one beat and not
   an illustration with a caption under it. Held to the reading column inside the
   gate, and the room's width where it is laid out full.

   Positioned for the Image laid out full, which is drawn over the whole frame —
   in this rule rather than under `.full` so that the beat leaving, taken out of
   the flow by a rule as specific as this one and written after it, still is.

   A finger going down the frame scrolls the page and one going across it is the
   Reading's, which is what `pan-y` tells the browser. Two fingers still zoom into
   the picture: that is looking at it, which nothing here may take away. */
.frame {
  position: relative;
  grid-column: column;
  overflow: clip;
  touch-action: pan-y pinch-zoom;
}

/* A passage is two frames on screen at once, and the room is the size of the one
   arriving: the beat leaving is taken out of the flow and fades where it stood,
   so the page settles the moment the new beat is in — which is what a hard cut
   has always done here and what every Story written before the Cut still does.

   The gate is the room's width at every Layout and draws the Reading's own
   column inside it, so a frame in the column stands where the press under it
   does, and a passage from the column to the room is made inside one gate that
   neither frame resizes. */
.gate {
  display: grid;
  grid-column: room;
  grid-template-columns: subgrid;
  position: relative;
}

/* The beat leaving is `inert` from the moment it starts to go, which is what
   takes it out of reach of a press as well as out of the reading. It is laid in
   the lines of the gate its Layout gives it, at the size `pinned` kept for it. */
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
.dissolve-leave-active :deep([data-effect]),
.through-black-leave-active :deep([data-effect]) {
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
   delays it. So the animation is taken off outright. Under less motion, a
   scramble shows its words from the start, and a wave and a letter's tremor
   stand still. */
@media (prefers-reduced-motion: reduce) {
  .frame :deep([data-effect]) {
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

/* Every colour the Author set the words in steps back with them. */
.frame.pushed-back .shot :deep(:is(.ink-rose, .ink-amber, .ink-green, .ink-blue, .ink-violet)) {
  --inked: var(--muted);
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
   long for the line from widening it, and a word clipped is a word lost.

   The hairline is drawn only where there is text under it to separate the Image
   from: a Shot carrying only an Image is the Image and its edge. */
.picture {
  position: relative;
  overflow: clip;
  container-type: inline-size;
  background: var(--room);
}

.picture:not(:last-child) {
  border-block-end: 1px solid var(--edge);
}

/* The Movement: the Image comes closer, draws away or crosses the frame at an
   even pace over its time and rests where it ends, about the point it is cropped
   around. Only `transform` moves, which the compositor carries without layout or
   paint, and no `will-change`: a running animation is composited already, and
   `will-change` would pin the scale the layer was first drawn at, softening the
   Image at its closest. A Movement carried from the end of a run starts where it
   had got to, by a negative delay. */
.moving.moves {
  transform-origin: var(--point);
  animation: travel var(--travel-over) linear var(--travelled, 0ms) both;
}

@keyframes travel {
  from {
    transform: var(--travel-from);
  }
  to {
    transform: var(--travel-to);
  }
}

/* An inset Image that moves covers its box, cropped around its point: grown
   inside the bars beside a tall Image, its edges would be seen moving. */
.moving.moves img {
  object-fit: cover;
}

/* The Pause, a hidden tab and the frame held behind the ways on stop it where it
   stands, and it resumes from there: the hold restarts, but a restarted Movement
   would jump the Image back to its start. */
.gate.stopped .moving,
.frame.pushed-back .moving {
  animation-play-state: paused;
}

/* A held frame nothing carried a Movement to, and a Reader who asked for less
   motion, are shown where it ends: the end is where the Author takes the Reader.
   `frameline.css` lands a running animation at its end but leaves a paused one at
   its start, so the animation is taken off here outright. */
.moving.moves.ended {
  animation: none;
  transform: var(--travel-to);
}

@media (prefers-reduced-motion: reduce) {
  .moving.moves {
    animation: none;
    transform: var(--travel-to);
  }
}

figcaption {
  padding: var(--s5) clamp(var(--s4), 4vw, var(--s5));
}

/* A card: a Shot carrying words and no Image, which is the room gone dark with
   words in it, so it is drawn on the room rather than on the lit gate an Image is
   set in, its text centred across and down and its lines centred. In the column it
   stands at sixteen by nine, the shape of every print and thumbnail the bench
   draws, so a run alternating Images and cards keeps one shape of frame; and it
   grows past that where its words need the lines, which `aspect-ratio` does by
   itself for a box whose content is taller than the ratio. Stretched across the
   column, since a box of a set ratio would otherwise be as narrow as its words. */
.frame.card {
  display: grid;
  align-content: center;
  justify-self: stretch;
  background: var(--room);
  text-align: center;
}

.frame.card:not(.full) {
  aspect-ratio: 16 / 9;
}

.frame.card .shot,
.frame.full .shot {
  margin-inline: auto;
}

/* Laid out full, the frame is the room: edge to edge, with the room's edges and
   no gate's border or curve of its own, and the ring the arrival is announced by
   drawn inside it, where the window's edge would otherwise cut it off. The Image
   covers the whole of it, cropped around its point, and the words are laid in the
   flow over its foot, so a text the room cannot carry makes the frame taller
   rather than run past its edge.

   The Image is laid under everything else the frame paints, the ring included: a
   frame of its own for stacking, and the Image beneath its flow. Left above the
   flow, as a positioned box is by default, it would cover the words and the ring
   with them, and a Reader landing on the beat by keyboard would be shown no ring
   at all. */
.frame.full {
  grid-column: room;
  display: grid;
  border: 0;
  border-radius: 0;
  background: var(--room);
  isolation: isolate;
}

.frame.full:focus-visible {
  outline-offset: -4px;
}

.frame.full .picture {
  position: absolute;
  inset: 0;
  z-index: -1;
  border: 0;
}

.frame.full .picture .arrives,
.frame.full .picture .lasts,
.frame.full .picture .moving {
  block-size: 100%;
}

.frame.full img {
  block-size: 100%;
  max-block-size: none;
  object-fit: cover;
}

/* The words over the Image lie on the reading measure, centred in the room like
   the column under them, so the eye finds them where it found them in the
   column. The scrim is the caption's own box, the frame's whole width: it rises
   one step above the first line out of nothing and holds from 70% of the room
   under every line to 85% at the foot. Seventy is the floor and not a taste —
   `--paper` needs 62% over a white Image to be read at 4.5:1, and the pushed-back
   `--muted` 67% over a white Image dimmed to half. */
.frame.full:not(.card) figcaption {
  align-self: end;
  padding-block-start: var(--s6);
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in oklab, var(--room) 70%, transparent) var(--s6),
    color-mix(in oklab, var(--room) 85%, transparent)
  );
}

/* Where the text stands, which the Author says on the text because it follows
   the picture: at the foot by default over an Image laid out full, in the middle
   on a card, and read nowhere else — an Image inset has its text under it. The
   scrim goes where the text goes and keeps its floor of 70% under every line:
   from the top it rises out of nothing below the last line, and in the middle it
   does so on both sides. */
.frame.full:not(.card) figcaption:has([data-stands='top']) {
  align-self: start;
  padding-block: var(--s5) var(--s6);
  background: linear-gradient(
    to top,
    transparent,
    color-mix(in oklab, var(--room) 70%, transparent) var(--s6),
    color-mix(in oklab, var(--room) 85%, transparent)
  );
}

.frame.full:not(.card) figcaption:has([data-stands='middle']) {
  align-self: center;
  padding-block: var(--s6);
  background: linear-gradient(
    transparent,
    color-mix(in oklab, var(--room) 70%, transparent) var(--s6)
      calc(100% - var(--s6)),
    transparent
  );
}

.frame.card:has([data-stands='top']) {
  align-content: start;
}

.frame.card:has([data-stands='foot']) {
  align-content: end;
}

/* A card laid out full is the whole frame on the dark, which is what an
   intertitle between two pictures that fill the screen always was, and it is set
   larger than the words under an Image, measured against the room like the frame
   is. */
.frame.full.card .shot {
  font-size: clamp(1.5rem, 1rem + 2cqi, 2.25rem);
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
.frame :deep([data-effect]) {
  animation-delay: var(--wait, 0ms);
  animation-fill-mode: both;
}

/* A beat the Reader is not shown arriving — a step back, a press while the clock
   is stopped, the frame held behind the ways on — is drawn in the state its
   arrival ends in, which is the Effect's own style with the animation off. */
:deep([data-effect][data-rest]) {
  animation: none;
}

/* The Pause and a tab nobody is looking at stop every Effect where it stands
   rather than taking it off, so each resumes from there: a restarted arrival
   would replay a flash nobody wrote, and a restarted flicker dips too soon. */
.stopped :deep([data-effect]) {
  animation-play-state: paused;
}

/* An Effect's three degrees, written with it as the three columns they are, and
   the one its strength reads. */
:deep([data-strength="slight"]) {
  --degree: var(--slight);
}

:deep([data-strength="marked"]) {
  --degree: var(--marked);
}

:deep([data-strength="strong"]) {
  --degree: var(--strong);
}

/* A jolt dying away, by a share of its reach, which is the width and the height of
   what jolts, overscaled on the Image by twice its share so no edge of the picture
   shows while it jolts. Words have no edge to show. A run's word reaches by the em
   instead: a share of its own width is a fraction of a pixel, and twelve em is
   about as far as the whole text jolts on a phone. */
:deep([data-effect="shake"]) {
  --slight: 0.005;
  --marked: 0.015;
  --strong: 0.03;
  --reach: 100%;

  animation: shake var(--over) linear;
}

.picture :deep([data-effect="shake"]) {
  --overscale: calc(1 + 2 * var(--degree));
}

figcaption :deep(.word[data-effect="shake"]) {
  --reach: 12em;
}

@keyframes shake {
  0% {
    translate: 0;
    scale: var(--overscale, 1);
  }
  8% {
    translate: calc(var(--degree) * -1 * var(--reach)) calc(var(--degree) * 0.6 * var(--reach));
  }
  20% {
    translate: calc(var(--degree) * 0.9 * var(--reach)) calc(var(--degree) * -0.5 * var(--reach));
  }
  34% {
    translate: calc(var(--degree) * -0.6 * var(--reach)) calc(var(--degree) * 0.35 * var(--reach));
  }
  50% {
    translate: calc(var(--degree) * 0.4 * var(--reach)) calc(var(--degree) * -0.2 * var(--reach));
  }
  66% {
    translate: calc(var(--degree) * -0.2 * var(--reach)) calc(var(--degree) * 0.1 * var(--reach));
  }
  80% {
    translate: calc(var(--degree) * 0.08 * var(--reach)) 0;
    scale: var(--overscale, 1);
  }
  100% {
    translate: 0;
    scale: 1;
  }
}

/* From its strength to sharp: a share of the frame's width on the Image, and of
   the letter on the words. */
:deep([data-effect="from-blur"]) {
  --slight: 0.5cqi;
  --marked: 1.5cqi;
  --strong: 4cqi;

  animation: from-blur var(--over) ease-out;
}

figcaption :deep([data-effect="from-blur"]) {
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
:deep([data-effect="from-white"]) {
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
:deep([data-effect="into-colour"]),
:deep([data-effect="out-of-colour"]) {
  --slight: 0.4;
  --marked: 0.7;
  --strong: 1;
}

:deep([data-effect="into-colour"]) {
  animation: into-colour var(--over) ease-in-out;
}

@keyframes into-colour {
  from {
    filter: grayscale(var(--degree));
  }
}

:deep([data-effect="out-of-colour"]) {
  filter: grayscale(var(--degree));
  animation: out-of-colour var(--over) ease-in-out;
}

@keyframes out-of-colour {
  from {
    filter: grayscale(0);
  }
}

/* A falloff to the room, scaled in from past the edges of the box and kept. */
:deep([data-effect="closing-in"]) {
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
:deep([data-effect="flicker"]) {
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
:deep([data-effect="pulse"]) {
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
:deep([data-effect="tremor"]) {
  --slight: 0.25cqi;
  --marked: 0.6cqi;
  --strong: 1.2cqi;

  animation: tremor var(--every) linear infinite;
}

figcaption :deep([data-effect="tremor"]) {
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

/* A run taken apart breaks a line only between its words, wherever #358's units
   cut it: the run keeps its line whole and gives each space back the wrap. Each
   word and each letter is a box a transform can reach. */
.frame :deep(.apart) {
  white-space: pre;
}

.frame :deep(.apart .gap) {
  white-space: pre-wrap;
}

.frame :deep(:is(.word, .letter)) {
  display: inline-block;
}

/* A box of its own takes no line from the words around it, so a run taken apart
   under #359's underline or strike would have it drawn under its spaces alone.
   Each word and each letter draws the line again itself; a word made of letters
   holds no text outside them to draw it under, so the line is still drawn once. */
.frame :deep(u :is(.word, .letter)) {
  text-decoration: underline;
}

.frame :deep(s :is(.word, .letter)) {
  text-decoration: line-through;
}

/* A scramble: the letter is hidden until its Place in the run is reached, over
   `over`, and its stand-ins lie over it one after another before that, each for
   an equal share of the wait. Nothing is rewritten and no letter moves, so the
   line never reflows. At rest and under less motion the letter is all there is. */
.frame :deep(.letter) {
  position: relative;
}

.frame :deep(.stand-in) {
  position: absolute;
  inset: 0;
  opacity: 0;
  text-align: center;
  user-select: none;
}

:deep([data-effect="scramble"]) {
  animation: scramble calc(var(--over) * var(--step)) step-end;
}

:deep([data-effect="scramble"]:where(.stand-in)) {
  animation: stand-in calc(var(--over) * var(--step) / var(--of)) step-end;
}

@keyframes scramble {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes stand-in {
  from,
  to {
    opacity: 1;
  }
}

/* A wave: each letter rises and falls once a round, a little behind the one
   before, all of them moving from the start. */
:deep([data-effect="wave"]) {
  --slight: 0.08em;
  --marked: 0.15em;
  --strong: 0.3em;

  animation: wave var(--every) ease-in-out infinite;
}

@keyframes wave {
  0%,
  100% {
    translate: 0;
  }
  25% {
    translate: 0 calc(var(--degree) * -1);
  }
  75% {
    translate: 0 var(--degree);
  }
}

/* Where each piece of a run starts. It outranks the shorthand every Effect is
   written in, as the frame's own wait does, and writes neither the name nor the
   play state, so the rest, the Pause and less motion still take the animation
   off or stop it. A letter that lasts keeps its phase in the round; an arrival on
   a word or a letter waits, while the text arrives, for the unit it is in. */
.frame :deep(.letter[data-effect]) {
  animation-delay: calc(var(--wait, 0ms) - var(--every) * (1 - var(--phase)));
}

.frame :deep(:is([data-effect="shake"], [data-effect="scramble"]):is(.word, .glyph)) {
  animation-delay: calc(var(--wait, 0ms) + var(--piece-at, 0ms));
}

.frame :deep(.stand-in[data-effect]) {
  animation-delay: calc(var(--wait, 0ms) + var(--piece-at, 0ms) + var(--over) * var(--step) * var(--k) / var(--of));
  animation-fill-mode: none;
}

/* Grain is a sheet because a filter cannot make noise: one tile of it, painted
   once on a sheet twice the box's size and moved to another offset 24 times a
   second, which costs the compositor a layer and repaints nothing. It lies over
   the Image and under the words, which are not on the film. Standing still, it
   is still grain. */
:deep([data-effect="grain"]) {
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
   while it arrives, so they play as it appears rather than unseen before it. The
   units are drawn by the renderer inside `Formatted`, which is why they are
   reached through `:deep`. */
.arriving,
.arriving :deep(.unit) {
  animation: arrive var(--text-over) ease backwards;
}

.arriving {
  animation-delay: calc(var(--cut-over, 0ms) + var(--after));
}

.arriving :deep(.unit) {
  animation-delay: calc(var(--cut-over, 0ms) + var(--after) + var(--at));
}

/* A unit inside a run arriving taken apart lends it its time, and appears at
   once rather than fading: the run's own arrival is how it comes. */
.arriving :deep(.unit) {
  --piece-at: var(--at);
}

.arriving :deep(.apart-arrives .unit) {
  animation-timing-function: step-start;
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
.arriving.stopped :deep(.unit) {
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

/* The Question, where the ways on stand and as wide as they are: the Author's
   sentence across the column in the face the Story is set in, since it is the
   Story speaking, and under it the field and the press beside it, the press
   weighed as *Next Shot* is because it is the one way on there is. */
.question {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--s2);
}

.question label {
  grid-column: 1 / -1;
  font-family: var(--shot-face, var(--prose));
  font-size: 1.1875rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.question button {
  padding-inline: var(--s4);
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
.back .trail,
.others button {
  border-color: transparent;
  background: none;
}

.given button:hover,
.back .trail:hover,
.others button:hover {
  border-color: transparent;
  background: none;
  color: var(--paper);
}

/* The Exits that can be gone back to, one to a line in the order they were
   taken, so the list reads as the Reading did. Quiet as the trail above them, and
   in the face the ways on are offered in rather than the trail's capitals, since
   what each says is the Author's. */
.others {
  display: grid;
  justify-items: start;
  gap: var(--s1);
}

.others button {
  color: var(--muted);
  font-size: 0.875rem;
  text-align: start;
}
</style>
