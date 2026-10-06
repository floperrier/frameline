---
status: superseded by 0041
---

# A Scene is born from an Exit dropped on the bench

Superseded by `docs/adr/0041-the-graph-is-drawn-from-the-story.md`: nothing is
dropped on the bench any more. A Scene is born at the foot of another, by naming
where a way on leads under a name nothing answers to — the same two writes, one
change and not one transaction, from a field rather than a gesture.


An Exit is drawn from a card and dropped. Dropped on another card it joins the
two Scenes, which is what it has always done. Dropped on bare bench it makes a
Scene at that spot, already joined, open for writing with its name selected so it
can be named at once. The gesture that says "there is a way on from here to
somewhere that does not exist yet" is the same gesture as saying where that
somewhere goes.

The form that names a new Scene in a corner of the toolbar goes away with it.
Naming a Scene before there is anywhere for it to come from is the step this
removes, and leaving both would be two ways to make a Scene — the glossary's
objection to two words for one thing, in gestures.

## Considered Options

**The drop on bare bench refusing**, which is what happens today: the line snaps
back and nothing is made. The Author who wanted a new Scene there leaves the
Graph, finds the form, types a name for a Scene that has no place and no way in
yet, comes back, finds the card wherever it was put, drags it where they meant
it, and only then draws the Exit they were already drawing. Six steps for one
intention, and the first of them is naming a thing before knowing what it is —
which is the worst moment to ask an Author for a name.

**A drop on bare bench that makes an unjoined Scene**, leaving the Author to draw
the Exit. It saves nothing: the drawn line is already the statement that these
two are joined, so throwing it away and asking for it again is the interface
disbelieving the gesture it just watched.

**One endpoint that creates and joins in a single request.** Rejected on the
seam, not on the ergonomics. Creating a Scene and creating an Exit are two
endpoints that exist, are tested, and enforce their own limits; a third that does
both would be a new API contract carrying a copy of both sets of rules for one
gesture's convenience. The interface makes the two calls it already makes.

**Deletion by the same gesture reversed** — an endpoint dragged off a card and
dropped in empty space, which is a symmetry Arcweave offers. Refused, below.

## Consequences

**The gesture creates, and creating is safe to be wrong about.** A Scene made by
a slip is a card sitting on the bench, visible, empty, named nothing yet, and one
delete away. That asymmetry is the whole reason the drop may create without
asking: what it makes is inspectable and reversible by the Author who made it.

**The same gesture reversed does not delete.** An endpoint dragged into empty
space leaves the Exit exactly where it was. An Exit carries its own text and its
own Conditions — work that took thought and that nothing on the screen would show
being destroyed — so removing it with a hand slip is not the mirror of creating
with one. It is the case
`docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` exists for: a
destruction is confirmed, on the bench, in the interface's own words. An endpoint
dropped on another card rewires the Exit instead, which is the destructive-looking
gesture put to the use that keeps the text and the Conditions.

**Two calls mean a state between them.** If the Scene is created and the Exit is
refused, a Scene stands on the bench unjoined. That is the accepted cost of
refusing a combined endpoint, and it is accepted because the failure is visible
and repairable: the Author is told the Exit was refused rather than left to
wonder, and the Scene they can see is a Scene they can delete or draw to
themselves. The alternative — deleting the Scene again on the Author's behalf —
throws away a Scene they asked for on the strength of a second failure, and can
itself fail.

**The Scene is born where it was dropped.** Its coordinates are the drop point,
so the layout is the Author's from the first frame and nothing lays a new card
out for them. That is the other side of
`docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md`: the drawing is
theirs to arrange, and the one thing here
that reads a position off the screen writes it as a position and infers nothing
else from it.

**Both ends of the gesture are reachable without a pointer.** Drawing an Exit
already has a keyboard route into aiming, and that route can now also make the
Scene it aims at — a gesture that creates is not allowed to be the only way to
create if it can only be performed with a hand on a mouse.

**The guided path loses a Step and re-anchors another.** The Step that pointed at
the naming form has no form to point at; it points at the gesture that replaced
it, or it goes, per
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md`.
