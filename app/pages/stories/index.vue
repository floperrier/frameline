<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { user: author, clear } = useUserSession()
const { data: stories, refresh } = await useFetch('/api/stories')
const { problem, change } = useEditing(refresh)

const newTitle = ref('')

function createStory() {
  const title = newTitle.value
  return change(async () => {
    await $fetch('/api/stories', { method: 'POST', body: { title } })
    newTitle.value = ''
  })
}

function renameStory(id: string, title: string) {
  return change(() => send(`/api/stories/${id}`, { method: 'PATCH', body: { title } }))
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
        <NuxtLink :to="`/stories/${story.id}`">Open {{ story.title }}</NuxtLink>
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
