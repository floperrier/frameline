<script setup lang="ts">
const failed = computed(() => Boolean(useRoute().query.error))
const localePath = useLocalePath()

// Which published Story the Reading link points at is a fact about the
// deployment, so it is configuration — see `nuxt.config.ts`. Unset, the link is
// not shown at all, because a dead link into an empty Reading would be worse
// than no link. The address carries no locale, like every public link does:
// `docs/adr/0012-the-public-link-carries-no-locale.md`.
const landingStory = useRuntimeConfig().public.landingStory
</script>

<template>
  <main>
    <!-- The opening screen, and it still fills the viewport on its own: what a
         visitor is shown before they scroll is exactly what they were shown
         before the page learned to explain itself. -->
    <div class="opening">
      <div class="pitch">
        <Locales />
        <p class="eyebrow">{{ $t('landing.eyebrow') }}</p>
        <h1>Frameline</h1>
        <p class="line">{{ $t('landing.pitch') }}</p>

        <Doors class="settled" :failed="failed" />
      </div>

      <!-- The thesis, and the one thing worth showing before anyone signs in: a
           Story is a beat, and then what the Reader may take. It is a specimen and
           not a Reading, so nothing here is a control — a visitor cannot take a
           Exit that leads nowhere. -->
      <figure class="specimen">
        <figcaption class="eyebrow">{{ $t('landing.specimen') }}</figcaption>
        <div class="frame">
          <p class="eyebrow">{{ $t('landing.specimenScene') }}</p>
          <p class="shot">{{ $t('landing.specimenShot') }}</p>
        </div>
        <ul class="exits">
          <li class="splice">{{ $t('landing.specimenExitOne') }}</li>
          <li class="splice">{{ $t('landing.specimenExitTwo') }}</li>
        </ul>
      </figure>
    </div>

    <!-- The second movement: the five structural terms, each with a figure of
         the thing itself. Only these five — State, Flag, Preview and Path
         mean nothing to somebody who has not written a line, and they are
         learned on the bench. Every figure is drawn from the same primitives as
         the bench draws a Story with, and every one of them is decoration: the
         term and its sentence carry the whole meaning. -->
    <section class="terms">
      <h2 class="eyebrow">{{ $t('landing.made') }}</h2>

      <ol>
        <li>
          <!-- A Story: Scenes, and the Exits between them, seen at once. -->
          <div class="figure story" aria-hidden="true">
            <span class="node"></span>
            <span class="node"></span>
            <span class="node"></span>
          </div>
          <h3>{{ $t('landing.terms.storyTerm') }}</h3>
          <p class="line">{{ $t('landing.terms.storyLine') }}</p>
        </li>

        <li>
          <!-- A Scene: one node, and the run of Shots inside it. -->
          <div class="figure run" aria-hidden="true">
            <span class="node">
              <span class="bar"></span>
              <span class="bar"></span>
              <span class="bar"></span>
            </span>
          </div>
          <h3>{{ $t('landing.terms.sceneTerm') }}</h3>
          <p class="line">{{ $t('landing.terms.sceneLine') }}</p>
        </li>

        <li>
          <!-- A Shot: the gate, with an image in it and its text under. -->
          <div class="figure" aria-hidden="true">
            <span class="frame">
              <span class="image"></span>
              <span class="bar"></span>
              <span class="bar short"></span>
            </span>
          </div>
          <h3>{{ $t('landing.terms.shotTerm') }}</h3>
          <p class="line">{{ $t('landing.terms.shotLine') }}</p>
        </li>

        <li>
          <!-- An Exit: the grease-pencil mark, and the Scene it leads on to. -->
          <div class="figure exit" aria-hidden="true">
            <span class="node"></span>
            <span class="splice"></span>
            <span class="node"></span>
          </div>
          <h3>{{ $t('landing.terms.exitTerm') }}</h3>
          <p class="line">{{ $t('landing.terms.exitLine') }}</p>
        </li>

        <li>
          <!-- A Condition: the same run of Shots, one of which does not play. -->
          <div class="figure run" aria-hidden="true">
            <span class="node">
              <span class="bar"></span>
              <span class="bar unplayed"></span>
              <span class="bar"></span>
            </span>
          </div>
          <h3>{{ $t('landing.terms.conditionTerm') }}</h3>
          <p class="line">{{ $t('landing.terms.conditionLine') }}</p>
        </li>
      </ol>
    </section>

    <!-- The foot: what a Reading actually feels like, on the real engine and at
         a public link, the way to everything other Authors have listed, and then
         the doors again. -->
    <footer>
      <NuxtLink v-if="landingStory" class="trail" :to="`/read/${landingStory}`">
        {{ $t('landing.reading') }}
      </NuxtLink>
      <!-- The Catalogue is its own page, so the landing page points at it rather
           than showing it: this page argues for the product, and that one hands
           over other people's work. -->
      <NuxtLink class="trail" :to="localePath('/catalogue')">
        {{ $t('landing.catalogue') }}
      </NuxtLink>
      <Doors />
    </footer>
  </main>
</template>

