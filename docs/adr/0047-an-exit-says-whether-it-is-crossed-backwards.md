---
status: accepted
---

# An Exit says whether it is crossed backwards

`docs/adr/0046-a-step-back-crosses-the-exit-it-came-by.md` gave a Reading a step
back and settled that it crosses the Exit the Reader came by. That is right for a
Reader who pressed the wrong way on, and wrong for a Story whose whole point is
that one door closes behind them: the press that undoes a choice was the
product's, offered over the Story, and the Story had no way to answer.

**The question is asked of the Exit, and the Story answers where the Exit has
not.** An Exit is crossed backwards, or it is not, or it says nothing and is
crossed as its Story says — three answers in one field, `steps_back`, nullable on
purpose. `back` in `shared/utils/reading.ts` reads `exit.stepsBack ??
story.stepsBack` and that is the whole of the rule, in one place, so the control
on screen and the move it would make cannot come apart.

**Stepping back within a Scene is never taken away.** Re-reading the beat before
is not a choice being undone, it is reading — a page turned back, not a decision
reversed. What carries the stakes is crossing the Exit, so that is the only thing
either setting reaches. A Story that closed the step back everywhere would be
taking away the one move that costs nothing.

**The Exit is the unit, and the Story is a default rather than a second
mechanism.** An Author who wants a work where nothing is taken back says it once
on the Story and writes no Exit differently; an Author who wants one door to shut
says it on that door. Both are answering the same question, which is why they
cannot contradict each other: the Story is only ever consulted for an Exit that
said nothing.

## Considered Options

**A switch on the Story alone.** One setting, no per-Exit control, and the
coarsest possible instrument: it cannot say *this door*, which is the thing a
Story actually wants to say. It also tempts the reading where the switch takes
away the whole control, Scene included, which confuses re-reading a beat with
undoing a choice.

**A mark on the Exit alone**, with no Story default. More expressive than the
switch and more work than it should be for the Story that wants none of it taken
back: every Exit marked by hand, and every Exit written afterwards marked again
or quietly wrong. A default that a door can contradict costs one nullable column.

**Two booleans with two reaches** — the Story taking away the whole control, the
Exit taking away only the crossing. It was the first reading of *both*, and it is
two facts about one subject: an Author would have to hold in their head which
setting reaches how far, and the bench would have to explain it. One question
with three answers is the same expressiveness without the explanation.

**A Reader's own preference**, stepping back wherever they ask for it. It makes
the Author's *no* advisory, which is the one thing it cannot be: a Story that
says a choice is final and then offers a way round it has said nothing.

**Telling the Reader why the control is gone** — a sentence where the step back
would have been. It says *the Author closed this door*, which is the bench
talking about the Story in the middle of the Story. A door that has closed says
nothing; a Story that wants it said says it in a Shot, in its own words and its
own Language.

**A step back that stops at the first Shot rather than disappearing.** It is what
the control does anyway — the step back inside the Scene is untouched, and the
first Shot is where it runs out. There is nothing left to offer there, so the
control goes rather than standing on screen doing nothing.

## Consequences

**`0046` is amended in one line.** It says the step back is offered exactly where
*Read Again from the Start* is, which is `moved()`. That stops being true the
moment an Exit can refuse: `Reading.vue` asks the engine for the beat behind and
draws the control only where there is one. Everything else `0046` settled — that
crossing is safe, that State is a pure function of the Path, that nothing is
unset — is untouched, and is exactly why an Exit can be closed by saying so
rather than by unwinding anything.

**Every Story written before this reads as it read.** `stories.steps_back`
defaults to true and `exits.steps_back` to null, so the shipped default is
`0046`'s behaviour and the migration changes no Reading. See
`docs/adr/0002-the-schema-moves-with-the-deploy.md`.

**The Author writes it where the thing is written.** The Exit's answer is in the
document beside the Conditions the Exit is offered under — both are what the
Author says *about* this way on rather than what it says — and the Story's is in
a fold on the header beside the presentation, because it is settled when the
Story is being thought about rather than while a Scene is being written. The two
folds are made exclusive by the platform's own shared `name`, since both hang
from the same end of the edge.

**The Preview marks the way on that does not come back**, beside the Exit as it
is offered, because an absent control has to read as what the Author wrote and
not as a defect. It is the only place the setting is said out loud in a reading,
and it is said to the Author alone.

**The engine's spec carries all four answers** — the Story's yes and no for an
Exit that said nothing, and the Exit's yes and no over a Story that said the
opposite — plus the step back inside a Scene that neither of them reaches, and
the rule that what is consulted is the Exit the Reading was taken by rather than
whichever Exit is standing.

**Reopening condition.** Reopen this if an Author ever needs a door that closes
only sometimes — crossed backwards under a Condition, the way an Exit is offered
under one. Nothing here forbids it: the field would stop being a boolean and
start being a list of tests, read in the same one place. It is not written until
a Story asks for it.
