<script setup lang="ts">
// The document says which language its chrome is read in. Nothing declared one
// before this, so a screen reader announced every page in whatever voice it was
// already using.
const { locale } = useI18n()

useHead({ htmlAttrs: { lang: locale } })
</script>

<template>
  <NuxtPage />
</template>
