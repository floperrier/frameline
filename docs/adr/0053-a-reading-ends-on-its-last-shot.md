---
status: accepted
---

# A Reading ends on its last Shot

A Reading ends where the Scene it stands in has played its last Shot and offers
no Exit, and at that moment the product took the screen back from the Author.
The last frame was pushed back as if a choice stood in front of it, a sentence of
the interface's own was set under it between two leader lines, and a bed held in
a loop went on looping for as long as the tab stayed open. The ending is given
back to the work, and the Author writes it with what they already write.

**The last Shot is the ending, shown whole.** The push back halves the image and
mutes the text because it sets the frame behind a choice, and at an ending there
is none. So the frame a Reading ends on is drawn as it was while it played. It is
not thrown a second time either, since it is not arriving: the one part of the
push back that is not a dimming stays.

**Its own Cut says how the Reading leaves the screen.** The move into the ending
is cut hard, as every end of a run is. What the last Shot's Cut says, resolved
against its Scene by `cut()`, is then made on the frame that stands. Through
black over a time, the frame goes to black over the whole of that time and stays
there, on the room the Reading is drawn on. Mid-run a passage through black
spends half its time going out and half coming in; at the ending nothing comes
in, so the seconds the Author wrote are all spent going out. A hard cut has
nothing to be. A dissolve is one image going into the next, and with no next
image it would be a fade to black under another name, which the Author has *A
fade to black* for in the same `<select>`. Both leave the frame standing, and an
Author whose Scene is written through black keeps its ending on the screen by
saying *Hard* on the last Shot's row.

The fade is on the frame, which keeps its box, so nothing under it moves as it
goes. It stays in the accessibility tree: `inert` is for a passage that puts two
beats on screen at once, and the ending has one, whose words are what the Story
ended on. Under `prefers-reduced-motion` the ending goes to black at once. The
media query takes away the time a passage takes and has always left its end
state in place, and the black is where the Author ended the Story while the fade
is the decoration on it — the line
`docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` draws between a
hold and a dissolve.

**This completes `0050`'s end of a run rather than contradicting it.** `0050`
cut the move that ends a run hard because the frame goes on holding the last Shot
behind the ways on, and spending the Scene's Cut there dissolved an image into
itself, or took it to black and back, before the Exit made a second passage a
moment later. None of that holds at an ending. The screen does change, from the
frame to black, and stays changed. There is no Exit to make a second passage, and
no way out of the Scene for the Scene's Cut to reach. So the move stays hard, and
at an ending — only there — the last Shot's own Cut is made once the move is,
which is the one thing left for it to describe. When it is made is when it always
was: at the press past the last Shot, or at the time its hold says.

**A bed held in a loop plays out its pass.** A Reading that ends in a Scene never
leaves it, so a loop there would repeat for as long as the tab stays open. At the
ending the element's `loop` is let go of and it finishes the pass it is in and
stops by itself. There is no envelope: `0049` refused one on the bed, and iOS
Safari ignores `HTMLMediaElement.volume`, so a fade would need a second audio
pipeline for one element's behaviour. A step back off the ending gives the loop
back, and a bed that played out while the Reader stood there is played again
from its beginning, which is where any bed starts, since nothing records where
one had got to. *Read Again from the Start* under the same carrier is the same
case.

**The last Shot's own Sound and its Transcript go on past the end of its run.** A
strike is stopped by the next beat and by nothing else, and the move that ends a
run is no beat, so the frame still holding the Shot goes on being heard, at an
ending and behind the ways on alike. Its Transcript is read off the Shot the frame
holds for the same reason.

**The interface says nothing on the screen at the ending.** Any sentence it set
there would be the product speaking over the Author's last frame, in the Locale
rather than in the Story's Language, which is what
`docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md` refused for a
door that closes. A Story that wants the end said says it in a Shot, and an end
card is a last Shot with no Image. The status region stays, in the document from
the start and empty until the ending, so a screen reader still hears the ending
as a change to a node it already holds; it is `visually-hidden` rather than drawn
between leader lines, and it says *The Reading ends here.*, since what ends is
the Reading and not the Path. *Read Again from the Start* is drawn at the ending,
and only there, with the weight *Next Shot* had, so the controls tell a Reader
who is looking what the sentence no longer does.

## Considered Options

**A sentence at the ending, this one or a better one.** The product speaking over
the work, refused above.

**A column for the ending**, a card, a Sound or a Cut kept on the Story or the
Scene for its ending alone. The last Shot's Cut already says how it leaves the
screen and the Scene's Sound what it is heard under, and a second carrier for the
same fact is two settings that can disagree, which `0047` and `0050` each refused.

**A term for it.** *Ending* stays an ordinary word. What the Author writes is a
Shot, a Cut and a Sound, each already named, and the cinema words, *end card* and
*carton*, stop at the edge of the work —
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`.

**Half the duration through black at the ending**, as the out half of a passage
mid-run. It spends half of what the Author wrote on a moment with nothing to spend
the other half on, and the panel says a Cut takes the seconds written.

**Spending the Scene's Cut at every end of a run again.** Refused by `0050` for a
run that ends on ways on, and not reopened here.

**A fade on the bed, or stopping it at the ending.** The one is an envelope `0049`
refused; the other cuts the Author's Sound mid-pass on a press the Reader made to
see the ending rather than to silence it.

**The ending on the last Shot itself**, with no press past it. It would move
`ended` onto a Path with a Shot still on screen, which changes what `resumes()`
refuses and what the clock presses, and take the *when* of the last Shot's Cut
away.

## Consequences

- Nothing changes in the engine. `ended` and `cut()` were already there, `Path`
  gains nothing, and `resumes()` still refuses to put a Reader back at an ending.
- A Story written before this reads differently in five places, all at the end of
  a run, which `docs/adr/0002-the-schema-moves-with-the-deploy.md` allows where the
  change says so: the last frame is not dimmed, the sentence under it is not seen,
  a last Shot whose Cut resolves through black ends on black, a looped bed under
  the ending stops after its pass, and the last Shot's Sound and Transcript go on
  past the move that ends its run.
- A Cut is not a position. A Preview mounted again over a Path the bench holds at
  an ending plays the fade again, and the bed once more from its beginning.
- The Pause does not stop the fade. It is the Cut rather than an Effect, and no
  passage mid-run is stopped by the Pause either.
- *Reel Change* ends through black, and both Samples end through black under room
  tone that plays out its pass.
