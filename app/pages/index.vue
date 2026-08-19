<script setup lang="ts">
const { loggedIn } = useUserSession()
</script>

<template>
  <main>
    <h1>Frameline</h1>
    <p>An editor for interactive narrative works that speaks the grammar of cinema.</p>

    <NuxtLink v-if="loggedIn" to="/stories">Your Stories</NuxtLink>
    <template v-else>
      <a href="/auth/github">Sign in with GitHub</a>
      <a href="/auth/google">Sign in with Google</a>
    </template>
  </main>
</template>
