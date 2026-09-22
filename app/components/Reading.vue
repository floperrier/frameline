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
 */
const frame = useTemplateRef<HTMLElement>('frame')
const exits = useTemplateRef<HTMLElement>('exits')
const again = useTemplateRef<HTMLElement>('again')

async function moveTo(to: Path) {
  at.value = to
  resumed.value = false
  await nextTick()
  ;(shown.value.shot ? frame.value : (exits.value?.querySelector('button') ?? again.value))?.focus()
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
 * on the Story.
 */
const passing = ref<{ over: number, through: CutThrough }>({ over: 0, through: 'image' })

function passBy(over: number, through: CutThrough, to: Path) {
  passing.value = { over, through }

  return moveTo(to)
}

/**
 * The cut the press makes, which is the cut the clock makes where the press does
 * not come. Both read the Shot's own Cut and pass by it, so the two are one
 * passage made two ways.
 *
 * Asked of the Shot on screen and the Scene it belongs to without either being
 * checked, because the one control that calls this is drawn only while a Shot is
 * on screen — and a Shot on screen is a Shot of the run the Reading stands in.
 */
function passOn() {
  const made = cut(scene.value!, shown.value.shot!)

  return passBy(made.over, made.through, advance(at.value))
}

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

/** The Scene the Reading stands in, so the frame can say where the Reader is. */
const scene = computed(() => story.scenes.find(({ id }) => id === shown.value.sceneId))

/**
 * The run the frame counts against, and how much of the Scene is still to play.
 * It comes from the engine rather than from the Scene, which is the one thing
 * the Scene cannot say for itself: a Shot whose Conditions this Reading fails is
 * not in its run, so "Shot 2 of 3" counts the beats being shown and no others.
 */
const run = computed(() => shown.value.run)

/**
 * Which Shot of the run the frame holds, numbered from one for the Reader as the
 * editor numbers them for the Author. Once the Scene has played out the Path
 * has walked past the last Shot and the frame is still holding it, so the count
 * stops at the length of the run: every tick lit, and the run said to be over.
 */
const place = computed(() => Math.min(at.value.shot + 1, run.value.length))

/**
 * The Shot the frame holds: the one on screen while the Scene plays, and the last
 * of the run once it has played out — the beat the Reader is choosing from stays
 * in front of them rather than the room going empty between the Scene and its
 * ways on. A Scene nobody has written a Shot into leaves the frame nothing to
 * hold, and nothing is invented to stand in for one.
 */
const held = computed(() => shown.value.shot ?? run.value.at(-1))

/** An Exit nobody has phrased yet is offered by where it arrives. */
function offered(exit: Exit) {
  return exitNamed(exit, id => sceneNamed(sceneNames.value, id, t), t)
}

/**
 * The two elements the Story is heard on, held outside everything the Path keys:
 * the frame is thrown afresh on every beat, and a bed inside it would be a bed
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
 * it repeats until the Scene is left; played once it falls silent and the Scene
 * stays silent, which is the element's own `ended` and nothing this has to do.
 * Runs whether or not sound is on — muting is `.muted` above, not a reason to
 * tear the source down and restart it on the next press.
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

  element.loop = now.loops
  if (heldAcross(before, now) && element.getAttribute('src') === now.sound) return

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

watch(heard, holdBed)

/**
 * The strike, which plays as the beat plays and is gone. Keyed on the Path rather
 * than on the Shot, so a Shot played again strikes again — it is the same key the
 * frame is thrown by. Plays whether or not sound is on, for the same reason the
 * bed does: muting is `.muted`, read by the element itself, and set here before
 * the play as well as by the watch above — the press that turns sound off can
 * come after the mount this strikes from and before the watch has set anything.
 *
 * A function rather than only a watch callback, because one transition into a
 * drawn Path — the opening beat, in `onMounted` above — moves nothing this key
 * can see change and would otherwise never strike at all.
 */
function strikeShot() {
  const element = strike.value
  const sound = shown.value.shot?.sound
  if (!element) return

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
 * Whether the clock is stopped. Beside the Path and never inside it, the way
 * muting is — a Path is a reading of the Story and stopping is a property of the
 * person. Unlike muting it is not kept between visits: a mute is a preference, a
 * pause is a moment, and a Reader who comes back to a Story they stopped wants it
 * running again. See
 * `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`.
 */
const paused = ref(false)

/** Whether the page is out of sight, which stops the clock as surely as the control does. */
const hidden = ref(false)

onMounted(() => {
  const watching = () => { hidden.value = document.visibilityState === 'hidden' }
  // Read as the Reading mounts rather than waited for. A silent Story opens with
  // no press at all, so a link opened into a background tab — a middle click, a
  // session restored — would start its clock in a room nobody is looking at, and
  // the Reader would arrive at a Story that had played on without them. The event
  // says when it changed; only this says what it is.
  watching()
  document.addEventListener('visibilitychange', watching)
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', watching))
})

/**
 * What the beat on screen is being held under, or nothing where nothing holds it.
 * Named apart from `held` above, which is the Shot the frame holds: one is what is
 * on screen and the other is what will take it off.
 */
const holding = ref<ReturnType<typeof setTimeout>>()

/**
 * How long the beat on screen stands, or null where it stands until the press.
 * Watched as well as read, because the Preview is where this feature is written:
 * an Author who turns a Scene from *at the press* to *after a time* has changed
 * the hold on the beat in front of them, and a clock that only caught up at the
 * next move would be the bench reading a Story that is no longer the one written.
 */
const heldFor = computed(() =>
  scene.value && shown.value.shot ? cut(scene.value, shown.value.shot).after : null)

/**
 * The hold: where the Cut of the Shot on screen names a time, the clock makes the
 * cut the press would have made, through `advance` and nothing else — so a Path
 * arrived at by waiting is the Path a hand would have arrived at.
 *
 * Set as the beat appears and cleared as it leaves, so no timer outlives the beat
 * it was started for; restarted rather than resumed after a pause or a hidden tab,
 * because nothing recorded how far it had got. A Cut is not a position, which is
 * the rule `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` settled about a
 * Sound, read again.
 */
watch([at, paused, hidden, heldFor], () => {
  clearTimeout(holding.value)
  // Immediate, so the beat a page opens on is held like every other one — and the
  // server draws that beat too, where a timer would be started into a request that
  // has already been answered and nothing would ever clear it.
  if (!import.meta.client) return

  const beat = shown.value.shot
  if (!beat || !scene.value || paused.value || hidden.value) return

  const { after, over, through } = cut(scene.value, beat)
  if (after === null) return

  holding.value = setTimeout(() => passBy(over, through, advance(at.value)), after)
}, { immediate: true })

onBeforeUnmount(() => clearTimeout(holding.value))

/**
 * Whether anything in this Story moves by itself, which is whether the Reader is
 * given the control that stops it. WCAG 2.2.2 asks for a pause the moment
 * something advances on its own and asks for nothing where nothing does, so a
 * Story read entirely by the hand is given no control over a clock that never
 * runs — the way a Story carrying no Sound is given no title card to press. A
 * Shot's nought is *at the press*, which is a Shot standing still like any other.
 */
const clocked = computed(() => story.scenes.some(scene =>
  scene.cutAfter !== null || scene.exitsAfter !== null
  || scene.shots.some(shot => (shot.cutAfter ?? 0) > 0)))
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
           what arrives. -->
      <div class="gate" :style="{ '--cut-over': `${passing.over}ms` }">
        <!-- A hard cut is not a passage: `css` false takes the whole transition
             out of the way, so the beat leaving is gone in the same tick rather
             than lying over the next one at nothing for as long as the browser
             takes to agree it has finished. Every Story written before the Cut is
             one of these, and every one of them cuts exactly as it always did. -->
        <Transition
          :name="passing.through === 'black' ? 'through-black' : 'dissolve'"
          :css="passing.over > 0"
          @leave="leaving"
        >
          <!-- Keyed on the Path, so arriving at a Shot draws the frame again:
               each beat is thrown onto the screen rather than swapped into it, and
               reading a Scene again throws its first frame again. -->
          <!-- The frame holds nothing but the Author's own work — the image, what
               it shows, and the beat — so the whole of it is announced in the
               Story's Language whatever language the chrome around it is read in.
               Nothing translates a Story: see
               `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`. -->
          <figure
            ref="frame"
            :key="`${at.taken.length}-${at.shot}`"
            class="frame"
            :class="{ 'pushed-back': !shown.shot }"
            :lang="story.language"
            tabindex="-1"
          >
            <!-- The image and the text are one beat, so they arrive together and
                 the Reader moves past both at once.

                 `alt` is the image's Description and nothing else: the Shot's text
                 is never used as one, because the text carries the beat and is read
                 out beside the image anyway. An Image nobody has described falls
                 back to empty, which is what keeps a screen reader from announcing
                 a frame it has nothing to say about. -->
            <img v-if="held.image" :src="held.image" :alt="held.description">
            <figcaption>
              <p class="shot">{{ held.text }}</p>
            </figcaption>
          </figure>
        </Transition>
      </div>

      <!-- Where the beat sits in the run: the Scene's name, and one tick a Shot
           with the Shot on screen lit. The edge of the film, read the way an
           editor reads it — and the only thing on the page that says how much of
           the Scene is left, every tick lit once the run is behind the Reader. -->
      <div class="edge">
        <p class="eyebrow" :lang="story.language">{{ scene?.name }}</p>
        <p class="counting">{{ $t('reading.shotOf', { place, of: run.length }) }}</p>
        <ol aria-hidden="true" class="ticks">
          <li v-for="(_, tick) in run.length" :key="tick" :class="{ lit: tick < place }" />
        </ol>
      </div>

      <!-- What a Reader who cannot hear is owed. Always in the document: hidden it
           is `visually-hidden` and still read, never taken out of the
           accessibility tree and never announced in a live region, which would
           trample the reading. -->
      <div v-if="heard?.transcript || shown.shot?.transcript" class="heard">
        <p v-if="heard?.transcript" class="transcript" :class="{ 'visually-hidden': !transcribed }">
          <span class="eyebrow">{{ $t('reading.sceneTranscript') }}</span>
          <span :lang="story.language">{{ heard.transcript }}</span>
        </p>
        <p
          v-if="shown.shot?.transcript"
          class="transcript"
          :class="{ 'visually-hidden': !transcribed }"
        >
          <span class="eyebrow">{{ $t('reading.shotTranscript') }}</span>
          <span :lang="story.language">{{ shown.shot.transcript }}</span>
        </p>
      </div>
    </template>

    <!-- The one control the frame carries, and only while there is a Shot left to
         ask for: the frame held behind the ways on asks for nothing. -->
    <button v-if="shown.shot" type="button" class="next" @click="passOn()">
      {{ $t('reading.next') }}
    </button>

    <!-- The ways on go under the frame rather than over it, and carry no eyebrow
         of their own: the edge above has already named the Scene they leave. -->
    <ul v-if="shown.exits.length" ref="exits" class="exits">
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

    <!-- In the document before it has anything to say: a live region announces
         a change to a node it already holds, never a node that arrives with its
         sentence inside it. -->
    <p class="ended trail" role="status">{{ shown.ended ? $t('reading.ended') : '' }}</p>

    <!-- What the Reader is given over the Reading itself: the clock stopped, the
         one refusal of the Sound, and the words for whoever cannot hear it. All
         three are the person's rather than the Reading's, so none of them touches
         the Path.

         The pause comes first because it is the one control over something
         already happening, and it is drawn only where something can happen: a
         Story nobody wrote a time into is read entirely by the hand, and a
         control over a clock that never runs would do nothing — the way a Story
         carrying no Sound is given no title card to press. -->
    <p v-if="clocked || heardAtAll" class="given">
      <button v-if="clocked" type="button" class="trail" @click="paused = !paused">
        {{ paused ? $t('reading.resume') : $t('reading.pause') }}
      </button>
      <button v-if="heardAtAll" type="button" class="trail" @click="sounding = !sounding">
        {{ sounding ? $t('reading.soundOff') : $t('reading.soundOn') }}
      </button>
      <button
        v-if="heardAtAll && (heard?.transcript || shown.shot?.transcript)"
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
         nothing, and a Story that wants it said says it in a Shot. -->
    <p v-if="moved(at)" class="back">
      <button v-if="behind" type="button" class="trail" @click="stepBack">
        {{ $t('reading.back') }}
      </button>
      <button ref="again" type="button" class="trail" @click="passBy(0, 'image', opening())">
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
  animation: thrown 320ms ease-out;
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
   takes it out of reach of a press as well as out of the reading. The throw is
   an arrival and nothing else, so it is taken off a frame on its way out — and
   with it the 320ms a browser would otherwise hold the frame on for, over and
   above the duration the Author wrote. */
.dissolve-leave-active,
.through-black-leave-active {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  animation: none;
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
   thing a duration cut to nothing leaves standing, so it is cut here. */
@media (prefers-reduced-motion: reduce) {
  .through-black-enter-active {
    transition-delay: 0ms;
  }
}

/* The Scene has played out and the frame it ended on is held behind the ways on:
   the same beat, pushed back into the room so that what is being asked of the
   Reader is the lit thing on screen. It is not arriving, so it is not thrown a
   second time — the Path has moved past the last Shot and the frame has not.

   The image takes the push back and the prose only half of it: the last beat has
   to stay as readable as it was to whoever is reading it while they choose, and a
   dimmed serif is the one thing on this page that cannot afford to be. */
.frame.pushed-back {
  animation: none;
}

.frame.pushed-back img {
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
  /* The image and the text below it are one surface, so the hairline between
     them is the only thing that separates them. */
  border-block-end: 1px solid var(--edge);
}

figcaption {
  padding: var(--s5) clamp(var(--s4), 4vw, var(--s5));
}

/* The edge of the film: the Scene the beat belongs to at the leading end, and at
   the trailing end how far into its run the Reader is — the count and the ticks
   reading the same fact twice, once in words and once as the length of film that
   is left. */
.edge {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.counting {
  margin-inline-start: auto;
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* One tick a Shot, filled up to the one on screen. */
.ticks {
  display: flex;
  gap: 3px;
}

.ticks li {
  inline-size: 10px;
  block-size: 2px;
  background: var(--edge);
}

.ticks .lit {
  background: var(--grease);
}

/* The Transcript sits under the edge rather than over the image, so it never
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
  justify-self: start;
  padding-inline: var(--s4);
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

.resumed,
.ended {
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: 0.8125rem;
}

/* The tail sample either side of the ending, which is what the end of a reel
   looks like — and either side of a Reading picked up, which is the same splice
   seen from the other end: the film was cut here, and here it runs on. */
.resumed::before,
.resumed::after,
.ended::before,
.ended::after {
  content: '';
  flex: 1;
  block-size: 1px;
  background: var(--edge);
}

/* Nothing to say yet: out of the column's flow, so the gap either side of it
   goes too, and not `display: none`, which would take it out of the
   accessibility tree and bring the silence back. */
.ended:empty {
  position: absolute;
  opacity: 0;
}

.ended:empty::before,
.ended:empty::after {
  content: none;
}

/* The clock stopped, the one refusal and the Transcript's own switch, and
   stepping back a beat or reading the Story again from the start: all of them are
   the same quiet trail, none of them a control the Story is read with, so
   `.given` shares `.back`'s rules rather than repeating them. */
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
.back button {
  border-color: transparent;
  background: none;
}

.given button:hover,
.back button:hover {
  border-color: transparent;
  background: none;
  color: var(--paper);
}

@keyframes thrown {
  from {
    opacity: 0;
    translate: 0 6px;
  }
}
</style>
