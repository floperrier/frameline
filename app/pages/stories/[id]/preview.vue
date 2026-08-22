<script setup lang="ts">
// The Author plays their own Story here, before anyone else can see it. Nothing
// about the Story changes and nobody else can reach the page: what it draws is
// the same component, and so the same engine, a Reader runs once it is published.
//
// What a Reader never gets is the bench under it — the State the Reading has
// accumulated, and the ways on its Conditions are hiding. None of that is drawn
// by the Reading itself: the Reading says where it has got to, and everything
// here is worked out again from that Position, so a Reader's Reading carries no
// inspection code to be kept switched off.
definePageMeta({ middleware: 'authenticated' })

const id = useRoute().params.id as string
const headers = useRequestHeaders(['cookie'])
const { data: story } = await useAsyncData(
  `preview-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
)

/**
 * Where the Reading below has got to, and the only thing it tells this page. The
 * engine is a pure function of it, so reading it a second time here costs a walk
 * of the Cuts taken and buys a State nobody had to hand out.
 */
const at = ref<Position>(OPENING)
const shown = computed(() => story.value && reading(story.value, at.value))

/** Scenes are read by name here as everywhere else an Author reads them. */
const sceneNames = computed(() => new Map(story.value?.scenes.map(scene => [scene.id, scene.name])))

function sceneName(sceneId: string) {
  // A Condition may still name a Scene deleted since it was written, and saying
  // so is more use to the Author than the id it holds.
  return sceneNames.value.get(sceneId) ?? 'a deleted Scene'
}

/**
 * What this Reading has accumulated. A Flag nobody has set and a Scene nobody
 * has entered are not listed: in a Story of fifty Scenes the full list says
 * almost nothing at very great length.
 */
const flags = computed(() => Object.entries(shown.value?.state.flags ?? {}))
const visits = computed(() => Object.entries(shown.value?.state.visits ?? {}))

/**
 * The ways out of the Scene the Reading stands in that it is not being offered —
 * the Cuts the engine filtered out, found by asking the engine's own predicate
 * rather than by testing the Conditions again here. Only where the Scene has
 * played out, because that is where the ways on are the question.
 */
const hidden = computed(() => {
  const now = shown.value
  if (!story.value || !now || now.shot) return []

  return story.value.cuts.filter(
    cut => cut.fromSceneId === now.sceneId && !holds(cut.conditions, now.state))
})

/** Which of the tests a hidden Cut carries this State fails, and by what. */
function why(cut: Cut) {
  return shown.value ? unmet(cut.conditions, shown.value.state, sceneName) : []
}
</script>

<template>
  <main class="room">
    <header>
      <NuxtLink class="back trail" :to="`/stories/${id}`">Back to the Story</NuxtLink>
      <!-- Said in the room the Reader will be in, and marked as the Author's own
           run through it rather than dressed up as a published Story. -->
      <p class="eyebrow">Nobody else can reach this</p>
      <h1>Preview of {{ story?.title }}</h1>
    </header>

    <!-- Said plainly to the Author, who can go and name one. A Reader meeting the
         same Story is simply told the path ends. -->
    <p v-if="story && !story.openingSceneId" class="nothing">
      This Story has no opening Scene, so there is nothing to read yet.
    </p>

    <Reading v-else-if="story" :story="story" @at="at = $event" />

    <!-- The bench the reel is cut on, under the projection and never in it: what
         is here is the Author's own instrument and no part of the Story. -->
    <section v-if="story?.openingSceneId" class="bench">
      <p class="eyebrow">On the bench <span aria-hidden="true">·</span> nobody reading this sees it</p>

      <!-- Why a way on is missing, which is the question a Preview could not
           answer before: the Cuts out of this Scene the State is hiding, struck
           through and each naming the tests it failed. Text and not controls —
           a hidden Cut is not takeable here any more than it is for a Reader. -->
      <div v-if="hidden.length" class="hidden">
        <p class="eyebrow">Ways on this Reading is not offered</p>
        <ul>
          <li v-for="cut in hidden" :key="cut.id">
            <s class="splice">{{ cutNamed(cut, sceneName) }}</s>
            <ul class="why">
              <li v-for="(test, place) in why(cut)" :key="place">{{ test }}</li>
            </ul>
          </li>
        </ul>
      </div>

      <div class="state">
        <div>
          <p class="eyebrow">Flags</p>
          <ul v-if="flags.length" class="flags">
            <li v-for="[name, value] in flags" :key="name">
              {{ name }} <span aria-hidden="true">=</span> <b>{{ value || '(nothing)' }}</b>
            </li>
          </ul>
          <p v-else class="none">No Scene has set one yet</p>
        </div>

        <div>
          <p class="eyebrow">Scenes entered</p>
          <ul class="visits">
            <li v-for="[sceneId, count] in visits" :key="sceneId">
              {{ sceneName(sceneId) }} <span aria-hidden="true">×</span> <b>{{ count }}</b>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* The projection no longer has the room to itself, so it is no longer centred in
   it: the bench follows the reel down the page instead of being pushed to the
   far end of it. */
.room {
  grid-template-rows: auto;
  align-content: start;
}

.back {
  justify-self: start;
  margin-block-end: var(--s3);
}

h1 {
  font-size: clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem);
}

/* The bench sits under the projection, in the machine's own voice: mono, small,
   and on the surface an editor works on rather than the one they look at. It is
   as wide as the reel above it so the two read as one column. */
.bench {
  display: grid;
  gap: var(--s4);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
  padding: var(--s4);
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

/* Two lists side by side where there is room for two, and one under the other
   on a phone. */
.state {
  display: grid;
  gap: var(--s4);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
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

/* An Author who has not named an Opening Scene has nothing to project, so the
   room holds a note where the frame would be. */
.nothing {
  align-self: center;
  inline-size: min(100%, 46rem);
  margin-inline: auto;
  padding: var(--s4);
  border: 1px dashed var(--edge);
  border-radius: var(--machined);
  color: var(--muted);
}
</style>
