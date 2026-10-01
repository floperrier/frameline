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
So the open-once rule goes for Shots. `textUnfolded` stays for the Scene's own
fold, which the next issue takes up.

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
