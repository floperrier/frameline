---
status: accepted
---

# The rail draws the ways on

A Scene is a point on the rail and an Exit is the line between two points, with
the way it runs marked at the end it arrives at. The shape of a Story is where
its ways on go, and a drawing that leaves them out draws half of it: the columns
said how far a Scene stands from the opening and nothing at all about what
reaches it, so *this leads there, and that comes back here* had to be read out of
the document one Scene at a time — which is the reading the picture exists to
save.

The reading of the Story is untouched. `inColumns` in `shared/utils/scenes.ts` is
still the one walk, still the same walk the document's own order is flattened out
of, and `x` and `y` are still out of the API and out of the schema. What is new
is `app/utils/graph.ts`, which turns a column into pixels: a column is a row down
the rail, a Scene stands in a lane across it, a column wider than the lanes wraps
onto a row of its own, and every number in it is a constant. Nothing is measured
after render, so the drawing is the same on the server as in the browser and
right in the first frame — `0041`'s claim, kept now that there are lines to keep
it about. A line is arithmetic on two points and bends three ways: down the rail
into a later column, arched over two Scenes of one column joined to each other,
and bowed off the side where it runs back up. One line per pair of Scenes and not
per Exit: two ways on to one Scene under opposite Conditions are one join in the
shape, and the document is where they are counted.

**The rail grows once, from one hundred and twenty pixels to two hundred and
twenty**, which is the one thing `0043` said it would not do. That record's
sentence — every layout before it gave the drawing a share of the width the
writing then had to win back — was written about a drawing that was a workspace.
This one is not: it takes a hundred pixels more and it is still a plate beside
the document, still `aria-hidden` with every point at `tabindex="-1"`, still
nothing but a locator. A hundred pixels is what a line needs to be followed; at
one hundred and twenty a line between two lanes is shorter than the point it
joins.

The fold narrows the window on the drawing and never the drawing. On a phone the
rail is a strip the plate scrolls sideways through, and the point the caret is on
is wound into it across as well as down, which `scrollIntoView` was already
asked for on the other axis. So a point keeps the twenty-four pixels a finger
needs at every width, one arithmetic serves both, and nothing in the component
has to know which width it is being read at.

## Considered Options

**Leaving the rail wordless and lineless**, which is `0043`'s own answer: an Exit
is read in the document of the Scene it leaves, where it is written, so a line
across the rail would say what the document already says. It is true of one Exit
and false of a Story. What the document says is *this Scene leads to that one*,
forty times over; what a line says is the shape those forty make, which is the
thing no amount of reading assembles and the whole reason a picture is on the
bench at all.

**Drawing the lines at a hundred and twenty pixels**, which costs nothing in
width. With five lanes in a hundred and twenty, a lane is twenty-four pixels and
a point is twenty-four: the lines would leave the rims they join and arrive at
the next with nothing in between, and two lines crossing would be a smudge. The
alternative inside that width is a smaller point, and a point below what a finger
can press is not a locator on the surface half of this product is read on.

**A second, wider surface reached by a control** — the drawing whole, one at a
time with the document. `0043` refused it and the reason stands: the shape of the
Story would be off screen while the Story is being written, and a picture that
has to be asked for is not read. This record is that refusal taken seriously
enough to pay a hundred pixels for.

**Measuring the points after render** and drawing the lines from where the
browser put them, which is how a drawing over a flow layout is usually done. It
would have kept the rail's `flex-wrap` and cost nothing in arithmetic, and it
gives up the frame: the first paint has no lines in it, a resize redraws them,
and the server renders a drawing with none. `0041` is explicit that the picture
is right in the first frame, and one walk of the Story is what makes it so.

**Storing the layout, so an Author could pull a line straight.** `x` and `y`
under another name — `0041` refused it, `0043` refused it for the document's
order, and nothing here is new: a stored nudge is a second fact about the Story
that can disagree with the Story.

**Elbows instead of curves**, routed around the points the way a flowchart draws
them. A router that avoids obstacles is a measurement problem or a much longer
arithmetic, and what it buys at this size is a corner instead of a bend. Curves
are three cases and a formula.

**Drawing one line per Exit**, so a pair joined twice is drawn twice. It puts a
heavier stroke on a pair for a reason that is about Conditions rather than about
shape, and the Author reads Conditions in the document, where they can be read.

## Consequences

**`0043`'s hundred and twenty is amended and its principle is not.** The rail is
two hundred and twenty at every width and eighty-eight at the phone's, and the
three regions of the bench still never trade width. The end-to-end spec that
measures them measures the new numbers; it is the same claim about the same
layout.

**`app/utils/graph.ts` is a pure module with a spec of its own**, held in
`tests/unit/graph.spec.ts` beside the walk it reads: that a column is a row, that
a column is centred, that one wider than the rail wraps before the next column
begins, that a line stops clear of both rims, and that a way back is bowed off
the side rather than drawn up the lane it would be confused with. What the
drawing *looks* like is the eye's, and that a press on a point still moves the
caret is the end-to-end suite's, as before.

**The rail still says nothing the document does not say in words.** It is
`aria-hidden` with every point at `tabindex="-1"`, and the Exits it now draws are
the Exits the document lists under the Scene they leave, named by where they
lead. The bar of Commands reaches every point exactly as it did —
`checkVisibility()` does not consult `aria-hidden` — so the keyboard's way to a
Scene is unchanged, and no tab order runs through a drawing. See
`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`.

**The lines touching the Scene being written are lit.** The one question a shape
is asked while a Scene is open is what reaches it and where it goes, and the rail
answers it without being pressed. It is the same light the point the caret is on
is drawn in, which is the interface saying where the Author is standing rather
than anything the Author wrote.

**A point is round.** `frameline.css` allows two shapes, and both of them are the
bench's own controls: a node in a drawing is not one, and a line arrives at a rim
rather than at a corner.

**Reopening condition.** `0043`'s stands unchanged — reopen the layout when an
Author cannot find a Scene in their own document. This record adds one of its
own: reopen it when the lines stop being followable, which is a Story whose
crossings outnumber its Scenes at the width the rail is drawn at. The answer then
is a better reading of the Story — an order within a column that crosses less —
and only after that a wider rail.
