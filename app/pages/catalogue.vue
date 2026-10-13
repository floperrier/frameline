<script setup lang="ts">
// The Catalogue: every Listed Story, the latest to enter it first, read by
// anyone with or without an account, a page of them at a time. Its own page rather than a shelf on the
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
const { languageNamed } = useEntries()

/**
 * Whether the Reader has narrowed the Catalogue — the page aside, which narrows
 * nothing — which is what an answer with nothing in it is owed.
 */
const narrowed = computed(() =>
  Object.keys(catalogueQuery({ ...asked.value, page: 1 })).length > 0)

/** What the Reader is shown: a page of entries, a page past the last, or nothing. */
const entries = computed(() => catalogue.value?.entries ?? [])
const pages = computed(() => catalogue.value?.pages ?? 0)
const pastTheEnd = computed(() => !entries.value.length && !!catalogue.value?.total)

/** The link to one page of what the Reader asked for, carrying the rest of the query. */
function toPage(page: number) {
  return { query: catalogueQuery({ ...asked.value, page }) }
}

/**
 * The search, sent the way the form would send it, minus the empty values a
 * browser writes for every field it has: the URL a Reader is left holding names
 * what they asked for and nothing else.
 */
async function search(event: Event) {
  const form = new FormData(event.target as HTMLFormElement)
  await navigateTo({ query: catalogueQuery(catalogueState(Object.fromEntries(form))) })
}

/**
 * A list changed, which applies at once rather than waiting for the button: the
 * query is replaced by what the form now asks, and the page fetches again. The
 * page is not part of the form, so any change but the page lands on page one.
 * The words typed in the search apply on submit and not here, so a Reader
 * changing a list is given what the URL already searched for.
 */
async function narrow(event: Event) {
  const form = new FormData((event.target as HTMLSelectElement).form!)
  form.set('q', asked.value.q)
  await navigateTo({ query: catalogueQuery(catalogueState(Object.fromEntries(form))) }, { replace: true })
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
      <!-- Each list keeps to one thing or puts the shelf in an order, and is
           named in the Reader's Locale. The option a URL asked for is marked
           selected on the server, so a reloaded or a sent link draws its lists
           as they were left, with JavaScript or without. Nothing is picked for them: a small
           Catalogue kept to the Locale's Language would look empty, and the
           Stories written in other Languages are theirs to come across. -->
      <div class="lists">
        <p>
          <label class="eyebrow" for="catalogue-language">{{ $t('catalogue.language') }}</label>
          <select id="catalogue-language" name="language" @change="narrow">
            <option value="" :selected="!asked.language">{{ $t('catalogue.anyLanguage') }}</option>
            <option v-for="code in STORY_LANGUAGES" :key="code" :value="code" :selected="code === asked.language">
              {{ languageNamed(code) }}
            </option>
          </select>
        </p>
        <p>
          <label class="eyebrow" for="catalogue-sort">{{ $t('catalogue.sort') }}</label>
          <select id="catalogue-sort" name="sort" @change="narrow">
            <option v-for="sort in CATALOGUE_SORTS" :key="sort" :value="sort" :selected="sort === asked.sort">
              {{ $t(`catalogue.sorts.${sort}`) }}
            </option>
          </select>
        </p>
      </div>
    </form>

    <!-- A page past the last says so and hands back the first; nothing matching
         says so and hands back the whole shelf. Neither is a blank page. -->
    <p v-if="pastTheEnd" class="none">
      {{ $t('catalogue.pastTheEnd', { page: asked.page, pages }) }}
      <NuxtLink :to="toPage(1)">{{ $t('catalogue.firstPageAgain') }}</NuxtLink>
    </p>
    <p v-else-if="!entries.length && narrowed" class="none">
      {{ $t('catalogue.nothingMatches') }}
      <NuxtLink :to="localePath('/catalogue')">{{ $t('catalogue.clear') }}</NuxtLink>
    </p>
    <p v-else-if="!entries.length" class="none">{{ $t('catalogue.none') }}</p>
    <!-- One entry a Story, and the entry is the link: the Catalogue's whole job
         is to hand a Reader the public link they were never sent. It carries no
         count and no rating — nothing here is a score, and nothing counted
         orders it. -->
    <ul v-else class="entries">
      <Entry v-for="story in entries" :key="story.id" :story="story">
        <Gathering :story-id="story.id" :title="story.title" />
      </Entry>
    </ul>

    <!-- The pages, as real links drawn on the server, each carrying the rest of
         what was asked: the first and the last, the one before and the one
         after, and the page the Reader is on with two either side, marked as
         the current one. A link that would lead to the page already on screen
         is left out rather than drawn as a second current page. -->
    <nav v-if="pages > 1 || pastTheEnd" class="pages" :aria-label="$t('catalogue.pages')">
      <ul>
        <li v-if="asked.page > 1">
          <NuxtLink :to="toPage(1)">{{ $t('catalogue.firstPage') }}</NuxtLink>
        </li>
        <li v-if="asked.page > 1">
          <NuxtLink :to="toPage(Math.min(asked.page - 1, pages))" rel="prev">
            {{ $t('catalogue.previousPage') }}
          </NuxtLink>
        </li>
        <li v-for="page in pagesAround(asked.page, pages)" :key="page">
          <NuxtLink
            :to="toPage(page)"
            :aria-label="$t('catalogue.page', { page })"
            :aria-current="page === asked.page ? 'page' : undefined"
            :class="{ current: page === asked.page }"
          >
            {{ page }}
          </NuxtLink>
        </li>
        <li v-if="asked.page < pages">
          <NuxtLink :to="toPage(asked.page + 1)" rel="next">{{ $t('catalogue.nextPage') }}</NuxtLink>
        </li>
        <li v-if="asked.page < pages">
          <NuxtLink :to="toPage(pages)">{{ $t('catalogue.lastPage') }}</NuxtLink>
        </li>
      </ul>
    </nav>
  </main>
</template>

<style scoped>
@import '~/assets/css/folds.css';

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

/* The lists side by side under the search, each its label over its select, as
   many to a row as the width holds. */
.lists {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3) var(--s4);
  margin-block-start: var(--s2);
}

.lists p {
  display: grid;
  gap: var(--s1);
}

/* On a phone each list takes the width, so nothing runs off the edge. */
@media (--phone) {
  .lists p {
    flex: 1 1 100%;
  }

  .lists select {
    inline-size: 100%;
  }
}

/* A hairline between entries and nothing else, as on the list of an Author's own
   Stories: a stack of titles, where a box around each would be five borders
   where one rule does. */
.entries {
  display: grid;
  border-block-start: 1px solid var(--edge);
}

/* The pages, a row of small links under the shelf that wraps rather than runs
   off a phone's edge. The page on screen is the one lit, as the Name is the one
   thing lit in an entry. */
.pages ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s3);
  padding: 0;
  list-style: none;
}

.pages a {
  color: var(--muted);
}

.pages a.current {
  color: var(--paper);
  text-decoration: none;
}
</style>
