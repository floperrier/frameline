---
status: accepted
---

# A Shot's words are cut where the caret stands

Decided on 2026-10-02, issue #432. Amends the passage of
`docs/adr/0043-a-story-is-written-as-one-document.md` on `Enter` and `Backspace`,
which only said what `Enter` does at the end of a Shot and what `Backspace` does
at the head of an empty one.

A writer writes long and cuts afterwards. In every editor they have used, a key
cuts a paragraph in two where the caret stands, and `Backspace` puts it back
together. On the bench, `Enter` in the middle of a Shot opened an empty Shot and
left the words after the caret where they were. `Backspace` at the head of a
Shot holding words did nothing. **`Enter` now cuts a Shot in two where the caret
stands, and `Backspace` at the head of a Shot joins its words onto the end of the
Shot before**, the way paragraphs are cut and joined anywhere. Nothing else about
the two keys changes. `Enter` with nothing after the caret opens an empty Shot
that says nothing, `Shift+Enter` breaks a line inside the Shot, a selection is
replaced first, and neither key reaches across Scenes. Backspace at the head of
a Scene's first Shot does nothing.

## What goes with the words

What is about the words goes with the words. What is about the Image or the
Sound stays with them.

The Shot keeps the words before the caret. It also keeps its id, its Image, the
point it is cropped around, its Description, its Movement and the Image's
Effects, its Sound and Transcript, its Cut and Layout, and whether it is the
Cover. A Sound strikes once, with the beat it was written for. The Cut and the
Layout are said of the beat and not of its words.

The new Shot, right under it, holds the words after the caret with their
formatting. It carries how the text arrives, the text's Effects, and the
Conditions the Shot plays under, so words written to play only for some Readers
do not start playing for all of them because the Author pressed `Enter`. It
carries no Image: the bench has no act that takes an Image off a Shot, and ⧉
(#424) already writes a beat again under the same frame. Everything else it
leaves to its Scene, like any beat `Enter` opens. The caret lands at the head of
its words.

The cut is one statement, `server/api/shots/[id]/split.post.ts`, because
neon-http has no transactions. It writes the first half to the Shot, opens the
run and inserts the new Shot naming only the columns it carries. Every other
column takes its default, and `image` is never written, so its digest stays its
trigger's (ADR 0070).

## Where the text is cut

`splitFormatted` in `shared/utils/formatted.ts` cuts the text at the caret's
position, counted the way ProseMirror counts it.

- The block the caret is in is cut in two, and each half keeps its attrs.
- The document's own `attrs`, where the text stands, stay with both halves.
- A piece left with no words is left out, so a cut at the edge of a line leaves
  no empty line behind.
- A Speech cut in its lines gives the second half the same Speaker, so both
  beats say who speaks. A caret inside the Speaker takes the whole Speech on.
- A Quote's Source goes with the quoted lines after the caret. It stays with
  the first half when none follow, or when the caret is in it.

## The join is the cut undone

`joinFormatted` meets the last block of the first text and the first block of
the second the way two paragraphs meet. Two lines become one, keeping the first
line's attrs. Two Verses meet, two Quotes meet where the first has no Source,
and two Speeches meet where their Speakers are the same. Anything else is laid
end to end. The caret lands at the seam.

The join happens only where nothing deposited or tested would be lost: the Shot
carries no Image and no Sound, and its Conditions are the Shot before's.
Otherwise nothing is written, and the status line says which of the three
stopped it. What the joined Shot said about how it plays goes with it, so a cut
followed straight by `Backspace` gives back the Shot it was. Like an empty Shot
taken by `Backspace`, it goes with no *Put It Back* row. The bench writes the
joined words to the Shot before before it deletes the Shot. A delete that fails
therefore leaves the words twice and never loses them.

A cut and a join are both clicks in how they are sent, but both rewrite words the
page holds. So each one waits until every typed write sent before it has landed,
because one of those could otherwise land after it and write the old words back.
While one is on its way, a second `Enter` or `Backspace` that would make another
does nothing. If struck twice, it would cut or join words the first has not yet
moved.

A cut inside a line's words joins back to exactly the text it came from. A cut
at the edge of a line used up the break between two lines, so the join makes
them one line, as `Backspace` does between two paragraphs, and `Shift+Enter`
puts the break back. Remembering which kind of cut made two Shots would make the
join depend on history the Story does not hold. A Shot's words are the only
record.

## Consequences

Neither act is a Command. A Command is a control marked on the bench
(`docs/adr/0035-every-act-marked-on-the-bench-is-reachable-by-naming-it.md`), and
these are keys inside the words, like the `Enter` and `Backspace` they extend.
0035 asks that no key be the only way to do what it does. These two keys only
shorten what the bench's controls already do: select the words, cut them, add a
Shot under and paste them in. The join is the same thing the other way, ending
on the ×. A Shot pasted whole from elsewhere is broken into beats one `Enter` at
a time. Splitting a paste into a Shot per paragraph by itself is not done here.
