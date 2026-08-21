---
status: accepted
---

# The public link is the Story's own id

Publishing a Story makes it readable at `/read/<story id>` — the same id the
Author's own `/stories/<id>` page carries. A Publish writes `published_at` on the
Story and nothing else: no second identifier, no row anywhere recording that a
link was handed out.

That is what makes the link stable in the sense the Author needs. An Author who
unpublishes to fix a Scene and publishes again has not invalidated what they sent
anyone, because there was never anything to invalidate; the link is a property of
the Story, not of one act of publishing.

## Considered Options

A separate unguessable token per Publish was the alternative, and it buys one
thing: revocation. Unpublish and republish with a new token, and the old link
stays dead for whoever already had it. It costs a column, a lookup by something
other than the primary key, and a decision every Publish has to make — same token
or new one? — which is a question the product has no answer to yet.

Guessing was not the deciding factor either way. A v4 uuid is not enumerable, so
neither scheme leaks a Story an Author has not published.

## Consequences

**Unpublishing is not revocation from a person, only from the link.** Anyone who
kept the link gets it back the moment the Story is published again. The day a
Story needs to be taken away from a particular Reader for good, this decision has
to be reopened — a token per Publish is where it would go.

**Nothing on the public link may be cached beyond the Publish.** `nuxt.config.ts`
serves `/read/**` and `/api/read/**` with `cache-control: no-store`, because a
Reader's own browser holding the page is enough to make an unpublished Story go on
answering. Without the header the link keeps working for as long as the cache
does, which is the one acceptance criterion this scheme could otherwise fail.

**A Reading is not stored.** The Reader is handed the published Story and keeps
their Position in the browser, so every Reading starts with empty State and two
Readers share nothing. There is no reading row to key on a link either way.
