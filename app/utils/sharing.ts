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

/**
 * A Map or a Set the document works out of the whole Story again on every change
 * to what it reads, laid over the one the rows were handed, in place, and the
 * same object throughout. Handed to every row of the document and never handed
 * again, so through Vue's `reactive` a row is told of a change only where it
 * reads what changed, and not because the whole was worked out anew. What it
 * does, and so who is told:
 *
 * - An entry that says the same is not touched, and no reader of it is told.
 * - An entry of a Map whose value is a plain object and says something else is
 *   written over field by field, inside the object it holds: a reader of one of
 *   those fields is told, and a reader of the Map's size or of the order of its
 *   keys is not, since no key was set. An Exit's words or a Scene's name typed
 *   into keep the Exits the bench names this way — see
 *   `docs/adr/0043-a-story-is-written-as-one-document.md`.
 * - An entry whose value is anything else, a Scene's name, is set: a reader of
 *   that key is told, and so is anything that walks the whole Map, as Vue tells
 *   it of any `set`.
 * - A key or a member no longer held is taken out, and one held anew is put in:
 *   a reader of that key is told, and so is anything that reads the size or
 *   walks the whole. A Flag being typed is one member taken out and another put
 *   in, keystroke by keystroke.
 * - The order is the order a list of it offers, and a Map or a Set only ever
 *   puts a key at its end. So where the keys still held part from the order
 *   they are now held in — one put in anywhere but last, two that changed
 *   places — every key from that point on is taken out and put back in order,
 *   and a reader of each of those is told as well.
 *
 * Where `steady` keeps the old value whole while nothing in it changed, this
 * keeps it whole while something does: a keystroke into one way on's words
 * changes one entry of the Exits the bench names, and with `steady` that is a new
 * Map handed to every row.
 */
export function keep<K, V>(held: Map<K, V>, next: ReadonlyMap<K, V>): void
export function keep<K>(held: Set<K>, next: ReadonlySet<K>): void
export function keep<K, V>(held: Map<K, V> | Set<K>, next: ReadonlyMap<K, V> | ReadonlySet<K>) {
  for (const key of [...held.keys()]) {
    if (!next.has(key)) held.delete(key)
  }

  const standing = [...held.keys()]
  const order = [...next.keys()]
  let parted = 0
  while (parted < standing.length && Object.is(standing[parted], order[parted])) parted++
  for (const key of standing.slice(parted)) held.delete(key)

  if (held instanceof Map && next instanceof Map) {
    order.forEach((key, at) => {
      const value = next.get(key) as V
      if (at >= parted) held.set(key, value)
      else writeOver(held, key, value)
    })
  }
  else if (held instanceof Set) {
    for (const key of order.slice(parted)) held.add(key)
  }
}

/** One entry of a Map laid over in place: field by field where both are plain objects, set otherwise. */
function writeOver<K, V>(held: Map<K, V>, key: K, value: V) {
  const kept: unknown = held.get(key)
  if (same(kept, value)) return
  if (!plain(kept) || !plain(value)) {
    held.set(key, value)
    return
  }

  for (const field of Object.keys(kept)) {
    if (!Object.hasOwn(value, field)) delete kept[field]
  }
  for (const [field, said] of Object.entries(value)) {
    if (!same(kept[field], said)) kept[field] = said
  }
}
