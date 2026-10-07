---
status: accepted
---

# A pasted text is cut at its empty lines

Decided on 2026-10-02, issue #438. Takes up the last sentence of
`docs/adr/0071-a-shots-words-are-cut-where-the-caret-stands.md`, which left out
splitting a paste into a Shot per paragraph.

An Author who drafts first, in a notes app, a word processor or a screenplay
program, arrives at the bench with a Scene's words already written: thirty
beats with a blank line between each. Making them Shots one *Add a Shot* and one
paste at a time, or thirty careful `Enter`s, is work the draft has already done.
**Beside *Add Shots from Images*, a Scene offers *Add Shots from Text***. It
opens a field under the run where the Author pastes the text, and the Shots it
makes are added at the end of the run, in order, in one request.

## The rule of the cut

`shotsOf` in `shared/utils/formatted.ts` is the whole rule, and the line under
the field is worked out from it, so what the line says is what is made.

- **A Shot is cut at every empty line.** A line holding only white space is
  empty, and several in a row are one cut. Each block between cuts is a Shot,
  and each of its lines is a line of it. Empty lines at the head and foot of
  the text are set aside first, so a trailing line break is not a cut.
- **Where the text holds no empty line, every line is a Shot.** A word processor
  often copies one paragraph per line with nothing between. Reading that as one
  Shot of thirty lines would be the wrong guess.
- **A block of two lines or more whose first line is in capitals is someone
  speaking.** That line is the Speaker, trimmed, and the lines under it are what
  they say: the `Speech` a Shot's formatted text already has. *In capitals*
  means a capital letter and no small one. That holds in any script with case,
  so `ÉLODIE` and `MRS. DALLOWAY` speak, and a line in a script without case
  never does. A first line starting with `@` is a Speaker whatever its case,
  without the `@`, for a name like `@McAllister`.
- **Nothing else is read.** Asterisks, underscores, brackets and a Flag in
  braces stay as typed. Spaces at the end of a line are dropped and those at its
  start are kept, as the editor keeps them.

A text is never cut at a full stop, because a Shot of several sentences is as
common as a Shot of one.

## Why these rules and not a markup

The blank line is what every draft already has between its paragraphs, and
capitals over a line of dialogue are what every script already has: Fountain's
character cue, and the `@` that forces one. Both are read from what the Author
pasted, not from anything they had to write for the bench. Emphasis, centred
lines, parentheticals, transitions and notes would each be a syntax for Authors
to learn, and a draft that never used it would be read wrong wherever it
happened to look like it. So formatting is done afterwards, on the bench, where
it is a button and not a convention. A parenthetical under a Speaker is one of
their lines.

## The request

`POST /api/scenes/:id/shots` takes an optional `{ formatted: [...] }`. Without
it, the door adds one empty Shot as it always has. With it, the list holds 1 to
`SHOTS_ADDED_MAX` (200) texts. Each is held to `parseFormatted(…, 'refuse')`,
and so to `SHOT_TEXT_MAX_LENGTH`, under the phrases a PATCH is refused with. The
Shots are inserted in one statement, each one reading the end of the run as it
stood before the statement and adding its own ordinal to it. 200 bounds a
request, not a Scene: a Scene of more is written in two pastes.

## Consequences

The new Shots are ordinary rows. Each says nothing of its own about how it
plays, so it plays as its Scene says. They read in the Preview and on the
Contact Sheet, count in the Scene's words, are read by the Remarks, mark a
published Story's Scene *Changed since published*, and can be deleted and put
back one by one. There is no undo of the whole paste: a paste that went wrong is
usually a few Shots, each of which can be deleted. A text that already sits in a
Shot is not cut by this rule, and `Enter` still cuts at the caret. Reading a
whole screenplay into a Story, with a Scene for each scene heading, could be
built on `shotsOf` later.
