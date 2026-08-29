---
status: accepted
---

# An avatar is a URL, where an Image is bytes

ADR 0005 holds a Shot's Image in the Shot's own row, because the Image belongs to
the Shot: it is part of the work, it is only as reachable as the Story it is in,
and losing it would be losing something an Author made. An avatar is the opposite
case in every one of those respects. It belongs to the provider the Author signed
in with, which goes on serving it at a URL; nobody here made it; and a Profile
that shows no picture is a Profile with no picture on it rather than a work with
a hole in it.

So the column holds the URL the provider handed back and nothing else. No bytes
are stored, nothing is fetched at sign-in, nothing is resized, and there is no
table of images for people. The `<img>` on a Profile points straight at GitHub or
Google.

## Consequences

**A Profile leaks a request to the provider.** Whoever reads it asks GitHub or
Google for the picture, which tells the provider that somebody looked. The tag
carries `referrerpolicy="no-referrer"`, so it does not also tell them which
Profile.

**A picture can go stale or vanish.** An Author who changes their avatar with the
provider sees the new one here the next time they sign in, and a URL that stops
answering leaves a gap in the header. Both are acceptable for something the
product never claimed to keep.

**Storing bytes later is a migration, not a redesign.** The day avatars have to
be uploaded rather than borrowed, the column becomes what it names — and until
that day it has cost nothing.
