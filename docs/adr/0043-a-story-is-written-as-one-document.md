---
status: accepted
---

# A Story is written as one document

The bench is a document. The whole Story is in it, from the Opening Scene to the
last, and an Author writes their Story the way they write anything else: from the
top, downwards, by typing. A Scene is a heading, the Flags it sets on entry, the
run of its Shots, and the ways out of it named by where they lead, with the
Conditions each is offered under. The next Scene is under it. Nothing has to be
opened and nothing closes.

The order is not a new fact about a Story. It is the layout of
`docs/adr/0041-the-graph-is-drawn-from-the-story.md` read as a sequence instead of
as a picture: the Opening Scene, then each Scene in the first column it is reached
in, and within a column in the order the Reader is offered it. The same pure
function answers both, so the order a Story reads in and the shape it draws in
cannot disagree, and neither is placed by hand.

The Graph goes down the left of the document, drawn small, as the rail
`docs/adr/0032-the-bench-reads-the-story-back.md` and
`docs/adr/0034-a-story-is-written-without-the-canvas.md` already call it: the
columns run down the page and the Scenes of a column run across it. It is the same
reading of the same Story, and it is on screen at every width, which is the whole
of what `docs/adr/0042-the-scene-is-written-where-it-stands.md` was for. It is a
locator and not a workspace. It says where in the Story the caret is, it takes a
press to go somewhere, and it marks a Scene nothing arrives at. It never grows,
and that is the point of it. Every layout before this one gave the drawing a share
of the width that the writing then had to win back.

Where there is room for it, the bench says what it has read back out of the Story
beside the document, on the other side. No new word is coined for that side. Both
*gutter* and *margin* already name the column a Shot's number and an Exit's Place
stand in — `app/components/Panel.vue`, `app/components/Conditions.vue`,
`app/components/Flags.vue` — and a word at two scales in one repository is the
thing `docs/adr/0014-the-glossary-is-the-codes-language.md` exists to prevent.
What stands there is the Remarks, which is a word the glossary already has.

The document is read three ways, and a control chooses which. **The text** is the
document above, and it is where a Story is written. **The contact sheet** is every
Shot of every Scene as the Image it carries, in bands, one band a Scene: the Story
seen rather than read, which is how an Author judges what is still a grey
rectangle. **The room** is the Story on the engine a Reader runs, replaying the
Path with the State it has accumulated. The rail and the Remarks do not move
between the three. What changes is what the middle is a reading of, never where
anything is.

