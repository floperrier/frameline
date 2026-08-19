<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { user: author, clear } = useUserSession()
const { data: stories, refresh } = await useFetch('/api/stories')

const newTitle = ref('')
const problem = ref('')

/**
 * Runs a change against the server, surfacing why it was refused. The list is
 * refetched either way: the rename field edits the fetched Story in place, so a
 * refused rename would otherwise sit on screen as though it had persisted.
 */
async function change(act: () => Promise<unknown>) {
  problem.value = ''
  try {
    await act()
  }
  catch (error) {
    problem.value = (error as { statusMessage?: string }).statusMessage
      ?? 'That did not work. Please try again.'
  }
  finally {
    await refresh()
  }
}

function createStory() {
  const title = newTitle.value
  return change(async () => {
    await $fetch('/api/stories', { method: 'POST', body: { title } })
    newTitle.value = ''
  })
}

/**
 * ponytail: Nuxt types `$fetch` per route, and matching a URL that is not a
 * literal against a route carrying a path parameter overflows TypeScript
 * (TS2321). Story mutations therefore go through `$fetch` untyped. Their
 * responses are unused — the list is refetched — so only argument types are
 * lost. Drop this the day Nitro's route matcher stops recursing.
 */
const sendToStory = $fetch as unknown as
  (url: string, options: { method: string, body?: unknown }) => Promise<unknown>

function renameStory(id: string, title: string) {
  return change(() => sendToStory(`/api/stories/${id}`, { method: 'PATCH', body: { title } }))
}

function deleteStory(id: string, title: string) {
  if (!confirm(`Delete “${title}”? This cannot be undone.`)) return
  return change(() => sendToStory(`/api/stories/${id}`, { method: 'DELETE' }))
}

async function signOut() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <main>
    <header>
      <h1>Stories</h1>
      <p>{{ author?.email }}</p>
      <button type="button" @click="signOut">Sign out</button>
    </header>

    <form @submit.prevent="createStory">
      <label for="new-story-title">Title of a new Story</label>
      <input id="new-story-title" v-model="newTitle" required :maxlength="STORY_TITLE_MAX_LENGTH">
      <button type="submit">Create Story</button>
    </form>

    <p v-if="problem" role="alert">{{ problem }}</p>

    <p v-if="!stories?.length">No Stories yet.</p>
    <ul v-else>
      <li v-for="story in stories" :key="story.id">
        <form @submit.prevent="renameStory(story.id, story.title)">
          <label :for="`title-${story.id}`">Title</label>
          <input :id="`title-${story.id}`" v-model="story.title" required :maxlength="STORY_TITLE_MAX_LENGTH">
          <button type="submit">Rename</button>
        </form>
        <button type="button" @click="deleteStory(story.id, story.title)">
          Delete <span class="visually-hidden">{{ story.title }}</span>
        </button>
      </li>
    </ul>
  </main>
</template>

<style>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
