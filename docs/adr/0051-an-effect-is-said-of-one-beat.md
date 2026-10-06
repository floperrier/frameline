---
status: accepted
---

# An Effect is said of one beat

Every beat of a Story arrived and stood exactly as it was uploaded and typed, and
an Author who wanted the frame to jolt when a door slams, a lamp to stutter or a
heartbeat under a line of dread had nothing to write it with. An Effect is what
they write it with: something that happens to a Shot's Image or to its whole
text, once as the beat arrives or for as long as it stands, over a time and at a
strength they write. See issue #360.

**The list is short, and every entry is there for what an Author says with it.**
Six arrivals and four that last. A shake is an impact, a blur coming clear is
attention finding its object, a flash from white is a blast or a screen the film
has run off, black and white turning to colour is the past becoming the present
and colour turning to black and white the present becoming memory, and the edges
closing in are the world narrowing. A flicker is a failing light, a pulse a
heartbeat or a word that insists, a tremor an engine, fear or cold, and grain is
footage rather than a room. That is the rule every entry was admitted by, and it
has a second half: an entry is never one of the three things the product already
has, or will have, a word of its own for. The Cut is how one Shot gives way to
the next, the movement of the frame over the Image is #357's, and when or how fast
the words come is #358's. Each entry is offered only where it means something.
The text is offered a shake and a blur as it arrives, and the flicker, the pulse
and the tremor while it stands, because words are paper on the dark, with no
colour to gain or lose and no edges to close. The entries the rule turned away
are listed under the options below, each with the thing it belonged to.

**Two kinds, as two slots, on the Shot alone.** `shots` carries `image_arrives`,
`image_lasts`, `text_arrives` and `text_lasts`, and each holds a whole Effect or
null, and null is none. An object per slot, because an effect, its time and its
strength held as three columns would leave a time beside no effect, which is the
pair that can disagree `docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`
refused. Two slots per carrier, because an Image arriving from a blur and then
carrying grain is two ordinary things that one slot would refuse. On the Shot
alone, because an Effect is an emphasis and not a grammar. A Scene default would
be a grammar whose usual value is nothing, and a Shot under it would need a fourth
answer, *none, whatever the Scene says*, which neither the Cut nor anything else
here has ever needed.

**A time and a strength, in the words an Author uses.** A shake over a fifth of a
second is a tap and over a second and a half a quake, so an arrival carries
`over`, from 100 to 5000 milliseconds, and a pulse or a tremor carries `every`,
one round of it, from 200 to 4000. Under a tenth of a second an arrival is six
frames nobody sees, and one that stops by five seconds never needs the pause WCAG
2.2.2 asks for. Under a fifth of a second a round is a buzz, and past four seconds
it is not read as a rhythm at all. A flicker keeps one pace and grain has none to
tell, so neither carries a round. The strength is *slight*, *marked* or *strong*,
because that is what an Author says and each is plainly different on screen.
`isArrival` and `isLasting` sit in `shared/` for the reason `isTime` does, so the
bench and the door cannot disagree, and each refuses a key its effect does not
take, such as `every` on a flicker.

**An Effect is not a position.** `advance()`, `take()` and `Path` do not change.
An Effect is how a beat is drawn and not where a Reading has got to, which is the
rule `docs/adr/0049-a-sound-is-carried-by-what-plays-it.md` settled about a Sound
and `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` read again
about a Cut.

**Nothing an Effect does flashes more than three times in any second.** WCAG
2.3.1 allows more only under thresholds of luminance and area, and neither saves
a beat here: a dip on a white Image is a flash, and a Shot drawn across the whole
room is larger than the area the criterion forgives. So the guarantee is the rate
itself. Two Effects flash, the flicker and the flash from white. The movers change
no area's light, the other arrivals are one change in one direction, and grain is
the balanced noise the criterion's understanding exempts. Three rules keep the
count.

- **The flicker keeps one pattern and takes no pace from the Author.** A round of
  3200 ms holds dips of 120 ms starting 400, 1100, 1600 and 2700 ms in, so no two
  start under half a second apart and none in the first 400 ms of a beat, and
  every flickering carrier on a beat shares it.
