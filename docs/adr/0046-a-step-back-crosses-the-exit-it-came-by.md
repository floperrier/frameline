---
status: accepted
---

# A step back crosses the Exit it came by

A Reading moved only forward. The one control that undid anything read *Read
Again from the Start*, which throws the whole Path away, so a Reader who pressed
the frame one beat too early, or took an Exit they did not mean to, paid for it
with the twenty presses that got them there. Every medium this product borrows
from lets its reader look back a beat: a page is turned back, a reel is wound
back a few seconds, and only here was the last press final.

**Stepping back is a Path one term shorter, and nothing else.** Inside a Scene it
is one fewer Shot. On the first Shot of a Scene it is the last Exit untaken,
landing at the end of the Scene that Exit left — past its run, where its ways on
are on offer again, which is the screen the Reader was looking at when they chose
wrong. Nothing is unset, nothing is remembered, and no second record of where the
Reading has been is kept: `back` in `shared/utils/reading.ts` slices the Path and
hands it back, and the engine works out the rest as it works out everything else.

**Crossing the Exit is safe, and that is the whole of what this record settles.**
The fear is the reasonable one: a Scene sets its Flags on entry, so a Scene
entered, stepped out of backwards and entered again might set them twice. It
cannot, because there is nowhere for a second setting to land. State is a pure
function of the Path — `docs/adr/0024-the-seed-belongs-to-the-position.md` — and
the walk builds it from empty on every read. A Path with its last Exit dropped is
not a Path whose effects have been rolled back; it is, byte for byte, the Path
the Reader was standing on before they took that Exit, and what it computes to is
what they held then. Taking the Exit again walks the same Exits in the same
order: the visit count comes back to the number it was, the draw keyed on that
count comes out with the value it came out with, and a Flag written over is
written over again. A Reading that stepped back and went on again is
indistinguishable from one that never stepped back, because the two are the same
Path — which is the claim the engine's spec makes directly rather than a property
this record asks anyone to believe.

The seed travels with the Path, so a step back is not a reroll: the Story stepped
back into is the Story that was read, down to every value drawn in it.

## Considered Options

**Stopping at the first Shot of the Scene**, so a step back never crosses an
Exit. It is the cautious reading of the Flag question above, and it gives up
precisely the case the control exists for: the wrong press a Reader most wants
back is the Exit, not the Shot. It would also be a control that works until the
moment it is needed and then declines, which is worse than one that is not there.

**Keeping the Paths behind as a stack**, pushed on every move and popped by the
control — the undo history this would be in most products. It is a second fact
about where the Reading has been, kept beside the one fact that already says it,
and two facts can disagree: a Path read back out of storage arrives with no stack
behind it, and a Reader who left and came back would have a Reading that cannot
step back until they have moved again. The Path *is* the history. Slicing it
costs nothing and cannot drift.

**Unsetting what the Scene set**, walking the Flags backwards as the Exit is
crossed. It is the design this architecture exists to avoid: a Flag written over
by a later Scene has no earlier value to restore, and a draw undone is a draw that
has to be remembered. It is unimplementable in general, and unnecessary in
particular, which is the two halves of `0024` doing their work.

**Leaving *Read Again from the Start* as the only way back.** What was there.
The Story is the thing the Reader is meant to lose themselves in, and a medium
where one mistaken press costs the whole traversal teaches them to press
carefully instead — which is the opposite of reading.

**A step forward to match it**, so a Reader who stepped back too far is put
where they were. The Story is read forward by reading it: the press is already
on screen, and a second history — this time of moves undone — would be the stack
refused above, only harder. Nothing is written for it until a Reader asks.

**Standing the control beside the press that moves on**, where the hand already
is. It cannot stay there: once the Scene has played out that press is gone and
the Exits are in its place, and a control that undoes the last move would then be
sitting between the frame and the choice being offered — in the one list that
must be read as the Story's own. So it stands with *Read Again from the Start*,
under everything it is a way back out of, at the trailing edge where both ways
back are together and neither interrupts the reading.

## Consequences

**`back(story, at)` is the fourth move in the engine**, beside `advance`, `take`
and `opening`, and the first of them to need the Story: how long the run of the
Scene stepped back into is is the one thing the Path cannot say for itself. It is
the run this Reading plays and not the Scene the Author wrote, so a Shot a
Condition skipped on the way in is skipped on the way back.

**It is offered exactly where reading again from the start is offered**, which is
`moved()` — a Reading that has taken no Exit and is still on the Shot it opened
on has no beat behind it. The two controls therefore share one row and one
condition, and the very first beat of a Story carries neither.

**The Preview has it because the Preview is the Reading.** Both draw
`Reading.vue`, so an Author testing a Condition steps back a beat rather than
rerolling from the Scene, and the writing follows: the pane already watches which
Scene the Reading stands in and moves the document to it, so stepping back across
an Exit turns the bench back to the Scene that Exit left. See
`docs/adr/0030-a-story-is-read-where-it-is-written.md`.

**A step back is kept like any other move.** The Reading written to the browser
is the whole Path on every change — `docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`
— so a Reader who steps back and leaves comes back to where they stepped back to,
and `resumes` reads that Path exactly as it reads any other.

**Reopening condition.** Reopen this the day State stops being a pure function of
the Path: a Flag set by something a Reader does rather than by entering a Scene, a
count kept on the server, anything at all accumulated outside the Path. Crossing
an Exit backwards would then need the unwinding this record calls unnecessary,
and the honest answer would be to stop crossing rather than to start unwinding.
