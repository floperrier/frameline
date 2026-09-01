---
status: accepted
---

# A Story is written without the canvas

Everything an Exit is is written in the document of the Scene it leaves: where it
leads, the words a Reader presses to take it, the Conditions it is offered under,
its Place among the ways on, the duplicate that gives it an opposite, and the mark
that takes it away. A way on is added there too — to a Scene the Story already
holds, or to one that does not exist yet, which writes that Scene beside the one
it leaves and joins the two.

Nothing about a way on is written on the graph any more. The drawing keeps what a
drawing is for: the line, the arrowhead, the disc that reports the Place, the
endpoint dragged to lead an Exit elsewhere, and the rim an Exit is drawn from. A
press on a line opens the Scene the Exit leaves, so the drawing is a way to the
writing rather than a second place to write.

With the field above the bench that goes to a Scene by its name, an Author can now
write, correct and publish a whole Story without once using the canvas.

_The field is gone and what replaced it does more; the rest of this record
stands._ Reaching a Scene by naming it turned out to be one case of naming
anything the bench can do, and a second such field beside the first would have
been the very thing this record refuses two paragraphs down. Every Scene is now
one entry in the bar of Commands — see
`docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md` — along with
the acts that publish the Story and write in the Scene on the surface.

## Considered Options

**Leaving the Exit's text on its own line**, which is where
`docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md` put it, on the argument
that what a Reader reads on a button should be written where it can be seen
leading somewhere. The argument is good and it lost to a bigger one: an Author who
never opens the canvas could not phrase a single choice in their Story. The graph
is a drawing of a structure, and a drawing is not an input device everybody has.
Pointer-only authoring was never the intention —
`docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md` says outright
that a gesture that creates may not be the only way to create — but it was the
effect for the one thing a Reader actually reads.

**Writing it in both places.** Refused. Two fields for one value is the glossary's
objection to two words for one thing, in controls: an Author would have to learn
which of them their Story is in, and the two would drift the first time one grew a
placeholder the other did not have.

**A second view of the Story — a list of every Scene as a peer of the graph.**
Designed and not built, because it turned out not to be the thing that was
missing. Once a Scene's document holds every way on out of it, and every way on
names where it leads, the Story is already a list you can walk: the rail gives the
Scenes, the field above the bench gives any Scene by name, and each Scene's ways
on give the next step. A second view would be a third representation of a Story
the bench already draws twice. If it is ever built it should be because an Author
asked to read their Story linearly, not because the canvas was a barrier — that
barrier is what this record removes.

**An endpoint dragged into empty space to delete.** Still refused, for the reason
`0031` gave: an Exit carries text and Conditions, and a hand slip may not destroy
work nothing on the screen shows being destroyed. The mark at the end of the way
on's own row is the deliberate act, named for what it takes.

## Consequences

**The graph loses about two hundred lines and gains nothing.** The box hung from
the midpoint of a line, the button hidden on it, the field in it, the three
controls beside that field, the lit line under it and the state that kept exactly
one of them open have all gone. What is left of an Exit on the bench is geometry.
That is a simplification bought by the move rather than paid for by it.

**A way on costs a row of about ninety pixels**, which is two fields side by side
and a line under them shared by its Conditions and its four marks. A Scene
offering five ways on is therefore some four hundred and fifty pixels of ways on,
under its Flags and its beats. That is the honest cost of putting everything on
one surface — see `docs/adr/0033-a-scene-is-written-as-one-document.md` — and the
reopening condition is the same one: if a Scene with many ways on stops being
readable, the answer is a shorter row and not a tab.

**The field that says where a way on leads offers what the aiming offers.** Both
ask `scenesAExitMayLandOn`, so the gesture and the control cannot disagree about
where an Exit may land: never the Scene it leaves, and never a Scene that Scene
already reaches. The Scene a way on already leads to is added to its own field,
because a select whose value is not among its options is a control that has lost
its own state.

**A second way on to the same Scene is still only written on purpose.** Neither
the gesture nor the field offers a Scene already reached, and the duplicate is a
control on the way on's own row — the moment an Author means to write the opposite
Condition.

**Two writes, not one transaction.** A way on to a Scene that does not exist yet
writes the Scene and then the Exit, which is the seam `0031` accepted for the same
pair on the canvas: an Exit refused after the Scene was written leaves a Scene on
the bench under its provisional name, and the refusal beside the surface says so.
