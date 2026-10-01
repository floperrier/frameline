---
status: accepted
---

# A Condition asks whether an Exit has been taken

Two answers may lead to one Scene, and until now what followed could not
remember which of them was given without a Scene in between. It took one relay
Scene per answer, holding no Shot, setting a Flag and flowing on with
`exits_after = 0`. A Condition now asks a third thing, whether an Exit has been
taken, so the Scene two answers converge on plays a different beat to each, and
a way on further along is offered to one and not to the other. The Reader sees a
Story that remembers what they chose, and nothing on their screen names an Exit
or the State.

**It is `{ scene, entered }` asked of the Exits.** The shape is
`{ exit, taken }`, the exact mirror of the question about a Scene: carried by a
Shot or by an Exit under the same cap, held in the same jsonb list, read by the
same reader at the request boundary and judged by the same `holds` with the one
comparison the Scene's makes. No column is added, and `CONDITIONS_MAX` stays
four. The Exit is named by its id, as a Scene is, so a Condition naming one goes
on naming the same answer through a renumbering, a rewrite of its words, a split
and being led elsewhere. An Exit deleted leaves the Condition naming it where it
is, as a Scene deleted does: asked as taken it never holds, and asked as not
taken it always does.

**It is not counted.** An Exit leaves one Scene, and a Reading stands in a Scene
at most once — `docs/adr/0048-a-scene-is-entered-once.md` — so it takes an Exit
out of it at most once, and a count of Exits taken would be nought or one. That
is the argument that turned `{ scene, visits, times }` into
`{ scene, entered }`, and `docs/adr/0004-conditions-stay-flat.md` has no
arithmetic to compare a count with. Asking which Exit the Reading arrived by is
covered too: the Exit landing on a Scene that has been taken is the one the
Reading came in by, and `{ exit, taken }` asks that and reaches further back,
which is what lets a Scene two Exits on remember the answer.

**State gains the Exits taken, and they are the Path read back.** The walk that
reads off the Path the Scenes a Reading entered writes down each Exit as it
crosses it. A Shot of a Scene and an Exit leaving it are judged against the
State the walk holds on arriving, so both see every Exit taken up to and
including the one that entered the Scene, and none of the ways on out of it. The
list is the part of the Path the Story still carries and still offered: a Path
kept in the browser across an edit can name an Exit the Story no longer has, and
State never does. So State stays a pure function of the Path —
`docs/adr/0024-the-seed-belongs-to-the-position.md` — and a step back needs
nothing. `back` slices the last Exit off the Path, the walk builds State from
empty on every read, and the Exit stepped back across leaves `taken` the way the
Scene it led to leaves `entered`. That is
`docs/adr/0046-a-step-back-crosses-the-exit-it-came-by.md` doing the work it was
written for, and its reopening condition — anything at all accumulated outside
the Path — stays unmet. `Path`, `offered`, `take`, `advance` and `back` do not
change.

**The Preview's search tells arrivals apart by the Exits asked about too.**
`pathTo` passes a Scene once for each way of arriving at it that the ways on
further on tell apart. #348 keyed an arrival on the Flags held and on the Scenes
entered that some way on asks about or that are still ahead, because a key
without them had the Preview say *Nothing leads to …* of a Scene a Reading
reaches. A question about an Exit would fail the same way, so the key takes a
fourth member, the Exits taken that some way on asks about. Scene and Exit ids
are both uuids, so one set holds both. A Shot's Conditions stay out of the key,
as #348 left them, since they change nothing about what is offered further on.

**The bench reads the ways round, for a Scene and for an Exit.** Until now a
Remark said a Condition could never hold only when it asked a Flag for a value
no Scene sets. A question about a Scene was left alone on purpose, and the
reason given was a visit count — an Author who meant a Scene to be unreachable a
third time would be told their Story is broken — which `0048` took out of the
product. A question about an Exit makes the gap worse: the field it is written
in lists every Exit of the Story, the Scene's own among them, which is exactly
where one that can never hold gets written by accident. So for a Condition read
in Scene S — the Shot's Scene, or the one the Exit leaves — the bench reports
it where the ways on rule it out: a Scene asked as entered that no way from the
Opening Scene to S passes through; a Scene asked as not entered that every way
to S passes through, S itself and the Opening Scene among them; an Exit asked as
taken that is gone or that no way to S takes, which an Exit leaving S, or
leaving any Scene S reaches, always is; and an Exit asked as not taken that
every way to S takes.

