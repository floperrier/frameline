---
status: accepted
---

# A Condition tests one thing, and the only way they compose is "all of them"

A Condition tests exactly one thing: what a Flag holds, or how often a Scene has
been entered. A Cut or a Shot carries a list of them, up to a small cap, and is
offered — or played — only where every one holds. There is no `or`, no `not`, no
arithmetic and no nesting, so the whole language is two shapes, one comparison,
and an `every`.

**Amended.** As first accepted, this decision let a Cut carry at most one
Condition and said a Condition "never composes". Writing Reel Change ran into
exactly the complaint the consequences below predicted — a way on that should
open only for a Reader who had done two things — and the prescribed detour, a
Scene where the two conditions meet, distorted the dramaturgy to serve the
schema (#26). Conjunction was let in because it costs an `every` and a repeated
row in the editor. What the decision is really protecting is the absence of a
parser, and that is untouched: a list of flat tests has no grammar, no
precedence, no parentheses and nothing an Author can type wrong.

**Amended again.** As accepted, only a Cut could carry a Condition, which meant a
Scene played the same words to a Reader on their third visit as on their first —
the only thing that could differ was the ways out. Writing *Reel Change* wanted a
line of its own for a Reader who had been in the booth before, and the only
answer available was a second Scene duplicating every Shot that had not changed
and every Cut leaving it (#31). So a Shot carries the same list under the same
cap, read by the same reader and judged by the same `holds`: a Shot whose
Conditions fail is left out of the run this Reading plays. Nothing about the
language changed — what changed is what may carry it.

`CONTEXT.md` calls a Condition "a flat test on State, carried by a Cut or by a
Shot", and the flatness is this: each test stands alone and is read on its own,
however many of them one of them carries.

## Considered Options

The obvious alternative is the expression language every comparable tool grows —
Ink's logic, Harlowe's macros, Arcweave's conditions — where a Condition is
parsed, arithmetic is allowed and tests compose in any shape at all. We rejected
it for now, not because it is hard, but because of what it drags in: a grammar to
specify, a parser to write, an evaluator to keep pure, an editor that can no
longer be a row of selects, and error reporting for expressions an Author typed
wrong. None of
that is cinema, and all of it is code that has to be right before a single Story
reads better for it.

Storing the Condition as jsonb rather than as columns was the other choice, taken
because a Condition is read and written whole with its Cut and queried across
nothing. The price is that Postgres will accept any shape at all, so the shape is
enforced at the request boundary instead — including a refusal of any key beyond
the two or three a Condition may hold, and of a list longer than the cap, which
is what keeps flatness true of the data and not merely of the editor.

## Consequences

A Scene is no longer the same run of Shots for every Reading — it is the Author's
run minus the Shots a Condition skips. The Position counts the run played rather
than the run written, so the beat after a skipped Shot is the next one on screen
and the Reader is never shown a gap. What this costs is that a Scene can no
longer say how long it is without being asked on behalf of one Reading, which is
why the engine hands back the run alongside the Shot.

An Author who wants two tests on one Cut writes two Conditions on it. One who
wants *either* of two still has to route through the graph — two Cuts to the same
Scene, one per test — or through a Scene that sets a Flag where the conditions
meet. This is the same trade as ADR 0001, now made at `or` rather than at `and`:
the graph carries the alternative, the Cut carries the conjunction.

Past the cap, the answer is again a Scene. A way on needing five tests is not a
nuance on an exit; it is a place in the Story that several threads reach.

Flags hold text and are compared for equality alone, so counting is done by
Scene visits, which the engine counts anyway. A Flag that was never set reads as
the empty value, which is how a Condition asks for the absence of one; the cost
is that a Flag explicitly set to nothing cannot be told from one never set, which
is why a Flag must be given a value when it is declared.

Because the whole of it is one comparison, the engine stays a pure function over
the Position with no parser and nothing to sandbox, and a failing Condition hides
a Cut rather than refusing it: the same test that filters what is offered is the
one that refuses a Cut a forged Position claims to have taken.
