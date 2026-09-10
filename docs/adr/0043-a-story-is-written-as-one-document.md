---
status: accepted
---

# A Story is written as one document

The bench is a document. The whole Story is in it, from the Opening Scene to the
last, and an Author writes their Story the way they write anything else: from the
top, downwards, by typing. A Scene is a heading, the Flags it sets on entry, the
run of its beats, and the ways out of it named by where they lead. The next Scene
is under it. Nothing has to be opened and nothing closes.

The order is not a new fact. It is the layout of
`docs/adr/0041-the-graph-is-drawn-from-the-story.md` read as a sequence instead of
as a picture: the Opening Scene, then each Scene in the first column it is reached
in, and within a column in the order the Reader is offered it. The same pure
function answers both, so the order a Story reads in and the shape it draws in
cannot disagree, and neither is placed by hand.

The Graph goes in the gutter, down the left of the document, drawn small: the
columns run down the page and the Scenes of a column run across it. It is the same
reading of the same Story, and it is on screen at every width — which is the whole
of what `docs/adr/0042-the-scene-is-written-where-it-stands.md` was for. It is a
locator and not a workspace: it says where in the Story the caret is, it takes a
press to go somewhere, and it marks a Scene nothing arrives at. It never grows.
That is the point of it. Every layout before this one gave the drawing a share of
the width that the writing then had to win back, and this one gives it a hundred
and twenty pixels for good.

Down the right, where there is room for it, the bench says what it has read back
out of the Story — `docs/adr/0032-the-bench-reads-the-story-back.md` — and what
the Story is: its Scenes, its Exits, its Shots, how many carry an Image. A rail,
not a column: it folds before anything else does, and nothing is only there.

The document pane holds three readings of one Story, and a control chooses which.
**The text** is the document above, and it is where a Story is written. **The
contact sheet** is every Shot of every Scene as the frame it carries, in bands, one
band a Scene — the Story seen rather than read, which is how an Author judges what
is still a grey rectangle. **The room** is the Story on the engine a Reader runs,
replaying the Path with the State it has accumulated, exactly as
`docs/adr/0030-a-story-is-read-where-it-is-written.md` requires. The gutter and the
rail do not move between the three. What changes is what the middle is a reading
of, never where anything is.

Where the Path lives follows from that. It is held by the bench, above the pane,
so that turning from the text to the room and back resumes the reading the Author
was in rather than drawing a fresh seed — which is what the two faces of the gate
did, because they were a `v-if` pair and everything either of them held went with
the unmount. A Preview that redraws its seed each time it is looked at is not
replaying a Path, whatever the glossary says of it.

Typing is `docs/adr/0033-a-scene-is-written-as-one-document.md` unchanged, over a
longer document. One field per Shot, nothing parsed, no beat losing the id its
Image and its Conditions hang off. `Enter` at the end of a beat opens the next,
`Backspace` at the head of an empty one joins it to the beat before, and the two
of them now run past the end of a Scene: `Enter` on the last beat of a Scene opens
a beat, never a Scene, because a Scene is written by naming where an Exit leads
and by nothing else — `docs/adr/0034-a-story-is-written-without-the-canvas.md`.
An Exit is a line at the foot of the Scene it leaves, its Place, its words, and
the Scene it lands on; naming a Scene the Story does not hold writes it, and it
appears in the document at the place the order puts it.

A control that acts on one row is drawn on that row and reaches full strength when
the caret or the pointer is on it. It is drawn either way — the bar of
`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md` asks the
browser whether a control is drawn, and a control taken out of the document is a
Command taken away — so what changes is its weight and never its presence. This is
what issue #245 asked for on one Scene, held for the whole Story: a mark arrives
with the hand.

This supersedes `docs/adr/0042-the-scene-is-written-where-it-stands.md` whole, and
with it the gate, the surface that covers the bench on a phone
(`docs/adr/0036-the-surface-that-covers-the-bench-is-not-a-dialog.md`) and the
last fold in `app/assets/css/folds.css`. It keeps `0041` — whose layout is the
whole of this one's order — `0034`, `0033`'s typing, `0030`, `0032` and `0035`.

## Considered Options

**A fourth division of the one rectangle.** A fixed rail of Scenes with the
document in a pane that never moves is the obvious repair of `0042`, and it is
where the last three ADRs each started. It fixes the position of the writing and
leaves the premise standing: the drawing still takes a share of the width, the
Author still opens one Scene at a time, and the Story is still only ever read one
Scene at a time. Refused because three layouts have now failed on that premise and
the next number to divide by is not the interesting question.

