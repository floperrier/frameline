---
status: accepted
---

# A swipe across the frame is a press

Keeps the refusal in `docs/adr/0055-a-shot-is-laid-out-as-its-scene-says.md` of
*a press anywhere on a `full` frame as Next Shot*, and says why a swipe is not
that press. Decided on 2026-10-02, issue #406.

A Reader on a phone or a tablet reads with their thumb. Before this, the only way
on was *Next Shot* under the frame, every beat. On a 390 × 844 phone, *Reel
Change*'s opening beat is laid out full, and its *Next Shot* stands below the
bottom of the window. Issue #391 gave a keyboard Reader a key, but a touch screen
has no keys. A phone browser offers no Full Screen to get out of the page either,
and Safari on an iPhone cannot give an element the screen at all.

**A finger crossing the frame horizontally is a press.** Towards the leading edge,
which is right to left in both of the interface's Languages, it does what `Space`
does: it shows the rest of a text still arriving, cuts to the next Shot, and does
nothing where the Scene is offering its Exits. The other way it does what `←`
does, which is *Step Back*, and only where *Step Back* is drawn. Both directions
go through the same `went` in `app/components/Reading.vue` that the keys do, so
the focus and what is announced are a key's.

**What counts as crossing is one pure function, `swiped` in `app/utils/swiped.ts`.**
The finger has to travel at least 48 CSS pixels across, at least one and a half
times as far across as down, and lift within 800 ms. Anything else is a tap or a
scroll and does nothing to the Path. The numbers are a starting point nobody has
tuned on a device, and they are three constants in that one file.

**Only a touch counts.** A mouse or a pen dragging across the frame selects its
words, as it always has, and nothing on the frame prevents the browser's answer
to any pointer. The swipe is heard on the frame alone, and the frame holds no
control. A touch that starts on an Exit, on *Show the Whole Text* or on a trail
button is therefore the control's. It works the same under Full Screen and in the
Preview, which draws the same component, because an Author with a tablet reads
there.

**The frame carries `touch-action: pan-y pinch-zoom`.** A finger going down the
frame scrolls the page in either Layout, and the browser does not claim a finger
going across. Issue #406 asked for `pan-y` alone, which would also take away
pinch-zoom on the frame. Under `full`, the frame is the whole window on a phone,
so that would take zoom away from the page. Zooming into the picture is a way of
looking at it, and looking is what this decision protects.

## Why a tap is still not a press

0055 refused a press on the picture because *a Reader pressing the picture to look
at it would be carried on by accident*. That refusal is about looking. A finger
that rests on the picture, holds it or taps it is looking at it, or is on its way
to zoom into it, and none of that moves the Path. A finger that crosses the frame
from one side to the other has not been looking. It has made a gesture whose only
reading on a touch screen is to turn the page, and leaving that gesture unanswered
would be the accident instead.

## Why the frame does not follow the finger

The swipe is read once the finger lifts, and what it triggers plays its Cut
exactly as a press of *Next Shot* would. The Cut is the one passage between two
beats, and the Author wrote it (`docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md`).
A frame dragged under the finger would be a second passage the Author never wrote.
It would be a page turn played over a dissolve or a passage through black, and a
beat half-dragged and let go would show the Reader a frame between two Shots that
no Story contains.

## Considered Options

**A tap zone, the left or right half of the picture.** 0055 refused it, and this
keeps that refusal.

**A swipe-specific Cut, or a page-turn animation.** Refused for the reason above.

**Choosing an Exit by swiping.** An Exit is a choice among several, and a
direction offers only two.

**A visible hint that swiping exists.** *Next Shot* stays drawn and remains the
documented way on. A Reader who never swipes loses nothing.

## Consequences

- Nothing has to be done about edge swipes. The ones a browser keeps for its own
  back gesture never reach the page.
- Nothing handles right-to-left text yet. A Language written right to left would
  turn `swiped`'s direction around, which is one more argument to that function.
