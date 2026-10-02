---
status: accepted
---

# The seed is carried to the browser

`docs/adr/0024-the-seed-belongs-to-the-position.md` kept the seed out of the
server's render: a Reading opened at `UNDRAWN`, the opening Path under a seed of
none, and drew its seed once it was mounted in the browser. That kept one draw
per Reading, and it left the opening beat drawn twice, once on each side of
hydration. A Scene that draws a Flag and says it in its first Shot showed the
value the seed of none gives, and then, once the page answered, the value the
Reader's seed gives: one Reading in two, on one beat, with no cut between them. A
Condition on a drawn Flag could change the opening Shot the same way. Decided on
2026-10-01, issue #387.

**The seed is drawn by whichever side renders the Reading first, and carried to
the other.** The Reading draws it as it is set up, through Nuxt's `useState`. On
the server that draw is made while the page renders and is written into the
payload. The browser hydrating that page reads the same number back out of the
payload and draws nothing, so the opening beat is drawn once, under one seed, on
both sides. A Reading that is set up in the browser alone, as a Story carrying a
Sound is behind its title card, draws its seed there, which is where it always
did. The state is cleared once the Reading is mounted, so the next Reading the
page opens without a reload draws a seed of its own.

**What 0024 decided stands.** The seed is still the Path's and still drawn once
per Reading, by the component and never inside `reading()`. It is still never
shown, typed or carried in a link. It is in the page's payload the way the Path
is in local storage, and `/read/**` is served `no-store`, so no cache hands two
Readers one seed.

**The opening frame is not held back.** The other way out was to keep out of the
server's render whatever a draw decides on the opening beat. That takes the frame
out of the server's answer for exactly the Stories that draw early, and it has to
find every place a drawn value reaches: the Shot chosen, its text, the Exits and
the Transcripts. Carrying the seed covers all of them at once and leaves the
server's answer whole.

## Consequences

A kept Path is still read back once the Reading is mounted, because the server
cannot read the Reader's local storage. That is a move to another beat, never the
same beat redrawn: a kept Path is only resumed where it has moved. The draw is
made before the Path is watched, so it is not a move and is not written over what
the browser kept.

The opening Path is no longer written to local storage as the page opens. It is
written at the first move, Read Again from the Start included, and a browser
holding nothing to resume opens at the start either way.

The bench is not touched. It renders the writing on the server and never the
Preview, so it draws its own Path once it is mounted, as 0024 says.
