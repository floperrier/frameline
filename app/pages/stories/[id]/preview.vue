<script setup lang="ts">
// The Author plays their own Story here, before anyone else can see it. Nothing
// about the Story changes and nobody else can reach the page: what it draws is
// the same component, and so the same engine, a Reader runs once it is published.
//
// What a Reader never gets is the bench under it — the State the Reading has
// accumulated, and the ways on its Conditions are hiding. None of that is drawn
// by the Reading itself: the Reading says where it has got to, and everything
// here is worked out again from that Path, so a Reader's Reading carries no
// inspection code to be kept switched off.
definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const id = useRoute().params.id as string
const headers = useRequestHeaders(['cookie'])
const { data: story } = await useAsyncData(
  `preview-${id}`,
  () => send(`/api/stories/${id}`, { headers }) as Promise<StoryInEditor>,
)

/**
 * Where the Reading below has got to, and the only thing it tells this page. The
 * engine is a pure function of it, so reading it a second time here costs a walk
 * of the Exits taken and buys a State nobody had to hand out.
 */
const at = ref<Path>(UNDRAWN)

/**
 * The reel above, which holds the Path and is the only thing that may move
 * it. All this asks of it is another draw — a Path rerolled here would be a
 * second Path, and the Reading would go on reading its own.
 */
const reel = useTemplateRef<{ reroll: () => void }>('reel')

/**
 * Whether any Scene of this Story draws a Flag, which is whether there is
 * anything for another draw to change. A Story with none is read the same way
 * whatever the seed, so the control is not offered rather than offered and inert.
 */
const draws = computed(() =>
  story.value?.scenes.some(scene => Object.values(scene.sets).some(Array.isArray)))
const shown = computed(() => story.value && reading(story.value, at.value))

/** Scenes are read by name here as everywhere else an Author reads them. */
const sceneNames = computed(() => new Map(story.value?.scenes.map(scene => [scene.id, scene.name])))

function sceneName(sceneId: string) {
  return sceneNamed(sceneNames.value, sceneId, t)
}

/**
 * What this Reading has accumulated. A Flag nobody has set and a Scene nobody
 * has entered are not listed: in a Story of fifty Scenes the full list says
 * almost nothing at very great length.
 */
const flags = computed(() => Object.entries(shown.value?.state.flags ?? {}))

/** What a Flag holds, and what stands in for a Flag holding the empty value. */
function held(value: string) {
  return value || t('preview.noFlagValue')
}
const visits = computed(() => Object.entries(shown.value?.state.visits ?? {}))

/**
 * The ways out of the Scene the Reading stands in that it is not being offered —
 * the Exits the engine filtered out, found by asking the engine's own predicate
 * rather than by testing the Conditions again here. Only where the Scene has
 * played out, because that is where the ways on are the question.
 */
const hidden = computed(() => {
  const now = shown.value
  if (!story.value || !now || now.shot) return []

  return story.value.exits.filter(
    exit => exit.fromSceneId === now.sceneId && !holds(exit.conditions, now.state))
})

/**
 * The Shots of that Scene this Reading is not playing, named by the Place they
 * hold in the Scene the Author wrote — which is the number the editor shows them
 * under, and not the one the Reader's frame counts, because a skipped Shot has no
 * place in the run at all. Standing beside the ways on for the same reason: what
 * a Condition is hiding is what an Author came to the Preview to find out.
 */
const skipped = computed(() => {
  const now = shown.value
  const scene = story.value?.scenes.find(({ id }) => id === now?.sceneId)
  if (!now || !scene) return []

  return scene.shots
    .map((shot, place) => ({ shot, place: place + 1 }))
    .filter(({ shot }) => !holds(shot.conditions, now.state))
})

/** Which of the tests a hidden Exit or a skipped Shot carries this State fails, and by what. */
function why(conditions: Condition[]) {
  return shown.value ? unmet(conditions, shown.value.state, sceneName, t) : []
}
</script>

