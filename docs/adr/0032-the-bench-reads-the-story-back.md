---
status: accepted
---

# The bench reads the Story back

The bench draws a Story. It now also reads one: it reports what it finds — the
Scenes nothing arrives at, the Shots nobody has written, the Images with no
Description, the Flags set and never tested, the Flags tested and never set, the
Conditions that can never hold — as a count in the row above the bench that
opens into a list, each line pressing to the Scene it is about.

A Remark is advisory and never a refusal. Nothing here blocks a write, marks a
Story invalid, or corrects anything. Every one of these findings is a state an
Author is entitled to be in the middle of, and a finished Story may carry some of
them on purpose.

**It is owed because the drawing stopped being the place the shape was read.**
Until `docs/adr/0034-a-story-is-written-without-the-canvas.md` there was one
place a Scene nothing led to was visible without being looked for: it was the
card sitting on its own on the canvas. That was never a diagnostic, but it was a
picture the Author read every time they laid a Scene out. `0034` took the canvas
off the critical path and
`docs/adr/0035-every-act-of-the-bench-is-reachable-by-naming-it.md` finished the
job — a Story is now written, corrected and published without the graph ever
being unfolded, and a Scene named into existence from the bar joins nothing at a
cost of two seconds. `0035` says outright that this record is half of why the
reading is owed.

## Considered Options

**Nothing, which is where the field is.** The survey in
`docs/research/2026-08-27-paysage-concurrentiel.md` reads nineteen tools in
primary sources and finds exactly one — Chat Mapper Cloud — that validates
structure at all, and that one documents that it cannot find a variable nobody
uses. Twine counts broken links in a statistics panel. Arcweave, Charisma,
Dialogue Designer, Naninovel and Fungus have nothing. Doing nothing is therefore
the option with the most company and the least defence: an Author who has written
forty Scenes has no way to learn that one of them is unreachable except by
reading all forty.

**Refusing the write instead.** A Scene that nothing reaches would fail to save,
a Condition on an unset Flag would be rejected. Refused outright: every one of
these states is a Story mid-sentence. A Flag is set before it is tested, a Scene
exists before an Exit reaches it, and a Shot is added before it is written. A
product that refused them would be refusing the act of writing.

**Refusing the Publish instead**, which is the softer version of the same thing
and is refused for a reason of its own.
`docs/adr/0023-being-published-and-being-found-are-two-acts.md` keeps Publish to
the one thing it does, and a Story with a dangling Scene is a Story: whether it
is ready to be shown is the Author's judgement and not the bench's. The reading
stands on the bench, where the writing is, and says nothing at the moment of
publishing.

**Marking each card and each row where the defect is.** A badge on the node, a
warning beside the Condition. Rejected on two counts. It puts the count nowhere:
an Author would have to sweep the whole bench to learn how many there are, which
is the problem this exists to solve. And a mark on a card is a mark an Author
cannot see — most of a graph is off the fold, and after `0034` most Authors will
not unfold it at all, which is the same argument
`docs/adr/0010-the-graph-is-written-here-not-pulled-in.md` makes about the zoom
controls not floating over the surface.

**Validation on the server, travelling with the Story.** Rejected as work for
nothing. Every input is already in the browser: the editor fetches the whole
Story and reads it back after every write, so a reading computed here cannot
disagree with the screen, costs no request, and updates as the Author types. It
is the same argument `docs/adr/0020-progress-is-the-story.md` makes for the
guided path, and the Remarks are computed the same way for the same reasons.

## Consequences

**It stands in the row above the bench, beside the Commands.** That row is the
one part of the editor on the screen in both of the bench's states — the graph
whole, and the graph folded to a rail beside a Scene being written — which is
what the drawing itself stopped being. It is the row `0035` already put the way
in by naming into, and the count sits next to it: two things about the Story as a
whole, with the scale, which is about how far back it is being looked at, at the
other end.

**It is cheap because two earlier decisions made it cheap.**
`docs/adr/0004-conditions-stay-flat.md` keeps a Condition a flat test rather than
an expression, so what a Story tests is a list to be read rather than a tree to
be walked; and a Scene declares the Flags it sets, so what a Story sets is a list
too. Holding the two against each other is an intersection. Had either decision
gone the other way this would have been a static analyser. The record is worth
keeping for the argument as much as for the feature: it is the second time the
flatness has paid for itself.

**The Preview keeps the sentences it already says.** *Nothing leads to {scene}
yet* and *This Story has no opening Scene* are said beside the Scene on the
writing surface, in that Scene's own words, and the list drops both of them while
that Scene is open. Two voices for one fact is the objection `0034` raised about
the Exit's text, and the answer here is the same: the nearer voice wins. The
dropping is done where the list is drawn rather than in the reading, which knows
the Story and has no business knowing the bench.

**A Remark leads to the Scene by the act that already exists.** Pressing one asks
the page for the Scene on the writing surface — the same act the card's own
control performs and the same act the bar runs under *Go to X*, which is that
control pressed. So the three cannot disagree about where a Scene is, and nothing
here is a second navigation of the bench. Scrolling the Author to the exact
Condition would mean the reading knowing how the writing surface is laid out,
which is a coupling between a pure function and a template that
`docs/adr/0019-the-guided-path-is-anchored-to-the-template.md` already refused
once.

**A visit count is not read.** Whether a Scene can be entered often enough for a
Condition to hold is a question about the routes through the graph, not about a
list of values, and a wrong answer is worse than none: an Author who meant a
Scene to be enterable twice would be told their Story is broken. That question is
the Preview's, which walks a real Path.

**The reading has no memory and nothing to dismiss.** A Remark is not a task, is
not acknowledged, and is not stored. It is there while the Story is in that state
and gone when it is not, which is what makes it impossible for the list to be
wrong about the screen. The cost is that a finding an Author has decided to live
with is a finding they go on seeing; the count says how many, and a count of two
that never moves is a smaller cost than a list that has to be kept in step with a
store of dismissals.

**The count is never zero for long while a Scene is being written**, and that is
the shape of the thing rather than a defect in it. A Scene arrives holding no
Shot and `docs/adr/0033-a-scene-is-written-as-one-document.md` makes an empty
beat one press of `Enter`, so writing forwards raises Remarks and then answers
them. Each was read again on its own merits before being kept, and this is what
they all have in common: they report the distance between what is written and
what a Reader would meet, which is a distance an Author closes by writing. The
alternative — a reading that waits until it is sure the Author has stopped — is a
heuristic about intent, and there is nothing to base it on.

**The list is one line per finding, not one per Scene.** An Author correcting a
Story wants the list to shorten as they work, and a Scene carrying three
undescribed Images has three things to attend to. The two halves of a Flag nobody
joined up are the exception, and said once each: what is wrong there is the name,
and naming every place it appears would report one mistake as five.
