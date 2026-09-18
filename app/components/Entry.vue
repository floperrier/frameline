<script setup lang="ts">
/**
 * One Story as it is met before it is opened: its title, which is the link to
 * the Reading, the Synopsis its Author wrote for whoever is deciding whether to
 * read it, and what is said about it on the shelf — the Author who wrote it, the
 * Language it is written in and the day it was published.
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
    synopsis?: string
    publishedAt: string | null
    authorId?: string
    authorName?: string | null
    /** The address of the Image the Story is presented by, or none. */
    cover?: string | null
  }
}>()

const { published, languageNamed } = useEntries()
const localePath = useLocalePath()
</script>

<template>
  <li :class="{ covered: story.cover }">
    <!-- The frame the Story is presented by: its Cover, or its Opening Scene's
         first Image standing in — see
         `docs/adr/0040-a-story-is-presented-by-one-of-its-own-frames.md`.
         Decorative beside the title that names the work, so it says nothing of
         its own: a Reader who cannot see it meets the Shot's Description when
         they read. -->
    <img v-if="story.cover" class="cover" :src="story.cover" alt="" loading="lazy">
    <NuxtLink class="open" :to="`/read/${story.id}`" :lang="story.language">
      {{ story.title }}
    </NuxtLink>
    <!-- The Synopsis in the Author's own words, so it is set in the Language the
         work is written in rather than in the Locale the shelf is read in. A
         Story nobody wrote one for draws nothing here: the shelf invents no
         lines out of the Story's own text. -->
    <p v-if="story.synopsis" class="synopsis" :lang="story.language">{{ story.synopsis }}</p>
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
@import '~/assets/css/folds.css';

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--s2) var(--s4);
  padding-block: var(--s4);
  border-block-end: 1px solid var(--edge);
}

/* A Story with a frame to show is met by it first: the Cover stands at the head
   of the row down its whole height, and the words are set beside it. The shelf
   is otherwise unchanged, so a Story with no Image sits on the same lines as one
   with — pictures and words in one column, never two shelves. */
li.covered {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.cover {
  grid-row: 1 / span 3;
  align-self: start;
  inline-size: 7.5rem;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

li.covered .synopsis,
li.covered .doing {
  grid-column: 2 / -1;
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

/* The few lines the Author wrote to present the work, between the title and the
   labels on the reel. Quiet and measured, like every other sentence on a shelf:
   what the eye lands on is the title, and the Synopsis is what it reads next
   rather than instead. The interface's own face, because a shelf is the
   interface talking about a work and not the work — the reading face is the
   Reading's alone. */
.synopsis {
  grid-column: 1;
  color: var(--muted);
  max-inline-size: 60ch;
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

@media (--phone) {
  li {
    grid-template-columns: minmax(0, 1fr);
  }

  li.covered {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .cover {
    inline-size: 5rem;
  }
}
</style>
