<script setup lang="ts">
/**
 * The one control that gathers a Story into an Author's shelves: Favourites,
 * which is what favouriting means, and every List they have written.
 *
 * Drawn beside a Story wherever a Story is met — an entry in the Catalogue, and
 * the reading page itself — so putting one away is done where it is found rather
 * than on a page about it. It shows which shelves already hold it: the button is
 * pressed where the Story is a favourite, and a List holding it is checked.
 *
 * Nothing is drawn for somebody with no account, and nothing is said here about
 * why: the page says it once, where a sentence per entry would be the same
 * sentence a dozen times.
 */
const { storyId, title } = defineProps<{ storyId: string, title: string }>()

const { loggedIn } = useUserSession()
const { favourites, written, holds, refresh } = useLists()
const { problem, change } = useEditing(refresh)

/**
 * Puts the Story on a shelf or takes it off. `PUT` twice is the same shelf, so a
 * click arriving while the last one is still in flight costs nothing.
 */
function gather(listId: string, onto: boolean) {
  return change(() => send(
    `/api/lists/${listId}/stories/${storyId}`, { method: onto ? 'PUT' : 'DELETE' }))
}
</script>

<template>
  <div v-if="loggedIn" class="gathering">
    <!-- Favouriting is putting the Story in one particular List, so this button
         and the checkboxes under it are one act on two Lists.

         The label says what pressing does and never changes; whether the Story
         is already a favourite is `aria-pressed`, which is what a toggle is
         announced by. A button whose words changed under the reader would be a
         second control wearing the first one's clothes. -->
    <button
      v-if="favourites"
      type="button"
      :aria-pressed="holds(favourites.id, storyId)"
      @click="gather(favourites.id, !holds(favourites.id, storyId))"
    >
      {{ $t('lists.favourite') }} <span class="visually-hidden">{{ title }}</span>
    </button>

    <!-- Folded away, because an Author with shelves of their own is not choosing
         between them every time they pass a Story. -->
    <details v-if="written.length" class="onto">
      <summary>
        {{ $t('lists.gatherInto') }} <span class="visually-hidden">{{ title }}</span>
      </summary>
      <ul>
        <li v-for="list in written" :key="list.id">
          <label>
            <input
              type="checkbox"
              :checked="holds(list.id, storyId)"
              @change="gather(list.id, ($event.target as HTMLInputElement).checked)"
            >
            {{ list.title }}
            <span class="visually-hidden">— {{ title }}</span>
          </label>
        </li>
      </ul>
    </details>

    <Refusal :problem="problem" />
  </div>
</template>

<style scoped>
.gathering {
  display: grid;
  justify-items: start;
  gap: var(--s2);
}

/* Pressed is the state, not a second control: the button says what it will do
   and carries the mark of what it already did. */
button[aria-pressed='true'] {
  border-color: var(--light);
  background: color-mix(in oklab, var(--light) 14%, transparent);
  color: var(--paper);
}

.onto summary {
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--muted);
}

.onto summary:hover {
  color: var(--paper);
}

.onto ul {
  display: grid;
  gap: var(--s1);
  padding-block-start: var(--s2);
}

.onto label {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  font-size: 0.875rem;
}
</style>
