<script setup lang="ts">
// The way in, and the landing page shows it twice: once beside the pitch and
// once at the foot, so somebody convinced by the way down does not scroll back
// up to act on it. One component, because two copies of the doors are two
// places for them to drift apart.
//
// An Author who already has a session is never offered a door — they are shown
// the one thing they came for, their own Stories.
const { loggedIn } = useUserSession()
const localePath = useLocalePath()

const { failed = false } = defineProps<{ failed?: boolean }>()
</script>

<template>
  <NuxtLink v-if="loggedIn" class="enter primary" :to="localePath('/stories')">
    {{ $t('landing.yourStories') }}
  </NuxtLink>
  <div v-else class="doors">
    <p v-if="failed" role="alert">{{ $t('landing.signInFailed') }}</p>
    <p class="eyebrow">{{ $t('landing.signInToWrite') }}</p>
    <a class="door" href="/auth/github">{{ $t('landing.signInWithGitHub') }}</a>
    <a class="door" href="/auth/google">{{ $t('landing.signInWithGoogle') }}</a>
  </div>
</template>

<style scoped>
/* Both doors are the size of a thing worth pressing; the one an Author with a
   session already has takes the interface's primary treatment from the
   stylesheet rather than restating it. */
.enter,
.door {
  padding: var(--s2) var(--s4);
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 150ms, background-color 150ms;
}

.door {
  color: var(--paper);
}

.doors {
  display: grid;
  justify-items: start;
  gap: var(--s2);
}

.door:hover {
  border-color: var(--light);
  background: color-mix(in oklab, var(--light) 14%, transparent);
}
</style>
