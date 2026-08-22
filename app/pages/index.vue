<script setup lang="ts">
const { loggedIn } = useUserSession()
const failed = computed(() => Boolean(useRoute().query.error))
</script>

<template>
  <main>
    <div class="pitch">
      <p class="eyebrow">Interactive narrative, cut like film</p>
      <h1>Frameline</h1>
      <p class="line">
        An editor for interactive narrative works that speaks the grammar of cinema.
        Write in Shots, cut between Scenes, and hand a Reader one link.
      </p>

      <NuxtLink v-if="loggedIn" class="enter" to="/stories">Your Stories</NuxtLink>
      <div v-else class="doors">
        <p v-if="failed" role="alert">Signing in did not work. Please try again.</p>
        <p class="eyebrow">Sign in to write</p>
        <a class="door" href="/auth/github">Sign in with GitHub</a>
        <a class="door" href="/auth/google">Sign in with Google</a>
      </div>
    </div>

    <!-- The thesis, and the one thing worth showing before anyone signs in: a
         Story is a beat, and then what the Reader may take. It is a specimen and
         not a Reading, so nothing here is a control — a visitor cannot take a
         Cut that leads nowhere. -->
    <figure class="specimen">
      <figcaption class="eyebrow">What a Reader is shown</figcaption>
      <div class="frame">
        <p class="scene eyebrow">The street</p>
        <p class="beat">
          The door gives on the third push. Rain, and the neon of the bar
          opposite, already lit at four in the afternoon.
        </p>
      </div>
      <ul class="cuts">
        <li>Cross to the bar</li>
        <li>Stay in the doorway until it eases</li>
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

.enter,
.door {
  padding: var(--s2) var(--s4);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  color: var(--paper);
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 150ms, background-color 150ms;
}

.enter {
  margin-block-start: var(--s2);
  border-color: transparent;
  background: var(--light);
  color: #0b1614;
  font-weight: 600;
}

.doors {
  display: grid;
  justify-items: start;
  gap: var(--s2);
  margin-block-start: var(--s3);
}

.door:hover,
.enter:hover {
  border-color: var(--light);
  background: color-mix(in oklab, var(--light) 14%, transparent);
}

.enter:hover {
  background: color-mix(in oklab, var(--light) 85%, white);
}

.specimen {
  display: grid;
  gap: var(--s3);
  align-content: center;
}

/* The gate: the one curve in the product, and the shape a frame is thrown
   through. Empty of an image on purpose — a Shot may be text alone. */
.frame {
  display: grid;
  gap: var(--s3);
  padding: var(--s5) var(--s4);
  border: 1px solid var(--edge);
  border-radius: var(--gate);
  background:
    radial-gradient(
      120% 90% at 50% 0%,
      color-mix(in oklab, var(--light) 7%, transparent),
      transparent 70%
    ),
    color-mix(in oklab, var(--room) 60%, var(--steel));
}

.beat {
  font-family: var(--prose);
  font-size: clamp(1.25rem, 0.9rem + 1.2vw, 1.75rem);
  font-weight: 300;
  line-height: 1.4;
  max-inline-size: 32ch;
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

.cuts li::before {
  content: '→';
  color: var(--grease);
  font-family: var(--data);
}
</style>