- **A frame leaving is stopped where it stood.** It dips no more, so two frames on
  screen never flicker at once, and the frame arriving is the only one whose
  flashes count.
- **A flash from white is drawn only after a beat that carried no flicker and
  arrived at least a second before.** That leaves no dip in the second before a
  white, two at most after it, and whites a second apart. It is `withholdsFlash`
  in `app/utils/flashes.ts`, fed with `performance.now()` as each Shot arrives and
  never with the Path, and the bench says where it will bite in the Remark
  `flashWithheld`, since nothing else would tell an Author why a white they wrote
  is not shown.

`tests/unit/effects.spec.ts` holds the three together. It reads the flicker's
keyframes out of `Reading.vue` as source, holds them to the numbers above, and
plays ten thousand runs of beats through the rule without finding one second with
more than three flashes in it. A dip moved in the stylesheet is a red test. The
one flash this cannot bound is the Author's own montage, a run cut by the clock
faster than twice a second over Images of opposed brightness, and that is the
Cut's to bound at the door, in #356.

**The Pause stops every Effect, and each resumes where it stood.** This amends
`0050`'s pause twice over. `0050` drew the pause wherever something advances by
itself, and an Effect that lasts does not advance anything, but it moves by
itself for as long as its beat stands, which is the motion WCAG 2.2.2 owes a
pause over. So the pause is drawn where an Effect lasts as well as where a clock
runs, and a Story whose only moving thing is a pulse is given one. An arrival
stops inside five seconds and is owed nothing. And where `0050`'s hold, stopped
and started again, stands for its whole time again, an Effect resumes from the
moment it was stopped at. A restarted arrival would replay a flash nobody wrote,
and a restarted flicker would dip sooner than its pattern says. A tab nobody is
looking at stops them the same way. The sentence telling the Reader how long the
ways on stand is still a clock's alone.

**An arrival plays only on a beat that is seen arriving.** A beat arriving while
the clock runs plays it, the opening beat, a Reading picked up and a Reading
started again among them. A step back, which stops the clock, and any press while
it is stopped land on the beat at rest, because a stopped arrival holds its first
frame and the first frame of a flash from white is a white screen. The frame held
behind the ways on is drawn afresh without arriving, so its arrival does not play
again and what lasts on it goes on.

**A Reader who asked for less motion sees no Effect move, only the state it
leaves.** It is the reading `0050` gave a dissolve. WCAG 2.3.3 counts a blur as
motion and does not count colour or opacity, but `0050` already takes a dissolve,
which is a change of opacity, from this Reader, and one preference is read one
way. Every Effect's animation is taken off, which leaves most of them as nothing
at all, the grey of colour turning to black and white and the edges closing in as
they end, from the start, and grain standing still. Taken off rather than cut to
nothing, because the durations `frameline.css` cuts still start each animation,
and a first keyframe painted once is a white screen for a flash from white.

**It underlines and is never announced.** An Effect never says anything the words
do not, so a Reader who cannot see it loses none of the Story. What it draws over
the Image is kept out of the accessibility tree, none of the three properties it
plays on takes the text out of it, and the `alt` stays the Description. Wherever
the Story is not being read, on the Contact Sheet, the Cover, a Shot's thumbnail
and the landing page's specimen, it is still.

**A run of the words carries its own, as two marks in the text.** Issue #361
gives a stretch of a Shot's text an Effect as it arrives and one while it
stands. They are written as the marks `arrives` and `lasts` in the formatted
text `docs/adr/0056-a-shots-text-is-formatted-where-it-is-written.md` settled,
whose attributes are exactly an Arrival and a Lasting and are read at the door
by `isArrival` and `isLasting` for the carrier `run`. Two types rather than one,
so a scramble over three words and a tremor over the last two can overlap. A run
is offered the text's Effects and three that take it apart letter by letter: a
scramble, a wave, and the tremor drawn on each letter. Its letters are bounded
per Shot, `LETTERS_SPLIT_MAX`, three hundred, a letter under two such marks
counted once, because a cap per run is a cap many runs add up past. A run taken
apart is drawn twice, as a text arriving by units is: the copy that moves is
hidden from the accessibility tree, and the words whole are read beside it from
the landing. A run's root is drawn once around all the leaves that carry the
same pair of Effects, and a word joiner holds a run to the rest of a word at
both its edges: first inside its root where it starts inside a word, which
holds two runs meeting inside one as well, and before the words that go on past
its end. A run's flicker is the one flicker, so the flash rule counts it through
`flickers()` with nothing new.

