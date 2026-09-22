<script setup lang="ts">
/**
 * The Story read in the middle of the bench, on the engine a Reader runs — see
 * `docs/adr/0030-a-story-is-read-where-it-is-written.md`, whose engine rule
 * `docs/adr/0043-a-story-is-written-as-one-document.md` keeps and whose *beside*
 * it supersedes. It replays the Path the Author is on, with the State that Path
 * has accumulated, and stops on the Scene they are writing.
 *
 * The Path is the bench's, held above the document and handed down, so this pane
 * is turned to and away from without the Reading it is a face of ever ending —
 * see #247.
 *
 * There is one notion of where the Author is and it is the Path, so the two
 * halves answer to each other: pressing a way on here moves the writing to the
 * Scene it leads to, and pressing a mark on the rail routes the reading to that
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
 * The Reading, which is its Path and nothing else. It belongs to the bench and
 * is passed straight through to the reel below, so that neither this pane nor
 * the reel holds a Reading of its own: the seed goes on being the seed the
 * Author has been reading under however often the middle of the bench is turned
 * over. The engine is a pure function of it, so everything on the bench under
 * the reading is worked out from it again here and nothing has to be handed out.
 */
const at = defineModel<Path>('at', { required: true })

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
 * The reading routed to the Scene being written: on from where it stands, so an
 * Author three Scenes in keeps what those Scenes set, and from the opening when
 * the Scene cannot be reached from where they are. The seed is carried into that
 * second search, because a Path found under another one would be another Reading.
 */
function route() {
  if (standing.value === sceneWritten) {
    reached.value = true
    return
  }

  const found = pathTo(story, at.value, sceneWritten)
    ?? pathTo(story, opening(at.value.seed), sceneWritten)
  reached.value = !!found
  if (found) at.value = found
}

/**
 * The Reading moved somewhere the writing is not, and the writing asked to
 * follow it. Read off where the Reading stands rather than off the move that got
 * there, so the pane cannot answer its own question: every Path this routes
 * arrives at the Scene being written, and a Scene it could not reach leaves the
 * Reading where it was.
 */
watch(standing, (now) => {
  if (now && now !== sceneWritten) emit('moved', now)
})

onMounted(route)

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

/**
 * What the bench calls each Scene, which is what everything this pane says names
 * one by: the two marks that renumber a way on, the Scene the reading has not
 * reached, the Scenes the State says were entered, and the Exits a Condition is
 * hiding. This
 * pane is the bench around the reading and never the reading itself — the frames
 * and the buttons a Reader would press are drawn by `Reading.vue`, in the words
 * the Author wrote — so two Scenes an Author called the same are numbered here
 * exactly as they are in the writing and on the Contact Sheet. See
 * `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`.
 */
const names = computed(() => namesOnTheBench(story, t))