Three names out of the grammar of cinema for three readings, against
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`, which puts the
plain word on everything outside the work. The seam holds where that record puts
it: a reading is a way of looking at the work, so it takes the work's grammar,
and the control that chooses between them is a tool of the bench and takes plain
words. Each of the three is a term the moment it is on a screen, so each takes an
entry in `CONTEXT.md` with the word it is shown as in French, in the change that
first draws it.

Typing is `docs/adr/0033-a-scene-is-written-as-one-document.md` unchanged, over a
longer document. One field per Shot, nothing parsed, no Shot losing the id its
Image and its Conditions hang off. `Enter` at the end of a Shot opens the next,
`Backspace` at the head of an empty one joins it to the Shot before, and `Alt`
with the two arrows walks the run. All three stay inside a Scene: `Enter` on the
last Shot of a Scene opens a Shot and never a Scene. A Scene is written by naming
where an Exit leads — `0034` — or by splitting one in two, which
`server/api/scenes/[id]/split.post.ts` already does and which
`docs/adr/0001-branching-only-between-scenes.md` asked for. An Exit is a line at
the foot of the Scene it leaves; naming a Scene the Story does not hold writes it,
and it appears in the document at the place the order puts it.

A control that acts on one row is drawn on that row and reaches full strength when
the caret or the pointer is on it. It is drawn either way, because
`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md` has the
bar ask the browser whether a control is drawn and a control taken out of the
document is a Command taken away. What changes is its weight and never its
presence, so `display: none` is not the mechanism. This is what issue #245 asked
for on one Scene, held for the whole Story.

This supersedes `0042` whole, and with it the gate and the surface that covers the
bench on a phone that `0042` introduced. It supersedes the *beside* of
`docs/adr/0030-a-story-is-read-where-it-is-written.md`, keeping its engine rule,
under the heading below. It keeps `0041`'s layout function, which is the whole of
this one's order, and replaces `0041`'s band across the top of the bench. It keeps
`0034`, `0033`'s typing, `0032` and `0035`.

## Considered Options

**A fourth division of the one rectangle.** A fixed rail of Scenes with the
document in a pane that never moves is the obvious repair of `0042`, and it is
where the last three layouts each started. It fixes the position of the writing
and leaves the premise standing: the drawing still takes a share of the width, the
Author still opens one Scene at a time, and the Story is still only ever read one
Scene at a time. Refused because three layouts have now failed on that premise and
the next number to divide by is not the interesting question.

**The cutting table.** The Story as a horizontal ribbon, a Scene's length being
its number of Shots, branches as lanes, and a fixed desk along the foot for the
Scene under the hand. It is the truest metaphor the product has —
`docs/adr/0006-two-rooms-one-language.md` already calls the graph a cutting table
— and the duration of a Scene becomes free information. Refused on two counts. A
Story that converges does not lay out in lanes, and convergence is common in a
finished work: two Exits arriving at one Scene bend the ribbon, and the lane
assignment has to be invented and kept stable. And a Scene of one Shot has no room
for its own name, which was measured on the prototype rather than argued.

**The screening room.** No editor at all: the Author stands in the Reading and
writes into the frame they are looking at, the choice buttons being the Exits,
written where they will be pressed. It is the simplest thing a beginner could
meet, the best of the four at the width of a phone, and it is where `0030` points.
Refused because a Scene no Path reaches cannot be walked to, which `0030` already
admits, so a Story would hold Scenes its own editor could not open; and because
structural work — renaming six Scenes, renumbering a set of Exits — becomes a
walk through the Story. Not refused on the ground that the bench is lit and the
room is dark. `0006` says the opposite in as many words, "the difference between
them is density rather than hue", and that ground would condemn the option
retained here just as fast, since `0006` also says of the room that nothing else
is on screen and this one keeps the rail beside it.

**The contact sheet as the only surface.** Every Shot as its Image, in bands, with
the detail beside it. It is the densest of the four and it is the one that says at
a glance how much of the work is still unillustrated. Refused as the whole answer
because most Shots are text alone, so the sheet reduces the writing to a
three-line caption, and because a Story written before it is illustrated — which
the product allows and which is how the work is actually made — is a grid of
hatched rectangles for the whole of the work that matters. Kept as one of the
three readings, where it costs nothing and answers exactly the question it is good
at.

**A second view of the Story, as a peer of the Graph.** `0034` refused this and
set the condition on which it could return: "if it is ever built it should be
because an Author asked to read their Story linearly, not because the canvas was a
barrier". That refusal stands and this is not it. A peer view is two surfaces
saying the same thing, which is the arrangement `0034` was right to refuse. This
is one surface, and the reason is neither of the two `0034` named: the canvas is
not the barrier, three layouts of the writing have failed on one premise and the
drawing is what has to move to break it.

**The Graph kept as a full surface, reachable by a control.** A document for
writing and a drawing for looking, each whole, one at a time. It is cheap and it
gives back the state `0042` was written to remove: the shape of the Story is off
screen while the Story is being written. The rail buys a picture that is always
there, where one that has to be asked for is not read. What the rail cannot do is
carry a Story large enough that its columns stop resolving, and that is written
into the reopening condition below rather than claimed away here.

**Numbering the document by hand.** Letting an Author drag a Scene up or down the
document to set the order they read it in. It is the same offer `0041` refused for
the drawing, and it fails here for the same reason and one more: the order would
then be a second fact about the Story, stored, able to disagree with the shape,
and `x`/`y` under another name.

## Consequences

**No fold hides anything, and the Remarks are the test of that.** The Remarks fold
first, then the rail narrows to a strip of dots, and the document keeps the
window. What folds is the width the Remarks are said in and never their voice:
folded, they are a line at the head of the document carrying their count, which
opens them. Nothing covers the bench, nothing of the bench is made `inert` — the
modal `<dialog>` of `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` and
the bar of `0035` still make the page behind them inert, and that is unchanged —
no tab order runs through an invisible drawing, and the band between 705 and 1040
pixels where the gate no longer folds but the table already overflows does not
exist, because nothing in the layout is measured in pixels of gate. Held by an
end-to-end spec at 1440, 1180, 900, 768 and 390, of which 900 and 768 are inside
that band.

**`--phone` stays declared.** Only the bench's use of it goes. `app/assets/css/folds.css`
says the width is read by the landing page and by the list of Stories as well, and
`0041` says the widths there stay two. An ADR that deleted the declaration would
break two surfaces it does not touch.

**The guided path is scoped to a Scene again, and `0019` is amended.**
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md` dropped per-Scene
scoping for one stated reason, that a Scene is written in a panel that holds one
Scene by construction, so there was nothing left to say which Scene. This record
destroys that construction: five of the eight `data-step` targets live inside a
Scene, `app/components/Step.vue` resolves them with `document.querySelector`, and
on a Story of forty Scenes every one of those five would light the first Scene's
field. So a Step names the Scene it is about as well as the target, and resolution
is scoped to that Scene's section of the document; a Step about the Story rather
than about a Scene resolves in the document. The Step already knows which Scene it
is about, because it is a predicate on the Story —
`docs/adr/0020-progress-is-the-story.md` — so nothing is stored to make this work.
Everything else in `0019` stands: nothing modal, no page made inert, no spotlight
taking pointer events, and a target that is absent or unreachable degrading to a
fixed panel carrying the same sentence.

