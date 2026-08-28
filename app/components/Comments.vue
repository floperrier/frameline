<script setup lang="ts">
/**
 * What has been said under one Story, and the form that says the next thing.
 *
 * It sits at the end of the reading page, under the Reading rather than over it:
 * a Comment answers a Story, so whoever is here to read one meets the work
 * first. Comments themselves are read by anybody, account or none — a Reading
 * asks nothing of whoever opens the link and neither does this.
 *
 * A Comment is of the Story whole. There is no Scene and no Shot on this
 * component, in the body it sends or in the row it writes, so the thing the
 * glossary refuses cannot be reached from here — see
 * `docs/adr/0027-a-comment-is-said-of-the-whole-story.md`.
 */
const { storyId } = defineProps<{ storyId: string }>()

const { t } = useI18n()
const { loggedIn, user } = useUserSession()
const localePath = useLocalePath()
const { published } = useEntries()

const { data: said, refresh } = await useFetch(`/api/stories/${storyId}/comments`)

// The same refusal surface the bench uses, so a Comment refused says so in the
// server's own words and in the language the request was made in. The read back
// is the whole list: what a write leaves behind is a Comment that was not on
// screen, so there is nothing typed for the refetch to take away.
const { problem, change } = useEditing(refresh)

const writing = ref('')

async function write() {
  const text = writing.value

  if (await change(() => send(
    `/api/stories/${storyId}/comments`, { method: 'POST', body: { text } }))) {
    writing.value = ''
  }
}

function remove(id: string) {
  return change(() => send(`/api/comments/${id}`, { method: 'DELETE' }))
}

/**
 * Whether this Author may take one Comment away. Two people may: whoever wrote
 * it, and the Author of the Story it stands under, who answers for what is said
 * on their own page. The server refuses on exactly these two grounds, so the
 * gesture is drawn where it would work rather than decided here.
 */
function deletable(authorId: string) {
  return loggedIn.value
    && (user.value?.id === authorId || user.value?.id === said.value?.storyAuthorId)
}

/** An Author who has never written a Name is shown as an Author, as a Profile shows them. */
function nameOf(name: string | null) {
  return name || t('profile.unnamed')
}
</script>

<template>
  <section class="comments">
    <h2 class="eyebrow">{{ $t('comments.heading') }}</h2>

    <p v-if="!said?.comments.length" class="none">{{ $t('comments.none') }}</p>
    <!-- Oldest first, the way a conversation is read. Nothing is counted and
         nothing is scored: the order is the order they were written in. -->
    <ol v-else class="said">
      <li v-for="comment in said.comments" :key="comment.id">
        <p class="who">
          <!-- The Name leads to the Author, as it does from an entry in the
               Catalogue: one Comment, and one way out of it. -->
          <NuxtLink class="name" :to="localePath(`/profile/${comment.authorId}`)">
            {{ nameOf(comment.authorName) }}
          </NuxtLink>
          <time class="eyebrow" :datetime="comment.createdAt">
            {{ published.format(new Date(comment.createdAt)) }}
          </time>
          <button
            v-if="deletable(comment.authorId)"
            type="button"
            class="danger"
            @click="remove(comment.id)"
          >
            {{ $t('comments.delete', { name: nameOf(comment.authorName) }) }}
          </button>
        </p>
        <p class="text">{{ comment.text }}</p>
      </li>
    </ol>

    <!-- A Comment is signed, so writing one takes an account. Somebody without
         one is told that where the form would have been, and is left on the
         Story: nothing here navigates them away from what they came to read. -->
    <form v-if="loggedIn" class="write" @submit.prevent="write">
      <label class="eyebrow" for="comment-text">{{ $t('comments.write') }}</label>
      <textarea
        id="comment-text"
        v-model="writing"
        rows="4"
        required
        :maxlength="COMMENT_MAX_LENGTH"
      />
      <p class="note">{{ $t('comments.note') }}</p>
      <button type="submit" class="primary">{{ $t('comments.send') }}</button>
    </form>
    <div v-else class="none">
      <p>{{ $t('comments.signedOut') }}</p>
      <Doors />
    </div>

    <Refusal :problem="problem" />
  </section>
</template>

<style scoped>
/* The same column the frame above it is held to, so the Story and what is said
   about it read as one page rather than two. */
.comments {
  display: grid;
  gap: var(--s4);
  inline-size: min(100%, 46rem);
  margin-inline: auto;
  padding-block-start: var(--s5);
  border-block-start: 1px solid var(--edge);
}

.none {
  display: grid;
  gap: var(--s3);
  justify-items: start;
  color: var(--muted);
  max-inline-size: 52ch;
}

/* A hairline between Comments and nothing else, as between entries on a shelf. */
.said {
  display: grid;
}

.said li {
  display: grid;
  gap: var(--s2);
  padding-block: var(--s4);
  border-block-end: 1px solid var(--edge);
}

/* The signature: who wrote it, when, and — where it is theirs to take away —
   the one gesture that removes it. */
.who {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2) var(--s3);
}

.name {
  color: var(--paper);
  font-weight: 500;
  text-decoration: none;
}

.name:hover {
  color: var(--light);
}

.who button {
  margin-inline-start: auto;
  font-size: 0.6875rem;
}

/* What an Author said, set in the interface's face and not the reading one:
   nothing outside the work is prose. */
.text {
  white-space: pre-wrap;
  max-inline-size: 60ch;
}

.write {
  display: grid;
  gap: var(--s2);
  justify-items: start;
}

.write textarea {
  inline-size: 100%;
}

.note {
  color: var(--muted);
  font-size: 0.8125rem;
  max-inline-size: 60ch;
}
</style>
