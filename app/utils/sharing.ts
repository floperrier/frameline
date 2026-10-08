import { same } from '#shared/utils/changes'

/**
 * The Story read back after an act, laid over the Story the bench holds so that
 * whatever did not change keeps the object it had — issue #449 and
 * `docs/adr/0032-the-bench-reads-the-story-back.md`.
 *
 * A read-back used to replace the Story whole, which made every Scene, Shot and
 * Exit a new object and every row of the document a row to draw again: at forty
 * Scenes that was three seconds for *Add a Shot*. Here a part equal to what was
 * read is handed back as the very object the bench held, so a row drawn from it is
 * handed nothing new and is not drawn again; a part that differs is the read's own
 * object, as the refetch made it — with what did not change inside it kept in turn.
 *
 * Nothing the bench holds is written into, and that is the half of the rule that
 * keeps `docs/adr/0008-refetch-is-for-a-refusal.md` whole. A typed write still
 * waiting in the queue holds the object it was typed into and sends what that
 * object says when its turn comes; laid over in place, a read older than that write
 * would have put the old words back into it before it left. A part that differs is
 * a new object instead, so the one the write holds still says what was typed, which
 * is what a refetch that replaced everything did too.
 *
 * Laid over only after an act the server kept. After a refusal the read is put in
 * place whole: a choice sent without being written into the Story first — the
 * Scene an Exit lands on, the face the Story is set in — leaves the Story the bench
 * holds equal to the read, so this would hand back the very object, and the control
 * would go on showing what was refused. See
 * `docs/adr/0008-refetch-is-for-a-refusal.md`.
 *
 * Rows are found by their id wherever the read puts them, so a Shot moved up a run
 * keeps its object; whatever carries no id — a formatted text's lines, a list of
 * Conditions — is read by where it stands.
 */
export function sharing<T>(held: T, read: T): T {
  if (Object.is(held, read)) return held

  if (Array.isArray(held) && Array.isArray(read)) {
    const byId = new Map(held.filter(identified).map(row => [row.id, row]))
    const kept = read.map((row, at) => sharing(identified(row) ? byId.get(row.id) : held[at], row))

    return kept.length === held.length && kept.every((row, at) => row === held[at]) ? held : kept as T
  }

  if (plain(held) && plain(read)) {
    const fresh: Record<string, unknown> = read
    const keys = Object.keys(fresh)
    for (const key of keys) fresh[key] = sharing(held[key], fresh[key])

    return keys.length === Object.keys(held).length && keys.every(key => fresh[key] === held[key])
      ? held
      : read
  }

  return read
}

function identified(row: unknown): row is { id: string } {
  return plain(row) && typeof row.id === 'string'
}

function plain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

/**
 * A value the document works out of the whole Story again after every act — the
 * names the bench gives its Scenes and Exits, the Flags a Condition may ask
 * about, the face the Story is set in, the Scenes a way on may land on — handed
 * back as the value it was the last time wherever it says the same. Each is
 * handed to every row of the document, and a row handed a new Map is a row drawn
 * again, so without this an act in one Scene would draw all three hundred.
 *
 * Read as `computed(previous => steady(previous, …))`, which hands the value the
 * computed held last. A Map and a Set say the same where they hold the same, in
 * the same order, since the order they are read in is the order a list of them
 * offers; anything else is compared as `same` compares a value read out of JSON.
 */
export function steady<T>(previous: T | undefined, next: T): T {
  return previous !== undefined && same(listed(previous), listed(next)) ? previous : next
}

/** What a Map or a Set holds, as the list it is read in, and anything else as itself. */
function listed(value: unknown) {
  return value instanceof Map || value instanceof Set ? [...value] : value
}
