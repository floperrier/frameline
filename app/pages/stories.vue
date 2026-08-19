<script setup lang="ts">
definePageMeta({ middleware: 'authenticated' })

const { user, clear } = useUserSession()
const { data: stories } = await useFetch('/api/stories')

async function signOut() {
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <main>
    <header>
      <h1>Stories</h1>
      <p>{{ user?.email }}</p>
      <button type="button" @click="signOut">Sign out</button>
    </header>

    <p v-if="!stories?.length">No Stories yet.</p>
    <ul v-else>
      <li v-for="story in stories" :key="story.id">{{ story.title }}</li>
    </ul>
  </main>
</template>
