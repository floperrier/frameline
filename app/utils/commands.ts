/**
 * The Commands the bench is offering, and which of them a typed name reaches.
 *
 * A Command is not written here. It is a control that already stands somewhere
 * on the bench — the button that publishes the Story, the one that writes a
 * Scene, the one that deletes the Scene open on the surface — marked in its own
 * template with the `data-command` that carries the name the bar shows it
 * under. The bar reads them off the page at the moment it opens and presses the
 * control it was asked for, the way the guided path names the element it points
 * at rather than holding a selector of its own: see
 * `docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.
 *
 * That is the whole of the design, and what it buys is that the bar cannot
 * offer an act the bench does not: a control that is not on screen, or is
 * disabled, is not a Command, and nothing here can invent one. The rule that
 * every key has a pointer beside it is therefore held by the structure and not
 * by whoever remembers it.
 *
 * What is in this file is the one part of that with no document in it — the
 * matching — which is where a Story written in French is either reachable by
 * typing or not.
 */

/** A control on the bench, under the name the bar offers it as. */
export type Command = { name: string, press: () => void }

/**
 * A name with its accents taken off and its case flattened, which is what both
 * sides of the matching are read as. An Author reaching for *Le café* types
 * `cafe` as often as `café` — it is the same word, and one of the two spellings
 * is on every keyboard — so the Scene has to answer to both. `NFD` splits an
 * accented letter into the letter and the mark that sits on it, and the marks
 * are what is dropped.
 */
export function plainly(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
}

/**
 * The Commands a typed name reaches, in the order the bench itself draws them:
 * what stands above the graph before what stands on it, and the Scenes in the
 * order their cards are laid out. Nothing is scored and nothing is reordered —
 * an Author typing three letters is looking for a name they already know, and a
 * list that rearranges itself under the fourth letter is one they have to read
 * again from the top.
 *
 * Nothing typed reaches everything, which is what makes the bar a list of what
 * the bench can do rather than a search that starts empty.
 *
 * ponytail: a plain substring, not a fuzzy subsequence. `cf` finding *Le café*
 * would also find a dozen other things, and the ranking that would then be
 * needed to tell them apart is a great deal more than this. Write it the day a
 * Story is large enough for the substring to stop narrowing.
 */
export function commandsReached(offered: Command[], typed: string) {
  const looked = plainly(typed.trim())
  if (!looked) return offered

  return offered.filter(command => plainly(command.name).includes(looked))
}
