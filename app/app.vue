<script setup lang="ts">
// The document says which language its chrome is read in. Nothing declared one
// before this, so a screen reader announced every page in whatever voice it was
// already using. A Story's own Language is a different fact and is declared
// separately, on the region holding the Story's text — see
// `docs/adr/0013-the-interfaces-locale-is-not-the-storys-language.md`.
const { locale } = useI18n()

useHead({ htmlAttrs: { lang: locale } })
</script>

<template>
  <NuxtPage />
</template>
