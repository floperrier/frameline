<script setup lang="ts">
// The Catalogue: every Listed Story, most recently published first, read by
// anyone with or without an account. Its own page rather than a shelf on the
// landing page, because the landing page argues for the product and this one
// hands over other people's work.
//
// No middleware: a Reader has no account, and an Author browsing is a Reader
// like any other until they open the bench.
//
// What a Reader asks of it lives in the URL and nowhere else, so a narrowed
// Catalogue is a link, the Back button returns to it, and the page re-fetches
// whenever the query changes. The controls are a plain `GET` form, so they work
// with no JavaScript at all: submitting it is following the URL it answers.
const localePath = useLocalePath()
const route = useRoute()
const { loggedIn } = useUserSession()
const query = computed(() => catalogueQuery(catalogueState(route.query)))
const asked = computed(() => catalogueState(route.query))
const { data: catalogue } = await useFetch('/api/catalogue', { query })
const { t } = useI18n()

/** Whether the Reader has narrowed the Catalogue, which is what an empty answer is owed. */
const narrowed = computed(() => Object.keys(query.value).length > 0)

/**
 * The search, sent the way the form would send it, minus the empty values a
 * browser writes for every field it has: the URL a Reader is left holding names
 * what they asked for and nothing else.
 */
async function search(event: Event) {
  const form = new FormData(event.target as HTMLFormElement)
  await navigateTo({ query: catalogueQuery(catalogueState(Object.fromEntries(form))) })
}

useHead({ title: () => t('catalogue.heading') })
</script>

<template>
  <main>
    <header>
      <NuxtLink class="wordmark trail" :to="localePath('/')">Frameline</NuxtLink>
      <h1>{{ $t('catalogue.heading') }}</h1>
      <p class="line">{{ $t('catalogue.line') }}</p>
      <Locales />
    </header>

    <!-- Gathering a Story is signed, so somebody with no account is offered no
         control — and is told why here, once, rather than under every entry.
         Nothing sends them anywhere: they came to find something to read. -->
    <p v-if="!loggedIn" class="none">{{ $t('lists.signedOut') }}</p>
    <p v-else class="yours">
      <NuxtLink :to="localePath('/lists')">{{ $t('lists.yourLists') }}</NuxtLink>
    </p>

    <!-- The search, as a form whose answer is a URL: without JavaScript the
         browser follows it, and with it the same URL is pushed without the empty
         fields. The field keeps what the URL asked for, so a reloaded search is
         the search still filled in. -->
    <form class="asking" role="search" method="get" :action="localePath('/catalogue')" @submit.prevent="search">
      <label class="eyebrow" for="catalogue-q">{{ $t('catalogue.searchLabel') }}</label>
      <div class="row">
        <input
          id="catalogue-q"
          name="q"
          type="search"
          :value="asked.q"
          :maxlength="CATALOGUE_SEARCH_MAX_LENGTH"
        >
        <button type="submit">{{ $t('catalogue.search') }}</button>
      </div>
    </form>

    <p v-if="!catalogue?.length && narrowed" class="none">
      {{ $t('catalogue.nothingMatches') }}
      <NuxtLink :to="localePath('/catalogue')">{{ $t('catalogue.clear') }}</NuxtLink>
    </p>
    <p v-else-if="!catalogue?.length" class="none">{{ $t('catalogue.none') }}</p>
    <!-- One entry a Story, and the entry is the link: the Catalogue's whole job
         is to hand a Reader the public link they were never sent. It carries no
         count and no rating — nothing here is a score, and nothing counted
         orders it. -->
    <ul v-else class="entries">
      <Entry v-for="story in catalogue" :key="story.id" :story="story">
        <Gathering :story-id="story.id" :title="story.title" />
      </Entry>
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

/* What the Reader asks of the shelf, stencilled like every label on it, above
   the entries it narrows. */
.asking {
  display: grid;
  gap: var(--s1);
}

.asking .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.asking input {
  flex: 1 1 16rem;
  min-inline-size: 0;
}

/* A hairline between entries and nothing else, as on the list of an Author's own
   Stories: a stack of titles, where a box around each would be five borders
   where one rule does. */
.entries {
  display: grid;
  border-block-start: 1px solid var(--edge);
}
</style>
