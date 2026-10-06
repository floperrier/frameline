---
status: accepted
---

# A text arrives in its own time

A Shot's text landed in the same tick as its Image, and stood until the Cut took
both. What an editor has and an Author here did not is the words' own time: an
Image alone for a moment before them, a title fading up onto it, a line coming
word by word, a line that leaves while the Image stays.

**A Scene says, a Shot answers, in the Cut's shape.** `text_after`, `text_by`,
`text_pace`, `text_over` and `text_stays` sit on `scenes` with defaults and on
`shots` nullable, null being *as the Scene says* — column for column what
`docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` did for the Cut.
Every column has a default or is nullable, and the defaults are every Story
written so far, each text landing with its Image, whole and at once, and staying
until the Cut, so nothing written before this reads any differently.

**Nought on a Shot's stay means *stays*.** A text staying no time is never seen,
so nought is free for the one answer a Shot under a Scene whose texts leave has
no other way to give, as with a Shot's `cut_after`. A Scene's `text_stays` refuses
nought, as its `cut_after` does, because there is nothing above a Scene for it to
mean.

**The pace is in characters a second, under every unit.** A pace for each unit
would mean something else the moment a Shot changed its Scene's unit, and a total
duration would crawl on a short line and race on a long one. A unit comes when the
characters before it would have, so a longer one is followed by a longer wait. The
default is the pace a text is read at, which is why the two are one constant.

**`text_over` defaults to nought.** Every text today appears at once, and a default
of two hundred milliseconds would fade up every text of every Story written so far,
which is the arrival `#349` takes out of the hard cut. The brief fade is what the
panel writes when an Author first makes a text arrive.

`prefers-reduced-motion` reads every `text_over` as nought, as it does every
`cut_over`: the durations go to nothing, and the wait, the cadence and the stay
stand. A text does not wait for a passage that takes no time.

**The hold counts from the text having arrived.** Counted from the Image landing,
an arrival could outlast the hold and be cut off, or be silently compressed to fit
it. Counted from the last part having appeared, the clock never cuts a text short,
and the price is a fixed total for the beat, which a run wanting an even pace pays
by writing whole texts after a fixed wait. A text that leaves does so by the clock
too, from its having arrived, and where the hold is shorter the Cut takes it with
the Image.

**The first press shows the rest.** `0050` said the press always cuts early. For a
text still arriving that cuts the words off before they are read, so the press
shows all of it and the next press cuts, and the Path does not move in between.
The control is named for what its press does — *Show the Whole Text* until the
text is whole and *Next Shot* after — because a Reader by ear already has the text
and would otherwise meet a press that seemed broken. The clock never makes the
first press, since it arms only once the text is whole, and a Reader ahead of the
clock still never waits for it.

**A Reader by ear has every word as the Shot lands.** An arrival is drawn in
opacity, which leaves the accessibility tree alone, so a waiting, arriving or
departed text is read whole from the start, after the Image's Description, for as
long as the Shot is on screen: behind the ways on, a text that left draws no
caption at all. Nothing
is announced on completion, which would be the Story talking over itself.

**A pause shows every text whole, and a hidden tab freezes the arrival.** A paused
Reader reads by hand and cannot read half a text, so pausing mid-arrival shows the
rest, and a beat pressed onto while paused shows its text whole. A tab that is
hidden is not paused: the arrival is drawn rather than timed, so it stops and
resumes where it stood, while the hold, which is a clock, restarts. A text is not
a position, for the reason `0050` gave of the Cut, so a Reading resumed lands its
beat afresh and the text arrives again.

## Considered Options

**A default `text_over` of two hundred milliseconds.** It would fade up every text
of every Story written so far.

**A total duration, or a pace for each unit.** The first fails Shots of different
lengths, and the second means something else under each unit.

**A separate duration for leaving, or a chosen easing.** The first is the same fact
read backwards, and the second is a look, which is not this decision's to settle.

**The pause freezing an arrival.** A frozen half of a text cannot be read.

**The arrival timed through `clock()`.** A restart would take words off the screen
and bring them back.

**Announcing the text on completion.** The Story talking over itself, at a pace
written for the eye.

**`Intl.Segmenter`'s words, or lines as the browser wraps them.** The first splits
*nine.* from its full stop where `wordsOf` does not, and the second depends on a
width the Author cannot see. A line is a line break the Author typed, a word is a
run of anything but white space, and a letter is a grapheme.

**A text leaving by the unit, or a stay counted from the landing.** Unsaying word
by word is a look, and every change to the wait or the pace would need the stay
changed by hand.

**Arrival on Exits, Descriptions and Transcripts.** An Exit must be readable when
it can be pressed, and the other two are never staged for the eye.

**A Story-wide default**, the Cut's refusal read again, **or the arrival on the
Contact Sheet**, which is still and silent.

**A term of its own.** *Reveal* names what the product does to the text,
*typewriter* is one cadence of four, *subtitle timing* treats the text as a
subtitle, which the Transcript already refuses, *title card* and *intertitle* are
a text-only Shot, and *delay* and *fade-in* are the Cut's words. The plain verb
needs no entry — `docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md`.

## Consequences

- Every Story written so far reads exactly as it read, and the Contact Sheet is
  unchanged.
- The bounds sit at the request boundary and as constants beside the Cut's: a wait
  of up to ten seconds, a pace from one to sixty, a time to appear of up to three
  seconds and a stay of up to a minute.
- *Reel Change* and both Samples use all of it, and the bench's Remark that a Shot
  is too brief is rewritten to count the time a text is on screen once it has
  arrived, and to speak of a text that leaves under the press.
