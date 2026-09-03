<script setup lang="ts">
/**
 * The Story read beside the Scene being written, on the engine a Reader runs —
 * see `docs/adr/0030-a-story-is-read-where-it-is-written.md`. It replays the
 * Path the Author is on, with the State that Path has accumulated, and stops on
 * the Scene they are writing.
 *
 * There is one notion of where the Author is and it is the Path, so the two
 * halves answer to each other: pressing a way on here moves the writing to the
 * Scene it leads to, and pressing a card in the rail routes the reading to that
 * Scene. Neither holds a cursor of its own.
 *
 * Under the reading is the bench: the State it has accumulated, the ways on its
 * Conditions are hiding, and the Shots it is not playing. None of it is drawn by
 * the Reading itself — the Reading says where it has got to and everything here
 * is worked out again from that Path — so a Reader's Reading carries no
 * inspection code to be kept switched off.
 */
const { story, sceneWritten, change } = defineProps<{
  /** The Story being written, which the reading is computed from as it is typed. */
  story: StoryInEditor
  /** The Scene the reading is stopped on, which is the one on the writing surface. */
  sceneWritten: string
  /** The one holder every write on this page goes through, which the order goes through too. */
  change: Change
}>()

/**
 * Where the reading has arrived, which the writing is asked to follow. Emitted
 * only when the Author moved the reading themselves — routing it to the Scene
 * they are already writing would be the pane answering its own question.
 */
const emit = defineEmits<{ moved: [string] }>()

const { t } = useI18n()

/**
 * Where the Reading below has got to, and the only thing it tells this pane. The
 * engine is a pure function of it, so reading it a second time here costs a walk
 * of the Exits taken and buys a State nobody had to hand out.
 */
const at = ref<Path>(UNDRAWN)

/**
 * The reel beside the writing, which holds the Path and is the only thing that
 * may move it. All this asks of it is another draw, and the Path that stops on a
 * given Scene — a Path held here as well would be a second Reading.
 */
const reel = useTemplateRef<{ reroll: () => void, goTo: (to: Path) => void }>('reel')

const shown = computed(() => reading(story, at.value))

/** The Scene the reading stands in, which is the Scene the writing should be on. */
const standing = computed(() => shown.value.sceneId)

/**
 * Whether the Scene being written was reached at all. An Author can write a Scene
 * nothing leads to yet, and a Story with no opening Scene cannot be read from
 * anywhere: the pane then reads as far as it can and says the Scene is not
 * reached, rather than inventing a Path or playing the Scene bare — which is a
 * Scene that exists for no Reader.
 */
const reached = ref(true)

/**
 * Whether what the Reading says about itself should move the writing. The Reading
 * draws its own seed as it mounts and says so, which happens before this pane has
 * routed it anywhere: heard then, the opening Scene would take the writing off
 * the Scene the Author asked for.
 */
let following = false

/**
 * The reading routed to the Scene being written: on from where it stands, so an
 * Author three Scenes in keeps what those Scenes set, and from the opening when
 * the Scene cannot be reached from where they are.
 */
function route() {
  if (standing.value === sceneWritten) {
    reached.value = true
    return
  }

  const found = pathTo(story, at.value, sceneWritten)
    ?? pathTo(story, opening(at.value.seed), sceneWritten)
  reached.value = !!found
  if (found) reel.value?.goTo(found)
}

/** Where the Reading has got to, and the writing moved to meet it. */
function heard(to: Path) {
  at.value = to
  if (following && standing.value && standing.value !== sceneWritten) emit('moved', standing.value)
}

onMounted(() => {
  route()
  following = true
})

watch(() => sceneWritten, route)

/**
 * The Story rewritten under the Author's hands: an Exit drawn, a Condition
 * changed, a Scene deleted. The Path is walked again by the engine on every read,
 * so the reading is already right — what may have changed is whether the Scene
 * being written is still where the reading stands.
 */
watch(() => story, route, { deep: true })

/**
 * Whether any Scene of this Story draws a Flag, which is whether there is
 * anything for another draw to change. A Story with none is read the same way
 * whatever the seed, so the control is not offered rather than offered and inert.
 */
const draws = computed(() =>
  story.scenes.some(scene => Object.values(scene.sets).some(Array.isArray)))

/** Scenes are read by name here as everywhere else an Author reads them. */
const sceneNames = computed(() => new Map(story.scenes.map(scene => [scene.id, scene.name])))

function sceneName(sceneId: string) {
  return sceneNamed(sceneNames.value, sceneId, t)
}

/**
 * The ways on leaving the Scene the reading stands in, in the Places the Story
 * numbers them at — which is what the pair of controls beside each choice button
 * renumbers. The offered ones are a subset of these: a way on a Condition is
 * hiding still holds a Place, so the order is written against the Scene's own
 * list and not against what happens to be on screen.
 */
const ways = computed(() => (standing.value ? exitsFrom(story.exits, standing.value) : []))

function placeOf(exit: Exit) {
  return ways.value.findIndex(way => way.id === exit.id)
}