The rule reads the ways on and never their Conditions, which answers the fear
`docs/adr/0032-the-bench-reads-the-story-back.md` had of a wrong answer about
routes. Conditions only take ways away, so a Condition it says can never hold
can never hold; one the graph allows and other Conditions forbid goes
unreported, which is the side to be wrong on. It is asked only of a Scene
reached from the Opening Scene, since one nothing reaches has `sceneUnreached`
to say the truer thing, and a Condition that always holds is not reported,
because playing or offering something to everyone is a Story and not a slip.
The two Remarks, `shotConditionNeverHolds` and `exitConditionNeverHolds`, are
said of the row and named after the glossary's own example of one. A Story
written before this reads exactly as it did, and the bench may say more about
it.

## Considered and refused

**An Exit that sets a Flag.** It is how articy, Arcweave and Chat Mapper carry
the need, and `docs/research/2026-08-27-paysage-concurrentiel.md` already found
it incompatible with `0004` and with the purity of `holds`. It would meet
`0046`'s reopening condition word for word, *a Flag set by something a Reader
does rather than by entering a Scene*, and give Flags a second place to be set
that `flagUntested` and `flagUnset` would have to read. The Author would invent
a name and a value for a fact the Path already holds; this asks the Path
directly and writes nothing into State that is not read off it.

**A count of Exits taken.** Above.

**The relay Scene**, which is what an Author wrote until now. It costs a Scene
per answer, each draws `sceneUnplayed`, each is a node of the Graph and a point
on the rail, and the Flag it sets is a second name for which Exit was taken.

**Naming the Exit by its departure and Place, or by its words.** A Place changes
whenever the ways on are renumbered —
`docs/adr/0007-the-order-of-the-ways-on-is-written-not-drawn.md` — and the
words change as the Author rewrites them. A work names an Exit by its departure
and Place only because it is written before any id exists and is never
renumbered.

**Offering in the field only the Exits that can hold.** A field filtered by the
graph would drop the value it holds the moment the Story moved under it, which
is why the Scene field offers every Scene. The Remark reports instead.

**Refusing at the boundary a Condition that can never hold.** `0032` refused
refusing writes, and a Condition naming an Exit no way leads through yet is a
Story in the middle of a sentence.

**Keeping the Remarks to Flags.** Above.

**Keying `pathTo` on the whole State.** Correct, and since the Exits taken tell
every route apart it would never pass an arrival over: a Scene nothing reaches
would have every route of the Story walked each time it is asked. The ids some
way on asks about are all that change what is offered further on.

**A name of its own for the question**, an *answer* or a word of cinema's. The
glossary already says an Exit is taken, and *raccord* and *montage* are on the
Exit's list of words to avoid.

## Consequences

- Nothing moves in the schema, so
  `docs/adr/0002-the-schema-moves-with-the-deploy.md` has nothing to order.
  After a rollback the code that ran before reads `{ exit, taken }` through its
  Scene branch, where it never holds: the Shot is skipped and the Exit hidden,
  and the boundary it rolled back to refuses to write one.
- The request boundary refuses a malformed one with `refusals.badCondition`,
  whose sentence now names the third question, and an Exit of another Story
  with the 404 it answers for a Scene outside the Story.
- A split keeps the Exits it moves, so a Condition naming one holds for the
  Readings it held for. A duplicated Scene keeps the Conditions naming the
  original Exits, which is the memory a copy exists to carry. An Exit
  duplicated from its row is a second answer, which a Condition naming the
  first does not name.
- The Condition editor offers *Exit* beside *Flag* and *Scene*, disabled where
  the Story has no Exit, and starts one on an Exit landing on the carrier's
  Scene, asked as *has been taken*. The Contact Sheet reads it back. The
  Preview lists the Exits a Reading has taken beside the Scenes it entered, and
  names the Exit a failed Condition asked about by the Scene it leaves and its
  Place there. No Command is marked.
- *Reel Change* offers *Take the coat with you* beside *Go up. Do not run.*, and
  *Daybreak* then plays the coat going away or the woman without it. Both
  Samples gain *Take the other Exit*, *Prendre l’autre Sortie*, and a Shot
  asking whether it was taken; their Flags `exit = taken` and `sortie = prise`
  become `route = long` and `chemin = long`, so that a Flag does not teach the
  Author that it and an Exit taken are one mechanism.
- `0004` is amended a fourth time: the language is three shapes, one comparison
  and an `every`. The paragraph of `0032` that left a Condition about a Scene
  unread points here.