**The cutting table.** The Story as a horizontal ribbon, a Scene's length being
its number of Shots, branches as lanes, and a fixed desk along the foot for the
Scene under the hand. It is the truest metaphor the product has —
`docs/adr/0006-two-rooms-one-language.md` already calls the graph a cutting table
— and the duration of a Scene becomes free information. Refused on two counts. A
Story that converges does not lay out in lanes, and convergence is common in a
finished work: two Exits arriving at one Scene bend the ribbon and the lane
assignment has to be invented and kept stable. And a Scene of one Shot has no room
for its own name, which was measured on the prototype rather than argued.

**The screening room.** No editor at all: the Author stands in the Reading and
writes into the frame they are looking at, the choice buttons being the Exits,
written where they will be pressed. It is the simplest thing a beginner could
meet, the best of the four on a phone, and it is where `0030` points. Refused
because it contradicts `docs/adr/0006-two-rooms-one-language.md` head on — the
bench is dense and lit and the room is dark and holds one frame, and a room that
takes on the writing stops being a room — and because a Scene no Path reaches
cannot be walked to, which `0030` already admits. Structural work, renaming six
Scenes or renumbering a set of Exits, becomes a walk.

**The contact sheet as the only surface.** Every Shot as its frame, in bands, with
an inspector rail. It is the densest of the four and it is the one that says at a
glance how much of the work is still unillustrated. Refused as the whole answer
because most Shots are text alone, so the sheet reduces the writing to a
three-line caption, and because a Story written before it is illustrated — which
the product allows and which is how the work is actually made — is a grid of
hatched rectangles for the whole of the work that matters. Kept as one of the
three readings, where it costs nothing and answers exactly the question it is good
at.

**The Graph kept as a full surface, reachable by a control.** A document for
writing and a drawing for looking, each whole, one at a time. It is cheap and it
gives back the state `0042` was written to remove: the shape of the Story is off
screen while the Story is being written. The gutter buys the same picture for a
hundred and twenty pixels, and a picture that is always there is read where one
that has to be asked for is not.

**Numbering the document by hand.** Letting an Author drag a Scene up or down the
document to set the order they read it in. It is the same offer `0041` refused for
the drawing, and it fails here for the same reason and one more: the order would
then be a second fact about the Story, stored, able to disagree with the shape,
and `x`/`y` under another name.

## Consequences

**There is no fold that hides anything.** A document is a column of text, and a
column of text is the one layout that works at every width by construction. The
rail folds first, then the gutter narrows to a strip of dots, and the document
keeps the window. Nothing covers the bench, nothing is made `inert`, no tab order
runs through an invisible drawing, and the dead band between 705 and 1040 pixels —
where the gate no longer folds but the table already overflows — does not exist,
because nothing in the layout is measured in pixels of gate. `--phone` in
`app/assets/css/folds.css` goes with the surface it named.

**Every Scene's acts are Commands at the same time.** The Story renders whole, on
the server, as `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md` requires,
so every Scene's controls are in the document and drawn. Until now the bar could
only reach the acts of the Scene under the gate. It can now reach all of them, and
running one scrolls to the control it presses, which is what an Author asking for
an act on a Scene they are not standing in meant.

**A Story is read to be navigated.** Scrolling is how an Author moves, the gutter
is how they jump, the bar is how they name where to go, and `Ctrl`/`Cmd` with the
arrows walks Scene to Scene. A Scene keeps the address `0029` gave it, as the
fragment the document scrolls to.

**The count of controls on screen falls with the fold, not with the Story.** What
is on screen is a column of text and the marks belonging to the rows under the
hand. A Story of forty Scenes shows no more controls at once than a Story of three;
what grows is the length of the document, which is what a long work is.

**Two Remarks come back into the ordinary case.** `0032` had the reading beside the
writing saying two of them in the Scene's own words, and `0042` took that away by
making the reading a face. The rail says every Remark in every reading, so nothing
is dropped and nothing is said twice.

**An Image is a stamp in the margin of the text.** That is the honest cost of the
text reading, and it is why the contact sheet is one of the three rather than an
extra. An Author working visually works in the sheet; an Author working
structurally works in the text; the two are the same Story and the same document.

**A Story with no Scene is an empty document with a caret in it**, not an empty
window with a paragraph in the middle of it. What a new Author meets is a place to
type.

**`x` and `y` stay out of the API and out of the schema.** The order is
`shared/utils/scenes.ts` read as a sequence, in the same pure function, held by
`tests/unit/graph.spec.ts`: that the order is the layout flattened by column then
by row, that it is stable under every write that does not change the shape, and
that a Scene nothing reaches comes last and is marked.

**`GATE_WIDTH` and `GATE_HEIGHT` go.** So does the spreading the layout did around
the Scene being written, and its share of `tests/unit/graph.spec.ts`. The layout
answers one question again.