/**
 * The order the ways on are offered in, set here because this is the one screen
 * where the order means anything: they are buttons here and a list of Scene names
 * everywhere else. A written fact the Exit carries, exactly as
 * `docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md` made it —
 * only the screen it is written on has changed, and nothing is read back out of
 * the drawing.
 */
function moveWay(exit: Exit, step: -1 | 1) {
  const places = movedBy(ways.value.map(way => way.id), exit.id, step)

  return change(() => send(`/api/scenes/${exit.fromSceneId}/exits/places`, {
    method: 'PUT',
    body: { places },
  }))
}

/**
 * What this Reading has accumulated. A Flag nobody has set and a Scene nobody
 * has entered are not listed: in a Story of fifty Scenes the full list says
 * almost nothing at very great length.
 */
const flags = computed(() => Object.entries(shown.value.state.flags))
const visits = computed(() => Object.entries(shown.value.state.visits))

/** What a Flag holds, and what stands in for a Flag holding the empty value. */
function held(value: string) {
  return value || t('preview.noFlagValue')
}

/**
 * The ways out of the Scene the Reading stands in that it is not being offered —
 * the Exits the engine filtered out, found by asking the engine's own predicate
 * rather than by testing the Conditions again here. Only where the Scene has
 * played out, because that is where the ways on are the question.
 */
const hidden = computed(() => {
  const now = shown.value
  if (now.shot) return []

  return ways.value.filter(exit => !holds(exit.conditions, now.state))
})

/**
 * The Shots of that Scene this Reading is not playing, named by the Place they
 * hold in the Scene the Author wrote — which is the number the writing surface
 * shows them under, and not the one the Reader's frame counts, because a skipped
 * Shot has no place in the run at all. Standing beside the ways on for the same
 * reason: what a Condition is hiding is what an Author came to the reading to
 * find out.
 */
const skipped = computed(() => {
  const now = shown.value
  const scene = story.scenes.find(({ id }) => id === now.sceneId)
  if (!scene) return []

  return scene.shots
    .map((shot, place) => ({ shot, place: place + 1 }))
    .filter(({ shot }) => !holds(shot.conditions, now.state))
})

/** Which of the tests a hidden Exit or a skipped Shot carries this State fails, and by what. */
function why(conditions: Condition[]) {
  return unmet(conditions, shown.value.state, sceneName, t)
}
</script>

