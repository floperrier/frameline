---
status: accepted
---

# The Graph is drawn from the Story

The Graph is a reading of the Story and nothing else. Where every Scene is drawn
is worked out from the Story alone — the Opening Scene in the first column, the
Scenes its ways on lead to in the next, each Scene in the first column it is
reached in and, within a column, in the order the Reader is offered it; a Scene
nothing reaches in the columns after — and the drawing moves when the Story does.
Nothing is placed by hand, nothing is dragged, nothing is zoomed, and nothing is
written back: `x` and `y` leave the API, and `laidOut` in `shared/utils/scenes.ts`
is the whole of the layout.

The bench has one state. There is always a Scene on it — the one the address
names, or the Opening Scene, or the first written — and the Graph is a band across
the top of the bench with that Scene's document under it, the reading of the Story
beside the document where the width allows and a press away where it does not. A
node is pressed and nothing else: pressing it puts its Scene on the surface.

An Exit is written by naming where it leads. The field at the foot of a Scene's
ways on offers the Scenes a way on from here may land on and takes any name at
all: a name the Story answers to — compared the way the bar of Commands compares
names, so *cafe* finds *Le café* — joins the two Scenes, and a name nothing
answers to writes a Scene under it and joins that. This is how every Scene after
the first is born, and the hand lands on the words the Reader will press.

A Scene is split before one of its Shots. `POST /api/scenes/:id/split` takes the
Shot and a name: the Shots from that one on become a Scene of their own,
renumbered from the first; every Exit leaving the Scene moves to the new one; one
unphrased Exit joins the two. A Reading plays exactly what it played, with one
press between the halves. It is the act
`docs/adr/0001-branching-only-between-scenes.md` said the decision owed, and it
is never made before the first Shot: a Scene left with none is a Scene renamed.

This supersedes `docs/adr/0015-a-cut-is-drawn-by-hand.md`,
`docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md`,
`docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` and
`docs/adr/0036-the-surface-that-covers-the-bench-is-not-a-dialog.md`, each of
which was about a gesture on the drawing or about a bench with two states. It
keeps what `docs/adr/0034-a-story-is-written-without-the-canvas.md` decided — an
Exit is written in the document of the Scene it leaves — and takes that record
to its end: with nothing left to write on the canvas, the canvas is not a surface
any more. `docs/adr/0037-the-reading-folds-before-the-writing-does.md` stands,
with its band now running down to the phone and onto it.

## Considered Options

**Leaving the hand-laid canvas**, which `0034` had already taken off the critical
path. Every act on it — drag, pan, zoom, drawing an Exit from a rim, dragging an
endpoint — was a second way of doing something the document already did, drawn
in some twenty-three hundred lines that an Author on a phone never saw. What it
still bought was one thing: a picture of the Story's shape an Author recognises.
A layout read off the Story keeps the picture and loses the hand: the shape it
draws is the shape the Story has, which the hand-laid one only approximated
after work.

**Auto-layout with an escape hatch** — a derived layout the Author may nudge, the
nudges stored. Two sources for one fact, and the fold `0029` recorded is what a
stored layout costs: coordinates in the schema, an endpoint to write them, a
reach to bound them, a rail that scales them. Refused until an Author is found
whom the derived shape misleads.

**A list of Scenes instead of a drawing**, which `0034` refused as a second view
of the Story. Still refused: the branching is the thesis, and a list flattens it.

**Two states kept, the Graph whole when nothing is written.** There is nothing to
do on a whole Graph that a node does not do, so the state would exist only to be
left. A bench that always holds a Scene is one fewer thing to learn and one fewer
control to close it with.

**A Scene born from an Exit to "a new Scene" chosen in a select**, which is what
the field did. A select cannot take a name, so the Scene arrived provisionally
named and the Author was moved to it to rename it — two gestures and a change of
place for one thought. A field that takes a name does both at once and leaves the
Author where they were.

**Setting a Flag by hand in the Preview**, so a Condition could be tried without
writing the Scene that sets it. Refused: State is derived from the Path
(`docs/adr/0020-progress-is-the-story.md`,
`docs/adr/0024-the-seed-belongs-to-the-position.md`), and a State set by hand is
a Reading no Reader can have.

**A Path kept as a replayable test**, so an Author could name a route through the
Story and be told when a change breaks it. A whole feature — a table, a surface
to name and list them on, a runner and a report — about two days, and not this
record's.

**Composed Conditions** — an `or`, a nesting — which `docs/adr/0004-conditions-stay-flat.md`
already refused, and a split Scene is that record's own answer.

## Consequences

**`x` and `y` are no longer read or written.** The columns stay one deploy longer,
under `docs/adr/0002-the-schema-moves-with-the-deploy.md`, and the migration that
drops them follows. `PATCH /api/scenes/:id` renames and does nothing else;
`POST /api/stories/:id/scenes` places nothing.

**The Graph is right in the first frame**, on the server as in the browser: every
node is one size, so the lines are arithmetic on the Story and nothing is measured
after render. A Story wider than the window scrolls inside the band, at one scale.

**A Scene nothing reaches is drawn as the loose end it is**, dashed, after the
last column the opening reaches. The Remark that says so in words stays.

**There is no way out of the writing**, because there is nothing to go out to:
`Close this Panel`, `Escape` as a way out, the push onto the history and the
`inert` bench all go. The browser's back leaves the Story.

**The header is one row.** The Synopsis and the Cover, which nobody writes while
writing a Scene, fold into a disclosure; the acts that publish stay on the row.

**The document's rows are lighter.** A Shot carrying no Conditions shows one mark
to add one and nothing else; the marks on a beat are split, earlier, later,
delete; the heading over the Shots counts words as well as Shots, which is the
one figure a writer asks of a document.

**The bar of Commands puts the hand on a field as it did on a select**, since the
act of adding an Exit is now a name typed.

**The widths in `app/assets/css/folds.css` stay two**, and mean less: `--phone` is
read by the landing page and the list of Stories, `--two-columns` by the bench,
and the Preview's fold runs from the second all the way down.

The condition this record would fall on is an Author whom the derived shape
misleads about their own Story — a work whose branching the breadth-first
reading draws wrong enough that they reach for the drawing to correct it. The
answer then is a better reading, and only after that a stored nudge.
