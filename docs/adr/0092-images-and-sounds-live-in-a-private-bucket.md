---
status: accepted
---

# Images and Sounds live in a private bucket

Decided on 2026-10-12, issue #499. Supersedes
`docs/adr/0005-a-shots-image-lives-in-its-row.md`, and amends
`docs/adr/0049-a-sound-is-carried-by-what-plays-it.md`,
`docs/adr/0067-a-story-is-copied-whole.md`,
`docs/adr/0069-a-published-story-is-read-as-it-was-published.md`,
`docs/adr/0075-the-suite-brings-its-own-database.md` and
`docs/adr/0082-development-brings-its-own-database.md` on where the bytes are
held. The figures below are sourced in
`docs/research/2026-10-11-media-storage-and-transfer-costs.md`.

ADR 0005 kept every Image's bytes in a `bytea` on its row, and ADR 0049 did the
same for Sounds, so that a medium is reachable exactly where its Story is. That
reasoning still holds. What it did not weigh is the ceiling it puts the instance
under. Frameline runs at no monthly cost, on Neon's free plan and Vercel's Hobby
plan, and that is a constraint rather than a stage: no paid plan is the way out
of a ceiling. On the free plan a Neon project has 5 GB of public network transfer
a month, and when it runs out every compute in the project stops until the month
turns, the bench with the Readings. Every Image a Reader is shown crosses that
allowance, and crosses it twice over: `drizzle-orm/neon-http` receives a `bytea`
as hex text in a JSON body, 2N bytes on the wire for N bytes of Image, measured on
the suite's own proxy. That is about 12,500 Images shown a month, some 300 Readings
of a forty-Shot Story, for the whole instance. Storage is capped at 1 GB, and an
Edition holds a second copy of every medium it names. Nothing Readers have done
reached either ceiling yet, but a shared link brings an audience in a day, faster
than anything could warn of it, and there would be no button to press.

**The bytes of every Image and every Sound now live in one private Cloudflare R2
bucket, in its `eu` jurisdiction, and nowhere else.** R2's free tier holds 10 GB
a month, ten million reads and a million writes, and charges nothing for egress,
so the bytes no longer cross Neon or a Vercel function on their way to a Reader.
The bucket is written with `aws4fetch`, which signs S3 requests in eight
kilobytes.

**An object is named by the SHA-256 of its bytes and by nothing else.** The same
bytes are held once, whichever Shots, Scenes, Stories and Authors carry them. A
`media` table holds one row per object, with its size and the last time it was
used, and the digest columns `shots.image_digest`, `shots.sound_digest` and
`scenes.sound_digest` reference it, as `edition_media` does. Those columns stop
being computed by the triggers of migration 0033 from a `bytea`: the server
computes the digest when the bytes come in. `edition_media` keeps its pair of
Story and digest and loses its bytes, so taking an Edition copies nothing. A
copied Story (ADR 0067), a duplicated Shot or Scene and a Shot put back from
`deleted_shots` carry the digests, and copy nothing either. A Sound picked from
the library is one object however many Scenes play it.

**Bytes still come in through our own doors.** The `PUT` endpoints read the type
out of the first bytes and hold the file to its two megabytes, as ADR 0005 had
them do, then write the object. A presigned upload would let the browser write
into the bucket past that check. The same door keeps a ceiling of our own: once
the objects the `media` table counts reach 9 GB, it refuses new bytes and tells
the Author why.

**Bytes go out through a redirect.** The addresses do not change:
`/api/shots/:id/image`, `/api/shots/:id/sound`, `/api/scenes/:id/sound` and
`/api/read/:storyId/media/:digest` apply the access rule they apply today, then
answer a 302 to a presigned `GET` valid for five minutes, sent `no-store`. The
reach ADR 0005 was decided for is kept, with one bound: once a Story is
unpublished or deleted, no new address is signed for it, and the last ones signed
stop answering within five minutes. A public bucket would have kept them
answering for good. Presigned addresses are answered only on R2's own S3 domain,
`<account>.eu.r2.cloudflarestorage.com`. The bucket's CORS rule allows `GET` and
`HEAD` from any origin, because a Reading brings its Sounds in with `fetch`: the
signed address is the permission, and naming origins would restrict nothing and
break the preview deployments.