<template>
  <!-- The reading and the bench it is cut on, stacked in a column of the bench:
       a landmark, because it is one of the three things the bench holds while a
       Scene is written and an Author can be sent to it. -->
  <!-- `data-step` is on the whole pane rather than on a control in it: the
       guided path sends an Author to read why a Shot is not playing, and what it
       has to point at is the reading itself. -->
  <section class="preview" data-step="preview" aria-labelledby="preview-heading">
    <p id="preview-heading" class="eyebrow">
      {{ $t('preview.reading') }}
      <span aria-hidden="true">·</span>
      {{ $t('preview.nobodyElse') }}
    </p>

    <!-- Said plainly to the Author, who can go and mark one. A Reader meeting the
         same Story is simply told the path ends. -->
    <p v-if="!story.openingSceneId" class="nothing">
      {{ $t('preview.noOpeningScene') }}
    </p>

    <template v-else>
      <!-- A Scene nothing leads to yet: the reading stands where it got to, and
           says so, rather than playing the Scene with no State behind it. -->
      <p v-if="!reached" class="nothing" role="status">
        {{ $t('preview.notReached', { scene: sceneName(sceneWritten) }) }}
      </p>

      <Reading ref="reel" :story="story" @at="heard">
        <!-- The order the ways on are offered in, set on the buttons as they are
             read. A pair of controls rather than a drag, because an order that
             can only be set with a pointer is an order some Authors cannot set. -->
        <!-- The marks the Scene being written is renumbered by, because this pane
             stands beside that surface and the Place of a way on is the same act
             here as it is there — see `.mark` in `frameline.css`. -->
        <template #ordering="{ exit }">
          <button
            type="button"
            class="mark"
            :disabled="placeOf(exit) === 0"
            @click="moveWay(exit, -1)"
          >
            <span aria-hidden="true">↑</span>
            <span class="visually-hidden">
              {{ $t('common.moveEarlier') }}
              {{ $t('editor.theExitTo', { scene: sceneName(exit.toSceneId) }) }}
            </span>
          </button>
          <button
            type="button"
            class="mark"
            :disabled="placeOf(exit) === ways.length - 1"
            @click="moveWay(exit, 1)"
          >
            <span aria-hidden="true">↓</span>
            <span class="visually-hidden">
              {{ $t('common.moveLater') }}
              {{ $t('editor.theExitTo', { scene: sceneName(exit.toSceneId) }) }}
            </span>
          </button>
        </template>
      </Reading>

      <!-- What is on the bench is the Author's own instrument and no part of the
           Story, so it sits under the reading and never in it. -->
      <section class="bench" aria-labelledby="preview-bench">
        <p id="preview-bench" class="eyebrow">
          {{ $t('preview.bench') }}
          <span aria-hidden="true">·</span>
          {{ $t('preview.benchNote') }}
        </p>

        <!-- The one control on the bench, and no part of the Story: the same
             Reading at the same Path, read against another draw. -->
        <p v-if="draws" class="draw">
          <button type="button" class="trail" @click="reel?.reroll()">
            {{ $t('preview.reroll') }}
          </button>
          <span aria-hidden="true">·</span>
          {{ $t('preview.rerollNote') }}
        </p>

        <!-- Why a way on is missing: the Exits out of this Scene the State is
             hiding, struck through and each naming the tests it failed. Text and
             not controls — a hidden Exit is not takeable here any more than it is
             for a Reader, and its Place is not moved from a button that is not
             on offer. -->
        <div v-if="hidden.length" class="hidden">
          <p class="eyebrow">{{ $t('preview.waysOnHidden') }}</p>
          <ul>
            <li v-for="exit in hidden" :key="exit.id">
              <s class="splice" :lang="story.language">{{ exitNamed(exit, sceneName, t) }}</s>
              <ul class="why">
                <li v-for="(test, index) in why(exit.conditions)" :key="index">{{ test }}</li>
              </ul>
            </li>
          </ul>
        </div>

        <!-- The beats this Reading is not being played, said the same way: the
             Shot the Author wrote, crossed out, with the tests it failed under
             it. -->
        <div v-if="skipped.length" class="hidden">
          <p class="eyebrow">{{ $t('preview.shotsSkipped') }}</p>
          <ul>
            <li v-for="{ shot, place } in skipped" :key="shot.id">
              <s class="splice" :lang="story.language">
                {{ t('preview.skippedShot', {
                  place,
                  text: shot.text || t('preview.nothingWritten'),
                }) }}
              </s>
              <ul class="why">
                <li v-for="(test, index) in why(shot.conditions)" :key="index">{{ test }}</li>
              </ul>
            </li>
          </ul>
        </div>

        <div class="state">
          <div>
            <p class="eyebrow">{{ $t('preview.flags') }}</p>
            <ul v-if="flags.length" class="flags">
              <li v-for="[name, value] in flags" :key="name">
                {{ name }} <span aria-hidden="true">=</span> <b>{{ held(value) }}</b>
              </li>
            </ul>
            <p v-else class="none">{{ $t('preview.noFlags') }}</p>
          </div>

          <div>
            <p class="eyebrow">{{ $t('preview.scenesEntered') }}</p>
            <ul class="visits">
              <li v-for="[sceneId, count] in visits" :key="sceneId">
                {{ sceneName(sceneId) }} <span aria-hidden="true">×</span> <b>{{ count }}</b>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
@import '~/assets/css/folds.css';

/* The third column of the bench: the reading, and the bench it is cut on under
   it. It is as tall as the other two and scrolls inside itself, so a long Scene
   is read here rather than down the page. */
.preview {
  flex: 1;
  /* The containing block for what is inside it, for the reason the writing
     surface is one: see `Panel.vue`. */
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--s3);
  min-inline-size: 0;
  max-inline-size: 34rem;
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
}

/* The bench under the reading, in the machine's own voice: mono, small, and on
   the surface an editor works on rather than the one they look at. */
.bench {
  display: grid;
  gap: var(--s4);
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
  font-family: var(--data);
  font-size: 0.8125rem;
}

.bench ul {
  display: grid;
  gap: var(--s1);
  margin-block-start: var(--s2);
}

/* One way on and the tests under it are one item, so the items are further apart
   than the lines inside them. */
.hidden > ul {
  gap: var(--s3);
}

/* A way on that is not on offer, drawn as what it is: the line the Author wrote,
   crossed out, with the tests it failed under it. */
.hidden s {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s3);
  color: var(--muted);
}

.why {
  padding-inline-start: var(--s4);
  color: var(--grease);
}

/* Two lists side by side where there is room for two, and one under the other in
   a narrow column. */
.state {
  display: grid;
  gap: var(--s4);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.flags b,
.visits b {
  color: var(--light);
  font-weight: 500;
}

.none {
  margin-block-start: var(--s2);
  color: var(--muted);
}

/* The draw, offered the way the bench says everything else: the control first
   and what it does beside it, in the machine's own small voice. */
.draw {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  color: var(--muted);
}

/* A Story with nowhere to start, or a Scene nothing leads to: a note where the
   frame would be, in the voice the bench says the same of a Story with no Scene
   in it. */
.nothing {
  padding: var(--s3);
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
  color: var(--muted);
}

/* On a phone the writing surface covers the bench, so there is no column beside
   it for the reading to be in — and no row above the bench to press a fold from
   either, which is why the band the reading folds in stops short of the phone:
   see the foot of `Graph.vue`. */
@media (--phone) {
  .preview {
    display: none;
  }
}
</style>
