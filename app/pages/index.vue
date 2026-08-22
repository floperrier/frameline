<script setup lang="ts">
const { loggedIn } = useUserSession()
const localePath = useLocalePath()
const failed = computed(() => Boolean(useRoute().query.error))
</script>

<template>
  <main>
    <div class="pitch">
      <p class="eyebrow">{{ $t('landing.eyebrow') }}</p>
      <h1>Frameline</h1>
      <p class="line">{{ $t('landing.pitch') }}</p>

      <NuxtLink v-if="loggedIn" class="enter primary" :to="localePath('/stories')">
        {{ $t('landing.yourStories') }}
      </NuxtLink>
      <div v-else class="doors">
        <p v-if="failed" role="alert">{{ $t('landing.signInFailed') }}</p>
        <p class="eyebrow">{{ $t('landing.signInToWrite') }}</p>
        <a class="door" href="/auth/github">{{ $t('landing.signInWithGitHub') }}</a>
        <a class="door" href="/auth/google">{{ $t('landing.signInWithGoogle') }}</a>
      </div>
    </div>

    <!-- The thesis, and the one thing worth showing before anyone signs in: a
         Story is a beat, and then what the Reader may take. It is a specimen and
         not a Reading, so nothing here is a control — a visitor cannot take a
         Cut that leads nowhere. -->
    <figure class="specimen">
      <figcaption class="eyebrow">{{ $t('landing.specimen') }}</figcaption>
      <div class="frame">
        <p class="eyebrow">{{ $t('landing.specimenScene') }}</p>
        <p class="shot">{{ $t('landing.specimenShot') }}</p>
      </div>
      <ul class="cuts">
        <li class="splice">{{ $t('landing.specimenCutOne') }}</li>
        <li class="splice">{{ $t('landing.specimenCutTwo') }}</li>
      </ul>
    </figure>
  </main>
</template>

<style scoped>
/* The page a Story is met from, so it is the projection room rather than the
   bench: the pitch on one side, and what a Reading looks like on the other. */
main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: var(--s6);
  min-block-size: 100dvh;
  padding: var(--s5) var(--s4);
  background: var(--room);
}

@media (min-width: 60rem) {
  main {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-content: center;
    gap: var(--s6);
    padding: var(--s6);
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

/* Both doors are the size of a thing worth pressing; the one an Author with a
   session already has takes the interface's primary treatment from the
   stylesheet rather than restating it. */
.enter,
.door {
  padding: var(--s2) var(--s4);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 150ms, background-color 150ms;
}

.door {
  color: var(--paper);
}

.enter {
  margin-block-start: var(--s2);
}

.doors {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  margin-block-start: var(--s3);
}

.door:hover {
  border-color: var(--light);
  background: color-mix(in oklab, var(--light) 14%, transparent);
}

.specimen {
  display: grid;
  gap: var(--s3);
  align-content: center;
}

/* The gate itself comes from the stylesheet: this is the surface a Reader is
   shown, so it is that surface and not a picture of it. Empty of an image on
   purpose — a Shot may be text alone. */
.frame {
  display: grid;
  gap: var(--s3);
  padding: var(--s5) var(--s4);
}

/* Cuts are a splice list: a grease-pencil mark, then the line the Reader takes. */
.cuts {
  display: grid;
  gap: 1px;
  background: var(--edge);
  border-block: 1px solid var(--edge);
}

.cuts li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s3);
  padding: var(--s3) var(--s2);
  background: var(--room);
  font-size: 0.9375rem;
}

</style>
