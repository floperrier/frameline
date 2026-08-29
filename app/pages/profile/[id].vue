<script setup lang="ts">
// An Author as everyone else meets them: their Name, their avatar, and what they
// have Listed. Read with or without an account, because this is where a Name in
// the Catalogue leads and the Catalogue is read by whoever turns up.
//
// Nothing here is the account: an Author's email appears on no screen in the
// product, and what an Author has said about other people's Stories is not
// gathered up — see the glossary's Profile.
const id = useRoute().params.id as string
const { t } = useI18n()
const localePath = useLocalePath()
const { data: author, error } = await useFetch(`/api/profile/${id}`)

// An id nobody has is a not-found like every other absent thing.
if (error.value) throw createError({ ...error.value, fatal: true })

// An Author who has never written a Name has nothing linking here, but the
// address can still be typed: they are shown as an Author rather than as a gap.
const name = computed(() => author.value?.name || t('profile.unnamed'))
</script>

<template>
  <main>
    <header>
      <NuxtLink class="wordmark trail" :to="localePath('/catalogue')">Frameline</NuxtLink>
      <!-- The avatar is the URL the provider handed back, served by the provider:
           no bytes of it are held here, see
           `docs/adr/0026-an-avatar-is-a-url-not-bytes.md`. It is decorative beside
           the Name it sits against, so it is announced by neither. -->
      <img v-if="author?.avatar" class="avatar" :src="author.avatar" alt="" referrerpolicy="no-referrer">
      <h1>{{ name }}</h1>
      <p class="line">{{ $t('profile.line', { name }) }}</p>
      <Locales />
    </header>

    <p v-if="!author?.stories.length" class="none">{{ $t('profile.none', { name }) }}</p>
    <!-- The same entries the Catalogue hands over, gathered by Author rather
         than by date, and the Listed ones alone: everything else this Author has
         written is theirs. -->
    <ul v-else class="entries">
      <Entry v-for="story in author.stories" :key="story.id" :story="story" />
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

/* The avatar sits in a column of its own beside the Name and the line, so the
   two read as one signature rather than as a picture with text under it. */
header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  padding-block-end: var(--s3);
  border-block-end: 1px solid var(--edge);
}

.wordmark {
  grid-column: 1 / -1;
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-decoration: none;
}

.wordmark:hover {
  color: var(--paper);
}

.avatar {
  grid-column: 1;
  grid-row: 2 / span 2;
  align-self: center;
  inline-size: 4rem;
  block-size: 4rem;
  border-radius: 50%;
  object-fit: cover;
  background: var(--edge);
}

h1 {
  grid-column: 2;
  text-transform: uppercase;
}

.line {
  grid-column: 2;
  color: var(--muted);
  max-inline-size: 52ch;
}

.locales {
  grid-column: 3;
  grid-row: 2 / span 2;
}

.none {
  color: var(--muted);
  max-inline-size: 44ch;
}

/* A hairline between entries and nothing else, as in the Catalogue. */
.entries {
  display: grid;
  border-block-start: 1px solid var(--edge);
}
</style>
