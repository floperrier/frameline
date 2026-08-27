---
status: accepted
---

# The metaphor stops at the edge of the work

ADR 0014 makes the glossary the code's own language, and every word in it so far
is drawn from the grammar of cinema: a Story is made of Scenes, a Scene of Shots,
a Shot carries a Still, and a Cut joins one Scene to the next. That vocabulary
earned its place because the product's claim is that an interactive work is
edited the way a film is assembled rather than the way a page of prose is
written.

The community brings in things a cinema has no word for. There is no film term
for the list of what other people have published, none for a private shelf of
things you liked, none for what a stranger writes underneath. Words were
available — a catalogue could have been a *Programme*, a List a *Cycle* — and
they were refused. Both are metaphors reaching past what they describe: nothing
is scheduled in the Catalogue and nothing is projected in a List, so the word
would carry a resemblance and no meaning, and a person reading the screen would
have to learn a term to understand a thing they already understand.

So the seam runs at the edge of the work. Inside it — Story, Scene, Shot, Still,
Description, Place, Cut, Graph, Condition, Flag, Reading, Position — the grammar
of cinema governs, and it stays exactly as it is. Around it — Catalogue, Name,
Profile, Comment, List, Favourites, and whatever the community needs next — the
plain word governs, and it is chosen for how quickly it is understood.

## Consequences

**The glossary stays binding either side of the seam.** A plain word is not a
loose word: Catalogue has an `_Avoid_` list like every other entry, and a screen
that says "explorer" or "galerie" is as wrong as one that says "passage" for a
Scene. What changed is where the words come from, not how tightly they hold.

**Nothing existing is renamed by this decision.** Several terms inside the work
are hard to read — Repère for a Cue, Amorce for a Leader, Photogramme for a
Still — and their being hard to read is a separate problem with a separate cost:
each is an identifier in the code, a key held in two message files by a test, and
sometimes a column. Revising them is its own work, and this decision neither does
it nor blesses them.

**A new word is argued on its own merits.** "It fits the metaphor" stops being a
reason to choose a term, and "it doesn't fit the metaphor" stops being a reason
to refuse one.
