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
 * The beat behind, or nothing where there is none: the opening beat of the
 * Story, or an Exit the Author closed behind the Reader. The engine is asked
 * rather than the Path read here — an Exit says whether it is crossed backwards
 * and answers as its Story says where it has not — so the control on screen and
 * the move it would make cannot come apart. See
 * `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
 */
const behind = computed(() => back(story, at.value))

function stepBack() {
  if (behind.value) moveTo(behind.value)
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
      <!-- Keyed on the Path, so arriving at a Shot draws the frame again:
           each beat is thrown onto the screen rather than swapped into it, and
           reading a Scene again throws its first frame again. -->
      <!-- The frame holds nothing but the Author's own work — the image, what it
           shows, and the beat — so the whole of it is announced in the Story's
           Language whatever language the chrome around it is read in. Nothing
           translates a Story: see
           `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`. -->
      <figure
        ref="frame"
        :key="`${at.taken.length}-${at.shot}`"
        class="frame"
        :class="{ 'pushed-back': !shown.shot }"
        :lang="story.language"
        tabindex="-1"
      >
        <!-- The image and the text are one beat, so they arrive together and the
             Reader moves past both at once.

             `alt` is the image's Description and nothing else: the Shot's text is
             never used as one, because the text carries the beat and is read out
             beside the image anyway. An Image nobody has described falls back to
             empty, which is what keeps a screen reader from announcing a frame it
             has nothing to say about. -->
        <img v-if="held.image" :src="held.image" :alt="held.description">
        <figcaption>
          <p class="shot">{{ held.text }}</p>
        </figcaption>
      </figure>

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
    <button v-if="shown.shot" type="button" class="next" @click="moveTo(advance(at))">
      {{ $t('reading.next') }}
    </button>

    <!-- The ways on go under the frame rather than over it, and carry no eyebrow
         of their own: the edge above has already named the Scene they leave. -->
    <ul v-if="shown.exits.length" ref="exits" class="exits">
      <li v-for="exit in shown.exits" :key="exit.id">
        <!-- What the Author wrote on the Exit, so it carries the Story's Language
             like the beat above it does. -->
        <button type="button" class="splice" :lang="story.language" @click="moveTo(take(at, exit))">
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

    <!-- What the Reader is given over the Sound: the one refusal, and the words
         for whoever cannot hear it. Both are the person's rather than the
         Reading's, so neither touches the Path. -->
    <p v-if="heardAtAll" class="listening">
      <button type="button" class="trail" @click="sounding = !sounding">
        {{ sounding ? $t('reading.soundOff') : $t('reading.soundOn') }}
      </button>
      <button
        v-if="heard?.transcript || shown.shot?.transcript"
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
      <button ref="again" type="button" class="trail" @click="moveTo(opening())">
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

/* The one refusal and the Transcript's own switch, and stepping back a beat or
   reading the Story again from the start: all four are the same quiet trail,
   never a control over the Reading, so `.listening` shares `.back`'s rules
   rather than repeating them. */
.listening,
.back {
  display: flex;
  gap: var(--s2);
}

.listening button,
.back button {
  border-color: transparent;
  background: none;
}

.listening button:hover,
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
