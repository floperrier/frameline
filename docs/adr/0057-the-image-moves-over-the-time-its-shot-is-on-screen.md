---
status: accepted
---

# The Image moves over the time its Shot is on screen

A still Image stood motionless for as long as its Shot was on screen. What a film
has and a Story here did not is the picture moving inside its frame: the slow
approach to a face, the drawing away that shows the room, the slide across a
landscape. That is the **Movement**, the Image moving in the frame across the
time its Shot is on screen. The frame does not move and the Image moves in it,
which keeps *frame* the surface and never the thing shown, as
`docs/adr/0006-two-rooms-one-language.md` requires.

**The Movement is a Scene's grammar, and a Shot answers for itself.** A Scene says
how the Images of its run move in `movement_by`, `movement_direction` and
`movement_over` on `scenes`, `integer not null default 0`, `text not null default
'closer'` and `integer not null default 0`; a Shot answers in the same three on
`shots`, nullable, where null is *as the Scene says*. It is the Cut's shape column
for column, and `movement()` in `shared/utils/reading.ts` is the one place the two
are resolved, field by field, beside `cut()`. A run that moves throughout is a
Scene's manner, like its pace, and written Shot by Shot it is forgotten on the
Shot added later. There is no Story-wide Movement above the Scene's, for the
reason the Cut has none.

**Zero is what is not seen, twice**, as
`docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` reads its own. An
Image moved by nought is not moved, so *still* is `movement_by = 0` whatever the
direction holds, for the reason there is no `straight` Cut. A seventh direction,
`still`, would say again what the amount already says, and *still, by twenty
percent* would become a sentence the request boundary has to refuse rather than
one that cannot be said. A Movement over no time would be a jump, so nought is
free to mean *as long as the Shot is on screen*, the one answer no number can
give, because that time is the Cut's. Where the clock cuts the Shot it is the
hold, and the Movement ends as the clock cuts: since
`docs/adr/0052-a-text-arrives-in-its-own-time.md` the hold counts from the text
having arrived, so on a Shot whose text arrives in its own time the Movement spans
the arrival and then the hold. `movement()` says that its time is the hold, and
the Reading, which alone knows how long the text takes to arrive, adds the
arrival: the passage the text waits for, its wait, the last part's delay and the
time that part takes to appear. A beat landed on with the Reading paused is given
its text whole and counts its hold from the Resume, so its Movement spans the hold
alone. Where the Reader cuts the Shot there is no length to span, and it is
`MOVEMENT_OVER_UNTIMED`, ten seconds, which reads as slow at every amount: at
fifty it is five percent of the frame a second. A reading time taken off the text
was not used, because a short line would move in under a second and a Shot
without text would not move at all. Both noughts are understood in `movement()`
and nowhere else, and neither is typed: the bench offers *Not at all* and *As long
as its Shot is on screen* in a `<select>`, and hands back a nought typed into
either number. On a Shot, a `movement_by` of nought is this Image held still under
a Scene whose Images move, and a Shot with no Image has nothing to move.

**One number in every direction.** A Movement by fifteen draws the Image fifteen
percent larger than the frame at its closest. Closer grows to that, away shrinks
from it, and across the Image stays that large and travels the fifteen percent of
width or height it leaves. Fifty is the most, `MOVEMENT_BY_MAX`: past half again
the frame at its closest, less than half the Image is shown, which is a closer
Image and a second Shot. A minute is the longest a Movement takes,
`MOVEMENT_OVER_MAX`, because it is the longest the clock holds a Shot. The
Image's own pixels are what bounds the amount on a large screen, and the byte cap
stays: an Author who wants a strong Movement sharp uploads the largest Image it
allows.

**The six directions are what the Image does on screen.** Closer, away, to the
left, to the right, up and down. *Left* is the Image sliding left and showing more
of its right side, which is what the Reader sees and what the bench says; a
travelling frame would name the opposite way, and a camera the product does not
have. All six are anchored on the point
`docs/adr/0055-a-shot-is-laid-out-as-its-scene-says.md` put on the Image. Percent
`object-position` lays the point at the same fraction of its box under every
crop, so closer and away scale about it and leave it where it stands. Across, the
shift is held to the narrower of two ranges, the one that keeps the grown Image
covering its box and the one that keeps the point inside it, which
`movementEnds()` works out from the point alone: the Image never shows past its
own edge and the point never leaves the frame. A point pressed on the very edge
leaves no room on its axis, and the Image holds still along it, which the Preview
shows. The shift is a `translate` in percent of the box's own size, so both ends
hold at every frame size and through a resize. Under `inset` an Image that moves
covers its box, cropped around its point, because grown inside the bars beside a
tall Image its edges would be seen moving; one that holds still stands whole, as
it always has.

