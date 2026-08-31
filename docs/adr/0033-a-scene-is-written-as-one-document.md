---
status: accepted
---

# A Scene is written as one document

The writing surface stops being a form and becomes a document. Everything a
Scene holds is on it at once, in the order a Reader meets it — the Flags set on
entry, the run of beats, the ways on — and the run is typed the way a run of
paragraphs is typed anywhere: `Enter` at the end of a beat makes the next one and
puts the caret in it, `Backspace` at the head of an empty one takes it away and
joins the caret to the one before, `Alt` with the two arrows walks between them.

It stays one field per Shot. Nothing is parsed, nothing is split on a separator,
and no beat loses the id that its Image and its Conditions hang off.

This supersedes the tabs of
`docs/adr/0029-writing-a-scene-is-a-state-of-the-bench.md`, and only the tabs:
the fold that gives a Scene the width of the bench, the rail the graph becomes,
and the reading beside it all stand.

## Considered Options

**Keeping `Add a Shot`.** A beat is added, then written. Eight beats cost eight
presses, eight round trips, and eight moments of hunting for the caret. It is
bookkeeping asked of an Author in the middle of the one act the product exists
for. The model is right — `docs/adr/0001-branching-only-between-scenes.md` makes
a Scene a run of Shots and a Shot the atom — but a model is not an interaction,
and this one leaked out whole.

**One textarea for the whole Scene, split on blank lines.** This is what Twee
and ink do, and it is what "a Scene is a document" would mean literally. Refused
on the seam that matters: a Shot carries an Image and Conditions, and those hang
off its id. Splitting text back into Shots means matching paragraphs to ids —
which is a diff, which is a heuristic, and a heuristic that guesses wrong moves
somebody's Image onto the wrong beat or destroys it. The behaviour of a document
is worth having; the representation of one is not worth that risk. So the keys
behave as a document over a list of fields, and the mapping is never in doubt.

**A parser, so Conditions and Flags could be typed as lines too.** Refused by
`docs/adr/0004-conditions-stay-flat.md`, which protects the absence of a grammar.
Rows for Conditions and rows for Flags, on the surface rather than behind a tab,
is the same answer that record already gave.

**Leaving the tabs and shrinking the beat.** Half of this, and it would have
worked: a beat now costs a row rather than a card, and three tabs of a short
document are three tabs nobody needs. But the tabs cost something the height
never explained — a Condition and the Flags that satisfy it were never on screen
together, though they are one sentence read from two ends, and an Author had to
remember what the other tab said.

## Consequences

**A beat is a row.** The text and the thumbnail stand side by side, the
Description takes the line under them when there is an Image to describe, and
what a beat plays under shares its last line with the marks that move and delete
it. A beat cost the better part of two hundred and fifty pixels and now costs
about half that, which is what made the tabs unnecessary rather than merely
unwanted: a Scene of three beats, its Flags and its ways on now stand on one
screen together.

**No key is the only way to do what it does.** `Enter` has the control under the
run, `Backspace` has the mark at the end of the beat's own row, the arrows have
the two controls that renumber. A gesture nobody can see may not be the only way
in — the same rule the graph's hidden buttons follow.

**`Backspace` deletes without asking, and only when there is nothing to lose.**
An empty beat carrying no Image and no Condition is a paragraph, and joining two
paragraphs is what the key does everywhere. A beat carrying either is left alone
by the key and deleted by its own mark, because
`docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md` is about work that took
thought and that nothing on the screen would show being destroyed.

**A beat opened in the middle of a run costs two requests.** The endpoint adds a
Shot at the end and the run is renumbered behind it, inside one change. This is
the seam `docs/adr/0031-a-scene-is-born-from-an-exit-dropped-on-the-bench.md`
accepted for a Scene and its Exit, for the same reason: a third endpoint that
inserted would carry a copy of the rules these two already enforce. At the end of
a run — where an Author writing forwards spends all of their time — there is
nothing to renumber and it is one request.

**Each part of the document is headed and counted where it starts.** That is what
the tabs' counts were bought for, and it survives them: an Author scrolling knows
which part of the Scene they are in, and knows there are ways on to look at
before they have got to them.

**The guided path gains rather than loses.** Two of its Steps pointed at things
behind a tab — the Flags a Scene sets, and the Conditions of a Shot — and were
asked for whether or not the tab was open. Both targets are now always on the
surface, so the spotlight has a rectangle whenever the Step is showing.
