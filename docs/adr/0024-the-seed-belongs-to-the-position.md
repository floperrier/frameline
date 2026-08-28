---
status: accepted
---

# The seed belongs to the Position, and a draw is keyed on identity

A Scene may name several values for a Flag and draw one of them each time a
Reading enters it. Two questions come with that, and both will be re-litigated
unless they are written down: where the randomness lives, and how one draw is
told from the next.

The answers are that the seed is a part of the Position, and that a drawn value
is a hash of the seed, the Scene, the count of entries to that Scene, and the
Flag's name — never the next number out of a generator threaded through the walk.

## The seed is in the Position, not in State

A Reading is its Position and nothing else. `reading()` is a pure function of a
Story and a Position, and everything a screen shows — the Scene, the run, the
Shot, the ways on, the State — is computed from those two on every read, several
times over: the Reader's frame reads it, and the Preview's bench reads it again
beside them. That is what makes the whole engine testable by stating a Story and
a Position and asserting what the Reader is shown.

A seed kept anywhere else breaks that in the same breath as it is introduced.
Put in State, the seed would be something the walk accumulates and the Position
does not carry, so two reads of one Position could draw differently and the bench
would disagree with the frame. Advanced as the Reading goes — a generator whose
cursor moves — it would make `reading()` a function of what has already been
read, which is exactly the thing this engine does not do: a Reading replays from
the beginning every time, so a moving cursor is a cursor read from a different
place on the second read.

So `Position` is `{ seed, taken, shot }`. The seed is drawn once, where a Reading
starts, in the browser that will hold it — that is the one impure moment, and it
is in the component, never inside `reading()`. Rerolling is the same Position
under a new seed, which is what makes the Preview's reroll a one-line function
and not a mode of the editor. The research in
`docs/research/2026-08-27-paysage-concurrentiel.md` says SugarCube, Chapbook and
ink each landed in the same place: the seed belongs to whatever is replayed.

## A draw is keyed on identity, not drawn from a stream

The orthodox implementation is one generator seeded at the start of a Reading,
handed the walk, and asked for the next number each time a draw comes up. It is
rejected here because it makes every draw depend on every draw before it, and on
the exact route the walk took to reach it.

An Author editing a Story shifts that route constantly. Add a Shot to an early
Scene, or write a Condition that skips one, and the number of draws taken before
a later Scene changes — so the later Scene draws a different value under the same
seed, and a Position saved and replayed after an edit shows a Story it never
showed. A Reader coming back a beat would be safe, but an Author editing while a
Reading is in progress would silently rewrite it.

Keying the draw on its own identity removes the dependency altogether. The value
is `values[hash(seed, sceneId, visits, flag) % values.length]`, so each draw is
independent of every other: the same Scene, the same entry, the same Flag and the
same seed give the same value, whatever else the Story grew in the meantime. It
also gives the re-entry behaviour for free — the entry count is in the key, so a
Scene read a second time draws again, which is the whole point of a Story that
loops.

The hash is a few lines in `shared/utils/reading.ts` rather than a dependency, on
the grounds of `docs/adr/0010-the-graph-is-written-here-not-pulled-in.md`: FNV-1a
over the key with a final mix, which spreads two nearly equal keys — one entry to
a Scene and the next — far enough apart that a remainder over a list of six
reaches all six.

## Consequences

A Position is one number wider, and nothing else about it changes. A Reading
still never leaves the browser, so the seed goes when the page does: leaving
starts the Story over, as it always did.

Every screen that starts a Reading draws the seed after it is mounted rather than
in the Position it renders first. The server renders these pages too, and a seed
drawn there and drawn again in the browser hydrating them would be two different
Stories either side of hydration — so a Reading opens at `UNDRAWN`, the opening
Position under a seed of none, and draws once it is in the browser it will stay
in.

The Author's control over the draw is the reroll and nothing more. The seed is
never shown, never typed, and never carried in a link: a number an Author could
set by hand would be a second thing to understand about a Story that is supposed
to read as a Story.
