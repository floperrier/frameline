<script setup lang="ts">
/**
 * The language the interface is read in, offered as the ones it is not currently
 * read in. A link and not a switch, because the Locale is in the URL — see
 * `docs/adr/0012-the-public-link-carries-no-locale.md` — so the control can be
 * the address it leads to, which is also the address an Author can send someone.
 *
 * Never drawn on the Reader's page: that route has no localized counterpart to
 * link to, and a language control beside an untranslated Story reads as a
 * promise to translate the Story.
 */
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const others = computed(() => locales.value.filter(other => other.code !== locale.value))
</script>

<template>
  <p class="locales">
    <span class="eyebrow visually-hidden">{{ $t('locale.label') }}</span>
    <NuxtLink
      v-for="other in others"
      :key="other.code"
      class="trail"
      :lang="other.code"
      :to="switchLocalePath(other.code)"
    >
      {{ other.name }}
    </NuxtLink>
  </p>
</template>

<style scoped>
/* The one control on the page that is about the page rather than about the
   Story, so it wears the trail's own treatment and nothing louder. */
.locales {
  display: flex;
  gap: var(--s2);
  font-size: 0.75rem;
}
</style>
