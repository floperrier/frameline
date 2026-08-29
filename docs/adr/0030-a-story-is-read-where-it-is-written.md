---
status: accepted
---

# A Story is read where it is written

An Author reads their own Story in a pane beside the Scene they are writing, on
the same engine a Reader runs. It replays the Path the Author is on, with the
State that Path has accumulated, and stops on the Scene being written. What they
type reaches it. Pressing a way on in it advances the reading and moves the
writing to the Scene that way on leads to. The order the ways on are offered in
is set there, on the choice buttons as they are read.

This is Preview, moved. The word is kept and its glossary entry rewritten, rather
than a second word being coined for an Author reading their own Story: two words
for one thing is what the glossary refuses everywhere else. What stops being true
of it is that it is "not a mode of the editor" and that after it "nothing about
the Story changes" — it is a pane inside the editor, and an order is written from
it. What stays true is the rest: the same engine as a Reader's, no Publish,
nobody else able to reach it.

## Considered Options

**Playing the Scene alone**, which is the obvious pane: take the Scene being
written, run its Shots, draw its ways on. It is wrong on this product's own
terms. A Shot carries Conditions, and a Condition is a test on State that a Path
accumulated; a Scene played with no State behind it plays the Shots that carry no
Condition and silently drops the rest. The Author would be shown a Scene that
exists for nobody — not for a Reader who arrived one way, not for a Reader who
arrived another. Replaying the Path is what makes the pane evidence rather than
decoration: a Shot appears in it exactly when it would appear for a Reader who
came the same way, and an Author writing under a Condition can see whether it
holds.

**Keeping the Preview a page of its own**, and letting the Author leave the bench
for it. That is what exists and what this replaces. The cost of leaving is the
Graph's scroll position, the scale, and the Scene that was open — the state
`0029` went to some trouble to keep across a fold is thrown away by a navigation.
Reading is not an errand at the end of writing; it is how a line is judged
between two keystrokes.

**A reading with a cursor of its own**, free to wander while the writing stays
put. It reads well until the two disagree, and then the screen is asking the
Author to hold two answers to "where am I" at once — one in the pane, one in the
tabs — and nothing on it says which one a press will act on. There is one notion
of where the Author is here and it is the Path: pressing a way on moves both, and
pressing a card in the rail moves both. That single cursor also happens to be a
way through a Story that needs nothing explained, which is worth more to a
first-time Author than the freedom being given up.

**Ordering the ways on where they are listed**, rather than where they are read.
That is where the order is set today, in a strip of Scene names, and it is the
one screen where the order means nothing: a list of names is not what anybody is
ordering. The buttons a Reader is offered are, and the reading is the only place
they appear as buttons.

## Consequences

**`0007` is not contradicted, and the distinction matters.**
`docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md` refuses to take
the order from the geometry of the drawing, because a Scene's coordinates say
nothing about the Story and tidying a Graph must not rewrite dramaturgy. The
Place stays exactly what that record made it: a written fact the Exit carries,
the same numbering a Shot has. Only the screen it is written on changes, and
`0007` never said which screen that was. Nothing is read back out of a layout,
and two Scenes stacked on the same point still have an order.

**The ways on keep a pair of controls that renumber them.** Setting an order by
moving buttons is a pointer gesture, and an order that can only be set with a
pointer is an order some Authors cannot set. `0007` already kept those controls
as the route into an Exit for a hand not holding a pointer; they stay, in the
reading, beside the buttons.

**The Reading engine widens; no new seam.** The engine already computes
everything about a Reading from its Path, so what this needs is an existing
function growing a way to stop at a given Scene — not a module, not a second
implementation of what a Reader gets. The pane being the same code as the public
link is the whole claim the pane makes; a preview renderer of its own would be a
second engine to keep saying the same thing, which is the thing this repository
refuses in `docs/adr/0028-favourites-is-a-list-without-a-title.md` about a
different pair.

**A Scene no Path reaches cannot be replayed to.** An Author can write a Scene
that nothing leads to yet, and a Story with no Opening Scene cannot be read at all —
the glossary already says a Story with none can be neither previewed nor
published. So the pane says what it is: it reads as far as it can from the
Opening Scene and tells the Author the Scene is not reached yet, rather than
inventing a Path or playing the Scene bare, which is the thing this record just
rejected. An orphan Scene is a fact about the Story worth being told, and the
pane is where it becomes visible earliest.

**Reading is no longer free of consequence.** Setting an order writes to the
Story from a screen whose name says "read", so the write is the ordinary one — it
goes through the same holder every other control on the bench writes into, and is
refused and reported the same way. Nothing else in the pane changes anything: a
way on pressed moves the Author, it does not record that a Reader took it, and no
State survives the pane.
