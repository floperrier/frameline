---
status: accepted
---

# What a beat plays as is folded under its words

The Cut, the Layout, the Movement, the Effects, the Sound and the way a text
arrives were each given a row of their own on a Shot, one record at a time, and
every Shot drew all of them, open, under its words. That came to ten to fourteen
controls a beat, and almost all of them read *As the Scene says* or *No Effect*.
Measured on `dev` at 1440 × 900 before this change, a one-line Shot with no Image
took about 330 px from the top of its row to the top of the next. Three lines of
prose filled a window, and the Sample, three Scenes and eleven Shots, was a
document 8,889 px tall. No single decision made the writing a settings form, but
that is what it had become.

**What is written or deposited stands open, and what is chosen from a list
folds.** Under its words a Shot's row shows its Place, its Image or the empty
frame to press, its text, its Description where it has an Image, a Sound
deposited on it with its Transcript and the mark that takes it off, and its
Conditions. Everything else is in one `<details>` at the foot of the row, in the
order the row drew it: the Sound picker while there is no Sound, how it is cut,
its Layout, its Movement where it has an Image, its four Effects (the Image's two
only with an Image), and how its text arrives where it has words. The fields are
unchanged in what they write and in what they are called. The sorting rule keeps
in plain view what a Reader who cannot see or hear depends on, the Description and
the Transcripts, and the Conditions the Steps point at.

**The line says what this Shot says for itself and nothing else.** `playsAs` in
`app/utils/plays.ts` is the `<summary>`. It says one part for each answer on the
row that is not *As the Scene says* or *No Effect*, in the row's order, with what
its fields add (seconds, a percent, a pace, a strength), joined by ` · `. A Shot
that says nothing reads *As its Scene plays*, because it does as its Scene says
and the Scene says that once at its head. Repeating the Scene's answers on every
row would bring back the noise this removes. A library Sound picked and not taken
is not a part, because it is not on the Shot until it is taken. The summary
carries the Shot's name, visually hidden, as every control on the row does.

**The fold is the browser's.** No `open` is bound. Every fold is shut when the
bench is loaded. A fold the Author opens stays open through every write and every
read of the Story back (`docs/adr/0008-refetch-is-for-a-refusal.md`), because the
row is keyed by the Shot's id and the element is kept. Opening one fold touches no
other.

## Considered Options

**Opening the fold once the Shot says something, as #372 did for the text's
arrival.** That rule opened a fold so that an answer the Author gave would not be
hidden. The line now shows the answer without the fields, so the reason is gone,
and a run where every Shot says something would be open from end to end again.
So the open-once rule goes for Shots, and with #400 it went for the Scene's own
fold too: `textUnfolded` is gone.

**The Scene's answers in grey on every line.** Refused, because a Shot that says
nothing would then carry a line as long as the Shot that says the most.

**A fold within the fold for the text's arrival.** Refused. The fold it stood in
is already one, so its four answers are drawn plainly inside it.

## Consequences

**This amends `0033`'s *A beat is a row*.** What a beat plays under still shares
its last line with the marks. That line now also carries what the beat plays as,
first on the line, so that opening it never moves what was pressed. Opened, it
takes the whole line, and the Conditions and the marks wrap under its fields. A
Shot that says nothing for itself and has no Condition costs its words, its frame
and one line: under 160 px from one row's top to the next at 1440 × 900.

**The bar of Commands offers what it did.** No control on the row is marked
`data-command`, and none may be put in the fold, because the bar offers only what
`checkVisibility()` finds.

**The specs that choose a Shot's answers open the fold first,** through `unfold`
in `tests/e2e/author.ts`. Otherwise they assert what they asserted. A reload
brings every fold back shut, so the one spec that read the open-once rule now
reads that.

## Amendment: the Scene's head folds by the same rule (#400)