function sceneName(sceneId: string) {
  return sceneNamed(names.value, sceneId, t)
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
 * What the bench calls the Scene the reading stands in, which is the Scene the
 * two marks beside every way on renumber a row out of. Nothing where the reading
 * stands nowhere at all, which is a reading with no way on to renumber.
 */
const standsIn = computed(() => (standing.value ? sceneName(standing.value) : ''))

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
const entered = computed(() => shown.value.state.entered)

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
  <!-- The reading and the bench it is cut on, stacked in the middle of the bench:
       a landmark, because an Author can be sent to it. The guided path points at
       the control that turns the middle over rather than at this pane — the pane is
       not on screen until they do, and what the Step asks for is the turn. -->
  <section class="preview" aria-labelledby="preview-heading">
    <p id="preview-heading" class="says">
      <span class="eyebrow">{{ $t('preview.reading') }}</span>
      <span class="aside">{{ $t('preview.nobodyElse') }}</span>
    </p>

    <!-- Said plainly to the Author, who can go and mark one. A Reader meeting the
         same Story is simply told the path ends. -->
    <p v-if="!story.openingSceneId" class="nothing">
      {{ $t('preview.noOpeningScene') }}
    </p>

    <template v-else>
      <!-- A Scene nothing leads to yet: the reading stands where it got to, and
           says so, rather than playing the Scene with no State behind it. The
           element is in the document before it has anything to say, on one
           line so that Vue writes nothing at all into it: a live region
           announces a change to a node it already holds, never a node that
           arrives with its sentence inside it. -->
      <p class="nothing" role="status">{{ reached ? '' : $t('preview.notReached', { scene: sceneName(sceneWritten) }) }}</p>

      <Reading v-model:at="at" :story="story">
        <!-- The order the ways on are offered in, set on the buttons as they are
             read. A pair of controls rather than a drag, because an order that
             can only be set with a pointer is an order some Authors cannot set. -->
        <!-- The marks the Scene being written is renumbered by, because this pane
             stands beside that surface and the Place of a way on is the same act
             here as it is there — see `.mark` in `frameline.css`. Named the way
             they are there too: the act, and then the way on it is done to, by
             its Place, which is the only thing that tells two ways on to one
             Scene apart — see issue #276. -->
        <template #ordering="{ exit }">
          <!-- The way on the Reader does not come back through, marked before it
               is taken rather than explained after: the step back is simply not
               there on the far side of it, and an absent control has to read as
               what the Author wrote and not as a defect. It is the Exit's own
               answer or its Story's, which is the one place that rule is read —
               see `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`.
               Words and not a mark, because it is the Author being told something
               rather than an act they can do. -->
          <span v-if="!(exit.stepsBack ?? story.stepsBack)" class="aside">
            {{ $t('preview.noWayBack') }}
          </span>
          <button
            type="button"
            class="mark"
            :disabled="placeOf(exit) === 0"
            @click="moveWay(exit, -1)"
          >
            <span aria-hidden="true">↑</span>
            <span class="visually-hidden">
              {{ $t('common.moveEarlier') }}
              {{ $t('editor.theWayOnTo', {
                place: placeOf(exit) + 1,
                scene: sceneName(exit.toSceneId),
                from: standsIn,
              }) }}
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
              {{ $t('editor.theWayOnTo', {
                place: placeOf(exit) + 1,
                scene: sceneName(exit.toSceneId),
                from: standsIn,
              }) }}
            </span>
          </button>
        </template>
      </Reading>

      <!-- What is on the bench is the Author's own instrument and no part of the
           Story, so it sits under the reading and never in it. -->
      <section class="bench" aria-labelledby="preview-bench">
        <p id="preview-bench" class="says">
          <span class="eyebrow">{{ $t('preview.bench') }}</span>
          <span class="aside">{{ $t('preview.benchNote') }}</span>
        </p>

        <!-- The one control on the bench, and no part of the Story: the same
             Reading at the same Path, read against another draw. Nothing moves,
             so nothing takes focus — the Author presses it again and again, and
             what changes is the Story around it. -->
        <p v-if="draws" class="draw">
          <button type="button" @click="at = rerolled(at)">
            {{ $t('preview.reroll') }}
          </button>
          <span class="aside">{{ $t('preview.rerollNote') }}</span>
        </p>

        <!-- Why a way on is missing: the Exits out of this Scene the State is
             hiding, struck through and each naming the tests it failed. Text and
             not controls — a hidden Exit is not takeable here any more than it is
             for a Reader, and its Place is not moved from a button that is not
             on offer. -->
        <div v-if="hidden.length" class="hidden">
          <p class="eyebrow">{{ $t('preview.exitsHidden') }}</p>
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
            <!-- The Scenes themselves, in the order this Reading went through
                 them, and no count beside them: a Reading stands in a Scene at
                 most once, so *× 1* on every line would be arithmetic saying
                 nothing — see `docs/adr/0048-a-scene-is-entered-once.md`. It is
                 what an Author reads to see why a Condition held. -->
            <ul class="entered">
              <li v-for="sceneId in entered" :key="sceneId">
                <b>{{ sceneName(sceneId) }}</b>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
/* The other reading the middle of the bench holds: the Story read as a Reader
   will read it, and under it the instrument the Author reads it with. It takes
   the document's own place rather than a box beside it — a Story is read where it
   is written, see `docs/adr/0030-a-story-is-read-where-it-is-written.md` and
   `docs/adr/0043-a-story-is-written-as-one-document.md`. The reading is at the
   top because that is what the face is for, and the bench is pushed to the foot
   of it — a control desk under a screen, rather than a second card floating
   halfway down an empty pane. */
.preview {
  flex: 1;
  /* The containing block for what is inside it, for the reason the writing
     surface is one: see `Writing.vue`. */
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-inline-size: 0;
  overflow: auto;
  padding: var(--s4);
  border: 1px solid var(--light);
  border-radius: var(--machined);
  background: var(--bench);
  box-shadow: 0 40px 90px -25px rgb(0 0 0 / 0.85);
}

/* What this column is, and what is true of it: the stencilled name of the
   surface, and beside it the one thing an Author needs to know about it, said in
   ordinary words rather than stencilled alongside as though it were a second
   label. */
.says {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s1) var(--s2);
}

.aside {
  color: var(--muted);
  font-size: 0.75rem;
}

/* The reading is given the whole of the column's own width, none of the room the
   reading room pads itself out with — down here the desk under it is what ends
   the column — and whatever height is going, with the frame held in the middle of
   it: a screen hangs in a room rather than resting on the top edge of one. */
.reading {
  flex: 1;
  align-content: center;
  padding-block-end: 0;
}

/* The Author's own instrument, at the foot of the column: what this Reading has
   accumulated, what its Conditions are hiding, and the one control that draws
   the Story again. In the machine's own voice — mono, small, on the surface an
   editor works on rather than the one they look at — and pushed down so that a
   short reading leaves its space above the desk rather than between the two. */
.bench {
  display: grid;
  gap: var(--s4);
  margin-block-start: auto;
  padding: var(--s3);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
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

/* What the State holds, read as the pairs they are: the name on the left at the
   contrast of a label, the value beside it in the machine's own light. The Scenes
   entered are a list of one thing apiece, so a line of it is only the light half. */
.flags li,
.entered li {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  color: var(--muted);
}

.flags b,
.entered b {
  color: var(--light);
  font-weight: 500;
}

.none {
  margin-block-start: var(--s2);
  color: var(--muted);
}

/* The draw: the control first and what it does beside it, on the one line the
   bench gives anything it offers. */
.draw {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

/* A Story with nowhere to start, or a Scene nothing leads to: a note where the
   frame would be, in the voice the bench says the same of a Story with no Scene
   in it. */
.nothing {
  padding: var(--s3);
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
  color: var(--muted);
  font-size: 0.875rem;
}

/* Nothing to say: out of the pane's flow, so the gap it would open goes too, and
   no box — but never `display: none`, which would take the live region out of
   the accessibility tree and bring the silence back. */
.nothing:empty {
  position: absolute;
  padding: 0;
  border: 0;
  opacity: 0;
}
</style>
