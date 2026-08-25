---
status: accepted
---

# A confirmation is drawn on the bench

An act is asked about when it takes something with it that the Author did not
name in the act. Deleting a Récit and deleting a Scène ask. Deleting a Plan,
deleting a Coupe and unpublishing do not. The question is a `<dialog>` drawn
from the tokens in `app/assets/css/frameline.css`, and `window.confirm` appears
nowhere in the product.

Four points settle it, and they settle all five acts rather than the two that
happened to ask before.

**A confirmation guards the Author's writing, and only that.** A Reader's
Position lives in the browser and nowhere else — it does not survive a reload —
so an act that ends a Lecture in flight is not, by that fact, worth a question
at the bench. Unpublishing destroys nothing durable: it clears the published
timestamp, and republishing hands back the same link, because the link is the
Story's own id
(`docs/adr/0003-the-public-link-is-the-storys-own-id.md`).

**An act is asked about when it takes something the Author did not name.** Not
reversibility, which makes everything ask — including an empty Plan added by
mistake — and trains the Author to dismiss the question unread. Not effort,
which cannot be written down without arguing about seconds.

**What counts as taken with it is a thing with a Place of its own** — a Scene, a
Shot, a Cut. Everything carried is part of what was named: a Photogramme is not
taken with the Plan, it *is* the Plan, exactly as the glossary has it — "what a
Shot has at most one of, never a thing of its own". The same goes for a
Description, the Conditions on a Shot or a Cut, and the Flags a Scene sets. A
Plan carrying three Conditions therefore asks no more than a bare one does: a
control that asks on Tuesday and not on Wednesday is worse than either
consistent answer.

**An act that takes something away for good and is not asked about is marked on
the way in, and that is the whole of its guard.** The `.danger` treatment
already does this, and its comment in the stylesheet already says the mark
belongs on the way in "rather than only in the confirmation". Deleting a Plan
and deleting a Coupe wear it. Unpublishing does not, and is not given it here:
by the first point it destroys nothing, so the alarm would be the interface
claiming a consequence the act does not have. An act asks, or it is marked, or
it is neither — and the third is where an act belongs when nothing of the
Author's goes.

## What each act does

| Act | Asks | Why |
| --- | --- | --- |
| Delete a Récit | **Yes**, naming the Récit, with no counts | It takes the whole work; "everything written in it" is not made truer by arithmetic, and the Stories list carries only ids and titles |
| Delete a Scène | **Yes**, naming its Plans, its ways on and the ways in | Plans and Coupes at both ends go, and the Author named none of them |
| Delete a Plan | No | Takes only the Plan pointed at; its Photogramme, its Description and its Conditions are the Plan |
| Delete a Coupe | No | Takes only the Coupe pointed at; its text and its Conditions are the Coupe |
| Unpublish | No | Destroys nothing of the Author's, and carries no mark either |

The Scène phrase counts three separate figures rather than one total, because
"its Coupes" reads as the ones belonging to it and the Coupes drawn into it from
elsewhere are not. Counting only the ways on is what the phrase did before, and
it was wrong about what it destroys: a Scene with no way out and three Cuts
arriving announced "0 Coupes" and took three. `cutsInto` is the counterpart
`cutsFrom` never had.

## Considered Options

**Confirm everything.** Every destructive control asks, and the rule is one
sentence. It is also the rule that makes the question furniture: an Author
clearing four Coupes off a node meets four dialogs, learns the shape of the
dismissing button, and stops reading the one that matters. A question read every
time is worth more than a question asked every time.

**An undo instead of a question.** A toast that puts the Scene back reads as the
kinder answer, and it is a retention policy wearing a toast: what is kept, for
how long, whose, what happens to a Story deleted while one of its Scenes is
still recoverable, and what the Reader of a published Story sees in the window.
The deletes cascade in the schema and are correct as they stand; the cost here
is a whole feature to avoid one sentence.

**Arm-then-fire on the button.** The control turns into "Really?" on the first
press and performs on the second, and no surface is needed at all. It puts the
product back to asking in two voices — a dialog for a Scène, a mutating button
for a Récit — and the armed state is unreadable to anything that is not looking
at the button when it changes.

**Confirming an unpublish for the Reader's sake.** Somebody is mid-Lecture and
the link goes dead, which sounds like the definition of something worth asking
about. It is not the Author's writing, nothing durable is destroyed, and the
Reader's Position was already lost to any reload. Asking here would make the
rule about consequences in general, which is the confirm-everything rule
arriving by a side door.

**An entry in `CONTEXT.md`.** The glossary is the language of the work — Story,
Scene, Shot, Cut — and a confirmation is furniture the Author uses rather than
something a Story is made of. It gains nothing; the phrases it displays take
their French from the glossary, per
`docs/adr/0014-the-glossary-is-the-codes-language.md`.

## Consequences

The surface is a modal `<dialog>`, so the browser does the accessibility rather
than the page: the rest of the page is inert, `Escape` dismisses, focus moves
into the dialog when it opens and back to the control that opened it when it
closes. The dismissing button is first and carries `autofocus`, so a stray
`Enter` destroys nothing, and the destructive verb sits on the button that
performs the act — "Delete Scene", never "OK".

The state is a composable, `useConfirming`, in the shape of the others on these
pages: a handler asks and returns early, and the act itself still goes through
`change()` so a refusal surfaces the way every other refusal does
(`docs/adr/0009-a-refusal-travels-in-the-body.md`).

Playwright reads the question like any other part of the interface. No spec
intercepts a browser `dialog` event any more, which also means the Récit delete
has page-level coverage for the first time.

Reopening any of the five verdicts means amending this ADR, not adding a
`confirm`.
