<script setup lang="ts">
/**
 * The Genres a Story is filed under, chosen from the closed set: one checkbox a
 * Genre, named in the Author's Locale, and no more than `STORY_GENRES_MAX`
 * checked — once that many are, the others are disabled until one is let go, so
 * an Author is stopped before naming a third rather than refused after. The
 * server holds the same limit — see `readStoryGenres`.
 *
 * Drawn wherever the listing asks for Genres or lets them be changed, so the two
 * cannot offer different sets. `keepOne` is the panel of a Listed Story, whose
 * last Genre cannot be let go: a Listed Story is filed under one at least.
 */
const { legend, keepOne = false } = defineProps<{
  legend: string
  keepOne?: boolean
}>()

const chosen = defineModel<string[]>({ required: true })

const { genreNamed } = useEntries()

/** One Genre taken or let go, the rest kept in the order the set lists them. */
function toggle(code: string, checked: boolean) {
  const kept = new Set(chosen.value)
  if (checked) kept.add(code)
  else kept.delete(code)
  chosen.value = STORY_GENRES.filter(genre => kept.has(genre))
}

function held(code: string) {
  const on = chosen.value.includes(code)
  return on
    ? keepOne && chosen.value.length === 1
    : chosen.value.length >= STORY_GENRES_MAX
}
</script>

<template>
  <fieldset class="genres">
    <legend class="eyebrow">{{ legend }}</legend>
    <div class="set">
      <label v-for="code in STORY_GENRES" :key="code">
        <input
          type="checkbox"
          name="genres"
          :value="code"
          :checked="chosen.includes(code)"
          :disabled="held(code)"
          @change="toggle(code, ($event.target as HTMLInputElement).checked)"
        >
        {{ genreNamed(code) }}
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.genres {
  display: grid;
  gap: var(--s2);
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: none;
}

/* The set in as many columns as the panel holds, each Genre a box and its name. */
.set {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--s1) var(--s3);
}

.set label {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.set label:has(:disabled) {
  color: var(--muted);
}
</style>