## Considered Options

**A term for either kind.** *As the Image arrives* and *while the text is on
screen* are sentences on the bench and `arrives` and `lasts` in the code, because
a word for either would be a word for a clock, which `0050` refused for the timed
choice. `loop` was refused for the second besides, because a Scene's Sound is
already held in one, `sound_loops`. And no single Effect is a term: *A shake* is a
label in a `<select>`, as *A dissolve* is.

**A Scene default for a lasting Effect.** Grain over a sequence is a few Shots
carrying one Effect, and a default whose usual value is nothing would need the
fourth answer on the Shot that the slots above are there to avoid.

**Twelve flat columns, one slot per carrier, or a column naming the kind.** The
first leaves a time and a strength beside no effect. The second refuses an Image
that arrives from a blur and then carries grain. The third is a pair of columns
with combinations that mean nothing.

**An intensity from 0 to 100.** Nobody can see or ask for the difference between
40 and 45.

**A pace for the flicker, a flicker as the beat arrives.** One pattern from one
start per beat is what makes the count of flashes provable. A light stuttering on
is a flickering Shot followed by one that does not flicker.

**The entries the rule turned away.** A quick punch in is the frame moving over
the Image, which is #357's, however fast. Words drawn faint are how words look at
rest, which is #359's. A slow fade in of the text is #358's, whose appearance
takes a duration of its own. A fade from black is the Cut's passage through black.
A single throb as the beat arrives is a slight shake. A held black and white or a
held vignette is a grade that never changes, which is the Image the Author
uploads. White, colour and closing in on the text have nothing on words to act
on. Effects that take the text apart letter by letter belong to a run of words,
which is #361's, because the whole text runs to two thousand characters.

**Cinema's words.** An iris closes to a point and ends a Scene, a rack focus moves
between planes, a whip and a crash zoom are #357's movements, a strobe is the
flash 2.3.1 forbids, and an optical is also a dissolve. `CONTEXT.md` already keeps
*vignette* off the Cover and *vignettes* off the Contact Sheet, and *grain* is
kept as the plain word in both languages.

**`animation-composition: add` instead of an element per Effect.** It still
leaves two owners writing one element's `transform`, so the Reading draws one
wrapper for what arrives and one for what lasts, around whatever #357 moves.

**An Effect announced to a screen reader, or put on an Exit's words.** The first
would narrate the decoration over the Author's sentence. The second would lean a
trembling way on against the Reader's hand as they choose.

**Effects on the Contact Sheet or the Cover.** A contact sheet is still, as `0049`
and `0050` hold it, and a moving Cover would talk over every Story on its shelf.

## Consequences

- **`0050`'s pause is amended and nothing else in it is.** It is drawn wherever an
  Effect lasts as well as wherever a clock runs, and it stops Effects as well as
  the clock, which resume where they stood while the hold still restarts.
  Everything `0050` settled about the hold, the passage and the ways on is
  untouched.
- **Every Story written before this reads as it read.** The four columns are
  nullable and null is none, which is what
  `docs/adr/0002-the-schema-moves-with-the-deploy.md` asks of a schema that moves
  before the code that reads it.
- **An Effect goes wherever its Shot goes.** *Duplicate Scene* copies the four, and
  *Split* moves Shots as rows, so they go with them.
- **The pattern of the flicker is fixed and its degrees are not.** The keyframes of
  the shake, the pulse and the tremor, the grain's tile and every degree are the
  stylesheet's, and may be tuned. The flicker's dips may not move without the
  test over the stylesheet turning red.
- **A text arrival plays on the whole text until #358 lands.** Once the words
  arrive a unit at a time, an arrival plays on what #358 reveals, as it reveals
  it.
