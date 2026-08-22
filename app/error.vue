<script setup lang="ts">
/**
 * What is shown when a page cannot be. A Reader who opens a link to a Story that
 * was never published, or has been unpublished since, lands here, so it is
 * chrome and belongs in the language of whoever is reading it — the refusal
 * itself cannot be, because an HTTP reason phrase is sanitized down to ASCII on
 * the way out and would reach the page with its accents stripped.
 *
 * Only two things are said: the Story is not there, or something else went
 * wrong. Nothing is guessed about which Story, because a link to a Story that is
 * gone must not say a Story was ever there.
 */
defineProps<{ error: { statusCode: number } }>()

// The error page stands in for the whole app, so it says which language it is in
// itself: `app.vue` is not what rendered it.
const { locale } = useI18n()

useHead({ htmlAttrs: { lang: locale } })
</script>

<template>
  <main class="room">
    <div class="gone">
      <p class="eyebrow">{{ error.statusCode }}</p>
      <h1>{{ error.statusCode === 404 ? $t('refusals.noSuch.story') : $t('error.wentWrong') }}</h1>
      <NuxtLink class="trail" to="/">{{ $t('error.home') }}</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.gone {
  display: grid;
  justify-items: start;
  align-content: center;
  gap: var(--s3);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
}

h1 {
  font-size: clamp(1.75rem, 1.3rem + 1.8vw, 2.5rem);
}
</style>