**The nearest voice still wins.** `0032` drops two Remarks while the reading is
saying them in the Scene's own words. That rule is kept and generalised: the room
is the nearer voice for those two while it is the reading on screen, so the
Remarks drop them then and say them in the text and in the contact sheet. `0042`
had already given those two back to the bench, for the same reason in reverse;
what changes here is that they are dropped again exactly when something nearer is
speaking, which is what the rule says.

**The room is not beside the writing, and that is a real loss against `0030`.**
`0030` says an Author reads their own Story in a pane beside the Scene they are
writing and that what they type reaches it. Neither is true of a reading that
takes the middle. What is kept is `0030`'s substance: the same engine a Reader
runs, the Path replayed with the State it has accumulated, the Scene the caret is
in stopped on, and the order of the Exits set on the buttons as they are read.
What answers `0030`'s own reason — that reading is how a line is judged between
two keystrokes — is that the judgement moved into the writing instead of standing
next to it: a Shot's text is set in the reading face at the reading measure in the
text itself, so the line is judged where it is typed. What the room adds is the
Image, the State and the Exits as they will be pressed, and that is a thing an
Author turns to rather than glances at. The `beside` of `0030` is superseded; its
engine rule is not.

**The Path is held above the document, and it opens `UNDRAWN`.**
`docs/adr/0024-the-seed-belongs-to-the-position.md` requires a Reading to open at
`UNDRAWN` and draw once it is in the browser it will stay in, written against two
different Stories either side of hydration. A bench rendered whole by the server
must carry that rule up with the Path, or it reintroduces exactly that split.
Turning from the text to the room and back then resumes the reading the Author was
in. Note what this is not: the seed loss reported in #247 is an implementation
defect of a `v-if` pair that a `v-show` fixes today, on the current branch, with no
record at all. It is not an argument for a layout.

**The bar grows with the Story only in *Go to*.** `0035` refused a bar that
carries everything with an `onclick`, and its coverage rests on an end-to-end suite
that reads the whole bar over a Scene being written. With the Story in the document
that premise is gone, so the rule replaces it: a mark that acts on one row carries
its Command name only in the Scene the caret stands in. The bar therefore offers
the Story's own acts, the acts of the Scene the caret is in, and *Go to* every
Scene — which is what it offers today. What is new is that *Go to* now scrolls to
the Scene rather than opening it, and that an act named on a Scene the caret is
not in is reached by going there first.

**A Scene keeps its address, and the address stays a query.**
`app/pages/stories/[id]/index.vue` reads `route.query.scene`, and it stays that:
a fragment never reaches the server, and a bench rendered whole is a server's
answer. The document scrolls to it. An address to a deleted Scene opens the Story
with nothing written, as it does today.

**The count of controls on screen does not grow with the Story.** This is the
claim the record stands on, so it is measured rather than asserted. *On screen*
is defined as a control whose box intersects the viewport and which is not
`display: none`, `visibility: hidden` or zero-sized, counted from the rendered
page rather than from the template. An end-to-end spec counts them at 1440 on a
Story of three Scenes and on a Story of forty, and the second is no larger than
the first. The number the redesign is answering is 92, measured on the gate.

**Two claims are named for tests and one is not measurable.** The three widths
above, the two control counts, and the layout order held by
`tests/unit/graph.spec.ts` are checks. That the rail carries the same picture as
the Graph did is not one: it is smaller, and how much of a large Story it resolves
is the thing the reopening condition below watches.

**`x` and `y` stay out of the API and out of the schema.** The order is
`shared/utils/scenes.ts` read as a sequence, in the same pure function, held by
`tests/unit/graph.spec.ts`: that the order is the layout flattened by column then
by row, that it is stable under every write that does not change the shape, and
that a Scene nothing arrives at comes last.

**`GATE_WIDTH` and `GATE_HEIGHT` go**, along with the spreading the layout did
around the Scene being written and its share of `tests/unit/graph.spec.ts`. The
layout answers one question again.

**`CONTEXT.md` is amended when the gate goes, not now.** The glossary describes
the product, and its `Graph` and `Preview` entries describe the gate because the
gate is what the screens show until this is built. They change in the change that
removes it, and `0014` is the reason they cannot be left describing a surface that
is gone. The same change re-points `0033` and `0037`, which say `superseded by
0042`, so that nobody tracing the typing rule crosses two dead records to reach a
live one. `0036` is not superseded here: it already says `superseded by 0041`, and
the covering surface this removes is the one `0042` introduced.

**Reopening condition.** This is the fourth layout in as many records, so it is
owed one. Reopen it when an Author cannot find a Scene in their own document —
when the rail stops resolving a Story large enough, or when scrolling stops being
how anyone gets anywhere. The answer then is a better reading of the Story in the
rail, and only after that a second surface. It is not reopened by a Story being
long: a long work is a long document, and that is the shape of the thing rather
than a defect in it.