A Scene's document opened on its grammar rather than on its Shots. Under the
Scene's name stood its Flags, the Sound it is heard under, three selects for its
Cut, the fold of how its texts arrive, its Layout and its Movement, each section
headed. Measured on `dev` at 1440 × 900, after *Write the First Scene* in a Story
just created, *Add a Shot* was about 880 px down, at the bottom edge of the
window: the first thing a new Author is asked to do was the last thing on their
screen, and every Scene of every Story repeated the block.

**The head is its name, its Flags, a Sound it is heard under, and one line.** The
slate and the Flags are unchanged. A Sound the Scene is heard under stands open,
its own (the player, *Held under the Scene*, its Transcript and *Remove the
Sound*) or another Scene's (the player, whose it is, and *Remove the Sound*),
because it was put there and a Reader who cannot hear depends on its Transcript.
Then one section headed *How this Scene plays* holds one `<details class="plays">`,
and the run comes under it. The fold holds, in this order and unchanged in what
they write and what they are called, the Sound picker while the Scene is heard
under nothing, the Cut's three answers, the four answers on how the texts arrive
(drawn plainly, so the fold inside the fold goes), the Layout and the Movement.
The headings *Cut*, *Text*, *Layout* and *Movement* go with their sections: every
label in the fold is already a sentence. The fold is the browser's, as a Shot's
is, and kept while the Scene's section is.

**A Scene's line always says four answers, where a Shot's says only its own.**
`scenePlaysAs` in `app/utils/plays.ts` is its `<summary>`, in #401's words and in
the fold's order. A Shot that says nothing falls back on its Scene, so its line
can say nothing and still be true. A Scene has nothing to fall back on: its
answers are what every Shot of its run does. So when its Shots are cut, how, its
Layout and its Movement are always said, and an Author reading the head never has
to open it to learn whether the run is clocked or full-screen: a Scene just
written reads *Cut at the press · A hard Cut · Image above the text · Image held
still*. How the Exits are offered and how the texts arrive are said only where
they depart from what a new Scene is written with (Exits until one is taken, the
text with the Image, whole, at once and until the Cut), so the ordinary Scene
spends no words on them. The Sound is never said: one it is heard under stands
open above the line, and silence needs no word.

**Consequences.** After *Write the First Scene* at 1280 × 800, the Scene's name,
its Flags, its line and *Add a Shot* are in the window together. The bar of
Commands offers what it did: *Remove the Sound* stands open, and nothing in the
fold is marked. The specs that write a Scene's answers open its fold first with
`unfold(page, 'The street')`, which finds a fold by the name its line carries,
and the Steps walk in the 1280 × 900 window they held in before the head grew.

## Amendment: a fold draws its answers once it is wanted (#480)

Shut, a fold drew every one of its answers all the same, and a Shot's are most of
what a beat costs: the Sound library's options, the Cut, the Layout, the Movement,
four Effects with their times and strengths, and how the text arrives. A Story of
forty Scenes and three hundred beats drew three hundred and forty folds of fields
that nobody had opened, and drew them again on every change — #449.

**A fold draws its answers once it is wanted, and keeps them drawn while its row
stands.** A Shot's fold is its own component, `app/components/ShotPlays.vue`; a
Scene's is drawn by `app/components/Writing.vue` under the same rule. Shut and
never opened, a fold is its `<summary>` and nothing else. It is wanted on the
`click` of its `<summary>`, which the keyboard's `Enter` and `Space` fire too and
which is heard before the browser opens the fold, so its answers are drawn in the
same task and it never shows open and empty for a frame. Its `toggle` wants it as
well, for a fold opened another way: the browser's find in the page, which opens a
`<details>` holding what it found. And a fold the browser opened before the
bench's script took over is wanted as the row mounts, since its `toggle` was heard
by nobody. Nothing in the bench opens a fold from code: no Command is marked in
one, by the Consequence above, and no Step points into one.

**What stays the same.** The fold is still the browser's: no `open` is bound, and
it stays open through every write and every read of the Story back. Opened, it
holds the same fields under the same names, in the same order. What changes is
what a shut fold holds, which nobody could see: the browser's find no longer
finds a label inside a fold that was never opened, because the label is not there
to find. The summary, which says every answer the fold holds, still is.
