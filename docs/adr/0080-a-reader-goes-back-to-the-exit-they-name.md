---
status: accepted
---

# A Reader goes back to the Exit they name

Decided on 2026-10-02, issue #439. Amends
`docs/adr/0046-a-step-back-crosses-the-exit-it-came-by.md`, which gave a Reading
one way back across an Exit — the last one, a beat at a time — and bounded by
`docs/adr/0047-an-exit-says-whether-it-is-crossed-backwards.md`, whose closed
door it does not open.

A branching Story is read more than once. Its Reader finishes, wonders what the
other door held, and wants to go back to it. There were two ways back, and both
cost the thing branching is meant to reward. *Step Back* goes one beat at a time:
from an ending three Scenes past the fork, that is every Shot of those three
Scenes pressed backwards one by one, and a Scene cut by the clock is sat through
again on the way forward. *Read Again from the Start* throws the whole Path away,
and everything before the fork is read a second time to get back to it.

**Beside the two, the Reading offers *Take Another Exit*.** It opens, under the
controls, the list of the Exits this Reading took where it could have taken
another, oldest first, each shown by the words its button showed the Reader.
Pressing one puts the Reading back on the screen where it was taken: the end of
the Scene it left, its ways on offered again, the focus on the first of them, and
every Exit taken after it let go.

**Going back across several Exits is as safe as going back across one, and for
the reason `0046` gives.** State is a pure function of the Path, so a Path with
its last three Exits dropped is, byte for byte, the Path the Reader stood on
before they took the first of them. `backTo` in `shared/utils/reading.ts` cuts
`taken` before the Exit named, stands at the end of the run that Path plays, and
keeps the answers of the Scenes it still enters — so a Scene that asked a
Question keeps the answer it was given, because it was answered before the Exit
was taken. `back` across an Exit is now `backTo` its last one.

**What is listed is what the Reader could have done otherwise**, and `forks` says
it in one place:

- An Exit taken where more than one was on offer, worked out as the Reading works
  it out — `reading` on the Path given back. An Exit that was the only way on was
  no Exit the Reader picked, and going back to it offers them nothing else.
- Not an Exit out of a Scene that flows into the next. Its ways on stand for no
  time, so the Reader was offered nothing. An Exit the clock took after a time is
  listed, because the others were on offer and let go.
- **Nothing behind a closed door.** Going back to an Exit crosses it and every
  Exit taken after it, so the first Exit counted from the newest that is not
  crossed backwards ends the list: neither it nor anything taken before it is
  listed. `crossesBack` is the one place the rule `0047` settled is read, by
  `back` and by `forks` alike.

The Reader is shown nothing they were not shown already: the words of the Exits
they pressed, said with the Flags they held then, or the name of the Scene an
Exit without words leads to, which its button showed. No Scene name otherwise, no
Place, no count of Shots.

## Considered Options

**A Step Back held down, or pressed with a modifier, to go back further.** It
keeps one control, and it is still a walk backwards through beats the Reader does
not want to see, with no way to say where to stop but to watch for it.

**Listing every Exit taken**, the lone ways on included. The Reader would be
offered a way back to a screen with one way on, from which the only move is the
one they made. A list of every door is a drawing of the Path, which tells the
Reader how the Story is built rather than what they did.

**Listing every Scene the Reading entered**, by name. A Scene's name reaches a
Reader in one place only — an Exit its Author left without words — and this
would make it a second.

**A drawing of the Story, with the Reader's Path marked on it.** The Reader is
never shown how the Story is built (CONTEXT, *Reader*). The list of the words
they pressed tells them only what they did.

**Undoing a *Take Another Exit*.** A history of moves undone is the stack `0046`
refused. What was let go is let go, as with a step back.

## Consequences

**It is offered wherever the list is not empty** — at an ending, at the ways on,
and in the middle of a run, because a Reader who sees where an Exit led them
often knows at once that they wanted the other. It is a disclosure among the
two ways back, between them since it goes further than a beat and less far than
the start, and its list stands under the controls rather than among the ways on.
Esc closes it and puts the Reader back on the control; any move of the Reading
closes it.

**A go back is a move like every other.** It goes through `passBy` and `moveTo`
as a hard cut, as a step back does, so it is kept in the Reader's browser
(`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`), the focus lands
on the first way on, a stand with a time starts its clock again, and the Scene's
Sound plays as it does when its Exits are offered. Unlike a step back it does not
stop the clock: the Reader has said where they want to stand.

**Counting is unchanged.** An Exit taken again after going back is told once per
Reading, as after a step back, and the Exits let go are not taken back off the
counts; an ending reached a second time is not counted again. See
`docs/adr/0072-a-reading-is-counted-for-its-author.md`.

**The Preview and the embed have it because they are the Reading.** All three
draw `Reading.vue`.

**Reopening condition.** Reopen this with `0046`, the day State stops being a
pure function of the Path. Reopen it too if a Reader ever needs to go back to a
Question to answer it again: that is a step back's today, from a Scene's Exits to
its Question in one press, and nothing here lists it.
