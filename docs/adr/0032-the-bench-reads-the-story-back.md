---
status: accepted
---

# The bench reads the Story back

The bench draws a Story. It now also reads one: it reports what it finds in the
Story — the Scenes nothing arrives at, the Shots nobody has written, the Images
with no Description, the Flags set and never tested, the Flags tested and never
set, the Conditions that can never hold — as a count above the graph that opens
into a list, each line pressing to the Scene it is about.

A Remark is advisory and never a refusal. Nothing here blocks a write, marks a
Story invalid, or corrects anything. Every one of these findings is a state an
Author is entitled to be in the middle of, and a finished Story may carry some of
them on purpose.

## Considered Options

**Nothing, which is where the field is.** The survey in
`docs/research/2026-08-27-paysage-concurrentiel.md` reads nineteen tools in
primary sources and finds exactly one — Chat Mapper Cloud — that validates
structure at all, and that one documents that it cannot find a variable nobody
uses. Twine counts broken links in a statistics panel. Arcweave, Charisma,
Dialogue Designer, Naninovel and Fungus have nothing. Doing nothing is therefore
the option with the most company and the least defence: an Author who has written
forty Scenes has no way to learn that one of them is unreachable except by
reading all forty.

**Refusing the write instead.** A Scene that nothing reaches would fail to save,
a Condition on an unset Flag would be rejected. Refused outright: every one of
these states is a Story mid-sentence. A Flag is set before it is tested, a Scene
exists before an Exit reaches it, and a Shot is added before it is written. A
product that refused them would be refusing the act of writing.

**Marking each card and each row where the defect is.** A badge on the node, a
warning beside the Condition. Rejected on two counts. It puts the count nowhere:
an Author would have to sweep the whole bench to learn how many there are, which
is the problem this exists to solve. And a mark on a card is a mark on a card an
Author cannot see — most of a graph is off the fold, which is the same argument
`docs/adr/0010-the-graph-is-written-here-not-pulled-in.md` makes about the zoom
controls not floating over the surface.

**Validation on the server, travelling with the Story.** Rejected as work for
nothing. Every input is already in the browser: the editor fetches the whole
Story and reads it back after every write, so a reading computed here cannot
disagree with the screen, costs no request, and updates as the Author types. It
is the same argument `docs/adr/0020-progress-is-the-story.md` makes for the
guided path, and the Remarks are computed the same way for the same reasons.

## Consequences

**It is cheap because two earlier decisions made it cheap.**
`docs/adr/0004-conditions-stay-flat.md` keeps a Condition a flat test rather than
an expression, so what a Story tests is a list to be read rather than a tree to
be walked; and a Scene declares the Flags it sets, so what a Story sets is a list
too. Holding the two against each other is an intersection. Had either decision
gone the other way this feature would have been a static analyser. The record is
worth keeping for the argument as much as for the feature: it is the second time
the flatness has paid for itself.

**A visit count is not read.** Whether a Scene can be entered often enough for a
Condition to hold is a question about the routes through the graph, not about a
list of values, and a wrong answer is worse than none: an Author who meant a
Scene to be enterable twice would be told their Story is broken. That question is
the Preview's, which walks a real Path.

**The reading has no memory and nothing to dismiss.** A Remark is not a task, is
not acknowledged, and is not stored. It is there while the Story is in that
state and gone when it is not, which is what makes it impossible for the list to
be wrong about the screen. The cost is that a finding an Author has decided to
live with is a finding they go on seeing; the count says how many, and a count of
two that never moves is a smaller cost than a list that has to be kept in step
with a store of dismissals.

**A Remark leads to the Scene, not to the field.** Pressing one puts the Scene it
names on the writing surface and stops there. Scrolling the Author to the exact
Condition would mean the reading knowing how the panel is laid out — which tab
holds what, which row a Condition is in — and that is a coupling between a pure
function and a template that
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md` already refused
once, for the guided path, by making the template name its own targets.

## The two things beside it

Two smaller decisions ship with this one and are recorded here because they are
the same thesis — the bench understanding the Story rather than only drawing it —
and neither is large enough to be a record of its own.

**A Scene born from an Exit is placed beside the Scene it leaves**, where no hand
named a point. `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md`
places a Scene at the drop point, which is the pointer's answer; the keyboard has
no point to give, and the Scene used to be laid at the next free spot in a column
of `NODES_PER_COLUMN` — the far end of the bench from the Scene it was joined to.
Beside it, the two routes into the same gesture arrive at the same kind of
drawing. Nothing already placed moves: a placement is a written fact the moment
it exists, and a graph that rearranged itself under a hand that had just dragged
a card would be taking that fact back. This is not automatic layout, which
`0010` and `0007` refuse; it is where one new card lands.

**The bench still opens at the surface's own size**, and this record says so
because the opposite was written first and taken out again. A graph larger than
the window opens showing a part of itself, which reads as a defect until the
scale is worked out: fitted, a Story of forty Scenes is drawn at a quarter — the
bound `ZOOM_MIN` names as where forty Scenes fit at once — and at a quarter the
shape is legible and not one word on a card is. The end-to-end suite is what
made the arithmetic concrete. So the fit stays a press, with its own control and
its own shortcut engraved above the bench, and the scale goes on being written
nowhere: it is the Author's view of their own work rather than part of it.
