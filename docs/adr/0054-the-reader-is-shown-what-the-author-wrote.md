---
status: accepted
---

# The Reader is shown what the Author wrote

The Reader's screen carries what the Author wrote and nothing the product adds
or works by. Two things on it were neither. Every beat arrived through a fade of
320 ms and a rise of 6 px that nobody wrote, and beside every frame the Reader
was shown the name of the Scene, *Shot 2 of 3* and a row of ticks. Both go.

**A hard cut draws no arrival.** The throw came with the visual direction in #24,
before the Cut existed, and stayed on every frame after it. So `cut_over = 0`,
the one way `docs/adr/0050-the-cut-is-made-by-the-hand-or-by-the-clock.md` lets
an Author say *hard*, faded up anyway, and a dissolve ran the throw and the
Author's own passage over the same frame at once. Now a beat arrives whole in the
tick the one before it leaves, unless the Author wrote a passage. An Author who
wants a beat to arrive softly writes a dissolve, which a Scene, a Shot and an
Exit all carry since the Cut. The two rules that only undid the throw go with
it, on the frame leaving and on the frame held behind the ways on or at the
ending.

Every Story written before the Cut is `cut_over = 0` throughout, which is the
default, so each of its beats now arrives hard where it used to fade up. That is
on purpose, because it is what those Stories say. This amends `0050`'s *every
Story written so far reads exactly as it read* for the arrival alone: no column
is rewritten, and every column reads exactly as it did. A Reader who asked for
less motion sees nothing change, since `frameline.css` already took the throw to
nothing for them.

**A Reader is shown no Scene name, no Place and no count.** The name is the
Author's handle on a Scene. The bench proposes one after a split, a copy answers
to the name of its original, and the bench numbers two Scenes that share one
(`docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md`). The count
says how many beats the run holds and how many are left, which is the shape of
the Story, and the shape is what a Comment is refused for fear of saying out loud
(`docs/adr/0027-a-comment-is-said-of-the-whole-story.md`). The ticks are the
count drawn. So all three leave the Reader's page, and the landing page's
specimen of what a Reader is shown loses its Scene name with them. Nothing that
was announced goes: the name and the count were plain paragraphs outside every
live region and every accessible name, and the ticks were hidden from the tree.

**The Preview's bench says where the reading stands instead.** It names the Shot
the frame holds by its Place in the Scene as written, under the name the bench
gives that Scene: *Shot 2 of The street*, the words the writing and the Contact
Sheet already use. The Place is the Author's and not the run's, so a Shot the
Reading skips still holds its Place, which is how the bench's list of skipped
Shots already names them. It is drawn by `Preview.vue`, outside `Reading.vue`, so
a Reader's page carries none of it.

**The unphrased Exit is the one exception.** An Exit nobody has phrased is
offered by the Scene it leads to, and every Exit is drawn that way, the one a
split joins its two halves with included. `Reading.vue` is the one component
both doors draw, so a neutral label on a Reader's page would be one on the
Preview too, hiding from the Author where the Exit leads and making two such
Exits read alike. So the name stays on that button, and the bench says so with a
Remark, `exitUnphrased`, said of the Scene the Exit leaves by the Exit's Place.

## Considered and refused

**A shorter arrival kept for hard cuts.** Any arrival over a hard cut makes it
not hard.

**Migrating `cut_over` from nought to 320** to keep the old feel. A column
cannot tell a nought an Author chose from one they inherited, the 6 px rise is
not something a Cut can say, and `0050` refused a Story-wide default for the Cut,
of which a product-wide one is the same refusal, wider.

**The ticks without the words, the count without the name, or the count for
screen readers only.** Each half tells a Reader how the run is built, and a count
kept in a visually hidden node would tell a Reader who cannot see what a Reader
who can is refused.

**The Scene's name as a title the Author opts into.** A title a Reader is shown
is something the Author writes for the Reader, and a Shot already carries that.

**A word for the line on the bench**, such as a slate. The line is words the
writing already uses, and a glossary term for one line of the bench is what
`docs/adr/0022-the-metaphor-stops-at-the-edge-of-the-work.md` keeps cinema out
of.

## Consequences

- *The gate* in *Reel Change* is cut by the clock and cut hard, and now reads as
  the montage its comment describes; both Samples' dissolve on the Exit they are
  about reads different from the hard cuts before it, which is what the Sample was
  written to show.
- `reading.shotOf` and `landing.specimenScene` leave both message files, and
  `remark.exitUnphrased` enters them.
- A Scene split and published as it stands still shows the Reader the bench's
  own name on the Exit between its halves, *Exit to The street, continued*, until
  the Author phrases it; the Remark is what tells them.
