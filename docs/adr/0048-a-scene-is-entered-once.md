---
status: accepted
---

# A Scene is entered once

A Reading enters a Scene at most once. An Exit that would lead back to a Scene
the Reader could already have stood in is refused when it is written, and what
the Author writes instead is a copy of that Scene — its Shots, under a name the
bench numbers, with no ways on of its own. A Story is a form read forwards, and
a Scene an Author wants seen again is seen again as a copy.

This is a decision about what a Frameline Story is, and it is worth saying
plainly that it is not a decision about the drawing. The drawing was the reason
it was first reached for, and the drawing was measured: on seven Stories the
rule removes one line passing through a point and creates another, while turning
fifty Scenes into seventy-three. `docs/adr/0045-the-rail-draws-the-ways-on.md`
keeps its own reopening condition, and what makes a rail hard to follow — a line
that descends into a column wide enough to have wrapped — is untouched by
anything written here. So this record rests on the form and not on the picture:
a Story that is read forwards is a different thing to write, and that is the
thing being chosen.

## What is refused, and how

The test is a cycle and nothing else. Writing an Exit from A to B is refused
when B already reaches A, which is one walk of the ways on already written and
no more. A Story is therefore acyclic, and a Path — which never repeats a Scene
in an acyclic Story — is the whole of what "entered once" means.

The refusal is stable in the way that matters: because an Exit is refused
exactly when it is the one closing a cycle, adding an Exit can never make an
Exit written earlier illegal. Nothing an Author has already written is
condemned by something they write next.

A copy is not a new kind of thing. It is a Scene, carrying the Shots of the one
it was made from and none of its Exits, answering to the same name under the
number `docs/adr/0044-the-bench-numbers-a-name-two-scenes-answer-to.md` already
gives two Scenes of one name. It carries no link back to its original, and
nothing in the Story knows it is a copy: it is the Author's to change, to
rename, and to write new ways on from.

**Amended: a Reading refuses the way back that the writing never saw.** The
refusal above stands at the writing, so a Story written before this record may
still hold a cycle and a Reading of one would stand in a Scene twice — which is
the thing the record forbids. Three answers were open, and the one taken is that
the Reading refuses: an Exit whose Scene this Reading has already entered is not
offered. Nothing an Author wrote is edited and nothing is taken away, so no Story
is left with a Scene nothing arrives at; what changes is only what the Reader is
handed while standing in one.

It is the answer rather than the alternative it is refused as below because it is
the only one of the three that makes *a Reading stands in a Scene at most once*
true of every Story rather than of the ones written from here on. That is what
lets State stop counting entries everywhere and hold the Scenes entered instead.
Leaving those Stories alone keeps two behaviours in the product for as long as
one of them exists, and the count with them; breaking their cycles by migration
buys the one behaviour by editing work nobody asked it to edit, and can leave a
Scene nothing arrives at.

What it costs is exactly what the refusal below names: an Author of such a Story
is left holding a way on that can never be taken. That is a Remark's to report
rather than a silence — a Story whose returns have gone should say so where the
Author is reading it.

## Considered Options

**Refusing an Exit that lands on a column at or above its own**, which is what
"no way back up the rail" means read literally, and which is where this decision
started. A Scene's column is worked out from the whole Story by the walk in
`shared/utils/scenes.ts` — `docs/adr/0041-the-graph-is-drawn-from-the-story.md`
is explicit that nothing about it is written down — so the rule would be a rule
about a derived value. Concretely: `O→A→B→C` is legal throughout; the Author
then adds one Exit `O→C`, C moves from the fourth column to the second, and
`B→C` — written weeks earlier, untouched — becomes illegal. The bench would have
to refuse an Exit in O because of an Exit in B, or condemn one already written.
Refused for that, and not for being the wrong shape: measured on seven Stories
the two rules refuse the same Exits on four of them, and where they differ it is
the column rule refusing a way on between two Scenes of one column — a
neighbour, which this record allows.