**It is linear, runs once and rests where it ends.** It starts with its frame, as
the hold does. A Movement over the whole time meets the cut still moving, as a cut
meets a moving picture, and one cut short is exactly a smaller Movement at the
same speed, which under a curve it would not be. An easing would be a third
setting the panel cannot show, and a fixed ease that settles would make every cut
wait for the Image. Only `transform` moves, which the compositor carries without
layout or paint, and the box takes no `will-change`: a running animation of
`transform` is composited already, and `will-change` would pin the scale the
layer was first drawn at, which is the Image going soft at its closest. That was
reasoned rather than looked at on a screen of a pixel ratio of two.

**A Movement is not a position.** `advance()`, `take()` and `Path` do not change,
which is the rule `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` settled
and `0050` read again. A Shot played again, stepped back to or resumed moves again
from its start; *Step Back* also pauses, so the Shot stands at its start until
*Resume the Reading*.

**The Pause stops it, and it resumes where it stood.** The hold starts again after
a pause, because nothing recorded how far it had got, and so does the drain. The
Movement does not: the animation holds its own progress, and starting it again
would jump the Image back to its start, a cut nobody wrote. So a Movement over the
whole time, paused, comes to rest before the hold that started again runs out. A
hidden tab is a pause by the same rule, which stops both frames in the gate at
once, and a tab hidden as the Reading opens holds the first Image at its start.
The leaving frame of a dissolve or a fade goes on moving through it.

**The Pause is drawn wherever an Image moves.** `movesItself()` already asked
whether anything in a Story moves by itself, and it now reads the Movement too, so
a Story read entirely by the hand is offered *Pause the Reading* the moment one of
its Images moves, and a step back never leaves it paused with no control to resume
it. What it asked before is `timed()`, which still alone decides whether the ways
on are told how long they stand, since every arrival on a Story nobody wrote a
time into is a press. One rule over every Movement is what WCAG 2.2.2 asks, and
simpler than a five-second threshold; a Movement runs once, so 2.3.1 has nothing
to count.

**The frame held behind the Exits keeps the Image where it stood.** The end of a
run is a hard move, and the frame left standing is drawn afresh, keyed on the
Path, so the Image in it would start its Movement again. Instead the move that
ends the run reads how far the leaving Image had got, and over how long it was
moving, and the frame drawn in its place goes on from there over the same time.
Behind the ways on that frame is pushed back and paused, so nothing moves behind a
choice; at an ending, where `docs/adr/0053-a-reading-ends-on-its-last-shot.md`
shows the last Shot as it was while it played, it goes on to its end, through the
fade to black where the Cut says one. That progress is not kept with the position
it was carried to, because a step back across the Exit lands on that very
position, and the frame there would be handed the run's progress instead of its
end. It is set by the move that ends the run and let go by every other move of the
Reading, the position serving only to tell the one from the rest, so a held frame
reached any other way — a step back across an Exit, a Reading resumed at its ways
on, a Preview remounted or routed there — shows where its Movement ends.

**A Reader who asked for less motion is shown where it ends.** Under
`prefers-reduced-motion` every Image is drawn at the end of its Movement, with no
animation. The end is where the Author takes the Reader, and the product's reading
of the query keeps the end of a change and drops its time, as `0053` keeps the
black and `0050` the hold. The stylesheet's own rule lands a running animation at
its end but leaves a paused one at its start, so the animation is taken off
outright rather than shortened.

