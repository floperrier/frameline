<script setup lang="ts">
// The Catalogue: every Listed Story, most recently published first, read by
// anyone with or without an account. Its own page rather than a shelf on the
// landing page, because the landing page argues for the product and this one
// hands over other people's work.
//
// No middleware: a Reader has no account, and an Author browsing is a Reader
// like any other until they open the bench.
const { locale, t, te } = useI18n()
const localePath = useLocalePath()
const { data: catalogue } = await useFetch('/api/catalogue')

/**
 * The day a Story was published, written the way a date is written in the
 * Locale: the entry around the Story is the interface talking, so it is in the
 * language of whoever is reading rather than the Language of the work.
 *
 * Read in UTC rather than in the reader's own zone, so the server and the
 * browser agree on which day it was. A Story published at midnight would
 * otherwise be dated one day on the page delivered and another the moment it is
 * hydrated.
 */
const published = computed(() => new Intl.DateTimeFormat(
  locale.value, { dateStyle: 'long', timeZone: 'UTC' }))

/**
 * The Language a Story is written in, named. The column holds any BCP-47 code
 * while the interface has a name for the few the form offers, so a Story written
 * in something else is shown the code it carries rather than a blank.
 */
function languageNamed(code: string) {
  return te(`languages.${code}`) ? t(`languages.${code}`) : code
}
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
      <li v-for="story in catalogue" :key="story.id">
        <NuxtLink class="open" :to="`/read/${story.id}`" :lang="story.language">
          {{ story.title }}
        </NuxtLink>
        <p class="facts">
          <span class="eyebrow">{{ languageNamed(story.language) }}</span>
          <time v-if="story.publishedAt" class="eyebrow" :datetime="story.publishedAt">
            {{ published.format(new Date(story.publishedAt)) }}
          </time>
        </p>
      </li>
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

.entries li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  padding-block: var(--s4);
  border-block-end: 1px solid var(--edge);
}

.open {
  font-family: var(--display);
  font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2rem);
  font-weight: 600;
  line-height: 1.1;
  color: var(--paper);
  text-decoration: none;
}

.open:hover {
  color: var(--light);
}

/* What is said about a Story before it is opened: the Language it is written in
   and the day it was published, stencilled rather than written out, because they
   are labels on the reel and not part of the work. */
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s3);
}

@media (max-width: 44rem) {
  .entries li {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
