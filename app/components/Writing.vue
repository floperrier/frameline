<script setup lang="ts">
/**
 * The writing: the whole Story as one document, from the Opening Scene to the
 * last, in the order `inDocumentOrder` reads it — see
 * `docs/adr/0043-a-story-is-written-as-one-document.md`, which is also where the
 * name comes from. It is not *script*, which that record refuses in as many words,
 * and not *text*, which is what a Shot carries beside its Image.
 *
 * A Scene is a heading, the Flags it sets on entry, the run of its Shots, and the
 * ways out of it named by where they lead. The next Scene is under it. Nothing has
 * to be opened and nothing closes.
 *
 * One Scene is written rather than read, and the page puts the writing surface in
 * the slot where that Scene's body would have been: the Scene the caret is in is a
 * document inside the document, in the place the order already gave it. Every
 * other Scene is read only.
 *
 * **A read-only Scene carries no control at all**, and that is load-bearing rather
 * than an economy. The claim the whole record stands on is that the count of
 * controls on screen does not grow with the Story, measured at one width on a
 * Story of three Scenes and on a Story of forty; a *Go to* on every heading would
 * be forty controls and would break it on the first Story large enough to matter.
 * The rail down the side and the bar of Commands are how an Author reaches another
 * Scene, and between them they reach every one of them.
 *
 * A Shot's text is set in the reading face at the reading measure — the shared
 * `.shot` of `app/assets/css/frameline.css`, which is the one place in the product
 * that face appears. `0043` moved the judgement into the writing rather than
 * standing a reading next to it: the line is read where it is typed.
 */
const { story, sceneWritten } = defineProps<{
  /** The Story being written, whole. */
  story: StoryInEditor
  /** The Scene the caret is in, whose body the slot stands in for. */
  sceneWritten?: string
}>()

const { t } = useI18n()

/**
 * One Scene as the document reads it: the Scene itself, and the four things its
 * section says about it that are read off the whole Story rather than off the
 * Scene. Named and computed once for the run, because the alternative is four
 * filters over every Exit of the Story re-run per Scene per render, which on a
 * Story of forty Scenes is the document redrawing itself in quadratic time.
 */
type SceneInDocument = {
  scene: Scene
  /** Whether the Story opens on it. */
  opens: boolean
  /** How many Exits arrive at it, as the sentence the slate says. */
  arrivals: string
  /** Whether no Reader ever gets there: nothing arrives, and the Story opens elsewhere. */
  unreached: boolean
  /** The Exits leaving it, in the Places it offers them at. */
  ways: Exit[]
  /** The Flags it sets on entry, as the rows they are written in. */
  flags: FlagRow[]
}

const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

const sections = computed<SceneInDocument[]>(() => {
  const arriving = new Map<string, number>()
  for (const exit of story.exits) {
    arriving.set(exit.toSceneId, (arriving.get(exit.toSceneId) ?? 0) + 1)
  }

  return inDocumentOrder(story.scenes, story.exits, story.openingSceneId).map((scene) => {
    const arrivals = arriving.get(scene.id) ?? 0

    return {
      scene,
      opens: scene.id === story.openingSceneId,
      arrivals: countedArrivals(arrivals, t),
      unreached: !arrivals && scene.id !== story.openingSceneId,
      ways: exitsFrom(story.exits, scene.id),
      flags: flagRows(scene.sets),
    }
  })
})

/** What an Exit is called where it is read rather than edited, and where it lands. */
function said(exit: Exit) {
  return exitNamed(exit, id => sceneNamed(sceneNames.value, id, t), t)
}

function landing(exit: Exit) {
  return sceneNamed(sceneNames.value, exit.toSceneId, t)
}
</script>

