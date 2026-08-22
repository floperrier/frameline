<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { user: author, clear } = useUserSession()
const { data: stories, refresh } = await useFetch('/api/stories')
const { problem, change, write } = useEditing(refresh)

const newTitle = ref('')

function createStory() {
  const title = newTitle.value
  return change(async () => {
    await $fetch('/api/stories', { method: 'POST', body: { title } })
    newTitle.value = ''
  })
}

function renameStory(id: string, title: string) {
  return write(() => send(`/api/stories/${id}`, { method: 'PATCH', body: { title } }))
}

function deleteStory(id: string, title: string) {
  if (!confirm(`Delete “${title}”? This cannot be undone.`)) return
  return change(() => send(`/api/stories/${id}`, { method: 'DELETE' }))
}

async function signOut() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <main>
    <header>
      <NuxtLink class="wordmark trail" to="/">Frameline</NuxtLink>
      <h1>Stories</h1>
      <p class="who">{{ author?.email }}</p>
      <button type="button" @click="signOut">Sign out</button>
    </header>

    <form class="naming" @submit.prevent="createStory">
      <label class="eyebrow" for="new-story-title">Title of a new Story</label>
      <div class="row">
        <input id="new-story-title" v-model="newTitle" required :maxlength="STORY_TITLE_MAX_LENGTH">
        <button type="submit" class="primary">Create Story</button>
      </div>
    </form>

    <p v-if="problem" role="alert">{{ problem }}</p>

    <p v-if="!stories?.length" class="none">
      No Stories yet. Name one above, and it opens ready for its first Scene.
    </p>
    <!-- One slate a Story: what it is called, and the two things that can be
         done to the name from here. -->
    <ul v-else class="slates">
      <li v-for="story in stories" :key="story.id">
        <NuxtLink class="open" :to="`/stories/${story.id}`">
          <span class="visually-hidden">Open </span>{{ story.title }}
        </NuxtLink>

        <div class="controls">
          <form @submit.prevent="renameStory(story.id, story.title)">
            <label class="eyebrow" :for="`title-${story.id}`">Title</label>
            <input :id="`title-${story.id}`" v-model="story.title" required :maxlength="STORY_TITLE_MAX_LENGTH">
            <button type="submit">Rename</button>
          </form>
          <button type="button" class="danger" @click="deleteStory(story.id, story.title)">
            Delete <span class="visually-hidden">{{ story.title }}</span>
          </button>
        </div>
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

.who {
  grid-column: 1;
  color: var(--muted);
  font-family: var(--data);
  font-size: 0.75rem;
}

header button {
  grid-column: 2;
  grid-row: 2 / span 2;
  align-self: center;
}

.naming {
  display: grid;
  gap: var(--s2);
  max-inline-size: 34rem;
}

.row {
  display: flex;
  gap: var(--s2);
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
