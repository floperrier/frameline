---
status: accepted
---

# A Condition tests one thing, and never composes

A Cut carries at most one Condition, and a Condition tests exactly one thing:
what a Flag holds, or how often a Scene has been entered. There is no `and`, no
`or`, no `not`, no arithmetic and no nesting, so the whole language is two shapes
and one comparison.

`CONTEXT.md` calls a Condition "an expression on a Cut", and this narrows that
word rather than contradicting it: an expression of one term, which is as much
expression as there will be until this decision is reopened.

## Considered Options

The obvious alternative is the expression language every comparable tool grows —
Ink's logic, Harlowe's macros, Arcweave's conditions — where a Condition is
parsed, arithmetic is allowed and tests compose. We rejected it for now, not
because it is hard, but because of what it drags in: a grammar to specify, a
parser to write, an evaluator to keep pure, an editor that can no longer be a row
of selects, and error reporting for expressions an Author typed wrong. None of
that is cinema, and all of it is code that has to be right before a single Story
reads better for it.

Storing the Condition as jsonb rather than as columns was the other choice, taken
because a Condition is read and written whole with its Cut and queried across
nothing. The price is that Postgres will accept any shape at all, so the shape is
enforced at the request boundary instead — including a refusal of any key beyond
the two or three a Condition may hold, which is what keeps flatness true of the
data and not merely of the editor.

## Consequences

An Author who wants two tests on one Cut has to route through a Scene: a Scene
that sets a Flag is where several conditions meet, and the graph shows that
meeting as a node instead of hiding it in an expression. This is the same trade
as ADR 0001 — split the Scene rather than enrich the syntax — and it is the most
likely early complaint.

Flags hold text and are compared for equality alone, so counting is done by
Scene visits, which the engine counts anyway. A Flag that was never set reads as
the empty value, which is how a Condition asks for the absence of one; the cost
is that a Flag explicitly set to nothing cannot be told from one never set, which
is why a Flag must be given a value when it is declared.

Because the whole of it is one comparison, the engine stays a pure function over
the Position with no parser and nothing to sandbox, and a failing Condition hides
a Cut rather than refusing it: the same test that filters what is offered is the
one that refuses a Cut a forged Position claims to have taken.
