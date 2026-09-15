---
status: superseded by 0043
---

# The Scene is written where it stands

The Graph stops being a band across the top of the bench and becomes the bench.
The whole Story is laid out on it, drawn from the Story and nothing else the way
`docs/adr/0041-the-graph-is-drawn-from-the-story.md` decided, and the Scene being
written stands on it: the gate takes the place of that Scene's node, at the size
a frame and the words under it are actually looked at, and the layout opens up
around it — the column widens to the gate's width, the Scenes under it are pushed
down — then closes again when the gate is lifted off. It is one layout read at
two sizes: the order of the columns and of the rows is untouched, so nothing
about where a Scene stands is decided by which one is being written.

The gate has two faces. One is the Scene written — its name, the Flags it sets,
the run of its beats, the ways out. The other is the Story read on the engine a
Reader runs, stopped on that Scene with the State its Path has accumulated. They
are the same box in the same place on the table, and a control turns it over.
That is what `docs/adr/0030-a-story-is-read-where-it-is-written.md` asked for and
never quite had: the reading was a third column beside the writing, and it is now
the other side of the writing surface itself.

The run of beats is one beat in the gate and the whole run along the foot as the
strip it is. The frame is the frame a Reader will meet, the words under it are set
in the face a Reader reads them in, and both are typed into where they are read.
It is still one document and still one field per Shot: `Enter` at the end of a
beat opens the next, `Backspace` at the head of an empty one joins it to the beat
before, `Alt` with the two arrows walks the run — and each of them moves the gate
with the caret, because the caret and the frame are never on two different beats.
Nothing is parsed and no beat loses the id its Image and its Conditions hang off.

The Scene being written has no node while the gate stands on it. There is nothing
a press on it could do — it is already the Scene on the bench — and so the bar of
Commands does not offer *Go to* it either, for the reason
`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`
already gives for not offering the mark that opens the Story on the Scene it
already opens on: an act with nothing left to do is not offered. The bar offers
one *Add a Condition* rather than one per beat, for the same reason — the bench
draws the beat in the gate and no other.

There is one fold left. A gate is a frame and the words under it, and there is no
screen narrower than one that holds a gate beside anything else, so below the
width the gate itself needs it covers the Story it stands on and lifting it off is
what shows the table. The second fold went with the reading:
`docs/adr/0037-the-reading-folds-before-the-writing-does.md` measured the width
at which a third column had to go, and there is no third column.

This supersedes `docs/adr/0037-the-reading-folds-before-the-writing-does.md`
whole, and the layout of
`docs/adr/0033-a-scene-is-written-as-one-document.md` — its column of beats, each
carrying its own thumbnail and its own marks. What `0033` decided about the
*typing* stands and is carried here unchanged: the run is one document, typed as
one text, one field per Shot, nothing parsed. It keeps
`docs/adr/0034-a-story-is-written-without-the-canvas.md` — an Exit is written in
the document of the Scene it leaves, by naming where it leads — and
`docs/adr/0041-the-graph-is-drawn-from-the-story.md`, whose layout is the whole of
this one's.

## Considered Options

**The band kept, the gate under it.** What the bench did until now. Measured on a
window a thousand pixels tall, five hundred of them were spent before the first
word: two hundred and ten of header, sixty of a row of tools, two hundred and
forty of a band holding five nodes of a hundred and sixty-eight by forty-four —
under a tenth of the band drawn on. The band was the most expensive thing on the
bench per fact it carried, and the document under it never got the width of the
window either, because the reading had a column of its own. Refused: the two
surfaces were competing for one screen, and the one that lost was the writing.

**The gate centred on the window, the Graph behind it.** A modal writing surface
over a map. It costs nothing to build and it throws away the whole point: with
the gate covering the Scenes its ways on lead to, the table stops saying where
the Author can go next, which is the one thing a map is for. This is what the
prototype did first, and it is what the spreading was written to fix.

**The gate beside its node rather than in its place**, joined to it by a line.
Two boxes for one Scene, and the Author reads the name twice. The node is what a
Scene looks like when it is not being written; there is no reason to draw it as
well as the thing it grows into.

**A drawer along one edge**, the table filling the rest. The reading of the Story
and the writing of a Scene are then permanently side by side at a width neither
of them chose, and a Scene's document is a column again — which is where the
five hundred pixels came from. Refused for the same reason as the band.

**One beat at a time with no strip.** The gate alone, walked with the keys. It is
the cheapest thing to draw and it hides the shape of the Scene: a run of twelve
beats is a fact about the Scene an Author needs at a glance, the way the Graph is
a fact about the Story. The strip is that glance, and it is also the grip a beat
is dragged to another Place by.

## Consequences

The bench has one surface. There is no state in which the Story's shape is off
screen, and none in which the writing is a column of a bench: the Author is
always looking at the work, in its place in the Story.

The gate is a fixed box — `GATE_WIDTH` by `GATE_HEIGHT` in
`shared/utils/scenes.ts`, in pixels beside the node's own box, because the layout
has to reserve exactly the room the gate takes and a box measured in one unit and
reserved in another is one fact written twice. What is inside it scrolls. A Scene
of twenty beats and six ways out is read by scrolling the gate, which is what the
document did before.

The table is wider than a window as soon as a Story has three columns of Scenes
with the gate down, so the bench scrolls both ways. That is what the band did to a
long Story already; it is the whole page doing it now, and the gate is scrolled to
whenever it moves.

`x` and `y` are still not in the API and still not in the schema's future: the
spreading is arithmetic on the same layout, in the same pure function, with the
Scene being written passed in. `tests/unit/graph.spec.ts` holds it — that the
column widens, that the rows are pushed apart, that a node in the widened column
stays centred in it, that the order of the columns and rows is the same whichever
Scene is being written, and that the layout closes back to exactly what it was
when the gate is lifted off.

The bench says every Remark it finds. Two of them used to be dropped while the
Scene they were about was open, because the reading standing in the column beside
the writing was already saying them in the Scene's own words — see
`docs/adr/0032-the-bench-reads-the-story-back.md`. The reading is a face of the
gate now, so while an Author is writing it is saying nothing to them, and a
Remark left to it would be a fact said by nobody.

A Scene with no beats in it draws no gate face beyond its slate and its ways: the
frame belongs to a beat, and a Scene the API has just written has none. The
control that adds the first one is the strip's own, which is where every other
beat is added from.