**Nothing deletes an object when a row goes.** A Story deleted cascades through
its Scenes, Shots and Edition inside Postgres without the server seeing a row,
and the same bytes may be carried by rows elsewhere. A Vercel cron, once a day,
deletes the `media` rows no row references any more and that have not been used
for a day, then their objects; a digest named in `deleted_shots` counts as
referenced. The foreign keys refuse to delete a `media` row while a row
references it. Hobby runs a cron once a day at most, within the hour, with no
retry, so the sweep is written to run twice with no harm. The order of its two
deletions, and the moment in which the same bytes uploaded again during its run
could lose their object, are the spec's to settle. Bytes an Author deletes stay
in the bucket up to two days, where nothing signs an address to them.

**The suite and development bring their own bucket.** `compose.yaml` and
`compose.dev.yaml` each start Versity Gateway (`versity/versitygw`) beside their
Postgres, on a `tmpfs` for the suite and a named volume for development, and the
step that applies the migrations creates the bucket and its CORS rule through the
S3 API, the call that sets the rule on R2. Measured against R2's behaviour, it is
the closest: a tampered and an expired presigned address both get a 403 with no
CORS headers, and the bucket's own rule decides a `GET`'s. Garage
(`dxflrs/garage`) passed the same tests with two differences, a 400 for an
expired address and `*` on every error, and is the one to switch to if Versity
Gateway goes the way MinIO went. Switching is a few lines of the two Compose
files.

The rows the migration finds are test data, so it does not move them: it drops
the `bytea` columns, the triggers and every digest and Edition that would name an
object the bucket does not hold. Every Story written before it keeps its words
and loses its Images and Sounds, and every published Story is unpublished.

## Considered Options

**Neon's Launch plan.** No monthly minimum and 500 GB of transfer, but a bill
that grows with Readers, and Vercel Hobby's 10 GB of Fast Origin Transfer would
stop the bytes next. Frameline runs at no monthly cost.

**The Vercel CDN in front of the media door,** purged by a tag per Story on
Publish, unpublish and delete. It was the smallest change and costs nothing, and
the bytes would have stayed in their rows. It was not chosen because it moves
only the transfer ceiling: storage stays at 1 GB with every published medium
held twice, about sixty Stories of forty Shots, every miss still reads the bytes
out of Neon as hex, and how long a purge takes to reach every region is
documented nowhere.

**Vercel Blob, private.** Hobby gives it 1 GB and 10 GB of transfer a month, so
it buys less room than the CDN for nearly the work of a bucket.

**Amazon S3.** The same design, but storage and requests are billed from the
first gigabyte.

## Consequences

**A card is on file at Cloudflare.** R2 cannot be enabled without a payment
method, and past the free tier it bills rather than refuses: there is no spending
cap, and a budget alert is an email the next day. The 9 GB ceiling keeps storage
inside the free tier. Reads are kept there by Neon: every address signed costs a
query, and Neon's own allowance runs out long before ten million. What escapes
both is one address replayed for its five minutes, at $0.36 a million reads. The
alert is set as low as Cloudflare allows.

**A second provider.** The bucket's credentials live in Vercel's environment, and
nowhere in CI, which uses its own. Creating the account, the bucket and the
credentials is for a human to do, once.

**Frameline stays non-commercial.** Hobby is for personal use. A paid offer,
advertising or a sale would put the instance on Vercel Pro, and reopen this.

**Neon's compute is now the nearest ceiling.** A Reading still asks Neon for
every medium it shows, a query of a few hundred bytes rather than the medium
itself, and each one keeps the compute awake. The 100 CU-hours a month of the free
plan are what the next audience runs into.

**This is reopened** when the `media` table nears 9 GB, when Cloudflare sends a
bill, or when Versity Gateway stops being published.
