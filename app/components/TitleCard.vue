<script setup lang="ts">
/**
 * The title card: the Story presented once, at the head of the reel, before the
 * Reading draws anything — see `docs/adr/0063-a-story-opens-on-its-title-card.md`.
 * Drawn by the reading page and by the embed, so a Reader meets the same card
 * wherever the Story is read; each page puts its own around it.
 */
const { id, story, begun = false, framed = false } = defineProps<{
  /** The Story's own id, which the Path this browser kept is kept under. */
  id: string
  story: StoryAtItsLink
  /** Whether the Reading has started, which takes the press away. */
  begun?: boolean
  /**
   * Whether the card is drawn inside somebody else's page, where a link that
   * navigated would take the frame away from the Story: there, the Author's Name
   * opens in a tab of its own. See
   * `docs/adr/0068-a-story-plays-inside-another-page.md`.
   */
  framed?: boolean
}>()

defineEmits<{ begin: [] }>()

const localePath = useLocalePath()

/**
 * `Resume` rather than `Begin` where this browser kept a Path for this Story,
 * read the same way the Reading itself reads it back — see `app/utils/kept.ts`
 * — so the one word said before the frame is on screen already tells a
 * returning Reader they are not starting over.
 */
const resuming = ref(false)

onMounted(() => {
  resuming.value = Boolean(keptReading(id, story))
})
</script>

<template>
  <!-- The frame the Story was presented by on the shelf, drawn as wide as the
       column the Reading will stand in, because nothing plays under it until
       the Reader asks. Sixteen by nine, the shape a full beat most often lands
       in on a desk, cropped around the point the Author pressed. Decorative
       above the title that names the work — the Shot itself, with its
       Description, is met in the Reading. -->
  <img
    v-if="story.cover"
    class="cover"
    :src="story.cover.image"
    :style="{ objectPosition: cropPosition(story.cover) }"
    alt=""
  >
  <p class="eyebrow">{{ $t('read.eyebrow') }}</p>
  <!-- The Story's own title, announced in the Story's Language while the
       line above it stays in the Reader's. -->
  <h1 :lang="story.language">{{ story.title }}</h1>

  <!-- What the Author wrote to present the Story, presented where it is
       opened as well as on a shelf and in the link's card. Plain text with
       its line breaks kept: only a Shot's text is formatted. -->
  <p v-if="story.synopsis" class="synopsis" :lang="story.language">{{ story.synopsis }}</p>

  <!-- Signed where the work is named, as an entry on a shelf is, and the
       Name leads to the Author. An Author who has never written a Name signs
       nothing here, which is what a shelf does rather than fall back to the one
       thing an account always has. -->
  <p v-if="story.authorName" class="eyebrow">
    {{ $t('catalogue.by') }}
    <NuxtLink
      class="who"
      :to="localePath(`/profile/${story.authorId}`)"
      :target="framed ? '_blank' : undefined"
      :rel="framed ? 'noopener' : undefined"
    >
      {{ story.authorName }}
    </NuxtLink>
  </p>

  <!-- The one press every Story is given before it plays anything, and for a
       Story that carries a Sound the consent as well: consenting to sound is
       consenting to this one, not to sound in general. -->
  <button v-if="!begun" type="button" class="beginning primary" @click="$emit('begin')">
    {{ resuming ? $t('read.resume') : $t('read.begin') }}
  </button>
</template>

<style scoped>
.cover {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  margin-block-end: var(--s2);
  object-fit: cover;
  border: 1px solid var(--edge);
  border-radius: var(--machined);
  background: var(--bench);
}

h1 {
  font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem);
}

/* Quiet and measured, as it is on a shelf: what the eye lands on is the title,
   and the Synopsis is what it reads next rather than instead. */
.synopsis {
  color: var(--muted);
  max-inline-size: 60ch;
  white-space: pre-line;
}

/* The one control the title card carries: the press that starts the Reading,
   and for a Story that carries a Sound the gesture a browser requires before
   anything may play. `.primary` because it is the one action the card is for —
   there is nothing else to press until it has been. At its own width, where the
   column would stretch it. */
.beginning {
  justify-self: start;
  margin-block-start: var(--s3);
  padding-inline: var(--s4);
}

/* The Name is the one thing in the line that leads to a person, so it is the one
   thing lit: the words around it are stencil and stay muted, as on a shelf. */
.who {
  color: var(--paper);
}
</style>
