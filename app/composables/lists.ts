/**
 * An Author's own shelves: Favourites, the Lists they have written, and what is
 * on each. Read once for a whole page — the Catalogue draws a control per entry
 * and every one of them is asking the same question — so the fetch is keyed and
 * Nuxt hands them all the same answer.
 *
 * Nothing is fetched for somebody with no account: they are offered no control
 * to draw, and the endpoint would refuse them. It is the one composable here
 * that asks about the person rather than about the work, which is why it reads
 * the session itself instead of being told.
 */
export function useLists() {
  const { loggedIn } = useUserSession()

  const { data: shelves, refresh } = useFetch('/api/lists', {
    key: 'lists',
    immediate: loggedIn.value,
    default: () => [],
  })

  /** Favourites is the untitled one, and every account has exactly one. */
  const favourites = computed(() => shelves.value.find(list => list.title === null))

  /** The Lists an Author wrote themselves, in the order they wrote them. */
  const written = computed(() => shelves.value.filter(list => list.title !== null))

  /** Whether a List already holds a Story, which is what the control shows. */
  function holds(listId: string, storyId: string) {
    return shelves.value.some(
      list => list.id === listId && list.stories.some(story => story.id === storyId))
  }

  return { shelves, favourites, written, holds, refresh }
}
