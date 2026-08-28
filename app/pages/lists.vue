<script setup lang="ts">
// An Author's own shelves: Favourites, which every account has, and the Lists
// they have written themselves. Signed in, because a List is one Author's and is
// read by nobody else — there is no address at which somebody else's is served,
// and nothing on a Profile leads here.
definePageMeta({ middleware: 'authenticated' })

const localePath = useLocalePath()
const { shelves, refresh } = useLists()
const { problem, change, write } = useEditing(refresh)

const newTitle = ref('')

function createList() {
  const title = newTitle.value
  return change(async () => {
    await send('/api/lists', { method: 'POST', body: { title } })
    newTitle.value = ''
  })
}

function renameList(id: string, title: string) {
  return write(() => send(`/api/lists/${id}`, { method: 'PATCH', body: { title } }))
}

/**
 * A List goes and the Stories in it stay Stories: a List is one Author's
 * arrangement of work that is not theirs, so there is nothing of anybody's to
 * lose and nothing to ask about first — see
 * `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`, which names the two
 * acts that do ask.
 */
function deleteList(id: string) {
  return change(() => send(`/api/lists/${id}`, { method: 'DELETE' }))
}

function takeOut(listId: string, storyId: string) {
  return change(() => send(`/api/lists/${listId}/stories/${storyId}`, { method: 'DELETE' }))
}

// Favourites has no title, so the word it is shown under is the interface's own.
const { t } = useI18n()
const titleOf = (title: string | null) => title ?? t('lists.favourites')
</script>

<template>
  <main>
    <header>
      <NuxtLink class="wordmark trail" :to="localePath('/stories')">Frameline</NuxtLink>
      <h1>{{ $t('lists.heading') }}</h1>
      <p class="line">{{ $t('lists.line') }}</p>
      <Locales />
    </header>

    <!-- A List is written here and filled from wherever a Story is met, which is
         the Catalogue: the way there is beside the form, because an Author who
         has just written a shelf has nothing to put on it yet. -->
    <form class="naming" @submit.prevent="createList">
      <label class="eyebrow" for="new-list-title">{{ $t('lists.newTitle') }}</label>
      <input id="new-list-title" v-model="newTitle" required :maxlength="LIST_TITLE_MAX_LENGTH">
      <button type="submit" class="primary">{{ $t('lists.create') }}</button>
    </form>

    <p class="finding">
      <NuxtLink :to="localePath('/catalogue')">{{ $t('lists.toCatalogue') }}</NuxtLink>
    </p>

    <Refusal :problem="problem" />

    <!-- One shelf a List, Favourites first. It carries no title to rewrite and
         no way to be deleted, so the two gestures beside every other title are
         not drawn on it: the control that would say no is the control that is
         not there. -->
    <section v-for="list in shelves" :key="list.id" class="shelf">
      <h2>{{ titleOf(list.title) }}</h2>

      <div v-if="list.title !== null" class="controls">
        <form @submit.prevent="renameList(list.id, list.title!)">
          <label class="eyebrow" :for="`title-${list.id}`">{{ $t('lists.title') }}</label>
          <input
            :id="`title-${list.id}`"
            v-model="list.title"
            required
            :maxlength="LIST_TITLE_MAX_LENGTH"
          >
          <button type="submit">{{ $t('lists.rename') }}</button>
        </form>
        <button type="button" class="danger" @click="deleteList(list.id)">
          {{ $t('common.delete') }}
          <span class="visually-hidden">{{ titleOf(list.title) }}</span>
        </button>
      </div>

      <p v-if="!list.stories.length" class="none">{{ $t('lists.empty') }}</p>
      <!-- The same entries the Catalogue hands over, gathered by the Author who
           put them here rather than by date. -->
      <ul v-else class="entries">
        <Entry v-for="story in list.stories" :key="story.id" :story="story">
          <button type="button" @click="takeOut(list.id, story.id)">
            {{ $t('lists.take') }}
            <span class="visually-hidden">{{ story.title }} — {{ titleOf(list.title) }}</span>
          </button>
        </Entry>
      </ul>
    </section>
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

/* The product's own name, tracked wider than any label, as it is on the
   Catalogue and on an Author's own Stories: three lists, one room. */
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
  max-inline-size: 60ch;
}

/* The child component's root carries this page's scope, so the switcher is
   placed from here rather than wrapped in a box that exists to be placed. */
.locales {
  grid-column: 2;
  grid-row: 2 / span 2;
}

.naming {
  display: grid;
  grid-template-columns: minmax(0, 24rem) auto;
  align-items: stretch;
  gap: var(--s1) var(--s2);
}

.naming label {
  grid-column: 1 / -1;
}

.finding {
  font-size: 0.875rem;
}

.shelf {
  display: grid;
  gap: var(--s3);
}

h2 {
  font-family: var(--display);
  font-size: 1.25rem;
}

/* What can be done to the shelf itself, on one line above what is on it. */
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--s2) var(--s3);
}

.controls form {
  display: grid;
  grid-template-columns: minmax(0, 16rem) auto;
  gap: var(--s1) var(--s2);
}

.controls label {
  grid-column: 1 / -1;
}

.none {
  color: var(--muted);
  max-inline-size: 60ch;
}

/* A box around each entry would be five borders where one rule does. */
.entries {
  display: grid;
  border-block-start: 1px solid var(--edge);
}
</style>
