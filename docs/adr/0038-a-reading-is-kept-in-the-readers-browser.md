---
status: accepted
---

# A Reading is kept in the Reader's browser

A Reading is its Path — the Exits taken, the Shot stood at, the seed — and the
Path has lived in one place: a `ref` in the component that draws the Reading,
drawn afresh every time the page opened. So a Reader who reloaded, closed the
tab, followed the sign-in link under the Comments or came back the next day
started the Story over from its first Shot, whatever route they had taken to
wherever they had got. For a Story of any length that branches, that is the one
thing a Reader calls broken and the one thing an Author cannot mend from their
side.

Everything else was already in place. `reading()` is a pure function of a Story
and a Path; `walk` stops short where a taken Exit no longer fits; and
`docs/adr/0024-the-seed-belongs-to-the-position.md` argues at length that a Path
saved and replayed after an edit shows the Story it showed. The engine was built
to be replayed. Nothing ever saved what it would replay.

## The decision

The reading page keeps the Reader's Path in the browser, in local storage under
the Story's id, written on every move. When the page opens, the kept Path is read
back and, if it is one to go back to, becomes the Reading's starting point. The
frame's edge says the Reading was picked up where it left off, once, until the
Reader moves. *Read again from the start* stays where it was.

A kept Path is one to go back to — `resumes()` in the engine — when all three
hold:

- **It has moved.** Nothing has been read from the opening Path, so there is
  nothing to come back to.
- **It has not ended.** An ending is a place to leave from, not to be returned to:
  a Reader who finished the Story and opens the link again wants the Story.
- **It still replays in full.** Every Exit taken is walked, and the Shot count is
  within the run. An Exit the Author has since removed or hidden behind a
  Condition, or Shots taken away, would leave the Reader somewhere they never
  stood, so the Story starts over instead.

Any of the three failing, and anything in the slot that is not a Path, is a
fresh start with no notice.

## What is not done

**Nothing reaches the server.** No table, no route, no account. Two Readers of
one Story still cannot share what they have accumulated, and a Reader and their
own browser can. A Reading kept on the server would be a Reading somebody could
be signed in to, and a Reader needs no account by design.

**Preview keeps nothing.** The Preview draws the same component and does not
name a Story to keep the Reading for. An Author on the bench restarts, rerolls
and edits between reads; a Preview that reopened mid-Story would be a bench that
remembers what the Author has stopped meaning.

**No choice is asked.** The Reader is put back, not asked whether they want to
be. A book opens at the bookmark; the beginning is one press away and always was.

**One Reading per Story per browser.** Two tabs on the same Story write the same
slot, and the later move wins. That is what one bookmark does, and a Reader with
two bookmarks in one book is not a case worth a second slot.

## Consequences

`Path` is now something the browser writes and reads back, so its shape is
public in a way it was not: a change to it must read the old shape or treat it
as not a Path, which `kept()` already does by starting over on anything it does
not recognise.

The Story's id is the key, so the keys are stable across publishing and
unpublishing, which is the point: an Author who unpublishes to fix a Scene and
publishes again leaves every Reader where they were, unless the fix moved the
ground under them, in which case they start over.