**The box nests inside the Effects'.**
`docs/adr/0051-an-effect-is-said-of-one-beat.md` drew the Image's Effects on two
wrappers, one for what arrives and one for what lasts, around whatever moves the
Image. The Movement's box is the innermost of them,
`.picture > .arrives > .lasts > .moving > img`: `.picture` still clips them all, a
shake keeps its reach over an Image that moves, and no two owners write one
element's `transform`, since the Effects write `translate`, `scale`, `filter` and
`opacity` and the Movement writes `transform` alone. Only an Image that moves
carries an animation, so a Shot whose Image holds still is the Shot it always was.
A Shot's text never moves: it and its scrim sit outside `.picture`.

**No Remark watches it.** A Movement longer than its hold is a choice, a smaller
Movement at the same speed, and a Remark on a choice is one an Author learns to
ignore. A strong Movement on a small Image would need the Image's size and the
frame's, which the product holds neither of, the reason `0055` gave for refusing
its own. An axis the point leaves no room on happens only on the very edge, and
the Preview shows it.

## Considered and refused

**A word of cinema's.** *Camera movement*, *pan*, *tilt*, *zoom*, *dolly*,
*tracking*, *travelling*, *panoramique*, *Ken Burns*. There is no camera, and
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md` weighs a word on its
merits: *Movement* is *camera movement* without the camera, and the plain word
too.

**The Movement on the Shot alone; a Story-wide Movement.** Above. The second also
makes the Scene's columns nullable and the resolution three deep, which is the
Cut's own refusal read again.

**Always spanning the hold.** A Shot held until the press has nothing to span, and
a quick approach that lands and holds could not be written.

**Two rectangles drawn by the Author.** The frame's shape is the Reader's, and two
rectangles would be a third statement of what stays in view, able to disagree with
the point.

**Diagonals.** Their angle follows the frame's shape: near thirty degrees on a
window of 1440 by 900, near sixty-five on a phone of 390 by 844.

**A drift ending on the point.** Its direction would come from where the point
stands, and a centred point gives it no side; the four directions across already
pass through the point's framing.

**Turning the Image.** It is no travel, it bares the corners of the box, and a
tilt is an Effect's.

**An easing setting, or a fixed ease.** Above.

**Looping, or going back and forth.** A loop jumps back, which is a cut nobody
wrote, and back and forth is two Movements.

**Animating `object-position`.** It repaints every frame, and how far it travels
depends on how much of the Image the Reader's screen hides.

**Named strengths.** Three names are three hidden numbers, which the column would
hold anyway.

**Starting again after a pause.** The Image would jump back at every resume.

**Moving the text.** Words are read where they lie, over the scrim sized to them,
and how they arrive is `docs/adr/0052-a-text-arrives-in-its-own-time.md`'s.

**The start, under reduced motion.** It is what the Author moves away from.

**`will-change: transform`.** Above.

**The carried progress kept with the position it was carried to.** Above.

**A Remark on a long Movement or a small Image.** Above.

## Consequences

- The migration is additive: every column has a default or is nullable, which is
  what `docs/adr/0002-the-schema-moves-with-the-deploy.md` asks, and the defaults
  are what every Story already is. Stories already written look exactly as they
  did, because every `movement_by` is nought.
- The doors refuse a `movementBy` that is not a whole number from nought to fifty,
  a `movementDirection` that is not one of the six and a `movementOver` that is not
  a whole number of milliseconds up to a minute, each in its phrase, and a null on
  a Scene for any of the three.
- *Duplicate Scene* copies the three onto the Scene and onto each Shot, and *Split*
  gives the second half the first half's, so the Shots that said nothing move as
  they did.
- The Reader's door names the three a Scene leaves by.
- The Cover, the Contact Sheet and the thumbnails stay still, cropped around the
  point, because a shelf has no time on screen and the sheet is still and silent;
  the point's note says it is also what stays in view when the Image moves.
- The bench writes it in a section of its own after the Layout, *The Images move*
  and *The Movement takes* on a Scene and *The Image of this Shot moves* on a Shot
  that carries an Image, with *As the Scene says* first. No Command is marked,
  since a `<select>` is exempt and the numbers are fields.
- *Reel Change* carries four: the booth comes closer to its points, the strip of
  film slides down the gate over its hold, the recognition closes in on her for
  twelve seconds, and the last Shot draws away from her as it goes to black. Both
  Samples carry two at the same Places: the first Shot comes closer to the lit
  panel, and the Exit's slides left to the two panels it leads to.
