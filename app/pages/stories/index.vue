<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const { user: author, clear, fetch: refreshAuthor } = useUserSession()
const { data: stories, refresh } = await useFetch('/api/stories')
const { problem, change, write } = useEditing(refresh)
const { asked, ask, answer } = useConfirming()

// The Name the Author appears under wherever somebody else meets them. It is
// shown here rather than their email, which appears on no screen in the product,
// and it is rewritten here because this is the one page that is theirs rather
// than a Story's. Empty until they list a Story, which is where it is asked for.
const name = ref(author.value?.name ?? '')

/**
 * Writes the Name. The session carries it, so it is read back once the server
 * has resealed it and every place it appears — the Catalogue, their Profile,
 * this header — is showing what was last written.
 */
async function renameSelf() {
  await write(() => send('/api/author', { method: 'PATCH', body: { name: name.value } }))
  await refreshAuthor()
}

const newTitle = ref('')
// English is preselected, so the common case costs the Author no interaction.
const newLanguage = ref<StoryLanguage>('en')

function createStory() {
  const title = newTitle.value
  const language = newLanguage.value
  return change(async () => {
    await $fetch('/api/stories', { method: 'POST', body: { title, language } })
    newTitle.value = ''
  })
}

function renameStory(id: string, title: string) {
  return write(() => send(`/api/stories/${id}`, { method: 'PATCH', body: { title } }))
}

/**
 * A Story goes with everything written in it, none of which the Author named in
 * the act, so it is asked about — by title and by nothing else, which is all the
 * list carries. See `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`.
 */
async function deleteStory(id: string, title: string) {
  if (!await ask(t('stories.confirmDelete', { title }), t('stories.deleteStory'))) return
  return change(() => send(`/api/stories/${id}`, { method: 'DELETE' }))
}

async function signOut() {
  await clear()
  await navigateTo(localePath('/'))
}
</script>

<template>
  <main>
    <header>
      <NuxtLink class="wordmark trail" :to="localePath('/')">Frameline</NuxtLink>
      <h1>{{ $t('stories.heading') }}</h1>
      <form class="who" @submit.prevent="renameSelf">
        <label class="eyebrow" for="author-name">{{ $t('author.name') }}</label>
        <input id="author-name" v-model="name" required :maxlength="AUTHOR_NAME_MAX_LENGTH">
        <button type="submit">{{ $t('author.save') }}</button>
      </form>
      <div class="session">
        <Locales />
        <button type="button" @click="signOut">{{ $t('stories.signOut') }}</button>
      </div>
    </header>

    <!-- A Story is named and its Language declared in the one act, because the
         Language is a fact about the work rather than a setting on it: nothing
         translates a Story, so there is no later moment at which it changes. -->
    <form class="naming" @submit.prevent="createStory">
      <div class="row">
        <p class="titling">
          <label class="eyebrow" for="new-story-title">{{ $t('stories.newTitle') }}</label>
          <input
            id="new-story-title"
            v-model="newTitle"
            required
            :maxlength="STORY_TITLE_MAX_LENGTH"
          >
        </p>
        <p class="written-in">
          <label class="eyebrow" for="new-story-language">{{ $t('stories.newLanguage') }}</label>
          <select id="new-story-language" v-model="newLanguage">
            <option v-for="code in STORY_LANGUAGES" :key="code" :value="code">
              {{ $t(`languages.${code}`) }}
            </option>
          </select>
        </p>
        <button type="submit" class="primary">{{ $t('stories.create') }}</button>
      </div>
    </form>

    <Refusal :problem="problem" />

    <p v-if="!stories?.length" class="none">{{ $t('stories.none') }}</p>
    <!-- One slate a Story: what it is called, and the two things that can be
         done to the name from here. -->
    <ul v-else class="slates">
      <li v-for="story in stories" :key="story.id">
        <NuxtLink class="open" :to="localePath(`/stories/${story.id}`)">
          <span class="visually-hidden">{{ $t('stories.open') }} </span>{{ story.title }}
        </NuxtLink>

        <div class="controls">
          <form @submit.prevent="renameStory(story.id, story.title)">
            <label class="eyebrow" :for="`title-${story.id}`">{{ $t('stories.title') }}</label>
            <input :id="`title-${story.id}`" v-model="story.title" required :maxlength="STORY_TITLE_MAX_LENGTH">
            <button type="submit">{{ $t('stories.rename') }}</button>
          </form>
          <button type="button" class="danger" @click="deleteStory(story.id, story.title)">
            {{ $t('common.delete') }} <span class="visually-hidden">{{ story.title }}</span>
          </button>
        </div>
      </li>
    </ul>

    <Confirmation :asked="asked" @answer="answer" />
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
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  padding-block-end: var(--s3);
  border-block-end: 1px solid var(--edge);
}

/* The product's own name, tracked wider than any label: it is a wordmark and
   the one place the stencil is stretched on purpose. */
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

/* Who the Author is on their own page: the one field about themselves rather
   than about a Story, laid out like the rename beside a title so the two read as
   the same gesture. */
.who {
  grid-column: 1;
  display: grid;
  grid-template-columns: minmax(8rem, 16rem) auto;
  align-items: stretch;
  gap: var(--s1) var(--s2);
  max-inline-size: 24rem;
}

.who label {
  grid-column: 1 / -1;
}

.session {
  grid-column: 2;
  grid-row: 2 / span 2;
  display: grid;
  justify-items: end;
  align-content: center;
  gap: var(--s1);
}

.naming {
  display: grid;
  gap: var(--s2);
  max-inline-size: 44rem;
}

/* The title, the Language and the button read as one line where there is room
   for one, and stack where there is not: naming a Story and saying what it is
   written in are the one act. */
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--s2);
}

.row .titling {
  flex: 1 1 16rem;
}

.row p {
  display: grid;
  gap: var(--s1);
}

.row button {
  flex: none;
}

.none {
  color: var(--muted);
  max-inline-size: 44ch;
}

/* A hairline between slates and nothing else: the list is a stack of names, and
   a box around each would be five borders where one rule does. */
.slates {
  display: grid;
  border-block-start: 1px solid var(--edge);
}

.slates li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--s3) var(--s4);
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

.controls {
  display: flex;
  align-items: end;
  gap: var(--s2);
}

.controls form {
  display: grid;
  grid-template-columns: minmax(8rem, 16rem) auto;
  /* Stretched, so the Rename button ends where the field does and Delete beside
     it sits on the same line rather than a few pixels below. */
  align-items: stretch;
  gap: var(--s1) var(--s2);
}

.controls label {
  grid-column: 1 / -1;
}

@media (max-width: 44rem) {
  .slates li {
    grid-template-columns: minmax(0, 1fr);
  }

  .controls {
    flex-wrap: wrap;
  }

  .controls form {
    flex: 1;
  }
}
</style>
