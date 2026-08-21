---
status: accepted
---

# A Shot's image lives in the Shot's row

The bytes of a Shot's still image are held in a `bytea` column on `shots`, capped
at two megabytes, and served by an endpoint of our own that applies the same
access rule as the Story they belong to. There is no object storage, no bucket
and no signed URL.

## Considered Options

The orthodox answer on this platform is Vercel Blob: put the file in object
storage, keep its URL on the Shot, and let the CDN serve it. We rejected it, and
the reason is not cost or effort but reach.

A Story is readable at a public link only while it is published, and
`nuxt.config.ts` already goes out of its way to say so: `/read/**` is `no-store`
because "a Reader's own browser keeping the page is enough to make an unpublished
Story go on answering". A blob URL is exactly that kept page, made permanent. A
public blob stays readable at its own address after the Publish is taken away,
and after the Story is deleted, by anyone who ever loaded the Reading — so a
still would be the one part of a Story an Author could not take back. Making
blobs private and handing out signed URLs restores the reach, but it buys back
what we already have: an endpoint that reads the Story's row and decides.

Holding the bytes in the row gives that for nothing. The image is reachable
exactly where the Story is, because the same query answers both questions; it
cascades away with the Scene, the Story and the Author, so nothing is orphaned in
a bucket by a delete that only touched Postgres; and a CI run gets working image
upload from the Neon branch it already rents, with no token, no secret and no
files left behind after the branch is dropped.

The size cap is what makes this defensible rather than reckless. Two megabytes is
a frame at screen size; a `bytea` that big is TOASTed out of the row by Postgres
and never touched by a query that does not select it, which is why
`readStoryGraph` selects `image is not null` and never the column itself.

## Consequences

Every still costs a function invocation and a database read, served `no-store`,
with no CDN in front of it. A Story of forty Shots is forty such requests per
Reading. That is the price of the reach, and it is the ceiling this decision
should be reopened at: an audience large enough for the invocations to show up on
a bill is an audience worth private blobs and signed URLs for, and the endpoint
that exists now is where those URLs would be minted, so the move is additive.

The type of an image is not stored. It is read out of the file's first bytes on
the way in — a client's declared content type is the client's to write, and these
bytes are served back under whatever type we believe — and read out of them again
on the way out, so there is one answer to what a still is and no column that can
disagree with the file. That is also what limits the formats to JPEG, PNG and
WebP: each is one signature to recognise, and an animated GIF is not the one still
image `CONTEXT.md` says a Shot carries.

A Shot has no alternative text, so a Reading renders the still with an empty
`alt` and lets the Shot's text carry the beat. That is a real accessibility gap
rather than a decision, and the field to close it belongs on the Shot beside its
text.
