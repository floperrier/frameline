<script setup lang="ts">
// The Catalogue: every Listed Story, most recently published first, read by
// anyone with or without an account. Its own page rather than a shelf on the
// landing page, because the landing page argues for the product and this one
// hands over other people's work.
//
// No middleware: a Reader has no account, and an Author browsing is a Reader
// like any other until they open the bench.
const localePath = useLocalePath()
const { data: catalogue } = await useFetch('/api/catalogue')
</script>

<template>
  <main>
    <header>
      <NuxtLink class="wordmark trail" :to="localePath('/')">Frameline</NuxtLink>
      <h1>{{ $t('catalogue.heading') }}</h1>
      <p class="line">{{ $t('catalogue.line') }}</p>
      <Locales />
    </header>

    <p v-if="!catalogue?.length" class="none">{{ $t('catalogue.none') }}</p>
    <!-- One entry a Story, and the entry is the link: the Catalogue's whole job
         is to hand a Reader the public link they were never sent. It carries no
         count and no rating — nothing here is a score, and the order is the date
         alone. -->
    <ul v-else class="entries">
      <Entry v-for="story in catalogue" :key="story.id" :story="story" />
    </ul>
  </main>
</template>

<style scoped>
main {
  display: grid;
  gap: var(--s5);
  align-content: start;
  inline-size: min(100%, 60rem);
  min-block-size: 100dvh;
  margin-inline: auto;
  padding: var(--s4) var(--s4) var(--s6);
}

header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  padding-block-end: var(--s3);
  border-block-end: 1px solid var(--edge);
}

/* The product's own name, tracked wider than any label, as it is on the list of
   an Author's own Stories: the two lists are the same room seen from either
   side of an account. */
.wordmark {
  grid-column: 1 / -1;
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-decoration: none;
}

.wordmark:hover {
  color: var(--paper);
}

h1 {
  text-transform: uppercase;
}

.line {
  grid-column: 1;
  color: var(--muted);
  max-inline-size: 52ch;
}

/* The child component's root carries this page's scope, so the switcher is
   placed from here rather than wrapped in a box that exists to be placed. */
.locales {
  grid-column: 2;
  grid-row: 2 / span 2;
}

.none {
  color: var(--muted);
  max-inline-size: 44ch;
}

/* A hairline between entries and nothing else, as on the list of an Author's own
   Stories: a stack of titles, where a box around each would be five borders
   where one rule does. */
.entries {
  display: grid;
  border-block-start: 1px solid var(--edge);
}
</style>