<template>
  <main class="room">
    <header>
      <div class="leaving">
        <NuxtLink class="back trail" :to="localePath(`/stories/${id}`)">
          {{ $t('preview.back') }}
        </NuxtLink>
        <Locales />
      </div>
      <!-- Said in the room the Reader will be in, and marked as the Author's own
           run through it rather than dressed up as a published Story. -->
      <p class="eyebrow">{{ $t('preview.nobodyElse') }}</p>
      <!-- The Story's title is the Author's own words and stays in the Story's
           Language; the sentence around it is the Author's tool and is in
           theirs. The Aperçu is the one screen where the two are visible at
           once. -->
      <h1>
        <i18n-t keypath="preview.heading" tag="span" scope="global">
          <template #title>
            <span :lang="story?.language">{{ story?.title }}</span>
          </template>
        </i18n-t>
      </h1>
    </header>

    <!-- Said plainly to the Author, who can go and name one. A Reader meeting the
         same Story is simply told the path ends. -->
    <p v-if="story && !story.openingSceneId" class="nothing">
      {{ $t('preview.noOpeningScene') }}
    </p>

    <!-- The reel and the bench it is cut on, stacked: the projection no longer has
         the room to itself, so the two are given a surface of this page's own
         rather than the room being taught to hold both. -->
    <div v-else-if="story" class="cutting">
      <Reading ref="reel" :story="story" @at="at = $event" />

      <!-- What is on the bench is the Author's own instrument and no part of the
           Story, so it sits under the projection and never in it. Named, because
           a landmark an Author can be sent to is worth the one attribute. -->
      <section class="bench" aria-labelledby="bench">
        <p id="bench" class="eyebrow">
          {{ $t('preview.bench') }}
          <span aria-hidden="true">·</span>
          {{ $t('preview.benchNote') }}
        </p>

        <!-- The one control on the bench, and no part of the Story: the same
             Reading at the same Path, read against another draw. It sits with
             the State it changes rather than in the reel, because what an Author
             is doing here is looking at their own variants and not reading. -->
        <p v-if="draws" class="draw">
          <button type="button" class="trail" @click="reel?.reroll()">
            {{ $t('preview.reroll') }}
          </button>
          <span aria-hidden="true">·</span>
          {{ $t('preview.rerollNote') }}
        </p>

        <!-- Why a way on is missing, which is the question a Preview could not
             answer before: the Exits out of this Scene the State is hiding, struck
             through and each naming the tests it failed. Text and not controls —
             a hidden Exit is not takeable here any more than it is for a Reader. -->
        <div v-if="hidden.length" class="hidden">
          <p class="eyebrow">{{ $t('preview.waysOnHidden') }}</p>
          <ul>
            <li v-for="exit in hidden" :key="exit.id">
              <s class="splice" :lang="story?.language">{{ exitNamed(exit, sceneName, t) }}</s>
              <ul class="why">
                <li v-for="(test, at) in why(exit.conditions)" :key="at">{{ test }}</li>
              </ul>
            </li>
          </ul>
        </div>

        <!-- The beats this Reading is not being played, said the same way: the
             Shot the Author wrote, crossed out, with the tests it failed under
             it. The other half of the question the Preview answers — a Scene
             that says something different on a return visit is a Scene whose
             skipped Shots an Author has to be able to see. -->
        <div v-if="skipped.length" class="hidden">
          <p class="eyebrow">{{ $t('preview.shotsSkipped') }}</p>
          <ul>
            <li v-for="{ shot, place } in skipped" :key="shot.id">
              <s class="splice" :lang="story?.language">
                {{ t('preview.skippedShot', {
                  place,
                  text: shot.text || t('preview.nothingWritten'),
                }) }}
              </s>
              <ul class="why">
                <li v-for="(test, at) in why(shot.conditions)" :key="at">{{ test }}</li>
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
    </div>
  </main>
</template>

<style scoped>
/* The reel and the bench under it, stacked at the top of the room they were
   given rather than the reel being centred in it and the bench pushed to the far
   end. This page's own, so the room stays what the stylesheet says it is. */
.cutting {
  display: grid;
  align-content: start;
  gap: var(--s5);
}

/* Where the Author came from on one side and the language they read in on the
   other: both are about the tool rather than about the Story. */
.leaving {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
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

/* The draw, offered the way the bench says everything else: the control first
   and what it does beside it, in the machine's own small voice. */
.draw {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
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
