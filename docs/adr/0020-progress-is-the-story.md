---
status: accepted
---

# Progress is the Story

There is no column, no route and no migration for how far along the guided path
an Author is. A Repère is a predicate over the Story the bench already holds —
this Story has at least one Scène, some Scène has a Plan whose text is not empty,
a Coupe exists — and the step showing is the first one that Story has not met.

This plainly looks like something that needs state, and it is worth saying why it
does not.

**The Story already is the record.** Every step of the path is met by writing
something into the Story, and the editor fetches the whole Story and reads it
back after every write. So the answer to "what has the Author done" is already on
the page, fetched, fresh, and the same on every machine they sign in from.
Recording it a second time would be recording it twice, and the second copy is
the one that can be wrong.

**Nothing can disagree with the screen.** A stored step can be ahead of the Story
— the Author deleted the Scene they had just made — or behind it, and either way
the bench is asking for something that is already there or refusing to ask for
something that is not. Recomputing on every load makes both impossible.

**Steps are met in any order, and none of them blocks.** An Author who improvises
past three steps meets three Repères without telling the bench anything, and an
Author who undoes one gets that Repère back. That falls out of predicates; with
stored progress it is a synchronisation problem.

**What is folded is the one thing asked besides the Story.** A Repère may not
point into a node the Author has folded, so opening one is a step like the rest —
and whether a node is open is how the Author is looking at their own work rather
than anything about the work, so it lives in the page and nowhere else. The step
reads it, and is met either by the node being open or by there being something
written in the Story already: a Story that arrives written, an Amorce among them,
is never asked to open anything.

**The one fact that is not in the Story goes in the browser.** That the Author
waved the guidance away before finishing is not a property of the Story, so it is
a key in local storage, kept per Story: knowing what you are doing today does not
mean the Story you start in six months should be left unguided. Losing it when
moving machine costs one re-shown panel, which does not justify a column, an
endpoint and a migration.

## Considered Options

**A column on `stories`, or a table of steps taken.** A migration, an endpoint, a
write on every step, and a second account of the truth that can drift from the
first. Everything above.

**A step held in the page and advanced by the handlers.** No storage, but the
guidance becomes a listener on gestures rather than a question about the Story:
it would be lost on reload, and every handler on a two-thousand-line page would
have to remember to tell it.

**Progress belonging to the Author rather than to the Story.** Then the second
Story is written unguided, which is the wrong way round — the guidance helps
whoever has an unfinished Story in front of them, including the Author who has
forgotten. The Amorce, which arrives finished, meets every Repère and asks
nothing, and that is the same rule rather than an exception to it.

## Consequences

The whole of the logic is `app/utils/cues.ts`: a list of steps, each a name, a
target and a predicate, and one function returning the first unmet. It is tested
under Vitest against Story literals, with no database and no browser.

Adding a step is adding a predicate. Nothing has to be backfilled, because there
is nothing to backfill: every Story that already exists is already exactly as far
along the path as it is.
