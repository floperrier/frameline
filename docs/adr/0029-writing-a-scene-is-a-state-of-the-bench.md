---
status: accepted
---

# Writing a Scene is a state of the bench

The bench has two states. In one, the Graph is the whole surface and a Story is
laid out and read at once. In the other, a Scene is being written: the Graph
folds into a rail down the leading edge, the Scene takes the width that frees,
and a reading of the Story sits beside it — see
`docs/adr/0030-a-story-is-read-where-it-is-written.md`. Writing a Scene is
therefore a state the bench is in, not a strip docked at its edge and not a
second room.

The rail is the Graph drawn small. It keeps every Scene's stored coordinates and
renumbers nothing: the layout an Author arranged by hand goes on being how they
recognise their own Story at a tenth of the size, the Scene being written is
marked on it, and pressing another card in it changes the Scene being written.
Unfolding gives back the scroll position and the scale the Author left, because a
fold that forgets is a fresh search rather than a fold.

This supersedes
`docs/adr/0021-a-scene-is-written-in-a-panel-at-the-edge-of-the-bench.md` on the
condition that record wrote for itself. `0021` closed by naming what it would
fall on: "the day an Author needs an Exit's Conditions and the Scene they test
side by side — or two Scenes' Shots against each other — the answer is a second
panel or a split one, and the single selection this record rests on is what has
to give." That day is here. An Exit's Conditions test the Flags the Scene it
leaves sets, and in three hundred and eighty pixels holding one thing at a time
the Author writes the test with the Flags off the screen, handed back and forth
by a button. The answer taken is not a second panel beside the first — two
columns of three hundred and eighty are the same column twice — it is the width
itself.

## Considered Options

**The panel, widened.** The cheapest change: leave the geometry alone and let the
docked panel grow. It does not survive the arithmetic. The panel pushes the Graph
narrower rather than covering it, which was the whole of `0021`'s case for
docking, so every pixel the writing gains the drawing loses. At a width a Shot's
text is comfortable in, the Graph is a sliver nobody can aim a card into; at a
width the Graph survives, the Shot is still written in a column narrower than a
phone. Two things sharing one width by pushing each other is a trade that only
works while one of them is small, and neither of these is.

**A page per Scene**, which `0011` rejected and `0021` rejected again. The ground
`0011` gave has since gone — the neighbouring Scene is not read off the Graph at
all, because the Conditions builder is handed every Scene in the Story by name —
but the other half of its argument is untouched and is why this stays one room:
one fetch of the Story, one holder every control writes into, one place a refusal
is shown, and a Graph that has not forgotten where it was scrolled to. A second
room costs a second everything, and gains a browser address this record buys
without it.

**The Graph going away while a Scene is written.** The simplest full-width shape,
and it takes the answer to "where does this Scene sit in my Story" off the
screen at exactly the moment an Author is writing the ways out of it. Folding to
a rail costs a tenth of the width and keeps the Story in view.

**The rail as a list of Scene names.** Cheaper to draw, and it throws away the
one part of the Graph that is the Author's own work. A Story is recognised by its
shape — the cluster over here, the long run down there — and a list is an
alphabet where there was a map. The glossary already says the Graph is a drawing
and that node and card are words for the drawing, so a small drawing is no new
concept; a list would be one.

## Consequences

**A Scene has an address below the Story.** `0011` and `0021` both recorded that
nothing was deep-linkable below a Story; that is reversed for the Scene, and only
for the Scene — a Shot does not get one. An Author can send themselves a link to
a Scene and come back to it, the browser's back closes the writing, and an
address naming a Scene that has since been deleted opens the Story with nothing
written rather than a not-found: a stale link should not report an error about
something the Author themselves removed.

**A refusal is shown against the Scene it concerns.** With the Story on one
surface and one Scene written at a time, the server complaining about a Shot has
somewhere precise to complain — which is what `0011` gave up when it said a
refusal about a Shot is shown against the Story.

**The width has to be paid for.** A Scene at full width is a flat run of Shots,
Flags and ways on that is wide but no shorter, so what a Scene holds is sorted
into tabs, each carrying its count. The accepted cost is that the Flags and the
ways on stand behind a tab a first-time Author may not press. That cost is
measured rather than assumed: the guided path is the instrument, and if it has to
grow a Step that says "press the ways on tab", the tabs have failed and unfolding
one Shot at a time is the fallback — both shapes were built at full width and
compared on `prototype/scene-editing-shots`, and this record is what the
comparison settled.

**A narrow screen shows one of the three at a time**, with the same fold as a
wide one. The interface is learned once. The narrow screen is made coherent, not
made comfortable: authoring on a phone is not what this is for.

**The guided path moves again.** Its Steps are anchored in the template rather
than in selectors held beside it — see
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md` — so every Step
whose anchor no longer exists fails loudly rather than pointing at nothing, and
every Step the new shape made obvious is deleted. How many are left is the
measurement of the rework.

The condition this record would fall on is a Story too large for a rail: the
drawing shrinks with the Story, and past some number of Scenes a tenth of the
width is a smudge, at which point the rail wants a search or a filter and stops
being the Graph drawn small. The other is two Scenes written at once — a Shot
here read against a Shot there — which this record refuses the same way `0021`
refused it, and which would turn the state into panes the Author arranges rather
than a state with one Scene in it.
