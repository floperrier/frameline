---
status: accepted
---

# The bench says what changed since the Edition

Decided on 2026-10-02, issue #422. Amends
`docs/adr/0069-a-published-story-is-read-as-it-was-published.md`, which left the
bench offering *Publish the Changes* whether or not anything had changed, and had
every Publish hash every byte the Story carries.

Once Readers read an Edition, an Author could not tell whether what they wrote
that afternoon was out yet, which of thirty Scenes they had touched since, or
whether the button would hand Readers a Scene half rewritten. **The bench now
compares the Story as it is written with its Edition and says what differs.** The
line beside the public link says *Readers read this Story as it stands.* and
offers nothing to publish, or it dates the Edition, counts what changed and offers
*Publish the Changes*. Each Scene the Edition does not have is marked *Not yet
published*, and each it has in another form *Changed since published*, in the
line where *Opening Scene* stands.

## Why the comparison is one projection

The live Story is projected through the same function that builds an Edition,
`forTheReading` in `server/utils/editions.ts`, and the projection is compared with
the stored Edition by `changesSince` in `shared/utils/changes.ts`. Two
projections of one function cannot disagree about which fields a Reading reads,
so a field `takeEdition` names is compared the day it is named, and a field the
bench keeps for itself, such as where a Scene's node stands on the graph, is
never a change. The projection is passed through JSON before it is compared, so
it is what a Publish would write now. Postgres keeps a `jsonb` object's keys in
an order of its own, so the comparison ignores key order.

One equivalence is written into the comparison. The editor writes every
attribute a formatted text holds, `null` where the text is as the Story sets it,
while the builders a Sample is planted with leave them out. So an `attrs` holding
nothing but nulls reads as no `attrs`, and words typed back are no change.

## Why the Scene is the unit

Changes are counted by Scene, the unit an Author thinks of their Story in. A
Scene is compared with its Shots and with the Exits leaving it, because an Exit
belongs to the Scene it leaves everywhere on the bench. The Opening Scene,
`stepsBack`, and the text's face and alignment are how the whole Story is read,
so a change to any of them is said once, for the Story. A Scene of the Edition
that has been deleted is counted rather than marked, because there is no Scene
left on the bench to mark. Saying which Shot or which field changed, marks on the
rail, and discarding changes are left out.

A change undone is no change. The two are compared as values, and a Place is
always counted from the first with nothing missing, so a Shot moved down and back
up stands where it stood.

## Why digests are kept with the bytes

The projection names each Image and Sound by the digest of its bytes, and
hashing every medium on every bench load would read every byte of the Story. So
`shots.image_digest`, `shots.sound_digest` and `scenes.sound_digest` hold the hex
of `sha256` of their bytes, which is what `edition_media.digest` already holds.
They are kept by `before insert or update of image` triggers (`of sound` for the
Sounds), written in migration `0033`. Such a trigger fires only when a statement
names the bytes, so a Shot's words saved as they are typed never hash its Image.
Nothing in the code writes these columns, and nothing may: a statement that set
`image_digest` alone would not fire the trigger, and the digest would lie.

They are not generated columns. `POST /api/shots/:id/back`, `POST
/api/shots/:id/duplicate` and `POST /api/stories/:id/copy` insert through
`jsonb_populate_record` with every column, and Postgres refuses any value but
`DEFAULT` in a generated column. A trigger recomputes whatever they carried, and
it also covers `plantSample` and every upload route without touching them. The
migration backfills the existing rows.

`takeEdition` reads the digests from these columns rather than hashing, and
copies bytes into `edition_media` only for a digest the Story does not hold yet.
A Publish that changed no medium therefore reads no bytes at all, which retires
0069's accepted cost of hashing every byte on every Publish. The digest is the
same function of the same bytes, so an Edition taken now is identical to one
taken before.

## Why the answer is the server's, asked again after a typed write

`GET /api/stories/:id` answers `changes`, or null where the Story has no Edition
to differ from: unpublished, or published before Editions and not read since,
whose line stays as 0069 left it. A Sample, which arrives published, is given its
Edition as it is planted, so a new Author's first Story is compared from its
first load; the null line is left to Stories published before Editions. The
Edition itself is not sent to the bench. A click already reads the whole Story
back and the answer with it. A typed write never does
(`docs/adr/0008-refetch-is-for-a-refusal.md`), so the page asks again each time
a typed write is kept and takes only `changes` from the answer. It takes it only
while nothing has read the Story back since the question left, so an answer can
never outlive a fuller one. Nothing being typed is replaced, which is what 0008
protects.

The price is a read of the whole Story after every kept typed write. An Edition
is text and digests, a few tens of kilobytes for a long Story, and no bytes are
read. A door that answered `changes` alone would halve it if it ever matters.

## What an older Edition reads as

0069 lets a change that names a new field in an Edition either rewrite it into
every `stories.edition` in its migration, or have the Reading read its absence as
the default. Only the first keeps the bench quiet. An Edition missing a field
that the projection now carries differs from it in every Scene, so every Scene of
a Story published before the field is marked *Changed since published* until the
next Publish. That answer is honest, because publishing would write the field,
but it is noise. The change that names a field should therefore rewrite it into
the stored Editions.
