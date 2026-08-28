<script setup lang="ts">
/**
 * One Story as it is met before it is opened: its title, which is the link to
 * the Reading, and what is said about it on the shelf — the Author who wrote it,
 * the Language it is written in and the day it was published.
 *
 * Drawn by every surface that hands over other people's work — the Catalogue, a
 * Profile, and an Author's own Lists — so they are all the same shelf, seen by
 * date, by Author and by whoever gathered it. The byline is drawn where there is
 * one to draw: a Profile is already one Author's, so repeating the Name under
 * every title there would be the page signing itself.
 *
 * What can be done with the Story from the shelf it is on is the page's to say
 * and not the entry's: the slot is where a surface puts its own gesture —
 * gathering it on the Catalogue, taking it off a List — and a page passing none
 * draws a row with nothing but the work on it.
 */
const { story } = defineProps<{
  story: {
    id: string
    title: string
    language: string
    publishedAt: string | null
    authorId?: string
    authorName?: string | null
  }
}>()

const { published, languageNamed } = useEntries()
const localePath = useLocalePath()
</script>

<template>
  <li>
    <NuxtLink class="open" :to="`/read/${story.id}`" :lang="story.language">
      {{ story.title }}
    </NuxtLink>
    <p class="facts">
      <!-- The Name leads to the Author rather than to the work: one entry, two
           ways out of it. The link is the interface talking, so it carries the
           Locale — the public link to the Story is the one address that does not,
           see `docs/adr/0012-the-public-link-carries-no-locale.md`. -->
      <span v-if="story.authorId && story.authorName" class="eyebrow">
        {{ $t('catalogue.by') }}
        <NuxtLink class="who" :to="localePath(`/profile/${story.authorId}`)">
          {{ story.authorName }}
        </NuxtLink>
      </span>
      <span class="eyebrow">{{ languageNamed(story.language) }}</span>
      <time v-if="story.publishedAt" class="eyebrow" :datetime="story.publishedAt">
        {{ published.format(new Date(story.publishedAt)) }}
      </time>
    </p>
    <div v-if="$slots.default" class="doing">
      <slot />
    </div>
  </li>
</template>

<style scoped>
li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  padding-block: var(--s4);
  border-block-end: 1px solid var(--edge);
}

.open {
  font-family: var(--display);
  font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2rem);
  font-weight: 600;
  line-height: 1.1;
  color: var(--paper);
  text-decoration: none;
}

.open:hover {
  color: var(--light);
}

/* What is said about a Story before it is opened: who wrote it, the Language it
   is written in and the day it was published, stencilled rather than written
   out, because they are labels on the reel and not part of the work. */
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s3);
}

/* What the page can do with this Story from here, under the title rather than
   beside it: the facts about the work keep the line they are on. */
.doing {
  grid-column: 1 / -1;
}

/* The Name is the one thing in the row that leads anywhere, so it is the one
   thing lit: the labels around it are stencil and stay muted. */
.who {
  color: var(--paper);
}

@media (max-width: 44rem) {
  li {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