<template>
  <article class="writing">
    <!-- A section per Scene, in the order the Story is written in, each addressed
         by the Scene's own id: `?scene=` names one and the document is scrolled to
         it — see `docs/adr/0043-a-story-is-written-as-one-document.md`. -->
    <section
      v-for="held in sections"
      :id="`scene-${held.scene.id}`"
      :key="held.scene.id"
      class="scene"
      :data-scene="held.scene.id"
    >
      <slot v-if="held.scene.id === sceneWritten" />

      <template v-else>
        <!-- The slate: the name, whether the Story opens here, and what arrives.
             What arrives is said in words rather than left to the rail's dashes,
             because this is the surface a Reader of the document is reading. -->
        <div class="slate" :class="{ unreached: held.unreached }">
          <h2>{{ held.scene.name }}</h2>
          <p v-if="held.opens" class="eyebrow opens">{{ $t('editor.openingScene') }}</p>
          <p class="arrivals">{{ held.arrivals }}</p>
        </div>

        <!-- What the Scene sets on entry, before its first Shot plays. Drawn only
             where there is one, the way a document carries a heading only over
             something: most Scenes set none, and forty empty headings are forty
             lines saying nothing. -->
        <section v-if="held.flags.length" class="held">
          <h3 class="eyebrow">{{ $t('editor.flagsHeld') }}</h3>
          <ul class="flags">
            <li v-for="flag in held.flags" :key="flag.name">
              <span class="data">{{ flag.name }}</span>
              <span class="says">{{ $t('flags.holds') }}</span>
              <!-- A `<template>` rather than a wrapper, so every word of the
                   sentence is a flex item of the row and the gap falls between
                   all of them rather than only between the values. -->
              <template v-for="(value, at) in flag.values" :key="at">
                <span v-if="at" class="says">{{ $t('flags.or') }}</span>
                <span class="data">{{ value }}</span>
              </template>
            </li>
          </ul>
        </section>

        <!-- The run, each beat in the Place the Scene numbers it at and its text
             in the face it is read in. -->
        <section v-if="held.scene.shots.length" class="held">
          <h3 class="eyebrow">{{ $t('editor.shotsHeld') }}</h3>
          <ol class="shots">
            <li v-for="(shot, place) in held.scene.shots" :key="shot.id">
              <span class="numbered">{{ place + 1 }}</span>
              <p class="shot" :lang="story.language">{{ shot.text }}</p>
            </li>
          </ol>
        </section>

        <!-- The foot of the Scene: the ways out, in the Places it offers them at,
             each as what the Reader presses and where it lands. Last, because that
             is where the Reader meets them. -->
        <section v-if="held.ways.length" class="held">
          <h3 class="eyebrow">{{ $t('editor.waysHeld') }}</h3>
          <ol class="ways">
            <li v-for="(exit, place) in held.ways" :key="exit.id">
              <span class="numbered">{{ place + 1 }}</span>
              <p class="said">{{ said(exit) }}</p>
              <p class="lands splice">{{ $t('editor.toScene', { name: landing(exit) }) }}</p>
            </li>
          </ol>
        </section>
      </template>
    </section>
  </article>
</template>

<style scoped>
/* The document, as a column of Scenes read from the top down. The page owns the
   scroller this stands in, so nothing here scrolls and nothing here is sized to a
   window: a long Story is a long document, which is the shape of the thing. */
.writing {
  display: grid;
  gap: var(--s5);
  padding: var(--s4);
  /* A Scene's name and an Author's own prose are the Author's words, and a word
     longer than the column is broken rather than sent off the edge of it: at the
     width of a phone this is what keeps the page from scrolling sideways. */
  overflow-wrap: break-word;
}

.scene {
  display: grid;
  gap: var(--s3);
  align-content: start;
  /* The address names a Scene and the document is scrolled to it, so a Scene
     arrives under the head of the scroller rather than jammed against it. */
  scroll-margin-block-start: var(--s4);
}

/* The slate: the name, whether the Story opens here, and what arrives at it. One
   line where there is room for one, wrapping rather than being cut off — a Scene's
   name is the Author's words and the document has the width the node never had. */
.slate {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
  padding-block-end: var(--s2);
  border-block-end: 1px solid var(--edge);
}

.slate h2 {
  flex: 1 1 12rem;
  min-inline-size: 0;
  font-family: var(--display);
  font-size: 1.5rem;
  letter-spacing: 0.01em;
}

/* Where the Story opens, in the grease pencil the Author's own marks are in. Said
   past the label it is stencilled as, because `.eyebrow` and this both name one
   colour and neither stylesheet is guaranteed to come after the other. */
.slate .opens {
  color: var(--grease);
}

/* What arrives here, said by the bench about the Story rather than written in it,
   so it is stencilled in the machine's own data face. */
.arrivals {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
}

/* A Scene nothing arrives at, read as the loose end it is: the dashed edge the
   node wore and the rail's mark still wears. No colour of its own — a Scene no
   Reader reaches is a Story an Author may be in the middle of, and the alarm is
   the colour of something having gone wrong. What says it in words is the
   `countedArrivals` sentence on the line above, which has one for the zero. */
.slate.unreached {
  border-block-end-style: dashed;
}

/* The three parts of a Scene, each headed where it starts, in the same order a
   Reader meets them: what is set on entry, the run, the ways out. */
.held {
  display: grid;
  gap: var(--s2);
}

/* A Flag the Scene sets, read as the sentence it is rather than as the row of
   fields it is written in beside the caret. */
.flags li {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  font-size: 0.8125rem;
}

.says {
  color: var(--muted);
  font-family: var(--data);
}

.data {
  font-family: var(--data);
}

/* A beat, and a way on: the Place in a margin of its own and what it holds
   beside it, which is the shape every list of Places on the bench is drawn in. */
.shots li,
.ways li {
  display: grid;
  grid-template-columns: 2ch minmax(0, 1fr);
  gap: var(--s1) var(--s3);
  align-items: baseline;
}

.shots li + li,
.ways li + li {
  margin-block-start: var(--s3);
}

.numbered {
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.ways .numbered {
  color: var(--grease);
}

.ways .said {
  font-size: 0.9375rem;
}

/* Where the way on lands, under what the Reader presses and behind the arrow every
   list of Cuts is drawn with. */
.ways .lands {
  grid-column: 2;
  display: flex;
  gap: var(--s1);
  color: var(--muted);
  font-size: 0.8125rem;
}
</style>
