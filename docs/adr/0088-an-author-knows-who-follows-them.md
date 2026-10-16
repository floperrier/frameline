---
status: accepted
---

# An Author knows who follows them, and nobody else does

Decided on 2026-10-11, in a design session held before any issue.

An Author who publishes hears about it in Comments and in the counts on their own
bench (`docs/adr/0072-a-reading-is-counted-for-its-author.md`). An Author who
reads has had no way to hear that somebody they liked has published again. **An
Author may now Follow another from that Author's Profile, and what the Authors
they follow do next is brought to their Feed.** Following needs an account, like
everything that is signed.

**The Feed is one Author's, newest first.** It holds three things:
- a Story newly Listed by an Author they follow;
- a List that such an Author has made public;
- a Story newly gathered into a public List kept in their Favourites
  (`docs/adr/0085-a-list-may-be-made-public.md`).

It holds no new Edition, because republishing would then be a way back to the
top of everybody's Feed. It holds no Comment, for the same reason a Profile
gathers none. The Feed is not the Catalogue. The Catalogue is the same for
everyone and ordered by what each Story is
(`docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`). The Feed belongs
to one Author and is ordered by when things happened.

**The Author followed knows who follows them.** The list of those Authors stands
beside their shelf, and a new follower brings them a Notification in Frameline
(`docs/adr/0089-a-notification-reaches-an-author-three-ways.md`). **Nobody else
is shown who follows whom, or how many.** No count appears on a Profile, and no
page lists someone's followers or the Authors they follow. A public number of
followers is a score, and a public map of who follows whom shows more about
people than a small community needs. This is held while the community is small,
and is the first thing to reconsider when it is not.

## Consequences

**The Catalogue has no filter for the Authors one follows.** It was considered
and dropped. The Feed already does that work, and a Catalogue that is the same for
everyone can be cached.

**An Author cannot stop another from following them.** Blocking was left out.
Abuse is answered by a report
(`docs/adr/0087-anything-public-can-be-reported.md`).
