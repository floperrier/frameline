/**
 * The longest title an Author may give a List. Shared so the server's rejection
 * and the form's own limit cannot drift apart, the way a Story's title and an
 * Author's Name are.
 *
 * Short on purpose: a title names a shelf and is read at the head of one, so a
 * title long enough to be a sentence is a title being used as a note.
 */
export const LIST_TITLE_MAX_LENGTH = 60

/**
 * One List and everything gathered into it, out of the rows a join hands back —
 * a row per Story, and one row carrying no Story where the List is empty.
 *
 * Favourites comes first, whatever it was written at: it is the List every
 * account has and the one an Author reaches for. The rest keep the order the
 * query handed them over in, which `Array.prototype.sort` being stable is what
 * preserves.
 *
 * The Story is whatever the caller selected, so the shape of an entry is decided
 * once at the endpoint rather than twice.
 */
export function gatherLists<Story>(
  rows: { id: string, title: string | null, story: Story | null }[],
) {
  const gathered = new Map<string, { id: string, title: string | null, stories: Story[] }>()

  for (const row of rows) {
    const list = gathered.get(row.id) ?? { id: row.id, title: row.title, stories: [] }

    if (row.story) list.stories.push(row.story)
    gathered.set(row.id, list)
  }

  return [...gathered.values()].sort(
    (one, other) => Number(one.title !== null) - Number(other.title !== null))
}