<style scoped>
/* The page a Story is met from, so it is the projection room rather than the
   bench. It reads top to bottom in three movements — the opening screen, the
   five terms, the way in — and the first of them is still a screen of its own. */
main {
  --page-pad: var(--s5);

  display: grid;
  gap: var(--s6);
  padding: var(--page-pad) var(--s4);
  background: var(--room);
}

.opening {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: var(--s6);
  /* The padding above is the page's, so the screen the opening fills is what is
     left of the viewport once the page has its margins. */
  min-block-size: calc(100dvh - 2 * var(--page-pad));
}

@media (min-width: 60rem) {
  main {
    --page-pad: var(--s6);

    padding: var(--page-pad);
  }

  .opening {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }

  /* The one rule on the page, and it does the work of a wall: the pitch on this
     side of it, and the projection on that one. */
  .specimen {
    padding-inline-start: var(--s6);
    border-inline-start: 1px solid var(--edge);
  }
}

/* The pitch reads top to bottom and the doors sit at the foot of it, so the
   composition has a floor rather than trailing off. */
.pitch {
  display: grid;
  justify-items: start;
  align-content: space-between;
  gap: var(--s3);
  max-inline-size: 34rem;
}

.pitch h1 {
  /* The wordmark, and the only place the condensed face is allowed to fill the
     line it sits on. */
  font-size: clamp(3.5rem, 1rem + 11vw, 7rem);
  line-height: 0.86;
  text-transform: uppercase;
}

.line {
  color: var(--muted);
  font-size: 1.0625rem;
  max-inline-size: 34ch;
}

/* The doors' own treatment is the component's; where they sit under the pitch is
   this page's, so it is handed to them as a class rather than reached for
   through one of theirs. */
.settled {
  margin-block-start: var(--s3);
}

.specimen {
  display: grid;
  gap: var(--s3);
  align-content: center;
}

/* The gate itself comes from the stylesheet: this is the surface a Reader is
   shown, so it is that surface and not a picture of it. Empty of an image on
   purpose — a Shot may be text alone. */
.specimen .frame {
  display: grid;
  gap: var(--s3);
  padding: var(--s5) var(--s4);
}

/* Exits are a splice list: a grease-pencil mark, then the line the Reader takes. */
.exits {
  display: grid;
  gap: 1px;
  background: var(--edge);
  border-block: 1px solid var(--edge);
}

.exits li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s3);
  padding: var(--s3) var(--s2);
  background: var(--room);
  font-size: 0.9375rem;
}

/* The five terms, as wide as they fit and stacked when they do not, so a narrow
   screen reads them one after another. */
.terms {
  display: grid;
  gap: var(--s4);
}

.terms ol {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--s5) var(--s4);
}

.terms li {
  display: grid;
  align-content: start;
  gap: var(--s2);
}

/* Every figure occupies the same band, so the five terms sit on one line of
   type whatever is drawn above them. */
.figure {
  display: flex;
  align-items: center;
  gap: var(--s2);
  block-size: 5rem;
  margin-block-end: var(--s1);
}

/* A Scene as the graph draws it: a lit slab off the bench, and the only shape in
   these figures that stands for a Scene. */
.node {
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--steel);
  inline-size: 3.25rem;
  block-size: 2.25rem;
}

/* The Exits between them, drawn as the hairline they are on the graph. */
.story .node + .node {
  position: relative;
  margin-inline-start: var(--s4);
}

.story .node + .node::before {
  content: '';
  position: absolute;
  inset-inline-end: 100%;
  inset-block-start: 50%;
  inline-size: var(--s4);
  border-block-start: 1px solid var(--grease);
}

/* An open node: the run of Shots inside a Scene, which is what the Scene and the
   Condition figures are both about. */
.run .node {
  display: grid;
  align-content: center;
  gap: var(--s1);
  padding: var(--s2);
  inline-size: 7rem;
  block-size: auto;
}

.bar {
  background: color-mix(in oklab, var(--muted) 70%, var(--edge));
  block-size: 3px;
}

/* A Shot that does not play, because a Condition on it did not hold: still in
   the Scene, and not on screen. */
.unplayed {
  background: none;
  border-block-start: 1px dashed var(--edge);
}

/* The gate again, at the size of a figure: an Image, and the Shot's text under
   it. */
.figure .frame {
  display: grid;
  gap: var(--s1);
  padding: var(--s2);
  inline-size: 7rem;
}

.image {
  border-radius: var(--machined);
  background: color-mix(in oklab, var(--light) 18%, var(--steel));
  block-size: 1.5rem;
}

.short {
  inline-size: 60%;
}

/* The grease-pencil mark, borrowed from the splice list, standing on its own
   between the two Scenes an Exit joins. */
.exit .splice::before {
  font-size: 1.25rem;
}

/* The way in, said twice on this page: at the top beside the pitch, and here,
   under everything that was said to convince anyone of it. */
footer {
  display: grid;
  justify-items: start;
  gap: var(--s4);
  padding-block-start: var(--s5);
  border-block-start: 1px solid var(--edge);
}
</style>
