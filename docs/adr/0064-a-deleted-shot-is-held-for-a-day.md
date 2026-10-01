---
status: accepted
---

# A deleted Shot is held for a day

Amends `docs/adr/0017-a-confirmation-is-drawn-on-the-bench.md`, whose table says
a Shot is deleted without a question. It still is. Decided on 2026-10-02, issue
#408.

The × at the end of a Shot's row deletes the Shot at one press. It takes the
uploaded Image and the point it is cropped around, the formatted text, the
Description, the Sound and its Transcript, and every Cut, Layout, Movement,
Effect and Condition the Author set on it. The × sits one mark to the right of ↓
in a row of five small marks. A Scene asks before it goes, but a Shot, which is
where the work actually is, did not, and nothing brought it back.

**A deleted Shot leaves a slim row where it stood, with *Put It Back* on it.**
The row says *Shot {place} of {scene} is deleted*, the focus moves to its
button, and the status line says the same sentence. Pressing it restores the
Shot under its own id, carrying everything it carried, and puts the caret in its
words. The row stays until the Shot is put back or the page is left. It is held
in the page and not in local storage, so a reload is the end of it.

**The server holds the deleted row whole, as `jsonb`, for a day.** `DELETE
/api/shots/:id` stays one statement: it deletes, closes the gap, inserts
`to_jsonb` of the deleted row into `deleted_shots`, records whether the Story's
Cover named the Shot, and lets go of everything held for more than a day. `POST
/api/shots/:id/back` is one statement too: it takes the held row, opens the run
at the Place, inserts the row through `jsonb_populate_record(null::shots, …)`
with that Place written over its own, and names the Story's Cover again where it
named this Shot and names none now. A row held for more than a day is refused
as not held, whether or not a delete has let go of it yet. Pruning on each
delete needs no job and no cron, and a Story that stops deleting stops pruning
only once there is nothing new to prune.

**Where it lands is one rule, `placeBack` in `shared/utils/scenes.ts`.** Right
after the Shot that stood before it, while that Shot is still in the Scene. At
the head of the run where nothing stood before it. Otherwise at the Place it
had, capped at the run's length. The bench draws the slim row where this says,
and the route writes the same rule in SQL, so *Put It Back* lands where the row
was drawn. Several Shots deleted from one Scene each leave a row of their own and
each is put back on its own.

## Why `jsonb` and not a column list

A predecessor set undo aside because every column of `shots` would have to be
copied by hand, as `server/api/scenes/[id]/duplicate.post.ts` and
`server/api/scenes/[id]/split.post.ts` still copy the Scene's. `shots` has
twenty-nine columns, most of them added one issue at a time as a beat learned
to play in a new way. A list written into the delete and the way back would be two
more places a new column has to be remembered, and forgetting it would put a
Shot back without what the Author set on it, which is a silent loss.
`to_jsonb` and `jsonb_populate_record` name no column at all. A column added to
`shots` later is held and put back with no change to either statement.

The Image and the Sound are `bytea`. `to_jsonb` writes a `bytea` as its `\x…`
hex text and `jsonb_populate_record` reads that text back through `bytea`'s own
input. `tests/e2e/put-back-signed-in.spec.ts` compares the bytes served for both
before the delete and after the way back, and they are the same, so neither
column is cast by hand.

## Why only a Shot

**A Scene keeps its question.** Its deletion cascades through every Shot in it,
every Exit at both ends of it, and the Sound other Scenes are heard under through
it (`docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`). Putting that back
would mean holding all of those rows and the names other Scenes hold of it. It
would also mean deciding what a Scene put back does to an Opening Scene the
Author has named since.

**An Exit keeps its plain ×.** An Exit put back would have to be checked again
against `docs/adr/0048-a-scene-is-entered-once.md`'s refusal of a way on that
comes back, because the Story may have grown a path to its target in the
meantime. A way back that can be refused is a second door, not an undo.

No Condition, Exit or Scene points at a Shot, so a Shot put back under its own id
breaks nothing that pointed at it. The one pointer is the Cover, and
`was_cover` carries it.

## Considered Options

**A confirmation on the ×.** `0017` refuses it for the reason it gives: a
question asked on every delete is dismissed unread, and it does nothing for the
press that was meant.

**A general undo, ⌘Z for every act of the bench.** Out of scope, and the cost
above for every table rather than one.

**Holding the row in the browser and writing it again.** The Image and the Sound
would have to round-trip through the page, and the bench would need a route that
writes a Shot whole, with every column validated at the boundary again.

**A "recently deleted" list.** It would outlive the sitting it is for, and the
day the server holds a row is a ceiling, not a promise.

## Consequences

Backspace at the head of an empty beat (`joinBeat` in `app/components/Writing.vue`)
still deletes it without a slim row, because an empty beat has nothing to lose.
The server holds it all the same, and lets go of it a day later.

A Scene deleted takes its held Shots with it: `deleted_shots.scene_id`
cascades, and the bench drops their slim rows when the Story is read back
without the Scene.

`jsonb_populate_record` fills a key the held row lacks with null rather than
with the column's default. A column added to `shots` as `not null` with a default
would therefore refuse, for one day after its deploy, to put back a Shot deleted
before it. The refusal is a server fault and not a wrong Shot. A migration that
adds such a column can backfill `deleted_shots."row"` in the same file.

The slim row is one more `li` in `.shots`, with no Place of its own and no
`data-shot`, so nothing that counts or finds a Shot's row counts it.
