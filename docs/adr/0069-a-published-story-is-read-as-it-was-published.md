---
status: accepted
---

# A published Story is read as it was published

Decided on 2026-10-02, issue #425. Amends
`docs/adr/0067-a-story-is-copied-whole.md`, which said that a published Story is
read live.

Until now every write the bench made reached `/read/<id>` and `/embed/<id>` the
moment it was saved, because `GET /api/read/:id` read the same rows the bench
writes. A Reader could meet a Shot's words half typed, a Scene with no Shot yet
behind an Exit already leading to it, or an Image being replaced. ADR 0067's
answer was to work on a copy, but a copy has a link of its own, no Comments, no
place in anybody's Lists and none in the Catalogue, and it can never become what
Readers read. An Author with Readers had to choose between working in front of
them and never bringing the work back.

**Publish takes an Edition of the work, and Readers read that Edition until the
Author publishes again.** The bench and its Preview go on reading the Story as it
is written. The public link, the embed and every Image and Sound they load read
the Edition. On a published Story the bench says when Readers' Edition was taken
and offers *Publish the Changes*, which takes a new one.

## Why an Edition rather than a live read

Every publishing tool an Author has used before keeps what is being written apart
from what is out. A live read made the bench a stage. With an Edition, writing is
private again until the Author says otherwise, and saying so is the act they
already know: Publish. There is one Edition per Story and no history of them.
Nothing reads an older one, so keeping it would cost storage and answer no
question anybody asks.

An Edition is stored as one `jsonb` column, `stories.edition`, holding what the
Reader's door answered before minus the presentation: `openingSceneId`,
`stepsBack`, `textFace`, `textAlign`, `scenes` and `exits`. `carriesSound` is
still derived from the Scenes when the Edition is read. One server function,
`takeEdition` in `server/utils/editions.ts`, builds it from `readStoryGraph`. The
narrowing that keeps editor-only fields out of a Reading moved into it from the
Reader's door, so there is still one list naming what a Reading may see.

## Why an Edition's shape is a contract

An Edition is written once and read for as long as the Author does not publish
again, so every field `takeEdition` names is absent from every Edition taken
before it was named, though the `Edition` type says it is there. A Reading that
trusts the type would throw on an older Edition, as a Scene's Question would have
if Editions had existed before it shipped. The change that names a new field
therefore does one of two things. It rewrites the field, with its default, into
every `stories.edition` in the same migration, with a `jsonb_set` over `scenes`,
`shots` or `exits`. Or the Reading reads the field's absence as that default.
Setting `edition` to null so that the next read takes it again is not a way out,
because that would publish work its Author has not published.

## Why the presentation stays live

The title, the Synopsis, the Language, the Cover and the Author's Name are what a
Story is presented by before anybody opens it. The shelf, the Catalogue, Lists,
Profiles and the link preview already read them live. An Author who rewrites the
Synopsis means it at once. Freezing it into the Edition would make the title card
disagree with the shelf entry the Reader just pressed. So `GET /api/read/:id`
answers the presentation from the row, as before, and the work from the Edition.
One consequence is accepted: a Cover named from a Shot added since the Edition
shows on the shelf before that Shot is published.

## Why media are held by digest beside the Edition

An Edition must not change when the Author replaces an Image or deletes a Shot.
It therefore cannot point at `/api/shots/:id/image`, which serves the live bytes
and answers a not-found once the Shot is gone. Images and Sounds live in their
rows (`docs/adr/0005-a-shots-image-lives-in-its-row.md`), so an Edition holds its
own copy of them, in `edition_media`: the Story's id, the hex of the bytes'
SHA-256 from Postgres's own `sha256(bytea)`, and the bytes. An Edition's
addresses name the digest: `/api/read/<storyId>/media/<digest>`.

