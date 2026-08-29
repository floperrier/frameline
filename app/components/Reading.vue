<script setup lang="ts">
/**
 * One Reading of a Story on screen. An Author's Preview and a Reader's Reading
 * are the same thing seen from two doors, so both draw this: nothing a Reader
 * meets can go untested by a Preview, and nothing an Author previews can behave
 * differently once it is published.
 *
 * The Path lives here and nowhere else. It never leaves the browser, so
 * every Reading starts with empty State and two Readers of one Story cannot
 * share what they have accumulated — there is no place for them to share it.
 * Leaving the page starts the Story over for the same reason.
 */
const { story } = defineProps<{ story: StoryToShow & { language: string } }>()

const { t } = useI18n()

/**
 * Where the Reading has got to, said out loud on every move. The whole of what
 * this component offers whoever draws it, and the reason a Preview can put the
 * State on a bench beside it without this knowing who is watching: the Path
 * is all a Preview needs, because everything else is a pure function of it.
 * A Reader's Reading is the same component with nobody listening.
 */
const emit = defineEmits<{ at: [Path] }>()

const at = ref<Path>(UNDRAWN)
const shown = computed(() => reading(story, at.value))
const shownAt = () => emit('at', at.value)

/**
 * The seed every draw a Scene makes comes out of, drawn once the Reading is in
 * the browser and said out loud like every other move. Here rather than in the
 * Path this starts at, because the server renders this page too and a seed
 * drawn there and drawn again here would be two Stories either side of
 * hydration. It is the one impure moment in a Reading — see
 * `docs/adr/0024-the-seed-belongs-to-the-position.md`.
 */
onMounted(() => {
  at.value = opening()
  shownAt()
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
 * what has just arrived.
 */
const frame = useTemplateRef<HTMLElement>('frame')
const exits = useTemplateRef<HTMLElement>('exits')

async function moveTo(to: Path) {
  at.value = to
  shownAt()
  await nextTick()
  ;(shown.value.shot ? frame.value : exits.value?.querySelector('button'))?.focus()
}

/**
 * The same Path under another draw, which is the one thing about a Reading
 * something outside it may change: the Preview's reroll. Nothing moves, so
 * nothing takes focus — the Author presses the button again and again, and what
 * changes is the Story around it. Exposed rather than taken as a prop, because
 * the Path lives here and a second place to hold it is a second Reading.
 */
function reroll() {
  at.value = rerolled(at.value)
  shownAt()
}

/**
 * The Reading put at a Path worked out somewhere else: the pane an Author writes
 * beside routes the reading to the Scene they are on, and a Path held in two
 * places would be two Readings. Nothing takes focus, because nobody pressed
 * anything in here — the Author pressed a card in the rail, and the keyboard
 * belongs where they left it.
 */
function goTo(to: Path) {
  at.value = to
  shownAt()
}

defineExpose({ reroll, goTo })

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
</script>

<template>
  <div class="reading">
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
        <p class="eyebrow">
          <span :lang="story.language">{{ scene?.name }}</span>
          <span aria-hidden="true">·</span>
          {{ $t('reading.shotOf', { place, of: run.length }) }}
        </p>
        <ol aria-hidden="true" class="ticks">
          <li v-for="(_, tick) in run.length" :key="tick" :class="{ lit: tick < place }" />
        </ol>
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

    <p v-if="shown.ended" class="ended trail" role="status">{{ $t('reading.ended') }}</p>

    <p class="again">
      <button type="button" class="trail" @click="moveTo(opening())">
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

.edge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
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

.ended {
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: 0.8125rem;
}

/* The tail sample either side of the ending, which is what the end of a reel
   looks like. */
.ended::before,
.ended::after {
  content: '';
  flex: 1;
  block-size: 1px;
  background: var(--edge);
}

.again {
  display: flex;
  justify-content: center;
}

.again button {
  border-color: transparent;
  background: none;
}

.again button:hover {
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
