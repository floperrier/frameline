---
status: accepted
---

# A Scene may end on a Question

Decided on 2026-10-02, issue #417. Extends
`docs/adr/0059-a-flag-is-said-by-its-name.md` and
`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`.

Before this, a Reader could only choose: press *Next Shot*, or take one of the
Exits on offer. The State that makes a Story remember belonged to the Author
alone. Flags were set by the Scenes as they were entered, and the record kept the
Scenes entered and the Exits taken. Nothing the Reader *said* ever reached the
State. A Story could not ask the Reader's name and address them by it three
Scenes later, or let them name the dog.

**A Scene may end on a Question.** The Author writes a sentence and names a Flag
beside it: two columns on the Scene, `question` and `question_flag`, both empty on
a Scene that asks nothing. A Scene asks where both are written, which `asks` in
`shared/utils/reading.ts` decides for the engine, the Remarks and the bench. Once
the Scene's run has played, and before its Exits are offered, the Reading draws
the sentence over a single line the Reader writes on, with *Answer* beside it.
The answer is then the value of that Flag for the rest of the Reading.

## Why the answer is a Flag

A new kind of value, an Answer with its own syntax and its own test, would have
needed everything a Flag already has: a way to be said in a text, a Condition to
test it, a place in the Preview's State, and Remarks for a name used and never set.
A Flag inherits all of it. `{name}` says the answer wherever a Reader reads, as
0059 settled, and a Condition tests it the way `docs/adr/0004-conditions-stay-flat.md`
tests every Flag. `declaredIn` counts the Flag of every Scene that asks, so the
braces are said and the Remarks know the name. A Flag answered and a Flag a Scene
sets may share a name: whichever is set last in the walk holds, which is how two
Scenes setting one Flag already behave.

The Remarks read an answered Flag as set, and as able to hold anything. They never
say that a Condition testing it can never hold, because the Reader may write
whatever the Condition asks for.

## Why at the end of the run, and before the Exits

The Shots set the Question up: the guard leans in and says *Password?*. A Question
asked as the Scene is entered could not be set up by that Scene's own Shots. The
Exits that follow are what the answer is for, so `walk` sets the answered Flag as
the Reading leaves the Scene, before that Scene's Exits are judged. The Exits of
the Scene that asked see the answer, and so does everything after it. The run of
that Scene is still judged against the State it was arrived with, because the run
has already played by the time the answer exists.

A step back from the Exits returns to the Question, with the answer given still
in the field. A step back from the Question returns to the last Shot of the run.
Crossing an Exit backwards drops the answers of the Scenes the shorter Path no
longer enters, so a Scene entered again asks again.

## Why it is not asked where no Exit is offered

A Scene that offers no Exit to this Reading is an ending
(`docs/adr/0053-a-reading-ends-on-its-last-shot.md`). A Question put there would
be answered into nothing, and the ending would have the product's field set over
it. So the Question is asked only where some Exit out of the Scene is offered.

*Offered* is read as *offered under some answer*. For that one test, the
Conditions an Exit carries on the answered Flag are set aside. Otherwise a Scene
whose only way on asks for the password would never ask for it, because before
the answer exists no Exit is offered. A Reader who then answers what no Exit asks
for has reached an ending, which is the Author's to write.

A Scene that asks and has no Exit at all has a Question nobody is ever put, and
the bench says so as a Remark, `questionNeverPut`.

## Why an empty answer is allowed

A Reader who will not type must not be trapped in front of a field. A Flag holding
nothing is a Flag never set, which a Condition already asks for with the empty
value. So *Answer* with nothing written is an answer, and the Exits are offered.
For the same reason the Preview's search, `pathTo`, answers every Question with
nothing on its way to the Scene being written, so a Question never stops the
Preview from reaching a Scene. It answers with more than nothing since #416: see
*How an answer is compared*, below.

## Why it lives in the Path and never reaches the server

The answer may be the Reader's name. A Reading is its Path and the Path is kept in
the Reader's browser and nowhere else (0038). The answer is therefore part of the
Path: `answers`, keyed by the Scene that asked. A Scene is entered at most once
(`docs/adr/0048-a-scene-is-entered-once.md`), so a Path holds at most one answer a
Scene and replays to the same State. The key is optional, so every Path a browser
kept before this reads as having no answers. Nothing about an answer is sent to
the server, stored with the Story or shown to the Author.

## How an answer is compared

Amended on 2026-10-02 by issue #416.

**A Condition on a Flag compares both sides folded.** `folded` in
`shared/utils/scenes.ts` reads a value `plainly`, as the bench reads a name —
case and accents set aside — trims it, and reads every run of white space as one
space. `holds` compares the value the Reading holds and the value the Condition
asks for that way. An Author who gates an Exit on `rosebud` meant the word, and a
Reader who types *Rosebud*, *rosebud * or *Rosébud* has said it: a riddle is
failed on the riddle, not on a capital letter. A value of spaces alone folds to
the empty value, so a Condition asking for nothing still holds where the Reader
answered nothing.

The rule is the same for every Flag Condition, whether the value was written on a
Scene, drawn from its list or answered. Two written values that differ only by
case or accent were never a distinction a Reader could see, and one rule is
simpler to say than two. The Remarks hold values against each other the same way,
so a Condition asking for `Red` where a Scene sets `red` is not said to be one that
can never hold. A Flag's *name* stays exact, as a text says it.

**The Preview tries the answers the Story waits for.** At a Question it holds no
answer for, `pathTo` answers with nothing and then with each value some Condition
of the Story, on a Shot or on an Exit, tests that Question's Flag against, two
values that fold alike being one. Those are the only answers that change what any
Condition says; every other answer reads like nothing to the ways on. So the
Preview reaches and stands on a Scene only one answer leads to, with that answer,
as the Condition spells it, in the Path, and a step back to the Question finds it
in the field. The search's merge key is untouched: two ways round holding the same
answer still merge, which keeps the search finite.

Left out: several accepted answers on one Condition, which two Exits or a
Condition per value already say; partial matches, synonyms, and numbers compared
as numbers.

## Considered Options

**Asking as the Scene is entered.** Refused, because the Scene's own Shots could
not set the Question up.

**Refusing an empty answer.** Refused, because it traps a Reader who will not type.

**Typed answers (a number, a choice from a list) or a minimum length.** Left out.
A choice from a list is what Exits already are.

**More than one Question in a Scene, or a Question in the middle of a run.** Left
out. A Question in the middle of a run is a split Scene
(`docs/adr/0001-branching-only-between-scenes.md`).

**Comparing answers loosely, ignoring case, accents and spaces.** Left to #416,
which this one blocks, and taken there: see *How an answer is compared*.

## Consequences

- The Flag's name appears nowhere on the Reader's screen or in an accessible name
  (`docs/adr/0054-the-reader-is-shown-what-the-author-wrote.md`). The Reader is
  shown the sentence, the field and *Answer*.
- Keys and swipes that go on do nothing while the Question stands, and a key typed
  in the field belongs to the field. *Step Back* still works.
- The Exits' clock starts once the Question is answered. A Scene that offers its
  Exits for no time flows into the first one offered as soon as the Reader answers.
- In one corner the held frame changes after the answer: where the answered Flag
  is also said by the last Shot of the Scene that asks, the frame held behind the
  Exits says the new value once the Question is answered.