Keying by digest means each distinct set of bytes is held once per Story. Two
Shots carrying the same frame share one row, and bytes unchanged between two
Publishes are not copied again (`on conflict do nothing`). The Publish that takes
a new Edition lets go of the rows it no longer names. The price is a second copy
of a published Story's Images and Sounds, which is what keeping bytes in rows
costs once a Story has two states. Only the copying is spared: every Publish,
and every first read, still reads and hashes every byte the Story carries, which
at two megabytes a medium is acceptable. *Amended by
`docs/adr/0070-the-bench-says-what-changed-since-the-edition.md`:* the rows now
keep their own digests, so a Publish hashes nothing and reads only the bytes it
does not hold yet. The digest is stored as hex text rather
than as `bytea`, so the address, the key and the door's lookup are one string.

The door serves a digest only while the Story is published and only under the
Story that holds it. Another Story's digest, a malformed one and an unpublished
Story all get the Story's not-found. It sends `no-store`, like the live doors,
because a link can be taken away. The live doors keep their rule, and the Covers
still come through them.

## Why an Edition never names bytes that are not held

The work is shaped in TypeScript, so an Edition cannot be built in one SQL
statement, and a write can land between reading the Story and writing the
Edition. `takeEdition` runs three statements. The first digests and holds every
Image and Sound the Story carries, without the bytes leaving Postgres, and
returns the digests. The second reads the graph. The third writes the Edition,
and it writes only where every digest the Edition names is a row of
`edition_media`. A live address with no digest from the first statement means a
Shot gained its Image in between, and the Edition is not taken either. Nor is it
taken when one of its Exits leaves or lands on a Scene it does not hold, or when
its Opening Scene is not among its Scenes: the Scenes, the Exits and the Opening
Scene are read by three queries, and a Scene written between them would
otherwise be frozen into the Edition half there, where before it was a moment's
inconsistency the next read put right. A refused
Edition is said as *This Story changed while it was being published: try
again.*, which the Author acts on by pressing again.

The guard is evaluated once, against the statement's snapshot. Two Publishes of
the same Story at the same instant, or a Publish racing an Unpublish, can still
let go of a digest the other Edition names, so one address answers a not-found
until the next Publish. The neon-http driver has no transactions to close that,
and it takes the same Author pressing twice at once while the Story changes. It
is accepted rather than locked against.

## Why an Edition is taken lazily for Stories published before it

No migration backfills `edition`. The bytes would have to be copied for every
published Story inside a migration, and the graph is shaped in TypeScript, which
a migration does not run. Instead, `GET /api/read/:id` gives a published Story
with no Edition one the first time it is read, through the same function under
the condition that it is still published and still has none. That covers every
Story published before this shipped and every Sample, which `plantSample` writes
already published. *Amended by
`docs/adr/0070-the-bench-says-what-changed-since-the-edition.md`:* a Sample is
now given its Edition as it is planted. Two first reads at once both try, and
the second finds the first's. Until that read, the bench shows *Publish the
Changes* without the sentence dating the Edition, because there is nothing to
date.

Code deployed before this ignores `edition`, so rolling back and forward again
serves Readers the Edition taken before the rollback until the next Publish
(`docs/adr/0002-the-schema-moves-with-the-deploy.md`).

## Why `published_at` does not move

The Catalogue is ordered by first publication. If publishing the changes moved
`published_at`, an Author who fixes a typo would lift their Story to the head of
the Catalogue, and the order would reward fiddling. So a Publish on a published
Story writes `edition_at`, which is when Readers' Edition was taken, and leaves
`published_at` alone. Unpublish clears both, with the Edition and its media,
along with `listed`, so publishing again starts the Story over. A copy carries
neither (`docs/adr/0067-a-story-is-copied-whole.md`), because it is unpublished.

## What this leaves out

The bench does not yet say what changed since the Edition, or offer *Publish the
Changes* only when something did — *amended by
`docs/adr/0070-the-bench-says-what-changed-since-the-edition.md`, which does
both*. Nothing discards the changes or puts the bench
back to the Edition, a Publish cannot be scheduled, and Readers are not told that
there is a new Edition. A Reader's kept Path
(`docs/adr/0038-a-reading-is-kept-in-the-readers-browser.md`) is replayed against
the Edition. A new Edition that no longer replays it starts them over through
`resumes()`, as an edit did before, only now at the moment the Author publishes
rather than while they type.
