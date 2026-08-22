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

const at = ref<Position>(OPENING)
const shown = computed(() => reading(story, at.value))

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

/**
 * A Cut nobody has phrased yet is offered by where it arrives. An unphrased Cut
 * is half of what a Preview is for; a published one is a Story its Author let
 * out unfinished, and a Reading that cannot go on is the worse answer.
 */
function offered(cut: Cut) {
  return cut.text || `Cut to ${sceneNames.value.get(cut.toSceneId)}`
}
</script>

<template>
  <div class="reading">
    <!-- One Shot at a time, and the Cuts only once the Scene has played out. -->
    <template v-if="shown.shot">
      <!-- Keyed on the Position, so arriving at a Shot draws the frame again:
           each beat is thrown onto the screen rather than swapped into it. -->
      <figure :key="`${at.taken.length}-${at.shot}`" class="frame">
        <!-- The still and the text are one beat, so they arrive together and the
             Reader moves past both at once.

             ponytail: `alt` is empty because no Shot has alternative text to give.
             The Shot's text sits right beside the image and carries the beat, so an
             empty `alt` keeps a screen reader from reading out a filename instead of
             it. Give a Shot its own alternative text the day one is written. -->
        <img v-if="shown.shot.image" :src="shown.shot.image" alt="">
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

      <button type="button" class="next" @click="at = advance(at)">Next Shot</button>
    </template>

    <template v-else-if="shown.cuts.length">
      <p class="eyebrow">{{ scene?.name }} <span aria-hidden="true">·</span> the ways on</p>
      <ul class="cuts">
        <li v-for="cut in shown.cuts" :key="cut.id">
          <button type="button" @click="at = take(at, cut)">{{ offered(cut) }}</button>
        </li>
      </ul>
    </template>

    <p v-if="shown.ended" class="ended" role="status">The path ends here.</p>

    <p class="again">
      <button type="button" @click="at = OPENING">Read again from the start</button>
    </p>
  </div>
</template>

<style scoped>
/* One column, as wide as a frame wants to be and no wider: everything a Reading
   shows is stacked in the order it is met. */
.reading {
  display: grid;
  gap: var(--s4);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
}

/* The gate. The still and the text share one bordered surface, because they are
   one beat and not an illustration with a caption under it. */
.frame {
  overflow: clip;
  border: 1px solid var(--edge);
  border-radius: var(--gate);
  background:
    radial-gradient(
      120% 90% at 50% 0%,
      color-mix(in oklab, var(--light) 6%, transparent),
      transparent 70%
    ),
    color-mix(in oklab, var(--room) 55%, var(--steel));
  animation: thrown 320ms ease-out;
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

.shot {
  white-space: pre-wrap;
  font-family: var(--prose);
  font-size: clamp(1.1875rem, 1rem + 0.9vw, 1.5rem);
  font-weight: 400;
  line-height: 1.5;
  /* A measure a beat can be taken in at a glance. Longer lines are read; this
     length is looked at. */
  max-inline-size: 42ch;
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

.cuts button::before {
  content: '→';
  color: var(--grease);
  font-family: var(--data);
}

.cuts button:hover {
  background: var(--steel-lit);
}

.ended {
  display: flex;
  align-items: center;
  gap: var(--s3);
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.8125rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
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
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
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