**Enforcing it in the Reading rather than in the writing** — let the Author
write what they like, and simply not offer an Exit whose Scene has been entered.
It needs no refusal and no copy, and it is worse: the Exit is not sometimes
unavailable, it is never available, because the only way to be standing where it
is written is to have come through the Scene it leads to. The Author would have
written a way on that cannot be taken, which is the thing a Remark exists to
report.

*Amended.* Refused as a **replacement** for the refusal at the writing, and that
still stands. It is taken up **beside** it for the Stories the writing never saw,
where there is no longer anything to refuse as it is written — see the amendment
above. On a Story written under this record the Reading's refusal can never fire,
because no such way on can be written; on one written before it, that refusal is
what keeps the rule true of every Reading. The objection is the cost, and it is
accepted for those Stories alone.

**A copy that counts as its original**, so that a Condition could still ask how
often a Scene has been entered by counting its copies together. It preserves the
counting, and the counting is the thing this record removes; it would buy that
with an origin on every copy, a term in the glossary, and a run of questions
with no obvious answers — whether a copy is its original for an edit, for the
Contact Sheet, for a Remark. Refused as paying a concept to keep a mechanism
that has nothing left to count.

**Leaving the Story cyclic and fixing the drawing instead**, which is the honest
alternative if the picture is what is wanted. It is a router that avoids
obstacles, which `0045` refused with its eyes open, and the measurement above
says the picture barely moves under this record anyway. Both records point the
same way: if the rail stops being followable, the answer is the rail.

## Consequences

**What a Condition counts becomes what it asks.** With a Scene entered at most
once, `{ scene, visits, times }` can only ever compare against nought or one, so
it becomes `{ scene, entered }` — whether the Reader has stood there. The most
used form survives untouched, since "has this Reader been through the kitchen"
is what the test was almost always for; what goes is "the third time", along
with `VISITS_MAX` and the phrases that count. State stops being a flat map of
Flags plus a count per Scene and becomes a flat map of Flags plus the Scenes
entered. `docs/adr/0004-conditions-stay-flat.md` is amended by this, in the
direction it already argues for: the language gets smaller.

What each stored test becomes follows from that, and settles the migration:
`at least 1` is that the Scene has been entered, and `fewer than 1` that it has
not. Every other test compared against a number that can no longer be reached —
`at least 2` and up can never hold, `fewer than 2` and up always do — and a
language of two shapes has no way to say *never* or *always*. Those tests are
**removed from the list** rather than rewritten into something that changes what
they meant. The Exit or the Shot that carried one stays, offered under whatever
else it tests, or offered always where that was its only test: a beat an Author
kept for a return may therefore start playing, which is the honest reading of a
Story whose returns have gone.

**A Flag is drawn once per Reading rather than once per entry.** The seed in
`shared/utils/reading.ts` carries the visit count so that a Scene naming several
values for one Flag draws afresh each time it is entered; with one entry there
is one draw, and the count leaves the seed.
`docs/adr/0024-the-seed-belongs-to-the-position.md` is untouched — the seed still
belongs to the Path.

**Both Stories the product ships are rewritten.** Reel Change is a projection
booth an audience keeps climbing back to, and three of its seven Exits return
there; the Sample, in each Language, teaches going back twice out of five ways
on. Neither can be patched into shape, and neither should be: they are the
demonstration of a Story, and the Story has changed. They are rewritten as works
read forwards.

**The rail still draws lines that are not descents.** Two Scenes of one column
joined to each other are a neighbour and an arch, and this record allows them.
Measured on the seven Stories written to try it, no line runs up at all — but
that is a property of those Stories and not of the rule: a Scene reached both
early and late still takes the earlier column, so `O→A→B→C` with `O→C` leaves
`B→C` drawn as a line that runs up, legally. The drawing is not promised a
direction by this record.

**An Author who wanted a hub writes copies.** This is the loss, and it is not a
small one: a Story whose shape is a room everybody returns to is now a Story
with several rooms that resemble each other, each edited on its own. The answer
is the duplication act and nothing else, and the day an Author is found
maintaining five copies of one Scene by hand, this is the record that is wrong.
