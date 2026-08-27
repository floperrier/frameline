---
status: accepted
---

# Being published and being found are two acts

Publishing has meant one thing since ADR 0003: the Story becomes readable at its
own id, and the Author sends that link to whoever they want. Introducing a
Catalogue could have folded the two together — publish, and thereby appear — and
that is what was refused. A Story is Listed only when its Author says so, in a
second act, so a Story goes on being publishable to three friends without going
on show to everybody.

The shape this takes is a single `listed` flag beside the `published_at` that is
already there, rather than one column naming three states. `published_at` already
distinguishes private from published and says when as well as whether; the state
between them — published, reachable by link, in no catalogue — is precisely what
that column has always meant on its own. A three-valued column would re-say what
it says and would have to be kept consistent with it.

## Consequences

**Every Story published before this exists is unlisted.** Nobody agreed to appear
in a catalogue that did not exist when they published, so the flag defaults to
false and no backfill sets it. There are no published Stories in production
today, which makes this cost nothing and makes it the rule anyway.

**Listing is where a Name is required.** An unlisted Story is signed by nobody
because nobody browses to it; a Listed one appears beside its Author's Name, so
the act of listing is the moment the Name is asked for if it is missing.
Publishing keeps asking for nothing.

**Unlisting is not unpublishing.** Taking a Story out of the Catalogue leaves
every link already sent still working, which is the only behaviour consistent
with the link being the Story's own id. An Author who wants it dark unpublishes.
