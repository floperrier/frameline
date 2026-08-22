<script setup lang="ts">
/**
 * One Reading of a Story on screen. An Author's Preview and a Reader's Reading
 * are the same thing seen from two doors, so both draw this: nothing a Reader
 * meets can go untested by a Preview, and nothing an Author previews can behave
 * differently once it is published.
 *
 * The Position lives here and nowhere else. It never leaves the browser, so
 * every Reading starts with empty State and two Readers of one Story cannot
 * share what they have accumulated — there is no place for them to share it.
 * Leaving the page starts the Story over for the same reason.
 */
const { story } = defineProps<{ story: StoryToShow }>()

/**
 * Where the Reading has got to, said out loud on every move. The whole of what
 * this component offers whoever draws it, and the reason a Preview can put the
 * State on a bench beside it without this knowing who is watching: the Position
 * is all a Preview needs, because everything else is a pure function of it.
 * A Reader's Reading is the same component with nobody listening.
 */
const emit = defineEmits<{ at: [Position] }>()

const at = ref<Position>(OPENING)
const shown = computed(() => reading(story, at.value))

/**
 * Where the Reader is put after the Reading moves. Every beat replaces what was
 * on screen, and the control that was pressed goes with it: without this, focus
 * falls back to the document and reading a Story by keyboard means tabbing in
 * from the top of the page at every Shot. The frame takes focus when a Shot
 * arrives, so what is announced is the beat itself rather than the button that
 * asks for the next one, and the first Cut takes it when the Scene has played
 * out — the Reader lands on what they are being offered.
 */
const frame = useTemplateRef<HTMLElement>('frame')
const cuts = useTemplateRef<HTMLElement>('cuts')

async function moveTo(to: Position) {
  at.value = to
  emit('at', to)
  await nextTick()
  ;(frame.value ?? cuts.value?.querySelector('button'))?.focus()
}

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

/**
 * The Scene the Reading stands in, so the frame can say where the Reader is and
 * how much of the Scene is still to play. The count comes from the Scene itself
 * rather than from the engine: the engine says what is on screen, and how long
 * the run it belongs to is is a property of the Scene.
 */
const scene = computed(() => story.scenes.find(({ id }) => id === shown.value.sceneId))

/** Numbered from one for the Reader, as the editor numbers them for the Author. */
const place = computed(() => at.value.shot + 1)

/** A Cut nobody has phrased yet is offered by where it arrives. */
function offered(cut: Cut) {
  return cutNamed(cut, id => sceneNames.value.get(id) ?? id)
}
</script>

<template>
  <div class="reading">
    <!-- One Shot at a time, and the Cuts only once the Scene has played out. -->
    <template v-if="shown.shot">
      <!-- Keyed on the Position, so arriving at a Shot draws the frame again:
           each beat is thrown onto the screen rather than swapped into it. -->
      <figure ref="frame" :key="`${at.taken.length}-${at.shot}`" class="frame" tabindex="-1">
        <!-- The still and the text are one beat, so they arrive together and the
             Reader moves past both at once.

             `alt` is the still's Description and nothing else: the Shot's text is
             never used as one, because the text carries the beat and is read out
             beside the image anyway. A Still nobody has described falls back to
             empty, which is what keeps a screen reader from announcing a frame it
             has nothing to say about. -->
        <img v-if="shown.shot.image" :src="shown.shot.image" :alt="shown.shot.description">
        <figcaption>
          <p class="shot">{{ shown.shot.text }}</p>
        </figcaption>
      </figure>

      <!-- Where the beat sits in the run: the Scene's name, and one tick a Shot
           with the Shot on screen lit. The edge of the film, read the way an
           editor reads it — and the only thing on the page that says how much of
           the Scene is left. -->
      <div class="edge">
        <p class="eyebrow">
          {{ scene?.name }}
          <span aria-hidden="true">·</span>
          Shot {{ place }} of {{ scene?.shots.length }}
        </p>
        <ol aria-hidden="true" class="ticks">
          <li v-for="(_, tick) in scene?.shots.length ?? 0" :key="tick" :class="{ lit: tick < place }" />
        </ol>
      </div>

      <button type="button" class="next" @click="moveTo(advance(at))">Next Shot</button>
    </template>

    <template v-else-if="shown.cuts.length">
      <p class="eyebrow">{{ scene?.name }} <span aria-hidden="true">·</span> the ways on</p>
      <ul ref="cuts" class="cuts">
        <li v-for="cut in shown.cuts" :key="cut.id">
          <button type="button" class="splice" @click="moveTo(take(at, cut))">
            {{ offered(cut) }}
          </button>
        </li>
      </ul>
    </template>

    <p v-if="shown.ended" class="ended trail" role="status">The path ends here.</p>

    <p class="again">
      <button type="button" class="trail" @click="moveTo(OPENING)">
        Read again from the start
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

/* The still and the text share the one gate, because they are one beat and not
   an illustration with a caption under it. */
.frame {
  overflow: clip;
  animation: thrown 320ms ease-out;
}

/* The frame is given focus on arrival, not by tabbing to it, so the ring says
   "this is the beat you have landed on" rather than "this is a control". */
.frame:focus-visible {
  outline-offset: 4px;
}

/* The gate takes a still of any shape: a wide one fills the frame, and a tall
   one is held to a height a beat can be taken in without scrolling — the frame
   is what the Reader looks at, not something they travel down. */
img {
  display: block;
  inline-size: 100%;
  block-size: auto;
  max-block-size: min(60vh, 32rem);
  object-fit: contain;
  background: var(--room);
  /* The still and the text below it are one surface, so the hairline between
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

/* The Cuts on offer, as a splice list: a grease-pencil mark and the line the
   Reader takes, each across the whole column so the choice is read and not
   hunted for. */
.cuts {
  display: grid;
  gap: var(--s2);
}

.cuts button {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s3);
  inline-size: 100%;
  padding: var(--s3) var(--s4);
  background: color-mix(in oklab, var(--steel) 70%, transparent);
  font-family: var(--ui);
  font-size: 1rem;
  text-align: start;
}

.cuts button:hover {
  background: var(--steel-lit);
}

.ended {
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: 0.8125rem;
}

/* The tail leader either side of the ending, which is what the end of a reel
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
